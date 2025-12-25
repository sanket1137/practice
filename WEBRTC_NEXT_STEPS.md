# WebRTC Live Streaming - Next Steps

## ✅ Completed So Far

### Backend
- ✅ StreamingHub created and registered
- ✅ Stream access authorization implemented
- ✅ WebRTC configuration added
- ✅ Backend running successfully

### Player
- ✅ `webrtc_streamer.py` created
- ✅ WebRTC dependencies added to requirements.txt
- ✅ Config.json updated with WebRTC settings
- ✅ Player initialized to detect WebRTC module

### Frontend
- ✅ `WebRTCPlayer.tsx` component created
- ⏸️ Not yet integrated into pages

---

## 🔧 To Complete MVP (Remaining ~10 hours)

### 1. Database Migration (30 minutes)

The Screen table needs 3 new columns. Run this SQL manually:

```bash
cd backend
# Option 1: Use SQL Server Management Studio and run add_streaming_columns.sql
# Option 2: Use command line (if sqlcmd is configured)
sqlcmd -S "(localdb)\mssqllocaldb" -d "PracticePixelCCMSDb" -i add_streaming_columns.sql
```

Then restart backend:
```bash
# Stop current backend (Ctrl+C)
cd CCMS.Api
dotnet run
```

### 2. Install WebRTC Dependencies on Player (2 hours)

```bash
cd player
pip install -r requirements.txt
```

**Note**: This will install:
- `aiortc` (WebRTC)
- `av` (Video encoding)
- `mss` (Screen capture)
- `opencv-python` (Image processing)
- `numpy` (Array operations)

**Potential Issues**:
- `av` requires ffmpeg to be installed on system
- `opencv-python` may need Visual C++ redistributables on Windows
- If installation fails, dependencies can be installed individually

### 3. Integrate WebRTC into Player (4 hours)

Follow the guide in `webrtc_integration_demo.py`:

**Key steps**:
1. Initialize WebRTCStreamer after SignalR connects
2. Add SignalR event handlers for WebRTC signaling
3. Start streaming after successful handshake
4. Enable in config.json: `"webrtc": { "enabled": true }`

**Reference implementation** available in `webrtc_integration_demo.py`

### 4. Integrate Frontend Component (2 hours)

Add WebRTCPlayer to screen detail page:

```tsx
// In src/pages/screens/ScreenDetailPage.tsx
import { WebRTCPlayer } from '../../components/streaming/WebRTCPlayer';

// Add to "Live Activity" tab
<TabPanel value={tab} index={2}>
  <WebRTCPlayer
    screenId={screenId}
    autoStart={false}
    fallbackToVideoSync={true}
  />
</TabPanel>
```

### 5. Testing (2 hours)

1. **Start Backend**: `dotnet run` in CCMS.Api
2. **Start Frontend**:  `npm run dev` in frontend  
3. **Start Player**: `python ccms_player.py` in player (with WebRTC enabled)
4. **Test Locally**:
   - Open browser to screen detail page
   - Click "Start Stream"
   - Should see live screen feed with <500ms latency

---

## 🚀 Optional: Production Setup

### Set up TURN Server (for NAT traversal)

**Option 1: Docker (easiest)**
```bash
docker run -d --network=host \
  -e TURN_USERNAME=test \
  -e TURN_PASSWORD=test123 \
  coturn/coturn
```

**Option 2: Install Coturn**
```bash
# Ubuntu/Debian
sudo apt-get install coturn

# Configure in /etc/turnserver.conf
listening-port=3478
realm=yourdomain.com
user=test:test123
```

Update backend `appsettings.json`:
```json
"WebRTC": {
  "TurnServers": [{
    "Urls": "turn:localhost:3478",
    "Username": "test",
    "Credential": "test123"
  }]
}
```

---

## 📝 Configuration Reference

### Player config.json
```json
{
  "screen_id": "your-screen-id",
  "api_key": "your-api-key",
  "server_url": "http://localhost:5257",
  "webrtc": {
    "enabled": true,        // Enable WebRTC streaming
    "quality": "720p",      // 240p, 480p, 720p, 1080p
    "fps": 15,              // Frames per second (5-30)
    "auto_start": true      // Start streaming on connect
  }
}
```

### Backend appsettings.json
Already configured with:
- STUN servers (Google's public STUN)
- TURN server placeholders
- Max 10 viewers per stream
- 300 second timeout

---

## 🎯 Success Checklist

- [ ] Database columns added
- [ ] Backend restarted without errors
- [ ] WebRTC pip dependencies installed
- [ ] Player integrated with WebRTC
- [ ] Frontend component added to page
- [ ] Local testing successful
- [ ] Latency <500ms confirmed
- [ ] Multi-viewer tested (2-3 concurrent viewers)

---

## 🐛 Troubleshooting

### "Module 'aiortc' not found"
```bash
pip install aiortc
```

### "Could not find ffmpeg"
- **Windows**: Download from https://ffmpeg.org/, add to PATH
- **Linux**: `sudo apt-get install ffmpeg`
- **Mac**: `brew install ffmpeg`

### "Stream not starting"
1. Check player logs for errors
2. Verify SignalR connection is established first
3. Check firewall isn't blocking connections
4. Confirm backend StreamingHub is running

### "High CPU usage"
- Lower quality: `"quality": "480p"`
- Lower FPS: `"fps": 10`
- Limit concurrent viewers

---

## 📊 Performance Expectations

| Quality | CPU Usage | Bandwidth | Viewers Support |
|---------|-----------|-----------|-----------------|
| 240p    | ~5%       | 400 Kbps  | 15+             |
| 480p    | ~8%       | 800 Kbps  | 10-12           |
| 720p    | ~12%      | 1.5 Mbps  | 8-10            |
| 1080p   | ~18%      | 3 Mbps    | 5-6             |

**Recommended**: 720p @ 15fps for best balance

---

Next file to edit: `ccms_player.py` (add WebRTC event handlers)
Use `webrtc_integration_demo.py` as reference!
