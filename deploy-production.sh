#!/bin/bash

# ===========================================
# CCMS Production Deployment Script
# ===========================================
# Usage: ./deploy-production.sh [command]
# Commands: setup, deploy, rollback, ssl, logs, status, restart, backup
# ===========================================

set -e

# Configuration
REMOTE_USER=${REMOTE_USER:-root}
REMOTE_HOST=${REMOTE_HOST:-your-hetzner-ip}
REMOTE_DIR="/opt/ccms"
DOMAIN=${DOMAIN:-yourdomain.com}
SSL_EMAIL=${SSL_EMAIL:-admin@yourdomain.com}
IMAGE_TAG=$(date +%Y%m%d%H%M%S)

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log_info() { echo -e "${GREEN}[INFO]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

if [ "$REMOTE_USER" = "root" ]; then
    log_warn "REMOTE_USER=root. Prefer a dedicated deploy user with sudo/docker-group access instead of SSHing as root."
fi

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

        # Install nginx (host-level TLS termination — see nginx/README.md) and tools
        apt-get install -y curl git htop nano ufw nginx certbot python3-certbot-nginx

        # Configure firewall
        ufw default deny incoming
        ufw default allow outgoing
        ufw allow ssh
        ufw allow http
        ufw allow https
        ufw --force enable

        # Create application directory
        mkdir -p /opt/ccms
        mkdir -p /opt/ccms/backups
        mkdir -p /opt/ccms/certbot/conf
        mkdir -p /opt/ccms/certbot/www

        # Generate DH params once — ssl-nginx.conf requires this file
        if [ ! -f /etc/nginx/dhparam.pem ]; then
            openssl dhparam -out /etc/nginx/dhparam.pem 2048
        fi

        echo "Server setup complete!"
ENDSSH

    log_info "Server setup complete!"
}

# ===========================================
# DATABASE BACKUP (from Neon) — runs BEFORE every deploy
# ===========================================
backup_db() {
    log_info "Creating database backup..."

    if [ ! -f .env ]; then
        log_error ".env file not found! Copy .env.production.example to .env and configure it."
        exit 1
    fi

    mkdir -p backups
    BACKUP_FILE="ccms_backup_$(date +%Y%m%d_%H%M%S).sql"

    # shellcheck disable=SC1091
    source .env

    if [ -z "$POSTGRES_CONNECTION_STRING" ]; then
        log_error "POSTGRES_CONNECTION_STRING not set in .env — cannot back up before deploy."
        exit 1
    fi

    pg_dump "$POSTGRES_CONNECTION_STRING" > "backups/${BACKUP_FILE}"
    log_info "Backup created: backups/${BACKUP_FILE}"

    # Keep the last 14 local backups only
    ls -1t backups/ccms_backup_*.sql 2>/dev/null | tail -n +15 | xargs -r -I{} rm -- "backups/{}"
}

# ===========================================
# DEPLOY APPLICATION
# ===========================================
deploy() {
    log_info "Deploying CCMS to production (image tag ${IMAGE_TAG})..."

    if [ ! -f .env ]; then
        log_error ".env file not found! Copy .env.production.example to .env and configure it."
        exit 1
    fi

    backup_db

    # Sync files to server. Secrets and local-only directories must never
    # leave this machine over rsync — they belong in the server's own .env.
    log_info "Syncing files to server..."
    rsync -avz --progress \
        --exclude 'node_modules' \
        --exclude '.git' \
        --exclude 'bin' \
        --exclude 'obj' \
        --exclude '*.log' \
        --exclude '.vs' \
        --exclude '.venv' \
        --exclude '.env' \
        --exclude '.env.local' \
        --exclude 'creds.local.md' \
        --exclude 'backups/' \
        --exclude 'player/' \
        --exclude '*.csx' \
        --exclude 'Scripts/' \
        --exclude 'TempDbFix/' \
        --exclude 'TempDbCreate/' \
        --exclude 'TempClean/' \
        ./ ${REMOTE_USER}@${REMOTE_HOST}:${REMOTE_DIR}/

    # Deploy the host nginx config (TLS termination happens outside Docker —
    # see nginx/README.md). Validate before reloading so a bad config never
    # takes down the currently-serving nginx process.
    log_info "Updating host nginx config..."
    ssh ${REMOTE_USER}@${REMOTE_HOST} << ENDSSH
        set -e
        cp ${REMOTE_DIR}/nginx/ssl-nginx.conf /etc/nginx/sites-available/ccms.conf
        ln -sf /etc/nginx/sites-available/ccms.conf /etc/nginx/sites-enabled/ccms.conf
        nginx -t
        systemctl reload nginx
ENDSSH

    # Deploy on server with a tagged, rollback-able image build
    log_info "Building and starting containers (tag ${IMAGE_TAG})..."
    ssh ${REMOTE_USER}@${REMOTE_HOST} << ENDSSH
        set -e
        cd ${REMOTE_DIR}

        # Load environment variables
        set -a
        source .env
        set +a

        export IMAGE_TAG=${IMAGE_TAG}
        docker compose -f docker-compose.production.yml build
        docker compose -f docker-compose.production.yml up -d

        # Record this tag as the current deploy so 'rollback' knows what to
        # go back to, and keep the previous tag around for that purpose.
        echo "${IMAGE_TAG}" >> ${REMOTE_DIR}/.deployed_tags
        tail -n 5 ${REMOTE_DIR}/.deployed_tags > ${REMOTE_DIR}/.deployed_tags.tmp
        mv ${REMOTE_DIR}/.deployed_tags.tmp ${REMOTE_DIR}/.deployed_tags

        # Only prune dangling/untagged layers — never the images backing the
        # last few tagged deploys, so rollback stays possible.
        docker image prune -f

        echo "Deployment complete!"
ENDSSH

    # Health check with a real failure path (no swallowed errors)
    log_info "Verifying deployment health..."
    sleep 5
    if ! curl -fsS "https://${DOMAIN}/health" > /dev/null; then
        log_error "Post-deploy health check FAILED. Consider: ./deploy-production.sh rollback"
        exit 1
    fi

    log_info "Deployment complete and healthy!"
}

# ===========================================
# ROLLBACK — restore the previously deployed image tag
# ===========================================
rollback() {
    log_info "Rolling back to the previous deployment..."

    ssh ${REMOTE_USER}@${REMOTE_HOST} << ENDSSH
        set -e
        cd ${REMOTE_DIR}
        if [ ! -f .deployed_tags ] || [ \$(wc -l < .deployed_tags) -lt 2 ]; then
            echo "No previous deployment tag recorded — cannot roll back automatically."
            exit 1
        fi
        PREVIOUS_TAG=\$(tail -n 2 .deployed_tags | head -n 1)
        echo "Rolling back to image tag \${PREVIOUS_TAG}..."
        set -a
        source .env
        set +a
        export IMAGE_TAG=\${PREVIOUS_TAG}
        docker compose -f docker-compose.production.yml up -d
        echo "Rollback complete."
ENDSSH
}

# ===========================================
# SETUP SSL CERTIFICATES (host nginx + certbot)
# ===========================================
setup_ssl() {
    log_info "Setting up SSL certificates with Let's Encrypt (host nginx)..."

    ssh ${REMOTE_USER}@${REMOTE_HOST} << ENDSSH
        set -e
        certbot --nginx -d ccms.${DOMAIN} \
            --email ${SSL_EMAIL} \
            --agree-tos \
            --no-eff-email \
            --redirect
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
# MAIN
# ===========================================
case "$1" in
    setup)
        setup_server
        ;;
    deploy)
        deploy
        ;;
    rollback)
        rollback
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
        echo "  setup     - Initial server setup (Docker, nginx, firewall, etc.)"
        echo "  deploy    - Back up DB, sync files, deploy nginx config, build+start containers"
        echo "  rollback  - Roll back to the previously deployed image tag"
        echo "  ssl       - Setup SSL certificates with Let's Encrypt (host nginx + certbot)"
        echo "  logs      - View container logs (optional: service name)"
        echo "  status    - Check deployment status"
        echo "  restart   - Restart services (optional: service name)"
        echo "  backup    - Create database backup"
        echo ""
        echo "Environment variables:"
        echo "  REMOTE_USER  - SSH user (default: root; prefer a dedicated deploy user)"
        echo "  REMOTE_HOST  - Hetzner server IP"
        echo "  DOMAIN       - Your domain name"
        echo "  SSL_EMAIL    - Email for Let's Encrypt"
        ;;
esac
