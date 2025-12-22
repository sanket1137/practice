"""
VLC Manager - Manages VLC playback with event tracking

This module provides a wrapper around python-vlc library to enable:
- Seamless playlist playback with zero transition delays
- Real-time event callbacks when videos start/end
- Integration with CCMS player for SignalR event emission
"""

import vlc
import logging
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
            # Create VLC instance with options
            vlc_args = [
                '--no-video-title-show',  # Don't show filename
                '--fullscreen',           # Fullscreen mode
                '--no-osd',              # No on-screen display
                '--quiet'                # Minimal console output
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
    
    def set_playlist(self, playlist_items: List[Dict]):
        """Set playlist from CCMS playlist data"""
        try:
            self.playlist = playlist_items
            self.media_list = self.vlc_instance.media_list_new()
            
            video_count = 0
            for item in playlist_items:
                creative_url = item.get('creativeUrl', '')
                # Skip filler/default content
                if creative_url and not creative_url.startswith('/default/'):
                    media = self.vlc_instance.media_new(creative_url)
                    self.media_list.add_media(media)
                    video_count += 1
            
            self.player.set_media_list(self.media_list)
            self.player.set_playback_mode(vlc.PlaybackMode.loop)
            
            logger.info(f"Playlist set: {video_count} videos from {len(playlist_items)} items")
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
