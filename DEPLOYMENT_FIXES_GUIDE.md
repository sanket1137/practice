# CCMS Deployment Checklist & Fix Guide

This document consolidates all fixes and lessons learned during deployment.

## Pre-Deployment Checklist

### 1. Environment Setup
- [ ] Create `.env` file with secure passwords
- [ ] Verify ports 80, 443, 5000 are available
- [ ] Ensure Docker and Docker Compose are installed

### 2. Configuration Files
- [ ] Update `docker-compose.yml` with correct image paths
- [ ] Set `ASPNETCORE_URLS=http://+:5000` in backend environment
- [ ] Configure CORS origins in backend

## Known Issues & Fixes

### Issue 1: Login Returns 401 Despite Correct Credentials

**Symptom:** User exists in database but login fails with 401.

**Cause:** Email lookup was case-sensitive.

**Fix Applied:** In `AuthService.cs`, login now uses case-insensitive email matching:

```csharp
var normalizedEmail = request.Email?.Trim().ToLowerInvariant();
var user = await _context.Users.FirstOrDefaultAsync(
    u => u.Email.ToLower() == normalizedEmail, 
    cancellationToken);
```

**Verification:** Test login with mixed case email to confirm fix works.

---

### Issue 2: Backend Container Exits Immediately

**Symptom:** Backend container starts and then exits.

**Cause:** Database not ready when backend tries to connect.

**Fix Applied:** Updated `deploy.sh` with retry logic:
- Wait up to 150 seconds for database
- Backend depends_on db with health check
- Retry curl health check 30 times

---

### Issue 3: Frontend Can't Connect to Backend

**Symptom:** API calls from frontend fail.

**Cause:** CORS not configured or backend URL incorrect.

**Fix Applied:** 
- Configure CORS in backend to allow frontend origin
- Set environment variable `API_URL` in frontend container
- Ensure nginx properly proxies `/api` requests

---

### Issue 4: Database Not Seeded

**Symptom:** No test users available.

**Cause:** First migration/seeding didn't run.

**Fix Applied:** Backend auto-runs migrations on startup. If not seeded:
```bash
docker compose restart backend
```

---

### Issue 5: Special Characters in Password Cause Login Failure

**Symptom:** Login works for simple passwords but fails for passwords with `$`, `@`, `!`, etc.

**Cause:** Shell escaping or URL encoding issues.

**Workaround:** 
- Use passwords without special characters for testing
- Reset password to `Password123!` for troubleshooting:

```sql
UPDATE Users SET PasswordHash = '$2a$11$...' WHERE Email = 'user@example.com';
```

---

## Raspberry Pi Player Setup

### Known Package Issues (Debian Trixie)

| Problem | Solution |
|---------|----------|
| `libatlas-base-dev` not found | Use `libopenblas-dev` instead |
| pip install fails | Use `python3 -m venv` (virtual environment required) |
| Setup script uses wrong user | Script auto-detects from `SUDO_USER` |

### Quick Setup Command

```bash
curl -fsSL https://raw.githubusercontent.com/YOUR_REPO/main/player/setup-raspberry-pi.sh | sudo bash -s -- --server-url http://YOUR_SERVER_IP --no-confirm --auto-start
```

---

## Test Users (Seeded)

| Email | Password | Role |
|-------|----------|------|
| admin@example.com | Password123! | Admin |
| advertiser1@example.com | Password123! | Advertiser |
| owner1@example.com | Password123! | Screen Owner |

---

## Quick Fix Commands

### On the Server

```bash
# SSH to server
ssh root@YOUR_SERVER_IP

# Navigate to CCMS
cd /opt/ccms

# View logs
docker compose logs backend --tail=100

# Restart everything
docker compose restart

# Full rebuild
docker compose down
docker compose build --no-cache
docker compose up -d

# Reset user password
docker exec -i ccms-db /opt/mssql-tools18/bin/sqlcmd -S localhost -U SA -P "YourPassword" -C -d CCMSDb -Q "UPDATE Users SET PasswordHash = '\$2a\$11\$...' WHERE Email = 'user@email.com'"

# List users
docker exec -i ccms-db /opt/mssql-tools18/bin/sqlcmd -S localhost -U SA -P "YourPassword" -C -d CCMSDb -Q "SELECT Email, Role FROM Users"
```

### Health Check

```bash
# Test backend
curl http://localhost:5000/api/health

# Test login
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"Password123!"}'
```

---

## Deployment Steps

### Fresh Deployment

1. Clone repository to server
2. Copy `deploy.sh` to server
3. Run deployment:
   ```bash
   chmod +x deploy.sh
   ./deploy.sh
   ```
4. Wait for all services to start (~2-3 minutes)
5. Test with browser: `http://YOUR_SERVER_IP`

### Update Deployment

1. Pull latest code:
   ```bash
   git pull origin main
   ```
2. Rebuild and restart:
   ```bash
   docker compose down
   docker compose build --no-cache backend frontend
   docker compose up -d
   ```

---

## Troubleshooting

### Container Won't Start

```bash
# Check logs
docker compose logs SERVICE_NAME

# Check container status
docker compose ps

# Check resource usage
docker stats
```

### Database Connection Issues

```bash
# Test database connectivity
docker exec -it ccms-db /opt/mssql-tools18/bin/sqlcmd -S localhost -U SA -P "YourPassword" -C -Q "SELECT 1"

# Check if database exists
docker exec -it ccms-db /opt/mssql-tools18/bin/sqlcmd -S localhost -U SA -P "YourPassword" -C -Q "SELECT name FROM sys.databases"
```

### Network Issues

```bash
# Check container networks
docker network ls
docker network inspect ccms_default

# Test internal connectivity
docker exec ccms-backend curl http://ccms-db:1433
```

---

## Files Modified (All Fixes Applied)

| File | Fix Description |
|------|-----------------|
| `CCMS.Infrastructure/Services/AuthService.cs` | Case-insensitive email lookup |
| `player/setup-raspberry-pi.sh` | Trixie compatibility, auto-detect user |
| `deploy.sh` | Health checks, retry logic, default .env |
| `fix-common-issues.sh` | Interactive troubleshooting script |

---

## Contact & Support

If issues persist after applying these fixes:
1. Check GitHub Issues
2. Review Docker logs
3. Verify environment variables match documentation
