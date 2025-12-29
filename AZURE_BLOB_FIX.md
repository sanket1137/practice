# Azure Blob Storage Migration - Final Fix

## ❌ Problem Identified

The API is using **LocalFileStorageService** instead of **AzureBlobStorageService** even though the configuration is set correctly. This is because:

1. **The API process keeps running** between rebuilds, locking DLL files
2. **Old code is being used** from previous runs

## ✅ Solution: Clean Restart Process

### Step 1: Kill All Running Processes
```powershell
# Kill all CCMS.Api and related dotnet processes
Get-Process | Where-Object {$_.ProcessName -eq "CCMS.Api"} | Stop-Process -Force
Get-Process | Where-Object {$_.ProcessName -eq "dotnet" -and $_.Path -like "*PixelCCMSCopilot*"} | Stop-Process -Force
```

### Step 2: Clean Build
```powershell
cd backend/CCMS.Api
dotnet clean
dotnet build
```

### Step 3: Verify Configuration
Check `backend/CCMS.Api/appsettings.json`:
```json
{
  "FileStorage": {
    "Provider": "AzureBlob"  // ← MUST be "AzureBlob"
  },
  "AzureBlobStorage": {
    "ConnectionString": "AccountName=devstoreaccount1;AccountKey=Eby8vdM02xNOcqFlqUwJPLlmEtlCDXJ1OUzFT50uSRZ6IFsuFq2UVErCz4I6tq/K1SZFPTOtr/KBHBeksoGMGw==;DefaultEndpointsProtocol=http;BlobEndpoint=http://127.0.0.1:10000/devstoreaccount1;QueueEndpoint=http://127.0.0.1:10001/devstoreaccount1;TableEndpoint=http://127.0.0.1:10002/devstoreaccount1;",
    "ContainerName": "creatives"
  }
}
```

### Step 4: Start Azurite (if not running)
```powershell
azurite
```
Leave this terminal open.

### Step 5: Run API
```powershell
cd backend/CCMS.Api
dotnet run
```

### Step 6: Look for Debug Messages
**IMPORTANT:** Watch the console for these messages:
```
Using Azure Blob Storage for file uploads
[AzureBlobStorage] Initializing Azure Blob Storage Service...
[AzureBlobStorage] Container: creatives
[AzureBlobStorage] Container 'creatives' ready
```

If you see these → ✅ Azure Blob is active!
If you DON'T see these → ❌ Still using local storage

### Step 7: Test Upload
1. Upload a creative via the frontend
2. Watch console for:
   ```
   [AzureBlobStorage] Uploading file: ...
   [AzureBlobStorage] Upload SUCCESS! URL: http://127.0.0.1:10000/...
   ```

3. Check database:
   ```sql
   SELECT TOP 1 FileUrl FROM Creatives ORDER BY CreatedAt DESC
   ```
   Should be: `http://127.0.0.1:10000/devstoreaccount1/creatives/{guid}.mp4`

---

## 🎯 Quick Commands (Copy-Paste)

**Option A: PowerShell (Recommended)**
```powershell
# Open 3 terminals:

# Terminal 1: Azurite
azurite

# Terminal 2: Backend
cd backend/CCMS.Api
Get-Process -Name "CCMS.Api" -ErrorAction SilentlyContinue | Stop-Process -Force
dotnet clean
dotnet run

# Terminal 3: Frontend  
cd frontend
npm run dev
```

**Option B: Use VS Code Tasks**
Press `Ctrl+Shift+P` → "Run Task" → "Start All Services"

---

## 🐛 Troubleshooting

### Issue: "File is locked by another process"
**Solution:**
```powershell
# Find and kill the process
Get-Process -Name "CCMS.Api" | Stop-Process -Force

# Or restart your computer (nuclear option)
```

### Issue: Still saving to local storage
**Check:**
1. ✅ Is Azurite running? (`Test-NetConnection 127.0.0.1 -Port 10000`)
2. ✅ Did you see "[AzureBlobStorage]" in console?
3. ✅ Is `appsettings.json` correct?
4. ✅ Did you do a clean build?

### Issue: "Container not found" in Azurite
**Solution:** The container is auto-created on first upload. Ignore this warning.

---

## 📊 Expected vs Actual

### Expected Flow (Azure Blob):
```
Upload → AzureBlobStorageService → Azurite
         ↓
FileUrl: http://127.0.0.1:10000/devstoreaccount1/creatives/{guid}.mp4
```

### Current Flow (Local):
```
Upload → LocalFileStorageService → backend/CCMS.Api/uploads/
         ↓
FileUrl: http://localhost:5257/uploads/{guid}.mp4
```

---

## ✅ Success Checklist

- [ ] Azurite is running
- [ ] All old API processes killed
- [ ] Clean build completed
- [ ] Console shows "Using Azure Blob Storage for file uploads"
- [ ] Console shows "[AzureBlobStorage] Initializing..."
- [ ] Upload test shows "[AzureBlobStorage] Upload SUCCESS!"
- [ ] Database FileUrl starts with `http://127.0.0.1:10000/`
- [ ] File visible in Azurite (Azure Storage Explorer)

---

## 🚨 If Still Not Working

Run this diagnostic:
```powershell
# Check config
Get-Content backend/CCMS.Api/appsettings.json | Select-String "Provider"

# Check running processes
Get-Process -Name "CCMS.Api","azurite"

# Check Azurite
Test-NetConnection 127.0.0.1 -Port 10000

# Check latest upload
sqlcmd -S "(localdb)\mssqllocaldb" -d "PracticePixelCCMSDb" -Q "SELECT TOP 1 FileUrl FROM Creatives ORDER BY CreatedAt DESC"
```

Send me the output and I'll diagnose further.

