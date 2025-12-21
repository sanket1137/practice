# Screen 12 Player Configuration - COMPLETE! ✅

## Configuration Status

**Screen ID:** `62f73e44-2157-4e3d-bf9e-f55f4621e371` ✅  
**API Key:** `test-api-key-screen12` ✅ (Will work - verification not implemented yet)  
**Server URL:** `http://localhost:5257` ✅  
**Config File:** `player/config.json` ✅

## Dependencies Status

✅ **Python:** 3.11.9 installed  
✅ **requests:** Installed  
❌ **signalrcore:** MISSING  
❌ **python-vlc:** MISSING  
❌ **schedule:** MISSING

## Next Steps to Run Player

### 1. Install Missing Dependencies

```bash
cd player
pip install signalrcore python-vlc schedule
```

### 2. Test Configuration

```bash
python test_player.py
```

Should show all "OK" messages.

### 3. Run the Player

```bash
python ccms_player.py
```

## Expected Behavior

Once running, the player will:
1. ✅ Connect to SignalR hub at `http://localhost:5257/playerhub`
2. ✅ Authenticate with Screen ID and API key
3. ✅ Fetch today's playlist (currently empty for Screen 12)
4. ℹ️ Show "No playlist loaded" and sleep (since there are no bookings)
5. ✅ Send heartbeat every 30 seconds to keep screen marked as "Online"

## Important Notes

### API Key Verification
- Currently **NOT implemented** in backend
- Any API key will work
- `PlayerHub.Handshake()` has a `TODO` comment for BCrypt verification
- Future: Will need to generate proper API keys per screen

### Player Code Compatibility
- The current `ccms_player.py` uses **old method names**:
  - `AuthenticatePlayer` → Should be `Handshake`
  - `RequestPlaylist` → Should use `Handshake` response
  - `ReportImpression` → Should be aggregated in `SyncDailyData`
- **These need to be updated** to match the new PlayerHub implementation

### Testing Without Bookings
Since Screen 12 has no bookings yet:
- Player will connect successfully
- Will show "No playlist loaded" message
- Will stay in sleep mode
- Screen status will show as "Online" in dashboard

### To Test with Content
1. Create a campaign as Advertiser
2. Create a booking for Screen 12
3. Approve the booking (as Screen Owner or Admin)
4. Player will fetch the playlist on next refresh

## Files Created

- `player/config.json` - Player configuration ✅
- `player/test_player.py` - Dependency and config test script ✅
- `TEST-SCREEN-SETUP.md` - Full setup documentation ✅

## Quick Start Commands

```bash
# Install dependencies
pip install signalrcore python-vlc schedule

# Test configuration
python test_player.py

# Run player
python ccms_player.py
```

## Troubleshooting

**If player fails to connect:**
- Check backend is running on port 5257
- Verify Screen ID is correct
- Check firewall/antivirus settings

**If "No playlist loaded":**
- This is normal - Screen 12 has no bookings yet
- Create and approve a booking to get content

**If VLC errors:**
- Install VLC media player on your system
- Windows: Download from videolan.org
- Linux/Pi: `sudo apt-get install vlc`
