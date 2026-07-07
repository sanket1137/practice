# PixelSpot CCMS — Unified Reference & Operations Guide
## Single Source of Truth for Product, Engineering, and Operations

<div align="center">

![Version](https://img.shields.io/badge/version-2.0.0-blue.svg)
![License](https://img.shields.io/badge/license-Proprietary-red.svg)
![Status](https://img.shields.io/badge/status-Production%20Ready-green.svg)

**Connect Screen Owners with Advertisers • Real-Time Proof of Play • Verified Impressions**

</div>

---

## 📖 Table of Contents

1. [Executive Summary](#-executive-summary)
2. [Business Model & Roles](#-business-model--roles)
3. [Operations Guide](#-operations-guide)
4. [As-Built Tech Stack & Architecture](#-as-built-tech-stack--architecture)
5. [Domain Schema & Entities](#-domain-schema--entities)
6. [Core Application Flows](#-core-application-flows)
7. [Player Ecosystem & Real-Time Channels](#-player-ecosystem--real-time-channels)
8. [UI/UX Design System Rules](#-uiux-design-system-rules)
9. [Developer Quick Start & Deployment](#-developer-quick-start--deployment)

---

## 🎯 Executive Summary

**PixelSpot CCMS** (Content & Campaign Management System) is a Digital Out-of-Home (DOOH) advertising SaaS platform. It acts as a **two-sided marketplace** that connects:
- **Screen Owners (Media/Cms Owners)** — Individuals or businesses with physical digital displays (e.g. shops, malls, offices, lobbies, restaurants) looking to monetize their displays.
- **Advertisers** — Brands, agencies, or local businesses who want to run video/image campaigns on those physical screens.

Traditional DOOH lacks tracking, automated scheduling, and trust. PixelSpot CCMS solves this by providing automated slot bookings, real-time verified playbacks (Proof-of-Play), transparent pricing, and live performance dashboards.

---

## 💰 Business Model & Roles

### Slot-Based Advertising
- **Schedules**: Each screen has **6 ad slots per hour** (10 minutes each).
- **Bookings**: Advertisers book specific slots for a date range.
- **Pricing**: Screen owners set a **price per slot per day**.
- **Commission**: The platform captures a custom commission percentage per screen.

### Revenue & Payout Settlement Flow
```
Advertiser pays ₹X for booking
         │
         ▼
    Razorpay captures payment
         │
         ▼
    Platform holds funds
         │
         ├── Advance payout to Screen Owner (50%) — after booking starts (Admin processes)
         │
         └── Final payout to Screen Owner (remaining) — after booking completes (minus commission)
```

### User Roles
- **Admin**: Manages the marketplace, verifies physical screens, registers machines, processes payouts, resolves disputes, and monitors platform analytics.
- **Screen Owner**: Registers physical screens, uploads fallback videos, configures pricing, manages schedules, self-reserves slots for personal content, and tracks earnings.
- **Advertiser**: Discovers screens via the explorer, uploads ad creatives, configures campaigns, completes payments, and tracks impression metrics.

---

## 📋 Operations Guide

### Screen Owner Operations
1. **Screen Registration**: Input screen name, address, GPS coordinates, resolution, dimensions, timezone, default fallback video, and pricing. This generates a BCrypt-hashed API key for the hardware player.
2. **Availability Calendar**: A day-by-day heatmap showing slot availability (6 slots per hour) where owners can accept bookings or self-reserve slots.
3. **Health Monitor**: Tracks online/offline status, last seen heartbeats, and client versions.
4. **Financials**: Dashboard detailing total earnings, pending payouts, bank details configuration, and PDF invoices (generated via QuestPDF).

### Advertiser Operations
1. **Explore & Filter**: Discover screens using map interfaces, location tags, and pricing parameters.
2. **Campaign Creator**: Group creatives together and set target run dates.
3. **Creative Review**: Upload video/image creatives. Video files undergo metadata checks (dimensions, length, compatibility).
4. **Booking & Wallet**: Select screens, request slots, checkout via Razorpay, and view transaction history.

---

## 🏗️ As-Built Tech Stack & Architecture

The system is fully built and deployed using the following modern stacks:

| Layer | Component details |
|-------|-------------------|
| **Backend Runtime** | **ASP.NET Core 8 + EF Core 8 + MediatR** (built as clean architecture) |
| **Frontend** | **React 19 + TypeScript 5.9 + MUI 7.3.6 + Vite** (SPA dashboard) |
| **Database** | **PostgreSQL (Neon-hosted)** |
| **Real-time Engine** | **SignalR** (ASP.NET Core WebSockets for playback events, commands, WebRTC signaling) |
| **Object Storage** | **Cloudflare R2 + Cloudflare CDN** (distributes ad creatives and default videos) |
| **Server Infrastructure**| **Hetzner VPS + Docker Compose + Nginx** |
| **Player Platforms** | **ChromeOS TypeScript PWA**, **Android Kotlin**, **Raspberry Pi Python** |
| **Onboarding** | **QR-Code based Pairing** using JSON Web Tokens (JWT) |

---

## 🗄️ Domain Schema & Entities

The production database schema consists of these core entities:

- `User`: Base user identity with email, phone, and role.
- `Screen`: Physical screen properties (GPS, operating hours, prices, API key, status).
- `ScreenImage`: Verification photo attachments.
- `ScreenTag` / `ScreenTagAssignment`: Geographic/demographic tags (150+ categories mapped via Google Places API).
- `ScreenVerification`: Admin vetting log.
- `PlayerPairingToken`: JWT pairing credentials used for secure QR onboardings.
- `Campaign`: Advertiser campaign metadata.
- `Booking`: Ties campaigns to screen slots, holding status and aspect ratio transforms.
- `SlotAvailability`: Heatmap tracking allocated/free calendar days.
- `Creative`: Ad asset containing verification statuses, durations, and file paths.
- `Impression` / `ImpressionDailySummary`: Tracked plays mapped via `SlotPlayKey` to deduplicate events.
- `Wallet` / `WalletTransaction`: Balance tracking for payments.
- `Payout` / `BankAccount`: Media owner bank details and withdrawal records.
- `RemoteCommand`: Command queue for realtime screen controls (CMS mode).

---

## 🔄 Core Application Flows

### 1. Authentication Flow
- **Access Tokens**: Short-lived JWT access tokens (15-minute expiry).
- **Refresh Tokens**: Secure sliding-window refresh tokens (7-day expiry).
- **Ownership Verification**: Resource authorization validated server-side on every request.

### 2. Booking & Payment Lifecycle
```
Advertiser requests booking (Pending)
         │
         ▼ (Screen Owner reviews)
┌─────────────────┐             ┌─────────────────┐
│     Approved    │             │    Rejected     │
└────────┬────────┘             └─────────────────┘
         │ (Razorpay OrderCreated)
         │ (24h Payment Window starts)
         ├──────────────────────────────┐
         ▼ (Payment Captured)           ▼ (No Payment / Cancelled)
┌─────────────────┐             ┌─────────────────┐
│     Active      │             │    Cancelled    │
└────────┬────────┘             └─────────────────┘
         │ (End Date reached)
         ▼
┌─────────────────┐
│    Completed    │
└─────────────────┘
```

- **Creative Fit Validation**: When uploading, creatives are checked for duration and size compatibility. Mismatched aspect ratios are assigned a fallback mode:
  - Delta ≤ 5%: `SuggestedFitMode = Fit` (adds letterboxing/pillarboxing)
  - Delta > 5%: `SuggestedFitMode = SmartAdaptive` (adds dynamic blurred backdrop)
  - Fit modes are stored on the booking and handled directly by hardware players.

- **Razorpay Integration & Webhooks**:
  - The payment flow uses per-booking orders created on approval.
  - A background Azure Function (`BookingStatusUpdateService`) runs daily to move approved bookings without payment to `Cancelled`, and active bookings past their end date to `Completed`.
  - Refunds are handled back to the advertiser's origin payment capture account.

---

## 📺 Player Ecosystem & Real-Time Channels

The system supports Raspberry Pi (Python/mpv), Android TV (Kotlin/ExoPlayer), and ChromeOS (PWA) players, maintaining real-time communication through SignalR.

```
┌────────────────────────────────────────────────────────────────────────────┐
│                            ASP.NET Core 8 Backend                           │
│  Controllers (REST) ──┐                                                     │
│                        ├─► Services / MediatR ──► Postgres (Neon)           │
│  SignalR Hubs ────────┘                                                     │
│                                                                             │
│  Hubs: /hubs/playback, /playerhub, /hubs/streaming, /hubs/cms               │
└────────────────────────────────────────────────────────────────────────────┘
        ▲                  ▲                  ▲                ▲
        │ WS (SignalR)     │ REST + SignalR   │ WebRTC + WS    │ REST
        │                  │                  │                │
┌──────────────┐  ┌────────────────┐  ┌──────────────┐  ┌──────────────┐
│  Pi Player   │  │ Android Player │  │ Owner Phone  │  │ Advertiser   │
│  (Python)    │  │  (Kotlin)      │  │ (Dashboard)  │  │ Dashboard    │
└──────────────┘  └────────────────┘  └──────────────┘  └──────────────┘
```

### SignalR Channels
1. **PlaybackHub (`/hubs/playback`)**: Emits playback start/complete telemetry (Proof-of-Play) and heartbeats. Batches plays and updates dashboard statistics in real time.
2. **PlayerHub (`/playerhub`)**: Manages the handshake and sync of playlists. Calculates local timezone offset and clock drift using server time offsets.
3. **StreamingHub (`/hubs/streaming`)**: Orchestrates WebRTC signaling for screen live previewing. Advertisers can stream a live preview of the physical screen during or 24 hours prior to a booking. Kicks out unauthorized streams via `AccessRevocationBackgroundService`.
4. **CmsControlHub (`/hubs/cms`)**: Relays remote control commands (reboots, screenshot commands, manual updates) in CMS mode.

### Hardware Pairing & Screen Verification Flows
1. **QR Pairing Flow (CCMS Onboarding)**:
   - The unconfigured player boots up and displays a unique setup QR code containing a secure pairing token.
   - The Screen Owner scans the QR code using their authenticated mobile dashboard, mapping the player to their screen.
2. **Physical Screen Verification Flow (Admin)**:
   - To prevent fraudulent location listings, an admin visits the screen physically.
   - The admin scans the screen's operational verification QR. The server captures the GPS coordinates from the admin's device, matching it against the screen's registered coordinates.

---

## 🎨 UI/UX Design System Rules

PixelSpot follows Apple-inspired layout rules, favoring clarity, high readability, and clean visual structure.

### 1. Color System
- **Backgrounds**: `--bg-primary` (`#FFFFFF` light / `#0A0A0A` dark), `--bg-secondary` (`#F5F5F7` / `#111111`).
- **Typography**: `--text-primary` (`#1D1D1F` / `#F5F5F7`), `--text-secondary` (`#6E6E73` / `#A1A1A6`).
- **Accents**: Blue (`#0071E3`), Green (`#30D158`), Purple (`#BF5AF2` for CCMS).
- **Rule**: Accent/status colors must cover no more than 10% of any screen surface area. Dark Mode is mandatory for hardware Player UIs.

### 2. Typography
- **Primary Font**: `Inter` (variable sans-serif) for clean rendering at small sizes.
- **Monospace**: `SF Mono` / `JetBrains Mono` for IDs, keys, hashes, and code blocks.
- **Rule**: Never use more than 3 font sizes per layout. Bold weight is reserved exclusively for structural hierarchy.

---

## 🚀 Developer Quick Start & Deployment

### Local Configuration
1. Clone the project and initialize `.env` files in root, `frontend`, and `backend/CCMS.Api` directories using the `.env.example` templates.
2. Run PostgreSQL and start Azurite for local blob emulation.
3. **Run C# Backend**:
   ```bash
   cd backend
   dotnet restore
   dotnet run --project CCMS.Api
   ```
4. **Run React Frontend**:
   ```bash
   cd frontend
   npm install
   npm run dev
   ```

### Hardware Player Onboarding
- **Raspberry Pi Player (Python)**:
  - Requires `python3`, `mpv` library binaries, and standard packages.
  - Setup script: `cd player/raspberrypi && ./setup-raspberry-pi.sh`
- **Android Player (Kotlin)**:
  - Open `player/android` in Android Studio, sync Gradle, and install it on an Android TV device.

### Production Deployment
- Deployed on Hetzner VPS using Docker Compose and Nginx.
- Production configuration parameters are loaded via env vars. To launch production services:
  ```bash
  docker-compose -f docker-compose.production.yml up --build -d
  ```
