# IMMEDIATE SOLUTION - Update Booking Status NOW

## The Azure Function Issue

The Azure Function is NOT executing properly. It's running but not triggering the timer function. This is likely due to the .NET SDK 10 issue we encountered earlier.

## ✅ IMMEDIATE FIX - Use the New API Endpoint

I've created a **manual trigger endpoint** that you can call anytime to update booking statuses.

### Step 1: Login to Get Token

**Via Swagger:** http://localhost:5257/swagger

1. POST /api/auth/login
2. Use:
```json
{
  "email": "sanketdhole109@gmail.com",
  "password": "$@Nket1703"
}
```
3. Copy the `accessToken`

### Step 2: Call the Update Endpoint

**Via Swagger:**

1. Click "Authorize" button (top right)
2. Paste your token: `Bearer YOUR_TOKEN_HERE`
3. Find: `POST /api/BookingStatus/update-all`
4. Click "Try it out" → "Execute"

**You'll see:**
```json
{
  "success": true,
  "message": "Successfully updated X booking(s)",
  "data": {
    "updatedCount": 1,
    "timestamp": "2025-12-13T10:15:00"
  }
}
```

### Step 3: Verify

Refresh your bookings page - the booking should now show status "Active"!

---

## Alternative: Direct SQL Update

If the API doesn't work, update directly in database:

```sql
USE PracticePixelCCMSDb;

-- Check current status
SELECT Id, Status, StartDate, EndDate, UpdatedAt, IsDeleted
FROM Bookings
WHERE Id = 'BC7D86F5-3240-4BF1-A4D2-4D2B9FC1D122';

-- Update to Active (4)
UPDATE Bookings 
SET Status = 4, 
    UpdatedAt = GETDATE()
WHERE Id = 'BC7D86F5-3240-4BF1-A4D2-4D2B9FC1D122';

-- Verify
SELECT Id, Status, UpdatedAt
FROM Bookings
WHERE Id = 'BC7D86F5-3240-4BF1-A4D2-4D2B9FC1D122';
-- Should show Status = 4
```

---

## Why Azure Function Isn't Working

**Root Cause:** .NET SDK 10.x is causing runtime issues with Azure Functions Core Tools

**Evidence:**
- Function starts but doesn't execute timer trigger
- No logs showing "Starting booking status update check..."
- Same SDK issue we encountered earlier with the backend

**Temporary Workaround:**
Use the **manual API endpoint** (`POST /api/BookingStatus/update-all`) whenever you need to update statuses.

**Permanent Fix (Later):**
1. Uninstall .NET SDK 10.x
2. Keep only .NET SDK 8.x
3. Restart Azure Function

---

## Going Forward

**Option 1: Manual Triggers**
- Call `POST /api/BookingStatus/update-all` whenever needed
- Can be automated with a scheduler or cron job

**Option 2: Enable Background Service**
Edit `backend/CCMS.Api/appsettings.json`:
```json
{
  "BookingStatusUpdate": {
    "BackgroundService": {
      "Enabled": true,  // ← Change to true
      "IntervalMinutes": 5
    }
  }
}
```
Then restart the backend API.

**Option 3: Fix Azure Function (Requires SDK cleanup)**
- Uninstall .NET 10.x SDK
- Keep only .NET 8.x
- Restart computer
- Try `func start` again

---

## Current Status

✅ **Backend API:** Running with new manual endpoint  
❌ **Azure Function:** Not executing (SDK issue)  
✅ **Manual Update:** Available via API  
✅ **Booking:** Ready to be updated  

**Use the manual endpoint NOW to fix your booking status!**
