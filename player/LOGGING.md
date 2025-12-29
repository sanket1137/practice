# Player Logging System

## ✅ Log Files

The player automatically creates log files in the `player/logs/` directory:

### Log File Types:

1. **Player Log** (`player_YYYYMMDD_HHMMSS.log`)
   - Main application logs
   - System events, errors, warnings
   - WebRTC streaming status
   - Download progress
   - File format: `player_20251229_143045.log`

2. **Playback Log** (`playlog_YYYYMMDD_HHMMSS.log`)
   - Detailed impression tracking
   - Video start/end events
   - Slot playback information
   - Used for analytics and debugging
   - File format: `playlog_20251229_143045.log`

---

## 🗑️ Automatic Cleanup

**Log files older than 7 days are automatically deleted on player startup.**

### Configuration:

Edit `player/config.json`:
```json
"logging": {
    "log_retention_days": 7,
    "comment": "Automatically delete log files older than this many days on player startup"
}
```

### Change Retention Period:

- **3 days:** `"log_retention_days": 3`
- **14 days:** `"log_retention_days": 14`
- **30 days:** `"log_retention_days": 30`
- **No cleanup:** Set to a very large number like `365`

---

## 📊 Log File Locations

```
player/
├── logs/
│   ├── player_20251222_143045.log    (8 days old - will be deleted)
│   ├── player_20251229_091523.log    (1 hour old - kept)
│   ├── playlog_20251222_143045.log   (8 days old - will be deleted)
│   └── playlog_20251229_091523.log   (1 hour old - kept)
```

---

## 🔄 Cleanup Behavior

### On Player Startup:

1. **Scan logs directory** for all `.log` files
2. **Check file age** (modification time)
3. **Delete files** older than configured retention days
4. **Log cleanup results** to console and current log file

### Example Output:

```
[LOG CLEANUP] Scanning for log files older than 7 days...
[LOG CLEANUP] Cutoff date: 2025-12-22 14:30:00
[LOG CLEANUP] Found 10 log files
[LOG CLEANUP] ✓ Deleted: player_20251220_143045.log (age: 9 days, size: 1,234,567 bytes)
[LOG CLEANUP] ✓ Deleted: playlog_20251220_143045.log (age: 9 days, size: 234,567 bytes)
[LOG CLEANUP] Cleanup complete: 4 files deleted, 2,345,678 bytes freed
```

---

## 📝 Log Format

### Timestamp Format:
All logs use **IST (Indian Standard Time)** timezone:
```
2025-12-29 14:30:45,501 IST - INFO - Player started
```

### Log Levels:
- **INFO:** Normal operations (startup, downloads, playback)
- **WARNING:** Recoverable issues (cache misses, retries)
- **ERROR:** Serious problems (network failures, file errors)
- **DEBUG:** Detailed debugging information (disabled by default)

---

## 🛠️ Manual Cleanup

### Test Log Cleanup:
```bash
cd player
python log_cleanup.py
```

### Cleanup with Custom Retention:
```bash
python log_cleanup.py 3    # Delete logs older than 3 days
python log_cleanup.py 30   # Delete logs older than 30 days
```

### View Log Statistics:
```python
from log_cleanup import LogCleanup
from pathlib import Path

cleanup = LogCleanup(Path("logs"), max_age_days=7)
stats = cleanup.get_log_stats()

print(f"Total logs: {stats['count']}")
print(f"Total size: {stats['total_size']:,} bytes")
print(f"Oldest log: {stats['oldest']}")
print(f"Newest log: {stats['newest']}")
```

---

## 📂 Log File Contents

### Player Log Example:
```
2025-12-29 14:30:45,501 IST - INFO - === CCMS Player Started ===
2025-12-29 14:30:46,123 IST - INFO - Screen ID: c7054654-db14-4178-b5b7-389ad6ba378f
2025-12-29 14:30:46,456 IST - INFO - [OK] Handshake successful!
2025-12-29 14:30:46,789 IST - INFO - [OK] Playlist received: 6 items
2025-12-29 14:30:47,012 IST - INFO - [LOG CLEANUP] Scanning for log files older than 7 days...
2025-12-29 14:30:47,234 IST - INFO - [LOG CLEANUP] Cleanup complete: 2 files deleted
2025-12-29 14:30:48,567 IST - INFO - Downloading 6 videos to cache...
2025-12-29 14:30:50,890 IST - INFO - [OK] Slot 1 downloaded (8608815 bytes)
2025-12-29 14:31:01,234 IST - INFO - [WebRTC] Streaming started
```

### Playback Log Example:
```
2025-12-29 14:31:15,123 IST - INFO - [PLAY] Slot 1 | Creative: abc123 | Started
2025-12-29 14:31:25,456 IST - INFO - [PLAY] Slot 1 | Creative: abc123 | Ended (duration: 10s)
2025-12-29 14:31:25,789 IST - INFO - [PLAY] Slot 2 | Creative: def456 | Started
2025-12-29 14:31:40,012 IST - INFO - [PLAY] Slot 2 | Creative: def456 | Ended (duration: 15s)
```

---

## ⚠️ Important Notes

1. **Logs are created on each player restart**
   - Each startup = new log file pair (player + playlog)
   - Old files are cleaned up automatically

2. **Cleanup runs only on startup**
   - Not continuous background process
   - Restart player to trigger cleanup

3. **Current session logs are never deleted**
   - Only old (>7 days) logs are removed
   - Current log file is always kept

4. **File locking**
   - If old log is locked/in-use, it's skipped
   - Cleanup will retry on next startup

5. **Disk space**
   - Each log file ≈ 100KB - 5MB (depends on runtime)
   - 7 days ≈ 10-50MB total
   - 30 days ≈ 50-200MB total

---

## 🔍 Troubleshooting

### Issue: Logs not being cleaned up

**Check:**
1. Verify `logging` section exists in `config.json`
2. Check console output for cleanup messages
3. Ensure `logs/` directory is writable
4. No file locking (close text editors viewing old logs)

### Issue: Log cleanup fails

**Console will show:**
```
WARNING - Log cleanup failed: [error message]
```

**Common causes:**
- File permission errors
- Disk full
- Log files opened in editor

### Issue: Want to keep all logs

**Solution:**
```json
"logging": {
    "log_retention_days": 9999
}
```

---

## 📊 Monitoring

### Check Current Logs:
```bash
# Windows
dir player\logs\

# Linux/Mac
ls -lh player/logs/
```

### View Recent Logs:
```bash
# Windows PowerShell
Get-Content player\logs\player_*.log -Tail 50

# Linux/Mac
tail -f player/logs/player_*.log
```

### Find Old Logs:
```bash
# Windows PowerShell
Get-ChildItem player\logs\*.log | Where-Object {$_.LastWriteTime -lt (Get-Date).AddDays(-7)}

# Linux/Mac
find player/logs -name "*.log" -mtime +7
```

---

## ✅ Summary

**Log Management:**
- ✅ All logs saved to `player/logs/` directory
- ✅ Two types: Player logs + Playback logs
- ✅ Automatic cleanup of old files (7 days default)
- ✅ IST timestamps for easy debugging
- ✅ Configurable retention period
- ✅ Manual cleanup utility available

**Best Practices:**
- Keep default 7 days for production
- Increase to 14-30 days if debugging complex issues
- Monitor disk space if running for months
- Archive important logs before cleanup if needed

**Storage Example:**
- 1 day = ~2-10 MB
- 7 days = ~10-50 MB
- 30 days = ~50-200 MB
