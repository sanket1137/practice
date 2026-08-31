"""
WebRTC Streamer for live screen streaming.
Captures the screen and streams it to viewers via WebRTC.

Implements MediaRelay pattern for efficient multi-viewer streaming:
- Single screen capture shared across all viewers
- Frame pump mechanism to drive relay tracks
- Supports up to MAX_VIEWERS concurrent connections
- Optimized for Raspberry Pi resource constraints
"""

import asyncio
import json
import logging
from typing import Optional, Dict, Set
import mss
import cv2
import numpy as np
from aiortc import RTCPeerConnection, RTCSessionDescription, RTCIceCandidate, VideoStreamTrack, RTCConfiguration, RTCIceServer, MediaStreamTrack
from aiortc.contrib.media import MediaRelay
from aiortc.sdp import candidate_from_sdp
from av import VideoFrame
import time

logger = logging.getLogger(__name__)

# Maximum concurrent viewers (optimized for Raspberry Pi)
MAX_VIEWERS = 5


class ScreenCaptureTrack(VideoStreamTrack):
    """
    Video track that captures the screen at a specified frame rate.
    """
    
    def __init__(self, fps: int = 15, quality: str = "720p"):
        super().__init__()
        self.fps = fps
        self.quality = quality
        self.sct = mss.mss()
        self._timestamp = 0
        self._start_time = time.time()
        
        # Initialize aiortc internal state (required for recv() to work)
        # _start is a float timestamp set by next_timestamp() on first call
        # Pre-initialize it so recv() works immediately
        self._start = time.time()
        
        # Quality presets (width, height)
        self.quality_presets = {
            "240p": (426, 240),
            "480p": (854, 480),
            "720p": (1280, 720),
            "1080p": (1920, 1080)
        }
        
        self.target_size = self.quality_presets.get(quality, (1280, 720))
        logger.info(f"Screen capture initialized: {quality} @ {fps}fps")
    
    async def recv(self):
        """
        Capture and return the next video frame.
        This method is called by aiortc's internal media handling.
        """
        pts, time_base = await self.next_timestamp()
        
        # Capture screen
        monitor = self.sct.monitors[1]  # Primary monitor
        screenshot = self.sct.grab(monitor)
        
        # Convert to numpy array (BGRA format from MSS)
        img = np.array(screenshot)
        
        # Convert BGRA to RGB (remove alpha channel)
        if img.shape[2] == 4:
            img = img[:, :, :3]  # Remove alpha channel
            img = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)  # BGR to RGB
        else:
            img = cv2.cvtColor(img, cv2.COLOR_BGRA2RGB)
        
        # Resize to target quality
        img = cv2.resize(img, self.target_size)
        
        # Create video frame
        frame = VideoFrame.from_ndarray(img, format="rgb24")
        frame.pts = pts
        frame.time_base = time_base
        
        # Log frame generation periodically (every ~60 frames / 4 seconds)
        self._timestamp += 1
        if self._timestamp % 60 == 1:
            logger.info(f"[Track] Generating frames... (frame #{self._timestamp}, {frame.width}x{frame.height})")
        
        return frame


class WebRTCStreamer:
    """
    Manages WebRTC connections for streaming screen to viewers.
    
    Uses MediaRelay pattern to efficiently share a single screen capture
    across multiple viewers without duplicating encoding work.
    """
    
    def __init__(self, signalr_connection, screen_id: str, api_url: str = "http://localhost:5257", max_viewers: int = MAX_VIEWERS):
        self.signalr_connection = signalr_connection
        self.screen_id = screen_id
        self.api_url = api_url
        self.max_viewers = max_viewers
        
        # Peer connections: viewer_id -> RTCPeerConnection
        self.peer_connections: Dict[str, RTCPeerConnection] = {}
        
        # Source screen capture track (single instance for all viewers)
        self.screen_track: Optional[ScreenCaptureTrack] = None
        
        # MediaRelay for efficient multi-viewer streaming
        self._relay: Optional[MediaRelay] = None
        
        # Relay tracks per viewer: viewer_id -> relayed MediaStreamTrack
        self._relay_tracks: Dict[str, MediaStreamTrack] = {}
        
        # Frame pump tasks: viewer_id -> asyncio.Task
        # Pumps drive frame consumption for each relay track
        self._pump_tasks: Dict[str, asyncio.Task] = {}
        
        self.is_streaming = False

        # Cached ICE server config fetched from the backend (see
        # _fetch_ice_servers) — avoids hardcoding TURN server infra/credentials
        # in this device client, so they can be rotated server-side only.
        self._ice_servers: Optional[list] = None

        logger.info(f"WebRTC Streamer initialized for screen {screen_id} (max viewers: {max_viewers})")

    async def _fetch_ice_servers(self) -> list:
        """
        Fetches STUN/TURN server config from the backend's ice-config endpoint,
        caching the result for the lifetime of this streamer instance. Falls
        back to public STUN + the openrelay demo TURN relay (its credentials
        are intentionally public) if the backend is unreachable.
        """
        if self._ice_servers is not None:
            return self._ice_servers

        fallback = [
            RTCIceServer(urls=["stun:stun.l.google.com:19302"]),
            RTCIceServer(urls=["stun:stun1.l.google.com:19302"]),
            RTCIceServer(
                urls=["turn:openrelay.metered.ca:443?transport=tcp"],
                username="openrelayproject",
                credential="openrelayproject"
            ),
        ]

        import requests
        try:
            response = await asyncio.get_event_loop().run_in_executor(
                None,
                lambda: requests.get(f"{self.api_url}/api/v1/streaming/ice-config", timeout=5)
            )
            if response.status_code == 200:
                config = response.json().get("data", {})
                servers = [RTCIceServer(urls=[url]) for url in config.get("stunServers", [])]
                for turn in config.get("turnServers", []):
                    servers.append(RTCIceServer(
                        urls=[turn["urls"]],
                        username=turn.get("username"),
                        credential=turn.get("credential"),
                    ))
                servers.append(fallback[-1])  # always keep the public TURN fallback available
                self._ice_servers = servers if servers else fallback
            else:
                logger.warning(f"[WebRTC] ice-config returned {response.status_code}, using fallback ICE servers")
                self._ice_servers = fallback
        except Exception as e:
            logger.warning(f"[WebRTC] Failed to fetch ice-config, using fallback ICE servers: {e}")
            self._ice_servers = fallback

        return self._ice_servers
    
    async def start_streaming(self, quality: str = "720p", fps: int = 15):
        """
        Start the screen capture and register as a stream broadcaster.
        """
        logger.info(f"[Streamer] Starting stream: {quality} @ {fps}fps")
        
        if self.is_streaming:
            logger.warning("[Streamer] Already streaming")
            return
        
        try:
            # Initialize screen capture track (single source for all viewers)
            logger.info("[Streamer] Creating screen capture track...")
            self.screen_track = ScreenCaptureTrack(fps=fps, quality=quality)
            logger.info("[Streamer] OK - Screen capture track initialized")
            
            # Initialize MediaRelay for efficient multi-viewer streaming
            self._relay = MediaRelay()
            logger.info("[Streamer] OK - MediaRelay initialized for multi-viewer support")
            
            self.is_streaming = True
            
            # Note: Registration handled separately via HTTP in simple_webrtc_client.py
            logger.info(f"[Streamer] OK - Stream ready for screen {self.screen_id}")
            logger.info(f"[Streamer] Quality: {quality}, FPS: {fps}, Max Viewers: {self.max_viewers}")
            
        except Exception as e:
            logger.error(f"[Streamer] ERROR - Error starting stream: {e}")
            import traceback
            traceback.print_exc()
            self.is_streaming = False
            raise
    
    async def stop_streaming(self):
        """
        Stop streaming and close all peer connections.
        """
        if not self.is_streaming:
            return
        
        self.is_streaming = False
        
        # Cancel all pump tasks first
        for viewer_id in list(self._pump_tasks.keys()):
            await self._cancel_pump_task(viewer_id)
        
        # Close all peer connections
        for viewer_id, pc in list(self.peer_connections.items()):
            await pc.close()
            del self.peer_connections[viewer_id]
        
        # Clear relay tracks
        self._relay_tracks.clear()
        
        # Stop screen capture
        if self.screen_track:
            self.screen_track.stop()
            self.screen_track = None
        
        # Clear relay
        self._relay = None
        
        logger.info(f"Stopped streaming for screen {self.screen_id}")
    
    async def _pump_frames(self, viewer_id: str, track: MediaStreamTrack):
        """
        Frame pump coroutine that drives frame consumption for a relay track.
        This ensures frames are continuously pulled from the source track
        and forwarded to the viewer's peer connection.
        """
        try:
            logger.info(f"[Pump] Starting frame pump for viewer {viewer_id}")
            while True:
                # Pull frame from relay track - this drives the whole pipeline
                frame = await track.recv()
                # Frame is automatically sent via the peer connection
                # Just need to keep the pump running
                await asyncio.sleep(0)  # Yield to event loop
        except asyncio.CancelledError:
            logger.info(f"[Pump] Frame pump cancelled for viewer {viewer_id}")
        except Exception as e:
            logger.error(f"[Pump] Frame pump error for viewer {viewer_id}: {e}")
    
    async def _cancel_pump_task(self, viewer_id: str):
        """
        Cancel the frame pump task for a viewer.
        """
        task = self._pump_tasks.pop(viewer_id, None)
        if task and not task.done():
            task.cancel()
            try:
                await task
            except asyncio.CancelledError:
                pass
            logger.info(f"[Pump] Cancelled pump task for viewer {viewer_id}")
    
    async def handle_viewer_connected(self, viewer_id: str):
        """
        Handle a new viewer connection - create peer connection and send offer.
        Uses MediaRelay to efficiently share screen capture across viewers.
        """
        logger.info(f"[WebRTC] >>> handle_viewer_connected CALLED with viewer_id={viewer_id}")
        logger.info(f"[WebRTC] >>> is_streaming={self.is_streaming}, screen_track={self.screen_track}")
        logger.info(f"[WebRTC] >>> Current viewers: {len(self.peer_connections)}/{self.max_viewers}")
        
        if not self.is_streaming:
            logger.warning(f"[WebRTC] >>> REJECTED - Not streaming, cannot accept viewer {viewer_id}")
            return
        
        # IMPORTANT: Clean up any existing connection for this viewer_id
        # This handles the case where a viewer stops and restarts without page refresh
        if viewer_id in self.peer_connections:
            logger.info(f"[WebRTC] >>> Cleaning up existing connection for viewer {viewer_id}")
            await self._handle_viewer_disconnect(viewer_id)
        
        # Check viewer limit (after cleanup, so reconnecting viewer doesn't count twice)
        if len(self.peer_connections) >= self.max_viewers:
            logger.warning(f"[WebRTC] >>> REJECTED - Max viewers ({self.max_viewers}) reached, rejecting {viewer_id}")
            # TODO: Send rejection message to viewer via HTTP
            return
        
        try:
            logger.info(f"New viewer connected: {viewer_id}")
            
            # Create peer connection with STUN and TURN servers for NAT traversal,
            # fetched from the backend rather than hardcoded (see _fetch_ice_servers).
            # TURN server is essential for connectivity across different networks
            config = RTCConfiguration(iceServers=await self._fetch_ice_servers())
            pc = RTCPeerConnection(configuration=config)
            self.peer_connections[viewer_id] = pc
            
            # Use MediaRelay to create an independent track for this viewer
            # This shares the single screen capture across all viewers efficiently
            logger.info(f"[WebRTC] Creating relay track for {viewer_id}")
            relay_track = self._relay.subscribe(self.screen_track)
            self._relay_tracks[viewer_id] = relay_track
            
            # Add the relay track to peer connection
            logger.info(f"[WebRTC] Adding relay video track for {viewer_id}")
            pc.addTrack(relay_track)
            
            # Start frame pump for this viewer
            pump_task = asyncio.create_task(self._pump_frames(viewer_id, relay_track))
            self._pump_tasks[viewer_id] = pump_task
            logger.info(f"[WebRTC] Started frame pump for {viewer_id}")
            
            # ICE candidate handler - use HTTP to avoid SignalR reliability issues
            @pc.on("icecandidate")
            async def on_ice_candidate(event):
                if event.candidate:
                    candidate_dict = {
                        "candidate": event.candidate.candidate,
                        "sdpMid": event.candidate.sdpMid,
                        "sdpMLineIndex": event.candidate.sdpMLineIndex
                    }
                    logger.info(f"[WebRTC] Sending ICE candidate to {viewer_id}")
                    await self._send_ice_candidate_http(viewer_id, json.dumps(candidate_dict))
            
            # Connection state handler
            @pc.on("connectionstatechange")
            async def on_connection_state_change():
                logger.info(f"[WebRTC] Connection state for {viewer_id}: {pc.connectionState}")
                if pc.connectionState == "connected":
                    logger.info(f"[WebRTC] ✓ Viewer {viewer_id} CONNECTED - video should be streaming!")
                elif pc.connectionState == "failed" or pc.connectionState == "closed":
                    logger.info(f"[WebRTC] Viewer {viewer_id} disconnected (state: {pc.connectionState})")
                    await self._handle_viewer_disconnect(viewer_id)
            
            # Track handler for debugging
            @pc.on("track")
            async def on_track(track):
                logger.info(f"[WebRTC] Track event: {track.kind}")
            
            # Create and send offer
            logger.info(f"[WebRTC] Creating offer for {viewer_id}...")
            offer = await pc.createOffer()
            await pc.setLocalDescription(offer)
            
            offer_dict = {
                "type": pc.localDescription.type,
                "sdp": pc.localDescription.sdp
            }
            
            # Send offer via HTTP (more reliable than SignalR)
            logger.info(f"[WebRTC] Sending offer to {viewer_id}...")
            await self._send_offer_http(viewer_id, json.dumps(offer_dict))
            
            logger.info(f"[WebRTC] ✓ Offer sent to viewer {viewer_id}")
            
        except Exception as e:
            logger.error(f"Error handling viewer {viewer_id}: {e}")
            import traceback
            traceback.print_exc()
            pc = self.peer_connections.pop(viewer_id, None)
            if pc:
                await pc.close()
    
    async def handle_answer(self, viewer_id: str, answer_sdp: str):
        """
        Handle SDP answer from viewer.
        """
        try:
            pc = self.peer_connections.get(viewer_id)
            if not pc:
                logger.warning(f"No peer connection for viewer {viewer_id}")
                return
            
            answer_dict = json.loads(answer_sdp)
            answer = RTCSessionDescription(
                sdp=answer_dict["sdp"],
                type=answer_dict["type"]
            )
            
            await pc.setRemoteDescription(answer)
            logger.info(f"Set remote description for viewer {viewer_id}")
            
        except Exception as e:
            logger.error(f"Error handling answer from {viewer_id}: {e}")
    
    async def handle_ice_candidate(self, viewer_id: str, candidate_json: str):
        """
        Handle ICE candidate from viewer.
        """
        try:
            pc = self.peer_connections.get(viewer_id)
            if not pc:
                logger.warning(f"No peer connection for viewer {viewer_id}")
                return
            
            candidate_dict = json.loads(candidate_json)
            candidate_str = candidate_dict.get("candidate", "")
            
            # Skip empty candidates (end-of-candidates signal)
            if not candidate_str:
                logger.info(f"End-of-candidates signal from {viewer_id}")
                return
            
            # Parse the candidate string using aiortc's parser
            candidate = candidate_from_sdp(candidate_str)
            
            # Set sdpMid and sdpMLineIndex from the received data
            candidate.sdpMid = candidate_dict.get("sdpMid")
            candidate.sdpMLineIndex = candidate_dict.get("sdpMLineIndex")
            
            await pc.addIceCandidate(candidate)
            logger.info(f"Added ICE candidate for viewer {viewer_id}")
            
        except Exception as e:
            logger.error(f"Error handling ICE candidate from {viewer_id}: {e}")
    
    async def handle_viewer_disconnected(self):
        """
        Handle when the last viewer disconnects - optionally stop streaming to save resources.
        """
        logger.info("Last viewer disconnected")
        # Optionally stop streaming when no viewers
        # await self.stop_streaming()
    
    async def _send_offer_http(self, viewer_id: str, offer_sdp: str):
        """
        Send WebRTC offer to viewer via HTTP (more reliable than SignalR).
        """
        import requests
        logger.info(f"[HTTP] Preparing to send offer to viewer {viewer_id}")
        logger.info(f"[HTTP] Offer SDP length: {len(offer_sdp)} bytes")
        try:
            url = f"{self.api_url}/api/v1/streaming/send-offer"
            logger.info(f"[HTTP] Sending POST to {url}")
            response = await asyncio.get_event_loop().run_in_executor(
                None,
                lambda: requests.post(
                    url,
                    json={"viewerId": viewer_id, "offerSdp": offer_sdp},
                    timeout=5
                )
            )
            logger.info(f"[HTTP] Response status: {response.status_code}")
            if response.status_code == 200:
                logger.info(f"[HTTP] Offer sent successfully to {viewer_id}")
            else:
                logger.error(f"[HTTP] Failed to send offer: {response.status_code} - {response.text}")
        except Exception as e:
            logger.error(f"[HTTP] Error sending offer to {viewer_id}: {e}")
            import traceback
            traceback.print_exc()
    
    async def _send_ice_candidate_http(self, viewer_id: str, candidate: str):
        """
        Send ICE candidate to viewer via HTTP.
        """
        import requests
        try:
            response = await asyncio.get_event_loop().run_in_executor(
                None,
                lambda: requests.post(
                    f"{self.api_url}/api/v1/streaming/send-ice-candidate",
                    json={"viewerId": viewer_id, "candidate": candidate},
                    timeout=5
                )
            )
            if response.status_code != 200:
                logger.warning(f"[HTTP] Failed to send ICE candidate: {response.status_code}")
        except Exception as e:
            logger.error(f"[HTTP] Error sending ICE candidate to {viewer_id}: {e}")
    
    async def _handle_viewer_disconnect(self, viewer_id: str):
        """
        Handle viewer disconnection - cleanup peer connection, relay track, and pump task.
        """
        logger.info(f"[WebRTC] Handling disconnect for viewer {viewer_id}")
        
        # Cancel pump task first
        await self._cancel_pump_task(viewer_id)
        
        # Remove relay track
        self._relay_tracks.pop(viewer_id, None)
        
        # Close peer connection (use pop to avoid KeyError)
        pc = self.peer_connections.pop(viewer_id, None)
        if pc:
            await pc.close()
        
        remaining_viewers = len(self.peer_connections)
        logger.info(f"[WebRTC] Cleaned up resources for viewer {viewer_id}, remaining viewers: {remaining_viewers}")
        
        # Optionally stop screen capture if no viewers to save resources
        if remaining_viewers == 0:
            logger.info("[WebRTC] No viewers remaining - screen capture continues for next viewer")
    
    def get_viewer_count(self) -> int:
        """
        Get current number of connected viewers.
        """
        return len(self.peer_connections)
    
    def get_max_viewers(self) -> int:
        """
        Get maximum allowed viewers.
        """
        return self.max_viewers
    
    def is_at_capacity(self) -> bool:
        """
        Check if we've reached max viewer capacity.
        """
        return len(self.peer_connections) >= self.max_viewers
