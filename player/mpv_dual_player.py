"""
MPV Dual Player - Professional Ping-Pong Gapless Playback
Implements dual-instance MPV architecture for zero-gap video transitions
"""

# Setup MPV path on Windows before importing
import sys
import os
if sys.platform == 'win32':
    # Add local mpv_lib directory to PATH for DLL loading
    mpv_lib_path = os.path.join(os.path.dirname(__file__), 'mpv_lib')
    if os.path.exists(mpv_lib_path):
        os.environ['PATH'] = mpv_lib_path + os.pathsep + os.environ.get('PATH', '')

import mpv
import threading
import time
import logging
from typing import Callable, Optional, List, Dict

logger = logging.getLogger(__name__)


class MPVDualPlayer:
    """
    Dual MPV player with ping-pong buffering for gapless playback.
    
    Uses two MPV instances:
    - Active player: Currently playing video
    - Standby player: Preloaded next video (paused at frame 0)
    
    When active video nears end, players swap instantly for zero-gap transition.
    """
    
    def __init__(self, dual_player_mode=False):
        logger.info(f"Initializing MPV Player (dual_player_mode={dual_player_mode})...")
        
        self.dual_player_mode = dual_player_mode
        
        # Common MPV settings optimized for digital signage
        mpv_settings = {
            'hwdec': 'auto',                    # Hardware decode
            'vo': 'gpu',                        # GPU rendering
            'video-sync': 'display-resample',   # Smooth playback
            'keep-open': 'no',                  # Don't pause at end
            'loop-playlist': 'inf' if not dual_player_mode else 'no',  # Loop playlist in single mode
            'pause': False,                     # Start playing immediately
            'fullscreen': True,                 # Fullscreen mode
            'osd-level': 0,                     # No on-screen display
            'quiet': True,                      # Minimal console output
            'input-default-bindings': False,    # No keyboard controls
            'input-vo-keyboard': False,         # No keyboard input
        }
        
        try:
            # Player A - always created
            self.player_a = mpv.MPV(**mpv_settings)
            logger.info("Player A initialized")
            
            # Player B - only in dual mode
            if dual_player_mode:
                self.player_b = mpv.MPV(**mpv_settings)
                logger.info("Player B initialized")
            else:
                self.player_b = None
                logger.info("Single player mode - Player B not created")
            
        except Exception as e:
            logger.error(f"Failed to initialize MPV players: {e}")
            raise
        
        # Player state
        self.active_player = self.player_a
        self.standby_player = self.player_b if dual_player_mode else None
        
        # Playlist management
        self.playlist: List[Dict] = []
        self.current_index: int = 0
        
        # Event callbacks
        self.on_video_start: Optional[Callable] = None
        self.on_video_end: Optional[Callable] = None
        
        # Playback control
        self.is_running = False
        self.monitor_thread: Optional[threading.Thread] = None
        
        mode_desc = "Dual-player ping-pong" if dual_player_mode else "Single player with playlist loop"
        logger.info(f"MPV Player initialized successfully ({mode_desc})")
    
    def load_playlist(self, playlist_items: List[Dict]) -> bool:
        """
        Load playlist and prepare for playback.
        
        Args:
            playlist_items: List of playlist items with video paths
        
        Returns:
            True if successful, False otherwise
        """
        try:
            if not playlist_items:
                logger.error("Empty playlist provided")
                return False
            
            self.playlist = playlist_items
            self.current_index = 0
            
            logger.info(f"Loading playlist with {len(playlist_items)} items")
            
            if self.dual_player_mode:
                # DUAL MODE: Load first in A, preload second in B
                first_video = self._get_video_path(0)
                if not first_video:
                    logger.error("Failed to get first video path")
                    return False
                
                logger.info(f"Loading video 1 in Player A: {first_video}")
                self.active_player.loadfile(first_video)
                self.active_player.pause = True  # Start paused, will unpause on play()
                
                # Preload second video in standby if available
                if len(self.playlist) > 1 and self.standby_player:
                    second_video = self._get_video_path(1)
                    if second_video:
                        logger.info(f"Preloading video 2 in Player B: {second_video}")
                        self.standby_player.loadfile(second_video)
                        self.standby_player.pause = True
            else:
                # SINGLE MODE: Load all videos into playlist
                for idx, item in enumerate(playlist_items):
                    video_path = self._get_video_path(idx)
                    if video_path:
                        if idx == 0:
                            self.player_a.loadfile(video_path)
                        else:
                            self.player_a.playlist_append(video_path)
                        logger.info(f"Added video {idx + 1} to playlist: {video_path}")
                
                self.player_a.pause = True
            
            logger.info("Playlist loaded successfully")
            return True
            
        except Exception as e:
            logger.error(f"Failed to load playlist: {e}")
            return False
    
    def play(self):
        """Start playback and monitoring"""
        try:
            logger.info("Starting playback...")
            
            # Unpause active player
            self.active_player.pause = False
            
            if self.dual_player_mode:
                # Dual mode: Emit start event for first video
                if self.on_video_start:
                    current_item = self.playlist[self.current_index]
                    self.on_video_start(current_item)
                
                # Start monitoring thread for swaps
                self.is_running = True
                self.monitor_thread = threading.Thread(
                    target=self._monitor_playback,
                    daemon=True,
                    name="MPVMonitor"
                )
                self.monitor_thread.start()
            else:
                # Single mode: Use MPV's playlist events
                self.is_running = True
                
                # Emit start event for first video
                if self.on_video_start and len(self.playlist) > 0:
                    self.on_video_start(self.playlist[0])
                
                # Setup event handlers for playlist navigation
                @self.player_a.event_callback('end-file')
                def on_end_file(event):
                    if self.on_video_end and self.current_index < len(self.playlist):
                        logger.info(f"Video ended: index {self.current_index}")
                        self.on_video_end(self.playlist[self.current_index])
                
                @self.player_a.property_observer('playlist-pos')
                def on_playlist_change(name, value):
                    if value is not None and value >= 0:
                        old_index = self.current_index
                        self.current_index = value
                        
                        if value != old_index and self.on_video_start and value < len(self.playlist):
                            logger.info(f"Video started: index {value}")
                            self.on_video_start(self.playlist[value])
            
            logger.info("Playback started")
            
        except Exception as e:
            logger.error(f"Failed to start playback: {e}")
    
    def stop(self):
        """Stop playback"""
        try:
            logger.info("Stopping playback...")
            self.is_running = False
            
            if self.player_a:
                self.player_a.stop()
            if self.player_b:
                self.player_b.stop()
            
            logger.info("Playback stopped")
            
        except Exception as e:
            logger.error(f"Error stopping playback: {e}")
    
    def cleanup(self):
        """Cleanup resources"""
        try:
            logger.info("Cleaning up MPV resources...")
            self.stop()
            
            if self.player_a:
                self.player_a.terminate()
            if self.player_b:
                self.player_b.terminate()
            
            logger.info("Cleanup complete")
            
        except Exception as e:
            logger.error(f"Error during cleanup: {e}")
    
    def _get_video_path(self, index: int) -> Optional[str]:
        """Get video path from playlist item"""
        import os
        
        if index >= len(self.playlist):
            return None
        
        item = self.playlist[index]
        
        # Try local_path first (if set)
        path = (item.get('local_path') or 
                item.get('localPath') or
                item.get('file_path') or
                item.get('filePath'))
        
        if path and os.path.exists(path):
            return path
        
        # Fallback: Look for cached file by slot number
        slot_num = item.get('slotNumber', item.get('slot_number', index + 1))
        cache_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), "video_cache")
        cache_path = os.path.join(cache_dir, f"slot_{slot_num}.mp4")
        
        if os.path.exists(cache_path):
            logger.info(f"Found cached video for slot {slot_num}: {cache_path}")
            return cache_path
        
        logger.error(f"No video found for slot {slot_num} (index {index})")
        return None
    
    def _monitor_playback(self):
        """
        Monitor playback position and trigger swaps.
        Runs in background thread.
        """
        logger.info("Playback monitor started")
        
        swap_triggered = False
        
        while self.is_running:
            try:
                time.sleep(0.1)  # Check every 100ms
                
                # Get current playback state
                try:
                    time_pos = self.active_player.time_pos
                    duration = self.active_player.duration
                except:
                    # Player might not be ready yet
                    continue
                
                if time_pos is None or duration is None:
                    continue
                
                # Calculate time remaining
                time_remaining = duration - time_pos
                
                # Trigger swap at 0.2 seconds before end
                if time_remaining <= 0.2 and not swap_triggered:
                    logger.info(f"Swap trigger: time_pos={time_pos:.2f}, duration={duration:.2f}")
                    self._perform_swap()
                    swap_triggered = True
                
                # Reset swap flag when we're away from the end
                elif time_remaining > 0.5:
                    swap_triggered = False
                
            except Exception as e:
                logger.error(f"Error in playback monitor: {e}")
                time.sleep(0.5)
        
        logger.info("Playback monitor stopped")
    
    def _perform_swap(self):
        """
        Execute ping-pong player swap.
        This is where the magic happens - instant transition!
        """
        try:
            # Emit end event for current video
            if self.on_video_end:
                current_item = self.playlist[self.current_index]
                self.on_video_end(current_item)
            
            # Move to next index
            self.current_index = (self.current_index + 1) % len(self.playlist)
            
            # Swap players
            old_active = self.active_player
            self.active_player = self.standby_player
            self.standby_player = old_active
            
            player_name = "B→A" if self.active_player == self.player_a else "A→B"
            logger.info(f"SWAP {player_name}: Now playing slot {self.current_index + 1}")
            
            # Start new active player
            self.active_player.pause = False
            
            # Emit start event for new video
            if self.on_video_start:
                current_item = self.playlist[self.current_index]
                self.on_video_start(current_item)
            
            # Preload next video in standby player
            next_index = (self.current_index + 1) % len(self.playlist)
            next_video = self._get_video_path(next_index)
            
            if next_video:
                # Stop old video and load new one
                self.standby_player.stop()
                self.standby_player.loadfile(next_video)
                self.standby_player.pause = True
                logger.debug(f"Preloaded next video (slot {next_index + 1})")
            
        except Exception as e:
            logger.error(f"Error during player swap: {e}")
    
    def set_on_started(self, callback: Callable):
        """Set callback for video started event"""
        self.on_video_start = callback
        logger.debug("Video started callback registered")
    
    def set_on_ended(self, callback: Callable):
        """Set callback for video ended event"""
        self.on_video_end = callback
        logger.debug("Video ended callback registered")
