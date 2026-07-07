# PixelSpot Player — LG webOS

An HTML5-based digital signage player for LG commercial displays running webOS (webOS Signage 2.0+).
Packaged as an IPK app using webOS CLI.

## Requirements

- LG Commercial Display with webOS Signage 2.0+
- webOS TV SDK / CLI: `@webos-tools/cli` (`npm install -g @webos-tools/cli`)
- PixelSpot CCMS backend

## Project Structure

```
lgwebos/
├── appinfo.json      ← App manifest (id, version, permissions)
├── index.html        ← Main entry point (1920×1080)
├── player.js         ← Playback engine (video/image, manifest sync, heartbeat)
├── pairing.js        ← QR pairing + manual code + polling
├── secureStorage.js  ← webOS luna DB service (encrypted, persistent)
└── README.md
```

## Secure Storage

Uses the webOS luna DB service (`luna://com.webos.service.db`) for encrypted persistent
storage of the device token. Falls back to `localStorage` in browser dev mode.

## Building & Installing

```bash
# Package the app
ares-package .

# Install on connected device (use ares-setup-device first)
ares-install ./in.pixelspot.player_1.0.0_all.ipk
```

## Kiosk Mode

LG commercial displays support native kiosk lock via the display settings:
1. USB Cloning → set "Auto Power On"
2. SI Server Settings → set app to launch on boot
3. Remote management → disable user controls

## Remote Commands

| Command | Effect |
|---|---|
| `refreshManifest` | Re-fetches content playlist |
| `unpair` | Clears token, returns to pairing screen |
