# WebRTC Live Streaming - Quick Start Testing

## 🚀 Start the Player

```powershell
cd c:\Users\Sanket\Desktop\Me\Projects\Playground\PixelCCMSCopilot\practice\player

# Run the player
python simple_webrtc_polling.py
```

**Expected Output:**
```
[WebRTC-Poll] Starting WebRTC client with HTTP polling...
[WebRTC-Poll] SignalR connection started for sending
[WebRTC-Poll] Streamer initialized
[Streamer] Starting stream: 720p @ 15fps
[Streamer] ✅ Screen capture track initialized
[Streamer] ✅✅ Stream ready for screen [screen-id]
[WebRTC-Poll] === READY FOR VIEWERS ===
```

## 🌐 Open Browser & Connect

1. Go to Frontend URL (check your backend for the correct URL)
2. Select a screen to stream
3. Click "Start Stream"
4. **Watch for these logs in the player terminal:**

```
[WebRTC-Poll] Found 1 NEW viewer(s)
New viewer connected: viewer-uuid-1
[WebRTC] Adding video track via relay for viewer-uuid-1
[Pump] 🎬 Frame pump started for viewer-uuid-1
[Pump] ✅ Frames pumped for viewer-uuid-1: 30 frames
[Pump] ✅ Frames pumped for viewer-uuid-1: 60 frames
[Pump] ✅ Frames pumped for viewer-uuid-1: 90 frames
```

## ✅ Verify Video is Playing

**In Browser Console (F12):**
```javascript
// Check video element state
const video = document.querySelector('video');
console.log('Video readyState:', video.readyState);  
// ✅ SHOULD BE 4 (not 0!)
// 0=HAVE_NOTHING, 4=HAVE_ENOUGH_DATA

console.log('Video playing:', video.playing);
// ✅ SHOULD BE true

// Check if frames are arriving
pc.getStats().then(report => {
    report.forEach(stat => {
        if (stat.type === 'inbound-rtp' && stat.mediaType === 'video') {
            console.log('✅ Frames received:', stat.packetsReceived);
            console.log('✅ Bytes received:', stat.bytesReceived);
        }
    });
});
```

## 🎬 Test with Multiple Viewers

1. **Keep first browser streaming**
2. **Open 2nd browser window** → Different screen → Start Stream
3. **Open 3rd browser window** → Different screen → Start Stream

**Player logs should show:**
```
[Pump] 🎬 Frame pump started for viewer-uuid-1
[Pump] 🎬 Frame pump started for viewer-uuid-2
[Pump] 🎬 Frame pump started for viewer-uuid-3
[Pump] ✅ Frames pumped for viewer-uuid-1: 30 frames
[Pump] ✅ Frames pumped for viewer-uuid-2: 30 frames
[Pump] ✅ Frames pumped for viewer-uuid-3: 30 frames
```

**All three viewers should see their respective screens streaming live and simultaneously!**

## 🛑 Stop Streaming

Close the browser windows and the player will log cleanup:
```
[WebRTC] Viewer disconnected (state: closed)
[Pump] Frame pump cancelled for viewer-uuid-1 after 450 frames
[Pump] Frame pump cancelled for viewer-uuid-2 after 450 frames
[Pump] Frame pump cancelled for viewer-uuid-3 after 450 frames
```

## ⚡ Performance Check

**Watch player terminal during streaming:**

1. **Frame pump is active** - See `[Pump] ✅` logs every 2 seconds
2. **No recv() errors** - No error logs from frame capture
3. **Clean disconnects** - Pump cancels properly when viewer leaves
4. **CPU usage** - Should be 8-15% depending on screen resolution

## 📱 Browser Requirements

- Modern WebRTC support (Chrome, Firefox, Edge, Safari)
- VP8 or H264 codec support
- MediaStream API support

## 🐛 If Video is Still Black

1. **Check frame pump started:**
   ```
   Look for: [Pump] 🎬 Frame pump started
   ```

2. **Check frames are flowing:**
   ```
   Look for: [Pump] ✅ Frames pumped
   ```

3. **Check browser console for errors:**
   ```javascript
   // Should show frames arriving
   document.querySelector('video').srcObject.getTracks()[0].getSettings()
   // Should show: {width, height, frameRate} NOT empty
   ```

4. **Restart player and browser** - Try fresh connection

## 🎯 Success Criteria

✅ Player terminal shows `[Pump] ✅ Frames pumped` logs
✅ Browser video displays screen content (NOT black)
✅ Video plays smoothly at ~15 FPS
✅ Multiple viewers work simultaneously
✅ Proper cleanup on disconnect

**If all criteria are met, WebRTC streaming is working correctly!**
