# Testing Azure Blob Storage Upload

## ✅ Azurite is Running
Port 10000 is accessible - Azurite blob storage emulator is running correctly.

## 📝 Steps to Test Upload:

### 1. **Stop the current API** (it's running and blocking rebuild)
   - Find the terminal running `dotnet run`
   - Press `Ctrl+C` to stop it

### 2. **Rebuild and Run API**
   ```bash
   cd backend/CCMS.Api
   dotnet run
   ```
   
   **Look for this message** in the console:
   ```
   Using Azure Blob Storage for file uploads
   ```

### 3. **Test Upload via Frontend**
   - Go to http://localhost:5175 (or your frontend URL)
   - Login as an Advertiser
   - Navigate to "Campaigns" → Select a campaign → "Add Creative"
   - Upload a video file
   
### 4. **Verify Upload Success**

   **Check Database:**
   - Look at the `Creatives` table
   - The `FileUrl` column should contain:
     ```
     http://127.0.0.1:10000/devstoreaccount1/creatives/{some-guid}.mp4
     ```
   
   **Check Azurite (using Azure Storage Explorer):**
   - Download: https://azure.microsoft.com/en-us/products/storage/storage-explorer
   - Connect to "Local Storage Emulator"
   - Navigate to: **Blob Containers** → **creatives**
   - You should see your uploaded file with a GUID name

### 5. **Alternative: Test via API Directly**

   Using **Postman** or **curl**:
   
   ```bash
   # Get auth token
   POST http://localhost:5257/api/auth/login
   Body:
   {
     "email": "your-advertiser@email.com",
     "password": "your-password"
   }
   
   # Upload creative
   POST http://localhost:5257/api/creatives/upload
   Headers:
     Authorization: Bearer {token}
   Form Data:
     file: {select your video file}
     campaignId: {your-campaign-guid}
     name: "Test Creative"
     duration: 10
     width: 1920
     height: 1080
   ```

## 🔍 Debugging

### If upload fails, check:

1. **API Console Output**
   - Should show: `Using Azure Blob Storage for file uploads`
   - Look for any error messages during upload

2. **Check Azurite is Running**
   ```bash
   Test-NetConnection -ComputerName 127.0.0.1 -Port 10000
   ```
   Should return `True`

3. **Check Connection String**
   In `appsettings.json`, verify:
   ```json
   "AzureBlobStorage": {
     "ConnectionString": "AccountName=devstoreaccount1;AccountKey=Eby8vdM02xNOcqFlqUwJPLlmEtlCDXJ1OUzFT50uSRZ6IFsuFq2UVErCz4I6tq/K1SZFPTOtr/KBHBeksoGMGw==;DefaultEndpointsProtocol=http;BlobEndpoint=http://127.0.0.1:10000/devstoreaccount1;..."
   }
   ```

4. **Check API Logs**
   Look for exceptions in the console when uploading

## 📊 Expected Behavior

**Before (Local File System):**
```
File saved to: C:\...\backend\CCMS.Api\uploads\{guid}.mp4
FileUrl: http://localhost:5257/uploads/{guid}.mp4
```

**After (Azure Blob Storage):**
```
File uploaded to blob: creatives/{guid}.mp4
FileUrl: http://127.0.0.1:10000/devstoreaccount1/creatives/{guid}.mp4
```

## 🎯 Quick Validation

Run this PowerShell command to check if Azurite has the creatives container:

```powershell
Invoke-WebRequest -Uri "http://127.0.0.1:10000/devstoreaccount1/creatives?restype=container" -Method GET
```

If it returns 200 OK, the container exists and is ready!

---

## ⚠️ Common Issues

### Issue: "Container not found"
**Solution:** The container is auto-created on first upload. Just try uploading once.

### Issue: "403 Forbidden"
**Solution:** Check the connection string and account key match Azurite's defaults.

### Issue: "File not showing in Azurite"
**Solution:** Make sure API is using Azure provider:
- Check console shows: `Using Azure Blob Storage for file uploads`
- Verify `appsettings.json` has `"Provider": "AzureBlob"`

