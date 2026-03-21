# PixelSpot CCMS — Player Build & Sharing Guide

How to build, run, and share the ChromeOS and Android players with friends for testing.

---

## Quick Start

```powershell
# From the project root:

# Interactive menu — pick what to build
.\player\run-player.ps1

# Or build a specific player directly:
.\player\run-player.ps1 -ChromeOS      # Build + serve PWA on localhost:3100
.\player\run-player.ps1 -Android       # Build debug APK
.\player\run-player.ps1 -Both          # Build both
```

---

## ChromeOS Player (PWA)

### Prerequisites
- **Node.js 18+** — [https://nodejs.org/](https://nodejs.org/)

### Build & Run
```powershell
.\player\run-chromeos.ps1              # Build + serve on localhost:3100
.\player\run-chromeos.ps1 -Build       # Build only (produces dist/)
.\player\run-chromeos.ps1 -Serve       # Serve existing dist/
.\player\run-chromeos.ps1 -Port 8080   # Custom port
```

### Output
- `player/chromeos/dist/` — static files ready to deploy

### Share with Friends

**Option A: Same Wi-Fi network**
1. Run `.\player\run-chromeos.ps1` — it prints your LAN IP
2. Friend opens `http://<your-ip>:3100` in Chrome
3. Chrome shows "Install app" prompt → click to install as PWA

**Option B: Deploy to the internet (free)**
```bash
# Using Vercel (recommended)
cd player/chromeos
npx vercel dist/

# Using Netlify
cd player/chromeos
npx netlify deploy --dir=dist --prod

# Using any static host (Nginx, Apache, S3, etc.)
# Just upload the contents of dist/
```

**Option C: Quick share via `npx serve`**
```bash
cd player/chromeos
npx serve dist -l 3100
```

### How Friends Set It Up
1. Open the URL in Chrome (or install as PWA)
2. The Setup Screen appears on first launch
3. Enter:
   - **Server URL:** `https://ccms.pixelspot.in`
   - **Screen ID:** UUID from the CCMS dashboard (when they create a screen)
   - **API Key:** Generated when the screen is created (shown once)
4. Click "Connect" — player authenticates and starts playback

---

## Android Player (APK)

### Prerequisites
- **JDK 17+** — [https://adoptium.net/](https://adoptium.net/) (Temurin recommended)
- **Android SDK** — via [Android Studio](https://developer.android.com/studio) or standalone SDK
- `ANDROID_HOME` environment variable set (Android Studio sets this automatically)

### Build
```powershell
.\player\run-android.ps1                   # Debug APK
.\player\run-android.ps1 -Release          # Release APK (minified, unsigned)
.\player\run-android.ps1 -Install          # Build + install on connected device
.\player\run-android.ps1 -Clean            # Clean build
.\player\run-android.ps1 -Clean -Install   # Clean build + install
```

### Output
- `player/android/output/PixelSpot-Player-Debug.apk` (debug build)
- `player/android/output/PixelSpot-Player-Release.apk` (release build)

### Share with Friends

1. **Send the APK file** — via WhatsApp, Telegram, Google Drive, email, etc.
2. Friend downloads and opens the APK on their Android phone/TV
3. Android will prompt: **"Install from unknown sources"** → Allow it
4. The app installs as **"CCMS Player"**

### How Friends Set It Up
1. Open **CCMS Player** from the app drawer
2. The Setup Screen appears on first launch
3. Enter:
   - **Server URL:** `https://ccms.pixelspot.in`
   - **Screen ID:** UUID from the CCMS dashboard
   - **API Key:** Generated when the screen is created
4. The app validates by performing a handshake with the server
5. On success, fullscreen playback begins

### Install via ADB (developers)
```bash
adb install -r player/android/output/PixelSpot-Player-Debug.apk
```

### Kiosk Mode (production deployment)
```bash
# Lock the app to the screen (no home/back buttons)
adb shell dpm set-device-owner com.pixelspot.ccms.player/.kiosk.AdminReceiver

# Exit kiosk mode for maintenance
adb shell am broadcast -a com.pixelspot.ccms.player.EXIT_KIOSK
```

---

## Friend's Testing Checklist

Before giving the player to friends, make sure they have:

1. **A PixelSpot account** — register at `https://ccms.pixelspot.in` as a Screen Owner
2. **A screen created** in the dashboard — this gives them:
   - Screen ID (UUID)
   - API Key (shown once on creation — save it!)
3. **The player app** — either the APK file or the ChromeOS PWA URL
4. **An internet connection** — the player needs to reach the backend

### Test Flow
```
Friend registers → Creates a screen → Gets Screen ID + API Key
                                           ↓
                              Installs/opens the player
                                           ↓
                              Enters Screen ID + API Key
                                           ↓
                              Player handshakes with server
                                           ↓
                              Screen shows "Online" in dashboard
                                           ↓
                              Player plays default video (or ads if booked)
```

---

## Troubleshooting

### ChromeOS Player
| Issue | Fix |
|-------|-----|
| `npm install` fails | Ensure Node.js 18+ is installed: `node --version` |
| Build fails with TypeScript errors | Run `cd player/chromeos && npx tsc --noEmit` to see errors |
| Can't access from another device | Use `--host` flag (the script does this), ensure firewall allows port 3100 |
| Service worker issues | Clear browser cache or open in incognito mode |

### Android Player
| Issue | Fix |
|-------|-----|
| `JAVA_HOME not found` | Install JDK 17+, set `JAVA_HOME` env var |
| `ANDROID_HOME not found` | Install Android Studio, or set `ANDROID_HOME` to SDK path |
| Gradle sync fails | Run `.\player\run-android.ps1 -Clean` for a fresh build |
| APK won't install | Enable "Install from unknown sources" in device settings |
| `local.properties` missing | The script auto-creates it from `ANDROID_HOME` |
| Build takes very long first time | Normal — Gradle downloads ~500MB of dependencies on first build |

---

## Script Reference

| Script | Description |
|--------|-------------|
| `player/run-player.ps1` | Combined launcher — interactive menu or use flags |
| `player/run-chromeos.ps1` | ChromeOS player — build + serve PWA |
| `player/run-android.ps1` | Android player — build APK |

### Flags

**`run-player.ps1`**
| Flag | Description |
|------|-------------|
| `-ChromeOS` | Build ChromeOS player |
| `-Android` | Build Android player |
| `-Both` | Build both players |
| `-Release` | Android: release build |
| `-Install` | Android: install on device |
| `-BuildOnly` | ChromeOS: build without serving |
| `-Port 8080` | ChromeOS: custom port |

**`run-chromeos.ps1`**
| Flag | Description |
|------|-------------|
| `-Build` | Build only (no server) |
| `-Serve` | Serve existing dist/ |
| `-Port 8080` | Custom port (default: 3100) |

**`run-android.ps1`**
| Flag | Description |
|------|-------------|
| `-Release` | Release APK (minified) |
| `-Install` | Install on connected device |
| `-Clean` | Clean build cache first |
