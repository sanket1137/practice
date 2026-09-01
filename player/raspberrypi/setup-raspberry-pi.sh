#!/bin/bash
#
# CCMS Player - Raspberry Pi 5 Setup Script
# ==========================================
# One-command setup for Raspberry Pi 5 OS (Bookworm/Trixie)
# Tested on: Raspberry Pi OS based on Debian Trixie
#
# Usage — run from a copy of the player/raspberrypi folder (the script installs
# the player files that sit next to it; it can NOT be piped from curl/wget):
#   scp -r player/raspberrypi pi@<pi-host>:/home/pi/ccms-player-src
#   ssh pi@<pi-host>
#   cd /home/pi/ccms-player-src && sudo bash setup-raspberry-pi.sh
#
# Non-interactive (recommended):
#   sudo bash setup-raspberry-pi.sh --screen-id YOUR_ID --api-key YOUR_KEY --server https://ccms.pixelspot.in
#
# Updating an existing install later:
#   scp -r player/raspberrypi pi@<pi-host>:/home/pi/ccms-player-src
#   ssh pi@<pi-host> '/home/pi/ccms-player/update-player.sh /home/pi/ccms-player-src'
#

set -e

# ============================================
# CONFIGURATION - Edit these or pass as args
# ============================================
SCREEN_ID="${SCREEN_ID:-}"
API_KEY="${API_KEY:-}"
SERVER_URL="${SERVER_URL:-http://localhost:5257}"
SERVICE_NAME="ccms-player"
NO_CONFIRM=false
AUTO_START=false

# Auto-detect user - use the user who called sudo, or current user
if [ -n "$SUDO_USER" ]; then
    PI_USER="$SUDO_USER"
elif id "pi" &>/dev/null; then
    PI_USER="pi"
else
    PI_USER="$(whoami)"
fi

# Set install directory based on detected user
INSTALL_DIR="/home/${PI_USER}/ccms-player"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# ============================================
# FUNCTIONS
# ============================================

print_banner() {
    echo -e "${BLUE}"
    echo "╔═══════════════════════════════════════════════════════╗"
    echo "║     CCMS Digital Signage Player - Pi 5 Setup          ║"
    echo "║                                                       ║"
    echo "║     Raspberry Pi 5 / Bookworm / Trixie Compatible     ║"
    echo "╚═══════════════════════════════════════════════════════╝"
    echo -e "${NC}"
}

log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

check_root() {
    if [[ $EUID -ne 0 ]]; then
        log_error "This script must be run as root (use sudo)"
        exit 1
    fi
}

check_raspberry_pi() {
    if ! grep -q "Raspberry Pi" /proc/cpuinfo 2>/dev/null; then
        log_warn "This doesn't appear to be a Raspberry Pi. Continuing anyway..."
    else
        log_info "Detected Raspberry Pi"
        # Check for Pi 5
        if grep -q "Raspberry Pi 5" /proc/cpuinfo 2>/dev/null; then
            log_info "Raspberry Pi 5 detected - using optimized settings"
        fi
    fi
}

parse_args() {
    while [[ $# -gt 0 ]]; do
        case $1 in
            --screen-id)
                SCREEN_ID="$2"
                shift 2
                ;;
            --api-key)
                API_KEY="$2"
                shift 2
                ;;
            --server)
                SERVER_URL="$2"
                shift 2
                ;;
            --user)
                PI_USER="$2"
                shift 2
                ;;
            --install-dir)
                INSTALL_DIR="$2"
                shift 2
                ;;
            --no-confirm|-y)
                NO_CONFIRM=true
                shift
                ;;
            --auto-start)
                AUTO_START=true
                shift
                ;;
            --help)
                show_help
                exit 0
                ;;
            *)
                log_error "Unknown option: $1"
                show_help
                exit 1
                ;;
        esac
    done
}

show_help() {
    echo "Usage: sudo bash setup-raspberry-pi.sh [OPTIONS]"
    echo ""
    echo "Options:"
    echo "  --screen-id ID      Screen ID from CCMS dashboard"
    echo "  --api-key KEY       API key for authentication"
    echo "  --server URL        CCMS server URL (default: http://localhost:5257)"
    echo "  --user USER         Linux user to run player (default: pi)"
    echo "  --install-dir DIR   Installation directory (default: /home/pi/ccms-player)"
    echo "  --no-confirm, -y    Skip confirmation prompts (for automated installs)"
    echo "  --auto-start        Automatically start the player after installation"
    echo "  --help              Show this help message"
    echo ""
    echo "Examples:"
    echo "  # Interactive installation"
    echo "  sudo ./setup-raspberry-pi.sh"
    echo "  SCREEN_ID, API_KEY, SERVER_URL can also be set as environment variables"
}

prompt_config() {
    echo ""
    echo -e "${BLUE}=== Configuration ===${NC}"
    
    if [[ -z "$SCREEN_ID" ]]; then
        if [[ "$NO_CONFIRM" == true ]]; then
            log_error "Screen ID is required. Use --screen-id option."
            exit 1
        fi
        read -p "Enter Screen ID (from CCMS dashboard): " SCREEN_ID
    fi
    
    if [[ -z "$API_KEY" ]]; then
        if [[ "$NO_CONFIRM" == true ]]; then
            log_error "API Key is required. Use --api-key option."
            exit 1
        fi
        read -p "Enter API Key: " API_KEY
    fi
    
    # Only prompt for server URL if using default value and not in no-confirm mode
    if [[ "$SERVER_URL" == "http://localhost:5257" ]] && [[ "$NO_CONFIRM" != true ]]; then
        read -p "Enter Server URL [${SERVER_URL}]: " input_server
        if [[ -n "$input_server" ]]; then
            SERVER_URL="$input_server"
        fi
    fi
    
    echo ""
    log_info "Configuration:"
    echo "  Screen ID:   $SCREEN_ID"
    echo "  API Key:     ${API_KEY:0:8}..."
    echo "  Server URL:  $SERVER_URL"
    echo "  Install Dir: $INSTALL_DIR"
    echo ""
    
    if [[ "$NO_CONFIRM" != true ]]; then
        read -p "Continue with installation? [Y/n]: " confirm
        if [[ "$confirm" =~ ^[Nn] ]]; then
            log_warn "Installation cancelled"
            exit 0
        fi
    else
        log_info "Running in non-interactive mode..."
    fi
}

install_system_dependencies() {
    log_info "Updating system packages..."
    apt-get update -qq
    
    log_info "Installing system dependencies..."
    # Note: libopenblas-dev replaces libatlas-base-dev on Debian Trixie
    # libmpv2 (or libmpv1 on older Bullseye-based images) is REQUIRED for the
    # python-mpv binding in requirements.txt to load. Without it, `import mpv`
    # fails silently and the player falls back to spawning a new VLC process
    # per clip — which adds multi-second startup overhead to every slot and
    # breaks gapless playback. Try both package names since they differ by
    # Debian release.
    apt-get install -y -qq \
        python3 \
        python3-pip \
        python3-venv \
        python3-dev \
        vlc \
        libvlc-dev \
        ffmpeg \
        libopencv-dev \
        python3-opencv \
        libopenblas-dev \
        libavformat-dev \
        libavcodec-dev \
        libswscale-dev \
        libavutil-dev \
        libsrtp2-dev \
        libopus-dev \
        libvpx-dev \
        pkg-config \
        git \
        curl \
        wget \
        unclutter \
        xdotool \
        xserver-xorg-video-fbdev \
        xinit \
        x11-xserver-utils

    # Install libmpv, trying both package names (differs by Debian release —
    # libmpv2 on Bookworm/Trixie, libmpv1 on older Bullseye-based images).
    # This is a hard requirement, not best-effort: without it the player
    # silently degrades to a per-clip subprocess fallback (see comment above).
    if apt-get install -y -qq libmpv2; then
        log_info "Installed libmpv2"
    elif apt-get install -y -qq libmpv1; then
        log_info "Installed libmpv1"
    else
        log_error "Failed to install libmpv2 or libmpv1 — native gapless playback will NOT work."
        log_error "The player will fall back to a per-clip subprocess engine with multi-second gaps between ads."
        log_error "Find the correct package with: apt-cache search libmpv"
        exit 1
    fi

    # For Pi 5 - install libcamera and Wayland support
    if grep -q "Raspberry Pi 5" /proc/cpuinfo 2>/dev/null; then
        log_info "Installing Raspberry Pi 5 specific packages..."
        apt-get install -y -qq \
            libcamera-apps \
            libcamera-dev \
            wlr-randr \
            wayland-protocols \
            libwayland-dev || true
    fi
    
    log_info "System dependencies installed successfully"
}

create_user_if_needed() {
    if ! id "$PI_USER" &>/dev/null; then
        log_info "Creating user $PI_USER..."
        useradd -m -s /bin/bash "$PI_USER"
        usermod -aG video,audio,input,gpio "$PI_USER"
    else
        log_info "User $PI_USER already exists"
        # Ensure user is in required groups
        usermod -aG video,audio,input "$PI_USER" 2>/dev/null || true
        usermod -aG gpio "$PI_USER" 2>/dev/null || true
    fi
}

setup_player_directory() {
    log_info "Setting up player directory at $INSTALL_DIR..."
    
    # Create directory
    mkdir -p "$INSTALL_DIR"
    mkdir -p "$INSTALL_DIR/cache"
    mkdir -p "$INSTALL_DIR/logs"
    mkdir -p "$INSTALL_DIR/video_cache"
    mkdir -p "$INSTALL_DIR/default"
    
    # Change to install directory
    cd "$INSTALL_DIR"
    
    # Create Python virtual environment
    log_info "Creating Python virtual environment..."
    python3 -m venv venv
    
    # Create requirements.txt
    log_info "Creating requirements.txt..."
    cat > requirements.txt << 'EOF'
requests==2.31.0
python-socketio[client]==5.10.0
signalrcore==0.9.5
python-vlc

# WebRTC Live Streaming Dependencies
aiortc>=1.6.0
av>=11.0.0
mss>=9.0.1
numpy>=1.24.0
EOF

    # Install Python dependencies
    log_info "Installing Python dependencies..."
    ./venv/bin/pip install --upgrade pip
    ./venv/bin/pip install wheel setuptools
    ./venv/bin/pip install -r requirements.txt
    
    # Try to install opencv-python (may fail on Pi, use system opencv instead)
    ./venv/bin/pip install opencv-python-headless 2>/dev/null || {
        log_warn "opencv-python-headless failed, using system OpenCV"
        # Link system opencv to venv
        PYTHON_VERSION=$(./venv/bin/python -c "import sys; print(f'{sys.version_info.major}.{sys.version_info.minor}')")
        ln -sf /usr/lib/python3/dist-packages/cv2 "./venv/lib/python${PYTHON_VERSION}/site-packages/" 2>/dev/null || true
    }
    
    log_info "Python dependencies installed"
}

install_player_files() {
    log_info "Installing player files from repository..."

    # The real player lives next to this script in the repo (ccms_player.py and
    # its modules). The old behaviour of writing an embedded copy of the player
    # from a heredoc is gone for good: it silently installed a stale player that
    # lacked gapless playback, the impression store, WebRTC streaming, and
    # device-fingerprint persistence. This script must be run from a copy of
    # player/raspberrypi/ (scp the folder to the Pi), never piped from curl.
    local SCRIPT_DIR
    SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

    if [[ ! -f "$SCRIPT_DIR/ccms_player.py" ]]; then
        log_error "ccms_player.py not found next to this script ($SCRIPT_DIR)."
        log_error "Copy the whole player/raspberrypi/ folder to the Pi and run setup from inside it:"
        log_error "    scp -r player/raspberrypi pi@<pi-host>:/home/pi/ccms-player-src"
        log_error "    ssh pi@<pi-host> 'cd /home/pi/ccms-player-src && sudo ./setup-raspberry-pi.sh'"
        exit 1
    fi

    # Player code + support modules. -p keeps timestamps so update diffs are honest.
    cp -p "$SCRIPT_DIR"/*.py "$INSTALL_DIR/"

    # Bundled mpv IPC library, if present in the repo copy
    if [[ -d "$SCRIPT_DIR/mpv_lib" ]]; then
        rm -rf "$INSTALL_DIR/mpv_lib"
        cp -rp "$SCRIPT_DIR/mpv_lib" "$INSTALL_DIR/"
    fi

    log_info "Player files installed ($(ls "$INSTALL_DIR"/*.py | wc -l) modules)"
}

create_config_file() {
    log_info "Creating configuration file..."
    
    cat > "$INSTALL_DIR/config.json" << EOF
{
    "screen_id": "$SCREEN_ID",
    "api_key": "$API_KEY",
    "server_url": "$SERVER_URL",
    "cache_dir": "./cache",
    "log_level": "INFO"
}
EOF

    log_info "Configuration file created"
}

create_systemd_service() {
    log_info "Creating systemd service..."
    
    cat > "/etc/systemd/system/${SERVICE_NAME}.service" << EOF
[Unit]
Description=CCMS Digital Signage Player
After=network-online.target graphical.target
Wants=network-online.target

[Service]
Type=simple
User=$PI_USER
Group=$PI_USER
WorkingDirectory=$INSTALL_DIR
Environment="DISPLAY=:0"
Environment="XAUTHORITY=/home/$PI_USER/.Xauthority"
ExecStartPre=/bin/sleep 10
ExecStart=$INSTALL_DIR/venv/bin/python $INSTALL_DIR/ccms_player.py
Restart=always
RestartSec=10
StandardOutput=append:$INSTALL_DIR/logs/player.log
StandardError=append:$INSTALL_DIR/logs/player.log

[Install]
WantedBy=graphical.target
EOF

    # Reload systemd and enable service
    systemctl daemon-reload
    systemctl enable "${SERVICE_NAME}.service"
    
    log_info "Systemd service created and enabled"
}

create_autostart_desktop() {
    log_info "Creating desktop autostart entry..."
    
    # Create autostart directory if it doesn't exist
    mkdir -p "/home/$PI_USER/.config/autostart"
    
    cat > "/home/$PI_USER/.config/autostart/ccms-player.desktop" << EOF
[Desktop Entry]
Type=Application
Name=CCMS Player
Comment=Digital Signage Player
Exec=$INSTALL_DIR/venv/bin/python $INSTALL_DIR/ccms_player.py
Hidden=false
NoDisplay=false
X-GNOME-Autostart-enabled=true
EOF

    chown "$PI_USER:$PI_USER" "/home/$PI_USER/.config/autostart/ccms-player.desktop"
    
    log_info "Desktop autostart entry created"
}

configure_display_settings() {
    log_info "Configuring display settings for kiosk mode..."
    
    # Disable screen blanking
    if [[ -f /etc/lightdm/lightdm.conf ]]; then
        # For X11/LightDM
        if ! grep -q "xserver-command=X -s 0 -dpms" /etc/lightdm/lightdm.conf; then
            sed -i '/^\[Seat:\*\]/a xserver-command=X -s 0 -dpms' /etc/lightdm/lightdm.conf 2>/dev/null || true
        fi
    fi
    
    # Create xinitrc for kiosk mode
    cat > "/home/$PI_USER/.xinitrc" << 'EOF'
#!/bin/bash
xset s off
xset -dpms
xset s noblank
unclutter -idle 0.5 -root &
exec /usr/bin/openbox-session
EOF
    chown "$PI_USER:$PI_USER" "/home/$PI_USER/.xinitrc"
    
    # Disable screen saver in Wayland (for Pi 5)
    mkdir -p "/home/$PI_USER/.config/wayfire.ini.d"
    cat > "/home/$PI_USER/.config/wayfire.ini.d/ccms-kiosk.ini" << 'EOF'
[idle]
dpms_timeout = 0
screensaver_timeout = 0
EOF
    chown -R "$PI_USER:$PI_USER" "/home/$PI_USER/.config"
    
    log_info "Display settings configured"
}

set_permissions() {
    log_info "Setting file permissions..."
    
    chown -R "$PI_USER:$PI_USER" "$INSTALL_DIR"
    chmod +x "$INSTALL_DIR/ccms_player.py"
    
    log_info "Permissions set"
}

create_management_scripts() {
    log_info "Creating management scripts..."
    
    # Start script
    cat > "$INSTALL_DIR/start.sh" << EOF
#!/bin/bash
cd "$INSTALL_DIR"
./venv/bin/python ccms_player.py
EOF
    chmod +x "$INSTALL_DIR/start.sh"
    
    # Stop script
    cat > "$INSTALL_DIR/stop.sh" << EOF
#!/bin/bash
sudo systemctl stop $SERVICE_NAME
EOF
    chmod +x "$INSTALL_DIR/stop.sh"
    
    # Restart script
    cat > "$INSTALL_DIR/restart.sh" << EOF
#!/bin/bash
sudo systemctl restart $SERVICE_NAME
EOF
    chmod +x "$INSTALL_DIR/restart.sh"
    
    # Status script
    cat > "$INSTALL_DIR/status.sh" << EOF
#!/bin/bash
echo "=== CCMS Player Status ==="
sudo systemctl status $SERVICE_NAME --no-pager
echo ""
echo "=== Recent Logs ==="
tail -20 "$INSTALL_DIR/logs/player.log"
EOF
    chmod +x "$INSTALL_DIR/status.sh"
    
    # Update config script
    cat > "$INSTALL_DIR/update-config.sh" << 'EOF'
#!/bin/bash
echo "CCMS Player Configuration Update"
echo "================================"

CONFIG_FILE="/home/pi/ccms-player/config.json"

read -p "Enter Screen ID: " SCREEN_ID
read -p "Enter API Key: " API_KEY
read -p "Enter Server URL: " SERVER_URL

cat > "$CONFIG_FILE" << CONF
{
    "screen_id": "$SCREEN_ID",
    "api_key": "$API_KEY",
    "server_url": "$SERVER_URL",
    "cache_dir": "./cache",
    "log_level": "INFO"
}
CONF

echo "Configuration updated. Restarting player..."
sudo systemctl restart ccms-player
EOF
    chmod +x "$INSTALL_DIR/update-config.sh"

    # Update player code script — brings an existing install up to the latest
    # player without re-running full setup. Usage:
    #   scp -r player/raspberrypi pi@<pi>:/home/pi/ccms-player-src
    #   ssh pi@<pi> '/home/pi/ccms-player/update-player.sh /home/pi/ccms-player-src'
    cat > "$INSTALL_DIR/update-player.sh" << EOF
#!/bin/bash
set -e
SRC="\${1:-/home/$PI_USER/ccms-player-src}"
if [[ ! -f "\$SRC/ccms_player.py" ]]; then
    echo "ERROR: \$SRC does not contain ccms_player.py"
    echo "Usage: \$0 /path/to/player/raspberrypi"
    exit 1
fi
echo "Updating player code from \$SRC ..."
cp -p "\$SRC"/*.py "$INSTALL_DIR/"
if [[ -d "\$SRC/mpv_lib" ]]; then
    rm -rf "$INSTALL_DIR/mpv_lib"
    cp -rp "\$SRC/mpv_lib" "$INSTALL_DIR/"
fi
# config.json, data/ (device fingerprint, impression store) and cache/ are untouched.
echo "Restarting player service..."
sudo systemctl restart $SERVICE_NAME
echo "Done. Recent log:"
sleep 3
tail -5 "$INSTALL_DIR/logs/player.log" || true
EOF
    chmod +x "$INSTALL_DIR/update-player.sh"
    
    chown -R "$PI_USER:$PI_USER" "$INSTALL_DIR"
    
    log_info "Management scripts created"
}

print_completion_message() {
    echo ""
    echo -e "${GREEN}╔═══════════════════════════════════════════════════════╗${NC}"
    echo -e "${GREEN}║          Installation Complete!                       ║${NC}"
    echo -e "${GREEN}╚═══════════════════════════════════════════════════════╝${NC}"
    echo ""
    echo -e "${BLUE}Installation Directory:${NC} $INSTALL_DIR"
    echo -e "${BLUE}Service Name:${NC} $SERVICE_NAME"
    echo ""
    echo -e "${YELLOW}Management Commands:${NC}"
    echo "  Start player:    sudo systemctl start $SERVICE_NAME"
    echo "  Stop player:     sudo systemctl stop $SERVICE_NAME"
    echo "  Restart player:  sudo systemctl restart $SERVICE_NAME"
    echo "  View status:     sudo systemctl status $SERVICE_NAME"
    echo "  View logs:       tail -f $INSTALL_DIR/logs/player.log"
    echo ""
    echo -e "${YELLOW}Configuration:${NC}"
    echo "  Config file: $INSTALL_DIR/config.json"
    echo "  Update config: $INSTALL_DIR/update-config.sh"
    echo ""
    echo -e "${YELLOW}Next Steps:${NC}"
    echo "  1. Reboot the Raspberry Pi: sudo reboot"
    echo "  2. The player will start automatically after reboot"
    echo "  3. Verify status with: sudo systemctl status $SERVICE_NAME"
    echo ""
    
    # Handle auto-start or prompt
    if [[ "$AUTO_START" == true ]]; then
        log_info "Auto-starting player..."
        systemctl start "${SERVICE_NAME}.service"
        log_info "Player started!"
        sleep 2
        systemctl status "${SERVICE_NAME}.service" --no-pager || true
    elif [[ "$NO_CONFIRM" != true ]]; then
        read -p "Would you like to start the player now? [Y/n]: " start_now
        if [[ ! "$start_now" =~ ^[Nn] ]]; then
            systemctl start "${SERVICE_NAME}.service"
            log_info "Player started!"
            sleep 2
            systemctl status "${SERVICE_NAME}.service" --no-pager || true
        fi
        
        echo ""
        read -p "Would you like to reboot now? [y/N]: " do_reboot
        if [[ "$do_reboot" =~ ^[Yy] ]]; then
            log_info "Rebooting in 5 seconds..."
            sleep 5
            reboot
        fi
    fi
}

# ============================================
# MAIN INSTALLATION
# ============================================

main() {
    print_banner
    check_root
    check_raspberry_pi
    parse_args "$@"
    prompt_config
    
    log_info "Starting installation..."
    
    install_system_dependencies
    create_user_if_needed
    setup_player_directory
    install_player_files
    create_config_file
    create_systemd_service
    create_autostart_desktop
    configure_display_settings
    set_permissions
    create_management_scripts
    
    print_completion_message
}

# Run main function with all arguments
main "$@"

