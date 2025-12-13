# Azure Functions - Local Operations Guide

## Quick Status Check

**Is Azure Function Running?**

Check your running terminals:
- Look for a terminal with output showing: `Functions:` and `BookingStatusUpdateFunction: timerTrigger`
- Check for logs every minute showing booking status updates

---

## How to Start Azure Functions Locally

### Method 1: Using PowerShell (Current Method)

```powershell
# Navigate to Functions directory
cd C:\Users\Sanket\Desktop\Me\Projects\Playground\PixelCCMSCopilot\practice\backend\CCMS.Functions

# Refresh PATH to include func command
$env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")

# Start the function
func start
```

### Method 2: Simple Command (After PATH is Set)

```powershell
cd backend\CCMS.Functions
func start
```

### Method 3: Using Visual Studio Code

1. Open the `CCMS.Functions` folder in VS Code
2. Press `F5` or click Run → Start Debugging
3. The Azure Functions host will start automatically

---

## How to Stop Azure Functions

### In PowerShell Terminal:
- Press `Ctrl + C`
- The function will gracefully shut down

### In VS Code:
- Click the red stop button in the debug toolbar
- Or press `Shift + F5`

---

## How to Operate & Monitor

### 1. **View Real-Time Logs**

When the function is running, you'll see logs like:
```
[2025-12-13T03:45:00.123Z] Executing 'BookingStatusUpdateFunction' (Reason='Timer fired at 2025-12-13T03:45:00...')
[2025-12-13T03:45:00.456Z] Booking status update function triggered at: 12/13/2025 9:15:00 AM
[2025-12-13T03:45:00.789Z] Starting booking status update check at 12/13/2025 9:15:00 AM (Local Time)
[2025-12-13T03:45:01.012Z] Found 5 bookings to check for status updates
[2025-12-13T03:45:01.234Z] Booking abc123 status updated: Approved → Active (Campaign: XYZ, Screen: Screen 1)
[2025-12-13T03:45:01.345Z] Successfully updated 1 booking(s)
[2025-12-13T03:45:01.456Z] Executed 'BookingStatusUpdateFunction' (Succeeded, Duration=1234ms)
```

### 2. **Change Update Frequency**

Edit `backend\CCMS.Functions\local.settings.json`:

```json
{
  "BookingStatusUpdate__TimerSchedule": "0 */1 * * * *"  // Every 1 minute (current)
}
```

**Common schedules:**
- Every 30 seconds: `*/30 * * * * *`
- Every 1 minute: `0 */1 * * * *` ← Current
- Every 5 minutes: `0 */5 * * * *`
- Every 15 minutes: `0 */15 * * * *`
- Every hour: `0 0 * * * *`

**After changing, restart the function!**

### 3. **Test Manually (Force Run)**

The function runs automatically, but if you want to see it work immediately:
- Just wait 1 minute (current schedule)
- Or restart the function with `Ctrl+C` then `func start`

### 4. **Check Database for Updates**

Connect to your database and run:
```sql
-- See recent status changes
SELECT Id, CampaignId, ScreenId, Status, StartDate, EndDate, UpdatedAt
FROM Bookings
WHERE UpdatedAt > DATEADD(minute, -5, GETDATE())
ORDER BY UpdatedAt DESC;
```

---

## Current Configuration

**Database:** `PracticePixelCCMSDb` (LocalDB)  
**Schedule:** Every 1 minute  
**Status Transitions:**
- **Approved** → **Active** (when start date arrives and within operating hours)
- **Active** → **Completed** (when end date passes or outside operating hours)

---

## Troubleshooting

### Function Not Starting?

**Issue:** `func: command not found`  
**Fix:**
```powershell
$env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")
func start
```

**Issue:** Build errors  
**Fix:**
```powershell
cd backend\CCMS.Functions
dotnet clean
dotnet build
func start
```

### Function Running But Not Updating?

**Check:**
1. Database connection string is correct in `local.settings.json`
2. Bookings exist with `StartDate` = today and `Status` = Approved
3. Screen operating hours include current time

**Debug:**
```powershell
# Check logs for errors in the terminal where func is running
# Look for database connection errors or exceptions
```

### Want to See More Detailed Logs?

Edit `host.json` in `CCMS.Functions`:
```json
{
  "version": "2.0",
  "logging": {
    "logLevel": {
      "default": "Information",   // Change to "Debug" for more details
      "Host.Results": "Information",
      "Function": "Debug"         // Add this line
    }
  }
}
```

---

## Daily Workflow

### Starting Your Dev Environment:

```powershell
# Terminal 1: Frontend
cd frontend
npm run dev

# Terminal 2: Backend API
cd backend\CCMS.Api
dotnet run

# Terminal 3: Azure Functions
cd backend\CCMS.Functions
$env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")
func start
```

### Stopping Everything:

- Press `Ctrl + C` in each terminal (Frontend, Backend, Functions)

---

## Advanced: Background vs Azure Function

**You have TWO options for booking status updates:**

### Option 1: Background Service (In CCMS.Api)
- Runs inside main API application
- Currently: **DISABLED**
- Enable in: `backend\CCMS.Api\appsettings.json` → `BookingStatusUpdate:BackgroundService:Enabled = true`

### Option 2: Azure Function (Separate Process) ← **CURRENT**
- Runs independently
- Better for production
- Currently: **ENABLED and RUNNING**

**Don't run both at the same time!** They'll both try to update bookings.

---

## Quick Reference Commands

```powershell
# Start Function
cd backend\CCMS.Functions
func start

# Stop Function
Ctrl + C

# Check Function Version
func --version

# Build Function
dotnet build

# Clean and Rebuild
dotnet clean
dotnet build
func start

# View Config
cat local.settings.json
```

---

## Need Help?

- **Full Guide:** `AZURE_FUNCTIONS_SETUP_GUIDE.md`
- **Azure Deployment:** See the setup guide for cloud deployment
- **Troubleshooting:** Check logs in the terminal where `func start` is running

---

**✅ Your Azure Function is running 24/7 updating bookings automatically every minute!**
