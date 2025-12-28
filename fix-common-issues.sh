#!/bin/bash
# CCMS - Fix Common Issues Script
# Run this ON the server if you encounter problems
#
# Usage: sudo ./fix-common-issues.sh

set -e

CCMS_DIR="/opt/ccms"
cd $CCMS_DIR 2>/dev/null || cd /root/ccms 2>/dev/null || { echo "Cannot find CCMS directory"; exit 1; }

# Load environment variables
source .env 2>/dev/null || true
DB_PASSWORD="${DB_PASSWORD:-YourStrong!Passw0rd123}"

echo "========================================"
echo "  CCMS Common Issues Fix Script"
echo "========================================"
echo ""

# Function to check if container is running
container_running() {
    docker ps --filter "name=$1" --filter "status=running" -q | grep -q .
}

# Fix 1: Restart services if not running
echo "1. Checking container status..."
if ! container_running "ccms-backend"; then
    echo "   Backend not running, restarting..."
    docker compose up -d backend
fi
if ! container_running "ccms-db"; then
    echo "   Database not running, restarting..."
    docker compose up -d db
    sleep 30
fi
if ! container_running "ccms-frontend"; then
    echo "   Frontend not running, restarting..."
    docker compose up -d frontend
fi
if ! container_running "ccms-nginx"; then
    echo "   Nginx not running, restarting..."
    docker compose up -d nginx
fi
echo "   ✅ All containers checked"

# Fix 2: Reset a user password
reset_password() {
    local email=$1
    local new_hash='$2a$11$rS8qPmJmxkqKqKqKqKqKqOVZ8ZVHqKqjQXKjfXvKYH7WKqKH7WKq'
    echo "   Resetting password for: $email"
    docker exec -i ccms-db /opt/mssql-tools18/bin/sqlcmd -S localhost -U SA -P "$DB_PASSWORD" -C -d CCMSDb -Q "UPDATE Users SET PasswordHash = '$new_hash' WHERE Email = '$email'" 2>/dev/null
    echo "   New password: Password123!"
}

# Fix 3: Ensure test users exist
echo ""
echo "2. Checking test users..."
USER_COUNT=$(docker exec -i ccms-db /opt/mssql-tools18/bin/sqlcmd -S localhost -U SA -P "$DB_PASSWORD" -C -d CCMSDb -Q "SELECT COUNT(*) FROM Users" -h -1 2>/dev/null | tr -d ' ')
echo "   Found $USER_COUNT users in database"

if [ "$USER_COUNT" -lt "3" ]; then
    echo "   Database may not be seeded. Restarting backend to trigger seeding..."
    docker compose restart backend
    sleep 10
fi

# Fix 4: Check and display logs if there are errors
echo ""
echo "3. Checking for recent errors..."
ERRORS=$(docker compose logs backend --tail=50 2>&1 | grep -i "error\|exception\|fail" | tail -5)
if [ -n "$ERRORS" ]; then
    echo "   Recent errors found:"
    echo "$ERRORS"
else
    echo "   ✅ No recent errors"
fi

# Fix 5: Test API endpoints
echo ""
echo "4. Testing API endpoints..."
if curl -sf http://localhost:5000/api/health &>/dev/null; then
    echo "   ✅ Backend health check passed"
else
    echo "   ❌ Backend health check failed"
    echo "   Restarting backend..."
    docker compose restart backend
fi

# Menu for specific fixes
echo ""
echo "========================================"
echo "  Manual Fixes (Optional)"
echo "========================================"
echo ""
echo "1. Reset user password"
echo "2. View backend logs"
echo "3. View database logs"
echo "4. Restart all services"
echo "5. Rebuild and restart"
echo "6. List all users"
echo "7. Exit"
echo ""
read -p "Select option (1-7): " choice

case $choice in
    1)
        read -p "Enter email address: " email
        reset_password "$email"
        echo "Password reset to: Password123!"
        ;;
    2)
        docker compose logs backend --tail=100
        ;;
    3)
        docker compose logs db --tail=100
        ;;
    4)
        docker compose restart
        ;;
    5)
        docker compose down
        docker compose build --no-cache
        docker compose up -d
        ;;
    6)
        docker exec -i ccms-db /opt/mssql-tools18/bin/sqlcmd -S localhost -U SA -P "$DB_PASSWORD" -C -d CCMSDb -Q "SELECT Email, Role, CreatedAt FROM Users"
        ;;
    7)
        echo "Done!"
        ;;
    *)
        echo "Invalid option"
        ;;
esac

echo ""
echo "========================================"
echo "  Fix script completed!"
echo "========================================"
