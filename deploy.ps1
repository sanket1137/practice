# CCMS Deployment Script for Hetzner
# Run this from your local Windows machine

param(
    [string]$ServerIP = "91.99.190.216",
    [string]$SSHKeyPath = "$env:USERPROFILE\.ssh\ccms-hetzner",
    [string]$RemoteUser = "root",
    [string]$RemotePath = "/opt/ccms"
)

$ErrorActionPreference = "Stop"
$SSH = "C:\Windows\System32\OpenSSH\ssh.exe"
$SCP = "C:\Windows\System32\OpenSSH\scp.exe"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  CCMS Deployment to Hetzner Server" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Files to deploy
$filesToDeploy = @(
    "docker-compose.yml",
    ".env.example",
    ".dockerignore"
)

$foldersToDeply = @(
    "backend",
    "frontend", 
    "nginx"
)

Write-Host "Step 1: Creating remote directory structure..." -ForegroundColor Yellow
& $SSH -i $SSHKeyPath "$RemoteUser@$ServerIP" "mkdir -p $RemotePath/backend $RemotePath/frontend $RemotePath/nginx/conf.d"

Write-Host "Step 2: Copying configuration files..." -ForegroundColor Yellow
foreach ($file in $filesToDeploy) {
    if (Test-Path $file) {
        Write-Host "  Copying $file..." -ForegroundColor Gray
        & $SCP -i $SSHKeyPath $file "$RemoteUser@${ServerIP}:$RemotePath/"
    }
}

Write-Host "Step 3: Copying nginx configuration..." -ForegroundColor Yellow
& $SCP -i $SSHKeyPath -r "nginx\*" "$RemoteUser@${ServerIP}:$RemotePath/nginx/"

Write-Host "Step 4: Copying backend source..." -ForegroundColor Yellow
& $SCP -i $SSHKeyPath -r "backend\*" "$RemoteUser@${ServerIP}:$RemotePath/backend/"

Write-Host "Step 5: Copying frontend source..." -ForegroundColor Yellow
# Exclude node_modules
$frontendFiles = Get-ChildItem -Path "frontend" -Exclude "node_modules", "dist"
foreach ($item in $frontendFiles) {
    & $SCP -i $SSHKeyPath -r $item.FullName "$RemoteUser@${ServerIP}:$RemotePath/frontend/"
}

Write-Host "Step 6: Creating .env file on server..." -ForegroundColor Yellow
& $SSH -i $SSHKeyPath "$RemoteUser@$ServerIP" @"
cd $RemotePath
if [ ! -f .env ]; then
    cp .env.example .env
    echo 'Created .env file - please update with production values'
fi
"@

Write-Host "Step 7: Building and starting containers..." -ForegroundColor Yellow
& $SSH -i $SSHKeyPath "$RemoteUser@$ServerIP" @"
cd $RemotePath
docker compose build --no-cache
docker compose up -d
"@

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "  Deployment Complete!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "1. SSH into server: & '$SSH' -i '$SSHKeyPath' $RemoteUser@$ServerIP"
Write-Host "2. Update .env file: nano $RemotePath/.env"
Write-Host "3. Restart if needed: docker compose restart"
Write-Host "4. View logs: docker compose logs -f"
Write-Host ""
Write-Host "Application will be available at: http://$ServerIP" -ForegroundColor Cyan
