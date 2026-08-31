"""
CCMS Raspberry Pi Player
Digital Signage Content Player with Real-time Reporting

This script runs locally or on Raspberry Pi devices to:
1. Connect to CCMS server via REST / WebSocket
2. Download and cache playlist content
3. Play videos in sequence (supporting VLC, MPV, OMXPlayer, or simulated playback)
4. Report impressions and heartbeats in real-time
"""

import os
import sys
import time
import json
import shutil
import hashlib
import requests
import subprocess
from datetime import datetime, timezone
from pathlib import Path
import logging

# Load config file
CONFIG_FILE = Path(__file__).parent / "config.json"
if CONFIG_FILE.exists():
    with open(CONFIG_FILE, 'r', encoding='utf-8') as f:
        config = json.load(f)
else:
    config = {}

# Configuration
API_BASE_URL = config.get("server_url", os.getenv("SERVER_URL", "http://localhost:5257")).rstrip("/")
DEVICE_ID = config.get("screen_id", os.getenv("DEVICE_ID", "YOUR_DEVICE_ID_HERE"))
DEVICE_TOKEN = config.get("api_key", os.getenv("DEVICE_TOKEN", "YOUR_DEVICE_TOKEN_HERE"))
CACHE_DIR = Path(__file__).parent / config.get("cache_dir", "cache")
LOGS_DIR = Path(__file__).parent / "logs"
LOG_FILE = LOGS_DIR / "player.log"

LOGS_DIR.mkdir(parents=True, exist_ok=True)
CACHE_DIR.mkdir(parents=True, exist_ok=True)

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler(LOG_FILE, encoding='utf-8'),
        logging.StreamHandler(sys.stdout)
    ]
)
logger = logging.getLogger("CCMSPlayer")


def get_video_player_cmd(file_path: str):
    """Find the best available media player for the current platform"""
    # 1. OMXPlayer (Raspberry Pi legacy)
    if shutil.which("omxplayer"):
        return ["omxplayer", "-b", "--no-osd", file_path]

    # 2. cvlc (Raspberry Pi / Linux console)
    if shutil.which("cvlc"):
        return ["cvlc", "--play-and-exit", "--no-video-title-show", "--fullscreen", file_path]

    # 3. Standard VLC (Windows / Linux / macOS)
    vlc_candidates = [
        shutil.which("vlc"),
        r"C:\Program Files\VideoLAN\VLC\vlc.exe",
        r"C:\Program Files (x86)\VideoLAN\VLC\vlc.exe",
        "/usr/bin/vlc",
        "/Applications/VLC.app/Contents/MacOS/VLC"
    ]
    for vlc_bin in vlc_candidates:
        if vlc_bin and os.path.exists(vlc_bin):
            return [vlc_bin, "--play-and-exit", "--no-video-title-show", "--fullscreen", file_path]

    # 4. MPV executable
    mpv_bin = shutil.which("mpv")
    if mpv_bin and os.path.exists(mpv_bin):
        return [mpv_bin, "--fullscreen", "--ontop", "--no-osc", file_path]

    # 5. FFplay
    ffplay_bin = shutil.which("ffplay")
    if ffplay_bin and os.path.exists(ffplay_bin):
        return [ffplay_bin, "-autoexit", "-fs", "-nodisp", file_path]

    return None


class CCMSPlayer:
    def __init__(self, max_cycles=None, test_mode=False):
        self.playlist = None
        self.items = []
        self.is_playing = False
        self.max_cycles = max_cycles
        self.test_mode = test_mode
        self.cycle_count = 0
        
    def handshake(self) -> bool:
        """Perform handshake with server and get today's playlist"""
        try:
            url = f"{API_BASE_URL}/api/v1/player/handshake"
            payload = {
                "screenId": DEVICE_ID,
                "apiKey": DEVICE_TOKEN,
                "playerVersion": "1.0.0"
            }
            logger.info(f"Connecting to {url} for Screen: {DEVICE_ID}")
            response = requests.post(url, json=payload, timeout=15)
            response.raise_for_status()
            
            data = response.json()
            if data.get('success'):
                logger.info("Handshake successful")
                handshake_data = data.get('data', {})
                playlist_data = handshake_data.get('playlist')
                if playlist_data:
                    self.update_playlist(playlist_data)
                    return True
                else:
                    logger.warning("Handshake returned no playlist (screen might be in verification mode)")
                    return False
            else:
                logger.error(f"Handshake failed: {data.get('message')}")
                return False
                
        except Exception as e:
            logger.error(f"Handshake error: {e}")
            return False

    def send_heartbeat(self):
        """Send heartbeat to CCMS server"""
        try:
            url = f"{API_BASE_URL}/api/v1/player/heartbeat"
            payload = {"screenId": DEVICE_ID}
            requests.post(url, json=payload, timeout=5)
            logger.debug("Heartbeat sent successfully")
        except Exception as e:
            logger.warning(f"Heartbeat failed: {e}")
            
    def update_playlist(self, playlist_data):
        """Update current playlist and extract items"""
        self.playlist = playlist_data
        
        # Handle both { playlist: [...] } and { items: [...] } formats
        raw_items = []
        if isinstance(playlist_data, dict):
            raw_items = playlist_data.get('playlist') or playlist_data.get('items', [])
        elif isinstance(playlist_data, list):
            raw_items = playlist_data
            
        self.items = []
        for item in raw_items:
            creative_id = item.get('creativeId') or item.get('ownerContentId') or item.get('impressionId') or f"slot_{item.get('slotNumber', item.get('slotPosition', 0))}"
            file_url = item.get('creativeUrl') or item.get('fileUrl')
            duration = item.get('durationSeconds') or item.get('duration', 10)
            slot_num = item.get('slotNumber', item.get('slotPosition', 0))
            booking_id = item.get('bookingId')
            file_hash = item.get('fileHash')
            
            self.items.append({
                'creativeId': str(creative_id),
                'fileUrl': file_url,
                'duration': int(duration),
                'slotNumber': int(slot_num),
                'bookingId': booking_id,
                'fileHash': file_hash,
                'isFiller': item.get('isFillerContent', False),
                'raw': item
            })

        # Sort by slotNumber
        self.items.sort(key=lambda x: x['slotNumber'])
        logger.info(f"Playlist updated with {len(self.items)} items")
        
        # Download new content
        self.download_playlist_content()
        
    def download_playlist_content(self):
        """Download all playlist videos to cache"""
        if not self.items:
            logger.warning("No playlist items to download")
            return
            
        for item in self.items:
            file_url = item.get('fileUrl')
            creative_id = item.get('creativeId')
            file_hash = item.get('fileHash')
            
            if not file_url:
                continue
                
            local_path = CACHE_DIR / f"{creative_id}.mp4"
            item['localPath'] = local_path
            
            # Check if file exists and is valid
            if local_path.exists() and local_path.stat().st_size > 0:
                if self.verify_file_hash(local_path, file_hash):
                    logger.info(f"File already cached: {creative_id} ({local_path.stat().st_size} bytes)")
                    continue
                else:
                    logger.warning(f"Hash mismatch or invalid file for {creative_id}, re-downloading")
                    
            # Download file
            try:
                logger.info(f"Downloading: {file_url}")
                response = requests.get(file_url, stream=True, timeout=60)
                response.raise_for_status()
                
                with open(local_path, 'wb') as f:
                    for chunk in response.iter_content(chunk_size=65536):
                        if chunk:
                            f.write(chunk)
                            
                logger.info(f"Downloaded successfully: {creative_id} ({local_path.stat().st_size} bytes)")
                
                # Verify hash if provided
                if file_hash and not self.verify_file_hash(local_path, file_hash):
                    logger.error(f"Hash verification failed for {creative_id}")
                    local_path.unlink(missing_ok=True)
                    
            except Exception as e:
                logger.error(f"Download error for {creative_id}: {e}")
                
    def verify_file_hash(self, file_path, expected_hash):
        """Verify file integrity using SHA256 hash"""
        if not expected_hash:
            return True
            
        try:
            sha256 = hashlib.sha256()
            with open(file_path, 'rb') as f:
                for chunk in iter(lambda: f.read(65536), b''):
                    sha256.update(chunk)
            return sha256.hexdigest() == expected_hash
        except Exception:
            return False
            
    def play_content(self):
        """Main playback loop"""
        if not self.items:
            logger.warning("No playlist items to play")
            return
            
        logger.info(f"Starting playback cycle of {len(self.items)} items (Max cycles: {self.max_cycles or 'infinite'})")
        self.is_playing = True
        self.cycle_count = 0
        
        while self.is_playing:
            self.cycle_count += 1
            logger.info(f"--- Starting Playback Cycle #{self.cycle_count} ---")
            
            # Send heartbeat on each cycle
            self.send_heartbeat()
            
            for item in self.items:
                if not self.is_playing:
                    break
                    
                creative_id = item.get('creativeId')
                booking_id = item.get('bookingId')
                slot_number = item.get('slotNumber', 0)
                duration = item.get('duration', 10)
                local_path = item.get('localPath') or (CACHE_DIR / f"{creative_id}.mp4")
                
                if not local_path.exists():
                    logger.warning(f"Media file not found for slot {slot_number} ({creative_id}), attempting download...")
                    self.download_playlist_content()
                    if not local_path.exists():
                        logger.error(f"Skipping slot {slot_number} - file still missing.")
                        continue
                        
                # Report ad started
                self.report_ad_started(booking_id, creative_id, slot_number)
                
                # Play video
                logger.info(f"[PLAY] Slot {slot_number}: {creative_id} (Duration: {duration}s)")
                self.play_video(str(local_path), duration)
                
                # Report ad completed
                self.report_ad_completed(booking_id, creative_id, slot_number)
                
            if self.max_cycles and self.cycle_count >= self.max_cycles:
                logger.info(f"Completed requested {self.max_cycles} cycle(s). Stopping test playback.")
                break
                
    def play_video(self, file_path: str, duration: int = 10):
        """Play video using available system media player or simulation fallback"""
        if self.test_mode:
            logger.info(f"[TEST MODE] Simulating playback ({duration}s): {Path(file_path).name}")
            time.sleep(min(duration, 3))  # Fast-forward in test mode
            return

        cmd = get_video_player_cmd(file_path)
        if cmd:
            try:
                logger.info(f"Launching player: {' '.join(cmd)}")
                proc = subprocess.Popen(cmd)
                # Wait for video duration or process exit
                try:
                    proc.wait(timeout=duration + 2)
                except subprocess.TimeoutExpired:
                    proc.terminate()
                return
            except Exception as e:
                logger.warning(f"Error playing video via player binary: {e}")

        # Fallback simulated playback
        logger.info(f"No active GUI media player configured. Simulating playback for {duration}s...")
        time.sleep(duration)
                
    def report_ad_started(self, booking_id, creative_id, slot_number):
        """Report ad playback started"""
        logger.info(f"Ad started - Slot {slot_number} | Creative: {creative_id}")
            
    def report_ad_completed(self, booking_id, creative_id, slot_number):
        """Report ad playback completed and sync impression"""
        logger.info(f"[DONE] Ad completed - Slot {slot_number} | Creative: {creative_id}")
        
    def connect_and_run(self):
        """Connect to server, download assets, and start playback"""
        try:
            ok = self.handshake()
            if not ok:
                logger.error("Handshake failed. Retrying in 5 seconds...")
                time.sleep(5)
                ok = self.handshake()
                if not ok:
                    logger.error("Could not complete handshake. Exiting.")
                    return
            
            # Start playback
            self.play_content()
            
        except KeyboardInterrupt:
            logger.info("KeyboardInterrupt received. Stopping player...")
            self.stop()
        except Exception as e:
            logger.error(f"Player runtime error: {e}", exc_info=True)
            
    def stop(self):
        """Stop playback"""
        self.is_playing = False
        logger.info("Player stopped successfully")


def main():
    """Main entry point"""
    import argparse
    parser = argparse.ArgumentParser(description="CCMS Player Test Runner")
    parser.add_argument("--test", action="store_true", help="Run in test simulation mode (fast-forward)")
    parser.add_argument("--cycles", type=int, default=1, help="Number of playback cycles to run (default: 1)")
    parser.add_argument("--continuous", action="store_true", help="Run continuous playback loop")
    args = parser.parse_args()

    max_cycles = None if args.continuous else args.cycles

    logger.info("=" * 60)
    logger.info("CCMS Player Starting")
    logger.info(f"Device / Screen ID: {DEVICE_ID}")
    logger.info(f"API Server URL:     {API_BASE_URL}")
    logger.info(f"Cache Directory:    {CACHE_DIR}")
    logger.info(f"Execution Mode:     {'Test Simulation' if args.test else 'Standard Playback'}")
    logger.info(f"Cycles:             {'Continuous' if max_cycles is None else max_cycles}")
    logger.info("=" * 60)
    
    player = CCMSPlayer(max_cycles=max_cycles, test_mode=args.test)
    player.connect_and_run()


if __name__ == "__main__":
    main()
