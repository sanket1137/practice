# CCMS Raspberry Pi Player Setup Guide

## Overview

This guide covers setting up the CCMS Player on a Raspberry Pi to display digital signage content from your CCMS backend.

---

## Hardware Requirements

### Recommended
- **Raspberry Pi 4** (4GB+ RAM)
- **MicroSD Card**: 32GB+ Class 10
- **Display**: HDMI-connected screen/TV
- **Network**: Ethernet (recommended) or WiFi
- **Power**: Official Raspberry Pi power supply

### Minimum
- Raspberry Pi 3B+ (2GB RAM)
- 16GB MicroSD Card
- Any HDMI display

---

## Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                     RASPBERRY PI                             │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │                   CCMS PLAYER                           │ │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────────┐  │ │
│  │  │   Player    │  │   Cache     │  │  Default Video  │  │ │
│  │  │   Manager   │  │   Manager   │  │    Manager      │  │ │
│  │  └──────┬──────┘  └──────┬──────┘  └────────┬────────┘  │ │
│  │         │                │                   │          │ │
│  │  ┌──────▼────────────────▼───────────────────▼───────┐  │ │
│  │  │                    MPV PLAYER                     │  │ │
│  │  │              (Hardware Accelerated)               │  │ │
│  │  └───────────────────────────────────────────────────┘  │ │
│  └─────────────────────────────────────────────────────────┘ │
│                              │                               │
└──────────────────────────────┼───────────────────────────────┘
                               │ HTTPS/SignalR
                    ┌──────────▼──────────┐
                    │    CCMS BACKEND     │
                    │  api.ccms.domain    │
                    └──────────┬──────────┘
                               │
                    ┌──────────▼──────────┐
                    │   CLOUDFLARE R2     │
                    │   (Video Storage)   │
                    └─────────────────────┘
```

---

## Installation Steps

### Step 1: Flash Raspberry Pi OS

1. Download [Raspberry Pi Imager](https://www.raspberrypi.com/software/)
2. Select **Raspberry Pi OS Lite (64-bit)**
3. Click gear icon for advanced options:
   - Enable SSH
   - Set username: `pi`
   - Set password: `your_secure_password`
   - Configure WiFi (if not using Ethernet)
   - Set locale/timezone

4. Flash to SD card and boot the Pi

### Step 2: Initial Configuration

SSH into the Raspberry Pi:
```bash
ssh pi@YOUR_PI_IP
```

Update the system:
```bash
sudo apt update && sudo apt upgrade -y
```

Configure boot options:
```bash
sudo raspi-config
```
- Set **Boot Options** → **Desktop / CLI** → **Console Autologin**
- Set **Display Options** → **Underscan** → Disable (if needed)
- Finish and reboot

### Step 3: Install Dependencies

```bash
# Install required packages
sudo apt install -y \
    python3 \
    python3-pip \
    python3-venv \
    mpv \
    git \
    curl \
    libmpv-dev

# Verify installations
python3 --version
mpv --version
```

### Step 4: Clone/Copy Player Files

```bash
# Create player directory
mkdir -p ~/ccms-player
cd ~/ccms-player

# Option A: Copy files via SCP (from your local machine)
# scp -r player/* pi@YOUR_PI_IP:~/ccms-player/

# Option B: If you have git access
# git clone YOUR_REPO/player .
```

### Step 5: Setup Python Environment

```bash
cd ~/ccms-player

# Create virtual environment
python3 -m venv venv
source venv/bin/activate

# Install requirements
pip install --upgrade pip
pip install -r requirements.txt
```

### Step 6: Configure the Player

1. Copy and edit the configuration:
```bash
cp config.json.template config.json
nano config.json
```

2. Update with your settings:
```json
{
  "api_base_url": "https://api.ccms.yourdomain.com",
  "screen_id": "YOUR_SCREEN_ID",
  "api_key": "YOUR_SCREEN_API_KEY",
  "cache_dir": "/home/pi/ccms-player/cache",
  "log_dir": "/home/pi/ccms-player/logs",
  "default_video_path": "/home/pi/ccms-player/default_video.mp4",
  "refresh_interval_seconds": 300,
  "signalr_enabled": true,
  "hardware_acceleration": true,
  "fullscreen": true,
  "display": ":0"
}
```

### Step 7: Get Screen Credentials

1. Log in to CCMS admin panel
2. Go to **Screens** → Select your screen
3. Copy the **Screen ID** and **API Key**
4. Update `config.json` with these values

### Step 8: Test the Player

```bash
cd ~/ccms-player
source venv/bin/activate

# Test API connection
python3 -c "import requests; print(requests.get('https://api.ccms.yourdomain.com/health').status_code)"

# Run player (with display)
export DISPLAY=:0
python3 ccms_player.py
```

### Step 9: Setup Auto-Start Service

Create systemd service:
```bash
sudo nano /etc/systemd/system/ccms-player.service
```

Add this content:
```ini
[Unit]
Description=CCMS Digital Signage Player
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=pi
WorkingDirectory=/home/pi/ccms-player
Environment=DISPLAY=:0
ExecStart=/home/pi/ccms-player/venv/bin/python3 /home/pi/ccms-player/ccms_player.py
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

Enable the service:
```bash
sudo systemctl daemon-reload
sudo systemctl enable ccms-player.service
sudo systemctl start ccms-player.service

# Check status
sudo systemctl status ccms-player.service

# View logs
journalctl -u ccms-player.service -f
```

---

## Automated Setup Script

For convenience, run the automated setup script:

```bash
# Download and run setup script
curl -sSL https://raw.githubusercontent.com/YOUR_REPO/player/setup-raspberry-pi.sh | bash
```

Or manually:
```bash
cd ~/ccms-player
chmod +x setup-raspberry-pi.sh
./setup-raspberry-pi.sh
```

---

## Display Configuration

### For HDMI Displays

Edit boot config:
```bash
sudo nano /boot/config.txt
```

Add/modify these lines:
```ini
# Force HDMI output
hdmi_force_hotplug=1
hdmi_group=1
hdmi_mode=16  # 1080p 60Hz

# Disable screen blanking
hdmi_blanking=0

# GPU memory (256MB for video playback)
gpu_mem=256

# Enable hardware acceleration
dtoverlay=vc4-kms-v3d
```

### Disable Screen Blanking

```bash
# Disable screen saver
sudo nano /etc/xdg/lxsession/LXDE-pi/autostart
```

Add:
```
@xset s off
@xset -dpms
@xset s noblank
```

Or via console:
```bash
sudo nano /etc/rc.local
```

Add before `exit 0`:
```bash
/usr/bin/setterm -blank 0 -powerdown 0
```

---

## Network Configuration

### Static IP (Recommended)

```bash
sudo nano /etc/dhcpcd.conf
```

Add:
```
interface eth0
static ip_address=192.168.1.100/24
static routers=192.168.1.1
static domain_name_servers=8.8.8.8 8.8.4.4
```

### WiFi Configuration

```bash
sudo nano /etc/wpa_supplicant/wpa_supplicant.conf
```

```
country=IN
ctrl_interface=DIR=/var/run/wpa_supplicant GROUP=netdev
update_config=1

network={
    ssid="YOUR_WIFI_SSID"
    psk="YOUR_WIFI_PASSWORD"
    priority=1
}
```

---

## Player Features

### 1. Content Caching
- Videos are cached locally for offline playback
- Automatic cleanup of old content
- Configurable cache size limit

### 2. Default Video Fallback
- Plays when no scheduled content
- Plays during network outages
- Configurable default video path

### 3. SignalR Real-Time Updates
- Instant content updates
- Remote control commands
- Status reporting to backend

### 4. Hardware Acceleration
- Uses Raspberry Pi GPU for smooth playback
- Supports H.264/H.265 decoding
- Low CPU usage during playback

---

## Maintenance Commands

### Service Management
```bash
# Start player
sudo systemctl start ccms-player

# Stop player
sudo systemctl stop ccms-player

# Restart player
sudo systemctl restart ccms-player

# View status
sudo systemctl status ccms-player

# View logs
journalctl -u ccms-player -f --no-pager
```

### Manual Testing
```bash
cd ~/ccms-player
source venv/bin/activate
export DISPLAY=:0

# Run with verbose logging
python3 ccms_player.py --verbose

# Test specific video
mpv --fullscreen --loop /path/to/video.mp4
```

### Cache Management
```bash
# View cache size
du -sh ~/ccms-player/cache/

# Clear cache
rm -rf ~/ccms-player/cache/*

# View logs
tail -f ~/ccms-player/logs/player.log
```

### System Monitoring
```bash
# CPU/Memory usage
htop

# Temperature
vcgencmd measure_temp

# Disk space
df -h

# Network status
ip addr
ping api.ccms.yourdomain.com
```

---

## Troubleshooting

### 1. No Display Output
```bash
# Check HDMI settings
tvservice -s

# Force HDMI mode
tvservice -p

# Check X display
echo $DISPLAY
export DISPLAY=:0
```

### 2. Video Not Playing
```bash
# Test MPV manually
mpv --fullscreen test_video.mp4

# Check hardware acceleration
mpv --hwdec=auto --vo=gpu test_video.mp4

# Verify video format
ffprobe video.mp4
```

### 3. Network Issues
```bash
# Test connectivity
ping -c 4 google.com
ping -c 4 api.ccms.yourdomain.com

# Test API
curl -I https://api.ccms.yourdomain.com/health

# Check DNS
nslookup api.ccms.yourdomain.com
```

### 4. Service Won't Start
```bash
# Check service logs
journalctl -u ccms-player -n 100 --no-pager

# Check permissions
ls -la ~/ccms-player/

# Test Python script
cd ~/ccms-player
source venv/bin/activate
python3 ccms_player.py
```

### 5. Memory Issues
```bash
# Check memory
free -h

# Increase swap (if needed)
sudo dphys-swapfile swapoff
sudo nano /etc/dphys-swapfile  # Set CONF_SWAPSIZE=1024
sudo dphys-swapfile setup
sudo dphys-swapfile swapon
```

---

## Remote Management

### SSH Access
```bash
ssh pi@YOUR_PI_IP
```

### Remote Reboot
```bash
ssh pi@YOUR_PI_IP "sudo reboot"
```

### Update Player Remotely
```bash
# From your local machine
scp -r player/* pi@YOUR_PI_IP:~/ccms-player/
ssh pi@YOUR_PI_IP "sudo systemctl restart ccms-player"
```

### Remote Screenshot
```bash
ssh pi@YOUR_PI_IP "DISPLAY=:0 scrot /tmp/screenshot.png"
scp pi@YOUR_PI_IP:/tmp/screenshot.png ./
```

---

## Security Recommendations

1. **Change Default Password**
   ```bash
   passwd
   ```

2. **Use SSH Keys**
   ```bash
   ssh-keygen -t ed25519
   ssh-copy-id pi@YOUR_PI_IP
   ```

3. **Disable Password Authentication**
   ```bash
   sudo nano /etc/ssh/sshd_config
   # Set: PasswordAuthentication no
   sudo systemctl restart ssh
   ```

4. **Keep System Updated**
   ```bash
   sudo apt update && sudo apt upgrade -y
   ```

5. **Firewall (Optional)**
   ```bash
   sudo apt install ufw
   sudo ufw allow ssh
   sudo ufw enable
   ```

---

## Registering a New Screen

1. **In CCMS Admin Panel:**
   - Go to **Screens** → **Add New Screen**
   - Enter screen name and location
   - Save and copy the **Screen ID** and **API Key**

2. **On Raspberry Pi:**
   ```bash
   nano ~/ccms-player/config.json
   # Update screen_id and api_key
   sudo systemctl restart ccms-player
   ```

3. **Verify Connection:**
   - Check screen status in CCMS admin panel
   - Should show "Online" with last heartbeat time

---

## Performance Optimization

### 1. Overclock (Optional)
```bash
sudo nano /boot/config.txt
```
Add:
```ini
over_voltage=6
arm_freq=2000
gpu_freq=700
```

### 2. Reduce Memory Usage
- Use Raspberry Pi OS Lite (no desktop)
- Disable unused services
- Limit cache size in config

### 3. Video Format Recommendations
- **Codec**: H.264 (best compatibility)
- **Resolution**: Match display (1080p typical)
- **Bitrate**: 5-10 Mbps
- **Container**: MP4

---

## Support

For issues:
1. Check player logs: `journalctl -u ccms-player -f`
2. Verify screen status in CCMS admin panel
3. Test network connectivity to backend
4. Ensure API key is correct in config.json
