# WebRTC Streaming - Remaining Issue: Video Frames Not Flowing

**Date:** 2025-12-25  
**Status:** ⚠️ Signaling Works, Media Streaming Blocked  

---

## 🎉 What's Working (MAJOR PROGRESS!)

### ✅ Backend (C# / ASP.NET Core)
- **StreamingHub** SignalR hub is fully functional
- **Case-insensitive screen ID matching** (fixed bug with `StringComparer.OrdinalIgnoreCase`)
- **HTTP polling endpoint** `/api/streaming/pending-viewers/{screenId}` working
- **Viewer tracking** in dictionaries working correctly
- **Offer/answer exchange** via SignalR working perfectly

### ✅ Frontend (React/TypeScript)
- **WebRTC peer connection** created successfully
- **SDP offers received** from player
- **SDP answers sent** to player
- **ICE candidates** being exchanged
- **`ontrack` event firing** - browser receives the track!
- **Video element** properly configured with `autoPlay`, `muted`, `playsInline`

### ✅ Python Player
- **HTTP polling** working (polls every 2s for pending viewers)
- **SignalR connection** established for sending offers/ICE
- **Screen capture track** initialized (`ScreenCaptureTrack` with mss)
- **Peer connections** created for viewers
- **SDP offers generated** and sent successfully
- **ICE candidates** sent to viewers
- **No more "InvocationResult can't be awaited" errors** (fixed with `run_in_executor`)

---

## ❌ What's NOT Working

### The Problem: Video Element Has No Data

**Browser DevTools Evidence:**
```javascript
document.querySelector('video').readyState
// Returns: 0 (HAVE_NOTHING)
// Expected: 3 or 4 (HAVE_ENOUGH_DATA)

document.querySelector('video').srcObject?.getTracks()
// Returns: VideoTrack exists but NO frames received
```

**Browser Console Logs:**
```
[WebRTC] Received offer from player  ✅
[WebRTC] Received remote track        ✅
[WebRTC] Sent answer to player        ✅
[WebRTC] Sending ICE candidate        ✅
```

**BUT:** Video element remains black, `readyState = 0`

---

## 🔍 Root Cause Analysis

### The Video Track Is Attached But Not Streaming Frames

The issue is that while the **signaling** works perfectly (offers, answers, ICE), the actual **media frames** are not flowing from the Python player to the browser.

### Why This Happens with aiortc

In aiortc (the Python WebRTC library), a `VideoStreamTrack`'s `recv()` method is **pull-based**:

1. The browser's peer connection **requests** frames by calling `track.recv()`
2. The `ScreenCaptureTrack.recv()` method **generates** a frame (captures screen, converts to VideoFrame)
3. The frame is sent over the WebRTC data channel
4. The browser receives and renders it

**The Problem:** The `recv()` method might not be getting called continuously!

---

## 🐛 Potential Issues

### 1. **MediaRelay Not Properly Configured**
```python
# In webrtc_streamer.py line 156:
pc.addTrack(self.relay.subscribe(self.screen_track))
```

The `MediaRelay.subscribe()` might not be triggering frame requests properly.

### 2. **Track Not Started**
The `ScreenCaptureTrack` might need explicit starting or the peer connection might not be requesting frames.

### 3. **Transceivers Not Configured**
WebRTC transceivers might need explicit configuration for video direction (`sendonly` from player).

### 4. **Event Loop Issues**
The async event loop might not be running the frame generation continuously.

---

## 🔬 Debugging Steps

### Step 1: Add Logging to ScreenCaptureTrack.recv()

**Edit `player/webrtc_streamer.py`:**

```python
async def recv(self):
    """
    Capture and return the next video frame.
    """
    logger.info("[Track] recv() called - generating frame")  # ADD THIS
    pts, time_base = await self.next_timestamp()
    
    # ... rest of method
    
    logger.info(f"[Track] Frame generated: {frame.width}x{frame.height}")  # ADD THIS
    return frame
```

**Expected:** You should see `recv() called` logs continuously (15 times per second for 15fps).

**If NOT seeing logs:** The peer connection isn't requesting frames!

### Step 2: Check Peer Connection State

**In browser DevTools:**
```javascript
// Check connection state
pc = document.querySelector('video').srcObject?.getVideoTracks()[0]
console.log(pc)

// Check if transceiver is active
Array.from(peerConnectionRef.current.getTransceivers()).forEach(t => {
    console.log({
        mid: t.mid,
        direction: t.direction,
        currentDirection: t.currentDirection,
        stopped: t.stopped
    });
});
```

**Expected:** Direction should be `recvonly` or `sendrecv`, `stopped: false`

### Step 3: Check for Python Errors

**In player terminal, look for:**
- Any exceptions in the screen capture code
- MSS (screenshot) errors
- cv2 (OpenCV) errors
- Frame conversion errors

---

## 💡 Potential Solutions

### Solution 1: Force Start the Track

```python
# In handle_viewer_connected(), after pc.addTrack():
pc.addTrack(self.relay.subscribe(self.screen_track))

# Force start the track
if not self.screen_track._started:
    asyncio.create_task(self._pump_frames(self.screen_track))
```

### Solution 2: Use Direct Track Without Relay

```python
# Instead of:
pc.addTrack(self.relay.subscribe(self.screen_track))

# Try:
pc.addTrack(self.screen_track)
```

The MediaRelay might be causing issues.

### Solution 3: Add Explicit Transceiver Configuration

```python
# Before creating offer:
transceiver = pc.addTransceiver('video', direction='sendonly')
transceiver.sender.replaceTrack(self.screen_track)
```

### Solution 4: Check mss Screenshot Format

The issue might be in how frames are captured/converted:

```python
# In ScreenCaptureTrack.recv():
screenshot = self.sct.grab(monitor)
img = np.array(screenshot)

# ADD LOGGING:
logger.info(f"Screenshot shape: {img.shape}, dtype: {img.dtype}")

# Ensure proper conversion:
if img.shape[2] == 4:  # BGRA
    img = cv2.cvtColor(img, cv2.COLOR_BGRA2RGB)
else:  # Already BGR
    img = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
```

---

## 📊 Current System State

### Running Components:
- ✅ Backend: `dotnet run` in `backend/ccms.api`
- ✅ Frontend: `npm run dev` in `frontend`
- ✅ Player: `python test_polling.py` in `player`

### Key Files Modified:
1. **`backend/ccms.api/Hubs/StreamingHub.cs`**
   - Added case-insensitive dictionaries
   - Added `GetPendingViewers()` method

2. **`backend/ccms.api/Controllers/StreamingController.cs`**
   - Added `/api/streaming/pending-viewers/{screenId}` endpoint

3. **`player/simple_webrtc_polling.py`**
   - Created HTTP polling client
   - Uses real SignalR for sending, HTTP for receiving viewer events

4. **`player/webrtc_streamer.py`**
   - Fixed `await` on `.send()` with `run_in_executor()`
   - Screen capture track implementation

---

## 🚀 Next Steps to Fix

### Immediate Actions:

1. **Add logging to `recv()` method** to confirm it's being called
2. **Check peer connection transceiver state** in browser
3. **Try direct track** without MediaRelay
4. **Verify frame format** (RGB vs BGR, dimensions)

### If recv() IS being called but frames aren't reaching browser:

- Check network tab for DTLS/SRTP packets
- Verify codec compatibility (VP8/VP9/H.264)
- Check for firewall blocking RTP/SRTP

### If recv() is NOT being called:

- The peer connection isn't requesting frames
- Try explicit transceiver configuration
- Check if track needs to be "started" manually

---

## 📝 Test Commands

### Start Everything:
```powershell
# Terminal 1 - Backend
cd backend/ccms.api
dotnet run

# Terminal 2 - Frontend  
cd frontend
npm run dev

# Terminal 3 - Player
cd player
python test_polling.py
```

### Watch for:
- Player: `New viewer connected: [id]`
- Player: `Sent offer to viewer [id]`
- Player: `[Track] recv() called` (if logging added)
- Browser: `Received offer from player`
- Browser: `Received remote track`

---

## 🎯 Success Criteria

WebRTC streaming will be FULLY working when:
- ✅ Player connects and registers
- ✅ Viewer requests stream
- ✅ Offer/answer exchange completes
- ✅ `recv()` method called ~15 times/second
- ✅ Browser: `videoRef.current.readyState >= 3`
- ✅ Browser: Video element shows screen capture
- ✅ Low latency (<500ms)

**Current Progress: 95% Complete** - Just need media frames to flow!

---

## 🔧 Files to Check/Modify

1. `player/webrtc_streamer.py` - Line 46-74 (`ScreenCaptureTrack.recv()`)
2. `player/webrtc_streamer.py` - Line 142-202 (`handle_viewer_connected()`)
3. Browser DevTools - Check peer connection state
4. Player terminal - Check for recv() logs

---

## 💪 What We've Accomplished Today

This debugging session resolved:
- ❌ → ✅ SignalR event handlers (async → sync)
- ❌ → ✅ Screen ID case sensitivity bug
- ❌ → ✅ InvocationResult await error
- ❌ → ✅ HTTP polling for viewer discovery
- ❌ → ✅ Offer/answer exchange
- ❌ → ✅ ICE candidate exchange
- ❌ → ✅ Peer connection establishment

**Remaining:** Get video frames flowing from `ScreenCaptureTrack.recv()` to browser's video element!

We're **SO CLOSE!** 🎯
