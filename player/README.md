# CCMS Player

The CCMS player runs on digital signage hardware to display scheduled ad content, track impressions, and communicate with the CCMS backend in real-time.

## Player Implementations

| Platform | Technology | Status |
|----------|-----------|--------|
| [Raspberry Pi](raspberrypi/) | Python 3.11+, MPV/VLC, systemd | ✅ Production |
| [Android TV](android/) | Kotlin, ExoPlayer (Media3), Foreground Service | ✅ Complete |
| [ChromeOS](chromeos/) | TypeScript, Vite PWA, SignalR, HTML5 Video | ✅ Complete |

## Shared Architecture

Both implementations follow the same protocol:

```
┌─────────────────────────────────────────────────────┐
│                    CCMS Backend                      │
│  REST: /api/player/handshake, /sync, /heartbeat     │
│  SignalR: /hubs/playback (real-time events)          │
└──────────┬──────────────────┬──────────────┬─────────┘
           │                  │              │
   ┌───────▼───────┐  ┌──────▼──────┐ ┌─────▼─────────┐
   │ Raspberry Pi  │  │ Android TV  │ │  ChromeOS     │
   │  Python/MPV   │  │ Kotlin/ExoP │ │  TS/Vite PWA  │
   │  SQLite       │  │ Room(SQLite)│ │  IndexedDB    │
   │  systemd      │  │ FG Service  │ │  Service Wkr  │
   └───────────────┘  └─────────────┘ └───────────────┘
```

### Protocol Flow

1. **Handshake** (`POST /api/player/handshake`) — Authenticate with `screen_id` + `api_key`, receive playlist + session token + operating hours
2. **Heartbeat Loop** (every 30s, `POST /api/player/heartbeat`) — Keep-alive, update `LastSeenAt`
3. **Playback Loop** — Play playlist items sequentially, record impressions locally
4. **Sync Loop** (every 1–10 min, `POST /api/player/sync`) — Batch upload pending impressions with `SlotPlayKey` deduplication
5. **SignalR Events** — Real-time `PlaylistUpdated`, `SlotStatusChanged`, `SetSyncMode` from backend

### Configuration Required

| Field | Description |
|-------|-------------|
| `screen_id` | GUID assigned when screen is created in CCMS dashboard |
| `api_key` | API key generated for the screen (hashed server-side via BCrypt) |
| `server_url` | Backend URL (production: `https://ccms.pixelspot.in`) |

### Security

- **Device Fingerprinting**: Hardware-based fingerprint (SHA-256) bound to screen on first handshake
- **HMAC-SHA256 Signing**: All API requests signed with `api_key + server_salt`
- **Session Tokens**: 24-hour expiry, renewed on handshake
- **Impression Verification**: Each impression includes a verification hash to prevent tampering
- **SlotPlayKey Dedup**: `SHA256(screen_id|date|slot_number|timestamp)` prevents duplicate impression recording

---

## Future Work & Roadmap

### 🔴 P0 — Offline Video Playback (ChromeOS)

The current ChromeOS PWA **cannot play videos offline**. The Service Worker only caches the app shell (HTML, JS, CSS, icons). All video content streams directly from Cloudflare R2 URLs on every play via `<video>.src = item.creativeUrl`.

**What works offline today:**
- App shell loads (cached by Service Worker)
- Player config persists (localStorage)
- Pending impressions survive restart (IndexedDB)

**What breaks offline:**
- Video content (streamed from R2 every time)
- Playlist data (fetched from API on handshake/sync)
- Heartbeat & sync loops (require network)
- SignalR real-time events

**Implementation plan:**
1. **Video Pre-Caching** — After receiving playlist on handshake/sync, download all video files into Cache Storage (or IndexedDB blobs for <50MB clips). Use `navigator.storage.estimate()` to check quota before downloading.
2. **Playlist Persistence** — Store the current playlist in IndexedDB so the player can load and play cached content without an API call.
3. **Enhanced Service Worker** — Intercept video URL fetches and serve from cache when available. Implement a cache-first strategy for video assets and network-first for API calls.
4. **Cache Eviction** — Implement LRU eviction when storage approaches quota. Prioritize keeping videos from the current day's playlist.
5. **Sync on Reconnect** — Detect `navigator.onLine` changes. When connectivity resumes, batch-upload pending impressions and refresh the playlist.
6. **Storage Quota UI** — Show remaining storage and cached video count in a diagnostic overlay.

### 🟡 P1 — Reliability & Error Recovery

#### Graceful Degradation on Handshake Failure
Currently, if all 10 handshake retries fail, the player shows an error and stops. Instead:
- Cache the last successful handshake response (playlist + operating hours) in localStorage
- On handshake failure, fall back to cached data and show "Last updated X ago" indicator
- Implement a background retry timer (every 5 min) to recover automatically

#### Video Playback Error Retry
On video load error, the player currently waits 2s and skips. Instead:
- Retry the same video 3× with exponential backoff (1s, 2s, 4s)
- On final failure, show black screen for the slot duration (don't skip)
- Track per-URL error rate; disable URLs with >50% failure rate in the session

#### Heartbeat Failure Escalation
Heartbeat failures are logged but not acted upon:
- After 3 consecutive failures, trigger a full re-handshake
- Send diagnostics data (error counts, uptime, memory) alongside heartbeat
- Allow server to configure heartbeat interval dynamically

#### Sync Confirmation
After uploading impressions, there's no server-side ACK per record:
- Server should return confirmed `SlotPlayKey` list in sync response
- Only mark impressions as synced after server confirms specific keys
- Re-sync "presumed synced" records after 1 hour if no confirmation

### 🟡 P2 — Monitoring & Diagnostics

#### Player Telemetry
No persistent metrics are collected today. Implement:
- Handshake success rate, avg latency
- Video playback error count per hour
- Impression sync success rate
- SignalR connection uptime percentage
- Memory & CPU usage trends
- Send metrics digest to server every 12 hours via sync endpoint

#### Persistent Logging
All logs are console-only. Add:
- Circular log buffer (last 1000 messages) in localStorage
- Batch log upload to server every hour or on critical error
- Include session ID in all logs for cross-referencing
- Global `window.onerror` and `window.onunhandledrejection` handlers to catch silent crashes

#### Video Performance Tracking
No quality monitoring exists. Add:
- Use `video.getVideoPlaybackQuality()` for dropped frame detection
- Track buffering duration and frequency per video
- Monitor decode errors and report per creative URL
- Send FPS telemetry with impression sync

### 🟢 P3 — Playlist & Content Management

#### Smooth Playlist Transitions
`handlePlaylistUpdate()` resets `currentIndex` to 0, interrupting current playback:
- Only replace items after the current index
- Queue updates until the current video finishes naturally
- Add a brief fade transition between old and new playlist content

#### Empty Playlist Filler
If playlist is empty, player shows "No content scheduled" text:
- Request emergency filler content from server (house logo, generic ads)
- Fall back to previous day's cached playlist for the same time slot
- Show a branded "Live content pending" screen instead of plain text

#### Playlist Validation
No schema validation on playlist responses:
- Add Zod schema validation for `PlaylistResponse`
- Validate `creativeUrl` is a valid HTTPS URL
- Skip invalid items gracefully instead of crashing

### 🟢 P4 — Security Hardening

#### API Key Storage
API key is stored in plain localStorage:
- Evaluate moving to sessionStorage (requires re-entry on reload)
- Implement device-bound key rotation on each handshake
- Consider server-side API proxy to avoid sending raw keys to player

#### HTTPS Enforcement
Custom server URLs could be HTTP:
- Block non-HTTPS URLs in the setup screen (except `localhost` for dev)
- Validate server certificate on first connection

#### Response Signature Verification
API responses are not cryptographically signed:
- Implement HMAC-SHA256 verification on playlist/handshake responses
- Pin server certificate or public key in manifest

### 🔵 P5 — Build & Deployment

#### Vite Optimizations
- Add code splitting for vendor chunks (SignalR, QR library)
- Lazy-load verification flow (only needed on first setup)
- Generate sourcemaps for production debugging
- Add bundle size analysis to CI

#### Environment Configuration
- Support Vite env variables (`import.meta.env.VITE_SERVER_URL`) for build-time config
- Allow server URL override via URL parameter for staging/testing
- Add build version stamp (git hash) visible in diagnostic overlay

#### Verification Flow Polish
- Use `expiresAt` from challenge response to set QR refresh timer (instead of fixed 4-min interval)
- Implement exponential backoff for verification status polling (10s → 30s → 60s)
- Add 24-hour timeout with retry option if admin never verifies

### 🔵 P6 — Operating Hours Precision
Current implementation polls every 60 seconds:
- Calculate exact minutes until next operating hour boundary
- Set timer to fire at the exact transition second
- Add configurable buffer (e.g., start 30s early, stop 30s late) for smoother transitions
