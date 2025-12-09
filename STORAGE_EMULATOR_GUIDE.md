# 🔷 Azure Storage Emulator - Complete Setup Guide

## ✅ Emulator is Running!

Your Azure Storage Emulator is now running. Here's everything you need to know:

---

## 📊 Connection Details

### Default Endpoints:
- **Blob Service**: `http://127.0.0.1:10000/devstoreaccount1`
- **Queue Service**: `http://127.0.0.1:10001/devstoreaccount1`
- **Table Service**: `http://127.0.0.1:10002/devstoreaccount1`

### Connection String:
```
UseDevelopmentStorage=true
```

Or full connection string:
```
DefaultEndpointsProtocol=http;AccountName=devstoreaccount1;AccountKey=Eby8vdM02xNOcqFlqUwJPLlmEtlCDXJ1OUzFT50uSRZ6IFsuFq2UVErCz4I6tq/K1SZFPTOtr/KBHBeksoGMGw==;BlobEndpoint=http://127.0.0.1:10000/devstoreaccount1;
```

---

## 🎯 How to Explore with Azure Storage Explorer

### Step 1: Download Storage Explorer (if not installed)
- **URL**: https://azure.microsoft.com/en-us/products/storage/storage-explorer/
- Download and install

### Step 2: Connect to Local Emulator

1. **Open Azure Storage Explorer**

2. **Click the "Connect" icon** (plug icon on left sidebar)

3. **Select Connection Method**:
   - Choose: **"Local storage emulator"**
   - Or: **"Storage account or service"** → **"Connection string"**

4. **Enter Details**:
   - **Display name**: `Local Emulator`
   - **Connection string**: `UseDevelopmentStorage=true`
   - Click **Next** → **Connect**

5. **Find Your Storage**:
   ```
   📁 Local & Attached
   └── 📁 Storage Accounts
       └── 📁 (Emulator - Default Ports)(Key)
           └── 📁 Blob Containers
               └── 📁 creatives  ← Your uploaded files are here!
   ```

### Step 3: View Uploaded Creatives

Once connected, navigate to:
```
Storage Accounts 
  → (Emulator - Default Ports)
    → Blob Containers
      → creatives
```

You'll see all uploaded files listed with:
- **Name**: `{guid}_{originalfilename}.jpg`
- **Size**: File size in bytes
- **Type**: Content type (image/jpeg, video/mp4, etc.)
- **Last Modified**: Upload timestamp

---

## 🔧 Emulator Control Commands

### Start Emulator:
```powershell
& "C:\Program Files (x86)\Microsoft SDKs\Azure\Storage Emulator\AzureStorageEmulator.exe" start
```

### Stop Emulator:
```powershell
& "C:\Program Files (x86)\Microsoft SDKs\Azure\Storage Emulator\AzureStorageEmulator.exe" stop
```

### Check Status:
```powershell
& "C:\Program Files (x86)\Microsoft SDKs\Azure\Storage Emulator\AzureStorageEmulator.exe" status
```

### Clear All Data:
```powershell
& "C:\Program Files (x86)\Microsoft SDKs\Azure\Storage Emulator\AzureStorageEmulator.exe" clear all
```

---

## 📝 Quick Start Script

I've created `start-storage-emulator.ps1` for you:

```powershell
.\start-storage-emulator.ps1
```

---

## 🧪 Test Creative Upload

### Via Swagger UI:

1. **Start Backend** (if not running):
```powershell
dotnet run --project backend\CCMS.Api
```

2. **Open Swagger**: `http://localhost:5257/swagger`

3. **Authorize**:
   - Click **Authorize** button
   - Enter your Bearer token
   - Click **Authorize**

4. **Upload Creative**:
   - Find: `POST /api/creatives/upload`
   - Click **Try it out**
   - Fill in:
     - `file`: Click **Choose File** → Select image/video
     - `campaignId`: Your campaign GUID (get from GET /api/campaigns)
     - `name`: "Test Creative"
     - `duration`: 10
   - Click **Execute**

5. **Check Storage Explorer**:
   - Refresh the `creatives` container
   - You should see your file: `{guid}_yourfile.jpg`

### Via Postman:

**POST** `http://localhost:5257/api/creatives/upload`

**Headers**:
```
Authorization: Bearer YOUR_ACCESS_TOKEN
```

**Body** (form-data):
```
file: [Select File]
campaignId: your-campaign-guid
name: Test Creative
duration: 10
```

---

## 🗄️ Data Storage Locations

### Blob Storage:
- **Location**: `C:\Users\{YourUsername}\AppData\Local\AzureStorageEmulator\`
- **Database**: Uses LocalDB for metadata

### Creative Metadata (SQL Server):
Your SQL Server database stores:
- Creative ID, Name, FileUrl
- CampaignId (relationship)
- FileSize, MimeType, FileHash
- Width, Height, Duration
- Timestamps

**Check Database**:
```sql
USE PracticePixelCCMSDb;
SELECT * FROM Creatives ORDER BY CreatedAt DESC;
```

---

## 🔍 Container Name

Your creatives are stored in a container named:
```
creatives
```

This container is automatically created on first upload.

---

## 📊 Storage Explorer Screenshot Guide

When you open Storage Explorer, you'll see:

```
┌─ Azure Storage Explorer ────────────────────────────────┐
│                                                          │
│ 📁 Local & Attached                                     │
│   └─ 📁 Storage Accounts                                │
│       └─ 📁 (Emulator - Default Ports)(Key)             │
│           ├─ 📁 Blob Containers                         │
│           │   └─ 📁 creatives  ← YOUR FILES HERE!       │
│           ├─ 📁 Queues                                  │
│           └─ 📁 Tables                                  │
│                                                          │
│ [Right panel shows files in selected container]         │
│ Name                          Size      Type             │
│ ─────────────────────────────────────────────────────   │
│ abc123_image.jpg             245 KB    image/jpeg       │
│ def456_video.mp4             12.3 MB   video/mp4        │
└──────────────────────────────────────────────────────────┘
```

---

## ✅ Verification Checklist

- [ ] Emulator is running (check with `status` command)
- [ ] Backend is running (`dotnet run --project backend\CCMS.Api`)
- [ ] Azure Storage Explorer is installed and connected
- [ ] Can see "creatives" container in Storage Explorer
- [ ] Test upload works via Swagger
- [ ] File appears in Storage Explorer
- [ ] Database has Creative record

---

## 🎯 Next Steps

1. **Open Azure Storage Explorer**
2. **Connect using**: `UseDevelopmentStorage=true`
3. **Navigate to**: `Blob Containers` → `creatives`
4. **Upload a test file** via Swagger
5. **Refresh Storage Explorer** to see the file!

---

## 🆘 Troubleshooting

### Emulator Won't Start:
```powershell
# Clear and reinitialize
& "C:\Program Files (x86)\Microsoft SDKs\Azure\Storage Emulator\AzureStorageEmulator.exe" clear all
& "C:\Program Files (x86)\Microsoft SDKs\Azure\Storage Emulator\AzureStorageEmulator.exe" init
& "C:\Program Files (x86)\Microsoft SDKs\Azure\Storage Emulator\AzureStorageEmulator.exe" start
```

### Can't See Container in Storage Explorer:
- Make sure emulator is running
- Refresh the connection
- Upload a file first (container is created on first upload)

### Upload Fails:
- Check emulator is running
- Verify backend is running
- Check you're authenticated
- Verify campaign exists and you own it

---

## 🎉 You're All Set!

Your Azure Storage Emulator is configured and ready to store creative files!

**Container Name**: `creatives`
**Connection String**: `UseDevelopmentStorage=true`

Happy uploading! 🚀
