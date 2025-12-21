"""
CCMS Player Client - HTTP REST API Version
Connects to CCMS backend via HTTP REST endpoints
Syncs impression data every 10 minutes
Sends heartbeat every 30 seconds
"""

import asyncio
import json
import sys
from datetime import datetime, timedelta
from pathlib import Path
from collections import defaultdict
import logging

try:
    import requests
    import vlc
    from signalrcore.hub_connection_builder import HubConnectionBuilder
except ImportError as e:
    print(f"Missing dependency: {e}")
    print("Install with: pip install -r requirements.txt")
    sys.exit(1)

# Configuration
class Config:
    SCREEN_ID = ""
    API_KEY = ""
    API_URL = "http://localhost:5257"
    
    BASE_DIR = Path(__file__).parent
    CACHE_DIR = BASE_DIR / "cache"
    LOGS_DIR = BASE_DIR / "logs"
    
    SYNC_INTERVAL_MINUTES = 10
    HEARTBEAT_INTERVAL_SECONDS = 30
    PLAYER_VERSION = "1.0.0"
    
    @classmethod
    def load_config(cls):
        """Load configuration from config.json"""
        config_file = cls.BASE_DIR / "config.json"
        if config_file.exists():
            with open(config_file) as f:
                config = json.load(f)
                cls.SCREEN_ID = config.get("screen_id", cls.SCREEN_ID)
                cls.API_KEY = config.get("api_key", cls.API_KEY)
                cls.API_URL = config.get("server_url", cls.API_URL)
                cls.SYNC_INTERVAL_MINUTES = config.get("sync_interval_minutes", cls.SYNC_INTERVAL_MINUTES)

# Setup
Config.load_config()
Config.LOGS_DIR.mkdir(exist_ok=True)
Config.CACHE_DIR.mkdir(exist_ok=True)

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler(Config.LOGS_DIR / f"player_{datetime.now():%Y%m%d}.log"),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger("CCMSPlayer")


class CCMSPlayer:
    def __init__(self):
        self.screen_id = Config.SCREEN_ID
        self.api_key = Config.API_KEY
        self.api_url = Config.API_URL
        self.playlist = []
        self.current_index = 0
        self.is_running = False
        
        # SignalR connection
        self.signalr_connection = None
        self.signalr_connected = False
        
        # Track impressions for sync
        self.session_data = {
            'date': datetime.now().date(),
            'start_time': datetime.now(),
            'campaign_impressions': defaultdict(lambda: {
                'booking_id': None,
                'campaign_id': None,
                'creative_id': None,
                'play_timestamps': []
            })
        }
        
        logger.info(f"CCMS Player initialized")
        logger.info(f"Screen ID: {self.screen_id}")
        logger.info(f"Server: {self.api_url}")
    
    def handshake(self):
        """Perform handshake with server"""
        try:
            logger.info("Performing handshake...")
            
            response = requests.post(
                f"{self.api_url}/api/player/handshake",
                json={
                    "screenId": self.screen_id,
                    "apiKey": self.api_key,
                    "playerVersion": Config.PLAYER_VERSION
                },
                timeout=10
            )
            
            if response.status_code == 200:
                data = response.json().get("data", {})
                if data.get("success"):
                    logger.info("[OK] Handshake successful!")
                    logger.info(f"  Server time: {data.get('serverTime')}")
                    
                    playlist_data = data.get("playlist")
                    if playlist_data and isinstance(playlist_data, dict):
                        self.playlist = playlist_data.get("playlist", [])
                        logger.info(f"[OK] Playlist received: {len(self.playlist)} items")
                    else:
                        logger.warning("No playlist in handshake response")
                        self.playlist = []
                    
                    sync_interval = data.get("syncIntervalMinutes", 10)
                    Config.SYNC_INTERVAL_MINUTES = sync_interval
                    logger.info(f"  Sync interval: {sync_interval} minutes")
                    
                    return True
                else:
                    logger.error(f"Hand shake failed: {data.get('message')}")
                    return False
            else:
                logger.error(f"Handshake HTTP error: {response.status_code}")
                logger.error(response.text)
                return False
                
        except Exception as e:
            logger.error(f"Handshake error: {e}")
            return False
    
    def send_heartbeat(self):
        """Send heartbeat to maintain online status"""
        try:
            response = requests.post(
                f"{self.api_url}/api/player/heartbeat",
                json={"screenId": self.screen_id},
                timeout=5
            )
            
            if response.status_code == 200:
                return True
            else:
                logger.warning(f"Heartbeat failed: {response.status_code}")
                return False
                
        except Exception as e:
            logger.error(f"Heartbeat error: {e}")
            return False
    
    def sync_daily_data(self):
        """Sync accumulated data to server"""
        try:
            logger.info("Syncing daily data to server...")
            
            now = datetime.now()
            session_duration = now - self.session_data['start_time']
            
            # Build campaign impressions summary
            campaign_impressions = []
            for key, data in self.session_data['campaign_impressions'].items():
                if data['play_timestamps']:
                    campaign_impressions.append({
                        'bookingId': str(data['booking_id']),
                        'campaignId': str(data['campaign_id']),
                        'creativeId': str(data['creative_id']),
                        'totalSlotsRan': len(data['play_timestamps']),
                        'playTimestamps': [ts.isoformat() for ts in data['play_timestamps']]
                    })
            
            sync_data = {
                'date': self.session_data['date'].isoformat(),
                'startTime': self.session_data['start_time'].strftime("%H:%M:%S"),
                'endTime': now.strftime("%H:%M:%S"),
                'uptime': str(session_duration),
                'downtime': "00:00:00",
                'campaignImpressions': campaign_impressions
            }
            
            logger.info(f"Syncing {len(campaign_impressions)} campaign summaries...")
            
            response = requests.post(
                f"{self.api_url}/api/player/sync",
                json={
                    "screenId": self.screen_id,
                    "syncData": sync_data
                },
                timeout=30
            )
            
            if response.status_code == 200:
                data = response.json().get("data", {})
                if data.get("success"):
                    logger.info(f"[OK] Sync successful! {data.get('impressionsSaved')} impressions saved")
                    self.session_data['campaign_impressions'].clear()
                    return True
                else:
                    logger.error(f"Sync failed: {data.get('message')}")
                    return False
            else:
                logger.error(f"Sync HTTP error: {response.status_code}")
                return False
                
        except Exception as e:
            logger.error(f"Sync error: {e}")
            return False
    
    def record_impression(self, item):
        """Record impression locally for later sync"""
        campaign_id = item.get("campaignId")
        if not campaign_id:
            return
        
        key = f"{campaign_id}_{item.get('creativeId')}"
        
        self.session_data['campaign_impressions'][key]['booking_id'] = item.get("bookingId")
        self.session_data['campaign_impressions'][key]['campaign_id'] = campaign_id
        self.session_data['campaign_impressions'][key]['creative_id'] = item.get("creativeId")
        self.session_data['campaign_impressions'][key]['play_timestamps'].append(datetime.now())
        
        logger.debug(f"Recorded impression for {key}")
    
    def connect_signalr(self):
        """Connect to SignalR PlaybackHub for real-time events"""
        try:
            hub_url = f"{self.api_url}/hubs/playback"
            logger.info(f"Connecting to SignalR PlaybackHub: {hub_url}")
            
            self.signalr_connection = HubConnectionBuilder() \
                .with_url(hub_url) \
                .with_automatic_reconnect({
                    "type": "interval",
                    "intervals": [1, 2, 5, 10, 30]
                }).build()
            
            # Connection handlers
            self.signalr_connection.on_open(lambda: self._on_signalr_open())
            self.signalr_connection.on_close(lambda: self._on_signalr_close())
            self.signalr_connection.on_error(lambda msg: logger.error(f"SignalR error: {msg}"))
            
            # Start connection
            self.signalr_connection.start()
            logger.info("SignalR connection initiated")
            
        except Exception as e:
            logger.error(f"Failed to connect to SignalR: {e}")
            self.signalr_connected = False
    
    def _on_signalr_open(self):
        """Called when SignalR connection opens"""
        logger.info("✓ Connected to SignalR PlaybackHub")
        self.signalr_connected = True
    
    def _on_signalr_close(self):
        """Called when SignalR connection closes"""
        logger.warning("SignalR connection closed")
        self.signalr_connected = False
    
    def emit_ad_started(self, item):
        """Emit AdStarted event to SignalR"""
        if not self.signalr_connected or not self.signalr_connection:
            return
        
        try:
            event_data = {
                "CreativeId": str(item.get("creativeId", "")),
                "BookingId": str(item.get("bookingId", "")),
                "ScreenId": str(self.screen_id),
                "CampaignId": str(item.get("campaignId", "")),
                "Timestamp": datetime.now().isoformat(),
                "DeviceId": f"player-{self.screen_id[:8]}"
            }
            
            self.signalr_connection.send("AdStarted", [event_data])
            logger.debug(f"Emitted AdStarted event for campaign {item.get('campaignId')}")
        except Exception as e:
            logger.error(f"Failed to emit AdStarted: {e}")
    
    def emit_ad_completed(self, item):
        """Emit AdCompleted event to SignalR"""
        if not self.signalr_connected or not self.signalr_connection:
            return
        
        try:
            event_data = {
                "CreativeId": str(item.get("creativeId", "")),
                "BookingId": str(item.get("bookingId", "")),
                "ScreenId": str(self.screen_id),
                "CampaignId": str(item.get("campaignId", "")),
                "Timestamp": datetime.now().isoformat(),
                "DeviceId": f"player-{self.screen_id[:8]}"
            }
            
            self.signalr_connection.send("AdCompleted", [event_data])
            logger.debug(f"Emitted AdCompleted event for campaign {item.get('campaignId')}")
        except Exception as e:
            logger.error(f"Failed to emit AdCompleted: {e}")
    
    async def heartbeat_loop(self):
        """Send heartbeat every 30 seconds"""
        while self.is_running:
            self.send_heartbeat()
            await asyncio.sleep(Config.HEARTBEAT_INTERVAL_SECONDS)
    
    async def sync_loop(self):
        """Sync data every 10 minutes"""
        while self.is_running:
            await asyncio.sleep(Config.SYNC_INTERVAL_MINUTES * 60)
            self.sync_daily_data()
    
    async def download_videos(self):
        """Download all playlist videos to local cache"""
        import os
        
        cache_dir = os.path.join(os.path.dirname(__file__), "video_cache")
        os.makedirs(cache_dir, exist_ok=True)
        
        logger.info(f"Downloading {len(self.playlist)} videos to cache...")
        downloaded_files = []
        
        for item in self.playlist:
            creative_url = item.get("creativeUrl", "")
            slot_number = item.get("slotNumber", 0)
            
            if creative_url and not creative_url.startswith("/default/"):
                # Generate local filename
                filename = f"slot_{slot_number}.mp4"
                filepath = os.path.join(cache_dir, filename)
                
                try:
                    # Download video
                    logger.info(f"  Downloading slot {slot_number}...")
                    response = requests.get(creative_url, stream=True, timeout=30)
                    response.raise_for_status()
                    
                    with open(filepath, 'wb') as f:
                        for chunk in response.iter_content(chunk_size=8192):
                            f.write(chunk)
                    
                    logger.info(f"  [OK] Slot {slot_number} downloaded ({os.path.getsize(filepath)} bytes)")
                    downloaded_files.append(filepath)
                    
                except Exception as e:
                    logger.error(f"  Failed to download slot {slot_number}: {e}")
        
        logger.info(f"Downloaded {len(downloaded_files)}/{len(self.playlist)} videos")
        return downloaded_files
    
    def create_playlist_file(self, video_files):
        """Create VLC playlist file (.m3u)"""
        import os
        
        playlist_path = os.path.join(os.path.dirname(__file__), "playlist.m3u")
        
        with open(playlist_path, 'w') as f:
            f.write("#EXTM3U\n")
            for video_file in video_files:
                f.write(f"#EXTINF:-1,Video\n")
                f.write(f"{os.path.abspath(video_file)}\n")
        
        logger.info(f"Created playlist: {playlist_path} with {len(video_files)} videos")
        return playlist_path
    
    async def play_loop(self):
        """Download videos and play continuously with VLC"""
        logger.info("Starting playback loop...")
        self.is_running = True
        
        while self.is_running:
            if not self.playlist:
                logger.warning("No playlist loaded, sleeping 5s...")
                await asyncio.sleep(5)
                continue
            
            # Download all videos
            video_files = await self.download_videos()
            
            if not video_files:
                logger.error("No videos downloaded, retrying in 60s...")
                await asyncio.sleep(60)
                continue
            
            # Create playlist file
            playlist_file = self.create_playlist_file(video_files)
            
            # Find VLC executable
            import os
            vlc_paths = [
                r"C:\Program Files\VideoLAN\VLC\vlc.exe",
                r"C:\Program Files (x86)\VideoLAN\VLC\vlc.exe",
                "vlc"
            ]
            
            vlc_exe = None
            for path in vlc_paths:
                if os.path.exists(path) or path == "vlc":
                    vlc_exe = path
                    break
            
            if not vlc_exe:
                logger.error("VLC not found!")
                await asyncio.sleep(60)
                continue
            
            logger.info("="*60)
            logger.info("Starting VLC playback - playing playlist in loop")
            logger.info(f"VLC: {vlc_exe}")
            logger.info(f"Playlist: {playlist_file}")
            logger.info(f"Videos: {len(video_files)}")
            logger.info("="*60)
            
            try:
                import subprocess
                # Launch VLC with playlist in loop mode - simplified arguments
                vlc_process = subprocess.Popen([
                    vlc_exe,
                    playlist_file,
                    "--fullscreen",
                    "--loop",
                    "--no-video-title"
                ])
                
                logger.info("VLC launched successfully!")
                logger.info("Press Ctrl+C to stop playback")
                
                # Wait for VLC to exit (it won't unless manually closed)
                vlc_process.wait()
                
            except Exception as e:
                logger.error(f"VLC playback error: {e}")
                await asyncio.sleep(60)
            
            logger.info("VLC stopped, restarting in 5s...")
            await asyncio.sleep(5)

        """Main playback loop"""
        logger.info("Starting playback loop...")
        self.is_running = True
        
        while self.is_running:
            if not self.playlist:
                logger.warning("No playlist loaded, sleeping 5s...")
                await asyncio.sleep(5)  # Retry every 5 seconds instead of 60
                continue
            
            # Play with VLC
            item = self.playlist[self.current_index]
            duration = item.get("durationSeconds", 10)
            slot_number = item.get("slotNumber", self.current_index + 1)
            creative_url = item.get("creativeUrl", "")
            
            logger.info(f"Playing slot {slot_number} ({duration}s)")
            logger.info(f"  Video: {creative_url}")
            
            # Emit AdStarted event
            self.emit_ad_started(item)
            
            # Launch VLC to play the video
            if creative_url and not creative_url.startswith("/default/"):
                try:
                    import subprocess
                    import os
                    
                    # Find VLC executable
                    vlc_paths = [
                        r"C:\Program Files\VideoLAN\VLC\vlc.exe",
                        r"C:\Program Files (x86)\VideoLAN\VLC\vlc.exe",
                        "vlc"  # Fallback to PATH
                    ]
                    
                    vlc_exe = None
                    for path in vlc_paths:
                        if os.path.exists(path) or path == "vlc":
                            vlc_exe = path
                            break
                    
                    if not vlc_exe:
                        raise FileNotFoundError("VLC not found")
                    
                    # Play video with VLC in fullscreen, close when done
                    logger.info(f"  Launching VLC: {vlc_exe}")
                    vlc_process = subprocess.Popen([
                        vlc_exe,
                        creative_url,
                        "--fullscreen",
                        "--play-and-exit",
                        "--no-video-title-show",
                        "--no-embedded-video"
                    ], stdout=subprocess.PIPE, stderr=subprocess.PIPE)
                    
                    # Wait for video to finish or duration to expire
                    try:
                        stdout, stderr = vlc_process.communicate(timeout=duration)
                        if stderr:
                            logger.warning(f"VLC stderr: {stderr.decode('utf-8', errors='ignore')[:200]}")
                        logger.info(f"  VLC finished (exit code: {vlc_process.returncode})")
                    except subprocess.TimeoutExpired:
                        vlc_process.kill()
                        logger.warning(f"VLC process killed after {duration}s timeout")
                except Exception as e:
                    logger.error(f"Failed to play video with VLC: {e}")
                    await asyncio.sleep(duration)  # Fallback to simulation
            else:
                # Filler content or invalid URL - just sleep
                logger.info("  (Filler content - skipping)")
                await asyncio.sleep(duration)
            
            # Emit AdCompleted event
            self.emit_ad_completed(item)
            
            # Record impression
            self.record_impression(item)
            
            # Move to next
            self.current_index = (self.current_index + 1) % len(self.playlist)
            await asyncio.sleep(0.5)

    
    async def run(self):
        """Main entry point"""
        logger.info("=" * 60)
        logger.info("CCMS Player Starting")
        logger.info("=" * 60)
        
        # Handshake
        if not self.handshake():
            logger.error("Handshake failed, exiting")
            return
        
        # Connect to SignalR for real-time events
        try:
            self.connect_signalr()
        except Exception as e:
            logger.warning(f"SignalR connection failed (will continue with HTTP only): {e}")
        
        # Start tasks
        heartbeat_task = asyncio.create_task(self.heartbeat_loop())
        sync_task = asyncio.create_task(self.sync_loop())
        
        try:
            await self.play_loop()
        except KeyboardInterrupt:
            logger.info("Shutdown requested")
        finally:
            self.is_running = False
            heartbeat_task.cancel()
            sync_task.cancel()
            
            # Final sync
            self.sync_daily_data()
            logger.info("Player stopped")


async def main():
    if not Config.SCREEN_ID or not Config.API_KEY:
        logger.error("SCREEN_ID and API_KEY must be configured!")
        logger.error("Set in config.json")
        return
    
    player = CCMSPlayer()
    await player.run()


if __name__ == "__main__":
    asyncio.run(main())
