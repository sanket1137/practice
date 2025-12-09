# Azure Blob Storage Setup with Azurite

## ✅ What Was Implemented

- **BlobStorageService** - Handles file uploads, downloads, and deletions
- **UploadCreativeCommand** - MediatR command for creative uploads  
- **CreativesController** - API endpoint for uploading creatives
- **Azure Storage Integration** - Configured with Azurite emulator

---

## 🚀 Setup Azurite (Azure Storage Emulator)

### Option 1: Using NPM (Recommended)

1. **Install Azurite globally**:
```bash
npm install -g azurite
```

2. **Start Azurite**:
```bash
azurite --silent --location c:\azurite --debug c:\azurite\debug.log
```

Or start with specific services:
```bash
azurite-blob --blobPort 10000 --blobHost 127.0.0.1
```

### Option 2: Using Docker

```bash
docker run -p 10000:10000 -p 10001:10001 -p 10002:10002 mcr.microsoft.com/azure-storage/azurite
```

### Option 3: Using Visual Studio/VS Code Extension

- Install "Azurite" extension in VS Code
- Press `Ctrl+Shift+P` → "Azurite: Start"

---

## 📊 View Stored Data

### Using Azure Storage Explorer (Recommended)

1. **Download and Install**:
   - Download from: https://azure.microsoft.com/en-us/products/storage/storage-explorer/
   - Install and open

2. **Connect to Azurite**:
   - Click **"Connect to Azure Storage"** (plug icon)
   - Select **"Attach to a local emulator"**
   - Connection string: `UseDevelopmentStorage=true`
   - Display name: `Local Azurite`
   - Click **Connect**

3. **Navigate to Creatives**:
   - Expand: **Local & Attached** → **Emulator - Default Ports** → **Blob Containers**
   - You should see a `creatives` container
   - Click on it to view uploaded files

### Using Azure CLI

```bash
# Install Azure CLI
# Then use:
az storage blob list --account-name devstoreaccount1 --container-name creatives --connection-string "UseDevelopmentStorage=true"
```

### Using PowerShell

```powershell
# Install Az PowerShell module
Install-Module -Name Az.Storage -AllowClobber

# List blobs
$ctx = New-AzStorageContext -ConnectionString "UseDevelopmentStorage=true"
Get-AzStorageBlob -Container "creatives" -Context $ctx
```

---

## 🔧 Configuration

### appsettings.json
```json
{
  "AzureStorage": {
    "ConnectionString": "UseDevelopmentStorage=true"
  }
}
```

**For Production**:
```json
{
  "AzureStorage": {
    "ConnectionString": "DefaultEndpointsProtocol=https;AccountName=your-account;AccountKey=your-key;EndpointSuffix=core.windows.net"
  }
}
```

---

## 📝 Testing Upload

### Using Postman/Insomnia

**POST** `http://localhost:5257/api/creatives/upload`

**Headers**:
- Authorization: `Bearer {your-token}`

**Body** (form-data):
- `file`: (File) - Select your image/video
- `campaignId`: (Text) - Your campaign GUID
- `name`: (Text) - Creative name
- `duration`: (Text) - Duration in seconds (default: 10)

### Using cURL

```bash
curl -X POST http://localhost:5257/api/creatives/upload \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "file=@path/to/file.jpg" \
  -F "campaignId=YOUR-CAMPAIGN-ID" \
  -F "name=My Creative" \
  -F "duration=15"
```

---

## 📂 Storage Structure

```
Azurite Storage
└── Blob Containers
    └── creatives
        ├── {guid}_file1.jpg
        ├── {guid}_file2.mp4
        └── {guid}_file3.png
```

Each file is prefixed with a GUID to ensure uniqueness.

---

## 🗄️ Database Structure

**Creatives Table** (SQL Server):
- `Id` - Creative GUID
- `CampaignId` - Foreign key to Campaign
- `Name` - Creative name
- `FileUrl` - Full blob URL
- `FileName` - Original file name
- `MimeType` - Content type (image/jpeg, video/mp4, etc.)
- `FileSize` - Size in bytes
- `FileHash` - SHA256 hash for integrity
- `Width`, `Height` - Dimensions
- `Duration` - Duration in seconds
- `ThumbnailUrl` - Optional thumbnail
- `CreatedAt`, `UpdatedAt`, `IsDeleted`

---

## ✅ Verification Steps

1. **Start Azurite**:
```bash
azurite
```

2. **Start Backend**:
```bash
dotnet run --project backend/CCMS.Api
```

3. **Upload a Creative via Swagger**:
   - Go to `http://localhost:5257/swagger`
   - Authorize with your token
   - Try `/api/creatives/upload` endpoint

4. **Check Storage Explorer**:
   - Open Azure Storage Explorer
   - Navigate to Local → Blob Containers → creatives
   - You should see your uploaded file!

5. **Check Database**:
```sql
SELECT * FROM Creatives ORDER BY CreatedAt DESC
```

---

## 🔐 Security Features

- ✅ **Authentication Required** - Only authenticated users can upload
- ✅ **Authorization Check** - Users can only upload to their own campaigns
- ✅ **File Integrity** - SHA256 hash stored for verification
- ✅ **Size Limit** - 100MB per file
- ✅ **Unique Names** - GUID prefix prevents collisions

---

## 🎯 Next Steps

1. Start Azurite emulator
2. Install Azure Storage Explorer
3. Test file upload via Swagger
4. View files in Storage Explorer
5. Verify database entries in SQL Server

Happy uploading! 🚀
