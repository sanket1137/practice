"""
WebRTC Streamer for live screen streaming.
Captures the screen and streams it to viewers via WebRTC.
"""

import asyncio
import json
import logging
from typing import Optional, Dict, Any
import mss
import cv2
import numpy as np
from aiortc import RTCPeerConnection, RTCSessionDescription, RTCIceCandidate, VideoStreamTrack
from aiortc.contrib.media import MediaRelay
from av import VideoFrame
import time
from fractions import Fraction as Rational

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
        """
        logger.info("[Track] recv() called - generating frame")
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
        
        logger.info(f"[Track] Frame generated: {frame.width}x{frame.height}")
        return frame


class WebRTCStreamer:
    """
    Manages WebRTC connections for streaming screen to viewers.
    """
    
    def __init__(self, signalr_connection, screen_id: str):
        self.signalr_connection = signalr_connection
        self.screen_id = screen_id
        self.peer_connections: Dict[str, RTCPeerConnection] = {}
        self.screen_track: Optional[ScreenCaptureTrack] = None
        self.relay = MediaRelay()
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
            logger.info("[Streamer] ✅ Screen capturetrack initialized")
            
            self.is_streaming = True
            
            # Note: Registration handled separately via HTTP in simple_webrtc_client.py
            logger.info(f"[Streamer] ✅✅ Stream ready for screen {self.screen_id}")
            logger.info(f"[Streamer] Quality: {quality}, FPS: {fps}")
            
        except Exception as e:
            logger.error(f"[Streamer] ❌ Error starting stream: {e}")
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
        if not self.is_streaming:
            logger.warning("Not streaming, cannot accept viewer")
            return
        
        try:
            logger.info(f"New viewer connected: {viewer_id}")
            
            # Create peer connection
            pc = RTCPeerConnection()
            self.peer_connections[viewer_id] = pc
            
            # Add screen track via MediaRelay (required for aiortc to start consuming frames)
            logger.info(f"[WebRTC] Adding video track via relay for {viewer_id}")
            pc.addTrack(self.relay.subscribe(self.screen_track))
            
            # ICE candidate handler
            @pc.on("icecandidate")
            async def on_ice_candidate(event):
                if event.candidate:
                    candidate_dict = {
                        "candidate": event.candidate.candidate,
                        "sdpMid": event.candidate.sdpMid,
                        "sdpMLineIndex": event.candidate.sdpMLineIndex
                    }
                    await asyncio.get_event_loop().run_in_executor(
                        None,
                        self.signalr_connection.send,
                        "SendIceCandidate",
                        [viewer_id, json.dumps(candidate_dict)]
                    )
            
            # Connection state handler
            @pc.on("connectionstatechange")
            async def on_connection_state_change():
                logger.info(f"Connection state for {viewer_id}: {pc.connectionState}")
                if pc.connectionState == "failed" or pc.connectionState == "closed":
                    if viewer_id in self.peer_connections:
                        del self.peer_connections[viewer_id]
            
            # Create and send offer
            offer = await pc.createOffer()
            await pc.setLocalDescription(offer)
            
            offer_dict = {
                "type": pc.localDescription.type,
                "sdp": pc.localDescription.sdp
            }
            
            await asyncio.get_event_loop().run_in_executor(
                None,
               self.signalr_connection.send,
                "SendOffer",
                [viewer_id, json.dumps(offer_dict)]
            )
            
            logger.info(f"Sent offer to viewer {viewer_id}")
            
        except Exception as e:
            logger.error(f"Error handling viewer {viewer_id}: {e}")
            if viewer_id in self.peer_connections:
                await self.peer_connections[viewer_id].close()
                del self.peer_connections[viewer_id]
    
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
    
    def get_viewer_count(self) -> int:
        """
        Get current number of connected viewers.
        """
        return len(self.peer_connections)
