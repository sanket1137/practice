# CCMS Production Deployment Guide

## Overview

This guide covers deploying the CCMS (Cloud Content Management System) to production using:
- **Server**: Hetzner VPS (Ubuntu 22.04)
- **Database**: Neon PostgreSQL (Frankfurt)
- **Storage**: Cloudflare R2 (zero egress fees)
- **SSL**: Let's Encrypt (auto-renewal)

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    HETZNER VPS                              │
│  ┌───────────────────────────────────────────────────────┐  │
│  │                   NGINX                               │  │
│  │   (SSL Termination + Reverse Proxy)                   │  │
│  │   Port 80/443                                         │  │
│  └────────────┬──────────────────┬───────────────────────┘  │
│               │                  │                          │
│       ┌───────▼────────┐  ┌──────▼─────────┐               │
│       │   FRONTEND     │  │    BACKEND     │               │
│       │  (React/Nginx) │  │   (.NET 8.0)   │               │
│       │   Port 3000    │  │   Port 5257    │               │
│       └────────────────┘  └───────┬────────┘               │
│                                   │                         │
└───────────────────────────────────┼─────────────────────────┘
                                    │
                    ┌───────────────┴───────────────┐
                    │                               │
            ┌───────▼───────┐             ┌────────▼────────┐
            │  NEON         │             │  CLOUDFLARE R2  │
            │  PostgreSQL   │             │  Object Storage │
            │  (Frankfurt)  │             │  (prod-ccms)    │
            └───────────────┘             └─────────────────┘
```

---

## Prerequisites

### 1. Hetzner VPS
- Ubuntu 22.04 LTS
- Minimum: 2 vCPU, 4GB RAM, 40GB SSD
- Recommended: CX21 or CX31 plan
- SSH access configured

### 2. Domain Configuration
Point these DNS records to your Hetzner IP:
```
A    ccms.yourdomain.com      → YOUR_HETZNER_IP
A    api.ccms.yourdomain.com  → YOUR_HETZNER_IP
```

### 3. Neon PostgreSQL (Already Configured)
- **Host**: `ep-snowy-haze-ag6lkc0h-pooler.c-2.eu-central-1.aws.neon.tech`
- **Database**: `pixelspot_ccms`
- **Connection**: Pooled (port 5432)

### 4. Cloudflare R2 (Already Configured)
- **Account ID**: `4f22ea89a2e684c242ace359b5706b03`
- **Bucket**: `prod-ccms`

---

## Deployment Steps

### Step 1: Configure Environment Variables

1. Copy the example environment file:
```powershell
Copy-Item .env.production.example .env
```

2. Edit `.env` with your actual values:
```env
# Database (Neon PostgreSQL)
POSTGRES_CONNECTION_STRING=Host=ep-snowy-haze-ag6lkc0h-pooler.c-2.eu-central-1.aws.neon.tech;Database=pixelspot_ccms;Username=neondb_owner;Password=YOUR_PASSWORD;SSL Mode=Require

# R2 Storage
R2_ACCOUNT_ID=4f22ea89a2e684c242ace359b5706b03
R2_ACCESS_KEY_ID=your_r2_access_key
R2_SECRET_ACCESS_KEY=your_r2_secret_key
R2_BUCKET_NAME=prod-ccms
R2_PUBLIC_URL=https://pub-xxxxx.r2.dev

# JWT Secret (generate with: openssl rand -base64 64)
JWT_SECRET_KEY=your_secure_64_char_jwt_secret

# Domain
FRONTEND_URL=https://ccms.yourdomain.com
BACKEND_URL=https://api.ccms.yourdomain.com
DOMAIN=yourdomain.com
SSL_EMAIL=admin@yourdomain.com
```

### Step 2: Initial Server Setup

```powershell
# Set your Hetzner server IP
$env:REMOTE_HOST = "YOUR_HETZNER_IP"

# Run server setup (installs Docker, configures firewall)
.\deploy-production.ps1 -Command setup
```

This will:
- Update the system packages
- Install Docker and Docker Compose
- Configure UFW firewall (SSH, HTTP, HTTPS)
- Create application directories

### Step 3: Deploy Application

```powershell
# Deploy the application
.\deploy-production.ps1 -Command deploy
```

This will:
- Sync all files to the server
- Update nginx config with your domain
- Build Docker images
- Start all containers

### Step 4: Setup SSL Certificates

```powershell
# Install Let's Encrypt certificates
$env:DOMAIN = "yourdomain.com"
$env:SSL_EMAIL = "admin@yourdomain.com"
.\deploy-production.ps1 -Command ssl
```

### Step 5: Verify Deployment

```powershell
# Check status
.\deploy-production.ps1 -Command status

# View logs
.\deploy-production.ps1 -Command logs
.\deploy-production.ps1 -Command logs -Service backend
.\deploy-production.ps1 -Command logs -Service frontend
```

---

## Manual Deployment (Alternative)

If you prefer manual deployment:

### 1. SSH to Server
```bash
ssh root@YOUR_HETZNER_IP
```

### 2. Clone/Copy Application
```bash
cd /opt
git clone YOUR_REPO ccms
# OR
scp -r ./ccms root@YOUR_HETZNER_IP:/opt/
```

### 3. Configure Environment
```bash
cd /opt/ccms
cp .env.production.example .env
nano .env  # Edit with your values
```

### 4. Update Nginx Config
```bash
sed -i "s/yourdomain.com/YOUR_DOMAIN/g" nginx/nginx.production.conf
```

### 5. Build and Start
```bash
docker compose -f docker-compose.production.yml build
docker compose -f docker-compose.production.yml up -d
```

### 6. Setup SSL
```bash
# Initial certificate (HTTP challenge)
docker run --rm \
  -v /opt/ccms/certbot/conf:/etc/letsencrypt \
  -v /opt/ccms/certbot/www:/var/www/certbot \
  certbot/certbot certonly --webroot \
  --webroot-path=/var/www/certbot \
  --email admin@yourdomain.com \
  --agree-tos \
  --no-eff-email \
  -d ccms.yourdomain.com \
  -d api.ccms.yourdomain.com

# Restart nginx
docker compose -f docker-compose.production.yml restart nginx
```

---

## R2 Public URL Setup

To serve uploaded content publicly:

1. Go to Cloudflare Dashboard → R2 → prod-ccms bucket
2. Click **Settings** → **Public Access**
3. Enable **R2.dev subdomain** or connect a custom domain
4. Copy the public URL (e.g., `https://pub-xxxxx.r2.dev`)
5. Update `.env`:
   ```
   R2_PUBLIC_URL=https://pub-xxxxx.r2.dev
   ```

---

## Maintenance Commands

### View Logs
```powershell
.\deploy-production.ps1 -Command logs                    # All services
.\deploy-production.ps1 -Command logs -Service backend   # Backend only
.\deploy-production.ps1 -Command logs -Service nginx     # Nginx only
```

### Restart Services
```powershell
.\deploy-production.ps1 -Command restart                 # All services
.\deploy-production.ps1 -Command restart -Service backend
```

### Check Status
```powershell
.\deploy-production.ps1 -Command status
```

### Manual Docker Commands (on server)
```bash
# View all containers
docker compose -f docker-compose.production.yml ps

# Rebuild specific service
docker compose -f docker-compose.production.yml build backend
docker compose -f docker-compose.production.yml up -d backend

# View real-time logs
docker compose -f docker-compose.production.yml logs -f

# Enter container shell
docker exec -it ccms-backend /bin/bash
docker exec -it ccms-frontend /bin/sh

# Database connection test (from backend container)
docker exec -it ccms-backend dotnet ef database update
```

---

## Troubleshooting

### 1. Backend Not Starting
```bash
# Check backend logs
docker logs ccms-backend

# Common issues:
# - Database connection string incorrect
# - JWT secret too short (needs 32+ chars)
# - R2 credentials invalid
```

### 2. SSL Certificate Issues
```bash
# Verify certificates exist
ls -la /opt/ccms/certbot/conf/live/

# Test certificate renewal
docker run --rm \
  -v /opt/ccms/certbot/conf:/etc/letsencrypt \
  certbot/certbot renew --dry-run
```

### 3. SignalR WebSocket Issues
- Ensure nginx config has WebSocket upgrade headers
- Check firewall allows persistent connections
- Verify backend CORS allows frontend origin

### 4. File Upload Issues
- Check R2 credentials and bucket permissions
- Verify nginx `client_max_body_size` (set to 100M)
- Check backend logs for S3 errors

### 5. Database Connection Issues
```bash
# Test connection from server
docker exec -it ccms-backend /bin/bash
apt-get update && apt-get install -y postgresql-client
psql "YOUR_CONNECTION_STRING" -c "SELECT 1"
```

---

## Security Checklist

- [ ] Strong JWT secret (64+ random characters)
- [ ] Neon PostgreSQL SSL enabled
- [ ] R2 access keys secured (not in code)
- [ ] UFW firewall active (only 22, 80, 443 open)
- [ ] HTTPS enforced (HTTP redirects to HTTPS)
- [ ] Rate limiting enabled in nginx
- [ ] Regular backups scheduled
- [ ] SSH key authentication (password disabled)

---

## Backup & Recovery

### Database Backup
Neon provides automatic daily backups, but you can also:
```bash
# Manual backup
pg_dump "CONNECTION_STRING" > backup_$(date +%Y%m%d).sql

# Restore
psql "CONNECTION_STRING" < backup_20240115.sql
```

### Application Backup
```bash
# Backup docker volumes
docker run --rm -v ccms_certbot-conf:/data -v /backup:/backup alpine tar czf /backup/certbot-$(date +%Y%m%d).tar.gz /data
```

---

## Updates & Redeployment

To deploy updates:

```powershell
# Make your changes locally, then:
.\deploy-production.ps1 -Command deploy
```

Or manually:
```bash
cd /opt/ccms
git pull  # if using git
docker compose -f docker-compose.production.yml build --no-cache
docker compose -f docker-compose.production.yml up -d
docker image prune -f
```

---

## Cost Estimate (Monthly)

| Service | Plan | Cost |
|---------|------|------|
| Hetzner VPS | CX21 (2 vCPU, 4GB) | ~€5-10 |
| Neon PostgreSQL | Free tier | $0 (10GB) |
| Cloudflare R2 | Pay-as-you-go | ~$0.015/GB stored |
| Domain | Annual | ~$10-15/year |
| **Total** | | **~€5-15/month** |

---

## Support

For issues:
1. Check container logs: `.\deploy-production.ps1 -Command logs`
2. Verify environment variables in `.env`
3. Check Neon dashboard for database issues
4. Check Cloudflare R2 dashboard for storage issues
