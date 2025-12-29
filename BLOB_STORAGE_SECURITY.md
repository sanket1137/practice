# Azure Blob Storage Security Model

## ✅ Current Security Implementation

### Upload Security (Already Secure)

**1. Backend-Only Uploads**
- ✅ All uploads go through `/api/creatives/upload` endpoint
- ✅ Endpoint requires authentication: `[Authorize(Roles = "Advertiser,ScreenOwner,Admin")]`
- ✅ Connection string and keys are stored in backend `appsettings.json` ONLY
- ✅ Users NEVER have direct access to blob storage credentials
- ✅ Ownership validation: Users can only upload to their own campaigns

**2. Upload Flow**
```
User → Frontend → Backend API (Authenticated) → Azure Blob Storage
                      ↓
                  JWT Token Required
                  Role Check
                  Ownership Validation
```

### Current Access Model

#### Write Access (Upload):
- ❌ **Users:** No direct access
- ✅ **Backend API:** Full access via connection string
- ✅ **Security:** Enforced by backend authentication & authorization

#### Read Access (Download):
- ✅ **Public Blob Access:** Enabled (`PublicAccessType.Blob`)
- 🔓 **Anyone** can read/download blobs if they know the URL
- ✅ **Use Case:** Videos need to be publicly accessible for players to stream

---

## 🔒 Security Recommendations

### For Production (Choose One)

#### Option 1: Public Blobs (Current - Simpler)
**Best for:** Public advertising content

**Pros:**
- ✅ Simple implementation
- ✅ No authentication needed for playback
- ✅ Fast - direct CDN access
- ✅ Players don't need backend authentication

**Cons:**
- ⚠️ Anyone with URL can access content
- ⚠️ Content URLs can be shared

**Current Implementation:**
```csharp
_containerClient.CreateIfNotExists(PublicAccessType.Blob);
```

#### Option 2: Private Blobs with SAS Tokens (More Secure)
**Best for:** Sensitive or premium content

**Pros:**
- ✅ URLs expire after set time
- ✅ Access can be revoked
- ✅ Audit trail possible
- ✅ Prevents unauthorized sharing

**Cons:**
- ⚠️ More complex implementation
- ⚠️ Players need SAS tokens
- ⚠️ Token refresh logic needed

**Implementation Required:**
```csharp
// Container with private access
_containerClient.CreateIfNotExists(PublicAccessType.None);

// Generate SAS token for read access
BlobSasBuilder sasBuilder = new BlobSasBuilder()
{
    BlobContainerName = containerName,
    BlobName = blobName,
    Resource = "b", // Blob
    ExpiresOn = DateTimeOffset.UtcNow.AddHours(1)
};
sasBuilder.SetPermissions(BlobSasPermissions.Read);
```

---

## 🎯 Current Implementation Details

### File: `AzureBlobStorageService.cs`

**Upload Method (Secure):**
```csharp
public async Task<string> UploadFileAsync(...)
{
    // Only called from authenticated backend endpoints
    // Users cannot call this directly
    
    var blobClient = _containerClient.GetBlobClient(blobName);
    await blobClient.UploadAsync(fileStream, ...);
    
    return blobClient.Uri.ToString(); // Public URL
}
```

**Container Creation:**
```csharp
// Line 25 in AzureBlobStorageService.cs
_containerClient.CreateIfNotExists(PublicAccessType.Blob);
//                                  ↑
//                         Blobs are publicly readable
```

### File: `CreativesController.cs`

**Upload Endpoint (Secured):**
```csharp
[HttpPost("upload")]
[Authorize(Roles = "Advertiser,ScreenOwner,Admin")] // ✅ Auth required
[RequestSizeLimit(100_000_000)] // 100MB limit
public async Task<ActionResult> Upload(...)
{
    var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
    
    // Ownership validation
    if (campaign.AdvertiserId != userId)
        throw new UnauthorizedAccessException();
    
    // Upload via backend service
    await _mediator.Send(command);
}
```

---

## 📋 Security Checklist

### Upload Security ✅
- [x] Authentication required via JWT
- [x] Role-based authorization (Advertiser/ScreenOwner/Admin)
- [x] Ownership validation (user can only upload to own campaigns)
- [x] File size limits (100MB)
- [x] Connection string not exposed to frontend
- [x] No direct blob storage access for users

### Download Security (Current)
- [x] Blobs are publicly readable (intended for video playback)
- [ ] Consider SAS tokens for premium content (optional)
- [ ] Consider CDN integration for better performance (optional)

---

## 🚀 How It Works

### Upload Flow:
```
1. User logs in → Gets JWT token
2. User selects video → Frontend calls /api/creatives/upload
3. Backend validates:
   - JWT token ✅
   - User role ✅  
   - Campaign ownership ✅
4. Backend uploads to Blob Storage
5. Backend saves FileUrl in database
6. Frontend receives success response
```

### Download/Playback Flow:
```
1. Player fetches playlist → Gets FileUrl from backend API
2. FileUrl points directly to blob storage
3. Player streams video from blob URL
4. No backend authentication needed for playback
```

---

## ⚠️ Important Notes

1. **Users CANNOT upload directly to blob storage**
   - They don't have connection strings
   - They don't have account keys
   - All uploads go through authenticated backend API

2. **Users CAN download/stream content**
   - This is intentional for video playback
   - Players need direct access to video files
   - Alternative: Use SAS tokens (requires code changes)

3. **Blob Storage Credentials**
   - Stored ONLY in backend `appsettings.json`
   - Never exposed to frontend
   - Never sent to client

---

## 🔧 Optional: Enable Private Blobs with SAS

If you want to make blobs private and use SAS tokens:

### Step 1: Change Container Access
```csharp
// In AzureBlobStorageService.cs constructor
_containerClient.CreateIfNotExists(PublicAccessType.None);
```

### Step 2: Generate SAS Token on Upload
```csharp
public async Task<string> UploadFileAsync(...)
{
    await blobClient.UploadAsync(...);
    
    // Generate SAS token (1 year expiry)
    var sasBuilder = new BlobSasBuilder
    {
        BlobContainerName = _containerName,
        BlobName = blobName,
        Resource = "b",
        ExpiresOn = DateTimeOffset.UtcNow.AddYears(1)
    };
    sasBuilder.SetPermissions(BlobSasPermissions.Read);
    
    var sasToken = sasBuilder.ToSasQueryParameters(...).ToString();
    return $"{blobClient.Uri}?{sasToken}";
}
```

### Step 3: Handle Token Refresh
- Implement token refresh logic in backend
- Update Creative.FileUrl when tokens expire
- Players fetch fresh URLs when needed

---

## ✅ Conclusion

**Your requirement is already met:**
- ✅ Uploads ONLY happen through authenticated backend API
- ✅ Users have NO direct access to blob storage for uploads
- ✅ Connection strings are secure in backend
- ✅ Role-based access control is enforced

**Current model is secure for most use cases!**

If you need stricter download controls (e.g., prevent URL sharing), we can implement SAS tokens. Let me know!
