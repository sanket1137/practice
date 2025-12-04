# CCMS - Content and Campaign Management System

A digital signage platform connecting screen owners with advertisers, featuring real-time playback verification, booking management, and impression tracking via Raspberry Pi players.

## 🎯 Project Overview

**CCMS** enables:
- **Screen Owners**: Manage digital screens, approve bookings, monitor playback
- **Advertisers**: Create campaigns, book screens, track impressions in real-time
- **Raspberry Pi Players**: Automated content playback with real-time reporting

## 🏗️ Architecture

```
practice/
├── backend/                    # ASP.NET Core 8.0 Web API
│   ├── CCMS.Api/              # Web API & SignalR Hubs
│   ├── CCMS.Application/      # Business Logic (CQRS + MediatR)
│   ├── CCMS.Domain/           # Domain Entities & Interfaces
│   ├── CCMS.Infrastructure/   # Data Access & External Services
│   └── CCMS.Shared/           # DTOs & Common Models
├── frontend/                   # React + TypeScript + Material-UI
│   ├── src/
│   │   ├── components/        # Reusable UI components
│   │   ├── features/          # Feature modules
│   │   ├── services/          # API & WebSocket clients
│   │   └── pages/             # Page components
├── player/                     # Raspberry Pi Player (Python)
│   ├── player.py              # Main player script
│   ├── websocket_client.py    # Real-time communication
│   └── requirements.txt       # Python dependencies
└── docs/                       # Documentation
```

## 🚀 Tech Stack

### Backend
- **Framework**: ASP.NET Core 8.0
- **Database**: SQL Server / PostgreSQL
- **ORM**: Entity Framework Core
- **Real-time**: SignalR
- **Authentication**: JWT Bearer
- **Patterns**: Clean Architecture, CQRS, MediatR
- **Validation**: FluentValidation
- **File Storage**: Local storage (S3 ready)

### Frontend
- **Framework**: React 18 + TypeScript
- **Build Tool**: Vite
- **UI Library**: Material-UI (MUI)
- **State Management**: React Query + Zustand
- **Routing**: React Router v6
- **Maps**: Google Maps / Mapbox
- **Video Player**: Video.js
- **WebSocket**: SignalR Client

### Raspberry Pi Player
- **Language**: Python 3.9+
- **WebSocket**: python-socketio
- **Video Playback**: VLC / OMXPlayer
- **HTTP Client**: requests

## 📋 Features

### Phase 1: Core Setup ✅
- [x] Database schema and migrations
- [x] User authentication (JWT)
- [x] Role-based authorization
- [x] Screen registration
- [x] Campaign & creative management

### Phase 2: Booking System
- [x] Screen discovery with filters
- [x] Booking request flow
- [x] Creative dimension validation
- [x] Approval/rejection workflow
- [x] Calendar view

### Phase 3: Player Integration
- [x] SignalR hub setup
- [x] Raspberry Pi player script
- [x] Playlist generation
- [x] File caching mechanism
- [x] Device handshake

### Phase 4: Real-time Analytics
- [x] Event subscription system
- [x] Impression tracking
- [x] Live preview system
- [x] Analytics dashboards

### Phase 5: Testing & Polish
- [ ] End-to-end testing
- [ ] Error handling
- [ ] UI/UX refinements
- [ ] Documentation
- [ ] Deployment

## 🔧 Development Setup

### Prerequisites
- .NET 8.0 SDK
- Node.js 18+ & npm
- SQL Server / PostgreSQL
- Python 3.9+ (for player)

### Backend Setup
```bash
cd backend
dotnet restore
dotnet ef database update --project CCMS.Infrastructure --startup-project CCMS.Api
dotnet run --project CCMS.Api
```

### Frontend Setup
```bash
cd frontend
npm install
npm run dev
```

### Player Setup (Raspberry Pi)
```bash
cd player
pip install -r requirements.txt
python player.py --device-id YOUR_DEVICE_ID
```

## 🌐 API Endpoints

### Authentication
- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login
- `POST /api/auth/refresh` - Refresh token

### Screens
- `GET /api/screens` - List all screens
- `POST /api/screens` - Register new screen
- `GET /api/screens/{id}` - Get screen details
- `PUT /api/screens/{id}` - Update screen
- `DELETE /api/screens/{id}` - Delete screen

### Campaigns
- `GET /api/campaigns` - List campaigns
- `POST /api/campaigns` - Create campaign
- `GET /api/campaigns/{id}` - Get campaign details
- `POST /api/campaigns/{id}/creatives` - Upload creative

### Bookings
- `GET /api/bookings` - List bookings
- `POST /api/bookings` - Create booking request
- `PUT /api/bookings/{id}/approve` - Approve booking
- `PUT /api/bookings/{id}/reject` - Reject booking

### Analytics
- `GET /api/analytics/screen/{id}` - Screen analytics
- `GET /api/analytics/campaign/{id}` - Campaign analytics
- `GET /api/analytics/impressions` - Impression reports

### Player (Device APIs)
- `POST /api/player/handshake` - Device authentication
- `GET /api/player/playlist` - Get today's playlist
- `POST /api/player/impression` - Report impression

## 🔄 Real-time WebSocket Events

### Player Events
- `ad_started` - Ad playback started
- `ad_completed` - Ad playback completed
- `impression_count` - Batch impression update
- `player_status` - Device health status

### Client Subscriptions
- `subscribe:screen:{id}` - Monitor specific screen
- `subscribe:campaign:{id}` - Monitor campaign playback
- `subscribe:booking:{id}` - Monitor booking impressions

## 📊 Database Schema

### Core Tables
- **Users** - Authentication and profiles
- **Screens** - Screen registration and configuration
- **Campaigns** - Advertiser campaigns
- **Creatives** - Video/image assets
- **Bookings** - Screen booking requests
- **Impressions** - Playback tracking
- **Organizations** - Multi-user organizations
- **Memberships** - User-organization relationships

## 🔐 Security

- JWT-based authentication
- Role-based authorization (ScreenOwner, Advertiser, Admin)
- Device authentication for players
- CORS configuration
- File upload validation
- SQL injection prevention (EF Core)
- XSS protection

## 📱 User Flows

### Screen Owner Journey
1. Register account → 2. Add screen → 3. Configure schedule → 
4. Link Raspberry Pi → 5. Receive bookings → 6. Approve/Reject → 
7. Monitor playback

### Advertiser Journey
1. Register account → 2. Create campaign → 3. Upload creatives → 
4. Browse screens → 5. Book slots → 6. Await approval → 
7. Monitor impressions

### Daily Playback Flow
1. Pi boots → 2. Handshake with server → 3. Download playlist → 
4. Cache videos → 5. Play content → 6. Report impressions → 
7. Shutdown

## 🎨 UI Features

- **Dashboard**: Overview of screens/campaigns
- **Map View**: Geographical screen discovery
- **Calendar**: Booking schedule visualization
- **Live Preview**: Real-time ad playback monitoring
- **Analytics**: Impression charts and reports
- **Notifications**: Real-time booking updates

## 🚧 MVP Constraints

- Single creative per booking
- Manual pricing (no dynamic pricing)
- Basic analytics (impressions only)
- No payment gateway integration
- Single language (English)

## 🔮 Future Enhancements

- Multi-creative rotation
- Dynamic pricing engine
- Advanced analytics (demographics, heatmaps)
- Payment integration (Stripe/Razorpay)
- Mobile apps (iOS/Android)
- AI content moderation
- Audience detection via camera
- Programmatic ad buying

## 📝 License

Proprietary - All rights reserved

## 👥 Team

- Full-stack Developer (Backend + API)
- Frontend Developer (React/TypeScript)
- Python Developer (Raspberry Pi)
- UI/UX Designer
- Project Manager/QA

## 📞 Support

For issues and questions, contact the development team.

---

**Built with ❤️ for the digital signage revolution**

## Quick Start

1. **Setup**: Run the setup script to install dependencies and update the database.
   `powershell
   ./setup.ps1
   ``n
2. **Run**: Start both backend and frontend services.
   `powershell
   ./start-all.ps1
   ``n
3. **Access**:
   - Frontend: http://localhost:5173
   - Backend API: http://localhost:5257
   - Swagger Docs: http://localhost:5257/swagger
