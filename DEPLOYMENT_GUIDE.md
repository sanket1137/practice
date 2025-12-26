# CCMS Application Deployment Guide

This guide covers deployment of the Content and Campaign Management System (CCMS) including:
- **Frontend**: React/Vite application
- **Backend**: ASP.NET Core 8.0 API
- **Player**: Python application running on Raspberry Pi

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Prerequisites](#prerequisites)
3. [Backend Deployment](#backend-deployment)
4. [Frontend Deployment](#frontend-deployment)
5. [Raspberry Pi Player Setup](#raspberry-pi-player-setup)
6. [Environment Configuration](#environment-configuration)
7. [SSL/HTTPS Setup](#sslhttps-setup)
8. [Troubleshooting](#troubleshooting)

---

## Architecture Overview

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Frontend      │     │    Backend      │     │   Database      │
│   (React/Vite)  │◄───►│  (ASP.NET API)  │◄───►│  (SQL Server)   │
│   CDN/Nginx     │     │  Azure/IIS/K8s  │     │  Azure SQL      │
└─────────────────┘     └────────┬────────┘     └─────────────────┘
                                 │
                                 │ SignalR + REST API
                                 │
                        ┌────────▼────────┐
                        │  Raspberry Pi   │
                        │    Players      │
                        │  (Python/VLC)   │
                        └─────────────────┘
```

---

## Prerequisites

### For Backend Server
- .NET 8.0 Runtime
- SQL Server 2019+ or Azure SQL
- Azure Blob Storage account (for media files)
- SSL certificate

### For Frontend Hosting
- Node.js 18+ (for building)
- Web server (Nginx, Apache, or CDN)
- SSL certificate

### For Raspberry Pi Player
- Raspberry Pi 4 (4GB+ RAM recommended)
- Raspberry Pi OS (64-bit recommended)
- Python 3.11+
- VLC media player
- Stable internet connection

---

## Backend Deployment

### Option 1: Azure App Service (Recommended)

#### 1. Create Azure Resources
```bash
# Login to Azure
az login

# Create resource group
az group create --name ccms-prod-rg --location eastus

# Create App Service Plan
az appservice plan create \
  --name ccms-plan \
  --resource-group ccms-prod-rg \
  --sku P1v2 \
  --is-linux

# Create Web App
az webapp create \
  --name ccms-api-prod \
  --resource-group ccms-prod-rg \
  --plan ccms-plan \
  --runtime "DOTNETCORE:8.0"
```

#### 2. Configure App Settings
```bash
az webapp config appsettings set \
  --name ccms-api-prod \
  --resource-group ccms-prod-rg \
  --settings \
    "ConnectionStrings__DefaultConnection=Server=tcp:your-server.database.windows.net,1433;Database=ccms;..." \
    "AzureStorage__ConnectionString=DefaultEndpointsProtocol=https;AccountName=..." \
    "AzureStorage__ContainerName=media" \
    "Jwt__Key=your-secure-jwt-key-minimum-32-characters" \
    "Jwt__Issuer=https://ccms-api-prod.azurewebsites.net" \
    "Jwt__Audience=https://ccms-api-prod.azurewebsites.net" \
    "AllowedOrigins__0=https://your-frontend-domain.com"
```

#### 3. Deploy via GitHub Actions
Create `.github/workflows/backend-deploy.yml`:
```yaml
name: Deploy Backend

on:
  push:
    branches: [main]
    paths:
      - 'backend/**'

jobs:
  build-and-deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup .NET
        uses: actions/setup-dotnet@v4
        with:
          dotnet-version: '8.0.x'

      - name: Build
        run: |
          cd backend/CCMS.Api
          dotnet restore
          dotnet build --configuration Release
          dotnet publish -c Release -o ./publish

      - name: Deploy to Azure
        uses: azure/webapps-deploy@v2
        with:
          app-name: ccms-api-prod
          publish-profile: ${{ secrets.AZURE_WEBAPP_PUBLISH_PROFILE }}
          package: backend/CCMS.Api/publish
```

### Option 2: Docker/Kubernetes

#### Dockerfile for Backend
Create `backend/CCMS.Api/Dockerfile`:
```dockerfile
FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS base
WORKDIR /app
EXPOSE 80
EXPOSE 443

FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src
COPY ["CCMS.Api/CCMS.Api.csproj", "CCMS.Api/"]
RUN dotnet restore "CCMS.Api/CCMS.Api.csproj"
COPY . .
WORKDIR "/src/CCMS.Api"
RUN dotnet build "CCMS.Api.csproj" -c Release -o /app/build

FROM build AS publish
RUN dotnet publish "CCMS.Api.csproj" -c Release -o /app/publish

FROM base AS final
WORKDIR /app
COPY --from=publish /app/publish .
ENTRYPOINT ["dotnet", "CCMS.Api.dll"]
```

#### Build and Push
```bash
# Build image
docker build -t your-registry.azurecr.io/ccms-api:latest -f backend/CCMS.Api/Dockerfile backend/

# Push to registry
docker push your-registry.azurecr.io/ccms-api:latest
```

#### Kubernetes Deployment
```yaml
# k8s/backend-deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: ccms-api
spec:
  replicas: 2
  selector:
    matchLabels:
      app: ccms-api
  template:
    metadata:
      labels:
        app: ccms-api
    spec:
      containers:
      - name: ccms-api
        image: your-registry.azurecr.io/ccms-api:latest
        ports:
        - containerPort: 80
        env:
        - name: ConnectionStrings__DefaultConnection
          valueFrom:
            secretKeyRef:
              name: ccms-secrets
              key: db-connection
        - name: AzureStorage__ConnectionString
          valueFrom:
            secretKeyRef:
              name: ccms-secrets
              key: storage-connection
---
apiVersion: v1
kind: Service
metadata:
  name: ccms-api-service
spec:
  selector:
    app: ccms-api
  ports:
  - port: 80
    targetPort: 80
  type: LoadBalancer
```

### Option 3: IIS on Windows Server

#### 1. Install Prerequisites
```powershell
# Install IIS
Install-WindowsFeature -Name Web-Server -IncludeManagementTools

# Install .NET Hosting Bundle
# Download from: https://dotnet.microsoft.com/download/dotnet/8.0
```

#### 2. Publish Application
```bash
cd backend/CCMS.Api
dotnet publish -c Release -o C:\inetpub\wwwroot\ccms-api
```

#### 3. Configure IIS
- Create new Application Pool (No Managed Code, Integrated Pipeline)
- Create new Website pointing to publish folder
- Configure bindings (HTTPS with SSL certificate)

#### 4. web.config
```xml
<?xml version="1.0" encoding="utf-8"?>
<configuration>
  <location path="." inheritInChildApplications="false">
    <system.webServer>
      <handlers>
        <add name="aspNetCore" path="*" verb="*" modules="AspNetCoreModuleV2" resourceType="Unspecified" />
      </handlers>
      <aspNetCore processPath="dotnet" arguments=".\CCMS.Api.dll" stdoutLogEnabled="true" stdoutLogFile=".\logs\stdout" hostingModel="inprocess">
        <environmentVariables>
          <environmentVariable name="ASPNETCORE_ENVIRONMENT" value="Production" />
        </environmentVariables>
      </aspNetCore>
    </system.webServer>
  </location>
</configuration>
```

---

## Frontend Deployment

### Build for Production

#### 1. Update Environment Variables
Create `frontend/.env.production`:
```env
VITE_API_URL=https://your-api-domain.com
VITE_WS_URL=wss://your-api-domain.com
```

#### 2. Build
```bash
cd frontend
npm install
npm run build
```

This creates a `dist/` folder with static files.

### Option 1: Azure Static Web Apps

```bash
# Install SWA CLI
npm install -g @azure/static-web-apps-cli

# Deploy
swa deploy ./dist --env production
```

Or via GitHub Actions:
```yaml
name: Deploy Frontend

on:
  push:
    branches: [main]
    paths:
      - 'frontend/**'

jobs:
  build-and-deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '18'

      - name: Build
        run: |
          cd frontend
          npm ci
          npm run build

      - name: Deploy to Azure Static Web Apps
        uses: Azure/static-web-apps-deploy@v1
        with:
          azure_static_web_apps_api_token: ${{ secrets.AZURE_STATIC_WEB_APPS_API_TOKEN }}
          action: "upload"
          app_location: "frontend"
          output_location: "dist"
```

### Option 2: Nginx

#### Install Nginx
```bash
sudo apt update
sudo apt install nginx
```

#### Configure Nginx
Create `/etc/nginx/sites-available/ccms`:
```nginx
server {
    listen 80;
    server_name your-frontend-domain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name your-frontend-domain.com;

    ssl_certificate /etc/letsencrypt/live/your-frontend-domain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/your-frontend-domain.com/privkey.pem;

    root /var/www/ccms/dist;
    index index.html;

    # Gzip compression
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml;

    # Cache static assets
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # SPA routing - serve index.html for all routes
    location / {
        try_files $uri $uri/ /index.html;
    }

    # API proxy (optional if backend on same server)
    location /api {
        proxy_pass https://your-api-domain.com;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    # WebSocket proxy for SignalR
    location /hubs {
        proxy_pass https://your-api-domain.com;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_read_timeout 86400;
    }
}
```

Enable site:
```bash
sudo ln -s /etc/nginx/sites-available/ccms /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

### Option 3: AWS CloudFront + S3

```bash
# Create S3 bucket
aws s3 mb s3://ccms-frontend-prod

# Sync build files
aws s3 sync ./dist s3://ccms-frontend-prod --delete

# Create CloudFront distribution (via console or CLI)
```

---

## Raspberry Pi Player Setup

### Initial Pi Setup

#### 1. Flash OS
- Download Raspberry Pi OS (64-bit) from https://www.raspberrypi.com/software/
- Flash to SD card using Raspberry Pi Imager
- Enable SSH and configure WiFi during imaging

#### 2. First Boot Setup
```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Set timezone
sudo timedatectl set-timezone Asia/Kolkata

# Enable auto-login (for kiosk mode)
sudo raspi-config
# Navigate to: System Options > Boot / Auto Login > Console Autologin
```

### Install Dependencies

```bash
# Install Python 3.11
sudo apt install -y python3.11 python3.11-venv python3.11-dev

# Install VLC
sudo apt install -y vlc vlc-plugin-base

# Install system dependencies for aiortc
sudo apt install -y \
    libavdevice-dev \
    libavfilter-dev \
    libopus-dev \
    libvpx-dev \
    pkg-config \
    libsrtp2-dev \
    libffi-dev \
    libssl-dev

# Install pip
curl -sS https://bootstrap.pypa.io/get-pip.py | python3.11
```

### Deploy Player Application

#### 1. Create Directory Structure
```bash
mkdir -p /home/pi/ccms-player
cd /home/pi/ccms-player
```

#### 2. Copy Player Files
Copy these files from the `player/` directory to `/home/pi/ccms-player/`:
- `ccms_player.py`
- `simple_webrtc_client.py`
- `vlc_manager.py`
- `http_stream_reg.py`
- `requirements.txt`

Or use SCP:
```bash
# From your development machine
scp -r player/* pi@<PI_IP_ADDRESS>:/home/pi/ccms-player/
```

#### 3. Create Virtual Environment
```bash
cd /home/pi/ccms-player
python3.11 -m venv venv
source venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt
```

#### 4. Create Configuration File
Create `/home/pi/ccms-player/config.json`:
```json
{
    "screen_id": "YOUR-SCREEN-UUID-HERE",
    "api_base_url": "https://your-api-domain.com",
    "api_key": "your-player-api-key",
    "media_cache_dir": "/home/pi/ccms-player/media_cache",
    "log_dir": "/home/pi/ccms-player/logs",
    "heartbeat_interval": 30,
    "sync_interval_minutes": 5,
    "vlc_display": ":0",
    "fullscreen": true,
    "rotation": 0
}
```

#### 5. Create Environment File
Create `/home/pi/ccms-player/.env`:
```env
CCMS_API_URL=https://your-api-domain.com
CCMS_SCREEN_ID=YOUR-SCREEN-UUID-HERE
CCMS_API_KEY=your-player-api-key
DISPLAY=:0
```

### Configure Auto-Start

#### Option 1: Systemd Service (Recommended)

Create `/etc/systemd/system/ccms-player.service`:
```ini
[Unit]
Description=CCMS Digital Signage Player
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=pi
Group=pi
WorkingDirectory=/home/pi/ccms-player
Environment=DISPLAY=:0
Environment=XAUTHORITY=/home/pi/.Xauthority
EnvironmentFile=/home/pi/ccms-player/.env
ExecStart=/home/pi/ccms-player/venv/bin/python ccms_player.py
Restart=always
RestartSec=10
StandardOutput=append:/home/pi/ccms-player/logs/player.log
StandardError=append:/home/pi/ccms-player/logs/player-error.log

[Install]
WantedBy=multi-user.target
```

Enable and start:
```bash
sudo systemctl daemon-reload
sudo systemctl enable ccms-player
sudo systemctl start ccms-player

# Check status
sudo systemctl status ccms-player

# View logs
journalctl -u ccms-player -f
```

#### Option 2: Cron @reboot

```bash
crontab -e
# Add this line:
@reboot sleep 30 && cd /home/pi/ccms-player && ./venv/bin/python ccms_player.py >> logs/player.log 2>&1 &
```

### Kiosk Mode Setup (Optional)

For a dedicated display that shows only the player:

#### 1. Install minimal desktop
```bash
sudo apt install -y --no-install-recommends xserver-xorg x11-xserver-utils xinit openbox
```

#### 2. Configure auto-start X
Create `/home/pi/.xinitrc`:
```bash
#!/bin/bash
xset -dpms
xset s off
xset s noblank

# Start player
cd /home/pi/ccms-player
./venv/bin/python ccms_player.py
```

#### 3. Auto-start X on login
Add to `/home/pi/.bashrc`:
```bash
if [ -z "$DISPLAY" ] && [ "$(tty)" = "/dev/tty1" ]; then
    startx
fi
```

### Disable Screen Blanking

```bash
# Add to /boot/config.txt
sudo nano /boot/config.txt
# Add: consoleblank=0

# Disable screen saver
sudo apt install -y xscreensaver
# Then run xscreensaver-command -deactivate in your startup script
```

### Network Configuration

#### Static IP (Recommended for Players)
Edit `/etc/dhcpcd.conf`:
```
interface eth0
static ip_address=192.168.1.100/24
static routers=192.168.1.1
static domain_name_servers=8.8.8.8 8.8.4.4
```

#### WiFi Configuration
Already configured via raspi-config or:
```bash
sudo nmcli dev wifi connect "SSID" password "password"
```

### Monitoring & Maintenance

#### Health Check Script
Create `/home/pi/ccms-player/health_check.sh`:
```bash
#!/bin/bash

# Check if player is running
if ! pgrep -f "ccms_player.py" > /dev/null; then
    echo "$(date): Player not running, restarting..." >> /home/pi/ccms-player/logs/health.log
    sudo systemctl restart ccms-player
fi

# Check disk space
DISK_USAGE=$(df /home/pi | tail -1 | awk '{print $5}' | sed 's/%//')
if [ "$DISK_USAGE" -gt 90 ]; then
    echo "$(date): Disk usage high ($DISK_USAGE%), cleaning cache..." >> /home/pi/ccms-player/logs/health.log
    find /home/pi/ccms-player/media_cache -type f -mtime +7 -delete
fi

# Check memory
FREE_MEM=$(free -m | awk '/^Mem:/{print $4}')
if [ "$FREE_MEM" -lt 100 ]; then
    echo "$(date): Low memory ($FREE_MEM MB), restarting..." >> /home/pi/ccms-player/logs/health.log
    sudo systemctl restart ccms-player
fi
```

Add to cron:
```bash
*/5 * * * * /home/pi/ccms-player/health_check.sh
```

#### Remote Access
```bash
# Enable SSH (already done)
sudo systemctl enable ssh

# Install remote desktop (optional)
sudo apt install -y realvnc-vnc-server
sudo systemctl enable vncserver-x11-serviced
```

---

## Environment Configuration

### Production Environment Variables

#### Backend (appsettings.Production.json)
```json
{
  "ConnectionStrings": {
    "DefaultConnection": "Server=tcp:your-server.database.windows.net,1433;Database=ccms;User ID=admin;Password=xxx;Encrypt=True;"
  },
  "AzureStorage": {
    "ConnectionString": "DefaultEndpointsProtocol=https;AccountName=ccmsstorage;AccountKey=xxx;EndpointSuffix=core.windows.net",
    "ContainerName": "media"
  },
  "Jwt": {
    "Key": "your-production-jwt-key-minimum-32-characters-long",
    "Issuer": "https://api.your-domain.com",
    "Audience": "https://api.your-domain.com",
    "ExpiryMinutes": 60
  },
  "AllowedOrigins": [
    "https://your-frontend-domain.com",
    "https://www.your-frontend-domain.com"
  ],
  "Logging": {
    "LogLevel": {
      "Default": "Warning",
      "Microsoft.AspNetCore": "Warning"
    }
  }
}
```

#### Frontend (.env.production)
```env
VITE_API_URL=https://api.your-domain.com
VITE_WS_URL=wss://api.your-domain.com
VITE_ENV=production
```

---

## SSL/HTTPS Setup

### Using Let's Encrypt (Recommended)

```bash
# Install certbot
sudo apt install -y certbot python3-certbot-nginx

# Get certificate
sudo certbot --nginx -d your-domain.com -d www.your-domain.com

# Auto-renewal (already configured)
sudo systemctl status certbot.timer
```

### Using Azure Managed Certificates
- Azure App Service: Enable managed certificate in Custom Domains
- Azure Static Web Apps: Automatic HTTPS

---

## Troubleshooting

### Backend Issues

#### Connection String Issues
```bash
# Test database connection
dotnet run --urls="http://localhost:5000" -- --test-db
```

#### SignalR WebSocket Issues
- Ensure WebSocket is enabled in Azure App Service
- Check CORS configuration includes WebSocket origins
- Verify nginx proxy_read_timeout for long-lived connections

### Frontend Issues

#### CORS Errors
- Verify AllowedOrigins in backend configuration
- Check browser console for specific CORS errors

#### Build Failures
```bash
# Clear cache and rebuild
rm -rf node_modules dist
npm ci
npm run build
```

### Player Issues

#### VLC Not Starting
```bash
# Check VLC installation
vlc --version

# Test VLC manually
cvlc --fullscreen test-video.mp4

# Check X display
echo $DISPLAY
xhost +local:
```

#### Network Issues
```bash
# Test API connectivity
curl -v https://your-api-domain.com/api/health

# Check DNS
nslookup your-api-domain.com

# Test WebSocket
websocat wss://your-api-domain.com/hubs/playback
```

#### Player Logs
```bash
# View service logs
journalctl -u ccms-player -f --no-pager

# View application logs
tail -f /home/pi/ccms-player/logs/player.log
```

### Common Fixes

```bash
# Restart player
sudo systemctl restart ccms-player

# Clear media cache
rm -rf /home/pi/ccms-player/media_cache/*

# Reboot Pi
sudo reboot

# Check system resources
htop
df -h
free -m
```

---

## Quick Reference

### URLs (Replace with your domains)

| Service | URL |
|---------|-----|
| Frontend | https://your-frontend-domain.com |
| API | https://api.your-domain.com |
| API Health | https://api.your-domain.com/api/health |
| SignalR Hub | wss://api.your-domain.com/hubs/playback |

### Default Ports

| Service | Port |
|---------|------|
| Backend (dev) | 5257 |
| Frontend (dev) | 5173 |
| Backend (prod) | 443 |
| Frontend (prod) | 443 |

### Useful Commands

```bash
# Backend
dotnet run                          # Run locally
dotnet publish -c Release           # Build for production

# Frontend  
npm run dev                         # Run locally
npm run build                       # Build for production

# Player
systemctl status ccms-player        # Check player status
journalctl -u ccms-player -f        # View player logs
```

---

## Support

For issues:
1. Check application logs
2. Verify network connectivity
3. Ensure all environment variables are set correctly
4. Check the troubleshooting section above

---

*Last Updated: December 26, 2025*
