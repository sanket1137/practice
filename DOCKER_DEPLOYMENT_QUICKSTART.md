# CCMS Docker Deployment - Quick Start Guide

## Files Created

The following Docker files have been created for your CCMS application:

### Root Level
- `docker-compose.yml` - Main production Docker Compose configuration
- `docker-compose.dev.yml` - Development Docker Compose configuration
- `.env` - Environment variables (update before deploying!)
- `.env.example` - Example environment file
- `.dockerignore` - Files to exclude from Docker context
- `deploy.ps1` - Windows PowerShell deployment script
- `deploy.sh` - Linux deployment script (run on server)

### Backend
- `backend/Dockerfile` - Multi-stage Dockerfile for .NET 8.0 API
- `backend/.dockerignore` - Backend-specific Docker ignore
- `backend/CCMS.Api/Controllers/HealthController.cs` - Health check endpoint (NEW)

### Frontend
- `frontend/Dockerfile` - Multi-stage Dockerfile for React app
- `frontend/nginx.conf` - Nginx configuration for SPA
- `frontend/.dockerignore` - Frontend-specific Docker ignore

### Nginx (Reverse Proxy)
- `nginx/nginx.conf` - Main Nginx configuration
- `nginx/conf.d/default.conf` - Server block configuration

---

## Manual Deployment Steps

Since the SSH key has a passphrase, follow these steps manually:

### Step 1: Connect to your Hetzner Server

```powershell
# From PowerShell
C:\Windows\System32\OpenSSH\ssh.exe -i "$env:USERPROFILE\.ssh\ccms-hetzner" root@91.99.190.216
```

Enter your SSH key passphrase when prompted.

### Step 2: Create Project Directory (on server)

```bash
mkdir -p /opt/ccms
cd /opt/ccms
```

### Step 3: Upload Files using SCP (from Windows)

Open a NEW PowerShell window and run:

```powershell
cd "c:\Users\Sanket\Desktop\Me\Projects\Playground\PixelCCMSCopilot\practice"

# Upload docker-compose and env files
C:\Windows\System32\OpenSSH\scp.exe -i "$env:USERPROFILE\.ssh\ccms-hetzner" docker-compose.yml .env .dockerignore root@91.99.190.216:/opt/ccms/

# Upload nginx config
C:\Windows\System32\OpenSSH\scp.exe -i "$env:USERPROFILE\.ssh\ccms-hetzner" -r nginx root@91.99.190.216:/opt/ccms/

# Upload backend (this will take time)
C:\Windows\System32\OpenSSH\scp.exe -i "$env:USERPROFILE\.ssh\ccms-hetzner" -r backend root@91.99.190.216:/opt/ccms/

# Upload frontend (excluding node_modules)
Get-ChildItem frontend -Exclude node_modules,dist | ForEach-Object { 
    C:\Windows\System32\OpenSSH\scp.exe -i "$env:USERPROFILE\.ssh\ccms-hetzner" -r $_.FullName root@91.99.190.216:/opt/ccms/frontend/ 
}
```

**OR use an SFTP client like FileZilla:**
1. Open FileZilla
2. Host: `91.99.190.216`, Username: `root`, Port: `22`
3. Use SSH key: `C:\Users\Sanket\.ssh\ccms-hetzner`
4. Upload the entire `practice` folder to `/opt/ccms/`

### Step 4: Build and Start Containers (on server)

SSH into the server and run:

```bash
cd /opt/ccms

# Update .env file with production values
nano .env

# Change these values:
# DB_PASSWORD=YourSecurePassword123!
# JWT_SECRET=your-random-64-character-string-here-change-this-in-production

# Build containers (first time takes 5-10 minutes)
docker compose build

# Start all services
docker compose up -d

# Check status
docker compose ps

# View logs
docker compose logs -f
```

### Step 5: Verify Deployment

```bash
# Check all containers are running
docker compose ps

# Test health endpoint
curl http://localhost/api/health

# Test frontend
curl http://localhost/
```

---

## Docker Commands Reference

```bash
# Start all services
docker compose up -d

# Stop all services
docker compose down

# Restart a specific service
docker compose restart backend

# View logs
docker compose logs -f
docker compose logs backend
docker compose logs frontend

# Rebuild after code changes
docker compose build --no-cache
docker compose up -d

# Check container status
docker compose ps

# Enter a container shell
docker compose exec backend bash
docker compose exec db bash

# View database
docker compose exec db /opt/mssql-tools18/bin/sqlcmd -S localhost -U SA -P "YourPassword" -C
```

---

## Architecture Overview

```
                          ┌────────────────────────────────────────┐
                          │             Hetzner Server             │
                          │                                        │
  Internet ──────────────►│  ┌──────────────────────────────────┐ │
                          │  │         Nginx (Port 80/443)      │ │
                          │  │  - SSL termination               │ │
                          │  │  - Reverse proxy                 │ │
                          │  │  - Static file serving           │ │
                          │  └──────────────────────────────────┘ │
                          │           │                           │
                          │    ┌──────┴──────┬──────────┐        │
                          │    │             │          │        │
                          │    ▼             ▼          ▼        │
                          │  ┌────┐     ┌────────┐  ┌────────┐  │
                          │  │ /  │     │ /api   │  │/uploads│  │
                          │  │    │     │ /hubs  │  │        │  │
                          │  └──┬─┘     └───┬────┘  └────────┘  │
                          │     │           │                    │
                          │     ▼           ▼                    │
                          │  ┌──────┐   ┌──────────┐            │
                          │  │Front │   │ Backend  │            │
                          │  │ end  │   │  API     │            │
                          │  │:3000 │   │  :5000   │            │
                          │  └──────┘   └────┬─────┘            │
                          │                  │                   │
                          │                  ▼                   │
                          │            ┌──────────┐             │
                          │            │ SQL      │             │
                          │            │ Server   │             │
                          │            │ :1433    │             │
                          │            └──────────┘             │
                          └────────────────────────────────────────┘

Container Names:
- ccms-nginx    → Reverse proxy
- ccms-frontend → React SPA
- ccms-backend  → .NET 8 API
- ccms-db       → SQL Server 2022
```

---

## Troubleshooting

### Backend not starting
```bash
docker compose logs backend
# Check for database connection errors
```

### Database connection failed
```bash
# Wait for SQL Server to be ready (30-60 seconds on first start)
docker compose logs db
# Check if SQL Server is healthy
docker compose ps
```

### Frontend shows blank page
```bash
# Check frontend container logs
docker compose logs frontend
# Verify nginx config
docker compose exec nginx nginx -t
```

### Port already in use
```bash
# Check what's using port 80
ss -tlnp | grep :80
# Stop the service or change nginx port in docker-compose.yml
```

---

## Updating the Application

### Update Backend
```bash
cd /opt/ccms
# Pull latest code or upload new files
docker compose build backend --no-cache
docker compose up -d backend
```

### Update Frontend
```bash
cd /opt/ccms
# Pull latest code or upload new files
docker compose build frontend --no-cache
docker compose up -d frontend
```

### Update All
```bash
docker compose down
docker compose build --no-cache
docker compose up -d
```

---

## URLs After Deployment

| Service | URL |
|---------|-----|
| Frontend | http://91.99.190.216 |
| API | http://91.99.190.216/api |
| Health Check | http://91.99.190.216/api/health |
| Swagger (if enabled) | http://91.99.190.216/swagger |
| SignalR | ws://91.99.190.216/hubs |

---

## Security Checklist

- [ ] Change `DB_PASSWORD` in `.env`
- [ ] Change `JWT_SECRET` to a random 64+ character string
- [ ] Set up SSL with Let's Encrypt
- [ ] Configure firewall (UFW)
- [ ] Set up regular backups
- [ ] Configure monitoring
