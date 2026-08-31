"""
MPV Dual Player - Professional Ping-Pong Gapless Playback
Implements dual-instance MPV architecture for zero-gap video transitions,
with automatic fallback to VLC / simulated player on Windows/Linux when libmpv is unavailable.
"""

import sys
import os
import shutil
import threading
import time
import logging
from typing import Callable, Optional, List, Dict

logger = logging.getLogger(__name__)

# Setup MPV path on Windows before importing
if sys.platform == 'win32':
    # Add local mpv_lib directory and other common directories to PATH for DLL loading
    possible_paths = [
        os.path.join(os.path.dirname(__file__), 'mpv_lib'),
        os.path.expandvars(r'%LOCALAPPDATA%\Microsoft\WindowsApps'),
        r'C:\Program Files\mpv',
        r'C:\Program Files (x86)\mpv',
        r'C:\mpv',
    ]
    for path in possible_paths:
        if os.path.exists(path):
            os.environ['PATH'] = path + os.pathsep + os.environ.get('PATH', '')

# Attempt to load mpv library
_MPV_AVAILABLE = False
try:
    import mpv
    _MPV_AVAILABLE = True
    try:
        _stale_flag = os.path.join(os.path.dirname(__file__), "data", "PLAYBACK_ENGINE_DEGRADED.flag")
        if os.path.exists(_stale_flag):
            os.remove(_stale_flag)
    except Exception:
        pass
except (ImportError, OSError) as e:
    # This must be LOUD, not a quiet warning: it silently degrades playback
    # from gapless native MPV to a subprocess-per-clip fallback, which adds
    # multi-second startup overhead to every single slot and breaks the
    # advertised ad schedule (e.g. 6x10s ads taking 70s+ instead of 60s).
    # A status flag file is also written so this is monitorable/alertable
    # without having to grep logs.
    logger.critical(
        "=" * 70 + "\n"
        "libmpv FAILED TO LOAD — falling back to a per-clip subprocess engine.\n"
        f"Reason: {e}\n"
        "This is NOT gapless: every ad relaunches a new VLC/mpv process,\n"
        "adding multi-second overhead per slot and breaking schedule timing.\n"
        "On Raspberry Pi: run setup-raspberry-pi.sh (installs libmpv2/libmpv1).\n"
        "On Windows (dev/test only): install a full mpv build with libmpv-2.dll,\n"
        "see README.md 'Testing on Windows'.\n" + "=" * 70
    )
    try:
        status_path = os.path.join(os.path.dirname(__file__), "data", "PLAYBACK_ENGINE_DEGRADED.flag")
        os.makedirs(os.path.dirname(status_path), exist_ok=True)
        with open(status_path, "w") as f:
            f.write(f"libmpv unavailable: {e}\n")
    except Exception:
        pass  # best-effort — must never block startup over a status file


class _FallbackPlayer:
    """
    Fallback video player for systems without libmpv (e.g. Windows without libmpv-2.dll).
    Provides identical interface and event triggers (on_video_start / on_video_end).
    """
    def __init__(self, dual_player_mode=False):
        self.dual_player_mode = dual_player_mode
        self.playlist: List[Dict] = []
        self.current_index: int = 0
        self.on_video_start: Optional[Callable] = None
        self.on_video_end: Optional[Callable] = None
        self.is_running = False
        self.is_paused = False
        self.playback_thread: Optional[threading.Thread] = None
        self._current_proc = None
        logger.info(f"Fallback Player initialized (dual_mode={dual_player_mode})")

    def set_on_started(self, callback: Callable):
        self.on_video_start = callback

    def set_on_ended(self, callback: Callable):
        self.on_video_end = callback

    def _get_video_path(self, index: int) -> Optional[str]:
        if index >= len(self.playlist):
            return None
        item = self.playlist[index]
        path = (item.get('local_path') or 
                item.get('localPath') or
                item.get('file_path') or
                item.get('filePath'))
        if path and os.path.exists(path):
            return path
        return None

    def load_playlist(self, playlist_items: List[Dict]) -> bool:
        if not playlist_items:
            return False
        self.playlist = playlist_items
        self.current_index = 0
        logger.info(f"[FallbackPlayer] Loaded {len(playlist_items)} items into playlist")
        return True

    def play(self):
        self.is_running = True
        self.is_paused = False
        if not self.playback_thread or not self.playback_thread.is_alive():
            self.playback_thread = threading.Thread(target=self._run_playback_loop, daemon=True, name="FallbackPlayback")
            self.playback_thread.start()
        logger.info("[FallbackPlayer] Playback started")

    def pause(self):
        self.is_paused = True
        logger.info("[FallbackPlayer] Playback paused")

    def stop(self):
        self.is_running = False
        if self._current_proc:
            try:
                self._current_proc.terminate()
            except Exception:
                pass
        logger.info("[FallbackPlayer] Playback stopped")

    def cleanup(self):
        self.stop()

    def _run_playback_loop(self):
        logger.info("[FallbackPlayer] Playback loop started")
        while self.is_running:
            if self.is_paused:
                time.sleep(0.5)
                continue

            if not self.playlist:
                time.sleep(1)
                continue

            current_item = self.playlist[self.current_index]
            video_path = self._get_video_path(self.current_index)
            duration = current_item.get('durationSeconds') or current_item.get('duration', 10)

            # Trigger video start callback
            if self.on_video_start:
                try:
                    self.on_video_start(current_item)
                except Exception as e:
                    logger.error(f"[FallbackPlayer] Error in on_video_start: {e}")

            # Play the video via VLC or simulated timer
            self._play_single_video(video_path, duration)

            # Trigger video end callback
            if self.on_video_end and self.is_running:
                try:
                    self.on_video_end(current_item)
                except Exception as e:
                    logger.error(f"[FallbackPlayer] Error in on_video_end: {e}")

            # Advance to next item
            if self.is_running:
                self.current_index = (self.current_index + 1) % len(self.playlist)

    def _play_single_video(self, video_path: Optional[str], duration: int):
        # Look for VLC binary or MPV executable
        vlc_bins = [
            shutil.which("vlc"),
            r"C:\Program Files\VideoLAN\VLC\vlc.exe",
            r"C:\Program Files (x86)\VideoLAN\VLC\vlc.exe",
            "/usr/bin/cvlc",
            "/usr/bin/vlc"
        ]
        chosen_vlc = next((b for b in vlc_bins if b and os.path.exists(b)), None)
        mpv_bin = shutil.which("mpv")

        if video_path and os.path.exists(video_path):
            launch_start = time.monotonic()
            if chosen_vlc:
                import subprocess
                # --stop-time forces VLC to stop at the configured slot duration
                # even if the source file is longer — the same schedule-integrity
                # guarantee the native MPV path gets via the `end=` load option.
                cmd = [chosen_vlc, "--play-and-exit", "--no-video-title-show", "--fullscreen",
                       f"--stop-time={duration}", video_path]
                try:
                    self._current_proc = subprocess.Popen(cmd)
                    try:
                        # Small grace only for process teardown, not extra airtime —
                        # --stop-time above is what enforces the actual duration.
                        self._current_proc.wait(timeout=duration + 3)
                    except subprocess.TimeoutExpired:
                        self._current_proc.terminate()
                    elapsed = time.monotonic() - launch_start
                    if elapsed > duration + 1.5:
                        logger.warning(
                            f"[FallbackPlayer] Slot overran by {elapsed - duration:.1f}s "
                            f"(process launch/teardown overhead) — this is the per-clip "
                            f"subprocess engine; install libmpv for gapless native playback."
                        )
                    return
                except Exception as e:
                    logger.warning(f"[FallbackPlayer] VLC launch error: {e}")
            elif mpv_bin:
                import subprocess
                # --length caps playback at the configured slot duration, same
                # schedule-integrity guarantee as the VLC --stop-time above.
                cmd = [mpv_bin, "--fullscreen", "--ontop", "--no-osc", f"--length={duration}", video_path]
                try:
                    self._current_proc = subprocess.Popen(cmd)
                    try:
                        self._current_proc.wait(timeout=duration + 3)
                    except subprocess.TimeoutExpired:
                        self._current_proc.terminate()
                    elapsed = time.monotonic() - launch_start
                    if elapsed > duration + 1.5:
                        logger.warning(
                            f"[FallbackPlayer] Slot overran by {elapsed - duration:.1f}s "
                            f"(process launch/teardown overhead) — this is the per-clip "
                            f"subprocess engine; install libmpv for gapless native playback."
                        )
                    return
                except Exception as e:
                    logger.warning(f"[FallbackPlayer] MPV exec launch error: {e}")

        # Console simulation fallback if no GUI player found
        logger.info(f"[FallbackPlayer] Simulating playback ({duration}s): {video_path}")
        elapsed = 0
        while elapsed < duration and self.is_running and not self.is_paused:
            time.sleep(1)
            elapsed += 1


class MPVDualPlayer:
    """
    Dual MPV player with ping-pong buffering for gapless playback.
    Uses two MPV instances when libmpv is available, or seamless fallback player otherwise.
    """
    def __init__(self, dual_player_mode=False):
        self.dual_player_mode = dual_player_mode
        self._fallback_player = None

        if not _MPV_AVAILABLE:
            logger.info("Initializing Fallback Player Engine (libmpv not installed)...")
            self._fallback_player = _FallbackPlayer(dual_player_mode=dual_player_mode)
            return

        logger.info(f"Initializing MPV Player (dual_player_mode={dual_player_mode})...")
        
        mpv_settings = {
            'hwdec': 'auto',                    # Hardware decode
            'vo': 'gpu',                        # GPU rendering
            'video-sync': 'display-resample',   # Smooth playback
            'keep-open': 'no',                  # Don't pause at end
            'loop-playlist': 'inf' if not dual_player_mode else 'no',
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
            logger.error(f"Failed to initialize MPV players: {e}. Switching to fallback player.")
            self._fallback_player = _FallbackPlayer(dual_player_mode=dual_player_mode)
            return
        
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
    
    def set_on_started(self, callback: Callable):
        if self._fallback_player:
            self._fallback_player.set_on_started(callback)
            return
        self.on_video_start = callback
        logger.debug("Video started callback registered")
    
    def set_on_ended(self, callback: Callable):
        if self._fallback_player:
            self._fallback_player.set_on_ended(callback)
            return
        self.on_video_end = callback
        logger.debug("Video ended callback registered")
    
    def load_playlist(self, playlist_items: List[Dict]) -> bool:
        if self._fallback_player:
            return self._fallback_player.load_playlist(playlist_items)
            
        try:
            if not playlist_items:
                logger.error("Empty playlist provided")
                return False
            
            self.playlist = playlist_items
            self.current_index = 0
            
            logger.info(f"Loading playlist with {len(playlist_items)} items")
            
            if self.dual_player_mode:
                first_video = self._get_video_path(0)
                if not first_video:
                    logger.error("Failed to get first video path")
                    return False

                first_load_opts = self._duration_load_opts(0)
                logger.info(f"Loading video 1 in Player A: {first_video} {first_load_opts or ''}")
                self.active_player.loadfile(first_video, **first_load_opts)
                self.active_player.pause = True

                if len(self.playlist) > 1 and self.standby_player:
                    second_video = self._get_video_path(1)
                    if second_video:
                        second_load_opts = self._duration_load_opts(1)
                        logger.info(f"Preloading video 2 in Player B: {second_video} {second_load_opts or ''}")
                        self.standby_player.loadfile(second_video, **second_load_opts)
                        self.standby_player.pause = True
            else:
                for idx, item in enumerate(playlist_items):
                    video_path = self._get_video_path(idx)
                    if video_path:
                        # Tell MPV itself to stop each file at its configured slot
                        # duration (end=<seconds>) and auto-advance the playlist —
                        # this is the authoritative fix for schedule overrun: a
                        # creative longer than its booked slot gets cut off at the
                        # right time instead of playing to its full native length.
                        load_opts = self._duration_load_opts(idx)
                        if idx == 0:
                            self.player_a.loadfile(video_path, **load_opts)
                        else:
                            self.player_a.playlist_append(video_path, **load_opts)
                        logger.info(f"Added video {idx + 1} to playlist: {video_path} {load_opts or ''}")

                self.player_a.pause = True
            
            logger.info("Playlist loaded successfully")
            return True
            
        except Exception as e:
            logger.error(f"Failed to load playlist: {e}")
            return False
    
    def play(self):
        if self._fallback_player:
            self._fallback_player.play()
            return
            
        try:
            logger.info("Starting playback...")
            self.active_player.pause = False
            
            if self.dual_player_mode:
                if self.on_video_start:
                    current_item = self.playlist[self.current_index]
                    self.on_video_start(current_item)
                
                self.is_running = True
                self.monitor_thread = threading.Thread(
                    target=self._monitor_playback,
                    daemon=True,
                    name="MPVMonitor"
                )
                self.monitor_thread.start()
            else:
                self.is_running = True
                if self.on_video_start and len(self.playlist) > 0:
                    self.on_video_start(self.playlist[0])
                
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

    def pause(self):
        if self._fallback_player:
            self._fallback_player.pause()
            return
        try:
            if self.active_player:
                self.active_player.pause = True
        except Exception as e:
            logger.warning(f"Error pausing MPV player: {e}")
    
    def stop(self):
        if self._fallback_player:
            self._fallback_player.stop()
            return
            
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
        if self._fallback_player:
            self._fallback_player.cleanup()
            return
            
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
        if index >= len(self.playlist):
            return None

        item = self.playlist[index]
        path = (item.get('local_path') or
                item.get('localPath') or
                item.get('file_path') or
                item.get('filePath'))

        if path and os.path.exists(path):
            return path

        slot_num = item.get('slotNumber', item.get('slot_number', index + 1))
        cache_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), "video_cache")
        cache_path = os.path.join(cache_dir, f"slot_{slot_num}.mp4")

        if os.path.exists(cache_path):
            logger.info(f"Found cached video for slot {slot_num}: {cache_path}")
            return cache_path

        logger.error(f"No video found for slot {slot_num} (index {index})")
        return None

    def _duration_load_opts(self, index: int) -> Dict[str, str]:
        """
        Per-file mpv load options enforcing the configured slot duration as a
        hard stop, regardless of the underlying video's own native length.
        Returns {} (no cap) when no configured duration is available, so a
        creative shorter than its slot still plays to completion rather than
        being frozen or looped.
        """
        duration = self._get_slot_duration(index)
        if duration and duration > 0:
            return {'end': str(duration)}
        return {}

    def _get_slot_duration(self, index: int) -> Optional[float]:
        """
        The booking/playlist's configured slot length — the source of truth
        for schedule timing, NOT the video file's own native length. A
        creative that's slightly longer than its assigned slot must never be
        allowed to overrun and push every subsequent ad in the loop later.
        """
        if index >= len(self.playlist):
            return None
        item = self.playlist[index]
        duration = item.get('durationSeconds') or item.get('duration')
        try:
            return float(duration) if duration else None
        except (TypeError, ValueError):
            return None
    
    def _monitor_playback(self):
        logger.info("Playback monitor started")
        swap_triggered = False
        
        while self.is_running:
            try:
                time.sleep(0.1)
                try:
                    time_pos = self.active_player.time_pos
                    duration = self.active_player.duration
                except Exception:
                    continue

                if time_pos is None or duration is None:
                    continue

                # Safety net alongside the per-file `end=` load option (see
                # _duration_load_opts): cap the effective duration at the
                # configured slot length so a creative longer than its booked
                # slot can never overrun the schedule, even if the `end=`
                # option is ignored on some mpv build/version.
                configured = self._get_slot_duration(self.current_index)
                effective_duration = min(duration, configured) if configured else duration

                time_remaining = effective_duration - time_pos
                if time_remaining <= 0.2 and not swap_triggered:
                    logger.info(f"Swap trigger: time_pos={time_pos:.2f}, duration={duration:.2f}")
                    self._perform_swap()
                    swap_triggered = True
                elif time_remaining > 0.5:
                    swap_triggered = False
                
            except Exception as e:
                logger.error(f"Error in playback monitor: {e}")
                time.sleep(0.5)
        
        logger.info("Playback monitor stopped")
    
    def _perform_swap(self):
        try:
            if self.on_video_end:
                current_item = self.playlist[self.current_index]
                self.on_video_end(current_item)
            
            self.current_index = (self.current_index + 1) % len(self.playlist)
            
            old_active = self.active_player
            self.active_player = self.standby_player
            self.standby_player = old_active
            
            player_name = "B→A" if self.active_player == self.player_a else "A→B"
            logger.info(f"SWAP {player_name}: Now playing slot {self.current_index + 1}")
            
            self.active_player.pause = False
            
            if self.on_video_start:
                current_item = self.playlist[self.current_index]
                self.on_video_start(current_item)
            
            next_index = (self.current_index + 1) % len(self.playlist)
            next_video = self._get_video_path(next_index)

            if next_video:
                self.standby_player.stop()
                self.standby_player.loadfile(next_video, **self._duration_load_opts(next_index))
                self.standby_player.pause = True
                logger.debug(f"Preloaded next video (slot {next_index + 1})")
            
        except Exception as e:
            logger.error(f"Error during player swap: {e}")
