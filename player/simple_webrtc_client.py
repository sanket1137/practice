"""
Simple WebRTC Integration for HTTP-based Player
This creates a separate SignalR connection just for WebRTC streaming.
"""

import asyncio
import logging
from signalrcore.hub_connection_builder import HubConnectionBuilder

logger = logging.getLogger("WebRTCClient")


class SimpleWebRTCClient:
    """
    Simplified WebRTC client that runs alongside the HTTP player.
    Creates its own SignalR connection to the StreamingHub for WebRTC signaling.
    """
    
    def __init__(self, api_url, screen_id, api_key, config):
        self.api_url = api_url
        self.screen_id = screen_id
        self.api_key = api_key
        self.config = config
        self.connection = None
        self.streamer = None
        self.is_running = False
        
    async def start(self):
        """Start the WebRTC client and streaming."""
        logger.info("[WebRTC] ========== START CALLED ==========")
        logger.info(f"[WebRTC] Config enabled: {self.config.get('enabled', False)}")
        logger.info(f"[WebRTC] API URL: {self.api_url}")
        logger.info(f"[WebRTC] Screen ID: {self.screen_id}")
        logger.info(f"[WebRTC] API Key: {self.api_key[:10]}..." if self.api_key else "[WebRTC] API Key: None")
        
        if not self.config.get('enabled', False):
            logger.warning("[WebRTC] ⚠️ Streaming disabled in config - exiting")
            return
        
        try:
            logger.info("[WebRTC] Step 1: Importing WebRTCStreamer...")
            from webrtc_streamer import WebRTCStreamer
            logger.info("[WebRTC] ✅ WebRTCStreamer imported successfully")
            
            # Create SignalR connection to StreamingHub
            hub_url = f"{self.api_url}/hubs/streaming"
            logger.info(f"[WebRTC] Step 2: Creating SignalR connection to: {hub_url}")
            
            self.connection = HubConnectionBuilder()\
                .with_url(hub_url, options={
                    "access_token_factory": lambda: self.api_key,
                    "headers": {
                        "X-API-Key": self.api_key
                    }
                })\
                .with_automatic_reconnect({
                    "type": "interval",
                    "intervals": [0, 2, 5, 10, 30, 60]
                })\
                .build()
            logger.info("[WebRTC] ✅ Connection builder created")
            
            # Initialize WebRTC streamer BEFORE connecting
            logger.info("[WebRTC] Step 3: Initializing WebRTC streamer...")
            self.streamer = WebRTCStreamer(self.connection, self.screen_id)
            logger.info("[WebRTC] ✅ Streamer initialized")
            
            # Register event handlers
            logger.info("[WebRTC] Step 4: Registering event handlers...")
            self.connection.on("OnViewerConnected", self.handle_viewer_connected)
            self.connection.on("OnAnswer", self.handle_answer)
            self.connection.on("OnViewerIceCandidate", self.handle_ice_candidate)
            self.connection.on("OnLastViewerDisconnected", self.handle_last_viewer)
            logger.info("[WebRTC] ✅ Event handlers registered")
            
            # Start connection (MUST await for async SignalR)
            logger.info("[WebRTC] Step 5: Starting SignalR connection...")
            await asyncio.get_event_loop().run_in_executor(None, self.connection.start)
            logger.info("[WebRTC] ✅✅ SignalR connection established!")
            
            # CRITICAL: Register with StreamingHub so it knows our connection ID
            logger.info("[WebRTC] Step 6: Registering with StreamingHub...")
            try:
                # Call RegisterStream hub method
                await asyncio.get_event_loop().run_in_executor(
                    None,
                    self.connection.send,
                    "RegisterStream",
                    [self.screen_id, self.api_key or "test-key"]
                )
                logger.info("[WebRTC] ✅✅ Registered with StreamingHub!")
            except Exception as e:
                logger.error(f"[WebRTC] ⚠️ SignalR RegisterStream failed: {e}")
                logger.info("[WebRTC] Falling back to HTTP registration...")
            
            # Also use HTTP registration as backup
            logger.info("[WebRTC] Step 7: Registering stream via HTTP (backup)...")
            try:
                import requests
                response = requests.post(
                    f"{self.api_url}/api/streaming/register",
                    json={
                        "screenId": self.screen_id,
                        "apiKey": self.api_key
                    },
                    timeout=5
                )
                if response.status_code == 200:
                    logger.info(f"[WebRTC] ✅✅ Stream registered via HTTP: {response.json().get('message')}")
                else:
                    logger.warning(f"[WebRTC] HTTP registration status: {response.status_code}")
            except Exception as e:
                logger.error(f"[WebRTC] HTTP registration error: {e}")
            
            # Start streaming
            quality = self.config.get('quality', '720p')
            fps = self.config.get('fps', 15)
            logger.info(f"[WebRTC] Step 8: Starting video stream ({quality} @ {fps}fps)...")
            
            await self.streamer.start_streaming(quality=quality, fps=fps)
            logger.info(f"[WebRTC] ✅✅✅ STREAMING STARTED SUCCESSFULLY! ✅✅✅")
            logger.info(f"[WebRTC] Stream quality: {quality}, FPS: {fps}")
            
            self.is_running = True
            logger.info("[WebRTC] ========== INITIALIZATION COMPLETE ==========")
            
        except ImportError as e:
            logger.error(f"[WebRTC] ❌ Import Error - WebRTC modules not available: {e}")
            logger.error("[WebRTC] Install dependencies: pip install aiortc av mss")
            import traceback
            traceback.print_exc()
            raise
        except Exception as e:
            logger.error(f"[WebRTC] ❌ FAILED TO START: {e}")
            logger.error("[WebRTC] Full error traceback:")
            import traceback
            traceback.print_exc()
            raise
    
    def handle_viewer_connected(self, viewer_id):
        """Handle new viewer connection."""
        logger.info(f"[WebRTC] >>> VIEWER CONNECTED EVENT: {viewer_id}")
        if self.streamer:
            # SignalR callbacks MUST be sync, so schedule the async work
            asyncio.create_task(self._async_handle_viewer(viewer_id))
    
    def handle_answer(self, viewer_id, answer_sdp):
        """Handle SDP answer from viewer."""
        logger.info(f"[WebRTC] >>> ANSWER RECEIVED from {viewer_id}")
        if self.streamer:
            asyncio.create_task(self._async_handle_answer(viewer_id, answer_sdp))
    
    def handle_ice_candidate(self, viewer_id, candidate_json):
        """Handle ICE candidate from viewer."""
        logger.info(f"[WebRTC] >>> ICE CANDIDATE from {viewer_id}")
        if self.streamer:
            asyncio.create_task(self._async_handle_ice(viewer_id, candidate_json))
    
    def handle_last_viewer(self, screen_id):
        """Handle when last viewer disconnects."""
        logger.info(f"[WebRTC] >>> LAST VIEWER DISCONNECTED from {screen_id}")
    
    async def _async_handle_viewer(self, viewer_id):
        """Async wrapper for viewer connection."""
        try:
            await self.streamer.handle_viewer_connected(viewer_id)
            logger.info(f"[WebRTC] Viewer {viewer_id} setup complete")
        except Exception as e:
            logger.error(f"[WebRTC] Error handling viewer: {e}")
            import traceback
            traceback.print_exc()
    
    async def _async_handle_answer(self, viewer_id, answer_sdp):
        """Async wrapper for SDP answer."""
        try:
            await self.streamer.handle_answer(viewer_id, answer_sdp)
        except Exception as e:
            logger.error(f"[WebRTC] Error handling answer: {e}")
            import traceback
            traceback.print_exc()
    
    async def _async_handle_ice(self, viewer_id, candidate_json):
        """Async wrapper for ICE candidate."""
        try:
            await self.streamer.handle_ice_candidate(viewer_id, candidate_json)
        except Exception as e:
            logger.error(f"[WebRTC] Error handling ICE: {e}")
            import traceback
            traceback.print_exc()
    
    async def stop(self):
        """Stop streaming and close connection."""
        if not self.is_running:
            return
        
        logger.info("[WebRTC] Stopping WebRTC client...")
        
        if self.streamer:
            await self.streamer.stop_streaming()
        
        if self.connection:
            self.connection.stop()
        
        self.is_running = False
        logger.info("[WebRTC] WebRTC client stopped")
    
    def get_viewer_count(self):
        """Get current viewer count."""
        if self.streamer:
            return self.streamer.get_viewer_count()
        return 0
