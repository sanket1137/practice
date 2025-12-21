# Final Testing Steps for Screen 13 Player

## What Was Fixed:
1. ✅ Backend now uses IST timezone (UTC+5:30) for playlist generation
2. ✅ Player retries every 5 seconds instead of 60
3. ✅ Removed Unicode characters causing Windows encoding errors
4. ✅ Updated PlaylistGeneratorService to handle multiple JSON date formats:
   - "2025-12-19" (standard)
   - "2025-12-19T00:00:00" (with timestamp)
5. ✅ Updated to handle both `Dictionary<string, int>` and `Dictionary<string, List<int>>`

## Current Status:
- Backend: Starting via start-all.ps1
- Frontend: Starting via start-all.ps1
- Database: Updated with correct booking dates

## Test Steps:
1. Wait 10 seconds for backend to fully start
2. Run player: `cd player; python ccms_player.py`
3. Expected output:
   ```
   [OK] Handshake successful!
   [OK] Playlist received: 6 items
   Playing slot 1 (10s)
   Playing slot 2 (10s)
   ...
   ```

## If Still Shows 0 Items:
Check backend terminal for log: "Generating playlist for IST date: 2025-12-19"
- If missing: Backend didn't restart properly
- If present: Check the DailySlotAssignmentsJson format in database

## Booking Data Expected:
- Screen ID: be6830be-1e29-4f9b-957d-5c3af3e19895
- 6 bookings with Status=4 (Active)
- SlotNumbers: [1], [2], [3], [4], [5], [6]
- Dates: 2025-12-19 to 2025-12-27
