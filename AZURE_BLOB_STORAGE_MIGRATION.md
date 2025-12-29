# Azure Blob Storage Migration Guide

## ✅ Completed Steps

### 1. **Installed Azure.Storage.Blobs Package**
```bash
dotnet add package Azure.Storage.Blobs
```
Package version: 12.26.0

### 2. **Created AzureBlobStorageService**
- **Location:** `backend/CCMS.Infrastructure/Services/AzureBlobStorageService.cs`
- **Features:**
  - Upload files to Azure Blob Storage with unique GU IDs
  - Download files from blob storage
  - Delete files from blob storage
  - Automatic container creation (if not exists)
  - Works with Azurite local emulator

### 3. **Updated Configuration**
- **File:** `backend/CCMS.Api/appsettings.json`
- **Changes:**
  ```json
  "FileStorage": {
    "Provider": "AzureBlob",  // Changed from "Local"
    "Comment": "Provider can be 'Local' or 'AzureBlob'"
  },
  "AzureBlobStorage": {
    "ConnectionString": "AccountName=devstoreaccount1;AccountKey=Eby8vdM02xNOcqFlqUwJPLlmEtlCDXJ1OUzFT50uSRZ6IFsuFq2UVErCz4I6tq/K1SZFPTOtr/KBHBeksoGMGw==;DefaultEndpointsProtocol=http;BlobEndpoint=http://127.0.0.1:10000/devstoreaccount1;QueueEndpoint=http://127.0.0.1:10001/devstoreaccount1;TableEndpoint=http://127.0.0.1:10002/devstoreaccount1;",
    "ContainerName": "creatives",
    "Comment": "Using Azurite local storage emulator"
  }
  ```

### 4. **Updated Dependency Injection**
- **File:** `backend/CCMS.Api/Program.cs`
- **Changes:**
  - Added configurable file storage provider
  - Registers `AzureBlobStorageService` when `Provider = "AzureBlob"`
  - Registers `LocalFileStorageService` when `Provider = "Local"`
  - Console logs which provider is being used

---

## 🔧 Configuration Options

### **Switch between Local and Azure Blob Storage**
In `appsettings.json`, change:
```json
"FileStorage": {
  "Provider": "Local"      // Use local file system
  // OR
  "Provider": "AzureBlob"  // Use Azure Blob Storage
}
```

---

## 🚀 Testing Instructions

### **1. Start Azurite (if not started)**
```bash
# In a separate terminal
azurite
```
This will start the Azure Storage Emulator at:
- Blob Service: `http://127.0.0.1:10000`
- Queue Service: `http://127.0.0.1:10001`
- Table Service: `http://127.0.0.1:10002`

### **2. Restart the Backend API**
```bash
cd backend/CCMS.Api
dotnet run
```

You should see in the console:
```
Using Azure Blob Storage for file uploads
```

### **3. Upload a Creative**
Use the `/api/creatives/upload` endpoint to upload a video/image.

The file will be:
1. Uploaded to Azurite blob storage
2. Stored in the `creatives` container
3. Given a unique GUID-based filename
4. Accessible via blob URL: `http://127.0.0.1:10000/devstoreaccount1/creatives/{guid}.mp4`

### **4. Verify in Azure Storage Explorer (Optional)**
- Download **Azure Storage Explorer**
- Connect to **Local Emulator (Azurite)**
- Navigate to **Blob Containers** → **creatives**
- You should see your uploaded files

---

## 📂 File Structure

```
backend/
├── CCMS.Infrastructure/
│   └── Services/
│       ├── LocalFileStorageService.cs     (existing)
│       └── AzureBlobStorageService.cs     (NEW)
├── CCMS.Api/
│   ├── appsettings.json                   (updated with AzureBlobStorage config)
│   └── Program.cs                          (updated DI registration)
```

---

## 🔄 How It Works

### **Upload Flow:**
1. User uploads creative via `/api/creatives/upload`
2. `CreativesController` receives IFormFile
3. `UploadCreativeCommand` is sent to MediatR
4. `UploadCreativeCommandHandler` calls `IFileStorageService.UploadFileAsync()`
5. **AzureBlobStorageService** uploads to Azurite
6. Returns blob URL: `http://127.0.0.1:10000/devstoreaccount1/creatives/{guid}.mp4`
7. Creative entity is saved to database with blob URL

### **Download Flow:**
1. Player requests creative URL
2. URL points directly to blob storage
3. Azurite serves the file

---

## 🎯 Production Deployment

For production with **Azure Blob Storage**:

1. Update `appsettings.Production.json`:
```json
"AzureBlobStorage": {
  "ConnectionString": "DefaultEndpointsProtocol=https;AccountName=YOUR_ACCOUNT;AccountKey=YOUR_KEY;EndpointSuffix=core.windows.net",
  "ContainerName": "creatives"
}
```

2. Set container to **private** and use SAS tokens for secure access (optional)

3. Consider using **Azure CDN** for faster global delivery

---

## ✅ Benefits

- ✅ **Scalable**: No local disk space limitations
- ✅ **Reliable**: Azure's 99.9% availability SLA
- ✅ **Cost-effective**: Pay only for what you use
- ✅ **CDN-ready**: Easy integration with Azure CDN
- ✅ **Backup**: Automatic geo-redundancy available
- ✅ **Development**: Works seamlessly with Azurite locally

---

## 📝 Notes

- The `IFileStorageService` interface remains unchanged
- Both Local and Azure implementations are available
- Switch between them via configuration (no code changes needed)
- Existing creatives in local file system will remain there until migrated
- New uploads will go to blob storage when configured

---

## 🐛 Troubleshooting

### **"Container not found" error:**
- Ensure Azurite is running
- Container is auto-created on first upload

### **"Connection refused" error:**
- Check Azurite is running at `http://127.0.0.1:10000`
- Verify connection string in `appsettings.json`

### **File not accessible:**
- Check blob URL format
- Ensure public access is enabled for the container (Azurite defaults to public)

