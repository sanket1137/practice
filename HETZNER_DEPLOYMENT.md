# CCMS Hetzner Deployment Guide

Deploy Frontend + Backend on a single Hetzner VPS for testing.

---

## 1. Create Hetzner Server

### Server Specifications (Recommended for Testing)
- **Type**: CX21 or CX31 (2-4 vCPU, 4-8GB RAM)
- **OS**: Ubuntu 22.04 LTS
- **Location**: Choose nearest to your players
- **Cost**: ~€5-10/month

### Create Server via Hetzner Cloud Console
1. Go to https://console.hetzner.cloud
2. Create new project or select existing
3. Add Server → Select Ubuntu 22.04 → CX21
4. Add your SSH key
5. Create & wait for IP address

---

## 2. Initial Server Setup

### Connect to Server
```bash
ssh root@YOUR_SERVER_IP
```

### Update System & Install Dependencies
```bash
# Update system
apt update && apt upgrade -y

# Install essential tools
apt install -y curl wget git unzip nginx certbot python3-certbot-nginx

# Install .NET 8.0 Runtime
wget https://packages.microsoft.com/config/ubuntu/22.04/packages-microsoft-prod.deb -O packages-microsoft-prod.deb
dpkg -i packages-microsoft-prod.deb
rm packages-microsoft-prod.deb
apt update
apt install -y dotnet-sdk-8.0 aspnetcore-runtime-8.0

# Install Node.js 18
curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
apt install -y nodejs

# Install SQL Server (or use external database)
# For testing, we'll use SQLite instead - simpler setup
```

### Create Application User
```bash
# Create user for running the app
useradd -m -s /bin/bash ccms
usermod -aG sudo ccms

# Create directories
mkdir -p /var/www/ccms/backend
mkdir -p /var/www/ccms/frontend
mkdir -p /var/www/ccms/media
chown -R ccms:ccms /var/www/ccms
```

---

## 3. Setup Domain & SSL

### Point Domain to Server
Add DNS A records:
- `ccms.yourdomain.com` → YOUR_SERVER_IP
- `api.ccms.yourdomain.com` → YOUR_SERVER_IP

Or use a single domain with subpaths.

### Get SSL Certificate
```bash
# For separate subdomains
certbot --nginx -d ccms.yourdomain.com -d api.ccms.yourdomain.com

# Or for single domain (we'll use this approach)
certbot --nginx -d ccms.yourdomain.com
```

---

## 4. Deploy Backend

### Option A: Build on Server

```bash
# Switch to ccms user
su - ccms
cd /var/www/ccms

# Clone your repository (or upload files)
git clone https://github.com/yourusername/ccms.git repo
# Or use SCP to upload

# Build backend
cd /var/www/ccms/repo/backend/CCMS.Api
dotnet restore
dotnet publish -c Release -o /var/www/ccms/backend
```

### Option B: Build Locally & Upload

On your Windows machine:
```powershell
cd c:\Users\Sanket\Desktop\Me\Projects\Playground\PixelCCMSCopilot\practice\backend\CCMS.Api
dotnet publish -c Release -o ./publish

# Upload to server
scp -r ./publish/* root@YOUR_SERVER_IP:/var/www/ccms/backend/
```

### Configure Backend

Create `/var/www/ccms/backend/appsettings.Production.json`:
```bash
cat > /var/www/ccms/backend/appsettings.Production.json << 'EOF'
{
  "ConnectionStrings": {
    "DefaultConnection": "Data Source=/var/www/ccms/data/ccms.db"
  },
  "AzureStorage": {
    "UseLocalStorage": true,
    "LocalStoragePath": "/var/www/ccms/media"
  },
  "Jwt": {
    "Key": "YourSuperSecretKeyThatIsAtLeast32CharactersLong!",
    "Issuer": "https://ccms.yourdomain.com",
    "Audience": "https://ccms.yourdomain.com",
    "ExpiryMinutes": 1440
  },
  "AllowedOrigins": [
    "https://ccms.yourdomain.com",
    "http://localhost:5173"
  ],
  "Logging": {
    "LogLevel": {
      "Default": "Information",
      "Microsoft.AspNetCore": "Warning"
    }
  },
  "Kestrel": {
    "Endpoints": {
      "Http": {
        "Url": "http://localhost:5000"
      }
    }
  }
}
EOF
```

### Create Systemd Service

```bash
sudo cat > /etc/systemd/system/ccms-api.service << 'EOF'
[Unit]
Description=CCMS API
After=network.target

[Service]
Type=notify
User=ccms
Group=ccms
WorkingDirectory=/var/www/ccms/backend
ExecStart=/usr/bin/dotnet /var/www/ccms/backend/CCMS.Api.dll
Restart=always
RestartSec=10
Environment=ASPNETCORE_ENVIRONMENT=Production
Environment=DOTNET_PRINT_TELEMETRY_MESSAGE=false

[Install]
WantedBy=multi-user.target
EOF

# Enable and start
sudo systemctl daemon-reload
sudo systemctl enable ccms-api
sudo systemctl start ccms-api

# Check status
sudo systemctl status ccms-api
```

---

## 5. Deploy Frontend

### Build Frontend Locally

On your Windows machine, update the API URL first:

Create/update `frontend/.env.production`:
```env
VITE_API_URL=https://ccms.yourdomain.com/api
VITE_WS_URL=wss://ccms.yourdomain.com
```

Build:
```powershell
cd c:\Users\Sanket\Desktop\Me\Projects\Playground\PixelCCMSCopilot\practice\frontend
npm install
npm run build

# Upload to server
scp -r ./dist/* root@YOUR_SERVER_IP:/var/www/ccms/frontend/
```

### Set Permissions
```bash
chown -R ccms:ccms /var/www/ccms/frontend
```

---

## 6. Configure Nginx

Create `/etc/nginx/sites-available/ccms`:
```bash
cat > /etc/nginx/sites-available/ccms << 'EOF'
server {
    listen 80;
    server_name ccms.yourdomain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name ccms.yourdomain.com;

    # SSL certificates (managed by certbot)
    ssl_certificate /etc/letsencrypt/live/ccms.yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/ccms.yourdomain.com/privkey.pem;
    include /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;

    # Frontend - static files
    root /var/www/ccms/frontend;
    index index.html;

    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css text/xml text/javascript application/javascript application/json application/xml;

    # Frontend routes (SPA)
    location / {
        try_files $uri $uri/ /index.html;
    }

    # API proxy
    location /api/ {
        proxy_pass http://localhost:5000/api/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection keep-alive;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_buffering off;
    }

    # SignalR WebSocket hubs
    location /hubs/ {
        proxy_pass http://localhost:5000/hubs/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 86400;
        proxy_send_timeout 86400;
        proxy_buffering off;
    }

    # Media files (if using local storage)
    location /media/ {
        alias /var/www/ccms/media/;
        expires 7d;
        add_header Cache-Control "public, immutable";
    }

    # Static assets caching
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
EOF

# Enable site
ln -sf /etc/nginx/sites-available/ccms /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default

# Test and reload
nginx -t
systemctl reload nginx
```

---

## 7. Database Setup

### Using SQLite (Simplest for Testing)

The backend should auto-create the database. If you need to run migrations:
```bash
cd /var/www/ccms/backend
dotnet CCMS.Api.dll --migrate
# Or if using EF migrations
dotnet ef database update
```

### Using PostgreSQL (Better for Production)

```bash
# Install PostgreSQL
apt install -y postgresql postgresql-contrib

# Create database and user
sudo -u postgres psql << EOF
CREATE USER ccms WITH PASSWORD 'your_password';
CREATE DATABASE ccms_db OWNER ccms;
GRANT ALL PRIVILEGES ON DATABASE ccms_db TO ccms;
EOF
```

Update connection string in appsettings.Production.json:
```json
"ConnectionStrings": {
  "DefaultConnection": "Host=localhost;Database=ccms_db;Username=ccms;Password=your_password"
}
```

---

## 8. Firewall Setup

```bash
# Install UFW
apt install -y ufw

# Configure rules
ufw default deny incoming
ufw default allow outgoing
ufw allow ssh
ufw allow 80/tcp
ufw allow 443/tcp

# Enable firewall
ufw enable

# Check status
ufw status
```

---

## 9. Quick Deploy Script

Save this as `deploy.sh` on your local machine:

```bash
#!/bin/bash
SERVER="root@YOUR_SERVER_IP"
REMOTE_PATH="/var/www/ccms"

echo "Building backend..."
cd backend/CCMS.Api
dotnet publish -c Release -o ./publish

echo "Building frontend..."
cd ../../frontend
npm run build

echo "Uploading backend..."
rsync -avz --delete backend/CCMS.Api/publish/ $SERVER:$REMOTE_PATH/backend/

echo "Uploading frontend..."
rsync -avz --delete frontend/dist/ $SERVER:$REMOTE_PATH/frontend/

echo "Restarting services..."
ssh $SERVER "systemctl restart ccms-api && systemctl reload nginx"

echo "Done! Check https://ccms.yourdomain.com"
```

For Windows PowerShell, create `deploy.ps1`:
```powershell
$SERVER = "root@YOUR_SERVER_IP"
$REMOTE_PATH = "/var/www/ccms"

Write-Host "Building backend..."
Set-Location "c:\Users\Sanket\Desktop\Me\Projects\Playground\PixelCCMSCopilot\practice\backend\CCMS.Api"
dotnet publish -c Release -o ./publish

Write-Host "Building frontend..."
Set-Location "c:\Users\Sanket\Desktop\Me\Projects\Playground\PixelCCMSCopilot\practice\frontend"
npm run build

Write-Host "Uploading backend..."
scp -r "./publish/*" "${SERVER}:${REMOTE_PATH}/backend/"

Write-Host "Uploading frontend..."
scp -r "./dist/*" "${SERVER}:${REMOTE_PATH}/frontend/"

Write-Host "Restarting services..."
ssh $SERVER "systemctl restart ccms-api && systemctl reload nginx"

Write-Host "Done! Check https://ccms.yourdomain.com"
```

---

## 10. Update Player Configuration

Update your Raspberry Pi player's config to point to Hetzner:

```bash
# On Raspberry Pi, edit config
nano /home/pi/ccms-player/.env
```

```env
CCMS_API_URL=https://ccms.yourdomain.com
CCMS_SCREEN_ID=YOUR-SCREEN-UUID
CCMS_API_KEY=your-api-key
```

Restart player:
```bash
sudo systemctl restart ccms-player
```

---

## 11. Monitoring & Logs

### View Logs
```bash
# Backend logs
journalctl -u ccms-api -f

# Nginx access logs
tail -f /var/log/nginx/access.log

# Nginx error logs
tail -f /var/log/nginx/error.log
```

### Check Services
```bash
# Check backend
systemctl status ccms-api
curl http://localhost:5000/api/health

# Check nginx
systemctl status nginx

# Check disk space
df -h

# Check memory
free -m
```

---

## 12. Backup (Optional)

```bash
# Create backup script
cat > /home/ccms/backup.sh << 'EOF'
#!/bin/bash
BACKUP_DIR="/home/ccms/backups"
DATE=$(date +%Y%m%d_%H%M%S)

mkdir -p $BACKUP_DIR

# Backup database
cp /var/www/ccms/data/ccms.db $BACKUP_DIR/ccms_$DATE.db

# Backup media
tar -czf $BACKUP_DIR/media_$DATE.tar.gz /var/www/ccms/media

# Keep only last 7 days
find $BACKUP_DIR -type f -mtime +7 -delete
EOF

chmod +x /home/ccms/backup.sh

# Add to cron (daily at 2am)
echo "0 2 * * * /home/ccms/backup.sh" | crontab -u ccms -
```

---

## Quick Reference

| Item | Value |
|------|-------|
| Server IP | YOUR_SERVER_IP |
| Frontend URL | https://ccms.yourdomain.com |
| API URL | https://ccms.yourdomain.com/api |
| WebSocket URL | wss://ccms.yourdomain.com/hubs |
| SSH | `ssh root@YOUR_SERVER_IP` |
| Backend Service | `systemctl status ccms-api` |
| Logs | `journalctl -u ccms-api -f` |

---

## Troubleshooting

### Backend won't start
```bash
# Check logs
journalctl -u ccms-api -n 50

# Test manually
cd /var/www/ccms/backend
dotnet CCMS.Api.dll
```

### 502 Bad Gateway
```bash
# Check if backend is running
curl http://localhost:5000/api/health

# Check nginx config
nginx -t
```

### WebSocket not connecting
- Ensure nginx has WebSocket upgrade headers
- Check browser console for specific errors
- Verify firewall allows 443

### SSL Certificate Issues
```bash
# Renew certificate
certbot renew --dry-run

# Force renewal
certbot renew --force-renewal
```

---

*Last Updated: December 26, 2025*
