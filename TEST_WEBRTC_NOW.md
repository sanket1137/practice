# Phase 1 Complete - Testing Instructions

## ✅ Changes Applied

1. **Enhanced Logging** in `simple_webrtc_client.py`
   - 7-step debug logging
   - HTTP registration instead of SignalR send()
   - Detailed error tracebacks

2. **Fixed WebRTC Components** in `webrtc_streamer.py`
   - BGRA → BGR conversion fix
   - Added Fraction import
   - Enhanced logging

3. **Verified Core Components**
   - ✅ Minimal test passed
   - ✅ Screen capture working
   - ✅ Video frame creation working
   - ✅ RTCPeerConnection working

---

## 🧪 Test Now

### Step 1: Stop Existing Player
If running, stop with `Ctrl+C`

### Step 2: Start Backend (if not running)
```bash
cd backend/CCMS.Api
dotnet run
```

Wait for: `Now listening on: http://localhost:5257`

### Step 3: Start Frontend (if not running)
```bash
cd frontend
npm run dev
```

Wait for: `ready in XXXms`

### Step 4: Start Player with Full Logging
```bash
cd player
python ccms_player.py
```

### Expected Logs

You should see detailed output like:
```
[WebRTC] ========== START CALLED ==========
[WebRTC] Config enabled: True
[WebRTC] API URL: http://localhost:5257
[WebRTC] Screen ID: c7054654-db14-4178-b5b7-389ad6ba378f
[WebRTC] Step 1: Importing WebRTCStreamer...
[WebRTC] ✅ WebRTCStreamer imported successfully
[WebRTC] Step 2: Creating SignalR connection to: http://localhost:5257/hubs/streaming
[WebRTC] ✅ Connection builder created
[WebRTC] Step 3: Initializing WebRTC streamer...
[WebRTC] ✅ Streamer initialized
[WebRTC] Step 4: Registering event handlers...
[WebRTC] ✅ Event handlers registered
[WebRTC] Step 5: Starting SignalR connection...
[WebRTC] ✅✅ SignalR connection established!
[WebRTC] Step 6: Registering stream via HTTP...
[WebRTC] ✅✅ Stream registered via HTTP: Stream registered successfully
[WebRTC] Step 7: Starting video stream (720p @ 15fps)...
[Streamer] Starting stream: 720p @ 15fps
[Streamer] Creating screen capture track...
[Streamer] ✅ Screen capturetrack initialized
[Streamer] ✅✅ Stream ready for screen c7054654-db14-4178-b5b7-389ad6ba378f
[WebRTC] ✅✅✅ STREAMING STARTED SUCCESSFULLY! ✅✅✅
[WebRTC] ========== INITIALIZATION COMPLETE ==========
```

### Step 5: Test in Browser

1. Open: http://localhost:5173
2. Go to: Screen Detail → Live Activity tab
3. Click: "Start Stream"
4. Watch browser console for connection logs

---

## 📊 What to Check

### Player Console
- Look for "STREAMING STARTED SUCCESSFULLY"
- Check for any ❌ errors
- If fails, note which step failed

### Browser Console
```javascript
[WebRTC] Connected to StreamingHub
[WebRTC] Requesting stream for screen: ...
[WebRTC] Received offer from player  ← NEW! Should see this
[WebRTC] Sent answer to player  ← NEW! Should see this
[WebRTC] Connection state: connected  ← NEW! Success!
```

### Backend Console
- Watch for StreamingHub connection logs
- ICE candidate exchanges
- Offer/answer relay messages

---

## 🎯 Expected Result

**If successful, you'll see:**
- ✅ Player logs show "STREAMING STARTED"
- ✅ Browser shows video stream
- ✅ Latency < 500ms
- ✅ Smooth video playback

**If it fails**, check which step in player logs shows ❌

---

## 📞 Debug Help

### Common Issues

**"Import Error - WebRTC modules not available"**
- Run: `pip install aiortc av mss numpy requests`

**"HTTP registration failed: 404"**
- Backend not running or wrong URL
- Check: http://localhost:5257/api/streaming/register

**"SignalR connection failed"**
- Hub might not be mapped
- Check backend Program.cs for MapHub<StreamingHub>

**"No video appears"**
- Check browser console for ICE candidates
- Check player logs for "viewer connected"
- Try chrome://webrtc-internals

---

🚀 **Ready to test! Start the player and watch the logs!**
