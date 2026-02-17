# PixelSpot CCMS
## Digital Out-of-Home Advertising Platform

<div align="center">

![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)
![License](https://img.shields.io/badge/license-Proprietary-red.svg)
![Status](https://img.shields.io/badge/status-Production%20Ready-green.svg)

**Connect Screen Owners with Advertisers • Real-Time Proof of Play • Verified Impressions**

</div>

---

## 📖 Table of Contents

1. [Executive Summary](#-executive-summary)
2. [Features](#-features)
3. [Architecture](#-architecture)
4. [Tech Stack](#-tech-stack)
5. [Quick Start](#-quick-start)
6. [Deployment](#-deployment)
7. [API Reference](#-api-reference)
8. [Raspberry Pi Player Setup](#-raspberry-pi-player-setup)
9. [Pricing & Business Model](#-pricing--business-model)
10. [Infrastructure Costs](#-infrastructure-costs)
11. [Current Limitations](#-current-limitations)
12. [Future Roadmap](#-future-roadmap)

---

## 🎯 Executive Summary

**PixelSpot CCMS** is a comprehensive Digital Out-of-Home (DOOH) advertising platform that connects screen owners with advertisers through intelligent, real-time content management.

### The Problem We Solve

| Traditional DOOH Issues | PixelSpot Solution |
|------------------------|-------------------|
| ❌ No proof of play | ✅ Real-time verified impressions |
| ❌ Manual scheduling | ✅ Automated slot management |
| ❌ Delayed reporting | ✅ Live dashboard with instant data |
| ❌ Fragmented market | ✅ Unified marketplace |
| ❌ Trust deficit | ✅ Tamper-proof impression tracking |

### User Roles

| Role | Description | Capabilities |
|------|-------------|--------------|
| **Admin** | Platform administrator | Full access, user management, system config |
| **Screen Owner** | Owns digital displays | Add screens, approve bookings, monitor playback |
| **Advertiser** | Brands wanting to advertise | Create campaigns, book screens, track impressions |

---

## ✨ Features

### ✅ Core Features (Production Ready)

#### 🔐 Authentication & Security
- JWT Authentication with Refresh Tokens
- Role-Based Access Control (RBAC)
- Email Verification
- Phone OTP Verification (India - ComBirds)
- Password Reset Flow
- BCrypt Password Hashing
- Secure API Keys for Players

#### 📺 Screen Management
- Screen Registration (location, hours, pricing)
- Operating Hours Configuration (per day)
- Timezone Support (IST, UTC, etc.)
- Screen Images Upload (multiple)
- Online/Offline Status Tracking (30s heartbeat)
- Screen Tagging System (Auto + Manual)
- Google Places API Integration for POI tagging
- Public Screen Explorer

#### 🎬 Campaign & Creative Management
- Campaign CRUD with Status Management
- Creative Upload (Video/Image)
- File Size & Format Validation
- Content Hash Verification
- Multi-Creative per Campaign
- Video Metadata Extraction

#### 📅 Booking System
- Slot-Based Booking (6 slots/hour, 10-min each)
- Date Range Selection
- Real-Time Slot Availability
- Approval/Rejection Workflow
- Automatic Price Calculation
- Multi-Currency Support (INR, USD, EUR)
- PDF Invoice Generation (QuestPDF)

#### 🍓 Raspberry Pi Player
- MPV Gapless Video Playback
- Dual-Buffer Playback (seamless transitions)
- Local Video Caching with Hash Verification
- SignalR Real-Time Communication
- Dynamic Playlist Sync
- Default Video Fallback
- Operating Hours Enforcement
- Offline Impression Queue (SQLite)
- Watchdog Auto-Recovery

#### 📊 Analytics & Impressions
- Real-Time Impression Tracking
- Deduplication via SlotPlayKey
- Batched Sync (10-minute intervals)
- Daily Summary Aggregation
- Campaign & Screen Reports

#### 🔴 Real-Time Features (SignalR)
- PlaybackHub (Ad start/complete events)
- PlayerHub (Device management)
- StreamingHub (WebRTC signaling)
- Live Play Counter Widget
- Instant Playlist Updates

#### 📹 Live Streaming (WebRTC)
- Screen Live Preview
- Advertiser Stream Access Validation
- 24-Hour Preview Access (before booking starts)
- Multi-Viewer Support with Priority
- TURN/STUN Server Configuration

#### 🎨 UI/UX Enhancements
- Server-Side Pagination
- React Error Boundaries
- Rate Limiting UI Feedback
- Offline Mode Indicator
- Email Notifications for Booking Status

---

## 🏗 Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         FRONTEND                                 │
│            React 18 + TypeScript + Material UI + Vite            │
│         (Dashboard, Booking UI, Live Monitor, Analytics)         │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                         BACKEND API                              │
│           ASP.NET Core 8 + SignalR + MediatR (CQRS)             │
│      (REST APIs, WebSocket Hubs, Business Logic, Auth)          │
└─────────────────────────────────────────────────────────────────┘
                              │
            ┌─────────────────┼─────────────────┐
            ▼                 ▼                 ▼
┌───────────────────┐ ┌──────────────┐ ┌───────────────────┐
│    PostgreSQL     │ │ Cloudflare   │ │   Raspberry Pi    │
│   (Neon Cloud)    │ │   R2 Storage │ │     Players       │
│  (Data + Schema)  │ │  (Videos)    │ │ (MPV + Python)    │
└───────────────────┘ └──────────────┘ └───────────────────┘
```

### Project Structure

```
pixelspot-ccms/
├── backend/                      # ASP.NET Core 8.0 Web API
│   ├── CCMS.Api/                # Controllers, Hubs, Middleware
│   ├── CCMS.Application/        # Business Logic (CQRS + MediatR)
│   ├── CCMS.Domain/             # Entities, Enums, Value Objects
│   ├── CCMS.Infrastructure/     # EF Core, Repositories, Services
│   └── CCMS.Shared/             # DTOs, Common Models
├── frontend/                     # React + TypeScript SPA
│   └── src/
│       ├── components/          # Reusable UI Components
│       ├── hooks/               # Custom React Hooks
│       ├── pages/               # Route Pages
│       ├── services/            # API & WebSocket Services
│       └── store/               # Zustand State Management
├── player/                       # Raspberry Pi Python Player
│   ├── ccms_player.py          # Main Entry Point
│   ├── mpv_dual_player.py      # Gapless Video Playback
│   ├── cache_manager.py        # Video Caching
│   ├── impression_store.py     # Offline Queue
│   └── config.json             # Player Configuration
└── nginx/                        # Reverse Proxy Configuration
```

---

## 🛠 Tech Stack

### Backend
| Technology | Purpose |
|------------|---------|
| ASP.NET Core 8.0 | Web API Framework |
| Entity Framework Core 8 | ORM |
| PostgreSQL (Neon) | Primary Database |
| SignalR | Real-Time WebSockets |
| MediatR | CQRS Pattern |
| QuestPDF | Invoice Generation |
| AWS SES | Email Service |
| FluentValidation | Input Validation |

### Frontend
| Technology | Purpose |
|------------|---------|
| React 18 | UI Framework |
| TypeScript 5 | Type Safety |
| Vite 5 | Build Tool |
| Material UI v6 | Component Library |
| TanStack Query | Server State |
| Zustand | Client State |
| notistack | Notifications |

### Player
| Technology | Purpose |
|------------|---------|
| Python 3.9+ | Runtime |
| MPV | Gapless Video Playback |
| python-socketio | SignalR Client |
| SQLite | Offline Impression Queue |
| aiohttp | Async HTTP |

### Infrastructure
| Service | Purpose |
|---------|---------|
| Hetzner VPS | Application Hosting |
| Neon | PostgreSQL Database |
| Cloudflare R2 | Video/Image Storage |
| AWS SES | Transactional Emails |
| ComBirds | SMS OTP (India) |
| Let's Encrypt | SSL Certificates |

---

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- .NET 8.0 SDK
- PostgreSQL (or Neon account)
- Docker (optional)

### 1. Clone Repository
```bash
git clone https://github.com/your-org/pixelspot-ccms.git
cd pixelspot-ccms
```

### 2. Backend Setup
```bash
cd backend/CCMS.Api
cp appsettings.Development.example.json appsettings.Development.json
# Edit appsettings.Development.json with your database connection

dotnet restore
dotnet ef database update
dotnet run
```

**Backend runs on**: `http://localhost:5257`  
**Swagger UI**: `http://localhost:5257/swagger`

### 3. Frontend Setup
```bash
cd frontend
npm install
cp .env.example .env.local
# Edit .env.local with your API URL

npm run dev
```

**Frontend runs on**: `http://localhost:5173`

### 4. Player Setup (Raspberry Pi / Local Testing)
```bash
cd player
pip install -r requirements.txt
# Edit config.json with your screen_id and api_url
python ccms_player.py
```

---

## 🌐 Deployment

### Production Architecture (Hetzner + Neon + R2)

```
Internet
    │
    ▼
┌─────────────────────────────────────────────┐
│              HETZNER VPS                    │
│  ┌─────────────────────────────────────┐   │
│  │           NGINX                      │   │
│  │   (SSL + Reverse Proxy)              │   │
│  │   :80/:443                           │   │
│  └──────────┬──────────────┬────────────┘   │
│             │              │                │
│      ┌──────▼──────┐ ┌─────▼─────┐         │
│      │  Frontend   │ │  Backend  │         │
│      │  (React)    │ │  (.NET)   │         │
│      │  :3000      │ │  :5000    │         │
│      └─────────────┘ └─────┬─────┘         │
└────────────────────────────┼───────────────┘
                             │
              ┌──────────────┼──────────────┐
              │              │              │
       ┌──────▼──────┐ ┌─────▼─────┐ ┌──────▼──────┐
       │    Neon     │ │     R2    │ │   AWS SES   │
       │ PostgreSQL  │ │  Storage  │ │   Email     │
       └─────────────┘ └───────────┘ └─────────────┘
```

### Deployment Commands

```powershell
# Setup server (first time)
./deploy-production.ps1 -Command setup

# Deploy application
./deploy-production.ps1 -Command deploy

# Setup SSL
./deploy-production.ps1 -Command ssl

# View logs
./deploy-production.ps1 -Command logs
```

### Environment Variables

```env
# Database
POSTGRES_CONNECTION_STRING=Host=...;Database=pixelspot_ccms;...

# Storage (Cloudflare R2)
R2_ACCOUNT_ID=your_account_id
R2_ACCESS_KEY_ID=your_access_key
R2_SECRET_ACCESS_KEY=your_secret_key
R2_BUCKET_NAME=prod-ccms
R2_PUBLIC_URL=https://pub-xxx.r2.dev

# JWT
JWT_SECRET_KEY=your_64_char_secret

# Email (AWS SES)
AWS_ACCESS_KEY_ID=your_aws_key
AWS_SECRET_ACCESS_KEY=your_aws_secret
AWS_SES_REGION=ap-south-1
AWS_SES_FROM_EMAIL=noreply@pixelspot.in

# SMS (ComBirds - India)
COMBIRDS_API_KEY=your_api_key
COMBIRDS_SENDER_ID=PIXLSP
COMBIRDS_TEMPLATE_ID=your_template_id
```

---

## 📡 API Reference

### Authentication
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/auth/register` | POST | Register new user |
| `/api/auth/login` | POST | Login, get tokens |
| `/api/auth/refresh` | POST | Refresh access token |
| `/api/auth/verify-email` | GET | Verify email |
| `/api/auth/verify-phone` | POST | Verify phone OTP |

### Screens
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/screens` | GET | List all screens |
| `/api/screens/paged` | GET | Paginated screens |
| `/api/screens/{id}` | GET | Screen details |
| `/api/screens` | POST | Create screen |
| `/api/screens/{id}` | PUT | Update screen |
| `/api/screens/{id}` | DELETE | Delete screen |

### Bookings
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/bookings` | GET | List bookings |
| `/api/bookings/paged` | GET | Paginated bookings |
| `/api/bookings/{id}` | GET | Booking details |
| `/api/bookings` | POST | Create booking |
| `/api/bookings/{id}/approve` | POST | Approve booking |
| `/api/bookings/{id}/reject` | POST | Reject booking |
| `/api/bookings/{id}/invoice` | GET | Download PDF invoice |

### Campaigns
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/campaigns` | GET | List campaigns |
| `/api/campaigns/paged` | GET | Paginated campaigns |
| `/api/campaigns/{id}` | GET | Campaign details |
| `/api/campaigns` | POST | Create campaign |
| `/api/creatives` | POST | Upload creative |

### Player
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/player/handshake` | POST | Player authentication |
| `/api/player/playlist/{screenId}` | GET | Get playlist |
| `/api/player/impressions` | POST | Report impressions |

### SignalR Hubs

| Hub | Endpoint | Purpose |
|-----|----------|---------|
| PlaybackHub | `/hubs/playback` | Ad start/complete events |
| PlayerHub | `/hubs/player` | Device management |
| StreamingHub | `/hubs/streaming` | WebRTC signaling |

---

## 🍓 Raspberry Pi Player Setup

### Hardware Requirements
- Raspberry Pi 4 (4GB RAM recommended)
- 32GB+ MicroSD Card
- Stable Internet Connection
- HDMI Display

### Software Setup

```bash
# 1. Install dependencies
sudo apt update && sudo apt upgrade -y
sudo apt install -y mpv python3-pip python3-venv git

# 2. Clone player
git clone https://github.com/your-org/pixelspot-player.git
cd pixelspot-player

# 3. Setup virtual environment
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# 4. Configure player
cp config.example.json config.json
# Edit config.json with your screen_id and api_url

# 5. Run player
python ccms_player.py
```

### Auto-Start on Boot

```bash
# Create systemd service
sudo nano /etc/systemd/system/ccms-player.service

# Add:
[Unit]
Description=CCMS Player
After=network-online.target

[Service]
Type=simple
User=pi
WorkingDirectory=/home/pi/pixelspot-player
ExecStart=/home/pi/pixelspot-player/venv/bin/python ccms_player.py
Restart=always

[Install]
WantedBy=multi-user.target

# Enable service
sudo systemctl enable ccms-player
sudo systemctl start ccms-player
```

### Player Configuration (config.json)

```json
{
  "screen_id": "your-screen-uuid",
  "api_url": "https://api.pixelspot.in",
  "api_key": "your-api-key",
  "cache_dir": "./video_cache",
  "default_video": {
    "url": "https://r2.pixelspot.in/default.mp4",
    "local_path": "./default_video.mp4"
  },
  "sync_interval_minutes": 10,
  "heartbeat_interval_seconds": 30
}
```

### Player Workflow

1. **Startup**: Reads config, initializes MPV
2. **Handshake**: Authenticates with backend, receives playlist
3. **Download**: Caches videos with hash verification
4. **Playback**: Loops through playlist slots (gapless)
5. **Tracking**: Records impressions locally (SQLite)
6. **Sync**: Sends batched impressions every 10 minutes
7. **Operating Hours**: Only plays during configured schedule
8. **Watchdog**: Auto-recovers from crashes

---

## 💰 Pricing & Business Model

### Revenue Model: Hybrid (SaaS + Commission)

```
┌────────────────────────────────────────────────────────────┐
│                    HYBRID MODEL                            │
├────────────────────────────────────────────────────────────┤
│                                                            │
│  SCREEN OWNERS                                             │
│  • Monthly subscription per screen                         │
│  • Commission on each booking                              │
│                                                            │
│  ADVERTISERS                                               │
│  • Pay-per-booking (no subscription)                       │
│  • Optional premium features                               │
│                                                            │
└────────────────────────────────────────────────────────────┘
```

### Screen Owner Pricing (India Market)

| Plan | Monthly Fee | Commission | Features |
|------|-------------|------------|----------|
| **Free Trial** | ₹0 (3 months) | 25% | 1 screen, basic analytics |
| **Starter** | ₹199/screen | 18% | Up to 5 screens |
| **Professional** | ₹149/screen | 12% | 20+ screens, priority support |
| **Enterprise** | Custom | 8% | Unlimited, API access, SLA |

### Advertiser Pricing

| Option | Fee | Benefits |
|--------|-----|----------|
| **Pay-as-you-go** | ₹0 | Standard booking rates |
| **Starter** | ₹999/month | 5% discount on bookings |
| **Growth** | ₹2,999/month | 10% discount, priority access |
| **Enterprise** | ₹9,999/month | 15% discount, auto-approval |

### Suggested Slot Rates (Per 10-minute slot)

| Location Type | Rate Range | Example Daily Revenue |
|---------------|------------|----------------------|
| **Premium** (Malls, Airports) | ₹50-200/slot | ₹7,200/day |
| **High Traffic** (Markets, Colleges) | ₹20-50/slot | ₹2,520/day |
| **Standard** (Retail, Cafes) | ₹5-20/slot | ₹720/day |
| **Low Traffic** (Offices, Gyms) | ₹2-10/slot | ₹360/day |

### Revenue Projections

| Scale | Monthly Bookings | Platform Revenue (20%) | Net Profit |
|-------|------------------|------------------------|------------|
| 10 screens | ₹50,000 | ₹10,000 | ₹6,000 |
| 50 screens | ₹5,00,000 | ₹1,00,000 | ₹85,000 |
| 200 screens | ₹25,00,000 | ₹5,00,000 | ₹4,50,000 |

---

## 💵 Infrastructure Costs

### Monthly Operating Costs

| Service | Free Tier | Small (10 screens) | Medium (50 screens) |
|---------|-----------|-------------------|---------------------|
| **Neon PostgreSQL** | $0 (limited) | $19 | $69 |
| **Cloudflare R2** | $0 (10GB) | $5 | $20 |
| **Hetzner VPS** | - | $6 (CX21) | $30 (CX41) |
| **AWS SES** | $0 (62k/mo) | $2 | $10 |
| **ComBirds SMS** | - | ₹500 (~$6) | ₹3,000 (~$36) |
| **Google Places API** | $200 credit | $10 | $50 |
| **Domain + SSL** | - | $1 | $1 |
| **TOTAL** | ~$0 | **~$50/month** | **~$215/month** |

### One-Time Costs (Per Player)

| Item | Cost |
|------|------|
| Raspberry Pi 4 (4GB) | ~₹5,000 ($60) |
| MicroSD Card (32GB) | ~₹500 ($6) |
| Power Supply | ~₹500 ($6) |
| Case + Heatsink | ~₹500 ($6) |
| **Total per Player** | **~₹6,500 ($80)** |

### Break-Even Analysis

| Model | Monthly Costs | Break-Even Point |
|-------|---------------|------------------|
| Commission Only (20%) | ₹4,000 | ₹20,000 bookings |
| SaaS (₹199/screen) | ₹4,000 | 21 screens |
| Hybrid | ₹4,000 | 10 screens + ₹10,000 bookings |

---

## ⚠️ Current Limitations

### Known Issues

| Issue | Impact | Workaround |
|-------|--------|------------|
| No payment gateway | Can't collect payments | Manual invoicing |
| No booking cancellation | Users can't cancel | Admin manual cancellation |
| No refund mechanism | - | Manual processing |
| Booking end not auto-completed | Stale status | Background job needed |
| No creative preview at resolution | May not match screen | Manual testing |

### Technical Limitations

| Limitation | Details |
|------------|---------|
| Concurrent booking race condition | Potential double-booking on high traffic |
| No API versioning | Breaking changes affect all clients |
| Limited offline support | Frontend requires internet |
| Single region deployment | Latency for distant users |

### Scale Limitations

| Component | Current Limit | Upgrade Path |
|-----------|---------------|--------------|
| Database (Neon Free) | 0.5GB, 191 compute hrs | Upgrade to Launch ($19) |
| Storage (R2 Free) | 10GB | Pay-as-you-go ($0.015/GB) |
| Concurrent WebSockets | ~1,000 | Horizontal scaling |
| Video upload size | 500MB | Configurable |

---

## 🗺 Future Roadmap

### Phase 1: Monetization (Q1 2026)
- [ ] Razorpay Payment Gateway Integration
- [ ] Advertiser Wallet System
- [ ] Screen Owner Payouts
- [ ] GST-Compliant Invoicing
- [ ] Payment History Dashboard

### Phase 2: Advanced Analytics (Q2 2026)
- [ ] Detailed Performance Reports
- [ ] PDF Report Export
- [ ] Hourly Performance Heatmaps
- [ ] Screen Comparison Analytics
- [ ] Campaign ROI Calculator
- [ ] Scheduled Email Reports

### Phase 3: Notification System (Q2 2026)
- [ ] In-App Notification Center
- [ ] Push Notifications (Mobile)
- [ ] Notification Preferences
- [ ] Scheduled Reminders

### Phase 4: AI & Automation (Q3-Q4 2026)
- [ ] AI Content Moderation
- [ ] Dynamic Pricing Engine
- [ ] Smart Auto-Scheduling
- [ ] Trusted Advertiser Auto-Approval
- [ ] Audience Analytics (Camera)

### Phase 5: Enterprise Features (2027)
- [ ] Multi-Tenant White-Label
- [ ] SSO Integration (SAML/OAuth)
- [ ] Mobile Apps (iOS/Android)
- [ ] Programmatic Buying (RTB)
- [ ] API Marketplace

---

## 📊 Feature Completion Status

```
Authentication & Security     ████████████████████ 100%
Screen Management            ████████████████████ 100%
Campaign Management          ████████████████████ 100%
Booking System               ██████████████████░░  92%
Player System                ████████████████████ 100%
Analytics & Impressions      ████████████████░░░░  80%
Real-Time Features           ████████████████████ 100%
Live Streaming               ████████████████████ 100%
Dashboard & UI               ██████████████████░░  92%
Owner Content                ████████████████████ 100%
Payment Integration          ░░░░░░░░░░░░░░░░░░░░   0%
Notifications                ████████░░░░░░░░░░░░  40%
Advanced Analytics           ████░░░░░░░░░░░░░░░░  20%

Overall MVP Completion:      █████████████████░░░  85%
```

---

## 🔐 Test Accounts

| Role | Email | Password |
|------|-------|----------|
| **Admin** | `admin@example.com` | `Password123!` |
| **Screen Owner** | `owner1@example.com` | `Password123!` |
| **Advertiser** | `advertiser1@example.com` | `Password123!` |

---

## 🐛 Troubleshooting

### Backend won't start
```bash
# Check port availability
netstat -ano | findstr :5257

# Rebuild database
dotnet ef database drop -f
dotnet ef database update
```

### Frontend build errors
```bash
rm -rf node_modules package-lock.json
npm install
```

### Player connection issues
```bash
# Test API connectivity
curl http://localhost:5257/api/health

# Verify screen ID in config.json
```

---

## 📄 License

Proprietary Software - All Rights Reserved  
© 2024-2026 PixelSpot Technologies

---

<div align="center">

**PixelSpot CCMS** - *Every Screen, Every Second, Verified*

</div>
