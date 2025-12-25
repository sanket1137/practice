"""
Test HTTP polling WebRTC client (no SignalR events)
"""
import asyncio
import logging
from simple_webrtc_polling import SimpleWebRTCPollingClient

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(message)s')
logger = logging.getLogger(__name__)

async def main():
    client = SimpleWebRTCPollingClient(
        api_url="http://localhost:5257",
        screen_id="C7054654-DB14-4178-B5B7-389AD6BA378F",
        api_key="test-api-key",
        config={"quality": "720p", "fps": 15}
    )
    
    try:
        await client.start()
        
        # Keep running
        logger.info("Press Ctrl+C to stop")
        while True:
            await asyncio.sleep(1)
    except KeyboardInterrupt:
        logger.info("Stopping...")
        await client.stop()

if __name__ == "__main__":
    asyncio.run(main())
