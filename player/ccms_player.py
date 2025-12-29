"""
CCMS Player Client - HTTP REST API Version
Connects to CCMS backend via HTTP REST endpoints
Syncs impression data every 10 minutes
Sends heartbeat every 30 seconds
"""

import asyncio
import json
import sys
import os
from datetime import datetime, timedelta, timezone
from pathlib import Path
from collections import defaultdict
import logging

try:
    import requests
    from signalrcore.hub_connection_builder import HubConnectionBuilder
except ImportError as e:
    print(f"Missing dependency: {e}")
    print("Install with: pip install -r requirements.txt")
    sys.exit(1)


# IST Timezone (UTC+5:30)
IST = timezone(timedelta(hours=5, minutes=30))

def get_ist_now():
    """Get current datetime in IST"""
    return datetime.now(IST)


class ISTFormatter(logging.Formatter):
    """Custom formatter that uses IST timezone for timestamps"""
    def formatTime(self, record, datefmt=None):
        ct = datetime.fromtimestamp(record.created, IST)
        if datefmt:
            s = ct.strftime(datefmt)
        else:
            s = ct.strftime("%Y-%m-%d %H:%M:%S")
            s = f"{s},{int(record.msecs):03d} IST"
        return s


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

# Create log filename with IST date-time (each start creates new file)
ist_now = get_ist_now()
log_filename = f"player_{ist_now.strftime('%Y%m%d_%H%M%S')}.log"
playlog_filename = f"playlog_{ist_now.strftime('%Y%m%d_%H%M%S')}.log"

# Setup logging with IST timezone formatter
ist_formatter = ISTFormatter('%(asctime)s - %(levelname)s - %(message)s')

file_handler = logging.FileHandler(Config.LOGS_DIR / log_filename, encoding='utf-8')
file_handler.setFormatter(ist_formatter)

stream_handler = logging.StreamHandler()
stream_handler.setFormatter(ist_formatter)

logging.basicConfig(
    level=logging.INFO,
    handlers=[file_handler, stream_handler]
)
logger = logging.getLogger("CCMSPlayer")

# Create separate play log for detailed impression tracking
play_logger = logging.getLogger("PlayLog")
play_logger.setLevel(logging.INFO)
play_handler = logging.FileHandler(Config.LOGS_DIR / playlog_filename, encoding='utf-8')
play_handler.setFormatter(ist_formatter)
play_logger.addHandler(play_handler)
play_logger.propagate = False  # Don't send to root logger

logger.info(f"=== CCMS Player Started at {ist_now.strftime('%Y-%m-%d %H:%M:%S IST')} ===")
play_logger.info(f"=== PLAY LOG SESSION STARTED ===")
play_logger.info(f"Session Start Time: {ist_now.strftime('%Y-%m-%d %H:%M:%S IST')}")
play_logger.info(f"Screen ID: {Config.SCREEN_ID}")
play_logger.info(f"Server URL: {Config.API_URL}")
play_logger.info(f"="*80)


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
        
        # WebRTC Streaming (optional)
        self.webrtc_streamer = None
        self.streaming_enabled = False
        try:
            from webrtc_streamer import WebRTCStreamer
            self.streaming_enabled = True
            logger.info("[WebRTC] Module available - streaming can be enabled")
        except ImportError:
            logger.info("[WebRTC] Module not available - install dependencies to enable streaming")
        
        # Cache Manager for video lifecycle
        from cache_manager import CacheManager
        self.cache_manager = CacheManager(
            cache_dir=Config.CACHE_DIR,
            api_url=self.api_url,
            screen_id=self.screen_id,
            api_key=self.api_key
        )
        
        # Track impressions for sync
        self.impressions = defaultdict(lambda: {'playCount': 0, 'lastPlayed': None})
        
        # HTTP session
        self.session = requests.Session()
        self.session.headers.update({
            "X-API-Key": self.api_key,
            "Content-Type": "application/json"
        })
        
        # MPV Player for gapless playback
        from mpv_dual_player import MPVDualPlayer
        
        # Load MPV configuration from config file
        config_file = Config.BASE_DIR / "config.json"
        dual_player_mode = False  # Default
        if config_file.exists():
            with open(config_file) as f:
                config_data = json.load(f)
                mpv_config = config_data.get('mpv_playback', {})
                dual_player_mode = mpv_config.get('dual_player_mode', False)
        
        self.mpv_player = MPVDualPlayer(dual_player_mode=dual_player_mode)
        self.mpv_player.set_on_started(self._handle_video_started)
        self.mpv_player.set_on_ended(self._handle_video_ended)
        
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
        """Record impression for 10-minute sync"""
        try:
            campaign_id = item.get('campaignId', '')
            creative_id = item.get('creativeId', '')
            booking_id = item.get('bookingId', '')
            
            if campaign_id:
                key = f"{campaign_id}_{creative_id}_{booking_id}"
                session_data = self.session_data['campaign_impressions'][key]
                session_data['booking_id'] = booking_id
                session_data['campaign_id'] = campaign_id
                session_data['creative_id'] = creative_id
                session_data['play_timestamps'].append(datetime.now())
                
        except Exception as e:
            logger.error(f"Error recording impression: {e}")
    
    async def download_videos(self):
        """Download all playlist videos to local cache"""
        import os
        
        cache_dir = os.path.join(os.path.dirname(__file__), "video_cache")
        os.makedirs(cache_dir, exist_ok=True)
        
        logger.info(f"Downloading {len(self.playlist)} videos to cache...")
        downloaded_count = 0
        
        for idx, item in enumerate(self.playlist):
            creative_url = item.get("creativeUrl", "")
            creative_id = item.get("creativeId", "")
            slot_num = item.get("slotNumber", 0)
            
            if not creative_url or creative_url.startswith("/default/"):
                logger.info(f"  Slot {slot_num}: Skipping (default/empty)")
                continue
            
            # Check if already cached by creative ID
            cached_path = self.cache_manager.is_video_cached(creative_id)
            if cached_path and os.path.exists(cached_path):
                logger.info(f"  Slot {slot_num}: Already cached: {cached_path}")
                self.playlist[idx]["local_path"] = cached_path  # Use index to persist
                downloaded_count += 1
                continue
            
            # Download to slot-based filename
            filename = f"slot_{slot_num}.mp4"
            filepath = os.path.join(cache_dir, filename)
            
            try:
                logger.info(f"  Slot {slot_num}: Downloading...")
                response = self.session.get(creative_url, stream=True, timeout=30)
                response.raise_for_status()
                
                with open(filepath, 'wb') as f:
                    for chunk in response.iter_content(chunk_size=8192):
                        f.write(chunk)
                
                file_size = os.path.getsize(filepath)
                logger.info(f"  Slot {slot_num}: ✓ Downloaded ({file_size} bytes)")
                
                # Set local path using index to persist
                self.playlist[idx]["local_path"] = filepath
                
                # Register in cache manager
                self.cache_manager.register_download(
                    booking_id=item.get('bookingId', ''),
                    campaign_id=item.get('campaignId', ''),
                    creative_id=creative_id,
                    file_path=filepath
                )
                
                downloaded_count += 1
                
            except Exception as e:
                logger.error(f"  Slot {slot_num}: Failed to download: {e}")
        
        logger.info(f"Downloaded {downloaded_count}/{len(self.playlist)} videos")
        
        # Debug: Check if local_path is actually set
        logger.info("DEBUG: Checking playlist after download:")
        for idx, item in enumerate(self.playlist):
            logger.info(f"  [{idx}] local_path = {item.get('local_path')}")
        
        return downloaded_count > 0
    
    def connect_signalr(self):
        """Connect to SignalR PlaybackHub for real-time events"""
        try:
            hub_url = f"{self.api_url}/hubs/playback"
            logger.info(f"Connecting to SignalR PlaybackHub: {hub_url}")
            
            self.signalr_connection = HubConnectionBuilder() \
                .with_url(hub_url) \
                .configure_logging(logging.INFO) \
                .with_automatic_reconnect({
                    "type": "raw",
                    "keep_alive_interval": 10,
                    "reconnect_interval": 5,
                    "max_attempts": 5
                }) \
                .build()
            
            # Connection handlers (correct API)
            self.signalr_connection.on_open(self._on_signalr_open)
            self.signalr_connection.on_close(self._on_signalr_close)
            self.signalr_connection.on_error(lambda error: logger.error(f"SignalR error: {error}"))
            
            # Start connection
            self.signalr_connection.start()
            logger.info("SignalR connection initiated")
            
        except Exception as e:
            logger.error(f"Failed to connect to SignalR: {e}")
            self.signalr_connected = False
    
    def _on_signalr_open(self):
        """Called when SignalR connection opens"""
        logger.info("Connected to SignalR PlaybackHub")
        self.signalr_connected = True
    
    def _on_signalr_close(self):
        """Called when SignalR connection closes"""
        logger.warning("SignalR connection closed")
        self.signalr_connected = False
    
    def emit_ad_started(self, item):
        """Emit AdStarted event to SignalR"""
        # Log to play log
        play_logger = logging.getLogger("PlayLog")
        play_logger.info(f"[START] Slot={item.get('slotNumber', '?')} | Campaign={item.get('campaignId', 'N/A')} | Creative={item.get('creativeId', 'N/A')} | Booking={item.get('bookingId', 'N/A')} | Screen={self.screen_id}")
        
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
        # Log to play log
        play_logger = logging.getLogger("PlayLog")
        play_logger.info(f"[END]   Slot={item.get('slotNumber', '?')} | Campaign={item.get('campaignId', 'N/A')} | Creative={item.get('creativeId', 'N/A')} | Booking={item.get('bookingId', 'N/A')} | Screen={self.screen_id}")
        play_logger.info("-" * 80)
        
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
    
    async def cache_cleanup_loop(self):
        """Run cache cleanup daily"""
        while self.is_running:
            # Run cleanup every 24 hours
            await asyncio.sleep(24 * 60 * 60)
            
            logger.info("Running scheduled cache cleanup...")
            try:
                await self.cache_manager.cleanup_expired_videos()
            except Exception as e:
                logger.error(f"Scheduled cache cleanup failed: {e}")
    
    async def download_videos(self):
        """Download all playlist videos to local cache"""
        import os
        
        cache_dir = os.path.join(os.path.dirname(__file__), "video_cache")
        os.makedirs(cache_dir, exist_ok=True)
        
        logger.info(f"Downloading {len(self.playlist)} videos to cache...")
        downloaded_files = []
        
        for item in self.playlist:
            creative_url = item.get("creativeUrl", "")
            creative_id = item.get("creativeId", "")
            slot_number = item.get("slotNumber", 0)
            
            if creative_url and not creative_url.startswith("/default/"):
                # Check if already cached
                cached_path = self.cache_manager.is_video_cached(creative_id)
                if cached_path:
                    logger.info(f"  Slot {slot_number} already cached: {cached_path}")
                    downloaded_files.append(cached_path)
                    continue
                
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
                    
                    # Register in cache manager
                    self.cache_manager.register_download(
                        booking_id=item.get('bookingId', ''),
                        campaign_id=item.get('campaignId', ''),
                        creative_id=creative_id,
                        file_path=filepath
                    )
                    
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
    
    def _handle_video_started(self, item):
        """Called when VLC starts playing a video"""
        try:
            # Emit SignalR event for real-time frontend updates
            self.emit_ad_started(item)
        except Exception as e:
            logger.error(f"Error handling video started: {e}")
    
    def _handle_video_ended(self, item):
        """Called when VLC finishes a video"""
        try:
            # Emit SignalR event
            self.emit_ad_completed(item)
            
            # Record impression for 10-minute sync
            self.record_impression(item)
        except Exception as e:
            logger.error(f"Error handling video ended: {e}")
    
    async def play_loop(self):
        """Main playback loop using MPV Dual Player"""
        logger.info("Starting MPV gapless playback loop...")
        
        self.is_running = True
        
        try:
            while self.is_running:
                # Check if playlist needs refresh
                if not self.playlist:
                    logger.warning("No playlist loaded, waiting...")
                    await asyncio.sleep(5)
                    continue
                
                # Set local_path from cache files BEFORE loading into MPV
                cache_dir = os.path.join(os.path.dirname(__file__), "video_cache")
                for idx, item in enumerate(self.playlist):
                    slot_num = item.get('slotNumber', 0)
                    cache_path = os.path.join(cache_dir, f"slot_{slot_num}.mp4")
                    
                    if os.path.exists(cache_path):
                        self.playlist[idx]['local_path'] = cache_path
                        logger.info(f"  Set path for slot {slot_num}: {cache_path}")
                
                # Debug: log playlist structure
                logger.info(f"Playlist has {len(self.playlist)} items:")
                for idx, item in enumerate(self.playlist):
                    local_path = item.get('local_path')
                    slot_num = item.get('slotNumber')
                    logger.info(f"  [{idx}] Slot {slot_num}: local_path = {local_path}")
                
                # Load playlist into MPV dual player
                if self.mpv_player.load_playlist(self.playlist):
                    logger.info("Playlist loaded into MPV Dual Player")
                    
                    # Start gapless playback
                    self.mpv_player.play()
                    
                    logger.info("="*60)
                    logger.info("MPV gapless playback running")
                    logger.info("Dual-player ping-pong architecture active")
                    logger.info("Press Ctrl+C to stop playback")
                    logger.info("="*60)
                    
                    # Keep alive - MPV handles playback automatically
                    while self.is_running:
                        await asyncio.sleep(10)
                else:
                    logger.error("Failed to load playlist, retrying in 30s...")
                    await asyncio.sleep(30)
        
        finally:
            logger.info("Stopping playback...")
            self.mpv_player.stop()
            self.mpv_player.cleanup()


    
    async def run(self):
        """Main entry point"""
        logger.info("=" * 60)
        logger.info("CCMS Player Starting")
        logger.info("=" * 60)
        
        # Handshake
        if not self.handshake():
            logger.error("Handshake failed, exiting")
            return
        
        # Run cache cleanup on startup
        logger.info("Running cache cleanup check...")
        try:
            await self.cache_manager.cleanup_expired_videos()
        except Exception as e:
            logger.warning(f"Cache cleanup failed: {e}")
        
        # Download videos before starting playback
        logger.info("Downloading playlist videos...")
        try:
            await self.download_videos()
        except Exception as e:
            logger.error(f"Video download failed: {e}")
        
        # Connect to SignalR for real-time events
        try:
            self.connect_signalr()
        except Exception as e:
            logger.warning(f"SignalR connection failed (will continue with HTTP only): {e}")
        
        
        # Initialize WebRTC streaming if enabled
        webrtc_client = None
        
        # Load webrtc config from config.json
        try:
            import json
            import os # Added import for os.path.join
            config_path = os.path.join(os.path.dirname(__file__), 'config.json')
            with open(config_path, 'r') as f:
                config_data = json.load(f)
                webrtc_config = config_data.get('webrtc', {'enabled': False})
        except Exception as e:
            logger.warning(f"[WebRTC] Failed to load config: {e}")
            webrtc_config = {'enabled': False}
        
        if webrtc_config.get('enabled', False) and self.streaming_enabled:
            try:
                logger.info("[WebRTC] Initializing WebRTC client...")
                from simple_webrtc_client import SimpleWebRTCClient
                webrtc_client = SimpleWebRTCClient(
                    self.api_url,
                    self.screen_id,
                    self.api_key,
                    webrtc_config
                )
                logger.info("[WebRTC] Starting WebRTC streaming...")
                
                # Start WebRTC client (it will connect to StreamingHub and register)
                await webrtc_client.start()
                
                logger.info("[WebRTC] WebRTC streaming started successfully!")
            except Exception as e:
                logger.error(f"[WebRTC] Failed to initialize: {e}")
                import traceback
                traceback.print_exc()
                webrtc_client = None
        else:
            logger.warning(f"[WebRTC] NOT starting. Config enabled: {webrtc_config.get('enabled', False)}, streaming_enabled: {self.streaming_enabled}")
            webrtc_client = None
        
        # Start tasks
        heartbeat_task = asyncio.create_task(self.heartbeat_loop())
        sync_task = asyncio.create_task(self.sync_loop())
        cache_cleanup_task = asyncio.create_task(self.cache_cleanup_loop())
        
        try:
            await self.play_loop()
        except KeyboardInterrupt:
            logger.info("Shutdown requested")
        finally:
            self.is_running = False
            heartbeat_task.cancel()
            sync_task.cancel()
            cache_cleanup_task.cancel()
            
            # Stop WebRTC streaming
            if webrtc_client:
                try:
                    await webrtc_client.stop()
                except Exception as e:
                    logger.error(f"[WebRTC] Error stopping: {e}")
            
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
