"""
Simple WebRTC client using HTTP polling instead of SignalR events
This avoids the signalrcore library reliability issues
"""
import asyncio
import logging
import requests
from webrtc_streamer import WebRTCStreamer

logger = logging.getLogger(__name__)

class SimpleWebRTCPollingClient:
    def __init__(self, api_url, screen_id, api_key, config):
        self.api_url = api_url
        self.screen_id = screen_id
        self.api_key = api_key
        self.config = config
        self.streamer = None
        self.is_running = False
        self.polling_task = None
        
    async def start(self):
        """Start the WebRTC client with HTTP polling."""
        logger.info("[WebRTC-Poll] Starting WebRTC client with HTTP polling...")
        
        try:
            # Import dependencies
            from webrtc_streamer import WebRTCStreamer
            from signalrcore.hub_connection_builder import HubConnectionBuilder
            logger.info("[WebRTC-Poll] WebRTCStreamer imported")
            
            # Create a REAL SignalR connection for sending (offers, ICE)
            # But we'll use HTTP polling for receiving (viewer notifications)
            logger.info("[WebRTC-Poll] Creating SignalR connection for sending...")
            self.signalr_connection = HubConnectionBuilder()\
                .with_url(f"{self.api_url}/hubs/streaming")\
                .with_automatic_reconnect({
                    "type": "interval",
                    "intervals": [1, 2, 5],
                    "keep_alive_interval": 10
                })\
                .build()
            
            # Start SignalR connection (sync call)
            await asyncio.get_event_loop().run_in_executor(None, self.signalr_connection.start)
            logger.info("[WebRTC-Poll] SignalR connection started for sending")
            
            # Initialize streamer with REAL connection
            self.streamer = WebRTCStreamer(self.signalr_connection, self.screen_id)
            logger.info("[WebRTC-Poll] Streamer initialized")
            
            # CRITICAL: Wire up SignalR event handlers for answers and ICE from viewers!
            logger.info("[WebRTC-Poll] Setting up SignalR event handlers...")
            
            def on_answer(viewer_id, answer_sdp):
                logger.info(f"[WebRTC-Poll] Received answer from {viewer_id}")
                asyncio.create_task(self.streamer.handle_answer(viewer_id, answer_sdp))
            
            def on_viewer_ice(viewer_id, candidate_json):
                logger.info(f"[WebRTC-Poll] Received ICE candidate from {viewer_id}")
                asyncio.create_task(self.streamer.handle_ice_candidate(viewer_id, candidate_json))
            
            self.signalr_connection.on("OnAnswer", on_answer)
            self.signalr_connection.on("OnViewerIceCandidate", on_viewer_ice)
            logger.info("[WebRTC-Poll] Event handlers registered!")
            
            # Register stream via HTTP
            logger.info("[WebRTC-Poll] Registering stream via HTTP...")
            response = requests.post(
                f"{self.api_url}/api/streaming/register",
                json={
                    "screenId": self.screen_id,
                    "apiKey": self.api_key
                },
                timeout=5
            )
            if response.status_code == 200:
                logger.info(f"[WebRTC-Poll] Stream registered: {response.json().get('message')}")
            else:
                logger.error(f"[WebRTC-Poll] Registration failed: {response.status_code}")
                return
            
            # Start streaming
            quality = self.config.get('quality', '720p')
            fps = self.config.get('fps', 15)
            logger.info(f"[WebRTC-Poll] Starting video stream ({quality} @ {fps}fps)...")
            await self.streamer.start_streaming(quality=quality, fps=fps)
            logger.info("[WebRTC-Poll] Streaming started!")
            
            # Start polling for viewers
            self.is_running = True
            self.polling_task = asyncio.create_task(self._poll_for_viewers())
            logger.info("[WebRTC-Poll] Polling task started")
            logger.info("[WebRTC-Poll] === READY FOR VIEWERS ===")
            
        except Exception as e:
            logger.error(f"[WebRTC-Poll] Failed to start: {e}")
            import traceback
            traceback.print_exc()
            raise
    
    async def _poll_for_viewers(self):
        """Poll the backend for waiting viewers."""
        logger.info("[WebRTC-Poll] Starting viewer polling loop...")
        
        connected_viewers = set()  # Track viewers we've already connected to
        
        while self.is_running:
            try:
                # Poll backend for waiting viewers
                response = requests.get(
                    f"{self.api_url}/api/streaming/pending-viewers/{self.screen_id}",
                    timeout=2
                )
                
                if response.status_code == 200:
                    data = response.json()
                    viewers = data.get('viewers', [])
                    
                    # Only connect to NEW viewers
                    new_viewers = [v for v in viewers if v not in connected_viewers]
                    
                    if new_viewers:
                        logger.info(f"[WebRTC-Poll] Found {len(new_viewers)} NEW viewer(s)")
                        for viewer_id in new_viewers:
                            logger.info(f"[WebRTC-Poll] >>> CONNECTING TO VIEWER: {viewer_id}")
                            await self.streamer.handle_viewer_connected(viewer_id)
                            connected_viewers.add(viewer_id)
                
            except Exception as e:
                # Don't log every polling error, just continue
                pass
            
            # Poll every 2 seconds
            await asyncio.sleep(2)
    
    async def stop(self):
        """Stop streaming and polling."""
        logger.info("[WebRTC-Poll] Stopping...")
        self.is_running = False
        
        if self.polling_task:
            self.polling_task.cancel()
        
        if self.streamer:
            await self.streamer.stop_streaming()
        
        # Unregister stream
        try:
            requests.post(
                f"{self.api_url}/api/streaming/unregister",
                json={"screenId": self.screen_id},
                timeout=5
            )
        except:
            pass
        
        logger.info("[WebRTC-Poll] Stopped")
    
    def get_viewer_count(self):
        """Get current viewer count."""
        if self.streamer:
            return self.streamer.get_viewer_count()
        return 0
