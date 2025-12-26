"""
WebRTC Streamer for live screen streaming.
Captures the screen and streams it to viewers via WebRTC.
"""

import asyncio
import json
import logging
from typing import Optional, Dict
import mss
import cv2
import numpy as np
from aiortc import RTCPeerConnection, RTCSessionDescription, RTCIceCandidate, VideoStreamTrack, RTCConfiguration, RTCIceServer
from av import VideoFrame
import time

logger = logging.getLogger(__name__)


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
    """
    
    def __init__(self, signalr_connection, screen_id: str, api_url: str = "http://localhost:5257"):
        self.signalr_connection = signalr_connection
        self.screen_id = screen_id
        self.api_url = api_url
        self.peer_connections: Dict[str, RTCPeerConnection] = {}
        self.screen_track: Optional[ScreenCaptureTrack] = None
        self.is_streaming = False
        
        logger.info(f"WebRTC Streamer initialized for screen {screen_id}")
    
    async def start_streaming(self, quality: str = "720p", fps: int = 15):
        """
        Start the screen capture and register as a stream broadcaster.
        """
        logger.info(f"[Streamer] Starting stream: {quality} @ {fps}fps")
        
        if self.is_streaming:
            logger.warning("[Streamer] Already streaming")
            return
        
        try:
            # Initialize screen capture track
            logger.info("[Streamer] Creating screen capture track...")
            self.screen_track = ScreenCaptureTrack(fps=fps, quality=quality)
            logger.info("[Streamer] OK - Screen capture track initialized")
            
            self.is_streaming = True
            
            # Note: Registration handled separately via HTTP in simple_webrtc_client.py
            logger.info(f"[Streamer] OK - Stream ready for screen {self.screen_id}")
            logger.info(f"[Streamer] Quality: {quality}, FPS: {fps}")
            
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
        
        # Close all peer connections
        for viewer_id, pc in list(self.peer_connections.items()):
            await pc.close()
            del self.peer_connections[viewer_id]
        
        # Stop screen capture
        if self.screen_track:
            self.screen_track.stop()
            self.screen_track = None
        
        logger.info(f"Stopped streaming for screen {self.screen_id}")
    
    async def handle_viewer_connected(self, viewer_id: str):
        """
        Handle a new viewer connection - create peer connection and send offer.
        """
        logger.info(f"[WebRTC] >>> handle_viewer_connected CALLED with viewer_id={viewer_id}")
        logger.info(f"[WebRTC] >>> is_streaming={self.is_streaming}, screen_track={self.screen_track}")
        
        if not self.is_streaming:
            logger.warning(f"[WebRTC] >>> REJECTED - Not streaming, cannot accept viewer {viewer_id}")
            return
        
        try:
            logger.info(f"New viewer connected: {viewer_id}")
            
            # Create peer connection with STUN servers for NAT traversal
            # Use RTCConfiguration and RTCIceServer objects (not dicts)
            config = RTCConfiguration(
                iceServers=[
                    RTCIceServer(urls=["stun:stun.l.google.com:19302"]),
                    RTCIceServer(urls=["stun:stun1.l.google.com:19302"])
                ]
            )
            pc = RTCPeerConnection(configuration=config)
            self.peer_connections[viewer_id] = pc
            
            # Add screen track directly (not via relay - simpler and more reliable)
            # Each viewer gets the same track, which generates frames on demand
            logger.info(f"[WebRTC] Adding video track for {viewer_id}")
            pc.addTrack(self.screen_track)
            
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
            candidate = RTCIceCandidate(
                candidate=candidate_dict["candidate"],
                sdpMid=candidate_dict["sdpMid"],
                sdpMLineIndex=candidate_dict["sdpMLineIndex"]
            )
            
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
            url = f"{self.api_url}/api/streaming/send-offer"
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
                    f"{self.api_url}/api/streaming/send-ice-candidate",
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
        Handle viewer disconnection - cleanup peer connection.
        """
        # Close peer connection (use pop to avoid KeyError)
        pc = self.peer_connections.pop(viewer_id, None)
        if pc:
            await pc.close()
            logger.info(f"[WebRTC] Cleaned up resources for viewer {viewer_id}")
    
    def get_viewer_count(self) -> int:
        """
        Get current number of connected viewers.
        """
        return len(self.peer_connections)
