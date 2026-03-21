"""
Test script to verify SignalR event handling
"""
import asyncio
import logging
from signalrcore.hub_connection_builder import HubConnectionBuilder

logging.basicConfig(level=logging.INFO, format='%(asctime)s - [%(levelname)s] - %(message)s')
logger = logging.getLogger(__name__)

SCREEN_ID = "C7054654-DB14-4178-B5B7-389AD6BA378F"
API_URL = "http://localhost:5257"

async def main():
    logger.info("=" * 60)
    logger.info("TESTING SIGNALR EVENT HANDLERS")
    logger.info("=" * 60)
    
    # Build connection
    connection = HubConnectionBuilder()\
        .with_url(f"{API_URL}/hubs/streaming")\
        .with_automatic_reconnect({
            "type": "interval",
            "intervals": [1, 2, 5, 10],
            "keep_alive_interval": 10
        })\
        .build()
    
    # Register event handlers
    def on_viewer_connected(viewer_id):
        logger.info(f"[EVENT] >>> VIEWER CONNECTED: {viewer_id}")
    
    def on_answer(viewer_id, answer_sdp):
        logger.info(f"[EVENT] >>> ANSWER from {viewer_id}")
    
    def on_ice_candidate(viewer_id, candidate_json):
        logger.info(f"[EVENT] >>> ICE CANDIDATE from {viewer_id}")
    
    def on_last_viewer(screen_id):
        logger.info(f"[EVENT] >>> LAST VIEWER DISCONNECTED from {screen_id}")
    
    connection.on("OnViewerConnected", on_viewer_connected)
    connection.on("OnAnswer", on_answer)
    connection.on("OnViewerIceCandidate", on_ice_candidate)
    connection.on("OnLastViewerDisconnected", on_last_viewer)
    
    logger.info("Event handlers registered")
    
    # Start connection
    logger.info("Starting SignalR connection...")
    await asyncio.get_event_loop().run_in_executor(None, connection.start)
    logger.info("SignalR connection started!")
    
    # Register stream
    logger.info(f"Registering stream for screen: {SCREEN_ID}")
    try:
        await asyncio.get_event_loop().run_in_executor(
            None,
            connection.send,
            "RegisterStream",
            [SCREEN_ID, "test-key"]
        )
        logger.info("Stream registered successfully!")
    except Exception as e:
        logger.error(f"RegisterStream failed: {e}")
    
    # Keep running
    logger.info("=" * 60)
    logger.info("Waiting for events... (Press Ctrl+C to stop)")
    logger.info("Now open browser and click 'Start Stream'")
    logger.info("=" * 60)
    
    try:
        while True:
            await asyncio.sleep(1)
    except KeyboardInterrupt:
        logger.info("Stopping...")
        connection.stop()

if __name__ == "__main__":
    asyncio.run(main())
