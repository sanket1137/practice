"""
WebRTC Streaming Integration Demo

This demonstrates how to integrate WebRTC live streaming into the player.
Add these handlers to your SignalR connection and call start_streaming when player connects.
"""

# In ccms_player.py, add these modifications:

# 1. Import the WebRTC streamer
from webrtc_streamer import WebRTCStreamer

# 2. Initialize in your player class __init__
def __init__(self, api_url, screen_id, api_key):
    # ... existing initialization ...
    
    # WebRTC Streaming (optional, enable via config)
    self.webrtc_streamer = None
    self.streaming_enabled = False  # Set to True to enable live streaming

# 3. After SignalR connection is established
async def setup_signalr_handlers(self):
    """Set up SignalR event handlers including WebRTC."""
    
    # ... existing handlers ...
    
    # WebRTC Signaling Handlers
    if self.streaming_enabled:
        # Initialize WebRTC streamer
        self.webrtc_streamer = WebRTCStreamer(
            signalr_connection=self.connection,
            screen_id=self.screen_id
        )
        
        # Handle viewer connection requests
        self.connection.on("OnViewerConnected", self.handle_viewer_connected)
        
        # Handle SDP answer from viewer
        self.connection.on("OnAnswer", self.handle_viewer_answer)
        
        # Handle ICE candidates from viewer
        self.connection.on("OnViewerIceCandidate", self.handle_viewer_ice_candidate)
        
        # Handle last viewer disconnected
        self.connection.on("OnLastViewerDisconnected", self.handle_last_viewer_disconnected)
        
        print("[WebRTC] Signaling handlers registered")

# 4. Start streaming after successful player registration
async def start_player(self):
    """Start the player and optionally the WebRTC stream."""
    
    # ... existing player start logic ...
    
    # Start WebRTC streaming if enabled
    if self.streaming_enabled and self.webrtc_streamer:
        try:
            await self.webrtc_streamer.start_streaming(quality="720p", fps=15)
            print(f"[WebRTC] Started streaming for screen {self.screen_id}")
        except Exception as e:
            print(f"[WebRTC] Failed to start streaming: {e}")

# 5. WebRTC event handlers
async def handle_viewer_connected(self, viewer_id):
    """Handle new viewer connection."""
    if self.webrtc_streamer:
        await self.webrtc_streamer.handle_viewer_connected(viewer_id)
        print(f"[WebRTC] Viewer connected: {viewer_id}")

async def handle_viewer_answer(self, viewer_id, answer_sdp):
    """Handle SDP answer from viewer."""
    if self.webrtc_streamer:
        await self.webrtc_streamer.handle_answer(viewer_id, answer_sdp)

async def handle_viewer_ice_candidate(self, viewer_id, candidate_json):
    """Handle ICE candidate from viewer."""
    if self.webrtc_streamer:
        await self.webrtc_streamer.handle_ice_candidate(viewer_id, candidate_json)

async def handle_last_viewer_disconnected(self, screen_id):
    """Handle when last viewer disconnects."""
    print(f"[WebRTC] Last viewer disconnected from screen {screen_id}")
    # Optionally stop streaming to save resources
    # if self.webrtc_streamer:
    #     await self.webrtc_streamer.stop_streaming()

# 6. Cleanup on player shutdown
async def shutdown(self):
    """Shutdown player and stop streaming."""
    
    # Stop WebRTC streaming
    if self.webrtc_streamer:
        await self.webrtc_streamer.stop_streaming()
        print("[WebRTC] Streaming stopped")
    
    # ... existing shutdown logic ...


# CONFIGURATION
# Add to config.json:
"""
{
    "api_url": "http://localhost:5257",
    "screen_id": "your-screen-id",
    "api_key": "your-api-key",
    "webrtc": {
        "enabled": true,
        "quality": "720p",  // Options: "240p", "480p", "720p", "1080p"
        "fps": 15,
        "auto_start": true
    }
}
"""

# USAGE NOTES:
# 1. Install dependencies: pip install -r requirements.txt
# 2. Enable WebRTC in config.json
# 3. Run player: python ccms_player.py
# 4. Player will automatically start streaming when connected
# 5. Viewers can connect via the frontend StreamingHub

# PERFORMANCE NOTES:
# - 720p @ 15fps uses ~10-15% CPU on modern hardware
# - Each viewer connection adds ~2-3% CPU overhead
# - Recommended max 10 concurrent viewers per player
# - Use lower quality (480p) if CPU usage is too high

# TROUBLESHOOTING:
# - If streaming doesn't start, check firewall settings
# - Ensure STUN/TURN servers are configured in backend
# - Check player logs for WebRTC errors
# - Verify SignalR connection is established before streaming
