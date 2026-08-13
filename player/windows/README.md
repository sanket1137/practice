# PixelSpot Windows Player

WPF-based digital signage player for Windows 10/11. Targets enterprise retail, hospitality, and corporate lobby environments.

## Requirements

- Windows 10 version 1809 or later (64-bit)
- .NET 8.0 Runtime (Desktop)
- Network access to `https://ccms.pixelspot.in`

## Quick Start

### First Launch — Device Pairing

1. Run `PixelSpotPlayer.exe`
2. The **Pairing Window** opens — it displays a 6-character code and QR code
3. In the PixelSpot dashboard: **Admin → Player Pairing → Approve Device**
4. Scan the QR code or enter the 6-character code
5. Player automatically transitions to fullscreen kiosk mode

### Manual Pairing (no QR scanner)

1. On launch, type the 6-character code shown in the dashboard into the "Enter code manually" box
2. Click **Pair**

## Architecture

```
player/windows/
├── PixelSpotPlayer.csproj    — .NET 8 WPF project
├── App.xaml / App.xaml.cs    — Startup: checks stored token → MainWindow or PairingWindow
├── PairingWindow.xaml/.cs    — QR code + polling for admin approval
├── MainWindow.xaml/.cs       — Fullscreen kiosk, MediaElement playback, keyboard lock
└── Services/
    ├── ApiClient.cs          — All CCMS HTTP calls (heartbeat, manifest, pairing)
    ├── SecureStorage.cs      — Windows DPAPI credential storage (no plaintext secrets)
    ├── ContentDownloader.cs  — Downloads content from R2 to local cache
    ├── PlaylistEngine.cs     — Ordered playlist, round-robin playback
    └── PlayerService.cs      — 30s heartbeat loop, manifest sync, remote command dispatch
```

## Kiosk Mode

- `WindowStyle="None"`, `WindowState="Maximized"`, `Topmost="True"` — no title bar
- Low-level keyboard hook blocks: Win key, Alt+F4, Escape, Tab, F1, PrintScreen
- Window `Closing` is cancelled unless the device has been explicitly unpaired
- To exit kiosk mode: send `unpair` remote command from the CCMS dashboard

## Remote Commands

Commands are delivered via the heartbeat response (`Commands[]`):

| Command    | Payload        | Effect                                  |
|------------|----------------|-----------------------------------------|
| `play`     | —              | Resume video playback                   |
| `pause`    | —              | Pause video playback                    |
| `skip`     | —              | Skip to next item in playlist           |
| `volume`   | `0.0`–`1.0`    | Set audio volume                        |
| `brightness` | `0.0`–`1.0` | Adjust display brightness overlay      |
| `restart`  | —              | Re-sync manifest from server            |
| `unpair`   | —              | Clear token, show pairing screen        |

## Content Playback

- **Videos**: `.mp4`, `.webm` — played via WPF `MediaElement` (hardware H.264/H.265)
- **Images**: `.jpg`, `.png`, `.gif` — displayed for `DurationSeconds` then auto-advance
- **Playlist**: round-robin ordered loop; continues from cache if network is offline
- **Cache**: `%LOCALAPPDATA%\PixelSpot\Player\cache\` — pruned automatically on sync

## Security

- Device token encrypted with **Windows DPAPI** (machine scope) at rest
- Token never written in plaintext; never logged
- All API calls use HTTPS; token sent as `Authorization: Bearer <token>`
- No admin/user credentials stored — only the opaque device token

## Build

```powershell
cd player/windows
dotnet restore
dotnet build -c Release
dotnet publish -c Release -r win-x64 --self-contained true -o publish/
```

## Configuration

Set `CCMS_SERVER` environment variable to override the default server URL:

```powershell
$env:CCMS_SERVER = "https://ccms.pixelspot.in"
.\PixelSpotPlayer.exe
```

Default: `https://ccms.pixelspot.in`

## Autostart (Windows Task Scheduler)

Run at user logon without requiring admin rights:

```powershell
$action = New-ScheduledTaskAction -Execute "C:\Program Files\PixelSpot\PixelSpotPlayer.exe"
$trigger = New-ScheduledTaskTrigger -AtLogOn
Register-ScheduledTask -TaskName "PixelSpotPlayer" -Action $action -Trigger $trigger -RunLevel Limited
```
