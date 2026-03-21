"""
CCMS Raspberry Pi Player
Digital Signage Content Player with Real-time Reporting

This script runs on Raspberry Pi devices to:
1. Connect to CCMS server via WebSocket
2. Download and cache playlist content
3. Play videos in sequence
4. Report impressions in real-time
"""

import os
import sys
import time
import json
import hashlib
import requests
import socketio
import subprocess
from datetime import datetime
from pathlib import Path
import logging

# Load config file
CONFIG_FILE = Path(__file__).parent / "config.json"
with open(CONFIG_FILE, 'r') as f:
    config = json.load(f)

# Configuration
API_BASE_URL = config.get("server_url", "http://localhost:5257")
DEVICE_ID = config.get("screen_id", os.getenv("DEVICE_ID", "YOUR_DEVICE_ID_HERE"))
DEVICE_TOKEN = config.get("api_key", os.getenv("DEVICE_TOKEN", "YOUR_DEVICE_TOKEN_HERE"))
CACHE_DIR = Path(os.getenv("CACHE_DIR", "./cache"))
LOG_FILE = "player.log"

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler(LOG_FILE),
        logging.StreamHandler(sys.stdout)
    ]
)
logger = logging.getLogger(__name__)

# Create cache directory
CACHE_DIR.mkdir(parents=True, exist_ok=True)

class CCMSPlayer:
    def __init__(self):
        self.sio = socketio.Client()
        self.playlist = None
        self.is_playing = False
        self.current_creative = None
        
        # Setup Socket.IO event handlers
        self.sio.on('connect', self.on_connect)
        self.sio.on('disconnect', self.on_disconnect)
        self.sio.on('playlist_update', self.on_playlist_update)
        
    def on_connect(self):
        logger.info("Connected to CCMS server")
        self.handshake()
        
    def on_disconnect(self):
        logger.warning("Disconnected from CCMS server")
        
    def on_playlist_update(self, data):
        logger.info("Received playlist update")
        self.update_playlist(data)
        
    def handshake(self):
        """Perform handshake with server and get today's playlist"""
        try:
            url = f"{API_BASE_URL}/api/player/handshake"
            payload = {
                "screenId": DEVICE_ID,
                "apiKey": DEVICE_TOKEN,
                "playerVersion": "1.0.0"
            }
            
            response = requests.post(url, json=payload, timeout=10)
            response.raise_for_status()
            
            data = response.json()
            if data.get('success'):
                logger.info("Handshake successful")
                playlist_data = data.get('data', {}).get('playlist')
                if playlist_data:
                    self.update_playlist(playlist_data)
            else:
                logger.error(f"Handshake failed: {data.get('message')}")
                
        except Exception as e:
            logger.error(f"Handshake error: {e}")
            
    def get_os_version(self):
        """Get OS version information"""
        try:
            with open('/etc/os-release', 'r') as f:
                for line in f:
                    if line.startswith('PRETTY_NAME='):
                        return line.split('=')[1].strip().strip('"')
        except:
            return "Unknown"
        return "Unknown"
        
    def update_playlist(self, playlist_data):
        """Update current playlist and download new content"""
        self.playlist = playlist_data
        logger.info(f"Playlist updated with {len(playlist_data.get('items', []))} items")
        
        # Download new content
        self.download_playlist_content()
        
    def download_playlist_content(self):
        """Download all playlist videos to cache"""
        if not self.playlist or 'items' not in self.playlist:
            logger.warning("No playlist items to download")
            return
            
        for item in self.playlist['items']:
            file_url = item.get('fileUrl')
            creative_id = item.get('creativeId')
            file_hash = item.get('fileHash')
            
            if not file_url:
                continue
                
            local_path = CACHE_DIR / f"{creative_id}.mp4"
            
            # Check if file exists and hash matches
            if local_path.exists():
                if self.verify_file_hash(local_path, file_hash):
                    logger.info(f"File already cached: {creative_id}")
                    continue
                else:
                    logger.warning(f"Hash mismatch for {creative_id}, re-downloading")
                    
            # Download file
            try:
                logger.info(f"Downloading: {file_url}")
                response = requests.get(file_url, stream=True, timeout=30)
                response.raise_for_status()
                
                with open(local_path, 'wb') as f:
                    for chunk in response.iter_content(chunk_size=8192):
                        f.write(chunk)
                        
                logger.info(f"Downloaded: {creative_id}")
                
                # Verify hash
                if file_hash and not self.verify_file_hash(local_path, file_hash):
                    logger.error(f"Hash verification failed for {creative_id}")
                    local_path.unlink()
                    
            except Exception as e:
                logger.error(f"Download error for {creative_id}: {e}")
                
    def verify_file_hash(self, file_path, expected_hash):
        """Verify file integrity using SHA256 hash"""
        if not expected_hash:
            return True
            
        try:
            sha256 = hashlib.sha256()
            with open(file_path, 'rb') as f:
                for chunk in iter(lambda: f.read(4096), b''):
                    sha256.update(chunk)
            return sha256.hexdigest() == expected_hash
        except:
            return False
            
    def play_content(self):
        """Main playback loop"""
        if not self.playlist or 'items' not in self.playlist:
            logger.warning("No playlist to play")
            return
            
        items = sorted(self.playlist['items'], key=lambda x: x.get('slotPosition', 0))
        
        logger.info(f"Starting playback of {len(items)} items")
        self.is_playing = True
        
        while self.is_playing:
            for item in items:
                if not self.is_playing:
                    break
                    
                creative_id = item.get('creativeId')
                booking_id = item.get('bookingId')
                local_path = CACHE_DIR / f"{creative_id}.mp4"
                
                if not local_path.exists():
                    logger.warning(f"File not found: {creative_id}")
                    continue
                    
                # Report ad started
                self.report_ad_started(booking_id, creative_id)
                
                # Play video
                self.play_video(str(local_path))
                
                # Report ad completed
                self.report_ad_completed(booking_id, creative_id)
                
    def play_video(self, file_path):
        """Play video using OMXPlayer (Raspberry Pi optimized)"""
        try:
            # Try OMXPlayer first (Raspberry Pi)
            subprocess.run(['omxplayer', '-b', '--no-osd', file_path], check=True)
        except (subprocess.CalledProcessError, FileNotFoundError):
            try:
                # Fallback to VLC
                subprocess.run(['cvlc', '--play-and-exit', '--no-video-title-show', 
                              '--fullscreen', file_path], check=True)
            except (subprocess.CalledProcessError, FileNotFoundError):
                logger.error("No video player found (omxplayer or vlc required)")
                time.sleep(5)  # Wait 5 seconds as placeholder
                
    def report_ad_started(self, booking_id, creative_id):
        """Report ad playback started"""
        try:
            # via HTTP for reliability
            url = f"{API_BASE_URL}/api/player/impression"
            payload = {
                "deviceId": DEVICE_ID,
                "bookingId": booking_id,
                "creativeId": creative_id,
                "playTimestamp": datetime.utcnow().isoformat(),
                "playCount": 1
            }
            requests.post(url, json=payload, timeout=5)
            logger.debug(f"Reported ad started: {creative_id}")
        except Exception as e:
            logger.error(f"Error reporting ad started: {e}")
            
    def report_ad_completed(self, booking_id, creative_id):
        """Report ad playback completed"""
        logger.debug(f"Ad completed: {creative_id}")
        
    def connect_and_run(self):
        """Connect to server and start playback"""
        try:
            # Connect via HTTP initially
            self.handshake()
            
            # Start playback
            self.play_content()
            
        except KeyboardInterrupt:
            logger.info("Stopping player...")
            self.stop()
        except Exception as e:
            logger.error(f"Player error: {e}")
            
    def stop(self):
        """Stop playback"""
        self.is_playing = False
        if self.sio.connected:
            self.sio.disconnect()
        logger.info("Player stopped")

def main():
    """Main entry point"""
    logger.info("=" * 50)
    logger.info("CCMS Player Starting")
    logger.info(f"Device ID: {DEVICE_ID}")
    logger.info(f"API URL: {API_BASE_URL}")
    logger.info("=" * 50)
    
    player = CCMSPlayer()
    player.connect_and_run()

if __name__ == "__main__":
    main()
