# Quick Testing Guide - Streaming Improvements

## 🧪 Test 1: Max Viewers Enforcement

### Scenario
Verify that only 5 viewers can connect simultaneously to a stream.

### Steps
1. **Start backend** (if not running):
   ```bash
   cd backend/CCMS.Api
   dotnet run
   ```

2. **Start player** for a screen (e.g., Screen D8DA2F02-E461-4B4B-AC72-5F0B359767F5)

3. **Open 5 browser tabs** and navigate to the screen detail page → Live Activity tab

4. **Click "Start Stream"** in each tab
   - Expected: All 5 connect successfully
   - Status shows: "LIVE" with green indicator

5. **Open 6th browser tab** and try to connect
   - Expected: Error message "Stream is at capacity (5 viewers)"
   - Status shows: "ERROR"

6. **Close one browser tab** (disconnect a viewer)

7. **Try connecting 6th tab again**
   - Expected: Now succeeds (slot available)

### Expected Logs
```
[INFO] Stream at capacity for screen d8da2f02-e461-4b4b-ac72-5f0b359767f5: 5/5 viewers
[INFO] Viewer disconnected from screen...
[INFO] Notified SignalR player of viewer disconnect
```

---

## 🧪 Test 2: Stream Expiry (Auto-Cleanup)

### Scenario
Verify that streams automatically expire after 5 minutes of inactivity.

### Steps
1. **Start player** and register stream

2. **Verify stream is active**:
   - Open screen detail → Live Activity
   - Status should show ready to connect

3. **Kill player process** (don't stop gracefully):
   - On Windows: Task Manager → End Process
   - Or: Close player terminal/window abruptly

4. **Wait 5+ minutes** (grab coffee ☕)

5. **Check stream status**:
   - Try to connect from browser
   - Expected: Error "Waiting for player to start streaming..."

6. **Check backend logs**:
   ```
   [INFO] StreamExpiryService started. Check interval: 2 min, Timeout: 5 min
   [WARN] Found 1 expired streams (inactive for 5+ minutes)
   [INFO] Expiring stale stream for screen d8da2f02-e461-4b4b-ac72-5f0b359767f5
   [INFO] Successfully expired stream
   ```

7. **Restart player**:
   - Expected: Re-registration succeeds (no "already registered" error)

### Why This Matters
Without expiry, crashed players leave "zombie" streams that block re-registration forever!

---

## 🧪 Test 3: Improved Error Messages

### Scenario
Verify that users see helpful error messages when streams aren't available.

### Steps
1. **Make sure player is NOT running**

2. **Navigate to screen detail → Live Activity tab**

3. **Click "Start Stream"**

### Expected Results

**OLD Message** (before fix):
```
❌ Stream is not currently active
```

**NEW Message** (after fix):
```
⚠️ Waiting for player to start streaming... 
Make sure the screen player is running and connected.
```

### Why This Matters
The new message guides users to the solution instead of just stating the problem!

---

## 🧪 Test 4: HTTP Player Disconnect Handling

### Scenario
Verify that HTTP-polling players (Python) don't cause errors when viewers disconnect.

### Setup
This test requires the Python player using HTTP polling (not SignalR).

### Steps
1. **Start Python player** (uses HTTP polling)
   ```bash
   cd player
   python ccms_player.py
   ```

2. **Connect a viewer** from browser

3. **Close the browser tab** (disconnect viewer)

4. **Check backend logs**:
   ```
   [INFO] Viewer xxx disconnected from screen yyy (HTTP player - will detect on next poll)
   ```
   - Should NOT see any SignalR errors
   - No "connection not found" errors

### Before Fix
```
❌ ERROR: Failed to send to player connection 'http-player': Connection not found
```

### After Fix
```
✅ INFO: HTTP player - will detect on next poll
✅ No errors
```

---

## 📊 Quick Verification Commands

### Check if StreamExpiryService is Running
```powershell
# Look for startup log
Get-Content backend/CCMS.Api/logs/app.log | Select-String "StreamExpiryService started"
```

### Check Active Streams (SQL)
```sql
-- Streams should not persist after player stops
SELECT * FROM Screens WHERE IsOnline = 1;
```

### Manually Trigger Stream Expiry
```csharp
// In development, you can reduce timeout for faster testing
"StreamingSettings": {
  "StreamTimeoutMinutes": 1,     // Test expiry after 1 minute
  "ExpiryCheckIntervalMinutes": 1 // Check every minute
}
```

---

## 🎯 Success Criteria

### All Tests Pass If:
- ✅ 6th viewer sees "at capacity" error
- ✅ Stale streams disappear after 5 minutes
- ✅ Error messages are helpful and actionable
- ✅ HTTP players don't cause errors
- ✅ Players can re-register after expiry
- ✅ StreamExpiryService logs appear in backend

---

## 🐛 Troubleshooting

### StreamExpiryService Not Starting
**Symptom**: No "StreamExpiryService started" log

**Check**:
```bash
# Verify service is registered in Program.cs
grep -n "StreamExpiryService" backend/CCMS.Api/Program.cs
```

**Fix**: Should see line 175-176 with `AddHostedService<StreamExpiryService>()`

### Max Viewers Not Working
**Symptom**: More than 5 viewers can connect

**Check**: Verify the fix is in `StreamingHub.cs` line 199-214

**Debug**:
```bash
# Check logs for viewer count checks
# Should see: "Stream at capacity for screen..."
```

### Migration Not Applied
**Symptom**: Error about missing MaxViewers column

**Fix**:
```bash
cd backend
dotnet ef database update --project CCMS.Infrastructure --startup-project CCMS.Api
```

---

## 📝 Notes

- All tests assume default configuration (5 max viewers, 5 min timeout)
- Timestamps in logs are in UTC
- Stream IDs are case-insensitive after the fix
- HTTP players use polling, so disconnect detection is delayed (next poll cycle)

Happy Testing! 🚀
