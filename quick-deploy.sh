#!/bin/bash
# CCMS Quick Deploy Script - Run on Hetzner server

set -e

echo "=========================================="
echo "CCMS Deployment - Neon PostgreSQL + R2"
echo "=========================================="

cd /opt/ccms

# Stop existing containers
echo "[1/5] Stopping existing containers..."
docker compose down --remove-orphans 2>/dev/null || true

# Remove old images to force rebuild
echo "[2/5] Cleaning up old images..."
docker image rm ccms-backend ccms-frontend 2>/dev/null || true

# Build new images
echo "[3/5] Building containers..."
docker compose build --no-cache

# Start services
echo "[4/5] Starting services..."
docker compose up -d

# Wait for services to be ready
echo "[5/5] Waiting for services to start..."
sleep 10

# Show status
echo ""
echo "=========================================="
echo "Deployment Complete!"
echo "=========================================="
docker compose ps

echo ""
echo "Frontend: http://91.99.190.216"
echo "Backend API: http://91.99.190.216:5000"
echo ""
echo "View logs: docker compose logs -f"
echo "=========================================="
