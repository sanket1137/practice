"""
Video Cache Manager
Manages local video cache lifecycle, tracking downloads and cleaning up expired content
"""

import json
import os
import logging
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional
import requests

logger = logging.getLogger("CCMSPlayer")


class CacheManager:
    """Manages video cache storage and cleanup"""
    
    def __init__(self, cache_dir: Path, api_url: str, screen_id: str, api_key: str):
        self.cache_dir = cache_dir
        self.api_url = api_url
        self.screen_id = screen_id
        self.api_key = api_key
        self.manifest_path = cache_dir / "cache_manifest.json"
        self.manifest = self._load_manifest()
        
    def _load_manifest(self) -> Dict:
        """Load cache manifest from disk"""
        if self.manifest_path.exists():
            try:
                with open(self.manifest_path, 'r') as f:
                    return json.load(f)
            except Exception as e:
                logger.warning(f"Failed to load cache manifest: {e}")
                return {'bookings': {}, 'last_cleanup': None}
        return {'bookings': {}, 'last_cleanup': None}
    
    def _save_manifest(self):
        """Save cache manifest to disk"""
        try:
            with open(self.manifest_path, 'w') as f:
                json.dump(self.manifest, f, indent=2, default=str)
        except Exception as e:
            logger.error(f"Failed to save cache manifest: {e}")
    
    def register_download(self, booking_id: str, campaign_id: str, 
                         creative_id: str, file_path: str):
        """Register a downloaded video in the manifest"""
        # Validate inputs - don't register if creative_id is None/empty
        if not creative_id or not booking_id:
            logger.warning(f"Skipping registration: invalid creative_id={creative_id} or booking_id={booking_id}")
            return
            
        booking_key = str(booking_id)
        
        if booking_key not in self.manifest['bookings']:
            self.manifest['bookings'][booking_key] = {
                'campaign_id': campaign_id,
                'videos': []
            }
        
        # Add video if not already tracked
        video_info = {
            'creative_id': creative_id,
            'file_path': file_path,
            'downloaded_at': datetime.now().isoformat(),
            'last_accessed': datetime.now().isoformat()
        }
        
        # Check if already exists
        existing = [v for v in self.manifest['bookings'][booking_key]['videos'] 
                   if v['creative_id'] == creative_id]
        
        if not existing:
            self.manifest['bookings'][booking_key]['videos'].append(video_info)
            self._save_manifest()
            logger.debug(f"Registered video {creative_id} for booking {booking_id}")
    
    async def cleanup_expired_videos(self):
        """Remove videos from expired bookings"""
        logger.info("Starting cache cleanup check...")
        
        try:
            # Query backend for expired bookings
            expired_bookings = await self._fetch_expired_bookings()
            
            if not expired_bookings:
                logger.info("No expired bookings found")
                # Still update last_cleanup timestamp
                self.manifest['last_cleanup'] = datetime.now().isoformat()
                self._save_manifest()
                return
            
            logger.info(f"Found {len(expired_bookings)} expired bookings to clean")
            
            deleted_count = 0
            failed_count = 0
            
            for booking_info in expired_bookings:
                booking_id = str(booking_info['bookingId'])
                
                if booking_id not in self.manifest['bookings']:
                    logger.debug(f"Booking {booking_id} not in cache manifest")
                    continue
                
                # Get videos for this booking
                videos = self.manifest['bookings'][booking_id]['videos']
                
                for video in videos:
                    file_path = video['file_path']
                    creative_id = video['creative_id']
                    
                    # Safety check: verify file exists
                    if not os.path.exists(file_path):
                        logger.debug(f"Video {file_path} already deleted")
                        continue
                    
                    # Safety check: verify not used by other bookings
                    if self.is_creative_used_by_other_bookings(creative_id, booking_id):
                        logger.info(f"Skipping {file_path} - still used by other active booking")
                        continue
                    
                    # Safety check: verify not locked (in use)
                    if self._is_file_locked(file_path):
                        logger.warning(f"Skipping {file_path} - file is locked/in use")
                        failed_count += 1
                        continue
                    
                    # Delete the file
                    try:
                        os.remove(file_path)
                        logger.info(f"Deleted expired cache: {file_path}")
                        deleted_count += 1
                    except Exception as e:
                        logger.error(f"Failed to delete {file_path}: {e}")
                        failed_count += 1
                
                # Remove booking from manifest
                del self.manifest['bookings'][booking_id]
            
            # Update last cleanup time
            self.manifest['last_cleanup'] = datetime.now().isoformat()
            self._save_manifest()
            
            logger.info(f"Cache cleanup complete: {deleted_count} videos deleted, {failed_count} failed")
            
        except Exception as e:
            logger.error(f"Error during cache cleanup: {e}")
    
    async def _fetch_expired_bookings(self) -> List[Dict]:
        """Fetch list of expired bookings from backend"""
        try:
            response = requests.get(
                f"{self.api_url}/api/player/expired-cache/{self.screen_id}",
                headers={"X-API-Key": self.api_key},
                timeout=10
            )
            
            if response.status_code == 200:
                data = response.json().get('data', {})
                return data.get('expiredBookings', [])
            else:
                logger.warning(f"Failed to fetch expired bookings: {response.status_code}")
                return []
                
        except Exception as e:
            logger.error(f"Error fetching expired bookings: {e}")
            return []
    
    def _is_file_locked(self, file_path: str) -> bool:
        """Check if file is currently locked/in use"""
        try:
            # Try to open file in exclusive mode
            with open(file_path, 'a'):
                return False
        except IOError:
            return True
    
    def get_cached_videos_for_booking(self, booking_id: str) -> List[str]:
        """Get list of cached video paths for a booking"""
        booking_key = str(booking_id)
        
        if booking_key not in self.manifest['bookings']:
            return []
        
        return [v['file_path'] for v in self.manifest['bookings'][booking_key]['videos']]
    
    def is_video_cached(self, creative_id: str) -> Optional[str]:
        """Check if video is already cached, return file path if found"""
        for booking_data in self.manifest['bookings'].values():
            for video in booking_data['videos']:
                if video['creative_id'] == creative_id:
                    file_path = video['file_path']
                    if os.path.exists(file_path):
                        # Update last accessed
                        video['last_accessed'] = datetime.now().isoformat()
                        self._save_manifest()
                        return file_path
        return None
    
    def migrate_slot_based_cache(self) -> None:
        """
        Migrate existing slot-based files to creative-based naming.
        Renames files from slot_X.mp4 to {creative_id}.mp4
        """
        logger.info("Checking for slot-based cache migration...")
        migration_count = 0
        
        try:
            for booking_id, booking_data in self.manifest['bookings'].items():
                for video in booking_data['videos']:
                    old_path = video['file_path']
                    creative_id = video['creative_id']
                    
                    # Check if still using old slot-based naming
                    if 'slot_' in old_path and os.path.exists(old_path):
                        # Generate new creative-based filename
                        new_filename = f"{creative_id}.mp4"
                        new_path = os.path.join(self.cache_dir, new_filename)
                        
                        # Skip if target already exists (avoid overwrites)
                        if os.path.exists(new_path):
                            logger.warning(f"Migration skipped: {new_path} already exists")
                            continue
                        
                        try:
                            # Rename file
                            os.rename(old_path, new_path)
                            
                            # Update manifest
                            video['file_path'] = new_path
                            
                            logger.info(f"Migrated: {os.path.basename(old_path)} → {new_filename}")
                            migration_count += 1
                        except Exception as e:
                            logger.error(f"Failed to migrate {old_path}: {e}")
            
            if migration_count > 0:
                self._save_manifest()
                logger.info(f"✓ Cache migration complete: {migration_count} files renamed")
            else:
                logger.info("No slot-based cache files found, migration not needed")
                
        except Exception as e:
            logger.error(f"Error during cache migration: {e}")
    
    def is_creative_used_by_other_bookings(self, creative_id: str, exclude_booking_id: str) -> bool:
        """
        Check if a creative is used by any booking other than the one being cleaned up.
        This prevents deleting shared creative files.
        
        Args:
            creative_id: Creative ID to check
            exclude_booking_id: Booking ID to exclude from check (the one being deleted)
            
        Returns:
            True if creative is used by other bookings
        """
        for booking_id, booking_data in self.manifest['bookings'].items():
            if booking_id == exclude_booking_id:
                continue
                
            for video in booking_data['videos']:
                if video['creative_id'] == creative_id:
                    return True
        
        return False
