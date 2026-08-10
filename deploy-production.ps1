# ===========================================
# CCMS Production Deployment Script (PowerShell)
# ===========================================
# Usage: .\deploy-production.ps1 -Command [setup|deploy|ssl|logs|status|restart]
# ===========================================

param(
    [Parameter(Mandatory=$false)]
    [ValidateSet("setup", "deploy", "ssl", "logs", "status", "restart", "help")]
    [string]$Command = "help",
    
    [Parameter(Mandatory=$false)]
    [string]$Service = "all"
)

# Load .env variables if .env exists
if (Test-Path ".env") {
    Get-Content ".env" | Where-Object { $_ -match "^[^#=]+=" } | ForEach-Object {
        $parts = $_.Split('=', 2)
        $name = $parts[0].Trim()
        $value = $parts[1].Trim()
        Set-Item "env:$name" $value
        [System.Environment]::SetEnvironmentVariable($name, $value)
    }
}

# Configuration
$RemoteUser = if ($env:REMOTE_USER) { $env:REMOTE_USER } else { "root" }
$RemoteHost = if ($env:REMOTE_HOST) { $env:REMOTE_HOST } else { "91.99.190.216" }
$RemoteDir = "/opt/ccms"
$Domain = if ($env:DOMAIN) { $env:DOMAIN } else { "pixelspot.in" }
$SslEmail = if ($env:SSL_EMAIL) { $env:SSL_EMAIL } else { "admin@pixelspot.in" }

$SSHKeyPath = "$env:USERPROFILE\.ssh\ccms-hetzner"
$SshArgs = if (Test-Path $SSHKeyPath) { @("-i", $SSHKeyPath) } else { @() }

function Write-Info { param($Message) Write-Host "[INFO] $Message" -ForegroundColor Green }
function Write-Warn { param($Message) Write-Host "[WARN] $Message" -ForegroundColor Yellow }
function Write-Err { param($Message) Write-Host "[ERROR] $Message" -ForegroundColor Red }

# ===========================================
# INITIAL SERVER SETUP
# ===========================================
function Setup-Server {
    Write-Info "Setting up Hetzner server..."
    
    $setupScript = @"
# Update system
apt-get update && apt-get upgrade -y

# Install Docker
if ! command -v docker &> /dev/null; then
    curl -fsSL https://get.docker.com -o get-docker.sh
    sh get-docker.sh
    rm get-docker.sh
fi

# Install Docker Compose
if ! command -v docker-compose &> /dev/null; then
    apt-get install -y docker-compose-plugin
fi

# Install useful tools
apt-get install -y curl git htop nano ufw

# Configure firewall
ufw default deny incoming
ufw default allow outgoing
ufw allow ssh
ufw allow http
ufw allow https
ufw --force enable

# Create application directory
mkdir -p /opt/ccms
mkdir -p /opt/ccms/certbot/conf
mkdir -p /opt/ccms/certbot/www
mkdir -p /opt/ccms/nginx/ssl

echo 'Server setup complete!'
"@
    
    ssh "${RemoteUser}@${RemoteHost}" ($setupScript -replace "`r", "")
    Write-Info "Server setup complete!"
}

# ===========================================
# DEPLOY APPLICATION
# ===========================================
function Deploy-Application {
    Write-Info "Deploying CCMS to production..."
    
    # Check if .env exists
    if (-not (Test-Path ".env")) {
        Write-Err ".env file not found! Copy .env.production.example to .env and configure it."
        exit 1
    }
    
    # Compress files to sync
    Write-Info "Archiving local files for transfer..."
    if (Test-Path "ccms-deploy.tar") { Remove-Item "ccms-deploy.tar" }
    
    # Run tar to package files excluding node_modules, build bins and git
    tar --exclude="node_modules" --exclude=".git" --exclude="bin" --exclude="obj" --exclude="dist" --exclude=".venv" --exclude=".vs" --exclude="*.tar" -cf ccms-deploy.tar ./backend ./frontend ./nginx ./docker-compose.production.yml ./.env
    
    Write-Info "Uploading deployment archive to server..."
    if (Test-Path $SSHKeyPath) {
        scp -i $SSHKeyPath ./ccms-deploy.tar "${RemoteUser}@${RemoteHost}:${RemoteDir}/"
    } else {
        scp ./ccms-deploy.tar "${RemoteUser}@${RemoteHost}:${RemoteDir}/"
    }
    
    Remove-Item "ccms-deploy.tar" -ErrorAction SilentlyContinue
    
    # Deploy on server
    Write-Info "Building and starting containers..."
    
    $deployScript = @"
cd ${RemoteDir}

# Extract deployment archive
tar -xf ccms-deploy.tar
rm -f ccms-deploy.tar

# Clean carriage returns from .env and configurations
sed -i 's/\r$//' .env
sed -i 's/\r$//' nginx/nginx.production.conf

# Load environment variables (handling spaces correctly)
export `$(grep -v '^#' .env | xargs -d '\n')

# Update domain in nginx config
sed -i "s/yourdomain.com/${Domain}/g" nginx/nginx.production.conf

# Pull latest images and rebuild
docker compose -f docker-compose.production.yml pull
docker compose -f docker-compose.production.yml build --no-cache

# Start services
docker compose -f docker-compose.production.yml up -d

# Cleanup old images
docker image prune -f

echo 'Deployment complete!'
"@
    
    if (Test-Path $SSHKeyPath) {
        ssh -i $SSHKeyPath "${RemoteUser}@${RemoteHost}" ($deployScript -replace "`r", "")
    } else {
        ssh "${RemoteUser}@${RemoteHost}" ($deployScript -replace "`r", "")
    }
    Write-Info "Deployment complete!"
}

# ===========================================
# SETUP SSL CERTIFICATES
# ===========================================
function Setup-SSL {
    Write-Info "Setting up SSL certificates with Let's Encrypt..."
    
    $sslScript = @"
cd ${RemoteDir}

# Create temporary nginx config for ACME challenge
cat > /tmp/nginx-acme.conf << 'EOF'
events { worker_connections 1024; }
http {
    server {
        listen 80;
        server_name ccms.${Domain} api.ccms.${Domain};
        location /.well-known/acme-challenge/ {
            root /var/www/certbot;
        }
        location / {
            return 200 'ACME Challenge Server';
            add_header Content-Type text/plain;
        }
    }
}
EOF

# Stop existing nginx if running
docker stop ccms-nginx 2>/dev/null || true

# Start temporary nginx
docker run -d --name nginx-acme -p 80:80 \
    -v /tmp/nginx-acme.conf:/etc/nginx/nginx.conf:ro \
    -v ${RemoteDir}/certbot/www:/var/www/certbot \
    nginx:alpine

# Get certificates
docker run --rm \
    -v ${RemoteDir}/certbot/conf:/etc/letsencrypt \
    -v ${RemoteDir}/certbot/www:/var/www/certbot \
    certbot/certbot certonly --webroot \
    --webroot-path=/var/www/certbot \
    --email ${SslEmail} \
    --agree-tos \
    --no-eff-email \
    -d ccms.${Domain} \
    -d api.ccms.${Domain}

# Stop temporary nginx
docker stop nginx-acme && docker rm nginx-acme

# Restart main application
docker compose -f docker-compose.production.yml up -d

echo 'SSL certificates installed!'
"@
    
    ssh "${RemoteUser}@${RemoteHost}" ($sslScript -replace "`r", "")
    Write-Info "SSL setup complete!"
}

# ===========================================
# VIEW LOGS
# ===========================================
function View-Logs {
    param($ServiceName)
    
    if ($ServiceName -eq "all") {
        ssh "${RemoteUser}@${RemoteHost}" "cd ${RemoteDir} && docker compose -f docker-compose.production.yml logs -f --tail=100"
    } else {
        ssh "${RemoteUser}@${RemoteHost}" "cd ${RemoteDir} && docker compose -f docker-compose.production.yml logs -f --tail=100 ${ServiceName}"
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
    
    ssh "${RemoteUser}@${RemoteHost}" ($statusScript -replace "`r", "")
}

# ===========================================
# RESTART SERVICES
# ===========================================
function Restart-Services {
    param($ServiceName)
    
    if ($ServiceName -eq "all") {
        ssh "${RemoteUser}@${RemoteHost}" "cd ${RemoteDir} && docker compose -f docker-compose.production.yml restart"
    } else {
        ssh "${RemoteUser}@${RemoteHost}" "cd ${RemoteDir} && docker compose -f docker-compose.production.yml restart ${ServiceName}"
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
  setup     - Initial server setup (Docker, firewall, etc.)
  deploy    - Deploy application to server
  ssl       - Setup SSL certificates with Let's Encrypt
  logs      - View container logs (optional: -Service name)
  status    - Check deployment status
  restart   - Restart services (optional: -Service name)
  help      - Show this help message

Environment variables (set before running):
  `$env:REMOTE_USER  - SSH user (default: root)
  `$env:REMOTE_HOST  - Hetzner server IP
  `$env:DOMAIN       - Your domain name
  `$env:SSL_EMAIL    - Email for Let's Encrypt

Examples:
  .\deploy-production.ps1 -Command setup
  .\deploy-production.ps1 -Command deploy
  .\deploy-production.ps1 -Command logs -Service backend
  
  # With environment variables:
  `$env:REMOTE_HOST = "123.45.67.89"
  `$env:DOMAIN = "pixelspot.in"
  .\deploy-production.ps1 -Command deploy

"@
}

# ===========================================
# MAIN
# ===========================================
switch ($Command) {
    "setup" { Setup-Server }
    "deploy" { Deploy-Application }
    "ssl" { Setup-SSL }
    "logs" { View-Logs -ServiceName $Service }
    "status" { Check-Status }
    "restart" { Restart-Services -ServiceName $Service }
    default { Show-Help }
}
