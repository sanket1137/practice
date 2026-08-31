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
                    "intervals": [1, 2, 5, 10, 30],
                    "keep_alive_interval": 15
                })\
                .build()
            
            # Add connection lifecycle handlers
            def on_open():
                logger.info("[WebRTC-Poll] SignalR connection opened")
            
            def on_close():
                logger.warning("[WebRTC-Poll] SignalR connection closed")
            
            def on_error(error):
                logger.error(f"[WebRTC-Poll] SignalR error: {error}")
            
            def on_reconnect():
                logger.info("[WebRTC-Poll] SignalR reconnecting...")
                # Re-register stream after reconnect
                try:
                    self.signalr_connection.send("RegisterStream", [self.screen_id, self.api_key])
                    logger.info("[WebRTC-Poll] Re-registered stream after reconnect")
                except Exception as e:
                    logger.error(f"[WebRTC-Poll] Failed to re-register: {e}")
            
            self.signalr_connection.on_open(on_open)
            self.signalr_connection.on_close(on_close)
            self.signalr_connection.on_error(on_error)
            self.signalr_connection.on_reconnect(on_reconnect)
            
            # Start SignalR connection (sync call)
            await asyncio.get_event_loop().run_in_executor(None, self.signalr_connection.start)
            logger.info("[WebRTC-Poll] SignalR connection started for sending")
            
            # Initialize streamer with connection and api_url for HTTP fallback
            self.streamer = WebRTCStreamer(self.signalr_connection, self.screen_id, api_url=self.api_url)
            logger.info("[WebRTC-Poll] Streamer initialized")
            
            # CRITICAL: Wire up SignalR event handlers for answers and ICE from viewers!
            logger.info("[WebRTC-Poll] Setting up SignalR event handlers...")
            
            def on_answer(viewer_id, answer_sdp):
                logger.info(f"[WebRTC-Poll] Received answer from {viewer_id}")
                asyncio.create_task(self.streamer.handle_answer(viewer_id, answer_sdp))
            
            def on_viewer_ice(viewer_id, candidate_json):
                logger.info(f"[WebRTC-Poll] Received ICE candidate from {viewer_id}")
                asyncio.create_task(self.streamer.handle_ice_candidate(viewer_id, candidate_json))
            
            def on_viewer_connected(viewer_id):
                """Hub notifies us directly when a viewer connects (real-time, no polling needed)."""
                logger.info(f"[WebRTC-Poll] 🔔 Hub notified: viewer connected: {viewer_id}")
                asyncio.create_task(self.streamer.handle_viewer_connected(viewer_id))
            
            self.signalr_connection.on("OnAnswer", on_answer)
            self.signalr_connection.on("OnViewerIceCandidate", on_viewer_ice)
            self.signalr_connection.on("OnViewerConnected", on_viewer_connected)
            logger.info("[WebRTC-Poll] Event handlers registered!")
            
            # Register stream via SignalR (so hub gets real connection ID)
            logger.info("[WebRTC-Poll] Registering stream via SignalR...")
            try:
                # Call hub method RegisterStream(screenId, streamKey)
                self.signalr_connection.send("RegisterStream", [self.screen_id, self.api_key])
                logger.info("[WebRTC-Poll] Stream registered via SignalR!")
            except Exception as reg_err:
                logger.error(f"[WebRTC-Poll] SignalR registration failed: {reg_err}")
                # Fallback to HTTP registration (won't support direct viewer notifications)
                logger.info("[WebRTC-Poll] Falling back to HTTP registration...")
                response = requests.post(
                    f"{self.api_url}/api/v1/streaming/register",
                    json={
                        "screenId": self.screen_id,
                        "apiKey": self.api_key
                    },
                    timeout=5
                )
                if response.status_code == 200:
                    logger.info(f"[WebRTC-Poll] Stream registered via HTTP: {response.json().get('message')}")
                else:
                    logger.error(f"[WebRTC-Poll] HTTP registration failed: {response.status_code}")
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
        """Poll the backend for waiting viewers, answers, and ICE candidates."""
        logger.info("[WebRTC-Poll] Starting viewer polling loop...")
        
        connected_viewers = set()  # Track viewers we've already connected to
        
        while self.is_running:
            try:
                # Poll for waiting viewers
                response = requests.get(
                    f"{self.api_url}/api/v1/streaming/pending-viewers/{self.screen_id}",
                    timeout=2
                )
                
                if response.status_code == 200:
                    data = response.json()
                    viewers = data.get('viewers', [])
                    
                    new_viewers = [v for v in viewers if v not in connected_viewers]
                    
                    if new_viewers:
                        logger.info(f"[WebRTC-Poll] Found {len(new_viewers)} NEW viewer(s)")
                        for viewer_id in new_viewers:
                            logger.info(f"[WebRTC-Poll] >>> CONNECTING TO VIEWER: {viewer_id}")
                            await self.streamer.handle_viewer_connected(viewer_id)
                            connected_viewers.add(viewer_id)
                
                # Poll for pending answers from viewers (HTTP fallback)
                ans_response = requests.get(
                    f"{self.api_url}/api/v1/streaming/pending-answers/{self.screen_id}",
                    timeout=2
                )
                
                if ans_response.status_code == 200:
                    ans_data = ans_response.json()
                    answers = ans_data.get('answers', [])
                    
                    for ans in answers:
                        viewer_id = ans.get('viewerId')
                        answer_sdp = ans.get('answerSdp')
                        if viewer_id and answer_sdp:
                            logger.info(f"[WebRTC-Poll] 📩 Got answer via HTTP from {viewer_id}")
                            await self.streamer.handle_answer(viewer_id, answer_sdp)
                
                # Poll for pending ICE candidates from viewers (HTTP fallback)
                ice_response = requests.get(
                    f"{self.api_url}/api/v1/streaming/pending-viewer-ice/{self.screen_id}",
                    timeout=2
                )
                
                if ice_response.status_code == 200:
                    ice_data = ice_response.json()
                    candidates = ice_data.get('candidates', [])
                    
                    for cand in candidates:
                        viewer_id = cand.get('viewerId')
                        candidate = cand.get('candidate')
                        if viewer_id and candidate:
                            logger.info(f"[WebRTC-Poll] 🧊 Got ICE candidate via HTTP from {viewer_id}")
                            await self.streamer.handle_ice_candidate(viewer_id, candidate)
                
            except Exception as e:
                # Don't log every polling error, just continue
                pass
            
            # Poll every 500ms for faster response
            await asyncio.sleep(0.5)
    
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
                f"{self.api_url}/api/v1/streaming/unregister",
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
