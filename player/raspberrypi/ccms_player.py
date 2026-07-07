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
import time
import uuid
import shutil
import sqlite3
import hashlib
from datetime import datetime, timedelta, timezone
from pathlib import Path
from collections import defaultdict
from urllib.parse import urlparse
import logging

try:
    import requests
    import pytz
    from signalrcore.hub_connection_builder import HubConnectionBuilder
    from security_manager import PlayerSecurityManager, SecurePlayerConfig
    from qr_verification import QrVerificationDisplay
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
    IMPRESSION_DB_PATH = BASE_DIR / "impressions.db"  # SQLite for offline queue
    
    SYNC_INTERVAL_MINUTES = 1  # Reduced to 1 minute for testing (change back to 10 for production)
    SYNC_INTERVAL_FAST = 60      # 1 minute (when user viewing Live Activity)
    SYNC_INTERVAL_NORMAL = 600   # 10 minutes (default background sync)
    current_sync_interval = SYNC_INTERVAL_NORMAL  # Start with normal mode
    HEARTBEAT_INTERVAL_SECONDS = 30
    PLAYLIST_REFRESH_INTERVAL_MINUTES = 1  # Refresh playlist every minute (fallback if SignalR fails)
    PLAYER_VERSION = "1.1.0"  # Version bump for new features
    LOG_RETENTION_DAYS = 7  # Default: keep logs for 7 days
    
    # Disk space management
    MIN_FREE_DISK_GB = 1.0  # Minimum free disk space before cache eviction
    MAX_CACHE_SIZE_GB = 10.0  # Maximum cache size
    
    # Offline queue settings
    MAX_BATCH_SIZE = 500  # Max impressions per sync request
    MAX_OFFLINE_DAYS = 7  # Max retention for offline impressions
    
    # Download retry settings
    DOWNLOAD_MAX_RETRIES = 3
    DOWNLOAD_RETRY_DELAY_SECONDS = 2
    
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
                
                # Load logging config
                logging_config = config.get("logging", {})
                cls.LOG_RETENTION_DAYS = logging_config.get("log_retention_days", cls.LOG_RETENTION_DAYS)
                
                # Load disk/cache settings
                cache_config = config.get("cache", {})
                cls.MIN_FREE_DISK_GB = cache_config.get("min_free_disk_gb", cls.MIN_FREE_DISK_GB)
                cls.MAX_CACHE_SIZE_GB = cache_config.get("max_cache_size_gb", cls.MAX_CACHE_SIZE_GB)

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
# Separate logger for playback events
play_logger.addHandler(play_handler)

# Import and run log cleanup
from log_cleanup import cleanup_logs_on_startup

# Clean up old log files (older than configured days) on startup
try:
    cleanup_logs_on_startup(Config.LOGS_DIR, max_age_days=Config.LOG_RETENTION_DAYS)
except Exception as e:
    logger.warning(f"Log cleanup failed: {e}")
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
        
        # Screen timezone and operating hours (from handshake)
        self.screen_timezone = None  # pytz timezone object
        self.operating_hours = {}  # {day_name: "HH:MM-HH:MM"}
        self.is_within_operating_hours = True  # Track current state
        
        # SignalR connection state tracking
        self.signalr_connection = None
        self.signalr_connected = False
        self.signalr_reconnect_attempts = 0
        self.signalr_max_reconnect_attempts = 10
        self.signalr_last_heartbeat = None
        self.signalr_message_queue = []  # Queue for messages during disconnect
        
        # WebRTC Streaming (optional)
        self.webrtc_streamer = None
        self.streaming_enabled = False
        try:
            from webrtc_streamer import WebRTCStreamer
            self.streaming_enabled = True
            logger.info("[WebRTC] Module available - streaming can be enabled")
        except ImportError:
            logger.info("[WebRTC] Module not available - install dependencies to enable streaming")
        
        # Initialize ImpressionStore - Single Source of Truth for accurate counting
        from impression_store import ImpressionStore
        self.impression_store = ImpressionStore(
            db_path=Config.BASE_DIR / "data" / "impressions.db",
            screen_id=self.screen_id
        )
        logger.info(f"[ImpressionStore] Initialized - Pending: {self.impression_store.get_pending_count()}")
        
        # Enhanced Cache Manager for video lifecycle with disk space checks
        from cache_manager import CacheManager
        self.cache_manager = CacheManager(
            cache_dir=Config.CACHE_DIR,
            api_url=self.api_url,
            screen_id=self.screen_id,
            api_key=self.api_key
        )
        
        # Default Video Manager for default/filler content
        from default_video_manager import DefaultVideoManager
        import json
        with open(Config.BASE_DIR / 'config.json') as f:
            config_data = json.load(f)
        self.default_video_manager = DefaultVideoManager(
            config=config_data,
            screen_id=self.screen_id
        )
        
        # NOTE: Impressions are now tracked ONLY in ImpressionStore (SQLite)
        # This ensures single source of truth and prevents duplicates
        # Old in-memory dicts (impressions, campaign_summaries, owner_content_summaries) REMOVED
        
        # Buffered playlist for seamless cycle-boundary swap
        # Changes are buffered and only applied when current cycle completes (after slot 6)
        self._pending_playlist = None  # New playlist waiting to be applied
        self._pending_slots_per_frame = None  # Slot count for pending playlist
        self._download_task = None  # Background download task
        self.playlist_needs_reload = False  # Flag to trigger MPV playlist reload
        self._reload_event = asyncio.Event()  # Event to signal immediate reload
        self._event_loop = None  # Reference to main event loop for thread-safe async calls

        # Day-parting / schedule windows (CMS mode)
        self.schedule_windows = []      # List of schedule window dicts from handshake
        self.cms_default_playlist = []  # Fallback playlist when no schedule window matches
        
        # Duplicate event prevention
        self._last_ended_slot = None  # Last slot that triggered video-ended
        self._last_ended_time = 0  # Timestamp of last video-ended event
        
        # Track current playback position
        self.current_playing_slot_number = None  # Track current slot
        self.slots_per_frame = 6  # Will be updated from playlist
        
        # HTTP session with retry support
        self.session = requests.Session()
        self.session.headers.update({
            "X-API-Key": self.api_key,
            "Content-Type": "application/json"
        })
        
        # Security Manager for secure communication
        self.security_manager = PlayerSecurityManager(
            api_key=self.api_key,
            screen_id=self.screen_id
        )
        self.device_fingerprint = SecurePlayerConfig.generate_device_fingerprint()
        logger.info(f"Device fingerprint generated: {self.device_fingerprint[:16]}...")
        
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
        
        # Server salt for impression verification (received from handshake)
        self.server_salt = None
        
        # QR Verification state
        self.verification_mode = False
        self.verification_status = None
        
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
    
    # ============================================================
    # LEGACY SQLite methods (DEPRECATED - use ImpressionStore instead)
    # Kept for backwards compatibility during transition
    # ============================================================
    
    def _init_impression_db(self):
        """DEPRECATED: Use ImpressionStore instead. Kept for backwards compatibility."""
        logger.warning("[DEPRECATED] _init_impression_db called - use ImpressionStore instead")
        pass  # No-op, ImpressionStore handles initialization
    
    def _cleanup_old_impressions(self):
        """DEPRECATED: ImpressionStore handles cleanup automatically."""
        logger.warning("[DEPRECATED] _cleanup_old_impressions called - ImpressionStore handles this")
        pass
    
    def _queue_impression_offline(self, impression_data: dict):
        """DEPRECATED: Use ImpressionStore.record_impression() instead."""
        logger.warning("[DEPRECATED] _queue_impression_offline called - use ImpressionStore")
        pass
    
    def _get_pending_impressions(self, limit: int = None) -> list:
        """DEPRECATED: Use ImpressionStore.get_pending_impressions() instead."""
        logger.warning("[DEPRECATED] _get_pending_impressions called - use ImpressionStore")
        return []
    
    def _remove_synced_impressions(self, impression_ids: list):
        """DEPRECATED: Use ImpressionStore.mark_synced() instead."""
        logger.warning("[DEPRECATED] _remove_synced_impressions called - use ImpressionStore")
        pass
    
    # ============================================================
    # END LEGACY METHODS
    # ============================================================
    
    def _generate_verification_hash(self, screen_id: str, slot_number: int, timestamp: str) -> str:
        """Generate verification hash for impression authenticity"""
        if not self.server_salt:
            return ""
        data = f"{screen_id}:{slot_number}:{timestamp}:{self.server_salt}"
        return hashlib.sha256(data.encode()).hexdigest()[:32]
    
    def _check_operating_hours(self) -> bool:
        """Check if current time is within operating hours for the screen"""
        if not self.screen_timezone or not self.operating_hours:
            # No operating hours configured - always allow
            return True
        
        try:
            # Get current time in screen's timezone
            now_utc = datetime.now(pytz.UTC)
            now_local = now_utc.astimezone(self.screen_timezone)
            
            # Get today's day name (Monday, Tuesday, etc.)
            day_name = now_local.strftime('%A')
            
            # Check if we have operating hours for this day
            hours_str = self.operating_hours.get(day_name)
            if not hours_str:
                logger.debug(f"No operating hours for {day_name} - allowing playback")
                return True
            
            # Parse hours (format: "HH:MM-HH:MM")
            try:
                start_str, end_str = hours_str.split('-')
                start_hour, start_min = map(int, start_str.split(':'))
                end_hour, end_min = map(int, end_str.split(':'))
                
                current_minutes = now_local.hour * 60 + now_local.minute
                start_minutes = start_hour * 60 + start_min
                end_minutes = end_hour * 60 + end_min
                
                # Handle overnight schedules (e.g., 22:00-06:00)
                if end_minutes < start_minutes:
                    is_within = current_minutes >= start_minutes or current_minutes < end_minutes
                else:
                    is_within = start_minutes <= current_minutes < end_minutes
                
                if not is_within:
                    logger.info(f"⏰ Outside operating hours ({hours_str}) - current time: {now_local.strftime('%H:%M')} {day_name}")
                
                return is_within
                
            except ValueError as e:
                logger.warning(f"Invalid operating hours format '{hours_str}': {e}")
                return True
                
        except Exception as e:
            logger.error(f"Error checking operating hours: {e}")
            return True  # Default to allowing playback on error
    
    def _check_disk_space(self) -> tuple:
        """Check available disk space for cache directory
        Returns (has_space: bool, free_gb: float, total_gb: float)
        """
        try:
            cache_path = str(Config.CACHE_DIR)
            total, used, free = shutil.disk_usage(cache_path)
            free_gb = free / (1024 ** 3)
            total_gb = total / (1024 ** 3)
            has_space = free_gb >= Config.MIN_FREE_DISK_GB
            return (has_space, free_gb, total_gb)
        except Exception as e:
            logger.error(f"Failed to check disk space: {e}")
            return (True, 0, 0)  # Assume space available on error
    
    def _get_cache_size_gb(self) -> float:
        """Get total size of cache directory in GB"""
        try:
            total_size = 0
            cache_path = Config.CACHE_DIR
            for dirpath, dirnames, filenames in os.walk(cache_path):
                for filename in filenames:
                    filepath = os.path.join(dirpath, filename)
                    total_size += os.path.getsize(filepath)
            return total_size / (1024 ** 3)
        except Exception as e:
            logger.error(f"Failed to get cache size: {e}")
            return 0
    
    def _evict_lru_cache(self, needed_bytes: int) -> bool:
        """Evict least recently used cached files to free space
        Returns True if space was freed successfully
        """
        try:
            logger.info(f"[Cache] Starting LRU eviction to free {needed_bytes / (1024**2):.1f} MB")
            
            # Get all cached files with their last access time
            cached_files = []
            cache_path = Config.CACHE_DIR
            
            for filename in os.listdir(cache_path):
                filepath = os.path.join(cache_path, filename)
                if os.path.isfile(filepath):
                    stat = os.stat(filepath)
                    cached_files.append({
                        'path': filepath,
                        'size': stat.st_size,
                        'atime': stat.st_atime  # Last access time
                    })
            
            # Sort by last access time (oldest first)
            cached_files.sort(key=lambda x: x['atime'])
            
            freed_bytes = 0
            for file_info in cached_files:
                if freed_bytes >= needed_bytes:
                    break
                
                # Skip files that are currently in the playlist
                filepath = file_info['path']
                is_in_use = any(
                    item.get('local_path') == filepath 
                    for item in self.playlist
                )
                
                if is_in_use:
                    logger.debug(f"[Cache] Skipping in-use file: {filepath}")
                    continue
                
                try:
                    os.remove(filepath)
                    freed_bytes += file_info['size']
                    logger.info(f"[Cache] Evicted: {os.path.basename(filepath)} ({file_info['size'] / (1024**2):.1f} MB)")
                except Exception as e:
                    logger.warning(f"[Cache] Failed to evict {filepath}: {e}")
            
            logger.info(f"[Cache] Eviction complete - freed {freed_bytes / (1024**2):.1f} MB")
            return freed_bytes >= needed_bytes
            
        except Exception as e:
            logger.error(f"[Cache] LRU eviction failed: {e}")
            return False

    def handshake(self):
        """Perform handshake with server - receives playlist, timezone, operating hours, and server salt"""
        try:
            logger.info("Performing secure handshake...")
            
            # Generate nonce for this handshake
            import time
            nonce = self.security_manager.generate_nonce()
            timestamp = int(time.time())
            
            # Send secure handshake with device fingerprint and hashed API key
            handshake_payload = {
                "screenId": self.screen_id,
                "apiKey": self.api_key,  # Still send API key for backward compat
                "apiKeyHash": self.security_manager.hash_api_key(),  # SHA256 hash
                "deviceFingerprint": self.device_fingerprint,  # Device binding
                "nonce": nonce,
                "timestamp": timestamp,
                "playerVersion": Config.PLAYER_VERSION
            }
            
            response = requests.post(
                f"{self.api_url}/api/v1/player/handshake",
                json=handshake_payload,
                timeout=10
            )
            
            if response.status_code == 200:
                data = response.json().get("data", {})
                if data.get("success"):
                    logger.info("[OK] Handshake successful!")
                    logger.info(f"  Server time: {data.get('serverTime')}")
                    
                    # Extract timezone from response
                    timezone_str = data.get("screenTimezone") or data.get("timezone")
                    if timezone_str:
                        try:
                            self.screen_timezone = pytz.timezone(timezone_str)
                            logger.info(f"  Screen timezone: {timezone_str}")
                        except Exception as e:
                            logger.warning(f"  Invalid timezone '{timezone_str}': {e}")
                            self.screen_timezone = None
                    else:
                        logger.info("  No timezone configured - using local time")
                    
                    # Extract operating hours from response
                    self.operating_hours = data.get("operatingHours", {})
                    if self.operating_hours:
                        logger.info(f"  Operating hours configured for {len(self.operating_hours)} days")
                        for day, hours in self.operating_hours.items():
                            logger.info(f"    {day}: {hours}")
                    else:
                        logger.info("  No operating hours configured - 24/7 operation")
                    
                    # Extract server salt for impression verification
                    self.server_salt = data.get("verificationSalt")
                    if self.server_salt:
                        logger.info("  Impression verification enabled")
                    
                    # Process session token for secure communication
                    session_token = data.get("sessionToken")
                    server_salt = data.get("serverSalt")
                    if session_token and server_salt:
                        self.security_manager.process_handshake_response({
                            "sessionToken": session_token,
                            "serverSalt": server_salt,
                            "expiresAt": data.get("sessionExpiresAt")
                        })
                        logger.info("  Secure session established")
                    
                    # Check device binding status
                    device_status = data.get("deviceBindingStatus")
                    if device_status:
                        if device_status == "bound":
                            logger.info("  Device verified (bound to this screen)")
                        elif device_status == "new_binding":
                            logger.info("  Device newly bound to this screen")
                        elif device_status == "override":
                            logger.warning("  Device override applied - new device bound")
                    
                    # Check verification mode
                    self.verification_mode = data.get("verificationMode", False)
                    self.verification_status = data.get("verificationStatus")
                    if self.verification_mode:
                        logger.warning(f"  Screen requires verification (status: {self.verification_status})")
                        return True  # Handshake succeeded but player needs to enter verification mode
                    
                    # CMS-mode playlist takes precedence over marketplace playlist when
                    # the screen owner is a CmsOwner. The server emits `cmsPlaylist`
                    # only for those screens; marketplace screens still get `playlist`.
                    cms_playlist = data.get("cmsPlaylist")
                    screen_mode = data.get("screenMode")
                    if cms_playlist and isinstance(cms_playlist, dict):
                        cms_items = cms_playlist.get("items", []) or []
                        translated = []
                        for idx, item in enumerate(cms_items):
                            asset = item.get("mediaAsset") or {}
                            url = asset.get("fileUrl")
                            if not url:
                                continue
                            translated.append({
                                "slotNumber": idx + 1,
                                "fileUrl": url,
                                "ownerContentId": asset.get("id"),
                                "mimeType": asset.get("mimeType"),
                                "durationSeconds": item.get("durationSeconds") or asset.get("durationSeconds"),
                                "isFillerContent": False,
                                "source": "cms",
                            })
                        self.playlist = translated
                        logger.info(
                            f"[OK] CMS playlist received (mode={screen_mode}): "
                            f"{len(self.playlist)} items, version={cms_playlist.get('version')}"
                        )

                        # Store the default CMS playlist as fallback for day-parting
                        self.cms_default_playlist = list(self.playlist)

                        # Extract schedule windows for day-parting (may be None or empty)
                        schedule_windows_raw = data.get("scheduleWindows") or []
                        if schedule_windows_raw:
                            self.schedule_windows = schedule_windows_raw
                            logger.info(f"[Schedule] {len(self.schedule_windows)} schedule windows loaded for day-parting")
                        else:
                            self.schedule_windows = []
                            logger.info("[Schedule] No schedule windows configured")

                        sync_interval = data.get("syncIntervalMinutes", 10)
                        Config.SYNC_INTERVAL_MINUTES = sync_interval
                        return True

                    playlist_data = data.get("playlist")
                    if playlist_data and isinstance(playlist_data, dict):
                        self.playlist = playlist_data.get("playlist", [])
                        logger.info(f"[OK] Playlist received: {len(self.playlist)} items")
                        
                        # DEBUG: Show what we got
                        for idx, item in enumerate(self.playlist):
                            slot = item.get('slotNumber', '?')
                            has_owner = 'ownerContentId' in item and item['ownerContentId']
                            has_booking = 'bookingId' in item and item['bookingId']
                            is_filler = item.get('isFillerContent', False)
                            item_type = "OwnerContent" if has_owner else "Booking" if has_booking else "Default/Filler"
                            logger.info(f"  [{idx}] Slot {slot}: {item_type}")
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

    def get_schedule_active_playlist(self):
        """Return translated playlist items for the currently active schedule window.

        The day-of-week bitmask convention matches the backend:
          1=Mon, 2=Tue, 4=Wed, 8=Thu, 16=Fri, 32=Sat, 64=Sun
        Python's datetime.weekday() returns 0=Mon … 6=Sun, so bit = 1 << weekday().

        Returns None when no window matches (caller should fall back to default).
        """
        if not self.schedule_windows:
            return None

        if self.screen_timezone:
            now = datetime.now(self.screen_timezone)
        else:
            now = datetime.now()

        day_bit = 1 << now.weekday()  # Mon=0→1, Tue=1→2, …, Sun=6→64
        current_minute = now.hour * 60 + now.minute

        for window in self.schedule_windows:
            mask = window.get("daysOfWeekMask", 0)
            start = window.get("startMinute", 0)
            end = window.get("endMinute", 1440)
            if (mask & day_bit) and start <= current_minute < end:
                items_raw = window.get("items", []) or []
                translated = []
                for idx, item in enumerate(items_raw):
                    asset = item.get("mediaAsset") or {}
                    url = asset.get("fileUrl")
                    if not url:
                        continue
                    translated.append({
                        "slotNumber": idx + 1,
                        "fileUrl": url,
                        "ownerContentId": asset.get("id"),
                        "mimeType": asset.get("mimeType"),
                        "durationSeconds": item.get("durationSeconds") or asset.get("durationSeconds"),
                        "isFillerContent": False,
                        "source": "schedule",
                    })
                if not translated:
                    continue  # window has no valid items; keep searching
                label = window.get("label") or str(window.get("playlistId", ""))[:8]
                logger.info(
                    f"[Schedule] Active window '{label}' "
                    f"({start // 60:02d}:{start % 60:02d}–{end // 60:02d}:{end % 60:02d})"
                )
                return translated

        return None  # No matching window right now

    def send_heartbeat(self):
        """Send heartbeat to maintain online status"""
        try:
            response = requests.post(
                f"{self.api_url}/api/v1/player/heartbeat",
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
        """Sync accumulated impressions to server using ImpressionStore (Single Source of Truth)
        Uses UPSERT semantics on server for idempotent deduplication
        """
        try:
            logger.info("Syncing impressions to server...")
            
            now = datetime.now()
            session_duration = now - self.session_data['start_time']
            
            # Get pending impressions from ImpressionStore (Single Source of Truth)
            pending_impressions = self.impression_store.get_pending_impressions()
            
            if not pending_impressions:
                logger.info("No pending impressions to sync")
                return True
            
            logger.info(f"Found {len(pending_impressions)} pending impressions to sync")
            
            # Format impressions for server sync
            # Server expects flat array of impressions with UPSERT handling
            impressions_to_sync = []
            for imp in pending_impressions:
                impressions_to_sync.append({
                    'impressionId': imp['impression_id'],
                    'slotPlayKey': imp['slot_play_key'],  # Server uses for UPSERT
                    'bookingId': imp['booking_id'],
                    'campaignId': imp['campaign_id'],
                    'creativeId': imp['creative_id'],
                    'ownerContentId': imp['owner_content_id'],
                    'slotNumber': imp['slot_number'],
                    'playedAt': imp['played_at'],
                    'verificationHash': imp['verification_hash'],
                    'screenId': self.screen_id,
                    # Playback duration tracking (for advertiser reporting)
                    'durationSeconds': imp.get('duration_seconds'),
                    'expectedDurationSeconds': imp.get('expected_duration_seconds'),
                    'wasFullPlay': bool(imp.get('was_full_play', 1))
                })
            
            sync_data = {
                'date': self.session_data['date'].isoformat(),
                'startTime': self.session_data['start_time'].strftime("%H:%M:%S"),
                'endTime': now.strftime("%H:%M:%S"),
                'uptime': str(session_duration),
                'downtime': "00:00:00",
                'impressions': impressions_to_sync,  # Flat array for UPSERT
                'playerVersion': Config.PLAYER_VERSION
            }
            
            logger.info(f"Syncing {len(impressions_to_sync)} impressions...")
            
            response = requests.post(
                f"{self.api_url}/api/v1/player/sync",
                json={
                    "screenId": self.screen_id,
                    "syncData": sync_data
                },
                timeout=30
            )
            
            if response.status_code == 200:
                data = response.json().get("data", {})
                if data.get("success"):
                    saved_count = data.get('impressionsSaved', 0)
                    duplicates_ignored = data.get('duplicatesIgnored', 0)
                    logger.info(f"[OK] Sync successful! {saved_count} new, {duplicates_ignored} duplicates ignored")
                    
                    # Mark impressions as synced in ImpressionStore
                    impression_ids = [imp['impressionId'] for imp in impressions_to_sync]
                    self.impression_store.mark_synced(impression_ids)
                    logger.info(f"[ImpressionStore] Marked {len(impression_ids)} impressions as synced")
                    
                    return True
                else:
                    logger.error(f"Sync failed: {data.get('message')}")
                    return False
            else:
                logger.error(f"Sync HTTP error: {response.status_code}")
                try:
                    error_detail = response.json()
                    logger.error(f"Sync error details: {error_detail}")
                except:
                    logger.error(f"Sync error response: {response.text[:500] if response.text else 'No response body'}")
                return False
                
        except Exception as e:
            logger.error(f"Sync error: {e}")
            return False
    
    
    async def download_videos(self):
        """Download all playlist videos to local cache"""
        import os
        
        cache_dir = os.path.join(os.path.dirname(__file__), "video_cache")
        os.makedirs(cache_dir, exist_ok=True)
        
        logger.info(f"Downloading {len(self.playlist)} videos to cache...")
        downloaded_count = 0
        
        for idx, item in enumerate(self.playlist):
            # Check for both booking creatives and owner content
            creative_url = item.get("creativeUrl", "") or item.get("fileUrl", "")
            creative_id = item.get("creativeId", "")
            owner_content_id = item.get("ownerContentId", "")
            slot_num = item.get("slotNumber", 0) or item.get("slotPosition", 0)
            is_filler = item.get("isFillerContent", False) or item.get("IsFillerContent", False)
            
            # Determine content_id (either creativeId or ownerContentId)
            content_id = creative_id if creative_id else owner_content_id
            
            # Skip if no URL provided
            if not creative_url:
                logger.warning(f"  Slot {slot_num}: No URL provided, skipping")
                continue
            
            # Determine content type for logging
            if owner_content_id:
                content_type = "Owner Content"
            elif is_filler:
                content_type = "Default Video"
            else:
                content_type = "Booking Creative"
            
            # Check if already cached by content ID (only for non-default videos)
            if content_id:
                cached_path = self.cache_manager.is_video_cached(content_id)
                if cached_path and os.path.exists(cached_path):
                    logger.info(f"  Slot {slot_num}: Already cached ({content_type}): {cached_path}")
                    self.playlist[idx]["local_path"] = cached_path
                    downloaded_count += 1
                    continue
            
            # Download to content-based filename (or slot-based for default videos)
            if content_id:
                filename = f"{content_id}.mp4"
            else:
                # Default/filler video - use slot-based name
                filename = f"default_slot_{slot_num}.mp4"
            filepath = os.path.join(cache_dir, filename)
            
            try:
                logger.info(f"  Slot {slot_num}: Downloading {content_type}...")
                response = self.session.get(creative_url, stream=True, timeout=30)
                response.raise_for_status()
                
                with open(filepath, 'wb') as f:
                    for chunk in response.iter_content(chunk_size=8192):
                        f.write(chunk)
                
                file_size = os.path.getsize(filepath)
                logger.info(f"  Slot {slot_num}: ✓ Downloaded {content_type} ({file_size} bytes)")
                
                # Set local path using index to persist
                self.playlist[idx]["local_path"] = filepath
                
                # Register in cache manager (only for non-default videos)
                if content_id:
                    self.cache_manager.register_download(
                        booking_id=item.get('bookingId', ''),
                        campaign_id=item.get('campaignId', ''),
                        creative_id=content_id,
                        file_path=filepath
                    )
                
                downloaded_count += 1
                
            except Exception as e:
                logger.error(f"  Slot {slot_num}: Failed to download {content_type}: {e}")
        
        logger.info(f"Downloaded {downloaded_count}/{len(self.playlist)} videos")
        
        # Debug: Check if local_path is actually set
        logger.info("DEBUG: Checking playlist after download:")
        for idx, item in enumerate(self.playlist):
            logger.info(f"  [{idx}] local_path = {item.get('local_path')}")
        
        return downloaded_count > 0
    
    def connect_signalr(self):
        """Connect to SignalR PlaybackHub for real-time events with enhanced resilience"""
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
                    "max_attempts": self.signalr_max_reconnect_attempts
                }) \
                .build()
            
            # Connection handlers with improved error tracking
            self.signalr_connection.on_open(self._on_signalr_open)
            self.signalr_connection.on_close(self._on_signalr_close)
            self.signalr_connection.on_error(self._on_signalr_error)
            
            # Listen for playlist updates (owner content upload/delete)
            self.signalr_connection.on("PlaylistUpdated", self._on_playlist_updated)
            
            # Listen for slot status changes (real-time frontend sync)
            self.signalr_connection.on("SlotStatusChanged", self._on_slot_status_changed)
            
            # Listen for sync mode changes (fast/normal)
            self.signalr_connection.on("SetSyncMode", self._on_set_sync_mode)
            logger.info("Registered event handlers: PlaylistUpdated, SlotStatusChanged, SetSyncMode")
            
            # Start connection
            self.signalr_connection.start()
            logger.info("SignalR connection initiated")
            
        except Exception as e:
            logger.error(f"Failed to connect to SignalR: {e}")
            self.signalr_connected = False
    
    def _on_set_sync_mode(self, data):
        """Handle sync mode change from dashboard (fast/normal)"""
        try:
            mode = data[0] if isinstance(data, list) else data
            if mode == 'fast':
                Config.current_sync_interval = Config.SYNC_INTERVAL_FAST
                logger.info("⚡ Switched to FAST sync mode (1 min) - user viewing dashboard")
                # Trigger immediate sync when switching to fast mode
                self.sync_daily_data()
            else:
                Config.current_sync_interval = Config.SYNC_INTERVAL_NORMAL
                logger.info("🐢 Switched to NORMAL sync mode (10 min)")
        except Exception as e:
            logger.error(f"Failed to handle SetSyncMode event: {e}")
    
    def _on_slot_status_changed(self, data):
        """Called when slot status changes - can trigger playlist refresh"""
        try:
            logger.info(f"📡 SlotStatusChanged event received: {data}")
            # This event is primarily for frontend, but player can use it to detect changes
        except Exception as e:
            logger.error(f"Failed to handle SlotStatusChanged event: {e}")
    
    def _on_signalr_open(self):
        """Called when SignalR connection opens"""
        logger.info("Connected to SignalR PlaybackHub")
        self.signalr_connected = True
        self.signalr_reconnect_attempts = 0  # Reset on successful connection
        self.signalr_last_heartbeat = datetime.now()
        
        # CRITICAL: Subscribe to screen group to receive PlaylistUpdated events
        try:
            self.signalr_connection.send("SubscribeToScreen", [self.screen_id])
            logger.info(f"✅ Subscribed to screen group: screen_{self.screen_id}")
            
            # Replay queued messages if any
            if self.signalr_message_queue:
                logger.info(f"Replaying {len(self.signalr_message_queue)} queued messages...")
                for msg in self.signalr_message_queue:
                    try:
                        self.signalr_connection.send(msg['method'], msg['args'])
                    except Exception as e:
                        logger.warning(f"Failed to replay message {msg['method']}: {e}")
                self.signalr_message_queue.clear()
        except Exception as e:
            logger.error(f"Failed to subscribe to screen group: {e}")
    
    def _on_signalr_close(self):
        """Called when SignalR connection closes"""
        logger.warning("SignalR connection closed")
        self.signalr_connected = False
        self.signalr_reconnect_attempts += 1
        
        # Log reconnection attempt info
        if self.signalr_reconnect_attempts < self.signalr_max_reconnect_attempts:
            logger.info(f"Will attempt reconnection ({self.signalr_reconnect_attempts}/{self.signalr_max_reconnect_attempts})")
        else:
            logger.error(f"Max reconnection attempts reached ({self.signalr_max_reconnect_attempts})")
    
    def _on_signalr_error(self, error):
        """Called on SignalR error"""
        logger.error(f"SignalR error: {error}")
        # Don't set signalr_connected = False here, let on_close handle it
    
    def _queue_signalr_message(self, method: str, args: list):
        """Queue a SignalR message to send when connection is restored"""
        self.signalr_message_queue.append({'method': method, 'args': args})
        # Limit queue size to prevent memory issues
        if len(self.signalr_message_queue) > 100:
            self.signalr_message_queue = self.signalr_message_queue[-100:]
    
    def _on_playlist_updated(self, data):
        """Called when owner uploads/deletes content - refresh playlist"""
        try:
            import os
            logger.info(f"📡 PlaylistUpdated event received: {data}")
            
            # SignalR passes data as arguments list, get first arg which is the event data object
            event_data = data[0] if isinstance(data, list) else data
            action = event_data.get('action', 'Unknown')
            slot_number = event_data.get('slotNumber', 0)
            
            logger.info(f"🔄 Refreshing playlist due to {action} on slot {slot_number}")
            
            # Clear cached video for this slot to force re-download
            cache_dir = os.path.join(os.path.dirname(__file__), "video_cache")
            
            # Clear default slot video (since slot is now different content type)
            default_cache = os.path.join(cache_dir, f"default_slot_{slot_number}.mp4")
            if os.path.exists(default_cache):
                try:
                    os.remove(default_cache)
                    logger.info(f"🗑️  Cleared cached default video for slot {slot_number}")
                except Exception as e:
                    logger.warning(f"Failed to clear cache: {e}")
            
            # If content was removed, find old playlist item for this slot and clear its cache too
            if action == 'ContentRemoved':
                for item in self.playlist:
                    if item.get('slotNumber') == slot_number:
                        content_id = item.get('creativeId') or item.get('ownerContentId')
                        if content_id:
                            content_cache = os.path.join(cache_dir, f"{content_id}.mp4")
                            if os.path.exists(content_cache):
                                try:
                                    os.remove(content_cache)
                                    logger.info(f"🗑️  Cleared cached content {content_id[:8]}... for slot {slot_number}")
                                except Exception as e:
                                    logger.warning(f"Failed to clear content cache: {e}")
                        break
            
            # Fetch fresh playlist from server
            self._refresh_playlist()
            
        except Exception as e:
            logger.error(f"Failed to handle PlaylistUpdated event: {e}")
    
    def _refresh_playlist(self):
        """Fetch updated playlist from server and buffer it for cycle-boundary swap.
        
        Changes are NOT applied immediately. Instead:
        1. New playlist is stored in _pending_playlist
        2. Background download is triggered for new videos
        3. When current cycle completes (after last slot), pending playlist is applied
        
        This ensures uninterrupted playback during the current cycle.
        """
        try:
            logger.info("Fetching updated playlist from server...")
            
            # Use handshake endpoint since there's no dedicated playlist endpoint
            response = self.session.post(
                f"{self.api_url}/api/v1/player/handshake",
                json={"screenId": self.screen_id, "deviceId": f"player-{self.screen_id}"},
                headers={"X-Device-Id": f"player-{self.screen_id}"},
                timeout=10
            )
            
            if response.status_code == 200:
                data = response.json().get("data", {})
                playlist_data = data.get("playlist")
                if playlist_data and isinstance(playlist_data, dict):
                    new_playlist = playlist_data.get("playlist", [])
                    new_slots_count = len(new_playlist)
                    
                    logger.info(f"✓ Playlist fetched: {new_slots_count} items")
                    
                    # Check if playlist actually changed
                    if self._is_playlist_same(new_playlist):
                        logger.info("📋 Playlist unchanged, no update needed")
                        return
                    
                    # If no playback yet or playlist empty, apply immediately
                    if not self.playlist or self.current_playing_slot_number is None:
                        logger.info("📋 Applying playlist immediately (no active playback)")
                        self.playlist = new_playlist
                        self.slots_per_frame = new_slots_count
                        # Trigger download - use thread-safe method if event loop available
                        self._schedule_background_download(new_playlist, is_pending=False)
                        return
                    
                    # Buffer the new playlist for cycle-boundary swap
                    self._pending_playlist = new_playlist
                    self._pending_slots_per_frame = new_slots_count
                    
                    logger.info(f"📦 Playlist buffered (currently at slot {self.current_playing_slot_number}/{self.slots_per_frame})")
                    logger.info(f"   Will apply after slot {self.slots_per_frame} completes")
                    
                    # Start background download for pending playlist (thread-safe)
                    self._schedule_background_download(new_playlist, is_pending=True)
                else:
                    logger.warning("No playlist in refresh response")
            else:
                logger.error(f"Failed to fetch playlist: HTTP {response.status_code}")
                
        except Exception as e:
            logger.error(f"Failed to refresh playlist: {e}")
    
    def _is_playlist_same(self, new_playlist: list) -> bool:
        """Check if new playlist is the same as current (or pending) playlist."""
        if not self.playlist:
            return False
        if len(new_playlist) != len(self.playlist):
            return False
        
        # Compare by creativeUrl and ownerContentId
        for i, new_item in enumerate(new_playlist):
            old_item = self.playlist[i]
            new_url = new_item.get('creativeUrl', '')
            old_url = old_item.get('creativeUrl', '')
            new_owner = new_item.get('ownerContentId')
            old_owner = old_item.get('ownerContentId')
            
            if new_url != old_url or new_owner != old_owner:
                return False
        return True

    async def schedule_check_loop(self):
        """Periodically check whether the active schedule window has changed.

        Runs every 60 seconds. When a different window becomes active the new
        playlist is buffered as a pending playlist so the cycle-boundary swap
        mechanism applies it gaplessly at the end of the current ad cycle.
        """
        while self.is_running:
            await asyncio.sleep(60)
            if not self.schedule_windows:
                continue
            try:
                scheduled = self.get_schedule_active_playlist()
                new_playlist = scheduled if scheduled is not None else (self.cms_default_playlist or self.playlist)
                if not new_playlist:
                    continue
                # Only buffer if playlist actually changed
                compare_against = self._pending_playlist if self._pending_playlist is not None else self.playlist
                if len(new_playlist) != len(compare_against) or any(
                    a.get("fileUrl") != b.get("fileUrl")
                    for a, b in zip(new_playlist, compare_against)
                ):
                    logger.info(
                        f"[Schedule] Window changed — buffering new playlist "
                        f"({len(new_playlist)} items) for cycle-boundary swap"
                    )
                    self._pending_playlist = new_playlist
                    self._pending_slots_per_frame = len(new_playlist)
            except Exception as e:
                logger.error(f"[Schedule] Check failed: {e}")
    
    def _schedule_background_download(self, playlist: list, is_pending: bool = False):
        """Schedule background download in a thread-safe manner.
        
        This method handles the case where we're called from a SignalR callback thread
        (not the main asyncio event loop thread).
        """
        try:
            # Try to get the running event loop
            try:
                loop = asyncio.get_running_loop()
                # We're in an async context, can use create_task directly
                if self._download_task is None or self._download_task.done():
                    self._download_task = asyncio.create_task(
                        self._download_videos_for_playlist(playlist, is_pending=is_pending)
                    )
            except RuntimeError:
                # No running event loop - we're in a different thread (SignalR callback)
                if self._event_loop is not None:
                    # Schedule on the main event loop thread-safely
                    future = asyncio.run_coroutine_threadsafe(
                        self._download_videos_for_playlist(playlist, is_pending=is_pending),
                        self._event_loop
                    )
                    logger.debug(f"Scheduled background download via run_coroutine_threadsafe")
                else:
                    logger.warning("No event loop available for background download")
        except Exception as e:
            logger.error(f"Failed to schedule background download: {e}")
    
    async def _download_videos_for_playlist(self, playlist: list, is_pending: bool = False):
        """
        Download videos for a given playlist (used for pending playlist background downloads).
        This method downloads without modifying self.playlist - it's purely for caching.
        Also sets local_path on each playlist item after download.
        """
        try:
            cache_dir = os.path.join(os.path.dirname(__file__), "video_cache")
            os.makedirs(cache_dir, exist_ok=True)
            
            playlist_type = "pending" if is_pending else "current"
            logger.info(f"Starting background download for {playlist_type} playlist ({len(playlist)} items)")
            
            for item in playlist:
                url = item.get("creativeUrl", "")
                slot_number = item.get("slotNumber", 0)
                
                if not url:
                    continue
                
                # Use same caching logic as download_videos() to avoid re-downloads
                # Extract filename/id from URL for consistent cache naming
                creative_id = item.get("creativeId") or item.get("ownerContentId")
                if creative_id:
                    # Use creative/owner ID as filename (same as download_videos)
                    ext = os.path.splitext(url.split('?')[0])[1] or ".mp4"
                    cache_filename = f"{creative_id}{ext}"
                else:
                    # Fallback: use hash-based naming for default videos
                    url_hash = hashlib.md5(url.encode()).hexdigest()[:12]
                    ext = os.path.splitext(url.split('?')[0])[1] or ".mp4"
                    cache_filename = f"default_slot_{slot_number}{ext}"
                
                cache_path = os.path.join(cache_dir, cache_filename)
                
                # Skip if already cached - just set local_path
                if os.path.exists(cache_path) and os.path.getsize(cache_path) > 0:
                    logger.debug(f"[BG Download] Already cached: {cache_filename}")
                    item['local_path'] = cache_path
                    continue
                
                # Download the video
                try:
                    logger.info(f"[BG Download] Downloading slot {slot_number}: {url}")
                    response = await asyncio.get_event_loop().run_in_executor(
                        None,
                        lambda url=url: requests.get(url, timeout=120, stream=True)
                    )
                    
                    if response.status_code == 200:
                        # Write to temp file first, then rename (atomic operation)
                        temp_path = cache_path + ".tmp"
                        with open(temp_path, 'wb') as f:
                            for chunk in response.iter_content(chunk_size=8192):
                                if chunk:
                                    f.write(chunk)
                        
                        # Rename temp to final (atomic)
                        os.replace(temp_path, cache_path)
                        item['local_path'] = cache_path
                        file_size = os.path.getsize(cache_path) / (1024 * 1024)
                        logger.info(f"[BG Download] Cached slot {slot_number}: {cache_filename} ({file_size:.1f} MB)")
                    else:
                        logger.warning(f"[BG Download] Failed to download slot {slot_number}: HTTP {response.status_code}")
                        
                except Exception as e:
                    logger.error(f"[BG Download] Error downloading slot {slot_number}: {e}")
                    continue
                
                # Small delay between downloads to avoid overwhelming network
                await asyncio.sleep(0.1)
            
            logger.info(f"Background download complete for {playlist_type} playlist")
            
        except Exception as e:
            logger.error(f"Background download failed: {e}")
    
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
                "SlotNumber": item.get("slotNumber", 0),
                "IsFillerContent": item.get("isFillerContent", False),
                "OwnerContentId": str(item.get("ownerContentId", "")),
                "Timestamp": datetime.now().isoformat(),
                "DeviceId": f"player-{self.screen_id[:8]}"
            }
            
            self.signalr_connection.send("AdStarted", [event_data])
            logger.debug(f"Emitted AdStarted event for slot {item.get('slotNumber')} campaign {item.get('campaignId')}")
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
    
    async def playlist_refresh_loop(self):
        """Periodically refresh playlist to pick up owner content changes.
        
        This is a fallback mechanism in case SignalR notifications are not received.
        Ensures player always gets updated content within PLAYLIST_REFRESH_INTERVAL_MINUTES.
        """
        while self.is_running:
            await asyncio.sleep(Config.PLAYLIST_REFRESH_INTERVAL_MINUTES * 60)
            try:
                logger.info("⏰ Periodic playlist refresh...")
                self._refresh_playlist()
            except Exception as e:
                logger.error(f"Periodic playlist refresh failed: {e}")
    
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
        """Download all playlist videos to local cache with retry logic and disk space management"""
        import os
        import time
        
        cache_dir = os.path.join(os.path.dirname(__file__), "video_cache")
        os.makedirs(cache_dir, exist_ok=True)
        
        # Check disk space before starting downloads
        has_space, free_gb, total_gb = self._check_disk_space()
        logger.info(f"[Disk] Free space: {free_gb:.2f} GB / {total_gb:.2f} GB")
        
        if not has_space:
            logger.warning(f"[Disk] Low disk space! Attempting cache eviction...")
            # Try to free up 1GB
            self._evict_lru_cache(1024 * 1024 * 1024)
            has_space, free_gb, _ = self._check_disk_space()
            if not has_space:
                logger.error(f"[Disk] Still low on space ({free_gb:.2f} GB free). Some downloads may fail.")
        
        logger.info(f"Downloading {len(self.playlist)} videos to cache...")
        downloaded_files = []
        failed_downloads = []
        
        for idx, item in enumerate(self.playlist):
            creative_url = item.get("creativeUrl", "")
            creative_id = item.get("creativeId", "")
            slot_number = item.get("slotNumber", 0)
            is_filler = item.get("isFillerContent", False) or item.get("IsFillerContent", False)
            owner_content_id = item.get("ownerContentId", "")
            
            # Determine content type
            if owner_content_id:
                content_type = "Owner Content"
            elif is_filler:
                content_type = "Default Video"
            else:
                content_type = "Booking"
            
            # Skip if no URL provided
            if not creative_url:
                logger.warning(f"  Slot {slot_number}: No URL, skipping")
                continue
            
            # Determine content_id
            content_id = creative_id or owner_content_id
            
            # Check if already cached (only for non-default videos)
            if content_id:
                cached_path = self.cache_manager.is_video_cached(content_id)
                if cached_path:
                    logger.info(f"  Slot {slot_number} already cached: {cached_path}")
                    self.playlist[idx]["local_path"] = cached_path
                    downloaded_files.append(cached_path)
                    continue
            
            # Generate filename (content-based or slot-based for defaults)
            if content_id:
                filename = f"{content_id}.mp4"
            else:
                filename = f"default_slot_{slot_number}.mp4"
            filepath = os.path.join(cache_dir, filename)
            
            # Download with retry logic
            success = False
            last_error = None
            
            for attempt in range(Config.DOWNLOAD_MAX_RETRIES):
                try:
                    if attempt > 0:
                        delay = Config.DOWNLOAD_RETRY_DELAY_SECONDS * (2 ** (attempt - 1))  # Exponential backoff
                        logger.info(f"  Slot {slot_number}: Retry {attempt + 1}/{Config.DOWNLOAD_MAX_RETRIES} after {delay}s...")
                        time.sleep(delay)
                    
                    # Check disk space before each download
                    has_space, free_gb, _ = self._check_disk_space()
                    if not has_space:
                        logger.warning(f"  Slot {slot_number}: Low disk space, attempting eviction...")
                        self._evict_lru_cache(500 * 1024 * 1024)  # Try to free 500MB
                    
                    # Download video with progress tracking
                    logger.info(f"  Downloading slot {slot_number} ({content_type})...")
                    response = requests.get(creative_url, stream=True, timeout=60)
                    response.raise_for_status()
                    
                    # Get content length if available
                    content_length = response.headers.get('content-length')
                    if content_length:
                        content_length = int(content_length)
                        logger.debug(f"  Expected size: {content_length / (1024*1024):.1f} MB")
                    
                    # Write to temp file first, then rename (atomic operation)
                    temp_filepath = filepath + ".tmp"
                    downloaded_bytes = 0
                    
                    with open(temp_filepath, 'wb') as f:
                        for chunk in response.iter_content(chunk_size=65536):  # 64KB chunks
                            f.write(chunk)
                            downloaded_bytes += len(chunk)
                    
                    # Verify download completed
                    if content_length and downloaded_bytes < content_length:
                        raise Exception(f"Incomplete download: {downloaded_bytes}/{content_length} bytes")
                    
                    # Replace temp to final (os.replace works on Windows even if target exists)
                    os.replace(temp_filepath, filepath)
                    
                    logger.info(f"  [OK] Slot {slot_number} downloaded ({downloaded_bytes / (1024*1024):.1f} MB)")
                    
                    # Set local_path on playlist item
                    self.playlist[idx]["local_path"] = filepath
                    downloaded_files.append(filepath)
                    
                    # Register in cache manager (only if has content_id)
                    if content_id:
                        self.cache_manager.register_download(
                            booking_id=item.get('bookingId', ''),
                            campaign_id=item.get('campaignId', ''),
                            creative_id=content_id,
                            file_path=filepath
                        )
                    
                    success = True
                    break
                    
                except requests.exceptions.Timeout as e:
                    last_error = f"Timeout: {e}"
                    logger.warning(f"  Slot {slot_number}: {last_error}")
                except requests.exceptions.ConnectionError as e:
                    last_error = f"Connection error: {e}"
                    logger.warning(f"  Slot {slot_number}: {last_error}")
                except requests.exceptions.HTTPError as e:
                    last_error = f"HTTP error: {e}"
                    logger.warning(f"  Slot {slot_number}: {last_error}")
                    if e.response.status_code == 404:
                        break  # Don't retry 404s
                except Exception as e:
                    last_error = str(e)
                    logger.warning(f"  Slot {slot_number}: Download error: {last_error}")
                finally:
                    # Clean up temp file if exists
                    temp_filepath = filepath + ".tmp"
                    if os.path.exists(temp_filepath):
                        try:
                            os.remove(temp_filepath)
                        except:
                            pass
            
            if not success:
                logger.error(f"  [FAILED] Slot {slot_number}: All {Config.DOWNLOAD_MAX_RETRIES} retries failed - {last_error}")
                failed_downloads.append({
                    'slot': slot_number,
                    'url': creative_url[:50] + '...',
                    'error': last_error
                })
        
        logger.info(f"Download complete: {len(downloaded_files)}/{len(self.playlist)} videos")
        if failed_downloads:
            logger.warning(f"Failed downloads: {len(failed_downloads)}")
            for fd in failed_downloads:
                logger.warning(f"  Slot {fd['slot']}: {fd['error']}")
        
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
        """Called when MPV starts playing a video"""
        try:
            # Track current slot for frame-complete reload logic
            slot_number = item.get('slotNumber', 0)
            self.current_playing_slot_number = slot_number
            
            # Track start time for duration calculation (advertiser reporting)
            item['_playback_start_time'] = datetime.now(timezone.utc)
            
            # Emit SignalR event for real-time frontend updates
            self.emit_ad_started(item)
        except Exception as e:
            logger.error(f"Error handling video started: {e}")

    
    def _handle_video_ended(self, item, was_interrupted=False):
        """Called when VLC finishes a video
        
        Args:
            item: The playlist item that just played
            was_interrupted: True if playback was interrupted/skipped, False if completed normally
        """
        try:
            slot_number = item.get('slotNumber', 0)
            current_time = time.time()
            
            # DUPLICATE EVENT GUARD: Skip if we just processed this exact slot recently
            # This prevents double-triggers from VLC/MPV event quirks
            if (self._last_ended_slot == slot_number and 
                (current_time - self._last_ended_time) < 1.0):  # 1 second debounce
                logger.debug(f"⏭️  Ignoring duplicate video_ended for slot {slot_number} (debounced)")
                return
            
            # Update last ended tracking
            self._last_ended_slot = slot_number
            self._last_ended_time = current_time
            
            # Emit SignalR event
            self.emit_ad_completed(item)
            
            # Calculate actual playback duration (for advertiser reporting)
            start_time = item.get('_playback_start_time')
            if start_time:
                end_time = datetime.now(timezone.utc)
                actual_duration_seconds = int((end_time - start_time).total_seconds())
            else:
                actual_duration_seconds = None
            
            # Get expected duration from item metadata (duration in seconds)
            expected_duration_seconds = item.get('duration') or item.get('durationSeconds') or 10
            
            # Determine if this was a full play
            # Full play = completed normally AND actual duration is within 90% of expected
            was_full_play = not was_interrupted
            if was_full_play and actual_duration_seconds and expected_duration_seconds:
                # Allow 10% tolerance for timing variations
                min_expected = expected_duration_seconds * 0.9
                was_full_play = actual_duration_seconds >= min_expected
            
            # Record impression with duration tracking for 10-minute sync
            self.record_impression(
                item, 
                duration_seconds=actual_duration_seconds,
                expected_duration_seconds=expected_duration_seconds,
                was_full_play=was_full_play
            )
            
            # CYCLE BOUNDARY CHECK: Apply pending playlist when cycle completes
            # A cycle is complete when we finish the LAST slot (slot_number == slots_per_frame)
            if slot_number == self.slots_per_frame and self._pending_playlist is not None:
                logger.info(f"🔄 Cycle complete (slot {slot_number}/{self.slots_per_frame}) - applying pending playlist")
                
                # Check if all videos in pending playlist have local_path
                all_cached = all(item.get('local_path') for item in self._pending_playlist)
                
                if not all_cached:
                    logger.warning("⚠️  Pending playlist not fully cached yet, keeping pending for next cycle")
                    # Don't apply yet - wait for downloads to complete
                    return
                
                # Apply the pending playlist
                self.playlist = self._pending_playlist
                self._pending_playlist = None
                
                # Update slots_per_frame if it changed
                if self._pending_slots_per_frame is not None:
                    self.slots_per_frame = self._pending_slots_per_frame
                    self._pending_slots_per_frame = None
                    logger.info(f"Updated slots_per_frame to {self.slots_per_frame}")
                
                logger.info(f"✅ Pending playlist applied with {len(self.playlist)} items")
                
                # Reload MPV immediately (synchronous) to prevent slot 1 from starting with old playlist
                logger.info("🔄 Reloading MPV with new playlist...")
                try:
                    if self.mpv_player.load_playlist(self.playlist):
                        logger.info("✅ Playlist reloaded successfully!")
                        # Resume playback after reload
                        self.mpv_player.play()
                        logger.info("▶️  Playback resumed")
                    else:
                        logger.error("❌ Failed to reload playlist in MPV")
                except Exception as e:
                    logger.error(f"❌ Error reloading playlist: {e}")
                
        except Exception as e:
            logger.error(f"Error handling video ended: {e}")
    
    def record_impression(self, item, duration_seconds=None, expected_duration_seconds=None, was_full_play=True):
        """Record impression using ImpressionStore - Single Source of Truth
        Uses SQLite with unique slot_play_key to prevent duplicates
        
        Args:
            item: The playlist item that was played
            duration_seconds: Actual playback duration in seconds
            expected_duration_seconds: Expected duration from creative metadata
            was_full_play: Whether the ad played completely without interruption
        """
        try:
            # Skip impressions for default/filler content
            is_filler = item.get('isFillerContent', False) or item.get('IsFillerContent', False)
            if is_filler:
                slot = item.get('slotNumber', '?')
                logger.info(f"⏭️  Skipping impression for default video (slot {slot})")
                return
            
            # Extract impression data from item
            slot_number = item.get('slotNumber', 0)
            owner_content_id = item.get('ownerContentId')
            
            # Use ImpressionStore - the single source of truth
            from datetime import datetime, timezone
            success, impression_id, is_new = self.impression_store.record_impression(
                slot_number=slot_number,
                played_at=datetime.now(timezone.utc),  # Timezone-aware UTC timestamp
                booking_id=item.get('bookingId'),
                campaign_id=item.get('campaignId'),
                creative_id=item.get('creativeId'),
                owner_content_id=owner_content_id,
                duration_seconds=duration_seconds,
                expected_duration_seconds=expected_duration_seconds,
                was_full_play=was_full_play
            )
            
            if success:
                if is_new:
                    content_type = "owner content" if owner_content_id else "campaign"
                    content_id = owner_content_id or item.get('campaignId', 'unknown')
                    play_status = "✓" if was_full_play else "⚠partial"
                    duration_info = f"{duration_seconds}s" if duration_seconds else "?"
                    logger.info(f"📊 Recorded {content_type} impression: {content_id} (Slot {slot_number}, {duration_info}, {play_status})")
                else:
                    logger.debug(f"⏭️  Duplicate impression prevented for slot {slot_number}")
            else:
                logger.warning(f"Failed to record impression for slot {slot_number}")
        
        except Exception as e:
            logger.error(f"Failed to record impression: {e}")
    
    async def play_loop(self):
        """Main playback loop using MPV Dual Player with operating hours enforcement"""
        logger.info("Starting MPV gapless playback loop...")
        
        self.is_running = True
        outside_hours_logged = False  # Prevent log spam
        
        try:
            while self.is_running:
                # Check operating hours before playback
                if not self._check_operating_hours():
                    if not outside_hours_logged:
                        logger.info("⏸️  Pausing playback - outside operating hours")
                        outside_hours_logged = True
                        # Pause MPV if playing
                        if hasattr(self.mpv_player, 'pause'):
                            self.mpv_player.pause()
                    self.is_within_operating_hours = False
                    await asyncio.sleep(60)  # Check again in 1 minute
                    continue
                else:
                    if outside_hours_logged:
                        logger.info("▶️  Resuming playback - within operating hours")
                        outside_hours_logged = False
                    self.is_within_operating_hours = True
                
                # Check if playlist needs refresh
                if not self.playlist:
                    logger.warning("No playlist loaded, waiting...")
                    await asyncio.sleep(5)
                    continue

                # Day-parting: apply the active schedule window (if any) before loading MPV.
                # This runs every outer loop iteration so the correct playlist is used whenever
                # the player restarts after an operating-hours pause or a sync.
                if self.schedule_windows:
                    scheduled = self.get_schedule_active_playlist()
                    if scheduled is not None:
                        self.playlist = scheduled
                        logger.info(f"[Schedule] Using scheduled playlist ({len(self.playlist)} items)")
                    else:
                        if self.cms_default_playlist:
                            self.playlist = list(self.cms_default_playlist)
                        logger.info("[Schedule] No matching window — using default CMS playlist")
                
                # Debug: log playlist structure (local_path already set during download)
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
                        # Check operating hours during playback
                        if not self._check_operating_hours():
                            if self.is_within_operating_hours:  # Just went outside hours
                                logger.info("⏸️  Stopping playback - outside operating hours")
                                self.mpv_player.stop()
                                self.is_within_operating_hours = False
                            break  # Exit inner loop to re-check in outer loop
                        
                        # Periodic check (every 10 seconds)
                        await asyncio.sleep(10)
                else:
                    logger.error("Failed to load playlist, retrying in 30s...")
                    await asyncio.sleep(30)
        
        finally:
            logger.info("Stopping playback...")
            self.mpv_player.stop()
            self.mpv_player.cleanup()
            try:
                cms = getattr(self, "cms_client", None)
                if cms is not None:
                    cms.stop()
            except Exception:
                pass


    
    async def run(self):
        """Main entry point"""
        # Store event loop reference for thread-safe async calls from SignalR callbacks
        self._event_loop = asyncio.get_running_loop()
        
        logger.info("=" * 60)
        logger.info("CCMS Player Starting")
        logger.info("=" * 60)
        
        # Handshake
        if not self.handshake():
            logger.error("Handshake failed, exiting")
            return
        
        # QR Verification mode — block until verified
        if self.verification_mode:
            logger.info("Screen is not verified — entering QR verification loop")
            qr_display = QrVerificationDisplay(
                screen_id=self.screen_id,
                api_key=self.api_key,
                api_url=self.api_url,
                screen_name=self.screen_id,
            )
            verified = qr_display.run_verification_loop()
            if not verified:
                logger.error("Verification loop exited without verification, shutting down")
                return
            
            # Re-handshake to get playlist now that we're verified
            logger.info("Re-performing handshake after verification...")
            if not self.handshake():
                logger.error("Post-verification handshake failed, exiting")
                return
            if self.verification_mode:
                logger.error("Still in verification mode after approval — unexpected state")
                return
        
        # Run cache cleanup on startup
        logger.info("Running cache cleanup check...")
        try:
            await self.cache_manager.cleanup_expired_videos()
        except Exception as e:
            logger.warning(f"Cache cleanup failed: {e}")
        
        # Migrate old slot-based cache to creative-based naming
        try:
            self.cache_manager.migrate_slot_based_cache()
        except Exception as e:
            logger.warning(f"Cache migration failed: {e}")
        
        # Download videos before starting playback
        logger.info("Downloading playlist videos...")
        try:
            await self.download_videos()
        except Exception as e:
            logger.error(f"Video download failed: {e}")
        
        # Download default video if needed
        logger.info("Checking default video...")
        try:
            default_path = await self.default_video_manager.sync_default_video({'playlist': self.playlist})
            if default_path:
                logger.info(f"Default video ready: {default_path}")
                # Set local_path for filler content slots AND any slots with failed downloads
                for idx, item in enumerate(self.playlist):
                    is_filler = item.get('isFillerContent', False) or item.get('IsFillerContent', False)
                    has_local_path = item.get('local_path') is not None
                    slot_number = item.get('slotNumber', 0)
                    
                    if is_filler:
                        self.playlist[idx]['local_path'] = default_path
                        logger.info(f"  Set default video for slot {slot_number}")
                    elif not has_local_path:
                        # Fallback to default video for failed downloads
                        self.playlist[idx]['local_path'] = default_path
                        logger.info(f"  Set default video as fallback for slot {slot_number} (download failed)")
            else:
                logger.warning("No default video configured")
        except Exception as e:
            logger.error(f"Default video sync failed: {e}")
        
        # Connect to SignalR for real-time events
        try:
            self.connect_signalr()
        except Exception as e:
            logger.warning(f"SignalR connection failed (will continue with HTTP only): {e}")

        # Connect to CMS control hub (for CmsOwner-owned screens; marketplace
        # screens simply never receive commands). Non-fatal if it fails.
        try:
            from cms_control_client import CmsControlClient
            from remote_command_handler import RemoteCommandHandler

            self.cms_client = CmsControlClient(
                api_url=self.api_url,
                screen_id=self.screen_id,
                api_key=self.api_key,
            )
            self.cms_command_handler = RemoteCommandHandler(
                mpv_player=self.mpv_player,
                cms_client=self.cms_client,
                on_force_sync=lambda: self.handshake(),
            )
            self.cms_client.set_on_command(self.cms_command_handler.handle)
            self.cms_client.set_on_playlist_updated(lambda _evt: self.handshake())
            self.cms_client.connect()
        except Exception as e:
            logger.warning(f"CMS hub connection failed (non-fatal): {e}")
        
        
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
        playlist_refresh_task = asyncio.create_task(self.playlist_refresh_loop())
        schedule_task = asyncio.create_task(self.schedule_check_loop())
        
        try:
            await self.play_loop()
        except KeyboardInterrupt:
            logger.info("Shutdown requested")
        finally:
            self.is_running = False
            heartbeat_task.cancel()
            sync_task.cancel()
            cache_cleanup_task.cancel()
            playlist_refresh_task.cancel()
            schedule_task.cancel()
            
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
