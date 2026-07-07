# PixelSpot Player — iOS

A SwiftUI-based digital signage player for iOS/iPadOS that pairs with the PixelSpot CCMS and
plays ad content in kiosk mode.

## Requirements

- Xcode 15+
- iOS 17+ / iPadOS 17+
- PixelSpot CCMS backend (`https://ccms.pixelspot.in`)

## Architecture

```
PixelSpotPlayerApp       ← @main, checks paired state
├── PairingView           ← QR code + manual entry
│   └── PairingViewModel  ← Calls /pairing/request, polls /pairing/status
├── PlayerView            ← AVPlayer (video) / AsyncImage (images)
│   └── PlayerViewModel   ← Manifest sync, 30s heartbeat, remote commands
└── Services/
    ├── ApiClient.swift   ← URLSession async/await API calls
    └── SecureStorage.swift ← iOS Keychain (encrypted device token)
```

## Pairing Flow

1. App launches → checks Keychain for device token
2. No token → shows QR code (calls `/api/v1/players/pairing/request`)
3. CMS user scans QR or enters 6-char code at CCMS web UI
4. App polls `/api/v1/players/pairing/status` every 5 seconds
5. On success, device token saved to Keychain; PlayerView shown

## Kiosk Mode (Guided Access)

PixelSpot Player is designed to run under iOS **Guided Access**:

1. Settings → Accessibility → Guided Access → Enable
2. Set a passcode
3. Open PixelSpot Player app
4. Triple-click side button → Start Guided Access
5. This locks the device to the app and disables the home button

For unattended commercial deployments, also enable:
- Settings → Display & Brightness → Auto-Lock → Never
- Settings → Accessibility → Guided Access → Passcode Settings → Touch ID/Face ID

## Remote Commands

The player responds to the following commands sent from CCMS:

| Command | Effect |
|---|---|
| `refreshManifest` | Re-fetches content manifest |
| `unpair` | Clears token, returns to pairing screen |

## Building

```bash
open PixelSpotPlayer/PixelSpotPlayer.xcodeproj
# Select target device → Product → Build
```

For App Store / MDM distribution, configure signing in Xcode project settings.
