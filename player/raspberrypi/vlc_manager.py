"""
VLC Manager - Manages VLC playback with event tracking

This module provides a wrapper around python-vlc library to enable:
- Seamless playlist playback with zero transition delays
- Real-time event callbacks when videos start/end
- Integration with CCMS player for SignalR event emission
"""

import vlc
import logging
import time
import os
import requests
from typing import Callable, Optional, List, Dict
from datetime import datetime

logger = logging.getLogger(__name__)


class VLCManager:
    """Manages VLC playback with event tracking"""
    
    def __init__(self):
        self.vlc_instance: Optional[vlc.Instance] = None
        self.player: Optional[vlc.MediaListPlayer] = None
        self.media_player: Optional[vlc.MediaPlayer] = None
        self.media_list: Optional[vlc.MediaList] = None
        
        self.playlist: List[Dict] = []
        self.current_index: int = 0
        
        # Event callbacks
        self.on_started_callback: Optional[Callable] = None
        self.on_ended_callback: Optional[Callable] = None
    
    def initialize(self) -> bool:
        """Initialize VLC instance and player"""
        try:
            # Create VLC instance with software rendering for Windows compatibility
            # Optimized for LOCAL file playback (minimal caching needed)
            vlc_args = [
                '--no-video-title-show',  # Don't show filename
                '--no-osd',              # No on-screen display
                '--avcodec-hw=none',     # Disable hardware decoding
                '--vout=directdraw',     # Use DirectDraw (software rendering)
                '--file-caching=300',    # Minimal cache for local files (0.3 sec)
                '--video-on-top',        # Keep window on top
                '--no-embedded-video',   # Don't embed in interface
                '--verbose=2'            # Show errors
            ]
            
            logger.info("Initializing VLC instance...")
            self.vlc_instance = vlc.Instance(vlc_args)
            self.player = self.vlc_instance.media_list_player_new()
            self.media_player = self.player.get_media_player()
            
            # Set up event handlers on MediaPlayer
            media_event_manager = self.media_player.event_manager()
            
            # Video ended
            media_event_manager.event_attach(
                vlc.EventType.MediaPlayerEndReached,
                self._on_ended
            )
            
            # Set up event handler on MediaListPlayer for item changes
            list_event_manager = self.player.event_manager()
            
            # This fires when playlist advances to next item
            list_event_manager.event_attach(
                vlc.EventType.MediaListPlayerNextItemSet,
                self._on_next_item
            )
            
            logger.info("VLC Manager initialized successfully")
            return True
            
        except Exception as e:
            logger.error(f"Failed to initialize VLC: {e}")
            import traceback
            logger.error(f"Traceback: {traceback.format_exc()}")
            return False
    
    def _download_video(self, url: str, slot_num: int) -> Optional[str]:
        """Download video to cache for gapless playback"""
        try:
            cache_dir = os.path.join(os.path.dirname(__file__), 'video_cache')
            os.makedirs(cache_dir, exist_ok=True)
            
            # Extract filename from URL
            filename = url.split('/')[-1]
            local_path = os.path.join(cache_dir, filename)
            
            # Check if already cached
            if os.path.exists(local_path):
                logger.info(f"[SLOT {slot_num}] Using cached: {filename}")
                return local_path
            
            # Download
            logger.info(f"[SLOT {slot_num}] Downloading: {filename}")
            response = requests.get(url, stream=True, timeout=30)
            response.raise_for_status()
            
            with open(local_path, 'wb') as f:
                for chunk in response.iter_content(chunk_size=8192):
                    f.write(chunk)
            
            logger.info(f"[SLOT {slot_num}] Downloaded: {filename}")
            return local_path
            
        except Exception as e:
            logger.error(f"[SLOT {slot_num}] Download failed: {e}")
            return None
    
    def set_playlist(self, playlist_items: List[Dict]) -> bool:
        """Set the playlist from items - Pre-downloads ALL videos first for gapless playback"""
        try:
            if not self.vlc_instance:
                logger.error("VLC instance not initialized")
                return False
            
            self.playlist = playlist_items
            self.media_list = self.vlc_instance.media_list_new()
            
            logger.info("="*60)
            logger.info(f"VLC: Processing {len(playlist_items)} playlist items")
            logger.info("PHASE 1: Pre-downloading ALL videos for gapless playback")
            logger.info("="*60)
            
            # PHASE 1: Download ALL videos FIRST
            downloaded_paths = []
            for idx, item in enumerate(playlist_items):
                # Debug: log the full item to see its structure
                logger.info(f"[DEBUG] Playlist item {idx}: {item}")
                
                creative_url = item.get('creativeUrl', '') or item.get('creative_url', '') or item.get('url', '')
                slot_num = item.get('slotNumber', item.get('slot_number', idx + 1))
                
                logger.info(f"[DEBUG] Slot {slot_num}: creative_url = '{creative_url}'")
                
                if not creative_url or creative_url.startswith('/default/'):
                    logger.info(f"[SLOT {slot_num}] Skipping - no valid URL")
                    continue
                    continue
                
                # Convert relative URLs to absolute
                if creative_url.startswith('/'):
                    creative_url = f"http://localhost:5257{creative_url}"
                
                logger.info(f"[SLOT {slot_num}] Pre-downloading: {creative_url}")
                local_path = self._download_video(creative_url, slot_num)
                
                if local_path:
                    downloaded_paths.append((slot_num, local_path))
                else:
                    logger.error(f"[SLOT {slot_num}] Download FAILED!")
            
            logger.info("="*60)
            logger.info(f"PHASE 2: Building VLC playlist from {len(downloaded_paths)} cached videos")
            logger.info("="*60)
            
            # PHASE 2: Add cached videos to VLC playlist
            video_count = 0
            for slot_num, local_path in downloaded_paths:
                try:
                    logger.info(f"[SLOT {slot_num}] Adding: {local_path}")
                    media = self.vlc_instance.media_new(local_path)
                    self.media_list.add_media(media)
                    video_count += 1
                except Exception as e:
                    logger.error(f"[SLOT {slot_num}] Failed: {e}")
            
            self.player.set_media_list(self.media_list)
            self.player.set_playback_mode(vlc.PlaybackMode.loop)
            
            logger.info("="*60)
            logger.info(f"READY: {video_count} videos loaded (all cached locally)")
            logger.info("Transition time: < 0.5 seconds")
            logger.info("="*60)
            return True
            
        except Exception as e:
            logger.error(f"Failed to set playlist: {e}")
            return False
    
    def play(self):
        """Start playback"""
        try:
            self.player.play()
            logger.info("Playback started")
            return True
        except Exception as e:
            logger.error(f"Failed to start playback: {e}")
            return False
    
    def stop(self):
        """Stop playback"""
        try:
            if self.player:
                self.player.stop()
            logger.info("Playback stopped")
        except Exception as e:
            logger.error(f"Error stopping playback: {e}")
    
    def _on_next_item(self, event):
        """Called when MediaListPlayer advances to next item"""
        try:
            if self.current_index < len(self.playlist):
                item = self.playlist[self.current_index]
                
                slot_number = item.get('slotNumber', '?')
                creative_id = str(item.get('creativeId', 'unknown'))[:8]
                
                logger.info(f"NOW PLAYING: Slot {slot_number} (Creative {creative_id}...)")
                
                # Trigger callback
                if self.on_started_callback:
                    self.on_started_callback(item)
        
        except Exception as e:
            logger.error(f"Error in _on_next_item: {e}")
    
    def _on_ended(self, event):
        """Called when video finishes"""
        try:
            if self.current_index < len(self.playlist):
                item = self.playlist[self.current_index]
                
                slot_number = item.get('slotNumber', '?')
                creative_id = str(item.get('creativeId', 'unknown'))[:8]
                
                logger.info(f"COMPLETED: Slot {slot_number} (Creative {creative_id}...)")
                
                # Trigger callback
                if self.on_ended_callback:
                    self.on_ended_callback(item)
                
                # Move to next
                self.current_index = (self.current_index + 1) % len(self.playlist)
        
        except Exception as e:
            logger.error(f"Error in _on_ended: {e}")
    
    def set_on_started(self, callback: Callable):
        """Set callback for video started"""
        self.on_started_callback = callback
        logger.debug("Video started callback registered")
    
    def set_on_ended(self, callback: Callable):
        """Set callback for video ended"""
        self.on_ended_callback = callback
        logger.debug("Video ended callback registered")
    
    def start_tracking(self):
        """Start background thread to track playback"""
        import threading
        import time
        
        def track_playback():
            """Poll VLC to detect video changes"""
            last_index = -1
            
            while True:
                try:
                    time.sleep(1)  # Check every second
                    
                    # Check if we're still supposed to be running
                    if not self.player or not self.media_player:
                        break
                    
                    # Get current state
                    state = self.media_player.get_state()
                    
                    # If playing, track which video
                    if state == vlc.State.Playing:
                        # Video changed?
                        if self.current_index != last_index:
                            # New video started
                            if self.current_index < len(self.playlist):
                                item = self.playlist[self.current_index]
                                slot_number = item.get('slotNumber', '?')
                                creative_id = str(item.get('creativeId', 'unknown'))[:8]
                                
                                logger.info(f"NOW PLAYING: Slot {slot_number} (Creative {creative_id}...)")
                                
                                # Trigger started callback
                                if self.on_started_callback:
                                    self.on_started_callback(item)
                                
                                # If there was a previous video, trigger ended callback
                                if last_index >= 0 and last_index < len(self.playlist):
                                    prev_item = self.playlist[last_index]
                                    prev_slot = prev_item.get('slotNumber', '?')
                                    prev_creative = str(prev_item.get('creativeId', 'unknown'))[:8]
                                    
                                    logger.info(f"COMPLETED: Slot {prev_slot} (Creative {prev_creative}...)")
                                    
                                    if self.on_ended_callback:
                                        self.on_ended_callback(prev_item)
                                
                                last_index = self.current_index
                        
                        # Advance index for next check (simulate playlist progression)
                        # Check every 10 seconds if we should move to next
                        media = self.media_player.get_media()
                        if media:
                            duration = media.get_duration()  # milliseconds
                            position = self.media_player.get_position()  # 0.0 to 1.0
                            
                            # If we're near the end (>95%), prepare for next
                            if position > 0.95:
                                next_index = (self.current_index + 1) % len(self.playlist)
                                # Don't update yet, wait for actual transition
                    
                    elif state == vlc.State.Ended:
                        # Video just ended, advance
                        if last_index >= 0 and last_index < len(self.playlist):
                            self.current_index = (self.current_index + 1) % len(self.playlist)
                
                except Exception as e:
                    logger.error(f"Error in playback tracking: {e}")
                    time.sleep(1)
        
        # Start tracking thread
        track_thread = threading.Thread(target=track_playback, daemon=True)
        track_thread.start()
        logger.info("Playback tracking thread started")
    
    def cleanup(self):
        """Cleanup VLC resources"""
        try:
            logger.info("Cleaning up VLC resources...")
            if self.player:
                self.player.stop()
            if self.media_list:
                self.media_list.release()
            if self.vlc_instance:
                self.vlc_instance.release()
            logger.info("VLC resources cleaned up")
        except Exception as e:
            logger.error(f"Error during cleanup: {e}")
