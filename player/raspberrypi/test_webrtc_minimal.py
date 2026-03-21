"""
Minimal WebRTC Test - Verify aiortc and screen capture work
Tests WebRTC peer connection and screen capture without SignalR complexity
"""
import asyncio
import logging
from aiortc import RTCPeerConnection, VideoStreamTrack
import av
import mss
import numpy as np
from fractions import Fraction as Rational

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class SimpleScreenTrack(VideoStreamTrack):
    """Simple screen capture track for testing"""
    
    def __init__(self):
        super().__init__()
        self.sct = mss.mss()
        self.counter = 0
        
    async def recv(self):
        """Capture and return a video frame"""
        self.counter += 1
        
        # Capture screen
        img = self.sct.grab(self.sct.monitors[1])
        
        # Convert to numpy array (BGRA format from MSS)
        frame_array = np.array(img)
        
        # Convert BGRA to BGR (remove alpha channel)
        if frame_array.shape[2] == 4:
            frame_array = frame_array[:, :, :3]
        
        # Create AV frame
        frame = av.VideoFrame.from_ndarray(frame_array, format='bgr24')
        frame.pts = self.counter
        frame.time_base = Rational(1, 30)
        
        # Small delay for 30fps
        await asyncio.sleep(1/30)
        
        return frame

async def test_minimal_webrtc():
    """Test minimal WebRTC setup"""
    logger.info("=" * 60)
    logger.info("Testing Minimal WebRTC Setup")
    logger.info("=" * 60)
    
    try:
        logger.info("\n1. Creating RTCPeerConnection...")
        pc = RTCPeerConnection()
        logger.info("✅ RTCPeerConnection created")
        
        logger.info("\n2. Creating screen capture track...")
        track = SimpleScreenTrack()
        logger.info("✅ Screen capture track created")
        
        logger.info("\n3. Adding track to peer connection...")
        pc.addTrack(track)
        logger.info("✅ Track added to peer connection")
        
        logger.info("\n4. Creating SDP offer...")
        offer = await pc.createOffer()
        await pc.setLocalDescription(offer)
        logger.info("✅ SDP Offer created")
        
        logger.info("\n5. SDP Offer (first 200 chars):")
        logger.info(pc.localDescription.sdp[:200] + "...")
        
        logger.info("\n6. Testing frame capture...")
        frame = await track.recv()
        logger.info(f"✅ Frame captured: {frame.width}x{frame.height}, format: {frame.format.name}")
        
        logger.info("\n7. Capturing 5 more frames to verify stability...")
        for i in range(5):
            frame = await track.recv()
            logger.info(f"  Frame {i+1}: {frame.width}x{frame.height} @ pts={frame.pts}")
        
        logger.info("\n" + "=" * 60)
        logger.info("✅✅✅ ALL TESTS PASSED! ✅✅✅")
        logger.info("=" * 60)
        logger.info("\nWebRTC components are working correctly!")
        logger.info("Next: Integrate with SignalR in player\n")
        
        # Cleanup
        await pc.close()
        
    except Exception as e:
        logger.error(f"\n❌ TEST FAILED: {e}")
        import traceback
        traceback.print_exc()
        return False
    
    return True

if __name__ == "__main__":
    success = asyncio.run(test_minimal_webrtc())
    exit(0 if success else 1)
