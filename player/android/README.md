# CCMS Android TV Player

Native Kotlin + ExoPlayer digital signage player for Android TV devices.

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                  CcmsPlayerApp                       │
│                 (Hilt DI Root)                       │
├─────────────────────────────────────────────────────┤
│                                                      │
│  SetupActivity ──→ MainActivity + PlayerView         │
│  (first run)       (fullscreen, kiosk mode)          │
│                         │                            │
│              ┌──────────▼──────────┐                 │
│              │   PlayerService     │                 │
│              │  (foreground svc)   │                 │
│              ├─────────┬──────────┤                  │
│              │         │          │                   │
│         Heartbeat   Sync    Operating                │
│         Loop(30s)  Loop     Hours Check              │
│              │     (1-10m)  (1m)                     │
│              ▼         ▼          ▼                   │
│        ┌────────┐ ┌────────┐ ┌──────────┐           │
│        │PlayerAPI│ │Room DB │ │ExoPlayer │           │
│        │Retrofit │ │ImprDao │ │Manager   │           │
│        └────────┘ └────────┘ └──────────┘           │
│              │                    │                   │
│        ┌─────▼─────┐    ┌───────▼───────┐          │
│        │SignalRClient│   │PlaylistManager│           │
│        │(real-time)  │   │(impressions)  │           │
│        └────────────┘   └───────────────┘           │
│                                                      │
│  Security Layer:                                     │
│  ├── DeviceFingerprint (ANDROID_ID, Build, MAC)     │
│  ├── SecurityManager (HMAC-SHA256, sessions)         │
│  └── ImpressionVerifier (hash per impression)       │
│                                                      │
│  Kiosk Layer:                                        │
│  ├── KioskManager (lock task, fullscreen)            │
│  ├── AdminReceiver (device owner)                    │
│  └── BootReceiver (auto-start on boot)              │
│                                                      │
│  Recovery:                                           │
│  └── CrashRecoveryManager (AlarmManager restart)    │
└─────────────────────────────────────────────────────┘
```

## Prerequisites

- **Android Studio** Hedgehog (2023.1.1) or later
- **JDK 17**
- **Android TV device** or emulator with API 24+ (Android 7.0)

## Build

```bash
# Debug build
./gradlew assembleDebug

# Release build (requires signing config)
./gradlew assembleRelease
```

## Install

```bash
# Install via ADB
adb install -r app/build/outputs/apk/debug/app-debug.apk
```

## First Run

1. Launch **CCMS Player** from the launcher
2. Enter **Server URL** (default: `https://ccms.pixelspot.in`)
3. Enter **Screen ID** (GUID from CCMS dashboard)
4. Enter **API Key** (generated when screen was created)
5. Press **Connect & Start** — validates via handshake
6. Player starts fullscreen playback automatically

## Kiosk Mode (Lock to App)

For production deployment, set the app as device owner to prevent users from exiting:

```bash
# Factory reset the Android TV device first
# Then connect via ADB during initial setup and run:
adb shell dpm set-device-owner com.pixelspot.ccms.player/.kiosk.AdminReceiver
```

This enables:
- Lock task mode (no home/back/recent apps)
- Hidden status bar and navigation
- Automatic fullscreen
- Screen stays on during operating hours

To exit kiosk mode for maintenance:
```bash
adb shell am broadcast -a com.pixelspot.ccms.player.EXIT_KIOSK
```

## Auto-Start on Boot

The app automatically starts when the device boots via `BootReceiver`. Requirements:
- App must have been opened at least once (Android OS restriction)
- RECEIVE_BOOT_COMPLETED permission granted (automatic)
- For API 31+: boot-aware components are registered in manifest

## Device Fingerprinting

Android fingerprint components (sent to server on handshake):

| Component | Source | Notes |
|-----------|--------|-------|
| cpuSerial | `Settings.Secure.ANDROID_ID` | Unique per device+app |
| diskSerial | `Build.FINGERPRINT` | Hardware + build ID |
| macAddress | `NetworkInterface` | First non-loopback MAC |
| hostname | `Build.MODEL_MANUFACTURER` | Device model |

These are hashed (SHA-256 → Base64) and bound to the screen on first connection.
Subsequent connections verify the fingerprint matches — mismatches are rejected (anti-fraud).

## Anti-Fraud Protections

- **Emulator detection**: blocks generic/SDK builds from registering
- **Root detection**: checks for su binary, Magisk, test-keys
- **Impression verification**: HMAC-SHA256 hash per impression prevents tampering
- **SlotPlayKey dedup**: SHA256(screenId|date|slot|timestamp) prevents duplicate recording
- **Session tokens**: 24-hour expiry, HMAC-signed requests

## Project Structure

```
app/src/main/java/com/pixelspot/ccms/player/
├── CcmsPlayerApp.kt          # Application (Hilt)
├── MainActivity.kt            # Fullscreen player activity
├── config/
│   └── PlayerConfig.kt        # Encrypted SharedPreferences
├── data/
│   ├── local/                 # Room database
│   │   ├── AppDatabase.kt
│   │   ├── ImpressionEntity.kt
│   │   ├── ImpressionDao.kt
│   │   ├── SyncHistoryEntity.kt
│   │   └── SyncHistoryDao.kt
│   ├── remote/                # Network layer
│   │   ├── PlayerApiService.kt  (Retrofit)
│   │   └── SignalRClient.kt
│   ├── repository/            # Business logic
│   │   ├── ImpressionRepository.kt
│   │   └── PlayerRepository.kt
│   └── model/                 # DTOs
│       ├── HandshakeRequest.kt
│       ├── HandshakeResponse.kt
│       ├── SyncRequest.kt
│       ├── HeartbeatRequest.kt
│       ├── PlaylistItem.kt
│       └── AdPlaybackEvent.kt
├── player/                    # Media playback
│   ├── ExoPlayerManager.kt
│   ├── PlaylistManager.kt
│   └── CacheManager.kt       (DefaultVideoManager)
├── service/                   # Background services
│   ├── PlayerService.kt       (foreground service)
│   ├── BootReceiver.kt
│   └── CrashRecoveryManager.kt
├── security/                  # Security layer
│   ├── DeviceFingerprint.kt
│   ├── SecurityManager.kt
│   └── ImpressionVerifier.kt
├── kiosk/                     # Kiosk mode
│   ├── KioskManager.kt
│   └── AdminReceiver.kt
├── di/                        # Hilt DI modules
│   ├── AppModule.kt
│   ├── NetworkModule.kt
│   └── PlayerModule.kt
└── ui/
    └── setup/
        └── SetupActivity.kt
```

## Troubleshooting

| Issue | Solution |
|-------|---------|
| "Device owner already set" | Factory reset the device first, then set device owner before adding any accounts |
| Handshake fails with 401 | Check API key matches the one in CCMS dashboard; device fingerprint may have changed |
| No video plays | Check internet connection; verify screen has active bookings or default video |
| Service killed by Android | The foreground notification keeps it alive; also WorkManager backup runs every 15 min |
| App crashes on boot | Check logcat for `CrashRecovery` tag; after 5 crashes in 1 hour, enters safe mode |
| SignalR disconnects | Auto-reconnects with exponential backoff (5s → 60s max) |
