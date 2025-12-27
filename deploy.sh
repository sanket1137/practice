#!/bin/bash
# CCMS Server Setup and Deployment Script
# Run this ON the Hetzner server

set -e

CCMS_DIR="/opt/ccms"

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

# Check if .env exists
if [ ! -f .env ]; then
    echo "ERROR: .env file not found!"
    echo "Please copy .env.example to .env and configure it first."
    exit 1
fi

# Load environment variables
source .env

echo "Step 1: Stopping existing containers (if any)..."
docker compose down 2>/dev/null || true

echo "Step 2: Pulling latest images..."
docker compose pull

echo "Step 3: Building application containers..."
docker compose build

echo "Step 4: Starting all services..."
docker compose up -d

echo "Step 5: Waiting for services to be healthy..."
sleep 10

echo "Step 6: Checking service status..."
docker compose ps

echo ""
echo "========================================"
echo "  Deployment Complete!"
echo "========================================"
echo ""
echo "Service URLs:"
echo "  - Frontend: http://${SERVER_IP:-localhost}"
echo "  - API: http://${SERVER_IP:-localhost}/api"
echo "  - Health: http://${SERVER_IP:-localhost}/health"
echo ""
echo "Useful commands:"
echo "  - View logs: docker compose logs -f"
echo "  - Restart: docker compose restart"
echo "  - Stop: docker compose down"
echo "  - Status: docker compose ps"
echo ""

# Run database migrations if needed
echo "Do you want to check database connectivity? (y/n)"
read -r answer
if [ "$answer" = "y" ]; then
    echo "Checking database connection..."
    docker compose exec backend curl -f http://localhost:8080/api/health || echo "Backend health check failed"
fi
