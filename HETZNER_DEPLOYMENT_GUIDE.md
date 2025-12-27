# CCMS Hetzner Deployment Guide

This guide provides step-by-step instructions to deploy the CCMS (Content and Campaign Management System) application on Hetzner Cloud infrastructure.

## 📋 Table of Contents

1. [Application Overview](#application-overview)
2. [Hetzner Server Selection](#hetzner-server-selection)
3. [Initial Server Setup](#initial-server-setup)
4. [Database Setup](#database-setup)
5. [Backend Deployment](#backend-deployment)
6. [Frontend Deployment](#frontend-deployment)
7. [Reverse Proxy Configuration](#reverse-proxy-configuration)
8. [SSL/TLS Setup](#ssltls-setup)
9. [Environment Configuration](#environment-configuration)
10. [Monitoring & Maintenance](#monitoring--maintenance)

---

## 📦 Application Overview

**CCMS consists of:**
- **Backend**: ASP.NET Core 8.0 Web API with SignalR for real-time communication
- **Frontend**: React + TypeScript + Vite (static SPA)
- **Database**: SQL Server (or PostgreSQL)
- **File Storage**: Local storage (can be configured for Azure Blob or S3)
- **Player**: Python scripts for Raspberry Pi (deployed separately)

---

## 🖥️ Hetzner Server Selection

### Option 1: Single Server (Small to Medium Scale)
**Recommended for development/staging or small production:**

| Component | Hetzner Server | Specs | Monthly Cost |
|-----------|---------------|-------|--------------|
| All-in-One | **CX32** | 4 vCPU, 8 GB RAM, 80 GB NVMe | ~€7.19/month |
| All-in-One (Better) | **CX42** | 8 vCPU, 16 GB RAM, 160 GB NVMe | ~€14.39/month |

### Option 2: Multi-Server (Production Scale)
**Recommended for production with high traffic:**

| Component | Hetzner Server | Specs | Monthly Cost |
|-----------|---------------|-------|--------------|
| Application Server | **CX32** | 4 vCPU, 8 GB RAM | ~€7.19/month |
| Database Server | **CX42** | 8 vCPU, 16 GB RAM | ~€14.39/month |
| File Storage | **Volume** | 100 GB - 500 GB | ~€4.80 - €24/month |

### Recommended Configuration for CCMS

For a **production-ready setup**, I recommend:

```
Server Type: CX42 (CPX41 for ARM)
Location: Falkenstein (fsn1) or Nuremberg (nbg1) - Europe
          Ashburn (ash) - US East
OS: Ubuntu 22.04 LTS
```

### Steps to Create Server on Hetzner Cloud

1. **Go to** [Hetzner Cloud Console](https://console.hetzner.cloud/)
2. **Create a new project** (e.g., "CCMS-Production")
3. **Add a server:**
   - Click "Add Server"
   - **Location**: Choose nearest to your users
   - **Image**: Ubuntu 22.04
   - **Type**: CX32 or CX42 (Shared vCPU) or CPX31/CPX41 (AMD)
   - **Networking**: 
     - ✅ Public IPv4
     - ✅ Public IPv6
   - **SSH Key**: Add your SSH public key (recommended)
   - **Cloud config**: Leave empty for now
   - **Name**: `ccms-server-1`

---

## 🔧 Initial Server Setup

### Step 1: Connect to Server

```bash
ssh root@YOUR_SERVER_IP
```

### Step 2: Update System & Install Dependencies

```bash
# Update system packages
apt update && apt upgrade -y

# Install essential tools
apt install -y curl wget git unzip software-properties-common

# Install .NET 8.0 SDK
wget https://packages.microsoft.com/config/ubuntu/22.04/packages-microsoft-prod.deb -O packages-microsoft-prod.deb
dpkg -i packages-microsoft-prod.deb
rm packages-microsoft-prod.deb
apt update
apt install -y dotnet-sdk-8.0

# Verify .NET installation
dotnet --version

# Install Node.js 20 LTS (for building frontend)
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs

# Verify Node.js installation
node --version
npm --version

# Install Nginx (reverse proxy)
apt install -y nginx

# Install Certbot (SSL certificates)
apt install -y certbot python3-certbot-nginx
```

### Step 3: Create Application User

```bash
# Create a non-root user for running the application
useradd -m -s /bin/bash ccms
usermod -aG sudo ccms

# Create application directories
mkdir -p /var/www/ccms/backend
mkdir -p /var/www/ccms/frontend
mkdir -p /var/www/ccms/uploads
mkdir -p /var/www/ccms/logs

# Set ownership
chown -R ccms:ccms /var/www/ccms
```

### Step 4: Configure Firewall

```bash
# Install and configure UFW
apt install -y ufw

# Allow SSH
ufw allow 22/tcp

# Allow HTTP and HTTPS
ufw allow 80/tcp
ufw allow 443/tcp

# Allow custom ports if needed (optional)
# ufw allow 5000/tcp  # Direct API access (not recommended in production)

# Enable firewall
ufw enable

# Check status
ufw status verbose
```

---

## 🗄️ Database Setup

### Option A: SQL Server on Linux (Docker)

```bash
# Install Docker
apt install -y docker.io docker-compose
systemctl start docker
systemctl enable docker

# Add ccms user to docker group
usermod -aG docker ccms

# Create SQL Server container
docker run -e "ACCEPT_EULA=Y" \
  -e "MSSQL_SA_PASSWORD=YourStrong!Passw0rd" \
  -p 1433:1433 \
  --name ccms-sqlserver \
  --restart always \
  -v sqlserver-data:/var/opt/mssql \
  -d mcr.microsoft.com/mssql/server:2022-latest

# Verify SQL Server is running
docker ps

# Wait for SQL Server to start (30-60 seconds)
sleep 30

# Create the database
docker exec -it ccms-sqlserver /opt/mssql-tools18/bin/sqlcmd \
  -S localhost -U SA -P "YourStrong!Passw0rd" -C \
  -Q "CREATE DATABASE PracticePixelCCMSDb"
```

### Option B: PostgreSQL (Recommended Alternative)

```bash
# Install PostgreSQL
apt install -y postgresql postgresql-contrib

# Start and enable PostgreSQL
systemctl start postgresql
systemctl enable postgresql

# Create database and user
sudo -u postgres psql << EOF
CREATE USER ccms_user WITH PASSWORD 'YourSecurePassword123!';
CREATE DATABASE ccms_db OWNER ccms_user;
GRANT ALL PRIVILEGES ON DATABASE ccms_db TO ccms_user;
EOF
```

**Note**: If using PostgreSQL, you'll need to update the backend to use Npgsql provider instead of SQL Server.

### Option C: Hetzner Managed Database (Easiest)

1. Go to Hetzner Cloud Console
2. Click "Managed Databases" → "Create Database"
3. Select **PostgreSQL** or **MySQL**
4. Choose server type (CPX11 for small, CPX21 for production)
5. Set database name: `ccms_db`
6. Note the connection string provided

---

## ⚙️ Backend Deployment

### Step 1: Prepare Backend on Your Local Machine

```powershell
# On your Windows machine, navigate to the backend directory
cd c:\Users\Sanket\Desktop\Me\Projects\Playground\PixelCCMSCopilot\practice\backend\CCMS.Api

# Build for Linux deployment
dotnet publish -c Release -r linux-x64 --self-contained false -o ./publish

# Or for self-contained deployment (includes .NET runtime)
dotnet publish -c Release -r linux-x64 --self-contained true -o ./publish-selfcontained
```

### Step 2: Upload Backend to Server

```powershell
# From your Windows machine, use SCP to upload
scp -r ./publish/* root@YOUR_SERVER_IP:/var/www/ccms/backend/

# Or use FileZilla/WinSCP for GUI-based transfer
```

### Step 3: Configure Backend on Server

```bash
# SSH into server
ssh root@YOUR_SERVER_IP

# Navigate to backend directory
cd /var/www/ccms/backend

# Create production appsettings
cat > appsettings.Production.json << 'EOF'
{
  "TimeZone": {
    "Id": "Asia/Kolkata",
    "DisplayName": "India Standard Time"
  },
  "Logging": {
    "LogLevel": {
      "Default": "Information",
      "Microsoft.AspNetCore": "Warning"
    }
  },
  "AllowedHosts": "*",
  "ConnectionStrings": {
    "DefaultConnection": "Server=localhost;Database=PracticePixelCCMSDb;User Id=SA;Password=YourStrong!Passw0rd;TrustServerCertificate=true"
  },
  "Jwt": {
    "SecretKey": "your-super-secret-production-key-minimum-32-characters-long-change-this!",
    "Issuer": "PixelCCMS",
    "Audience": "PixelCCMSUsers",
    "ExpiryMinutes": 60
  },
  "Cors": {
    "AllowedOrigins": [
      "https://yourdomain.com",
      "https://www.yourdomain.com"
    ]
  },
  "FileStorage": {
    "Provider": "Local",
    "LocalPath": "/var/www/ccms/uploads",
    "BaseUrl": "https://yourdomain.com/uploads",
    "MaxFileSizeInMB": 100
  },
  "WebRTC": {
    "StunServers": [
      "stun:stun.l.google.com:19302",
      "stun:stun1.l.google.com:19302"
    ],
    "TurnServers": [],
    "MaxViewersPerStream": 10,
    "StreamTimeoutSeconds": 300
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

# Set permissions
chown -R ccms:ccms /var/www/ccms/backend
chmod +x /var/www/ccms/backend/CCMS.Api
```

### Step 4: Create Systemd Service for Backend

```bash
cat > /etc/systemd/system/ccms-backend.service << 'EOF'
[Unit]
Description=CCMS Backend API
After=network.target

[Service]
WorkingDirectory=/var/www/ccms/backend
ExecStart=/usr/bin/dotnet /var/www/ccms/backend/CCMS.Api.dll
Restart=always
RestartSec=10
KillSignal=SIGINT
SyslogIdentifier=ccms-backend
User=ccms
Environment=ASPNETCORE_ENVIRONMENT=Production
Environment=DOTNET_PRINT_TELEMETRY_MESSAGE=false

[Install]
WantedBy=multi-user.target
EOF

# Reload systemd and start service
systemctl daemon-reload
systemctl enable ccms-backend
systemctl start ccms-backend

# Check status
systemctl status ccms-backend

# View logs
journalctl -u ccms-backend -f
```

### Step 5: Run Database Migrations

```bash
# If you have migrations pending, run them
cd /var/www/ccms/backend
dotnet CCMS.Api.dll --migrate
# Or manually apply via SQL scripts
```

---

## 🌐 Frontend Deployment

### Step 1: Build Frontend Locally

```powershell
# On your Windows machine
cd c:\Users\Sanket\Desktop\Me\Projects\Playground\PixelCCMSCopilot\practice\frontend

# Create production environment file
@"
VITE_API_URL=https://yourdomain.com/api
VITE_SIGNALR_URL=https://yourdomain.com
"@ | Out-File -FilePath .env.production -Encoding UTF8

# Install dependencies and build
npm install
npm run build

# The built files will be in the 'dist' folder
```

### Step 2: Upload Frontend to Server

```powershell
# From your Windows machine
scp -r ./dist/* root@YOUR_SERVER_IP:/var/www/ccms/frontend/
```

### Step 3: Set Permissions on Server

```bash
ssh root@YOUR_SERVER_IP
chown -R ccms:ccms /var/www/ccms/frontend
```

---

## 🔀 Reverse Proxy Configuration (Nginx)

### Create Nginx Configuration

```bash
cat > /etc/nginx/sites-available/ccms << 'EOF'
# Upstream for backend API
upstream ccms_backend {
    server 127.0.0.1:5000;
    keepalive 32;
}

server {
    listen 80;
    listen [::]:80;
    server_name yourdomain.com www.yourdomain.com;

    # Redirect HTTP to HTTPS (uncomment after SSL setup)
    # return 301 https://$server_name$request_uri;

    # Frontend static files
    root /var/www/ccms/frontend;
    index index.html;

    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css text/xml text/javascript application/javascript application/json application/xml;

    # Frontend SPA routing
    location / {
        try_files $uri $uri/ /index.html;
        
        # Cache static assets
        location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2)$ {
            expires 1y;
            add_header Cache-Control "public, immutable";
        }
    }

    # Backend API proxy
    location /api {
        proxy_pass http://ccms_backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        
        # Timeout settings
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }

    # SignalR WebSocket support
    location /hubs {
        proxy_pass http://ccms_backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        
        # WebSocket timeout (long-lived connections)
        proxy_read_timeout 3600s;
        proxy_send_timeout 3600s;
    }

    # Uploaded files
    location /uploads {
        alias /var/www/ccms/uploads;
        expires 30d;
        add_header Cache-Control "public";
        
        # Security headers
        add_header X-Content-Type-Options nosniff;
    }

    # Health check endpoint
    location /health {
        proxy_pass http://ccms_backend/api/health;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
    }

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;

    # File upload size limit (match your backend config)
    client_max_body_size 100M;

    # Logging
    access_log /var/log/nginx/ccms_access.log;
    error_log /var/log/nginx/ccms_error.log;
}
EOF

# Enable the site
ln -sf /etc/nginx/sites-available/ccms /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default

# Test Nginx configuration
nginx -t

# Reload Nginx
systemctl reload nginx
```

---

## 🔒 SSL/TLS Setup (Let's Encrypt)

### Step 1: Point Your Domain to Server

1. Go to your domain registrar (Cloudflare, Namecheap, etc.)
2. Create an **A Record** pointing to your server's IPv4 address:
   - Host: `@` (or leave empty)
   - Value: `YOUR_SERVER_IP`
   - TTL: Auto or 300
3. Optionally create a **CNAME** for www:
   - Host: `www`
   - Value: `yourdomain.com`

### Step 2: Obtain SSL Certificate

```bash
# Run Certbot to obtain and install SSL certificate
certbot --nginx -d yourdomain.com -d www.yourdomain.com

# Follow the prompts:
# - Enter your email address
# - Agree to terms
# - Choose whether to redirect HTTP to HTTPS (recommended: Yes)

# Certbot will automatically:
# - Obtain certificate from Let's Encrypt
# - Configure Nginx to use SSL
# - Set up auto-renewal
```

### Step 3: Verify Auto-Renewal

```bash
# Test renewal (dry run)
certbot renew --dry-run

# Certificates auto-renew via systemd timer
systemctl status certbot.timer
```

### Updated Nginx Config (After SSL)

After Certbot runs, your config will be updated. Verify the HTTPS server block:

```bash
cat /etc/nginx/sites-available/ccms
```

---

## ⚙️ Environment Configuration

### Backend Production Secrets

For production, use environment variables or a secrets manager:

```bash
# Edit the service file to add secrets
sudo systemctl edit ccms-backend

# Add environment variables
[Service]
Environment="ConnectionStrings__DefaultConnection=Server=localhost;Database=PracticePixelCCMSDb;User Id=SA;Password=YourStrong!Passw0rd;TrustServerCertificate=true"
Environment="Jwt__SecretKey=your-production-jwt-secret-key-minimum-32-chars"
```

### Recommended Environment Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `ASPNETCORE_ENVIRONMENT` | Application environment | `Production` |
| `ConnectionStrings__DefaultConnection` | Database connection | `Server=...` |
| `Jwt__SecretKey` | JWT signing key (32+ chars) | `generate-secure-key` |
| `Cors__AllowedOrigins__0` | Allowed CORS origin | `https://yourdomain.com` |
| `FileStorage__BaseUrl` | Public URL for uploads | `https://yourdomain.com/uploads` |

---

## 📊 Monitoring & Maintenance

### Log Monitoring

```bash
# View backend logs
journalctl -u ccms-backend -f

# View Nginx access logs
tail -f /var/log/nginx/ccms_access.log

# View Nginx error logs
tail -f /var/log/nginx/ccms_error.log
```

### Install Monitoring Tools (Optional)

```bash
# Install htop for system monitoring
apt install -y htop

# Install Netdata for web-based monitoring
bash <(curl -Ss https://get.netdata.cloud/kickstart.sh)
# Access at http://YOUR_SERVER_IP:19999
```

### Backup Strategy

```bash
# Create backup script
cat > /var/www/ccms/backup.sh << 'EOF'
#!/bin/bash
BACKUP_DIR="/var/www/ccms/backups"
DATE=$(date +%Y%m%d_%H%M%S)

mkdir -p $BACKUP_DIR

# Backup database (SQL Server Docker)
docker exec ccms-sqlserver /opt/mssql-tools18/bin/sqlcmd -S localhost -U SA -P "YourStrong!Passw0rd" -C -Q "BACKUP DATABASE PracticePixelCCMSDb TO DISK='/var/opt/mssql/backup_$DATE.bak'"
docker cp ccms-sqlserver:/var/opt/mssql/backup_$DATE.bak $BACKUP_DIR/

# Backup uploads
tar -czf $BACKUP_DIR/uploads_$DATE.tar.gz /var/www/ccms/uploads

# Clean old backups (keep last 7 days)
find $BACKUP_DIR -type f -mtime +7 -delete

echo "Backup completed: $DATE"
EOF

chmod +x /var/www/ccms/backup.sh

# Add to crontab (daily at 2 AM)
(crontab -l 2>/dev/null; echo "0 2 * * * /var/www/ccms/backup.sh >> /var/log/ccms-backup.log 2>&1") | crontab -
```

### Health Check

```bash
# Check all services
systemctl status ccms-backend nginx docker

# Check backend health endpoint
curl http://localhost:5000/api/health

# Check frontend
curl -I https://yourdomain.com
```

---

## 🔄 Deployment Updates

### Update Backend

```bash
# On your local machine, build and upload
dotnet publish -c Release -r linux-x64 --self-contained false -o ./publish
scp -r ./publish/* root@YOUR_SERVER_IP:/var/www/ccms/backend/

# On server, restart service
ssh root@YOUR_SERVER_IP "systemctl restart ccms-backend"
```

### Update Frontend

```bash
# On your local machine, build and upload
npm run build
scp -r ./dist/* root@YOUR_SERVER_IP:/var/www/ccms/frontend/

# Clear Nginx cache (if any)
ssh root@YOUR_SERVER_IP "systemctl reload nginx"
```

### Automated Deployment (CI/CD)

Consider using GitHub Actions for automated deployments. Create `.github/workflows/deploy.yml`:

```yaml
name: Deploy to Hetzner

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup .NET
        uses: actions/setup-dotnet@v4
        with:
          dotnet-version: '8.0.x'
          
      - name: Build Backend
        run: |
          cd backend/CCMS.Api
          dotnet publish -c Release -r linux-x64 --self-contained false -o ./publish
          
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          
      - name: Build Frontend
        run: |
          cd frontend
          npm ci
          npm run build
          
      - name: Deploy to Server
        uses: appleboy/scp-action@v0.1.4
        with:
          host: ${{ secrets.SERVER_HOST }}
          username: ${{ secrets.SERVER_USER }}
          key: ${{ secrets.SSH_PRIVATE_KEY }}
          source: "backend/CCMS.Api/publish/*,frontend/dist/*"
          target: "/var/www/ccms/"
          
      - name: Restart Services
        uses: appleboy/ssh-action@v1.0.0
        with:
          host: ${{ secrets.SERVER_HOST }}
          username: ${{ secrets.SERVER_USER }}
          key: ${{ secrets.SSH_PRIVATE_KEY }}
          script: |
            systemctl restart ccms-backend
            systemctl reload nginx
```

---

## 📋 Quick Reference Commands

```bash
# Start/Stop/Restart Backend
systemctl start ccms-backend
systemctl stop ccms-backend
systemctl restart ccms-backend

# View Backend Logs
journalctl -u ccms-backend -f
journalctl -u ccms-backend --since "1 hour ago"

# Nginx Commands
systemctl reload nginx
nginx -t  # Test configuration

# Database (Docker SQL Server)
docker start ccms-sqlserver
docker stop ccms-sqlserver
docker logs ccms-sqlserver

# SSL Certificate Renewal
certbot renew
certbot certificates  # View certificate status

# Check Disk Space
df -h

# Check Memory
free -h

# Check Running Processes
htop
```

---

## 🛠️ Troubleshooting

### Backend Not Starting

```bash
# Check logs
journalctl -u ccms-backend -n 100

# Check if port is in use
ss -tlnp | grep 5000

# Test backend directly
cd /var/www/ccms/backend
dotnet CCMS.Api.dll
```

### Database Connection Issues

```bash
# Check if SQL Server container is running
docker ps

# Check SQL Server logs
docker logs ccms-sqlserver

# Test connection
docker exec -it ccms-sqlserver /opt/mssql-tools18/bin/sqlcmd -S localhost -U SA -P "YourStrong!Passw0rd" -C -Q "SELECT 1"
```

### Nginx 502 Bad Gateway

```bash
# Check if backend is running
systemctl status ccms-backend

# Check Nginx error logs
tail -f /var/log/nginx/ccms_error.log

# Check backend is listening
ss -tlnp | grep 5000
```

### SignalR WebSocket Issues

Ensure your Nginx config has proper WebSocket headers:
- `proxy_set_header Upgrade $http_upgrade;`
- `proxy_set_header Connection "upgrade";`
- Long timeout: `proxy_read_timeout 3600s;`

---

## 💰 Cost Summary (Estimated Monthly)

| Component | Service | Cost |
|-----------|---------|------|
| Server | CX32 (4 vCPU, 8GB RAM) | €7.19 |
| Server (recommended) | CX42 (8 vCPU, 16GB RAM) | €14.39 |
| Backups | 100 GB Volume | €4.80 |
| Domain | .com domain | ~€10-15/year |
| SSL | Let's Encrypt | Free |
| **Total (Basic)** | | **~€12-20/month** |

---

## ✅ Deployment Checklist

- [ ] Create Hetzner server (CX32/CX42)
- [ ] Configure DNS (A record)
- [ ] Install dependencies (.NET, Node.js, Nginx, Docker)
- [ ] Set up SQL Server in Docker
- [ ] Deploy backend and configure systemd service
- [ ] Build and deploy frontend
- [ ] Configure Nginx reverse proxy
- [ ] Obtain SSL certificate (Let's Encrypt)
- [ ] Update appsettings.Production.json with production values
- [ ] Test all endpoints
- [ ] Set up backup schedule
- [ ] Configure monitoring

---

**Need help?** Check the logs first, then search for specific error messages.
