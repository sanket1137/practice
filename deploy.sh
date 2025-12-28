#!/bin/bash
# CCMS Server Setup and Deployment Script
# Run this ON the Hetzner server
#
# Fixes included:
# - Case-insensitive email login
# - Proper database seeding
# - Health check retries
# - Auto-restart on failure

set -e

CCMS_DIR="/opt/ccms"
MAX_RETRIES=30
RETRY_INTERVAL=5

echo "========================================"
echo "  CCMS Server Setup Script"
echo "========================================"
echo ""

# Check if running as root
if [ "$EUID" -ne 0 ]; then
    echo "Please run as root (sudo ./deploy.sh)"
    exit 1
fi

# Create directory if it doesn't exist
mkdir -p $CCMS_DIR
cd $CCMS_DIR

# Check if .env exists, create default if not
if [ ! -f .env ]; then
    echo "Creating default .env file..."
    cat > .env << 'ENVEOF'
DB_PASSWORD=YourStrong!Passw0rd123
JWT_SECRET=your-super-secret-production-key-minimum-32-characters-long
SERVER_IP=localhost
DOMAIN=localhost
ENVEOF
    echo "WARNING: Please edit .env with your actual values!"
    echo "Edit the file at: $CCMS_DIR/.env"
fi

# Load environment variables
source .env

echo "Step 1: Stopping existing containers (if any)..."
docker compose down 2>/dev/null || true

echo "Step 2: Pulling latest images..."
docker compose pull

echo "Step 3: Building application containers..."
docker compose build --no-cache

echo "Step 4: Starting database first..."
docker compose up -d db

echo "Step 5: Waiting for database to be ready..."
for i in $(seq 1 $MAX_RETRIES); do
    if docker compose exec -T db /opt/mssql-tools18/bin/sqlcmd -S localhost -U SA -P "$DB_PASSWORD" -C -Q "SELECT 1" &>/dev/null; then
        echo "Database is ready!"
        break
    fi
    echo "Waiting for database... ($i/$MAX_RETRIES)"
    sleep $RETRY_INTERVAL
done

echo "Step 6: Starting all services..."
docker compose up -d

echo "Step 7: Waiting for backend to be healthy..."
for i in $(seq 1 $MAX_RETRIES); do
    if curl -sf http://localhost:5000/api/health &>/dev/null; then
        echo "Backend is healthy!"
        break
    fi
    echo "Waiting for backend... ($i/$MAX_RETRIES)"
    sleep $RETRY_INTERVAL
done

echo "Step 8: Checking service status..."
docker compose ps

echo ""
echo "========================================"
echo "  Deployment Complete!"
echo "========================================"
echo ""
echo "Service URLs:"
echo "  - Frontend: http://${SERVER_IP:-localhost}"
echo "  - API: http://${SERVER_IP:-localhost}/api"
echo "  - Health: http://${SERVER_IP:-localhost}/api/health"
echo ""
echo "Test Users (seeded automatically):"
echo "  - admin@example.com / Password123!"
echo "  - advertiser1@example.com / Password123!"
echo "  - owner1@example.com / Password123!"
echo ""
echo "Useful commands:"
echo "  - View logs: docker compose logs -f"
echo "  - Backend logs: docker compose logs -f backend"
echo "  - Restart: docker compose restart"
echo "  - Stop: docker compose down"
echo "  - Status: docker compose ps"
echo "  - DB Shell: docker exec -it ccms-db /opt/mssql-tools18/bin/sqlcmd -S localhost -U SA -P '\$DB_PASSWORD' -C -d CCMSDb"
echo ""

# Quick health check
echo "Running quick health check..."
if curl -sf http://localhost:5000/api/health &>/dev/null; then
    echo "✅ Backend is running!"
else
    echo "⚠️  Backend may still be starting. Check logs with: docker compose logs -f backend"
fi

if curl -sf http://localhost:3000/ &>/dev/null; then
    echo "✅ Frontend is running!"
else
    echo "⚠️  Frontend may still be starting. Check logs with: docker compose logs -f frontend"
fi
