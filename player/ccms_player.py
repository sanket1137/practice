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
import uuid
import shutil
import sqlite3
import hashlib
from datetime import datetime, timedelta, timezone
from pathlib import Path
from collections import defaultdict
import logging

try:
    import requests
    import pytz
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
    IMPRESSION_DB_PATH = BASE_DIR / "impressions.db"  # SQLite for offline queue
    
    SYNC_INTERVAL_MINUTES = 10
    HEARTBEAT_INTERVAL_SECONDS = 30
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
        
        # Initialize offline impression queue (SQLite)
        self._init_impression_db()
        
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
        
        # Track impressions for sync
        self.impressions = defaultdict(lambda: {'playCount': 0, 'lastPlayed': None})
        
        # NEW: Track detailed impressions for 10-minute sync
        self.campaign_summaries = {}  # {campaignId: {bookingId, creativeId, timestamps[]}}
        self.owner_content_summaries = {}  # {ownerContentId: {slotNumber, timestamps[]}}
        
        # Flag to trigger playlist reload when owner content changes
        self.playlist_needs_reload = False
        self.reload_pending_since_slot = None  # Track when reload was requested
        self.current_playing_slot_number = None  # Track current slot
        self.slots_per_frame = 6  # Will be updated from playlist
        
        # HTTP session with retry support
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
        
        # Server salt for impression verification (received from handshake)
        self.server_salt = None
        
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
    
    def _init_impression_db(self):
        """Initialize SQLite database for offline impression queue"""
        try:
            conn = sqlite3.connect(str(Config.IMPRESSION_DB_PATH))
            cursor = conn.cursor()
            
            # Create impressions table if not exists
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS offline_impressions (
                    id TEXT PRIMARY KEY,
                    impression_id TEXT UNIQUE NOT NULL,
                    screen_id TEXT NOT NULL,
                    booking_id TEXT,
                    campaign_id TEXT,
                    creative_id TEXT,
                    owner_content_id TEXT,
                    slot_number INTEGER,
                    played_at TEXT NOT NULL,
                    client_timestamp TEXT NOT NULL,
                    verification_hash TEXT,
                    created_at TEXT NOT NULL,
                    sync_attempts INTEGER DEFAULT 0,
                    last_sync_attempt TEXT
                )
            ''')
            
            # Create index for efficient queries
            cursor.execute('''
                CREATE INDEX IF NOT EXISTS idx_impressions_created 
                ON offline_impressions(created_at)
            ''')
            
            conn.commit()
            conn.close()
            logger.info("[DB] Offline impression queue initialized")
            
            # Clean up old impressions (beyond retention period)
            self._cleanup_old_impressions()
            
        except Exception as e:
            logger.error(f"[DB] Failed to initialize impression database: {e}")
    
    def _cleanup_old_impressions(self):
        """Remove impressions older than retention period"""
        try:
            cutoff_date = (datetime.utcnow() - timedelta(days=Config.MAX_OFFLINE_DAYS)).isoformat()
            conn = sqlite3.connect(str(Config.IMPRESSION_DB_PATH))
            cursor = conn.cursor()
            cursor.execute('DELETE FROM offline_impressions WHERE created_at < ?', (cutoff_date,))
            deleted = cursor.rowcount
            conn.commit()
            conn.close()
            if deleted > 0:
                logger.info(f"[DB] Cleaned up {deleted} old impressions (>{Config.MAX_OFFLINE_DAYS} days)")
        except Exception as e:
            logger.warning(f"[DB] Failed to cleanup old impressions: {e}")
    
    def _queue_impression_offline(self, impression_data: dict):
        """Queue an impression in SQLite for later sync"""
        try:
            impression_id = impression_data.get('impressionId', str(uuid.uuid4()))
            
            conn = sqlite3.connect(str(Config.IMPRESSION_DB_PATH))
            cursor = conn.cursor()
            cursor.execute('''
                INSERT OR IGNORE INTO offline_impressions 
                (id, impression_id, screen_id, booking_id, campaign_id, creative_id, 
                 owner_content_id, slot_number, played_at, client_timestamp, 
                 verification_hash, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ''', (
                str(uuid.uuid4()),
                impression_id,
                self.screen_id,
                impression_data.get('bookingId'),
                impression_data.get('campaignId'),
                impression_data.get('creativeId'),
                impression_data.get('ownerContentId'),
                impression_data.get('slotNumber'),
                impression_data.get('playedAt'),
                impression_data.get('clientTimestamp', datetime.utcnow().isoformat()),
                impression_data.get('verificationHash'),
                datetime.utcnow().isoformat()
            ))
            conn.commit()
            conn.close()
            logger.debug(f"[DB] Queued impression offline: {impression_id}")
        except Exception as e:
            logger.error(f"[DB] Failed to queue impression: {e}")
    
    def _get_pending_impressions(self, limit: int = None) -> list:
        """Get pending impressions from offline queue"""
        try:
            limit = limit or Config.MAX_BATCH_SIZE
            conn = sqlite3.connect(str(Config.IMPRESSION_DB_PATH))
            cursor = conn.cursor()
            cursor.execute('''
                SELECT impression_id, booking_id, campaign_id, creative_id, 
                       owner_content_id, slot_number, played_at, client_timestamp,
                       verification_hash
                FROM offline_impressions 
                ORDER BY created_at ASC 
                LIMIT ?
            ''', (limit,))
            rows = cursor.fetchall()
            conn.close()
            
            return [{
                'impressionId': row[0],
                'bookingId': row[1],
                'campaignId': row[2],
                'creativeId': row[3],
                'ownerContentId': row[4],
                'slotNumber': row[5],
                'playedAt': row[6],
                'clientTimestamp': row[7],
                'verificationHash': row[8]
            } for row in rows]
        except Exception as e:
            logger.error(f"[DB] Failed to get pending impressions: {e}")
            return []
    
    def _remove_synced_impressions(self, impression_ids: list):
        """Remove successfully synced impressions from queue"""
        try:
            conn = sqlite3.connect(str(Config.IMPRESSION_DB_PATH))
            cursor = conn.cursor()
            placeholders = ','.join('?' * len(impression_ids))
            cursor.execute(f'DELETE FROM offline_impressions WHERE impression_id IN ({placeholders})', 
                          impression_ids)
            conn.commit()
            conn.close()
            logger.debug(f"[DB] Removed {len(impression_ids)} synced impressions")
        except Exception as e:
            logger.error(f"[DB] Failed to remove synced impressions: {e}")
    
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
            
            # First, sync any pending offline impressions (from SQLite queue)
            pending_offline = self._get_pending_impressions(Config.MAX_BATCH_SIZE)
            if pending_offline:
                logger.info(f"Found {len(pending_offline)} pending offline impressions to sync")
            
            # Build campaign impressions summary (from old session_data for backwards compat)
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
            
            # Build campaign impressions from new tracking (preferred)
            # Include impression IDs and verification hashes
            for campaign_id, data in self.campaign_summaries.items():
                if data['timestamps']:
                    impression_data = {
                        'bookingId': str(data['bookingId']),
                        'campaignId': str(campaign_id),
                        'creativeId': str(data['creativeId']),
                        'totalSlotsRan': len(data['timestamps']),
                        'playTimestamps': [ts.isoformat() for ts in data['timestamps']]
                    }
                    # Add deduplication IDs if available
                    if 'impressionIds' in data:
                        impression_data['impressionIds'] = data['impressionIds']
                    if 'verificationHashes' in data:
                        impression_data['verificationHashes'] = data['verificationHashes']
                    campaign_impressions.append(impression_data)
            
            # NEW: Build owner content impressions with verification
            owner_content_impressions = []
            for owner_content_id, data in self.owner_content_summaries.items():
                if data['timestamps']:
                    impression_data = {
                        'ownerContentId': str(owner_content_id),
                        'slotNumber': data['slotNumber'],
                        'playTimestamps': [ts.isoformat() for ts in data['timestamps']]
                    }
                    if 'impressionIds' in data:
                        impression_data['impressionIds'] = data['impressionIds']
                    if 'verificationHashes' in data:
                        impression_data['verificationHashes'] = data['verificationHashes']
                    owner_content_impressions.append(impression_data)
            
            # Batch limiting - split into chunks if too large
            total_impressions = sum(len(ci.get('playTimestamps', [])) for ci in campaign_impressions) + \
                               sum(len(oi.get('playTimestamps', [])) for oi in owner_content_impressions)
            
            if total_impressions > Config.MAX_BATCH_SIZE:
                logger.warning(f"Large batch ({total_impressions} impressions) - will sync in batches")
            
            sync_data = {
                'date': self.session_data['date'].isoformat(),
                'startTime': self.session_data['start_time'].strftime("%H:%M:%S"),
                'endTime': now.strftime("%H:%M:%S"),
                'uptime': str(session_duration),
                'downtime': "00:00:00",
                'campaignImpressions': campaign_impressions,
                'ownerContentImpressions': owner_content_impressions,
                'playerVersion': Config.PLAYER_VERSION  # For server-side validation
            }
            
            logger.info(f"Syncing {len(campaign_impressions)} campaign summaries, {len(owner_content_impressions)} owner content summaries...")
            
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
                    
                    # Clear in-memory tracking
                    self.session_data['campaign_impressions'].clear()
                    self.campaign_summaries.clear()
                    self.owner_content_summaries.clear()
                    
                    # Remove synced offline impressions from SQLite
                    if pending_offline:
                        synced_ids = [imp['impressionId'] for imp in pending_offline]
                        self._remove_synced_impressions(synced_ids)
                        logger.info(f"[DB] Removed {len(synced_ids)} synced offline impressions")
                    
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
            logger.info("Registered event handlers: PlaylistUpdated, SlotStatusChanged")
            
            # Start connection
            self.signalr_connection.start()
            logger.info("SignalR connection initiated")
            
        except Exception as e:
            logger.error(f"Failed to connect to SignalR: {e}")
            self.signalr_connected = False
    
    def _on_slot_status_changed(self, data):
        """Called when slot status changes - can trigger playlist refresh"""
        try:
            logger.info(f"📡 SlotStatusChanged event received: {data}")
            # This event is primarily for frontend, but player can use it to detect changes
        except Exception as e:
            logger.error(f"Failed to handle SlotStatusChanged event: {e}")
            
        except Exception as e:
            logger.error(f"Failed to connect to SignalR: {e}")
            self.signalr_connected = False
    
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
            logger.info(f"📡 PlaylistUpdated event received: {data}")
            
            # SignalR passes data as arguments list, get first arg which is the event data object
            event_data = data[0] if isinstance(data, list) else data
            action = event_data.get('action', 'Unknown')
            slot_number = event_data.get('slotNumber', '?')
            
            logger.info(f"🔄 Refreshing playlist due to {action} on slot {slot_number}")
            
            # Fetch fresh playlist from server
            self._refresh_playlist()
            
        except Exception as e:
            logger.error(f"Failed to handle PlaylistUpdated event: {e}")
    
    def _refresh_playlist(self):
        """Fetch and update playlist from server"""
        try:
            logger.info("Fetching updated playlist from server...")
            
            # Use handshake endpoint since there's no dedicated playlist endpoint
            response = self.session.post(
                f"{self.api_url}/api/player/handshake",
                json={"screenId": self.screen_id, "deviceId": f"player-{self.screen_id}"},
                headers={"X-Device-Id": f"player-{self.screen_id}"},
                timeout=10
            )
            
            if response.status_code == 200:
                data = response.json().get("data", {})
                playlist_data = data.get("playlist")
                if playlist_data and isinstance(playlist_data, dict):
                    new_playlist = playlist_data.get("playlist", [])
                    
                    logger.info(f"✓ Playlist refreshed: {len(new_playlist)} items")
                    
                    # Update playlist
                    self.playlist = new_playlist
                    
                    # Update slots_per_frame from new playlist
                    self.slots_per_frame = len(new_playlist)
                    
                    # Defer reload until current frame completes
                    if self.current_playing_slot_number is not None:
                        self.reload_pending_since_slot = self.current_playing_slot_number
                        logger.info(f"🔄 Playlist reload scheduled (currently at slot {self.current_playing_slot_number}, will reload after frame completes)")
                    else:
                        # No playback yet, reload immediately
                        self.playlist_needs_reload = True
                        logger.info("🔄 Playlist reload scheduled (no active playback)")
                else:
                    logger.warning("No playlist in refresh response")
            else:
                logger.error(f"Failed to fetch playlist: HTTP {response.status_code}")
                
        except Exception as e:
            logger.error(f"Failed to refresh playlist: {e}")
    
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
            
            # Check if reload is pending and we're at start of new frame (slot 1)
            if self.reload_pending_since_slot is not None and slot_number == 1:
                logger.info("✅ Frame complete - reloading playlist now")
                self.playlist_needs_reload = True
                self.reload_pending_since_slot = None
            
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
    
    def record_impression(self, item):
        """Record impression for 10-minute sync (skip default/filler videos)
        Includes verification hash for fraud prevention and SQLite queue for offline support
        """
        try:
            # Skip impressions for default/filler content
            is_filler = item.get('isFillerContent', False) or item.get('IsFillerContent', False)
            if is_filler:
                slot = item.get('slotNumber', '?')
                logger.info(f"⏭️  Skipping impression for default video (slot {slot})")
                return
            
            timestamp = datetime.utcnow()
            slot_number = item.get('slotNumber', 0)
            
            # Generate unique impression ID for deduplication
            impression_id = str(uuid.uuid4())
            
            # Generate verification hash
            verification_hash = self._generate_verification_hash(
                self.screen_id, 
                slot_number, 
                timestamp.isoformat()
            )
            
            # Check if this is owner content or booking content
            owner_content_id = item.get('ownerContentId')
            
            if owner_content_id:
                # Owner content impression
                if owner_content_id not in self.owner_content_summaries:
                    self.owner_content_summaries[owner_content_id] = {
                        'slotNumber': slot_number,
                        'timestamps': [],
                        'impressionIds': [],
                        'verificationHashes': []
                    }
                self.owner_content_summaries[owner_content_id]['timestamps'].append(timestamp)
                self.owner_content_summaries[owner_content_id]['impressionIds'].append(impression_id)
                self.owner_content_summaries[owner_content_id]['verificationHashes'].append(verification_hash)
                
                # Also queue to SQLite for offline persistence
                self._queue_impression_offline({
                    'impressionId': impression_id,
                    'ownerContentId': owner_content_id,
                    'slotNumber': slot_number,
                    'playedAt': timestamp.isoformat(),
                    'clientTimestamp': timestamp.isoformat(),
                    'verificationHash': verification_hash
                })
                
                logger.info(f"📊 Recorded owner content impression: Slot {slot_number}")
            else:
                # Booking impression
                campaign_id = item.get('campaignId')
                if campaign_id:
                    if campaign_id not in self.campaign_summaries:
                        self.campaign_summaries[campaign_id] = {
                            'bookingId': item.get('bookingId'),
                            'creativeId': item.get('creativeId'),
                            'timestamps': [],
                            'impressionIds': [],
                            'verificationHashes': []
                        }
                    self.campaign_summaries[campaign_id]['timestamps'].append(timestamp)
                    self.campaign_summaries[campaign_id]['impressionIds'].append(impression_id)
                    self.campaign_summaries[campaign_id]['verificationHashes'].append(verification_hash)
                    
                    # Also queue to SQLite for offline persistence
                    self._queue_impression_offline({
                        'impressionId': impression_id,
                        'bookingId': item.get('bookingId'),
                        'campaignId': campaign_id,
                        'creativeId': item.get('creativeId'),
                        'slotNumber': slot_number,
                        'playedAt': timestamp.isoformat(),
                        'clientTimestamp': timestamp.isoformat(),
                        'verificationHash': verification_hash
                    })
                    
                    logger.info(f"📊 Recorded campaign impression: {campaign_id}")
        
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
                        
                        # Check if playlist needs to be reloaded (owner content changed)
                        if self.playlist_needs_reload:
                            logger.info("🔄 Playlist reload requested - downloading and reloading...")
                            self.playlist_needs_reload = False
                            
                            # Download any new videos
                            await self.download_videos()
                            
                            # Reload playlist in MPV
                            if self.mpv_player.load_playlist(self.playlist):
                                logger.info("✅ Playlist reloaded successfully!")
                                self.mpv_player.play()
                            else:
                                logger.error("Failed to reload playlist")
                        
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
                # Set local_path for filler content slots
                for idx, item in enumerate(self.playlist):
                    is_filler = item.get('isFillerContent', False) or item.get('IsFillerContent', False)
                    if is_filler:
                        self.playlist[idx]['local_path'] = default_path
                        logger.info(f"  Set default video for slot {item.get('slotNumber', 0)}")
            else:
                logger.warning("No default video configured")
        except Exception as e:
            logger.error(f"Default video sync failed: {e}")
        
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
