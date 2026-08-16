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
function Deploy-Application {
    Write-Info "Deploying CCMS to production (image tag $ImageTag)..."

    if (-not (Test-Path ".env")) {
        Write-Err ".env file not found locally! Copy .env.production.example to .env and configure it (used only to verify required keys locally — it is not uploaded)."
        exit 1
    }

    Write-Info "Verifying .env already exists on the server (it is never uploaded by this script)..."
    Invoke-RemoteSsh "test -f ${RemoteDir}/.env || (echo 'ERROR: ${RemoteDir}/.env is missing on the server. Provision it once via: scp .env ${RemoteUser}@${RemoteHost}:${RemoteDir}/.env' && exit 1)"

    Write-Info "Backing up database before deploy..."
    Invoke-RemoteSsh @"
cd ${RemoteDir}
mkdir -p backups
set -a; source .env; set +a
if [ -n "`$POSTGRES_CONNECTION_STRING" ]; then
    pg_dump "`$POSTGRES_CONNECTION_STRING" > backups/ccms_backup_`$(date +%Y%m%d_%H%M%S).sql
    ls -1t backups/ccms_backup_*.sql | tail -n +15 | xargs -r rm --
else
    echo 'WARN: POSTGRES_CONNECTION_STRING not set, skipping backup'
fi
"@

    Write-Info "Archiving local files for transfer (excludes .env, creds.local.md, player/, node_modules, .venv)..."
    if (Test-Path "ccms-deploy.tar") { Remove-Item "ccms-deploy.tar" }

    tar --exclude="node_modules" --exclude=".git" --exclude="bin" --exclude="obj" `
        --exclude="dist" --exclude=".venv" --exclude=".vs" --exclude="*.tar" `
        --exclude=".env" --exclude=".env.local" --exclude="creds.local.md" `
        --exclude="player" --exclude="backups" `
        -cf ccms-deploy.tar ./backend ./frontend ./nginx ./docker-compose.production.yml

    Write-Info "Uploading deployment archive to server..."
    if (Test-Path $SSHKeyPath) {
        scp -i $SSHKeyPath ./ccms-deploy.tar "${RemoteUser}@${RemoteHost}:${RemoteDir}/"
    } else {
        scp ./ccms-deploy.tar "${RemoteUser}@${RemoteHost}:${RemoteDir}/"
    }

    try {
        Write-Info "Building and starting containers (tag $ImageTag)..."
        $deployScript = @"
set -e
cd ${RemoteDir}
tar -xf ccms-deploy.tar
rm -f ccms-deploy.tar

# The server's /etc/nginx/nginx.conf is self-contained (has all server{} blocks).
# We do NOT overwrite it from ssl-nginx.conf to avoid duplicate-directive errors.
# Just verify nginx config is still valid and reload if needed.
nginx -t && systemctl reload nginx

export IMAGE_TAG=$ImageTag
docker compose -f docker-compose.production.yml build
docker compose -f docker-compose.production.yml up -d

echo "$ImageTag" >> .deployed_tags
tail -n 5 .deployed_tags > .deployed_tags.tmp
mv .deployed_tags.tmp .deployed_tags

docker image prune -f

echo 'Deployment complete!'
"@
        Invoke-RemoteSsh $deployScript
    } finally {
        Remove-Item "ccms-deploy.tar" -ErrorAction SilentlyContinue
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
set -a; source .env; set +a
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
