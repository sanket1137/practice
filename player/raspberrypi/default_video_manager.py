"""
Default Video Manager for CCMS Player
Handles downloading and caching of default videos for empty ad slots
"""

import os
import logging
import time
import requests
from pathlib import Path
from typing import Optional

logger = logging.getLogger(__name__)


class DefaultVideoManager:
    """Manages default video downloads and caching for the player"""
    
    def __init__(self, config: dict, screen_id: str):
        """
        Initialize the default video manager
        
        Args:
            config: Player configuration dictionary
            screen_id: Screen ID (GUID)
        """
        self.config = config
        self.screen_id = screen_id
        self.default_video_config = config.get('default_video', {})
        self.default_video_folder = self.default_video_config.get('folder', 'default_videos')
        self.universal_url = self.default_video_config.get('universal_fallback_url')
        self.max_age_days = self.default_video_config.get('max_age_days', 7)
        self.redownload_on_change = self.default_video_config.get('redownload_on_change', True)
        
        # Create default video folder if it doesn't exist
        Path(self.default_video_folder).mkdir(exist_ok=True)
        
    def get_default_video_path(self) -> Path:
        """Get path to local default video file"""
        folder = Path(self.default_video_folder)
        folder.mkdir(exist_ok=True)
        return folder / f"screen_{self.screen_id}_default.mp4"

    def _get_url_marker_path(self, local_path: Path) -> Path:
        """Sidecar file recording which URL local_path was downloaded from."""
        return local_path.with_name(local_path.name + ".url")

    async def sync_default_video(self, playlist_data: dict) -> Optional[str]:
        """
        Download or update default video based on playlist info

        Args:
            playlist_data: Playlist response from server

        Returns:
            Path to local default video file, or None if unavailable
        """
        try:
            # Check if playlist includes default video URL
            # This could be in playlist items marked as IsFillerContent
            default_video_url = self._extract_default_video_url(playlist_data)

            if not default_video_url and not self.universal_url:
                logger.warning("No default video configured (neither custom nor universal)")
                return None

            # Use custom video URL if available, otherwise universal
            url = default_video_url or self.universal_url
            local_path = self.get_default_video_path()

            # Check if we need to download
            if self._should_download(local_path, url):
                await self._download_video(url, local_path)
            else:
                logger.info(f"Using cached default video: {local_path}")

            return str(local_path)

        except Exception as e:
            logger.error(f"Error syncing default video: {e}")
            return None
    
    def _extract_default_video_url(self, playlist_data: dict) -> Optional[str]:
        """
        Extract default video URL from playlist data
        
        Args:
            playlist_data: Playlist response from server
            
        Returns:
            URL to default video or None
        """
        try:
            # Look for filler content in playlist items
            playlist_items = playlist_data.get('playlist', [])
            
            for item in playlist_items:
                if item.get('isFillerContent') or item.get('is_filler_content'):
                    creative_url = item.get('creativeUrl') or item.get('creative_url')
                    if creative_url and not creative_url.startswith('/default'):
                        # Found a custom default video URL
                        return creative_url
            
            # No custom default found
            return None
            
        except Exception as e:
            logger.warning(f"Failed to extract default video URL: {e}")
            return None
    
    def _should_download(self, local_path: Path, url: str) -> bool:
        """
        Check if video needs to be downloaded

        Args:
            local_path: Path to local video file
            url: URL of the video

        Returns:
            True if download is needed
        """
        if not local_path.exists():
            logger.info("Default video not found locally, will download")
            return True

        # Identity check first: age alone can't tell a freshly-uploaded
        # default video apart from a stale one still inside max_age_days.
        # The "redownload_on_change" config option existed but was never
        # actually wired up to anything — this is what it was meant to do.
        if self.redownload_on_change:
            marker = self._get_url_marker_path(local_path)
            if not marker.exists():
                logger.info("No record of which URL the cached default video came from, will redownload")
                return True
            cached_url = marker.read_text(encoding="utf-8").strip()
            if cached_url != url:
                logger.info("Default video URL changed since last download, will redownload")
                return True

        # Check file age
        age_days = (time.time() - local_path.stat().st_mtime) / 86400

        if age_days > self.max_age_days:
            logger.info(f"Default video is {age_days:.1f} days old (max {self.max_age_days}), will redownload")
            return True

        logger.debug(f"Default video age: {age_days:.1f} days, no download needed")
        return False
    
    async def _download_video(self, url: str, destination: Path) -> None:
        """
        Download video file from URL
        
        Args:
            url: Video URL to download
            destination: Local path to save video
        """
        try:
            logger.info(f"Downloading default video from: {url}")
            
            # Make request with streaming
            response = requests.get(url, stream=True, timeout=60)
            response.raise_for_status()
            
            # Get total file size if available
            total_size = int(response.headers.get('content-length', 0))
            downloaded = 0
            
            # Download in chunks
            with open(destination, 'wb') as f:
                for chunk in response.iter_content(chunk_size=8192):
                    if chunk:
                        f.write(chunk)
                        downloaded += len(chunk)
                        
                        # Log progress every 1MB
                        if downloaded % (1024 * 1024) < 8192:
                            if total_size > 0:
                                progress = (downloaded / total_size) * 100
                                logger.debug(f"Download progress: {progress:.1f}%")
            
            file_size_mb = destination.stat().st_size / (1024 * 1024)
            logger.info(f"✓ Default video downloaded successfully: {destination} ({file_size_mb:.2f} MB)")

            self._get_url_marker_path(destination).write_text(url, encoding="utf-8")

        except requests.RequestException as e:
            logger.error(f"Failed to download default video from {url}: {e}")
            raise
        except Exception as e:
            logger.error(f"Unexpected error downloading default video: {e}")
            raise
    
    def get_local_default_video(self) -> Optional[str]:
        """
        Get path to local default video if it exists
        
        Returns:
            Path to local default video or None
        """
        local_path = self.get_default_video_path()
        if local_path.exists():
            return str(local_path)
        return None
    
    def clear_cache(self) -> None:
        """Delete cached default video to force re-download"""
        local_path = self.get_default_video_path()
        if local_path.exists():
            local_path.unlink()
            logger.info(f"Cleared default video cache: {local_path}")
