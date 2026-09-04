# ===========================================
# CCMS Production Deployment Script (PowerShell)
# ===========================================
# Usage: .\deploy-production.ps1 -Command [setup|deploy|rollback|ssl|logs|status|restart]
#
# .env is NEVER shipped by this script. Provision it on the server once,
# out of band (e.g. `scp .env user@host:/opt/ccms/.env` run manually, or a
# secrets manager), so it never travels through this repo's deploy archive,
# shell history, or `docker compose`'s process environment. `docker compose`
# reads a `.env` file that already sits next to the compose file on its own —
# no `export`/`xargs` step is needed or used here.
# ===========================================

param(
    [Parameter(Mandatory=$false)]
    [ValidateSet("setup", "deploy", "rollback", "ssl", "logs", "status", "restart", "help")]
    [string]$Command = "help",

    [Parameter(Mandatory=$false)]
    [string]$Service = "all"
)

# Configuration (set these as environment variables before running — do not
# hardcode server IPs/domains here)
$RemoteUser = if ($env:REMOTE_USER) { $env:REMOTE_USER } else { "root" }
$RemoteHost = if ($env:REMOTE_HOST) { $env:REMOTE_HOST } else { "" }
$RemoteDir = "/opt/ccms"
$Domain = if ($env:DOMAIN) { $env:DOMAIN } else { "" }
$SslEmail = if ($env:SSL_EMAIL) { $env:SSL_EMAIL } else { "" }
$ImageTag = Get-Date -Format "yyyyMMddHHmmss"

$SSHKeyPath = "$env:USERPROFILE\.ssh\ccms-hetzner"
$SshArgs = if (Test-Path $SSHKeyPath) { @("-i", $SSHKeyPath) } else { @() }

function Write-Info { param($Message) Write-Host "[INFO] $Message" -ForegroundColor Green }
function Write-Warn { param($Message) Write-Host "[WARN] $Message" -ForegroundColor Yellow }
function Write-Err { param($Message) Write-Host "[ERROR] $Message" -ForegroundColor Red }

function Invoke-RemoteSsh {
    param([string]$ScriptText)
    $clean = $ScriptText -replace "`r", ""
    if (Test-Path $SSHKeyPath) {
        ssh -i $SSHKeyPath "${RemoteUser}@${RemoteHost}" $clean
    } else {
        ssh "${RemoteUser}@${RemoteHost}" $clean
    }
    if ($LASTEXITCODE -ne 0) {
        Write-Err "Remote command failed with exit code $LASTEXITCODE"
        exit $LASTEXITCODE
    }
}

if (-not $RemoteHost) {
    Write-Err "`$env:REMOTE_HOST is not set. Set it before running this script."
    exit 1
}
if ($RemoteUser -eq "root") {
    Write-Warn "REMOTE_USER=root. Prefer a dedicated deploy user with sudo/docker-group access instead of SSHing as root."
}

# ===========================================
# INITIAL SERVER SETUP
# ===========================================
function Setup-Server {
    Write-Info "Setting up Hetzner server..."

    $setupScript = @"
apt-get update && apt-get upgrade -y

if ! command -v docker &> /dev/null; then
    curl -fsSL https://get.docker.com -o get-docker.sh
    sh get-docker.sh
    rm get-docker.sh
fi

if ! command -v docker-compose &> /dev/null; then
    apt-get install -y docker-compose-plugin
fi

apt-get install -y curl git htop nano ufw nginx certbot python3-certbot-nginx

ufw default deny incoming
ufw default allow outgoing
ufw allow ssh
ufw allow http
ufw allow https
ufw --force enable

mkdir -p /opt/ccms
mkdir -p /opt/ccms/backups
mkdir -p /opt/ccms/certbot/conf
mkdir -p /opt/ccms/certbot/www

if [ ! -f /etc/nginx/dhparam.pem ]; then
    openssl dhparam -out /etc/nginx/dhparam.pem 2048
fi

echo 'Server setup complete! Now provision /opt/ccms/.env manually (scp it once) before running -Command deploy.'
"@

    Invoke-RemoteSsh $setupScript
    Write-Info "Server setup complete!"
}

# ===========================================
# DEPLOY APPLICATION
# ===========================================
function Invoke-SshRetry {
    param([string]$ScriptText, [int]$Tries = 6)
    $clean = $ScriptText -replace "`r", ""
    for ($i = 1; $i -le $Tries; $i++) {
        $out = ssh @script:SshArgs -o ConnectTimeout=20 -o ServerAliveInterval=10 "${script:RemoteUser}@${script:RemoteHost}" $clean
        if ($LASTEXITCODE -eq 0) { return $out }
        Write-Warn "ssh attempt $i/$Tries failed; retrying in 6s..."
        Start-Sleep -Seconds 6
    }
    Write-Err "Remote command failed after $Tries attempts."
    exit 1
}

function Deploy-Application {
    Write-Info "Deploying CCMS to production (image tag $ImageTag)..."

    if (-not (Test-Path ".env")) {
        Write-Err ".env file not found locally! Copy .env.production.example to .env and configure it (used only to verify required keys locally — it is not uploaded)."
        exit 1
    }

    Write-Info "Verifying .env already exists on the server (it is never uploaded by this script)..."
    Invoke-SshRetry "test -f ${RemoteDir}/.env || (echo 'ERROR: ${RemoteDir}/.env is missing on the server. Provision it once via: scp .env ${RemoteUser}@${RemoteHost}:${RemoteDir}/.env' && exit 1)"

    # ── Database backup ────────────────────────────────────────────────
    # POSTGRES_CONNECTION_STRING on the server is .NET-style
    # ("Host=x;Database=y;..."), which pg_dump cannot read — convert it to
    # libpq keywords first. A failed backup ABORTS the deploy (that is the
    # point of taking one); set SKIP_DB_BACKUP=1 to bypass deliberately.
    if ($env:SKIP_DB_BACKUP -eq "1") {
        Write-Warn "SKIP_DB_BACKUP=1 — deploying WITHOUT a database backup."
    } else {
        Write-Info "Backing up database before deploy..."
        Invoke-SshRetry @"
set -e
cd ${RemoteDir}
mkdir -p backups
# Read the raw line instead of `source .env`: the value is an unquoted
# .NET-style connection string, and shell sourcing truncates it at the
# first ';' (docker-compose's own .env parser reads the full line).
CONN=`$(grep -m1 '^POSTGRES_CONNECTION_STRING=' .env | cut -d= -f2- | sed -e 's/^"//' -e 's/"`$//' -e "s/^'//" -e "s/'`$//")
if [ -z "`$CONN" ]; then
    echo 'ERROR: POSTGRES_CONNECTION_STRING not set on server — cannot back up. Set SKIP_DB_BACKUP=1 to deploy anyway.'
    exit 1
fi
LIBPQ=`$(python3 - "`$CONN" <<'PYEOF'
import sys
mapping = {'host':'host','server':'host','database':'dbname','username':'user','user id':'user','password':'password','port':'port','ssl mode':'sslmode','sslmode':'sslmode'}
parts = []
for kv in sys.argv[1].split(';'):
    if '=' not in kv: continue
    k, v = kv.split('=', 1)
    lk = mapping.get(k.strip().lower())
    if lk and v.strip():
        parts.append(f"{lk}='{v.strip()}'")
print(' '.join(parts))
PYEOF
)
# Containerized pg_dump: the host's client is v16 while Neon runs v17+,
# and pg_dump refuses cross-major dumps. postgres:17-alpine tracks the
# server major; bump the tag when Neon does.
OUT=backups/ccms_backup_`$(date +%Y%m%d_%H%M%S).sql
docker run --rm postgres:17-alpine pg_dump "`$LIBPQ" > "`$OUT"
if [ ! -s "`$OUT" ]; then echo 'ERROR: backup file is empty'; rm -f "`$OUT"; exit 1; fi
ls -1t backups/ccms_backup_*.sql | tail -n +15 | xargs -r rm --
echo "Backup complete: `$OUT (`$(stat -c %s `$OUT) bytes)"
"@
    }

    # ── Archive ────────────────────────────────────────────────────────
    Write-Info "Archiving local files for transfer (excludes .env, creds.local.md, player/, node_modules, .venv)..."
    if (Test-Path "ccms-deploy.tar.gz") { Remove-Item "ccms-deploy.tar.gz" }

    # uploads/logs/publish are local-only runtime artifacts (dev-time API
    # output, not source) — production's real uploads volume is ./uploads at
    # the repo root (see docker-compose.production.yml), not the nested
    # backend/CCMS.Api/uploads dev path, so excluding it here never touches
    # live media. Without these excludes the archive picks up whatever local
    # test uploads/logs/publish output happens to be on disk, which can
    # balloon it from a few MB of source to hundreds of MB.
    tar --exclude="node_modules" --exclude=".git" --exclude="bin" --exclude="obj" `
        --exclude="dist" --exclude=".venv" --exclude=".vs" --exclude="*.tar" `
        --exclude=".env" --exclude=".env.local" --exclude="creds.local.md" `
        --exclude="player" --exclude="backups" `
        --exclude="uploads" --exclude="logs" --exclude="publish" `
        -czf ccms-deploy.tar.gz ./backend ./frontend ./nginx ./docker-compose.production.yml

    $archive = Get-Item "ccms-deploy.tar.gz"
    $localHash = (Get-FileHash $archive -Algorithm SHA256).Hash.ToLower()
    Write-Info ("Archive {0:N1} MB, sha256 {1}" -f ($archive.Length / 1MB), $localHash.Substring(0, 12))

    # ── Chunked upload ─────────────────────────────────────────────────
    # The link to the server drops mid-transfer routinely; a single scp of
    # the full archive fails more often than it succeeds. 8 MB chunks are
    # each retried independently and the reassembled file is hash-verified.
    try {
        $chunkDir = Join-Path $env:TEMP "ccms-deploy-chunks"
        if (Test-Path $chunkDir) { Remove-Item $chunkDir -Recurse -Force }
        New-Item -ItemType Directory $chunkDir | Out-Null
        $chunkSize = 8MB
        $fs = [System.IO.File]::OpenRead($archive.FullName)
        $buf = New-Object byte[] $chunkSize
        $n = 0
        while (($read = $fs.Read($buf, 0, $chunkSize)) -gt 0) {
            $out = [System.IO.File]::OpenWrite((Join-Path $chunkDir ("chunk_{0:D3}" -f $n)))
            $out.Write($buf, 0, $read); $out.Close(); $n++
        }
        $fs.Close()
        Write-Info "Uploading archive in $n chunks..."

        Invoke-SshRetry "mkdir -p ${RemoteDir}/chunks && rm -f ${RemoteDir}/chunks/chunk_*"
        foreach ($chunk in (Get-ChildItem $chunkDir | Sort-Object Name)) {
            $ok = $false
            for ($try = 1; $try -le 6 -and -not $ok; $try++) {
                scp @SshArgs -o ConnectTimeout=20 -o ServerAliveInterval=10 $chunk.FullName "${RemoteUser}@${RemoteHost}:${RemoteDir}/chunks/" 2>$null
                $remoteSize = ssh @SshArgs -o ConnectTimeout=20 "${RemoteUser}@${RemoteHost}" "stat -c %s ${RemoteDir}/chunks/$($chunk.Name) 2>/dev/null"
                if ("$remoteSize".Trim() -eq "$($chunk.Length)") { $ok = $true }
                else { Write-Warn "$($chunk.Name) attempt $try failed; retrying..."; Start-Sleep -Seconds 4 }
            }
            if (-not $ok) { Write-Err "Chunk $($chunk.Name) failed after 6 attempts."; exit 1 }
        }
        $remoteHash = Invoke-SshRetry "cd ${RemoteDir} && cat chunks/chunk_* > ccms-deploy.tar.gz && rm -rf chunks && sha256sum ccms-deploy.tar.gz | cut -d' ' -f1"
        if ("$remoteHash".Trim() -ne $localHash) {
            Write-Err "Archive hash mismatch after upload (remote $remoteHash vs local $localHash)."
            exit 1
        }
        Write-Info "Upload verified."

        # ── Detached remote build ──────────────────────────────────────
        # nohup + log polling: a dropped SSH connection cannot kill the
        # build, and polling tolerates dropped polls.
        $deployScript = @"
set -e
cd ${RemoteDir}

# Remove the shipped source trees before extracting: tar only adds/overwrites,
# so files deleted locally would otherwise live forever on the server and can
# break the Docker build (stale .cs files referencing removed symbols).
# Only the directories the archive fully re-creates are wiped — .env, uploads/,
# backups/ and .deployed_tags live at the repo root and are untouched.
rm -rf backend frontend nginx
tar -xzf ccms-deploy.tar.gz
rm -f ccms-deploy.tar.gz

# Host nginx config (TLS termination happens outside Docker — see nginx/README.md).
# Validate before reloading so a bad config never takes down the currently-serving process.
cp nginx/ssl-nginx.conf /etc/nginx/sites-available/ccms.conf
ln -sf /etc/nginx/sites-available/ccms.conf /etc/nginx/sites-enabled/ccms.conf
nginx -t
systemctl reload nginx

export IMAGE_TAG=$ImageTag
docker compose -f docker-compose.production.yml build
docker compose -f docker-compose.production.yml up -d

echo "$ImageTag" >> .deployed_tags
tail -n 5 .deployed_tags > .deployed_tags.tmp
mv .deployed_tags.tmp .deployed_tags

docker image prune -f

echo 'DEPLOY_DONE'
"@
        $cleanScript = $deployScript -replace "`r", ""
        $tmpScript = Join-Path $env:TEMP "ccms-build-step.sh"
        [System.IO.File]::WriteAllText($tmpScript, $cleanScript)
        $uploaded = $false
        for ($try = 1; $try -le 8 -and -not $uploaded; $try++) {
            scp @SshArgs -o ConnectTimeout=20 $tmpScript "${RemoteUser}@${RemoteHost}:${RemoteDir}/build-step.sh" 2>$null
            if ($LASTEXITCODE -eq 0) { $uploaded = $true } else { Write-Warn "build-step.sh upload attempt $try failed; retrying..."; Start-Sleep -Seconds 5 }
        }
        if (-not $uploaded) { Write-Err "Could not upload build script."; exit 1 }

        Write-Info "Building and starting containers on the server (tag $ImageTag, detached)..."
        Invoke-SshRetry "cd ${RemoteDir} && rm -f build-step.log && (nohup bash build-step.sh > build-step.log 2>&1 &) && echo LAUNCHED" | Out-Null

        $deadline = (Get-Date).AddMinutes(15)
        $done = $false
        while ((Get-Date) -lt $deadline -and -not $done) {
            Start-Sleep -Seconds 20
            $tail = ssh @SshArgs -o ConnectTimeout=20 "${RemoteUser}@${RemoteHost}" "tail -n 3 ${RemoteDir}/build-step.log 2>/dev/null"
            if ($LASTEXITCODE -ne 0) { Write-Warn "(build poll dropped, retrying)"; continue }
            $flat = "$tail" -replace "`n", " | "
            Write-Host "  [build] $flat"
            if ("$tail" -match 'DEPLOY_DONE') { $done = $true }
            elseif ("$tail" -match 'ERROR|error MSB|failed to solve|non-zero code') {
                Write-Err "Remote build reported errors:"
                ssh @SshArgs "${RemoteUser}@${RemoteHost}" "tail -n 40 ${RemoteDir}/build-step.log"
                exit 1
            }
        }
        if (-not $done) {
            Write-Err "Timed out waiting for the remote build. Check: ssh ${RemoteUser}@${RemoteHost} 'tail -f ${RemoteDir}/build-step.log'"
            exit 1
        }
    } finally {
        Remove-Item "ccms-deploy.tar.gz" -ErrorAction SilentlyContinue
        if ($chunkDir -and (Test-Path $chunkDir)) { Remove-Item $chunkDir -Recurse -Force -ErrorAction SilentlyContinue }
    }

    Write-Info "Verifying deployment health..."
    Start-Sleep -Seconds 5
    $healthUrl = if ($Domain) { "https://${Domain}/health" } else { "" }
    if ($healthUrl) {
        try {
            $resp = Invoke-WebRequest -Uri $healthUrl -UseBasicParsing -TimeoutSec 15
            if ($resp.StatusCode -ne 200) { throw "status $($resp.StatusCode)" }
            Write-Info "Deployment complete and healthy!"
        } catch {
            Write-Err "Post-deploy health check FAILED ($_). Consider: .\deploy-production.ps1 -Command rollback"
            exit 1
        }
    } else {
        Write-Warn "`$env:DOMAIN not set — skipping automated health check. Verify manually."
    }
}

# ===========================================
# ROLLBACK
# ===========================================
function Rollback-Deployment {
    Write-Info "Rolling back to the previous deployment..."
    $rollbackScript = @"
set -e
cd ${RemoteDir}
if [ ! -f .deployed_tags ] || [ `$(wc -l < .deployed_tags) -lt 2 ]; then
    echo 'No previous deployment tag recorded — cannot roll back automatically.'
    exit 1
fi
PREVIOUS_TAG=`$(tail -n 2 .deployed_tags | head -n 1)
echo "Rolling back to image tag `$PREVIOUS_TAG..."
# No `source .env` here: docker compose reads the adjacent .env itself, and
# shell-sourcing an unquoted .NET connection string aborts under set -e
# (everything after the first ';' runs as a command).
export IMAGE_TAG=`$PREVIOUS_TAG
docker compose -f docker-compose.production.yml up -d
echo 'Rollback complete.'
"@
    Invoke-RemoteSsh $rollbackScript
}

# ===========================================
# SETUP SSL CERTIFICATES (host nginx + certbot)
# ===========================================
function Setup-SSL {
    Write-Info "Setting up SSL certificates with Let's Encrypt (host nginx)..."

    if (-not $Domain) {
        Write-Err "`$env:DOMAIN is not set."
        exit 1
    }

    $sslScript = @"
set -e
certbot --nginx -d ccms.${Domain} --email ${SslEmail} --agree-tos --no-eff-email --redirect
echo 'SSL certificates installed!'
"@

    Invoke-RemoteSsh $sslScript
    Write-Info "SSL setup complete!"
}

# ===========================================
# VIEW LOGS
# ===========================================
function View-Logs {
    param($ServiceName)

    if ($ServiceName -eq "all") {
        Invoke-RemoteSsh "cd ${RemoteDir} && docker compose -f docker-compose.production.yml logs -f --tail=100"
    } else {
        Invoke-RemoteSsh "cd ${RemoteDir} && docker compose -f docker-compose.production.yml logs -f --tail=100 ${ServiceName}"
    }
}

# ===========================================
# CHECK STATUS
# ===========================================
function Check-Status {
    Write-Info "Checking deployment status..."

    $statusScript = @"
cd ${RemoteDir}

echo ''
echo '=== Container Status ==='
docker compose -f docker-compose.production.yml ps

echo ''
echo '=== Resource Usage ==='
docker stats --no-stream

echo ''
echo '=== Disk Usage ==='
df -h | head -5

echo ''
echo '=== Memory Usage ==='
free -h
"@

    Invoke-RemoteSsh $statusScript
}

# ===========================================
# RESTART SERVICES
# ===========================================
function Restart-Services {
    param($ServiceName)

    if ($ServiceName -eq "all") {
        Invoke-RemoteSsh "cd ${RemoteDir} && docker compose -f docker-compose.production.yml restart"
    } else {
        Invoke-RemoteSsh "cd ${RemoteDir} && docker compose -f docker-compose.production.yml restart ${ServiceName}"
    }

    Write-Info "Services restarted!"
}

# ===========================================
# SHOW HELP
# ===========================================
function Show-Help {
    Write-Host @"

CCMS Production Deployment Script (PowerShell)
==============================================

Usage: .\deploy-production.ps1 -Command [command] [-Service servicename]

Commands:
  setup     - Initial server setup (Docker, nginx, firewall, etc.)
  deploy    - Back up DB, sync files, deploy nginx config, build+start containers
  rollback  - Roll back to the previously deployed image tag
  ssl       - Setup SSL certificates with Let's Encrypt (host nginx + certbot)
  logs      - View container logs (optional: -Service name)
  status    - Check deployment status
  restart   - Restart services (optional: -Service name)
  help      - Show this help message

Environment variables (set before running):
  `$env:REMOTE_USER  - SSH user (default: root; prefer a dedicated deploy user)
  `$env:REMOTE_HOST  - Hetzner server IP (required)
  `$env:DOMAIN       - Your domain name
  `$env:SSL_EMAIL    - Email for Let's Encrypt

.env is provisioned on the server ONCE, out of band:
  scp .env `$env:REMOTE_USER@`$env:REMOTE_HOST`:/opt/ccms/.env
This script never uploads or exports it.

"@
}

# ===========================================
# MAIN
# ===========================================
switch ($Command) {
    "setup" { Setup-Server }
    "deploy" { Deploy-Application }
    "rollback" { Rollback-Deployment }
    "ssl" { Setup-SSL }
    "logs" { View-Logs -ServiceName $Service }
    "status" { Check-Status }
    "restart" { Restart-Services -ServiceName $Service }
    default { Show-Help }
}
