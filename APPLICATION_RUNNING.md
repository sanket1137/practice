# 🚀 Application Running - All Services Started

## ✅ All Services Are Live!

Your complete PixelCCMS application stack is now running:

---

## 🌐 Application URLs

### 1. **Frontend (React App)**
- **URL**: http://localhost:5173
- **Description**: Main user interface for the CCMS platform
- **Features**: Campaigns, Screens, Bookings, Creatives management

### 2. **Backend API**
- **URL**: http://localhost:5257
- **Swagger UI**: http://localhost:5257/swagger
- **Description**: REST API for all backend operations

### 3. **Azurite (Blob Storage Emulator)**
- **Blob Endpoint**: http://127.0.0.1:10000/devstoreaccount1
- **Container**: `creatives`
- **Description**: Local Azure Blob Storage for creative files

---

## 🎯 Quick Access Links

| Service | URL | Purpose |
|---------|-----|---------|
| **Frontend** | http://localhost:5173 | User Interface |
| **Swagger API Docs** | http://localhost:5257/swagger | API Testing & Documentation |
| **Backend API** | http://localhost:5257/api | REST API Endpoint |
| **Blob Storage** | http://127.0.0.1:10000 | File Storage |

---

## 👤 Test Users

### Advertiser Account:
- **Email**: `advertiser1@example.com`
- **Password**: `Password123!`
- **Role**: Advertiser
- **Permissions**: Create campaigns, upload creatives, create bookings

### Screen Owner Account:
- **Email**: `screenowner1@example.com`
- **Password**: `Password123!`
- **Role**: ScreenOwner
- **Permissions**: Manage screens, approve bookings, create campaigns

### Admin Account:
- **Email**: `admin@example.com`
- **Password**: `Password123!`
- **Role**: Admin
- **Permissions**: Full access to all features

---

## 📊 View Uploaded Creatives

### Using Azure Storage Explorer:

1. **Download** (if not installed):
   - https://azure.microsoft.com/products/storage/storage-explorer/

2. **Connect to Local Storage**:
   - Open Azure Storage Explorer
   - Click **Connect** (plug icon)
   - Select: **"Local storage emulator"**
   - Connection string: `UseDevelopmentStorage=true`
   - Click **Connect**

3. **Browse Files**:
   ```
   Local & Attached
   └── Storage Accounts
       └── (Emulator - Default Ports)
           └── Blob Containers
               └── creatives  ← YOUR FILES HERE!
   ```

---

## 🧪 Test Creative Upload

1. **Login to Frontend**: http://localhost:5173
   - Use: `advertiser1@example.com` / `Password123!`

2. **Create or Select a Campaign**

3. **Upload Creative**:
   - Go to campaign details
   - Click **Creatives** tab
   - Click **Upload Creative**
   - Select file
   - Enter name and duration
   - Submit

4. **View in Storage Explorer**:
   - Refresh the `creatives` container
   - You'll see: `{guid}_yourfile.jpg`

---

## 🛠️ Running Services

### Current Status:
✅ **Azurite (Blob Storage)** - Port 10000  
✅ **Backend API** - Port 5257  
✅ **Frontend** - Port 5173  

### To Stop Services:
Press `Ctrl+C` in each terminal window

### To Restart:
```powershell
# Backend
dotnet run --project backend\CCMS.Api

# Frontend
cd frontend
npm run dev

# Azurite
azurite --silent --location c:\azurite
```

---

## 📱 Features Available

### Campaign Management:
- ✅ Create, Edit, Delete campaigns
- ✅ View campaign details
- ✅ Track budgets and dates
- ✅ Campaign status management

### Creative Management:
- ✅ Upload images/videos to Azure Blob Storage
- ✅ View creative library
- ✅ Associate creatives with campaigns
- ✅ Metadata stored in SQL Server

### Screen Management:
- ✅ Register digital screens
- ✅ Set operating schedules
- ✅ Define pricing
- ✅ Location management

### Booking System:
- ✅ Intelligent booking calculation
- ✅ Auto-calculate impressions based on schedules
- ✅ Real-time pricing preview
- ✅ Booking approval workflow

### Analytics:
- ✅ Campaign performance tracking
- ✅ Screen utilization metrics
- ✅ Booking statistics

---

## 🔐 API Authentication

All API requests (except login/register) require authentication:

**Header**:
```
Authorization: Bearer {your-access-token}
```

**Get Token**:
1. Go to Swagger: http://localhost:5257/swagger
2. Use `POST /api/auth/login` endpoint
3. Login with test credentials
4. Copy the `accessToken` from response
5. Click **Authorize** button in Swagger
6. Enter: `Bearer {your-token}`

---

## 📚 Documentation

- **API Documentation**: http://localhost:5257/swagger
- **Blob Storage Guide**: See `STORAGE_EMULATOR_GUIDE.md`
- **Setup Guide**: See `AZURE_BLOB_STORAGE_SETUP.md`

---

## ✨ Everything is Ready!

Your complete CCMS platform is now running with:
- ✅ React frontend with Material-UI
- ✅ .NET 8 backend with clean architecture
- ✅ SQL Server LocalDB for data
- ✅ Azure Blob Storage for files
- ✅ Real-time updates via SignalR
- ✅ JWT authentication
- ✅ Role-based access control

**Start Here**: http://localhost:5173

Enjoy! 🎉
