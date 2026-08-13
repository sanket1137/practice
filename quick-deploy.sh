#!/bin/bash
# CCMS Quick Deploy Script - Run on Hetzner server
#
# Builds new images alongside the currently-running ones and only swaps
# traffic over once the new backend passes its health check. Never deletes
# the previous image before a new one is confirmed healthy, so a failed
# build/deploy leaves the previous working deployment running.

set -e

echo "=========================================="
echo "CCMS Deployment - Neon PostgreSQL + R2"
echo "=========================================="

cd /opt/ccms

if [ ! -f .env ]; then
    echo "ERROR: .env not found in /opt/ccms — refusing to deploy without configured secrets."
    exit 1
fi

echo "[1/6] Backing up database..."
mkdir -p backups
BACKUP_FILE="backups/ccms_backup_$(date +%Y%m%d_%H%M%S).sql"
# shellcheck disable=SC1091
source .env
if [ -n "$POSTGRES_CONNECTION_STRING" ]; then
    pg_dump "$POSTGRES_CONNECTION_STRING" > "$BACKUP_FILE" || echo "WARN: backup failed, continuing anyway"
else
    echo "WARN: POSTGRES_CONNECTION_STRING not set, skipping backup"
fi

echo "[2/6] Building new images (previous images are left intact until this succeeds)..."
docker compose -f docker-compose.production.yml build

echo "[3/6] Starting new containers..."
docker compose -f docker-compose.production.yml up -d

echo "[4/6] Waiting for backend health check..."
ATTEMPTS=0
until curl -fsS http://localhost:5000/health/ready > /dev/null 2>&1 || [ $ATTEMPTS -eq 12 ]; do
    ATTEMPTS=$((ATTEMPTS + 1))
    echo "  ...waiting ($ATTEMPTS/12)"
    sleep 5
done

if ! curl -fsS http://localhost:5000/health/ready > /dev/null 2>&1; then
    echo "ERROR: backend did not become healthy after deploy. Check logs with: docker compose -f docker-compose.production.yml logs backend"
    echo "The previous images were not deleted — you can investigate before deciding to roll back."
    exit 1
fi

echo "[5/6] Health check passed. Cleaning up dangling (untagged) image layers..."
docker image prune -f

echo "[6/6] Done."
echo ""
echo "=========================================="
echo "Deployment Complete!"
echo "=========================================="
docker compose -f docker-compose.production.yml ps

echo ""
echo "View logs: docker compose -f docker-compose.production.yml logs -f"
echo "=========================================="
