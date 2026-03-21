"""
Simple WebRTC Integration for HTTP-based Player
This creates a separate SignalR connection just for WebRTC streaming.
Also includes HTTP polling fallback for answers/ICE candidates.
"""

import asyncio
import logging
import requests
from signalrcore.hub_connection_builder import HubConnectionBuilder

logger = logging.getLogger("WebRTCClient")


class SimpleWebRTCClient:
    """
    Simplified WebRTC client that runs alongside the HTTP player.
    Creates its own SignalR connection to the StreamingHub for WebRTC signaling.
    Also polls HTTP endpoints as fallback for answers/ICE candidates.
    """
    
    def __init__(self, api_url, screen_id, api_key, config):
        self.api_url = api_url
        self.screen_id = screen_id.lower()  # Normalize to lowercase
        self.api_key = api_key
        self.config = config
        self.connection = None
        self.streamer = None
        self.is_running = False
        self.polling_task = None
        
    async def start(self):
        """Start the WebRTC client and streaming."""
        logger.info("[WebRTC] ========== START CALLED ==========")
        logger.info(f"[WebRTC] Config enabled: {self.config.get('enabled', False)}")
        logger.info(f"[WebRTC] API URL: {self.api_url}")
        logger.info(f"[WebRTC] Screen ID: {self.screen_id}")
        logger.info(f"[WebRTC] API Key: {self.api_key[:10]}..." if self.api_key else "[WebRTC] API Key: None")
        
        if not self.config.get('enabled', False):
            logger.warning("[WebRTC] WARNING: Streaming disabled in config - exiting")
            return
        
        try:
            logger.info("[WebRTC] Step 1: Importing WebRTCStreamer...")
            from webrtc_streamer import WebRTCStreamer
            logger.info("[WebRTC] OK - WebRTCStreamer imported successfully")
            
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
            logger.info("[WebRTC] OK - Connection builder created")
            
            # Initialize WebRTC streamer BEFORE connecting
            logger.info("[WebRTC] Step 3: Initializing WebRTC streamer...")
            max_viewers = self.config.get('max_viewers', 5)
            self.streamer = WebRTCStreamer(self.connection, self.screen_id, api_url=self.api_url, max_viewers=max_viewers)
            logger.info(f"[WebRTC] OK - Streamer initialized with API URL: {self.api_url}, max_viewers: {max_viewers}")
            
            # Register event handlers
            logger.info("[WebRTC] Step 4: Registering event handlers...")
            self.connection.on("OnViewerConnected", self.handle_viewer_connected)
            self.connection.on("OnViewerDisconnected", self.handle_viewer_disconnected)
            self.connection.on("OnAnswer", self.handle_answer)
            self.connection.on("OnViewerIceCandidate", self.handle_ice_candidate)
            self.connection.on("OnLastViewerDisconnected", self.handle_last_viewer)
            logger.info("[WebRTC] OK - Event handlers registered")
            
            # Start connection (MUST await for async SignalR)
            logger.info("[WebRTC] Step 5: Starting SignalR connection...")
            await asyncio.get_event_loop().run_in_executor(None, self.connection.start)
            logger.info("[WebRTC] OK - SignalR connection established!")
            
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
                logger.info("[WebRTC] OK - Registered with StreamingHub!")
            except Exception as e:
                logger.error(f"[WebRTC] WARNING: SignalR RegisterStream failed: {e}")
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
                    logger.info(f"[WebRTC] OK - Stream registered via HTTP: {response.json().get('message')}")
                else:
                    logger.warning(f"[WebRTC] HTTP registration status: {response.status_code}")
            except Exception as e:
                logger.error(f"[WebRTC] HTTP registration error: {e}")
            
            # Start streaming
            quality = self.config.get('quality', '720p')
            fps = self.config.get('fps', 15)
            logger.info(f"[WebRTC] Step 8: Starting video stream ({quality} @ {fps}fps)...")
            
            await self.streamer.start_streaming(quality=quality, fps=fps)
            logger.info(f"[WebRTC] OK OK OK - STREAMING STARTED SUCCESSFULLY!")
            logger.info(f"[WebRTC] Stream quality: {quality}, FPS: {fps}")
            
            self.is_running = True
            
            # Start HTTP polling for answers/ICE as fallback (SignalR often fails)
            logger.info("[WebRTC] Step 9: Starting HTTP polling for answers/ICE...")
            self.polling_task = asyncio.create_task(self._poll_for_answers_and_ice())
            
            logger.info("[WebRTC] ========== INITIALIZATION COMPLETE ==========")
            
        except ImportError as e:
            logger.error(f"[WebRTC] ERROR - Import Error - WebRTC modules not available: {e}")
            logger.error("[WebRTC] Install dependencies: pip install aiortc av mss")
            import traceback
            traceback.print_exc()
            raise
        except Exception as e:
            logger.error(f"[WebRTC] ERROR - FAILED TO START: {e}")
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
    
    def handle_viewer_disconnected(self, viewer_id):
        """Handle when a specific viewer disconnects (stops watching)."""
        logger.info(f"[WebRTC] >>> VIEWER DISCONNECTED EVENT: {viewer_id}")
        if self.streamer:
            asyncio.create_task(self._async_handle_viewer_disconnect(viewer_id))
    
    async def _async_handle_viewer(self, viewer_id):
        """Async wrapper for viewer connection."""
        try:
            # Add to known_viewers to prevent HTTP poll from also handling this viewer
            if hasattr(self, '_known_viewers'):
                self._known_viewers.add(viewer_id)
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
    
    async def _async_handle_viewer_disconnect(self, viewer_id):
        """Async wrapper for viewer disconnection cleanup."""
        try:
            logger.info(f"[WebRTC] Cleaning up resources for disconnected viewer {viewer_id}")
            await self.streamer._handle_viewer_disconnect(viewer_id)
            # Also remove from known_viewers so they can reconnect
            if hasattr(self, '_known_viewers') and viewer_id in self._known_viewers:
                self._known_viewers.discard(viewer_id)
                logger.info(f"[WebRTC] Removed {viewer_id} from known_viewers - can reconnect now")
            logger.info(f"[WebRTC] Viewer {viewer_id} cleanup complete")
        except Exception as e:
            logger.error(f"[WebRTC] Error handling viewer disconnect: {e}")
            import traceback
            traceback.print_exc()
    
    async def _poll_for_answers_and_ice(self):
        """Poll HTTP endpoints for viewers, answers, and ICE candidates (fallback for SignalR)."""
        logger.info("[WebRTC-Poll] Starting HTTP polling loop for viewers/answers/ICE...")
        poll_interval = 0.5  # 500ms
        # Use instance variable so disconnect handler can access it
        self._known_viewers = set()
        known_viewers = self._known_viewers  # Local reference for convenience
        
        poll_count = 0
        while self.is_running:
            try:
                poll_count += 1
                # CRITICAL: Poll for pending viewers first!
                try:
                    poll_url = f"{self.api_url}/api/streaming/pending-viewers/{self.screen_id}"
                    response = requests.get(poll_url, timeout=3)
                    if response.status_code == 200:
                        data = response.json()
                        viewers = data.get('viewers', [])
                        # ALWAYS log first 5 polls, then every 20th, or when there are viewers
                        if poll_count <= 5 or poll_count % 20 == 1 or viewers:
                            logger.info(f"[WebRTC-Poll] Poll #{poll_count} - URL: {poll_url}")
                            logger.info(f"[WebRTC-Poll] Response: {data}")
                            logger.info(f"[WebRTC-Poll] Known viewers: {known_viewers}")
                            logger.info(f"[WebRTC-Poll] Streamer is_streaming: {self.streamer.is_streaming if self.streamer else 'NO STREAMER'}")
                        for viewer_id in viewers:
                            viewer_id = viewer_id.strip() if viewer_id else None  # Strip whitespace!
                            if viewer_id and viewer_id not in known_viewers:
                                logger.info(f"[WebRTC-Poll] >>> NEW VIEWER via HTTP: {viewer_id}")
                                logger.info(f"[WebRTC-Poll] >>> Calling _async_handle_viewer...")
                                known_viewers.add(viewer_id)
                                await self._async_handle_viewer(viewer_id)
                                logger.info(f"[WebRTC-Poll] >>> _async_handle_viewer returned")
                            elif viewer_id in known_viewers:
                                pass  # Skip silently - already processed
                    else:
                        if poll_count % 20 == 1:
                            logger.warning(f"[WebRTC-Poll] Poll #{poll_count} - Status {response.status_code}")
                except requests.exceptions.RequestException as e:
                    if poll_count % 20 == 1:
                        logger.warning(f"[WebRTC-Poll] Poll #{poll_count} - Request error: {e}")
                
                # Poll for pending answers
                try:
                    response = requests.get(
                        f"{self.api_url}/api/streaming/pending-answers/{self.screen_id}",
                        timeout=3
                    )
                    if response.status_code == 200:
                        data = response.json()
                        answers = data.get('answers', [])
                        for answer_item in answers:
                            viewer_id = answer_item.get('viewerId')
                            answer_sdp = answer_item.get('answer')
                            if viewer_id and answer_sdp:
                                logger.info(f"[WebRTC-Poll] >>> Got ANSWER via HTTP from {viewer_id}")
                                await self._async_handle_answer(viewer_id, answer_sdp)
                except requests.exceptions.RequestException:
                    pass  # Silently ignore polling errors
                
                # Poll for pending ICE candidates
                try:
                    response = requests.get(
                        f"{self.api_url}/api/streaming/pending-viewer-ice/{self.screen_id}",
                        timeout=3
                    )
                    if response.status_code == 200:
                        data = response.json()
                        candidates = data.get('candidates', [])
                        for cand_item in candidates:
                            viewer_id = cand_item.get('viewerId')
                            candidate = cand_item.get('candidate')
                            if viewer_id and candidate:
                                logger.info(f"[WebRTC-Poll] >>> Got ICE via HTTP from {viewer_id}")
                                await self._async_handle_ice(viewer_id, candidate)
                except requests.exceptions.RequestException:
                    pass  # Silently ignore polling errors
                
                await asyncio.sleep(poll_interval)
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"[WebRTC-Poll] Polling error: {e}")
                await asyncio.sleep(1)
        
        logger.info("[WebRTC-Poll] Polling loop stopped")
    
    async def stop(self):
        """Stop streaming and close connection."""
        if not self.is_running:
            return
        
        logger.info("[WebRTC] Stopping WebRTC client...")
        self.is_running = False
        
        # Cancel polling task
        if self.polling_task:
            self.polling_task.cancel()
            try:
                await self.polling_task
            except asyncio.CancelledError:
                pass
        
        if self.streamer:
            await self.streamer.stop_streaming()
        
        if self.connection:
            self.connection.stop()
        
        logger.info("[WebRTC] WebRTC client stopped")
    
    def get_viewer_count(self):
        """Get current viewer count."""
        if self.streamer:
            return self.streamer.get_viewer_count()
        return 0
