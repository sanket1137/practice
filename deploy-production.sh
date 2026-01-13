#!/bin/bash

# ===========================================
# CCMS Production Deployment Script
# ===========================================
# Usage: ./deploy-production.sh [command]
# Commands: setup, deploy, ssl, logs, status
# ===========================================

set -e

# Configuration
REMOTE_USER=${REMOTE_USER:-root}
REMOTE_HOST=${REMOTE_HOST:-your-hetzner-ip}
REMOTE_DIR="/opt/ccms"
DOMAIN=${DOMAIN:-yourdomain.com}
SSL_EMAIL=${SSL_EMAIL:-admin@yourdomain.com}

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log_info() { echo -e "${GREEN}[INFO]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# ===========================================
# INITIAL SERVER SETUP
# ===========================================
setup_server() {
    log_info "Setting up Hetzner server..."
    
    ssh ${REMOTE_USER}@${REMOTE_HOST} << 'ENDSSH'
        # Update system
        apt-get update && apt-get upgrade -y
        
        # Install Docker
        if ! command -v docker &> /dev/null; then
            curl -fsSL https://get.docker.com -o get-docker.sh
            sh get-docker.sh
            rm get-docker.sh
        fi
        
        # Install Docker Compose
        if ! command -v docker-compose &> /dev/null; then
            apt-get install -y docker-compose-plugin
        fi
        
        # Install useful tools
        apt-get install -y curl git htop nano ufw
        
        # Configure firewall
        ufw default deny incoming
        ufw default allow outgoing
        ufw allow ssh
        ufw allow http
        ufw allow https
        ufw --force enable
        
        # Create application directory
        mkdir -p /opt/ccms
        mkdir -p /opt/ccms/certbot/conf
        mkdir -p /opt/ccms/certbot/www
        mkdir -p /opt/ccms/nginx/ssl
        
        echo "Server setup complete!"
ENDSSH
    
    log_info "Server setup complete!"
}

# ===========================================
# DEPLOY APPLICATION
# ===========================================
deploy() {
    log_info "Deploying CCMS to production..."
    
    # Check if .env exists
    if [ ! -f .env ]; then
        log_error ".env file not found! Copy .env.production.example to .env and configure it."
        exit 1
    fi
    
    # Sync files to server
    log_info "Syncing files to server..."
    rsync -avz --progress \
        --exclude 'node_modules' \
        --exclude '.git' \
        --exclude 'bin' \
        --exclude 'obj' \
        --exclude '*.log' \
        --exclude '.vs' \
        --exclude '.idea' \
        ./ ${REMOTE_USER}@${REMOTE_HOST}:${REMOTE_DIR}/
    
    # Deploy on server
    log_info "Building and starting containers..."
    ssh ${REMOTE_USER}@${REMOTE_HOST} << ENDSSH
        cd ${REMOTE_DIR}
        
        # Load environment variables
        export \$(cat .env | grep -v '^#' | xargs)
        
        # Update domain in nginx config
        sed -i "s/yourdomain.com/${DOMAIN}/g" nginx/nginx.production.conf
        
        # Pull latest images and rebuild
        docker compose -f docker-compose.production.yml pull
        docker compose -f docker-compose.production.yml build --no-cache
        
        # Start services
        docker compose -f docker-compose.production.yml up -d
        
        # Cleanup old images
        docker image prune -f
        
        echo "Deployment complete!"
ENDSSH
    
    log_info "Deployment complete!"
}

# ===========================================
# SETUP SSL CERTIFICATES
# ===========================================
setup_ssl() {
    log_info "Setting up SSL certificates with Let's Encrypt..."
    
    # First, ensure nginx is running for ACME challenge
    ssh ${REMOTE_USER}@${REMOTE_HOST} << ENDSSH
        cd ${REMOTE_DIR}
        
        # Create temporary nginx config for ACME challenge
        cat > /tmp/nginx-acme.conf << 'EOF'
events { worker_connections 1024; }
http {
    server {
        listen 80;
        server_name ccms.${DOMAIN} api.ccms.${DOMAIN};
        location /.well-known/acme-challenge/ {
            root /var/www/certbot;
        }
        location / {
            return 200 'ACME Challenge Server';
            add_header Content-Type text/plain;
        }
    }
}
EOF
        
        # Stop existing nginx if running
        docker stop ccms-nginx 2>/dev/null || true
        
        # Start temporary nginx
        docker run -d --name nginx-acme -p 80:80 \
            -v /tmp/nginx-acme.conf:/etc/nginx/nginx.conf:ro \
            -v ${REMOTE_DIR}/certbot/www:/var/www/certbot \
            nginx:alpine
        
        # Get certificates
        docker run --rm \
            -v ${REMOTE_DIR}/certbot/conf:/etc/letsencrypt \
            -v ${REMOTE_DIR}/certbot/www:/var/www/certbot \
            certbot/certbot certonly --webroot \
            --webroot-path=/var/www/certbot \
            --email ${SSL_EMAIL} \
            --agree-tos \
            --no-eff-email \
            -d ccms.${DOMAIN} \
            -d api.ccms.${DOMAIN}
        
        # Stop temporary nginx
        docker stop nginx-acme && docker rm nginx-acme
        
        # Restart main application
        docker compose -f docker-compose.production.yml up -d
        
        echo "SSL certificates installed!"
ENDSSH
    
    log_info "SSL setup complete!"
}

# ===========================================
# VIEW LOGS
# ===========================================
view_logs() {
    SERVICE=${1:-all}
    
    if [ "$SERVICE" = "all" ]; then
        ssh ${REMOTE_USER}@${REMOTE_HOST} "cd ${REMOTE_DIR} && docker compose -f docker-compose.production.yml logs -f --tail=100"
    else
        ssh ${REMOTE_USER}@${REMOTE_HOST} "cd ${REMOTE_DIR} && docker compose -f docker-compose.production.yml logs -f --tail=100 ${SERVICE}"
    fi
}

# ===========================================
# CHECK STATUS
# ===========================================
check_status() {
    log_info "Checking deployment status..."
    
    ssh ${REMOTE_USER}@${REMOTE_HOST} << ENDSSH
        cd ${REMOTE_DIR}
        
        echo ""
        echo "=== Container Status ==="
        docker compose -f docker-compose.production.yml ps
        
        echo ""
        echo "=== Resource Usage ==="
        docker stats --no-stream
        
        echo ""
        echo "=== Disk Usage ==="
        df -h | head -5
        
        echo ""
        echo "=== Memory Usage ==="
        free -h
ENDSSH
}

# ===========================================
# RESTART SERVICES
# ===========================================
restart() {
    SERVICE=${1:-all}
    
    if [ "$SERVICE" = "all" ]; then
        ssh ${REMOTE_USER}@${REMOTE_HOST} "cd ${REMOTE_DIR} && docker compose -f docker-compose.production.yml restart"
    else
        ssh ${REMOTE_USER}@${REMOTE_HOST} "cd ${REMOTE_DIR} && docker compose -f docker-compose.production.yml restart ${SERVICE}"
    fi
    
    log_info "Services restarted!"
}

# ===========================================
# DATABASE BACKUP (from Neon)
# ===========================================
backup_db() {
    log_info "Creating database backup..."
    
    BACKUP_FILE="ccms_backup_$(date +%Y%m%d_%H%M%S).sql"
    
    # Use pg_dump with Neon connection string
    # Note: You need to set POSTGRES_CONNECTION_STRING in .env
    source .env
    
    pg_dump "$POSTGRES_CONNECTION_STRING" > "backups/${BACKUP_FILE}"
    
    log_info "Backup created: backups/${BACKUP_FILE}"
}

# ===========================================
# MAIN
# ===========================================
case "$1" in
    setup)
        setup_server
        ;;
    deploy)
        deploy
        ;;
    ssl)
        setup_ssl
        ;;
    logs)
        view_logs "$2"
        ;;
    status)
        check_status
        ;;
    restart)
        restart "$2"
        ;;
    backup)
        backup_db
        ;;
    *)
        echo "CCMS Production Deployment Script"
        echo ""
        echo "Usage: $0 [command]"
        echo ""
        echo "Commands:"
        echo "  setup     - Initial server setup (Docker, firewall, etc.)"
        echo "  deploy    - Deploy application to server"
        echo "  ssl       - Setup SSL certificates with Let's Encrypt"
        echo "  logs      - View container logs (optional: service name)"
        echo "  status    - Check deployment status"
        echo "  restart   - Restart services (optional: service name)"
        echo "  backup    - Create database backup"
        echo ""
        echo "Environment variables:"
        echo "  REMOTE_USER  - SSH user (default: root)"
        echo "  REMOTE_HOST  - Hetzner server IP"
        echo "  DOMAIN       - Your domain name"
        echo "  SSL_EMAIL    - Email for Let's Encrypt"
        ;;
esac
