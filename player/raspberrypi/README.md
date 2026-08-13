# CCMS Raspberry Pi Player

Digital signage content player for Raspberry Pi devices.

## Quick Install (Raspberry Pi 5 - Single Command)

**Tested on:** Raspberry Pi 5 with Raspberry Pi OS (Debian Trixie/Bookworm)

### Fully Automated Installation (Recommended)

```bash
# Copy setup script to Pi and run with all parameters
sudo ./setup-raspberry-pi.sh \
  --screen-id YOUR_SCREEN_ID \
  --api-key YOUR_API_KEY \
  --server http://your-ccms-server.com \
  --no-confirm \
  --auto-start
```

### Interactive Installation

```bash
# Will prompt for Screen ID, API Key, and Server URL
sudo ./setup-raspberry-pi.sh
```

### Remote Installation (from URL)

```bash
# Interactive
curl -sSL https://your-server.com/player/setup-raspberry-pi.sh | sudo bash

# Fully automated
curl -sSL https://your-server.com/player/setup-raspberry-pi.sh | sudo bash -s -- \
  --screen-id YOUR_SCREEN_ID \
  --api-key YOUR_API_KEY \
  --server http://your-ccms-server.com \
  -y --auto-start
```

### Setup Script Options

| Option | Description |
|--------|-------------|
| `--screen-id ID` | Screen ID from CCMS dashboard (required) |
| `--api-key KEY` | API key for authentication (required) |
| `--server URL` | CCMS server URL (default: http://localhost:5257) |
| `--user USER` | Linux user to run player (default: pi) |
| `--install-dir DIR` | Installation directory (default: /home/pi/ccms-player) |
| `--no-confirm`, `-y` | Skip confirmation prompts (for automated installs) |
| `--auto-start` | Automatically start the player after installation |
| `--help` | Show help message |

## After Installation

### Management Commands

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
tail -f /home/pi/ccms-player/logs/player.log
```

### Configuration

Config file location: `/home/pi/ccms-player/config.json`

```json
{
    "screen_id": "YOUR_SCREEN_ID",
    "api_key": "YOUR_API_KEY",
    "server_url": "http://your-server.com",
    "cache_dir": "./cache",
    "log_level": "INFO"
}
```

To update configuration:
```bash
/home/pi/ccms-player/update-config.sh
```

## Manual Installation

```bash
# Install system dependencies (Raspberry Pi OS Trixie/Bookworm)
sudo apt-get update
sudo apt-get install -y python3-pip python3-venv vlc ffmpeg libopencv-dev libopenblas-dev

# Create virtual environment
python3 -m venv venv
source venv/bin/activate

# Install Python dependencies
pip install -r requirements.txt
```

## Features

- Automatic playlist download and caching
- Video playback using VLC (Raspberry Pi optimized)
- Real-time impression reporting
- WebRTC live streaming support
- File integrity verification (SHA256)
- Automatic reconnection on network issues
- Kiosk mode (screen blanking disabled, cursor hidden)
- Auto-start on boot via systemd
- Logging to file and console

## Troubleshooting

View logs:
```bash
tail -f player.log
```

Check service status:
```bash
sudo systemctl status ccms-player
```
