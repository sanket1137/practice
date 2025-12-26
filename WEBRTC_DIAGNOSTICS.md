# WebRTC Live Streaming - Diagnostic & Debugging Tools

## 📊 Browser DevTools Diagnostic Script

Copy and paste this into **Browser Console (F12)** while streaming:

```javascript
// ============================================
// COMPREHENSIVE WEBRTC DIAGNOSTICS
// ============================================

console.log('🔍 WebRTC Diagnostic Report');
console.log('=' * 50);

// 1. VIDEO ELEMENT STATE
const video = document.querySelector('video');
if (video) {
    console.group('📺 Video Element');
    console.log('readyState:', video.readyState, 
                `(${['HAVE_NOTHING','HAVE_METADATA','HAVE_CURRENT_DATA','HAVE_FUTURE_DATA','HAVE_ENOUGH_DATA'][video.readyState]})`);
    console.log('networkState:', video.networkState,
                `(${['NETWORK_EMPTY','NETWORK_IDLE','NETWORK_LOADING','NETWORK_NO_SOURCE'][video.networkState]})`);
    console.log('playing:', video.playing);
    console.log('paused:', video.paused);
    console.log('ended:', video.ended);
    console.log('duration:', video.duration);
    console.log('currentTime:', video.currentTime);
    console.log('buffered:', video.buffered.length > 0 ? `${video.buffered.length} ranges` : 'none');
    console.groupEnd();
} else {
    console.error('❌ No video element found!');
}

// 2. MEDIASTREAM & TRACK INFO
console.group('📡 MediaStream & Tracks');
const stream = video?.srcObject;
if (stream) {
    console.log('Stream id:', stream.id);
    console.log('Active:', stream.active);
    
    const tracks = stream.getTracks();
    console.log('Total tracks:', tracks.length);
    
    tracks.forEach((track, idx) => {
        console.group(`Track ${idx} (${track.kind})`);
        console.log('id:', track.id);
        console.log('label:', track.label);
        console.log('enabled:', track.enabled);
        console.log('readyState:', track.readyState);
        
        const settings = track.getSettings();
        console.log('settings:', settings);
        
        const capabilities = track.getCapabilities?.();
        console.log('capabilities:', capabilities);
        console.groupEnd();
    });
} else {
    console.warn('⚠️ No stream attached to video element');
}
console.groupEnd();

// 3. PEER CONNECTION STATE
console.group('🌐 Peer Connection State');
if (typeof window.pc !== 'undefined' && window.pc) {
    const pc = window.pc;
    console.log('connectionState:', pc.connectionState);
    console.log('iceConnectionState:', pc.iceConnectionState);
    console.log('iceGatheringState:', pc.iceGatheringState);
    console.log('signalingState:', pc.signalingState);
    console.log('connectionStateChange handlers:', pc.onconnectionstatechange ? '✅' : '❌');
    
    // Local candidates
    const localCandidates = pc.sctp?.transport?.iceTransport?.getLocalCandidates?.();
    console.log('Local ICE candidates:', localCandidates?.length || 0);
    
    // Remote candidates  
    const remoteCandidates = pc.sctp?.transport?.iceTransport?.getRemoteCandidates?.();
    console.log('Remote ICE candidates:', remoteCandidates?.length || 0);
} else {
    console.warn('⚠️ window.pc not found. Make sure to expose pc in your component.');
}
console.groupEnd();

// 4. RTC STATS
console.group('📈 RTC Statistics');
if (window.pc) {
    window.pc.getStats().then(report => {
        const stats = {
            inboundRtp: [],
            outboundRtp: [],
            candidate: [],
            transport: [],
            remote: [],
            local: []
        };
        
        report.forEach(stat => {
            if (stat.type === 'inbound-rtp' && stat.mediaType === 'video') {
                stats.inboundRtp.push(stat);
            } else if (stat.type === 'outbound-rtp' && stat.mediaType === 'video') {
                stats.outboundRtp.push(stat);
            } else if (stat.type === 'candidate-pair') {
                stats.candidate.push(stat);
            } else if (stat.type === 'transport') {
                stats.transport.push(stat);
            } else if (stat.type === 'remote-candidate') {
                stats.remote.push(stat);
            } else if (stat.type === 'local-candidate') {
                stats.local.push(stat);
            }
        });
        
        // Inbound RTP (receiving)
        if (stats.inboundRtp.length > 0) {
            console.group('📥 Inbound RTP (Receiving)');
            stats.inboundRtp.forEach((stat, idx) => {
                console.log(`Stream ${idx}:`);
                console.log('  packetsReceived:', stat.packetsReceived || 'N/A');
                console.log('  bytesReceived:', stat.bytesReceived || 'N/A');
                console.log('  frameWidth:', stat.frameWidth || 'N/A');
                console.log('  frameHeight:', stat.frameHeight || 'N/A');
                console.log('  framesDecoded:', stat.framesDecoded || 'N/A');
                console.log('  framesDropped:', stat.framesDropped || 'N/A');
                console.log('  frameRate:', stat.framesPerSecond || 'N/A');
                console.log('  jitter:', stat.jitter?.toFixed(4) || 'N/A');
                console.log('  timestamp:', new Date(stat.timestamp).toLocaleTimeString());
            });
            console.groupEnd();
        } else {
            console.warn('⚠️ No inbound RTP stats - frames may not be arriving');
        }
        
        // ICE candidates
        console.group('🧊 ICE Candidates');
        console.log('Local candidates:', stats.local.length);
        console.log('Remote candidates:', stats.remote.length);
        console.log('Candidate pairs:', stats.candidate.length);
        if (stats.candidate.length > 0) {
            const active = stats.candidate.find(c => c.state === 'succeeded');
            if (active) {
                console.log('✅ Active candidate pair found');
                console.log('  currentRoundTripTime:', active.currentRoundTripTime?.toFixed(4) || 'N/A');
                console.log('  availableOutgoingBitrate:', active.availableOutgoingBitrate || 'N/A');
                console.log('  availableIncomingBitrate:', active.availableIncomingBitrate || 'N/A');
            }
        }
        console.groupEnd();
    }).catch(e => console.error('Error getting stats:', e));
} else {
    console.warn('⚠️ window.pc not available for stats');
}
console.groupEnd();

// 5. SUMMARY & DIAGNOSTICS
console.group('✅ Diagnostic Summary');
const issues = [];

if (!video) issues.push('No video element');
if (!stream) issues.push('No stream attached to video');
if (video && video.readyState < 4) issues.push(`Video readyState is ${video.readyState}, should be 4`);
if (window.pc && window.pc.connectionState !== 'connected') issues.push(`PC connection state is ${window.pc?.connectionState}`);

if (issues.length === 0) {
    console.log('✅ All systems operational!');
    console.log('Video should be displaying live content.');
} else {
    console.error('❌ Issues detected:');
    issues.forEach(issue => console.error('  -', issue));
}
console.groupEnd();

console.log('='.repeat(50));
console.log('End of diagnostic report');
```

## 🔧 Player-Side Logging Enhancement

Add this snippet to **player/webrtc_streamer.py** in the `_pump_frames` method for detailed monitoring:

```python
async def _pump_frames(self, viewer_id: str):
    """Enhanced version with detailed diagnostics"""
    frame_count = 0
    error_count = 0
    last_log_frame = 0
    start_time = time.time()
    
    try:
        logger.info(f"[Pump] 🎬 Frame pump started for {viewer_id}")
        
        while viewer_id in self.peer_connections and self.is_streaming:
            try:
                frame = await self.screen_track.recv()
                frame_count += 1
                
                # Log every 30 frames (2 seconds at 15 FPS)
                if frame_count - last_log_frame >= 30:
                    elapsed = time.time() - start_time
                    actual_fps = frame_count / elapsed if elapsed > 0 else 0
                    logger.info(
                        f"[Pump] ✅ {viewer_id}: "
                        f"{frame_count} frames | "
                        f"FPS: {actual_fps:.1f} | "
                        f"Time: {elapsed:.1f}s"
                    )
                    last_log_frame = frame_count
                
                await asyncio.sleep(1 / self.screen_track.fps)
                
            except asyncio.CancelledError:
                logger.info(f"[Pump] 🛑 Cancelled for {viewer_id} after {frame_count} frames")
                break
            except Exception as e:
                error_count += 1
                logger.error(
                    f"[Pump] ⚠️  Error for {viewer_id} "
                    f"(frame {frame_count}, error #{error_count}): {e}"
                )
                if error_count > 10:
                    logger.error(f"[Pump] ❌ Too many errors for {viewer_id}, stopping")
                    break
                await asyncio.sleep(0.1)
        
        elapsed_total = time.time() - start_time
        avg_fps = frame_count / elapsed_total if elapsed_total > 0 else 0
        logger.info(
            f"[Pump] 🎬 Stopped for {viewer_id}: "
            f"{frame_count} total frames over {elapsed_total:.1f}s "
            f"({avg_fps:.1f} FPS avg)"
        )
        
    except Exception as e:
        logger.error(f"[Pump] 💥 Critical error for {viewer_id}: {e}")
    finally:
        if viewer_id in self.pump_tasks:
            del self.pump_tasks[viewer_id]
```

## 🧪 Test Scenarios & Expected Results

### Scenario 1: Single Viewer, Fresh Connection

**Expected Player Logs:**
```
[WebRTC-Poll] Found 1 NEW viewer(s)
New viewer connected: viewer-abc123
[WebRTC] Adding video track via relay for viewer-abc123
[Pump] Starting frame pump for viewer-abc123
[Pump] 🎬 Frame pump started for viewer-abc123
[Pump] ✅ Frames pumped for viewer-abc123: 30 frames
[Pump] ✅ Frames pumped for viewer-abc123: 60 frames
```

**Expected Browser Console:**
```
[WebRTC] Received offer from player
[WebRTC] Sent answer to player
[WebRTC] Received remote track
readyState: 4 (should be HAVE_ENOUGH_DATA)
packetsReceived: > 0
frameWidth: 1280, frameHeight: 720
```

### Scenario 2: Multiple Viewers (3 concurrent)

**Expected Player Logs:**
```
[Pump] 🎬 Frame pump started for viewer-abc123
[Pump] 🎬 Frame pump started for viewer-def456  
[Pump] 🎬 Frame pump started for viewer-ghi789
[Pump] ✅ Frames pumped for viewer-abc123: 30 frames
[Pump] ✅ Frames pumped for viewer-def456: 30 frames
[Pump] ✅ Frames pumped for viewer-ghi789: 30 frames
```

**Key:** All pumps show similar frame counts = synchronized streaming

### Scenario 3: Viewer Disconnect

**Expected Player Logs:**
```
Connection state for viewer-abc123: failed
[WebRTC] Viewer viewer-abc123 disconnected (state: failed)
[Pump] Frame pump cancelled for viewer-abc123 after 450 frames
[WebRTC] Cleaned up resources for viewer-abc123
```

## 🚨 Troubleshooting Decision Tree

```
Video is BLACK?
├─ Check: [Pump] started log in player?
│  ├─ NO → Pump task not created
│  │   └─ Fix: Verify handle_viewer_connected called
│  └─ YES → Continue below
│
├─ Check: [Pump] frames pumped log in player?
│  ├─ NO → recv() not being called
│  │   └─ Fix: Check ScreenCaptureTrack initialization
│  └─ YES → Frame pump is active, continue below
│
├─ Check: Browser readyState === 4?
│  ├─ NO (0) → No frames arriving at browser
│  │   └─ Likely: WebRTC connection issue
│  │   └─ Fix: Check RTCStats for inbound-rtp packets
│  ├─ 1-3 → Buffering, might play soon
│  └─ 4 → Continue below
│
└─ Check: Browser console RTC Stats
   ├─ packetsReceived = 0? → Network issue
   │  └─ Fix: Check firewall, ICE candidates
   ├─ frameWidth/Height empty? → No video data
   │  └─ Fix: Check frame generation in recv()
   └─ All good? → Video should play!
      └─ Check: autoplay attribute on <video>
      └─ Try: video.play() in console
```

## 📋 Health Check Checklist

Run this every 5 minutes during extended streaming:

```javascript
// Quick health check
const health = {
    timestamp: new Date().toISOString(),
    videoReadyState: document.querySelector('video')?.readyState,
    pcConnectionState: window.pc?.connectionState,
    fps: 'N/A'
};

// Get FPS from stats
if (window.pc) {
    window.pc.getStats().then(report => {
        report.forEach(stat => {
            if (stat.type === 'inbound-rtp' && stat.mediaType === 'video') {
                health.fps = stat.framesPerSecond?.toFixed(1) || 'N/A';
                health.packetsReceived = stat.packetsReceived;
            }
        });
        console.table(health);
    });
}

// Log to console
window.healthLog = window.healthLog || [];
window.healthLog.push(health);
console.log(`Health checks logged: ${window.healthLog.length}`);
```

---

**Use these tools to diagnose and verify WebRTC streaming is working correctly!**
