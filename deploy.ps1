# CCMS Deployment Script for Hetzner
# Run this from your local Windows machine
#
# Prerequisites:
#   1. SSH agent must be running with key loaded:
#        Start-Service ssh-agent
#        ssh-add $env:USERPROFILE\.ssh\ccms-hetzner
#   2. Run from the project root directory
#
# Usage:
#   .\deploy.ps1                    # Deploy both backend and frontend
#   .\deploy.ps1 -BackendOnly       # Deploy backend only
#   .\deploy.ps1 -FrontendOnly      # Deploy frontend only

param(
    [string]$ServerIP = "91.99.190.216",
    [string]$SSHKeyPath = "$env:USERPROFILE\.ssh\ccms-hetzner",
    [string]$RemoteUser = "root",
    [string]$RemotePath = "/opt/ccms",
    [switch]$BackendOnly,
    [switch]$FrontendOnly
)

$ErrorActionPreference = "Stop"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  CCMS Deployment to Hetzner Server" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Determine what to deploy
$deployBackend = -not $FrontendOnly
$deployFrontend = -not $BackendOnly

# Verify SSH agent connectivity (fail fast if key isn't loaded)
Write-Host "Step 0: Verifying SSH connectivity..." -ForegroundColor Yellow
try {
    $sshTest = ssh -i $SSHKeyPath -o BatchMode=yes -o ConnectTimeout=10 "$RemoteUser@$ServerIP" "echo OK" 2>&1
    if ($sshTest -ne "OK") {
        Write-Host "ERROR: SSH connection failed. Ensure ssh-agent is running and key is loaded:" -ForegroundColor Red
        Write-Host "  Start-Service ssh-agent" -ForegroundColor Gray
        Write-Host "  ssh-add $SSHKeyPath" -ForegroundColor Gray
        exit 1
    }
    Write-Host "  SSH connection verified" -ForegroundColor Green
} catch {
    Write-Host "ERROR: SSH connection failed: $_" -ForegroundColor Red
    Write-Host "  Ensure ssh-agent is running with: Start-Service ssh-agent" -ForegroundColor Gray
    Write-Host "  Then add key with: ssh-add $SSHKeyPath" -ForegroundColor Gray
    exit 1
}

# Step 1: Create tar archives of source code (excludes build artifacts)
Write-Host "Step 1: Packaging source code..." -ForegroundColor Yellow

$tempFiles = @()

if ($deployBackend) {
    Write-Host "  Creating backend archive (excluding bin/obj/publish/uploads/wwwroot)..." -ForegroundColor Gray
    tar -cf backend-src.tar --exclude="bin" --exclude="obj" --exclude="publish" --exclude="uploads" --exclude="wwwroot" --exclude=".vs" --exclude="*.user" --exclude="TempClean" --exclude="TempDbCreate" backend
    $backendSize = [math]::Round((Get-Item backend-src.tar).Length / 1MB, 2)
    Write-Host "  Backend archive: $backendSize MB" -ForegroundColor Gray
    $tempFiles += "backend-src.tar"
}

if ($deployFrontend) {
    Write-Host "  Creating frontend archive (excluding node_modules/dist)..." -ForegroundColor Gray
    tar -cf frontend-src.tar --exclude="node_modules" --exclude="dist" --exclude=".vscode" frontend
    $frontendSize = [math]::Round((Get-Item frontend-src.tar).Length / 1MB, 2)
    Write-Host "  Frontend archive: $frontendSize MB" -ForegroundColor Gray
    $tempFiles += "frontend-src.tar"
}

# Step 2: Clean remote directories and transfer
Write-Host "Step 2: Preparing remote server..." -ForegroundColor Yellow

$cleanDirs = @()
if ($deployBackend) { $cleanDirs += "/opt/ccms/backend" }
if ($deployFrontend) { $cleanDirs += "/opt/ccms/frontend" }
$cleanCmd = "rm -rf $($cleanDirs -join ' ') && mkdir -p /opt/ccms"
ssh -i $SSHKeyPath "$RemoteUser@$ServerIP" $cleanCmd
Write-Host "  Remote directories cleaned" -ForegroundColor Gray

# Step 3: Transfer archives and config files in a single SCP call
Write-Host "Step 3: Transferring files to server..." -ForegroundColor Yellow

$filesToTransfer = @("docker-compose.yml", ".dockerignore")
if (Test-Path ".env.example") { $filesToTransfer += ".env.example" }
$filesToTransfer += $tempFiles

scp -i $SSHKeyPath $filesToTransfer "$RemoteUser@${ServerIP}:$RemotePath/"
Write-Host "  Files transferred" -ForegroundColor Green

# Step 4: Copy nginx separately (small, always needed)
Write-Host "Step 4: Copying nginx configuration..." -ForegroundColor Yellow
ssh -i $SSHKeyPath "$RemoteUser@$ServerIP" "rm -rf /opt/ccms/nginx && mkdir -p /opt/ccms/nginx"
scp -i $SSHKeyPath -r nginx "$RemoteUser@${ServerIP}:$RemotePath/"
Write-Host "  Nginx config copied" -ForegroundColor Green

# Step 5: Extract archives on server
Write-Host "Step 5: Extracting source code on server..." -ForegroundColor Yellow
$extractCmds = "cd /opt/ccms"
if ($deployBackend) { $extractCmds += " && tar -xf backend-src.tar && rm -f backend-src.tar" }
if ($deployFrontend) { $extractCmds += " && tar -xf frontend-src.tar && rm -f frontend-src.tar" }
$extractCmds += " && echo 'Extracted'"
ssh -i $SSHKeyPath "$RemoteUser@$ServerIP" $extractCmds
Write-Host "  Source code extracted" -ForegroundColor Green

# Step 6: Create .env if needed
Write-Host "Step 6: Ensuring .env file exists..." -ForegroundColor Yellow
ssh -i $SSHKeyPath "$RemoteUser@$ServerIP" "cd $RemotePath && if [ ! -f .env ]; then cp .env.example .env && echo 'Created .env - update with production values'; else echo '.env exists'; fi"

# Step 7: Build and deploy containers
Write-Host "Step 7: Building and starting containers..." -ForegroundColor Yellow

$buildTargets = @()
if ($deployBackend) { $buildTargets += "backend" }
if ($deployFrontend) { $buildTargets += "frontend" }
$buildCmd = "cd /opt/ccms && docker compose build --no-cache $($buildTargets -join ' ') && docker compose up -d"

ssh -i $SSHKeyPath "$RemoteUser@$ServerIP" $buildCmd

# Step 8: Wait for health checks and verify
Write-Host "Step 8: Waiting for health checks..." -ForegroundColor Yellow
Start-Sleep -Seconds 15

$status = ssh -i $SSHKeyPath "$RemoteUser@$ServerIP" "docker ps --format '{{.Names}}: {{.Status}}' && echo '---' && curl -sf http://localhost:5000/api/health 2>/dev/null || echo 'Health check pending...'"
Write-Host $status -ForegroundColor Cyan

# Cleanup local temp files
foreach ($f in $tempFiles) {
    Remove-Item $f -Force -ErrorAction SilentlyContinue
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "  Deployment Complete!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "Useful commands:" -ForegroundColor Yellow
Write-Host "  SSH:     ssh -i $SSHKeyPath $RemoteUser@$ServerIP"
Write-Host "  Logs:    ssh -i $SSHKeyPath $RemoteUser@$ServerIP 'docker compose -f /opt/ccms/docker-compose.yml logs -f'"
Write-Host "  Status:  ssh -i $SSHKeyPath $RemoteUser@$ServerIP 'docker ps'"
Write-Host ""
Write-Host "Production: https://ccms.pixelspot.in" -ForegroundColor Cyan
