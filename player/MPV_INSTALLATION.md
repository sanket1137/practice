# MPV Installation Guide

## Raspberry Pi 5

```bash
# Update system
sudo apt-get update
sudo apt-get upgrade

# Install MPV and development libraries
sudo apt-get install -y mpv libmpv-dev python3-pip python3-dev

# Install Python MPV bindings
pip3 install python-mpv

# Verify installation
mpv --version

# Test hardware decode support
mpv --hwdec=help
```

## Windows (Development/Testing)

### Install MPV

**Download:**
- Visit: https://mpv.io/installation/
- Download latest Windows build (64-bit)
- Extract to `C:\mpv`

**Add to PATH:**
```powershell
# Add C:\mpv to system PATH
setx PATH "%PATH%;C:\mpv"
```

### Install Python Bindings

```powershell
# Install python-mpv
pip install python-mpv
```

## Player Setup

```bash
# Navigate to player directory
cd player

# Install all dependencies
pip install -r requirements.txt

# Run player
python ccms_player.py
```

## Verify Gapless Playback

**Check logs for:**
```
MPV gapless playback running
Dual-player ping-pong architecture active
SWAP B→A: Now playing slot 2
```

**Monitor transition times** - should see < 100ms gaps.

## Troubleshooting

**Error: "ModuleNotFoundError: No module named 'mpv'"**
- Solution: `pip install python-mpv`

**Error: "Unable to load libmpv"**
- Windows: Ensure mpv.exe is in PATH
- Pi: `sudo apt-get install libmpv-dev`

**High CPU usage on Pi 5:**
- Verify hardware decode: Check logs for `hwdec=auto`
- Run `htop` - should see < 30% CPU
- If high: GPU drivers may need updating
