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
