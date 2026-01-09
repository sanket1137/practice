# CCMS - Content and Campaign Management System

A digital signage platform connecting screen owners with advertisers, featuring real-time playback verification, booking management, and impression tracking via Raspberry Pi players.

## 🎯 Project Overview

**CCMS** enables:
- **Screen Owners**: Manage digital screens, approve bookings, monitor live playback
- **Advertisers**: Create campaigns, book screens, track impressions in real-time  
- **Raspberry Pi Players**: Automated content playback with synchronized playlist updates

---

## 🏗️ Architecture

```
practice/
├── backend/                    # ASP.NET Core 8.0 Web API
│   ├── CCMS.Api/              # Controllers, SignalR Hubs, Authentication
│   ├── CCMS.Application/      # Business Logic (CQRS with MediatR)
│   ├── CCMS.Domain/           # Entities, ValueObjects, Enums
│   ├── CCMS.Infrastructure/   # EF Core, Repositories, External Services
│   └── CCMS.Shared/           # DTOs, Common Models
├── frontend/                   # React + TypeScript SPA
│   └── src/
│       ├── components/        # Reusable UI (screens, bookings, campaigns)
│       ├── features/          # Auth, layout
│       ├── services/          # API client, SignalR
│       └── pages/             # Dashboard, Screens, Bookings, etc.
└── player/                     # Raspberry Pi Python Player
    ├── ccms_player.py         # Main player with VLC integration
    ├── default_video_manager.py  # Default video sync
    ├── config.json            # Player configuration
    └── requirements.txt       # Dependencies
```

---

## 🚀 Tech Stack

### Backend
- **Framework**: ASP.NET Core 8.0 Web API
- **Database**: SQL Server (LocalDB for dev)
- **ORM**: Entity Framework Core 8
- **Real-time**: SignalR WebSockets
- **Authentication**: JWT Bearer Tokens
- **Architecture**: Clean Architecture + CQRS (MediatR)
- **Validation**: FluentValidation
- **File Storage**: Azure Blob Storage (Azurite for local dev)

### Frontend
- **Framework**: React 18 + TypeScript 5
- **Build Tool**: Vite 4
- **UI Library**: Material-UI (MUI v5)
- **State**: React Query (TanStack Query) + Zustand
- **Routing**: React Router v6
- **HTTP Client**: Axios
- **WebSocket**: @microsoft/signalr

### Raspberry Pi Player
- **Language**: Python 3.9+
- **Real-time**: python-socketio
- **Video**: python-vlc
- **HTTP**: requests, aiohttp
- **Async**: asyncio

---

## 📋 Features

### ✅ Completed Features

#### 1. Authentication & Authorization
- [x] JWT-based authentication with refresh tokens
- [x] Role-based access control (Admin, ScreenOwner, Advertiser)
- [x] Protected API endpoints
- [x] Frontend route guards

#### 2. Screen Management
- [x] Screen registration with operating schedule
- [x] Screen listing with filters (location, status, price)
- [x] Screen details with map view
- [x] Device handshake for Raspberry Pi players
- [x] Online/offline status tracking

#### 3. Campaign & Creative Management  
- [x] Campaign creation and management
- [x] Creative upload (video/image)
- [x] File size limits and validation
- [x] Campaign-creative association

#### 4. Booking System
- [x] Booking request creation
- [x] Slot availability checking
- [x] Approval/rejection workflow (screen owners)
- [x] Booking status tracking (Pending → Approved/Rejected)
- [x] Daily slot assignment for partial bookings

#### 5. Player Integration  
- [x] SignalR hub for real-time communication
- [x] Player handshake and authentication
- [x] Dynamic playlist generation
- [x] Video file caching with hash verification
- [x] Default video playback for empty slots
- [x] Operating hours enforcement

#### 6. Analytics & Impressions
- [x] Impression tracking (10-minute batched sync)
- [x] Play count per booking/campaign
- [x] Session-based impression aggregation
- [x] Background service for stale data cleanup

#### 7. Dashboard & UI
- [x] Statistics overview (screens, campaigns, bookings)
- [x] Responsive navigation with sidebar
- [x] Screen browsing with search
- [x] Booking management interface
- [x] Campaign management  
- [x] User profile menu

### 🚧 In Progress / Planned

- [ ] Owner live slot controls (push content, direct bookings)
- [ ] Performance reports with play logs
- [ ] Advanced analytics dashboards
- [ ] Payment gateway integration
- [ ] Email notifications
- [ ] Multi-creative rotation per booking

---

## 🔧 Development Setup

### Prerequisites
```bash
# Required
- .NET 8.0 SDK
- Node.js 18+ & npm
- SQL Server (or LocalDB)
- Python 3.9+ (for player)

# Optional
- Azurite (for local Azure Blob Storage emulation)
- VLC Media Player (for player testing)
```

### 1. Backend Setup

```bash
cd backend/CCMS.Api

# Restore packages
dotnet restore

# Update database (applies migrations + seeds data)
dotnet ef database update --project ../CCMS.Infrastructure --startup-project .

# Run API
dotnet run
```

**Backend will start on**: `http://localhost:5257`  
**Swagger UI**: `http://localhost:5257/swagger`

### 2. Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Start dev server
npm run dev
```

**Frontend runs on**: `http://localhost:5173`

### 3. Azurite Setup (for local development)

```bash
# Install globally
npm install -g azurite

# Run in separate terminal
azurite --silent --location c:\azurite --debug c:\azurite\debug.log
```

**Azurite Blob endpoint**: `http://127.0.0.1:10000/devstoreaccount1`

### 4. Player Setup (Raspberry Pi / Local Testing)

```bash
cd player

# Install dependencies
pip install -r requirements.txt

# Run player
python ccms_player.py
```

**Configuration**: Edit `config.json` with your screen ID and API URL.

---

## 🔐 Seeded Test Accounts

The database is automatically seeded with test users on first migration:

| Role | Email | Password | Screen Access |
|------|-------|----------|---------------|
| **Screen Owner** | `owner1@example.com` | `Password123!` | Screen 1 (Times Square) |
| **Screen Owner** | `owner2@example.com` | `Password123!` | Screen 2 (Hollywood) |
| **Advertiser** | `advertiser1@example.com` | `Password123!` | - |
| **Advertiser** | `advertiser2@example.com` | `Password123!` | - |
| **Admin** | `admin@example.com` | `Password123!` | All screens |

**Recommended for testing**: Use `owner1@example.com` to see screens and approve bookings.

---

## 🌐 API Endpoints

### Authentication
```http
POST /api/auth/register      # Register new user
POST /api/auth/login         # Login and get JWT
POST /api/auth/refresh       # Refresh expired token
```

### Screens (Protected)
```http
GET    /api/screens          # List all screens (with filters)
POST   /api/screens          # Create screen (ScreenOwner/Admin)
GET    /api/screens/{id}     # Get screen details
PUT    /api/screens/{id}     # Update screen
DELETE /api/screens/{id}     # Delete screen
GET    /api/screens/my       # Get current user's screens
```

### Campaigns (Protected)
```http
GET    /api/campaigns        # List campaigns (user's own or all if admin)
POST   /api/campaigns        # Create campaign (Advertiser/Admin)
GET    /api/campaigns/{id}   # Get campaign details
PUT    /api/campaigns/{id}   # Update campaign
DELETE /api/campaigns/{id}   # Delete campaign
```

### Creatives (Protected)
```http
POST   /api/creatives/upload # Upload creative file (multipart/form-data)
GET    /api/creatives/{id}   # Get creative details
DELETE /api/creatives/{id}   # Delete creative
```

### Bookings (Protected)
```http
GET    /api/bookings                # List bookings (filtered by role)
POST   /api/bookings                # Create booking request
GET    /api/bookings/{id}           # Get booking details
PUT    /api/bookings/{id}/approve   # Approve booking (ScreenOwner/Admin)
PUT    /api/bookings/{id}/reject    # Reject booking (ScreenOwner/Admin)
DELETE /api/bookings/{id}           # Cancel/delete booking
```

### Player (Device APIs - Device Auth)
```http
POST   /api/player/handshake   # Device authentication & playlist fetch
POST   /api/player/sync        # Sync impressions (every 10 minutes)
POST   /api/player/heartbeat   # Device health check
```

### Analytics (Protected)
```http
GET    /api/analytics/dashboard        # Dashboard stats
GET    /api/analytics/screen/{id}      # Screen-specific analytics
GET    /api/analytics/campaign/{id}    # Campaign performance
```

---

## 🔄 SignalR Real-Time Events

### Hub Endpoint
```
ws://localhost:5257/hubs/player
```

### Client → Server (Player Events)
```javascript
// Player reports playback events
socket.emit("AdStarted", { screenId, bookingId, creativeId, timestamp });
socket.emit("AdCompleted", { screenId, bookingId, creativeId, timestamp });
socket.emit("PlayerStatus", { screenId, status, uptime });
```

### Server → Client (Dashboard Subscriptions)
```javascript
// Subscribe to specific screen updates
socket.on("OnScreenStatusChanged", (data) => { /* screen online/offline */ });
socket.on("OnPlayerSync", (data) => { /* impression count updated */ });

// Subscribe to campaign impressions
socket.on("OnImpressionRecorded", (data) => { /* new play logged */ });
```

### Client Subscription Groups
```javascript
// Join a group to receive targeted updates
connection.invoke("SubscribeToScreen", screenId);
connection.invoke("SubscribeToCampaign", campaignId);
```

---

## 📊 Database Schema

### Core Tables

**Users**
- Id, Email, PasswordHash, FirstName, LastName
- Role (Admin | ScreenOwner | Advertiser)
- CreatedAt

**Screens**
- Id, OwnerId, Name, Description
- PhysicalWidth, PhysicalHeight, Resolution
- Location (Address ValueObject)
- Latitude, Longitude
- Schedule (OperatingSchedule ValueObject - JSON)
- TimeFrameMinutes, SlotsPerFrame
- PricePerSlot, DefaultVideoUrl
- Status, IsOnline, LastSeenAt

**Campaigns**
- Id, AdvertiserId, Name, Description
- Budget, StartDate, EndDate
- Status (Draft | Active | Paused | Completed)

**Creatives**
- Id, CampaignId, Name
- FileUrl, FileName, MimeType, FileSize, FileHash
- Width, Height, Duration
- ThumbnailUrl

**Bookings**
- Id, ScreenId, CampaignId, CreativeId
- StartDate, EndDate
- SlotNumbers (JSON array - e.g., [1,2,3])
- DailySlotAssignmentsJson (for partial bookings)
- Status (Pending | Approved | Rejected | Cancelled)
- TotalPrice, ExpectedImpressions, DeliveredImpressions

**Impressions**
- Id, ScreenId, BookingId, CampaignId, CreativeId
- PlayedAt (exact timestamp)
- SessionDate (date-only for grouping)
- DeviceId, SlotPosition
- IsVerified

---

## 🎮 Player Configuration

**File**: `player/config.json`

```json
{
  "screen_id": "YOUR-SCREEN-GUID-HERE",
  "api_base_url": "http://localhost:5257",
  "signalr_hub_url": "http://localhost:5257/hubs/player",
  "device_token": "your-device-secret",
  "playlist_refresh_interval": 600,
  "heartbeat_interval": 300,
  "sync_interval": 600,
  "default_video_url": "http://127.0.0.1:10000/devstoreaccount1/creatives/default.mp4",
  "cache_directory": "./cache",
  "log_level": "INFO"
}
```

### Player Workflow

1. **Startup**: Reads config, initializes VLC
2. **Handshake**: Authenticates with backend, receives playlist
3. **Download**: Caches videos with hash verification
4. **Playback**: Loops through playlist slots
5. **Tracking**: Records impressions in memory
6. **Sync**: Sends batched impressions every 10 minutes
7. **Operating Hours**: Only plays during configured schedule

---

## 🚦 User Workflows

### Screen Owner Journey
1. Login with screen owner account
2. Add new screen with location and schedule
3. Link Raspberry Pi player (configure `screen_id`)
4. Receive booking requests from advertisers
5. Review and approve/reject bookings
6. Monitor live playback (coming soon)
7. View revenue and analytics

### Advertiser Journey
1. Login with advertiser account
2. Create campaign with budget
3. Upload creative assets (videos/images)
4. Browse available screens by location/price
5. Request booking for specific dates/slots
6. Wait for screen owner approval
7. Track impressions in real-time

### Daily Playback Cycle
1. Raspberry Pi boots at operating hours start
2. Handshake with API (auth + fetch playlist)
3. Download and cache videos
4. Play content in assigned slots
5. Record impressions every play
6. Sync impressions to backend every 10 min
7. Shutdown at operating hours end

---

## 🔐 Security Features

- ✅ **JWT Authentication**: Access + refresh token flow
- ✅ **Role-Based Access Control**: Endpoints protected by user role
- ✅ **Device Authentication**: Players use device tokens
- ✅ **CORS Configuration**: Frontend origin whitelisted
- ✅ **File Upload Validation**: Size limits, MIME type checks
- ✅ **SQL Injection Prevention**: EF Core parameterized queries
- ✅ **Password Hashing**: BCrypt with salt
- ✅ **HTTPS Ready**: TLS configuration in production

---

## 🧪 Testing

### Quick Test Flow

**1. Login as Screen Owner**
```
Email: owner1@example.com
Password: Password123!
```

**2. View Your Screen**
- Navigate to "Screens" → Click on "Times Square LED Wall"
- Check operating schedule, slots, pricing

**3. Login as Advertiser (separate browser/incognito)**
```
Email: advertiser1@example.com  
Password: Password123!
```

**4. Create Booking**
- Create a campaign
- Upload a creative
- Browse screens → Select "Times Square LED Wall"
- Create booking for slots 1-3
- Wait for approval

**5. Approve Booking (back to Screen Owner)**
- Navigate to "Bookings"
- Find pending booking
- Click "Approve"

**6. Start Player (terminal)**
```bash
cd player
python ccms_player.py
```

**7. Watch Playback**
- Player fetches playlist
- Downloads creatives  
- Plays approved bookings
- Syncs impressions every 10 min

---

## 📝 Environment Variables

### Backend (`appsettings.json`)
```json
{
  "ConnectionStrings": {
    "DefaultConnection": "Server=(localdb)\\mssqllocaldb;Database=PracticePixelCCMSDb;"
  },
  "JwtSettings": {
    "SecretKey": "your-secret-key-min-32-chars",
    "Issuer": "CCMSApi",
    "Audience": "CCMSClient",
    "ExpiryMinutes": 60
  },
  "FileStorage": {
    "Provider": "AzureBlob",
    "AzureBlobConnectionString": "DefaultEndpointsProtocol=http;AccountName=devstoreaccount1;..."
  }
}
```

### Frontend (`.env`)
```env
VITE_API_BASE_URL=http://localhost:5257
VITE_SIGNALR_HUB_URL=http://localhost:5257/hubs/player
```

---

## 🐛 Troubleshooting

### Backend won't start
```bash
# Check if port 5257 is in use
netstat -ano | findstr :5257

# Kill process if needed
taskkill /PID <process_id> /F

# Rebuild database
dotnet ef database drop -f --project ../CCMS.Infrastructure --startup-project .
dotnet ef database update --project ../CCMS.Infrastructure --startup-project .
```

### Frontend build errors
```bash
# Clear node_modules and reinstall
rm -rf node_modules package-lock.json
npm install

# Clear Vite cache
rm -rf node_modules/.vite
```

### Player connection issues
```bash
# Test API connectivity
curl http://localhost:5257/api/health

# Check SignalR hub
wscat -c ws://localhost:5257/hubs/player

# Verify screen ID in config.json matches database
```

### Azurite not storing files
```bash
# Ensure Azurite is running
azurite --silent --location c:\azurite

# Check container exists
az storage container list --connection-string "UseDevelopmentStorage=true"
```

---

## 📚 Project Structure Details

### Backend Layers

**CCMS.Api** - Web API layer
- Controllers: HTTP endpoints
- Hubs: SignalR real-time hubs
- Middleware: Error handling, logging
- Program.cs: DI container, pipeline config

**CCMS.Application** - Business logic
- Features: CQRS commands & queries (MediatR)
- Validators: FluentValidation rules
- Interfaces: Service abstractions

**CCMS.Domain** - Core domain
- Entities: Business entities (User, Screen, Booking, etc.)
- ValueObjects: Immutable values (Address, Schedule)
- Enums: Status, Role enums
- Interfaces: Repository contracts

**CCMS.Infrastructure** - External concerns
- Data: DbContext, migrations, seeders
- Repositories: EF Core implementations
- Services: File storage, playlist generation

**CCMS.Shared** - Cross-cutting
- DTOs: API request/response models
- Common: ApiResponse wrapper, constants

### Frontend Structure

**features/** - Feature modules
- `auth/`: Login, register, auth state
- `layout/`: App shell, navigation

**components/** - Domain components
- `screens/`: Screen list, details, forms
- `campaigns/`: Campaign CRUD
- `bookings/`: Booking list, approval
- `creatives/`: Upload, preview

**services/** - External integrations
- `api.ts`: Axios instance
- `signalR.ts`: WebSocket connection

**pages/** - Route components
- Dashboard, Screens, Bookings, Campaigns

---

## 🔮 Future Roadmap

### Short Term
- [ ] Owner live slot controls UI
- [ ] Performance reports (PDF export)
- [ ] Email notification system
- [ ] Advanced analytics dashboard
- [ ] Campaign budget tracking

### Medium Term
- [ ] Multi-creative rotation per booking
- [ ] Programmatic ad buying API
- [ ] Mobile apps (React Native)
- [ ] Payment gateway (Stripe/Razorpay)
- [ ] AI content moderation

### Long Term
- [ ] Audience detection via camera
- [ ] Dynamic pricing engine
- [ ] Demographic analytics
- [ ] Multi-language support
- [ ] White-label deployments

---

## 📄 License

Proprietary - All rights reserved

---

## 🤝 Contributing

This is a proprietary project. Contact the project maintainer for collaboration opportunities.

---

**Built with ❤️ for the digital signage revolution**
