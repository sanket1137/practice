"""
Impression Store - Single Source of Truth for Impression Tracking

This module provides guaranteed accurate impression counting with:
- SQLite as the ONLY storage (no in-memory duplicates)
- Deduplication via slot_play_key (screen + date + slot + second)
- Atomic writes that survive power cuts
- Batch sync to server with retry logic
- Real-time SignalR broadcast (for dashboard) - separate from DB sync

Key Guarantee: Each ad play is recorded EXACTLY ONCE, even with:
- Network failures
- Power cuts
- Player restarts
- Concurrent operations
"""

import sqlite3
import hashlib
import uuid
import json
import logging
from datetime import datetime, timezone, timedelta
from pathlib import Path
from typing import Optional, List, Dict, Any, Tuple
from contextlib import contextmanager

logger = logging.getLogger("ImpressionStore")


class ImpressionStore:
    """
    Single source of truth for impression tracking.
    
    Architecture:
    - All impressions written to SQLite immediately
    - Deduplication via unique slot_play_key
    - Background sync to server marks records as synced
    - SignalR broadcast is separate (for real-time dashboard)
    """
    
    def __init__(self, db_path: Path, screen_id: str, server_salt: Optional[str] = None):
        self.db_path = db_path
        self.screen_id = screen_id
        self.server_salt = server_salt
        
        # Ensure data directory exists
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        
        self._init_db()
        self._cleanup_old_synced()
        
        # Stats
        pending_count = self.get_pending_count()
        logger.info(f"[ImpressionStore] Initialized. DB: {db_path}")
        logger.info(f"[ImpressionStore] Screen: {screen_id}")
        logger.info(f"[ImpressionStore] Pending unsynced: {pending_count}")
    
    @contextmanager
    def _get_connection(self):
        """Thread-safe connection context manager"""
        conn = sqlite3.connect(str(self.db_path), timeout=30)
        conn.row_factory = sqlite3.Row
        try:
            yield conn
        finally:
            conn.close()
    
    def _init_db(self):
        """Create tables with proper constraints for deduplication"""
        with self._get_connection() as conn:
            conn.executescript('''
                -- Main impressions table
                CREATE TABLE IF NOT EXISTS impressions (
                    impression_id TEXT PRIMARY KEY,
                    slot_play_key TEXT UNIQUE NOT NULL,
                    screen_id TEXT NOT NULL,
                    booking_id TEXT,
                    campaign_id TEXT,
                    creative_id TEXT,
                    owner_content_id TEXT,
                    slot_number INTEGER NOT NULL,
                    played_at TEXT NOT NULL,
                    played_at_local TEXT,
                    duration_ms INTEGER DEFAULT 10000,
                    duration_seconds INTEGER,
                    expected_duration_seconds INTEGER,
                    was_full_play INTEGER DEFAULT 1,
                    verification_hash TEXT,
                    synced INTEGER DEFAULT 0,
                    sync_attempts INTEGER DEFAULT 0,
                    last_sync_attempt TEXT,
                    server_confirmed INTEGER DEFAULT 0,
                    created_at TEXT NOT NULL
                );
                
                -- Index for efficient pending query
                CREATE INDEX IF NOT EXISTS idx_impressions_synced 
                ON impressions(synced, created_at);
                
                -- Index for slot_play_key lookups
                CREATE INDEX IF NOT EXISTS idx_impressions_slot_play_key 
                ON impressions(slot_play_key);
                
                -- Index for date-based queries
                CREATE INDEX IF NOT EXISTS idx_impressions_played_at 
                ON impressions(played_at);
                
                -- Sync history for debugging
                CREATE TABLE IF NOT EXISTS sync_history (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    sync_time TEXT NOT NULL,
                    impressions_sent INTEGER,
                    impressions_confirmed INTEGER,
                    impressions_duplicate INTEGER,
                    server_response TEXT,
                    success INTEGER
                );
            ''')
            
            # Add new columns if they don't exist (migration for existing DBs)
            try:
                conn.execute('ALTER TABLE impressions ADD COLUMN duration_seconds INTEGER')
            except sqlite3.OperationalError:
                pass  # Column already exists
            try:
                conn.execute('ALTER TABLE impressions ADD COLUMN expected_duration_seconds INTEGER')
            except sqlite3.OperationalError:
                pass
            try:
                conn.execute('ALTER TABLE impressions ADD COLUMN was_full_play INTEGER DEFAULT 1')
            except sqlite3.OperationalError:
                pass
            
            conn.commit()
            logger.info("[ImpressionStore] Database schema initialized")
    
    def _cleanup_old_synced(self, days: int = 7):
        """Remove old synced impressions to keep DB small"""
        cutoff = (datetime.utcnow() - timedelta(days=days)).isoformat()
        with self._get_connection() as conn:
            cursor = conn.execute('''
                DELETE FROM impressions 
                WHERE synced = 1 
                AND server_confirmed = 1 
                AND created_at < ?
            ''', (cutoff,))
            deleted = cursor.rowcount
            conn.commit()
            if deleted > 0:
                logger.info(f"[ImpressionStore] Cleaned up {deleted} old synced impressions")
    
    def generate_slot_play_key(self, slot_number: int, played_at: datetime) -> str:
        """
        Generate unique key for each ad play.
        
        Key format: SHA256(screen_id | date | slot_number | timestamp_second)
        
        This ensures:
        - Same slot can't record twice in same second
        - Different slots can record at same time
        - Different screens have different keys
        """
        # Use second-level precision to allow multiple plays per minute
        # but prevent sub-second duplicates
        timestamp_second = played_at.strftime('%Y-%m-%dT%H:%M:%S')
        
        key_data = f"{self.screen_id}|{played_at.date()}|{slot_number}|{timestamp_second}"
        return hashlib.sha256(key_data.encode()).hexdigest()
    
    def generate_verification_hash(self, impression_data: Dict[str, Any]) -> str:
        """
        Generate tamper-proof hash for impression verification.
        Server can validate this to ensure impression is authentic.
        """
        # Include key fields in hash
        hash_data = {
            'screen_id': self.screen_id,
            'slot_number': impression_data.get('slot_number'),
            'played_at': impression_data.get('played_at'),
            'booking_id': impression_data.get('booking_id'),
            'campaign_id': impression_data.get('campaign_id'),
            'owner_content_id': impression_data.get('owner_content_id'),
        }
        
        # Sort keys for consistent ordering
        canonical = json.dumps(hash_data, sort_keys=True, separators=(',', ':'))
        
        # Include server salt if available
        salt = self.server_salt or ''
        
        return hashlib.sha256(f"{canonical}|{salt}".encode()).hexdigest()[:32]
    
    def record_impression(
        self,
        slot_number: int,
        played_at: datetime,
        booking_id: Optional[str] = None,
        campaign_id: Optional[str] = None,
        creative_id: Optional[str] = None,
        owner_content_id: Optional[str] = None,
        duration_ms: int = 10000,
        duration_seconds: Optional[int] = None,
        expected_duration_seconds: Optional[int] = None,
        was_full_play: bool = True,
        played_at_local: Optional[str] = None
    ) -> Tuple[bool, str, bool]:
        """
        Record an impression with automatic deduplication.
        
        Args:
            slot_number: The slot position in the playlist
            played_at: UTC timestamp when the ad was played
            booking_id: Optional booking ID for campaign content
            campaign_id: Optional campaign ID for campaign content
            creative_id: Optional creative ID for campaign content
            owner_content_id: Optional owner content ID for owner content
            duration_ms: Duration in milliseconds (legacy, use duration_seconds)
            duration_seconds: Actual playback duration in seconds
            expected_duration_seconds: Expected duration from creative metadata
            was_full_play: Whether the ad played completely without interruption
            played_at_local: Optional local timezone timestamp string
        
        Returns:
            Tuple of (success, impression_id, is_new)
            - success: Whether operation completed
            - impression_id: The UUID for this impression
            - is_new: True if new record, False if duplicate
        """
        # Generate unique impression ID
        impression_id = str(uuid.uuid4())
        
        # Generate deduplication key
        slot_play_key = self.generate_slot_play_key(slot_number, played_at)
        
        # Build impression data for hash
        impression_data = {
            'slot_number': slot_number,
            'played_at': played_at.isoformat(),
            'booking_id': booking_id,
            'campaign_id': campaign_id,
            'owner_content_id': owner_content_id,
        }
        
        verification_hash = self.generate_verification_hash(impression_data)
        
        try:
            with self._get_connection() as conn:
                cursor = conn.execute('''
                    INSERT INTO impressions (
                        impression_id, slot_play_key, screen_id,
                        booking_id, campaign_id, creative_id, owner_content_id,
                        slot_number, played_at, played_at_local, duration_ms,
                        duration_seconds, expected_duration_seconds, was_full_play,
                        verification_hash, created_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ''', (
                    impression_id,
                    slot_play_key,
                    self.screen_id,
                    booking_id,
                    campaign_id,
                    creative_id,
                    owner_content_id,
                    slot_number,
                    played_at.isoformat(),
                    played_at_local,
                    duration_ms,
                    duration_seconds,
                    expected_duration_seconds,
                    1 if was_full_play else 0,
                    verification_hash,
                    datetime.utcnow().isoformat()
                ))
                conn.commit()
                
                play_status = "full" if was_full_play else "partial"
                duration_info = f"{duration_seconds}s" if duration_seconds else f"{duration_ms}ms"
                logger.info(
                    f"[ImpressionStore] Recorded: Slot {slot_number} at {played_at.strftime('%H:%M:%S')} "
                    f"({play_status}, {duration_info}) "
                    f"({'Campaign ' + campaign_id[:8] if campaign_id else 'Owner ' + owner_content_id[:8] if owner_content_id else 'Unknown'})"
                )
                return True, impression_id, True
                
        except sqlite3.IntegrityError as e:
            # Duplicate slot_play_key - this exact play already recorded
            if 'slot_play_key' in str(e).lower() or 'unique' in str(e).lower():
                # Get existing impression_id for this slot_play_key
                with self._get_connection() as conn:
                    row = conn.execute(
                        'SELECT impression_id FROM impressions WHERE slot_play_key = ?',
                        (slot_play_key,)
                    ).fetchone()
                    existing_id = row['impression_id'] if row else impression_id
                
                logger.debug(
                    f"[ImpressionStore] Duplicate blocked: Slot {slot_number} at {played_at.strftime('%H:%M:%S')} "
                    f"(key exists)"
                )
                return True, existing_id, False
            else:
                logger.error(f"[ImpressionStore] DB error: {e}")
                return False, impression_id, False
                
        except Exception as e:
            logger.error(f"[ImpressionStore] Failed to record impression: {e}")
            return False, impression_id, False
    
    def get_pending_count(self) -> int:
        """Get count of unsynced impressions"""
        with self._get_connection() as conn:
            row = conn.execute(
                'SELECT COUNT(*) as count FROM impressions WHERE synced = 0'
            ).fetchone()
            return row['count'] if row else 0
    
    def get_pending_impressions(self, limit: int = 500) -> List[Dict[str, Any]]:
        """Get unsynced impressions for batch upload"""
        with self._get_connection() as conn:
            rows = conn.execute('''
                SELECT 
                    impression_id, slot_play_key, screen_id,
                    booking_id, campaign_id, creative_id, owner_content_id,
                    slot_number, played_at, played_at_local, duration_ms,
                    duration_seconds, expected_duration_seconds, was_full_play,
                    verification_hash, sync_attempts, created_at
                FROM impressions 
                WHERE synced = 0 
                ORDER BY created_at ASC
                LIMIT ?
            ''', (limit,)).fetchall()
            
            return [dict(row) for row in rows]
    
    def mark_synced(self, impression_ids: List[str], server_confirmed: bool = True):
        """Mark impressions as successfully synced to server"""
        if not impression_ids:
            return
        
        with self._get_connection() as conn:
            placeholders = ','.join('?' * len(impression_ids))
            conn.execute(f'''
                UPDATE impressions 
                SET synced = 1, 
                    server_confirmed = ?,
                    last_sync_attempt = ?
                WHERE impression_id IN ({placeholders})
            ''', [1 if server_confirmed else 0, datetime.utcnow().isoformat()] + impression_ids)
            conn.commit()
            
        logger.info(f"[ImpressionStore] Marked {len(impression_ids)} impressions as synced")
    
    def increment_sync_attempts(self, impression_ids: List[str]):
        """Increment sync attempt counter for failed syncs"""
        if not impression_ids:
            return
        
        with self._get_connection() as conn:
            placeholders = ','.join('?' * len(impression_ids))
            conn.execute(f'''
                UPDATE impressions 
                SET sync_attempts = sync_attempts + 1,
                    last_sync_attempt = ?
                WHERE impression_id IN ({placeholders})
            ''', [datetime.utcnow().isoformat()] + impression_ids)
            conn.commit()
    
    def log_sync_history(
        self, 
        sent: int, 
        confirmed: int, 
        duplicates: int, 
        response: str, 
        success: bool
    ):
        """Log sync attempt for debugging"""
        with self._get_connection() as conn:
            conn.execute('''
                INSERT INTO sync_history 
                (sync_time, impressions_sent, impressions_confirmed, 
                 impressions_duplicate, server_response, success)
                VALUES (?, ?, ?, ?, ?, ?)
            ''', (
                datetime.utcnow().isoformat(),
                sent,
                confirmed,
                duplicates,
                response[:1000] if response else None,  # Truncate long responses
                1 if success else 0
            ))
            conn.commit()
    
    def get_stats(self) -> Dict[str, Any]:
        """Get impression statistics"""
        with self._get_connection() as conn:
            total = conn.execute('SELECT COUNT(*) FROM impressions').fetchone()[0]
            pending = conn.execute('SELECT COUNT(*) FROM impressions WHERE synced = 0').fetchone()[0]
            synced = conn.execute('SELECT COUNT(*) FROM impressions WHERE synced = 1').fetchone()[0]
            confirmed = conn.execute('SELECT COUNT(*) FROM impressions WHERE server_confirmed = 1').fetchone()[0]
            
            # Today's stats
            today = datetime.utcnow().date().isoformat()
            today_total = conn.execute(
                "SELECT COUNT(*) FROM impressions WHERE played_at LIKE ?",
                (f"{today}%",)
            ).fetchone()[0]
            
            return {
                'total_recorded': total,
                'pending_sync': pending,
                'synced': synced,
                'server_confirmed': confirmed,
                'today_impressions': today_total
            }
    
    def get_daily_summary(self, date: Optional[datetime] = None) -> Dict[str, Any]:
        """Get summary for a specific date"""
        target_date = (date or datetime.utcnow()).date().isoformat()
        
        with self._get_connection() as conn:
            # Total by type
            campaign_count = conn.execute('''
                SELECT COUNT(*) FROM impressions 
                WHERE played_at LIKE ? AND campaign_id IS NOT NULL
            ''', (f"{target_date}%",)).fetchone()[0]
            
            owner_count = conn.execute('''
                SELECT COUNT(*) FROM impressions 
                WHERE played_at LIKE ? AND owner_content_id IS NOT NULL
            ''', (f"{target_date}%",)).fetchone()[0]
            
            # By slot
            slot_counts = conn.execute('''
                SELECT slot_number, COUNT(*) as count 
                FROM impressions 
                WHERE played_at LIKE ?
                GROUP BY slot_number
                ORDER BY slot_number
            ''', (f"{target_date}%",)).fetchall()
            
            return {
                'date': target_date,
                'campaign_impressions': campaign_count,
                'owner_content_impressions': owner_count,
                'total': campaign_count + owner_count,
                'by_slot': {row['slot_number']: row['count'] for row in slot_counts}
            }


# Convenience function for testing
def test_impression_store():
    """Quick test of ImpressionStore functionality"""
    import tempfile
    
    db_path = Path(tempfile.mkdtemp()) / "test_impressions.db"
    store = ImpressionStore(db_path, "test-screen-123")
    
    # Record some test impressions
    now = datetime.utcnow()
    
    # First impression - should succeed
    success1, id1, is_new1 = store.record_impression(
        slot_number=1,
        played_at=now,
        campaign_id="campaign-abc",
        booking_id="booking-123"
    )
    print(f"First: success={success1}, is_new={is_new1}")
    
    # Duplicate (same slot, same second) - should be blocked
    success2, id2, is_new2 = store.record_impression(
        slot_number=1,
        played_at=now,
        campaign_id="campaign-abc",
        booking_id="booking-123"
    )
    print(f"Duplicate: success={success2}, is_new={is_new2}")
    
    # Different slot same time - should succeed
    success3, id3, is_new3 = store.record_impression(
        slot_number=2,
        played_at=now,
        owner_content_id="owner-xyz"
    )
    print(f"Different slot: success={success3}, is_new={is_new3}")
    
    # Same slot, 1 second later - should succeed
    later = now + timedelta(seconds=1)
    success4, id4, is_new4 = store.record_impression(
        slot_number=1,
        played_at=later,
        campaign_id="campaign-abc",
        booking_id="booking-123"
    )
    print(f"One second later: success={success4}, is_new={is_new4}")
    
    # Stats
    print(f"\nStats: {store.get_stats()}")
    print(f"Pending: {len(store.get_pending_impressions())}")
    
    # Cleanup
    import shutil
    shutil.rmtree(db_path.parent)


if __name__ == "__main__":
    test_impression_store()
