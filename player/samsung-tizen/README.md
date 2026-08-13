# PixelSpot Player — Samsung Tizen

An HTML5-based digital signage player for Samsung commercial displays running Tizen OS (3.0+).
Packaged as a WGT app using Tizen Studio CLI.

## Requirements

- Samsung Commercial Display with Tizen OS 3.0+
- Tizen Studio 5.0+ with TV Extensions
- PixelSpot CCMS backend

## Project Structure

```
samsung-tizen/
├── config.xml        ← Tizen app manifest (privileges, version)
├── index.html        ← Main entry point (1920×1080)
├── player.js         ← Playback engine
├── pairing.js        ← QR pairing + manual code
├── secureStorage.js  ← tizen.keymanager encrypted storage
└── README.md
```

## Secure Storage

Uses `tizen.keymanager` API for encrypted persistent storage. The device token is
never stored in plaintext localStorage on the final device.

## Building & Installing

```bash
# In Tizen Studio: File → Import → Tizen Project
# Then: Project → Build Package → generates .wgt file

# CLI alternative:
tizen build-web -out build
tizen package -t wgt -o ./ -- build

# Install on connected device:
tizen install -n PixelSpotPlayer.wgt -t <device-serial>
```

## Kiosk Mode (Samsung SSSP)

Samsung SSSP (Smart Signage Platform) supports native kiosk mode:

1. URL Launcher / Custom App mode via the display's built-in setup wizard
2. Device Management settings → set app to auto-launch on boot
3. Tizen Studio → Security Profile → set as Store app for permanent install

## Remote Commands

| Command | Effect |
|---|---|
| `refreshManifest` | Re-fetches content playlist |
| `unpair` | Clears token, returns to pairing screen |
