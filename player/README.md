# CCMS Raspberry Pi Player

Digital signage content player for Raspberry Pi devices.

## Installation

```bash
# Install system dependencies (Raspberry Pi)
sudo apt-get update
sudo apt-get install -y python3-pip omxplayer vlc

# Install Python dependencies
pip3 install -r requirements.txt
```

## Configuration

Set environment variables:

```bash
export CCMS_API_URL="http://your-server.com"
export DEVICE_ID="your-device-id"
export DEVICE_TOKEN="your-device-token"
export CACHE_DIR="./cache"
```

## Running

```bash
python3 player.py
```

## Auto-start on Boot

Create a systemd service:

```bash
sudo nano /etc/systemd/system/ccms-player.service
```

```ini
[Unit]
Description=CCMS Digital Signage Player
After=network.target

[Service]
Type=simple
User=pi
WorkingDirectory=/home/pi/ccms-player
Environment="CCMS_API_URL=http://your-server.com"
Environment="DEVICE_ID=your-device-id"
Environment="DEVICE_TOKEN=your-token"
ExecStart=/usr/bin/python3 /home/pi/ccms-player/player.py
Restart=always

[Install]
WantedBy=multi-user.target
```

Enable and start:

```bash
sudo systemctl enable ccms-player
sudo systemctl start ccms-player
```

## Features

- Automatic playlist download and caching
- Video playback using OMXPlayer (Raspberry Pi optimized)
- Real-time impression reporting
- File integrity verification (SHA256)
- Automatic reconnection on network issues
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
