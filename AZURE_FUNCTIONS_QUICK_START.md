# Azure Functions - Quick Start Guide

## Installation & First Run (5 Minutes)

### 1. Install Azure Functions Core Tools

```powershell
# Using winget (Windows - Recommended)
winget install Microsoft.Azure.FunctionsCoreTools

# Verify
func --version
# Should show: 4.x.x
```

### 2. Update Connection String

Open `backend/CCMS.Functions/local.settings.json` and update:

```json
{
  "IsEncrypted": false,
  "Values": {
    "AzureWebJobsStorage": "UseDevelopmentStorage=true",
    "FUNCTIONS_WORKER_RUNTIME": "dotnet-isolated",
    "ConnectionStrings__DefaultConnection": "Server=(localdb)\\mssqllocaldb;Database=CCMSDb;Trusted_Connection=true;MultipleActiveResultSets=true",
    "BookingStatusUpdate__TimerSchedule": "0 */1 * * * *"
  }
}
```

**Replace the connection string with YOUR database connection string!**

### 3. Test Locally

```powershell
# Navigate to Functions project
cd C:\Users\Sanket\Desktop\Me\Projects\Playground\PixelCCMSCopilot\practice\backend\CCMS.Functions

# Run the function
func start

# Output should show:
# Functions:
#   BookingStatusUpdateFunction: timerTrigger
# 
# Host started
```

The function will run every 5 minutes automatically!

### 4. Monitor Output

Watch for these log messages:
```
[2025-12-13T00:50:00] Booking status update function triggered at: ...
[2025-12-13T00:50:01] Starting booking status update check at ...
[2025-12-13T00:50:01] Found X bookings to check for status updates
[2025-12-13T00:50:02] Booking 123 status updated: Approved → Active
[2025-12-13T00:50:02] Successfully updated X booking(s)
[2025-12-13T00:50:02] Booking status update completed. Updated X booking(s)
```

---

## Cloud Deployment (15 Minutes)

### Option 1: Using VS Code (Easiest)

1. **Install Extension**
   - Open VS Code
   - Extensions → Search "Azure Functions"
   - Install "Azure Functions" by Microsoft

2. **Sign In**
   - Click Azure icon in left sidebar
   - Click "Sign in to Azure"
   - Complete browser authentication

3. **Deploy**
   - Right-click on `CCMS.Functions` folder
   - Select "Deploy to Function App..."
   - Click "Create new Function App in Azure..."
   - Enter name: `ccms-booking-updates`
   - Select .NET 8 Isolated
   - Select region (e.g., East US)
   - Wait for deployment (2-3 minutes)

4. **Configure Connection String**
   - In VS Code Azure panel, find your Function App
   - Right-click → "Add New Setting..."
   - Name: `ConnectionStrings__DefaultConnection`
   - Value: Your Azure SQL connection string
   - Click Save

5. **Verify**
   - Right-click Function App → "Start Streaming Logs"
   - Watch for booking updates every 5 minutes

### Option 2: Using Command Line

```powershell
# 1. Login
az login

# 2. Create Function App
az functionapp create \
  --name ccms-booking-updates \
  --resource-group YOUR_RESOURCE_GROUP \
  --consumption-plan-location eastus \
  --runtime dotnet-isolated \
  --runtime-version 8 \
  --functions-version 4 \
  --storage-account YOUR_STORAGE_ACCOUNT

# 3. Set connection string
az functionapp config appsettings set \
  --name ccms-booking-updates \
  --resource-group YOUR_RESOURCE_GROUP \
  --settings "ConnectionStrings__DefaultConnection=YOUR_CONNECTION_STRING"

# 4. Deploy
cd backend/CCMS.Functions
func azure functionapp publish ccms-booking-updates

# 5. Stream logs
func azure functionapp logstream ccms-booking-updates
```

---

## Switching Between Background Service & Azure Function

### Currently Using: Background Service (In CCMS.Api)

To switch to Azure Function:

1. **Edit** `backend/CCMS.Api/appsettings.json`

```json
{
  "BookingStatusUpdate": {
    "BackgroundService": {
      "Enabled": false,    // ← Change to false
      "IntervalMinutes": 5
    }
  }
}
```

2. **Restart** CCMS.Api application
3. **Deploy** Azure Function (see above)

### Currently Using: Azure Function

To switch back to Background Service:

1. **Edit** `backend/CCMS.Api/appsettings.json`

```json
{
  "BookingStatusUpdate": {
    "BackgroundService": {
      "Enabled": true,     // ← Change to true
      "IntervalMinutes": 5
    }
  }
}
```

2. **Restart** CCMS.Api application
3. **Stop** Azure Function in Azure Portal (to avoid double processing)

---

## Troubleshooting

### Problem: `func: command not found`

**Solution:**
```powershell
# Reinstall Azure Functions Core Tools
winget install Microsoft.Azure.FunctionsCoreTools

# Restart terminal
```

### Problem: "Build failed" when running `func start`

**Solution:**
```powershell
cd backend/CCMS.Functions

# Clean and rebuild
dotnet clean
dotnet restore
dotnet build

# Try again
func start
```

### Problem: "Connection string error"

**Solution:**
Edit `local.settings.json` and ensure:
- Connection string is valid
- Use double backslashes in server name: `Server=(localdb)\\mssqllocaldb`
- Test connection in SQL Server Management Studio first

### Problem: Function not running in Azure

**Solution:**
1. Azure Portal → Your Function App
2. Check "Platform features" → "Configuration"
3. Verify `ConnectionStrings__DefaultConnection` exists
4. Check "Monitor" → "Live Metrics" for errors
5. Ensure Function App is not stopped

---

## Timer Schedule Examples

Edit the timer schedule to change frequency:

| Schedule | Meaning |
|----------|---------|
| `0 */1 * * * *` | Every 1 minute |
| `0 */5 * * * *` | Every 5 minutes (default) |
| `0 */15 * * * *` | Every 15 minutes |
| `0 0 * * * *` | Every hour |
| `0 0 */6 * * *` | Every 6 hours |
| `0 0 0 * * *` | Once per day at midnight |
| `0 0 2 * * *` | Daily at 2:00 AM |

**Change in:**
- **Local**: `local.settings.json` → `BookingStatusUpdate__TimerSchedule`
- **Azure**: Function App → Configuration → Application settings

---

## Cost (Almost Free!)

Azure Functions Consumption Plan pricing:
- **Free tier**: 1 million executions/month
- **This function**: ~8,640 executions/month (every 5 min)
- **Your cost**: $0.00 (well within free tier!)

Even if you go beyond free tier:
- $0.20 per million executions
- ~2 seconds per execution
- **Estimated**: Less than $0.50/month

---

## Next Steps

After deploying:

1. ✅ Monitor logs to verify bookings are updating
2. ✅ Check your database to see Active/Completed statuses
3. ✅ Set up Application Insights for detailed monitoring
4. ✅ Configure alerts if status updates fail

---

## Summary

**Local Testing:**
```powershell
cd backend/CCMS.Functions
func start
```

**Deploy to Azure:**
```powershell
func azure functionapp publish ccms-booking-updates
```

**Monitor:**
```powershell
func azure functionapp logstream ccms-booking-updates
```

That's it! The Azure Function will automatically update booking statuses every 5 minutes, completely independently of your main application.

For detailed information, see: `AZURE_FUNCTIONS_SETUP_GUIDE.md`
