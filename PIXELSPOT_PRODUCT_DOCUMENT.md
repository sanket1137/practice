# PixelSpot - Digital Signage Revolution
## Complete Product Document

---

# 📖 Table of Contents

1. [Executive Summary](#executive-summary)
2. [Product Vision](#product-vision)
3. [Current Features](#current-features)
4. [Use Cases](#use-cases)
5. [User Journeys](#user-journeys)
6. [Technical Architecture](#technical-architecture)
7. [Future Roadmap](#future-roadmap)
8. [Industry Revolution Plan](#industry-revolution-plan)
9. [Competitive Advantage](#competitive-advantage)

---

# 🎯 Executive Summary

**PixelSpot** is a comprehensive **Digital Out-of-Home (DOOH) advertising platform** that connects screen owners with advertisers through an intelligent, real-time content management system. The platform enables transparent, verified ad placements with proof-of-play technology using Raspberry Pi-powered digital signage players.

### The Problem We Solve

Traditional outdoor advertising suffers from:
- **No proof of play** - Advertisers can't verify if their ads actually ran
- **Manual scheduling** - Time-consuming, error-prone slot management
- **No real-time data** - Delayed or no impression reporting
- **Fragmented market** - No central marketplace for screen owners and advertisers
- **Trust deficit** - No verification of ad delivery

### Our Solution

PixelSpot provides:
- ✅ **Real-time proof of play** with verified impressions
- ✅ **Automated slot management** with intelligent scheduling
- ✅ **Live dashboard** showing exactly when and where ads play
- ✅ **Unified marketplace** connecting screen owners and advertisers
- ✅ **Transparent reporting** with tamper-proof impression data

---

# 🌟 Product Vision

> **"Democratize digital advertising by making every screen an opportunity and every impression verifiable."**

### Mission Statement
To create the most transparent, efficient, and accessible digital out-of-home advertising ecosystem where:
- **Small businesses** can advertise on premium screens affordably
- **Screen owners** can monetize any display effortlessly
- **Advertisers** only pay for verified impressions
- **Everyone** benefits from real-time data and automation

---

# ✅ Current Features

## 1. Multi-Role User System

### 👤 User Roles

| Role | Description | Capabilities |
|------|-------------|--------------|
| **Screen Owner** | Owns/manages digital displays | Add screens, approve bookings, monitor playback, manage content |
| **Advertiser** | Brands wanting to advertise | Create campaigns, upload creatives, book screens, track impressions |
| **Admin** | Platform administrator | Full access, user management, system configuration |

### Authentication & Security
- JWT-based authentication with refresh tokens
- Email verification for new accounts
- Phone OTP verification (Indian mobile numbers)
- Role-based access control (RBAC)
- Secure API key system for player devices
- BCrypt password hashing

---

## 2. Screen Management

### Screen Registration
- **Location data**: Address, city, state, country, coordinates
- **Operating hours**: Configurable per day (e.g., 09:00-21:00)
- **Timezone support**: Automatic timezone handling (IST, UTC, etc.)
- **Pricing**: Per-slot pricing in multiple currencies (INR, USD, EUR)
- **Specifications**: Resolution, orientation, display size

### Screen Types Supported
- Indoor digital displays
- Outdoor LED billboards
- Retail store screens
- Restaurant menu boards
- Waiting room displays
- Transit station screens
- Shopping mall directories

### Screen Status Tracking
- **Online/Offline** detection (30-second heartbeat)
- **Last seen** timestamp
- **Player health** monitoring
- **Connection quality** indicators

---

## 3. Campaign & Creative Management

### Campaign Features
- Campaign name, description, objectives
- Start and end dates (or indefinite)
- Budget allocation
- Multi-currency support
- Campaign status tracking (Draft, Active, Paused, Completed)

### Creative Management
- **Video upload** (MP4, WebM, MOV)
- **Image upload** (JPG, PNG, WebP)
- **Size limits**: Configurable max file size
- **Resolution validation**: Match screen requirements
- **Preview functionality**: See how ads will appear
- **Hash verification**: Ensure file integrity on players

---

## 4. Booking System

### Slot-Based Booking
- **6 slots per hour** (10-minute rotations)
- **Slot selection**: Choose specific slots (1-6) or all
- **Date range**: Book for specific periods
- **Availability checking**: Real-time slot availability
- **Price calculation**: Automatic based on slots × days × rate

### Booking Workflow
```
Advertiser Creates Booking Request
        ↓
    Status: PENDING
        ↓
Screen Owner Reviews
        ↓
    ┌─────────┴─────────┐
    ↓                   ↓
APPROVED            REJECTED
    ↓                   ↓
Appears in       Advertiser
Playlist         Notified
```

### Booking Validations
- Campaign date range enforcement
- Currency matching (campaign ↔ screen)
- Slot availability verification
- Operating hours compliance
- Budget limit checking

---

## 5. Raspberry Pi Player System

### Player Features
- **Gapless video playback** using MPV/VLC
- **Local video caching** with hash verification
- **Automatic playlist sync** via SignalR
- **Default video fallback** for empty slots
- **Operating hours enforcement**
- **Offline queue** for impression data

### Player Security
- API key authentication
- Device fingerprinting
- Secure handshake protocol
- Bound device verification
- Nonce-based replay protection

### Player Communication
- **SignalR WebSocket** for real-time updates
- **REST API** for playlist fetch
- **Heartbeat** every 30 seconds
- **Sync** every 10 minutes

---

## 6. Real-Time Dashboard

### SignalR Events
| Event | Description |
|-------|-------------|
| `AdStarted` | Video playback started |
| `AdCompleted` | Video playback finished |
| `PlaybackState` | Current playing content |
| `PlayerOnline` | Player connected |
| `PlayerOffline` | Player disconnected |
| `PlaylistUpdated` | New playlist available |

### Live Monitoring
- Current playing content
- Today's impression count
- Screen online status
- Real-time play counter

---

## 7. Analytics & Impressions

### Impression Tracking
- **Deduplication**: SlotPlayKey prevents duplicate counting
- **Verification hash**: Tamper-proof impression records
- **Batched sync**: 10-minute intervals for efficiency
- **Offline support**: SQLite queue when disconnected

### Metrics Available
- Total impressions per campaign
- Impressions per screen
- Daily/weekly/monthly trends
- Play verification rate
- Screen uptime percentage

---

## 8. Owner Content Management

### Custom Content Slots
- Screen owners can push their own content
- Fill empty slots with owner videos
- Default video for unbooked slots
- Priority content override

---

# 📋 Use Cases

## Use Case 1: Restaurant Chain Advertising

### Scenario
A restaurant chain wants to advertise lunch specials on screens near office buildings.

### Flow
1. Restaurant creates advertiser account
2. Uploads video creative (30-second lunch promo)
3. Searches screens near business districts
4. Books slots 11:00-14:00 on 10 screens
5. Screen owners approve bookings
6. Ads play during lunch hours
7. Restaurant sees real-time impressions
8. Pays only for verified plays

### Value Delivered
- Targeted time slots (lunch hours)
- Geographic targeting (office areas)
- Verified impressions
- Transparent pricing

---

## Use Case 2: Mall Screen Monetization

### Scenario
A shopping mall wants to monetize their 20 digital displays.

### Flow
1. Mall registers as screen owner
2. Adds 20 screens with locations and pricing
3. Sets operating hours (10:00-22:00)
4. Advertisers discover screens on marketplace
5. Mall reviews and approves bookings
6. Raspberry Pi players display ads
7. Mall tracks earnings per screen
8. Receives verified play reports

### Value Delivered
- New revenue stream
- Automated management
- Professional advertiser network
- Detailed analytics

---

## Use Case 3: Local Business Promotion

### Scenario
A local gym wants to advertise in their neighborhood.

### Flow
1. Gym creates campaign with ₹5,000 budget
2. Searches screens within 2km radius
3. Books affordable slots on 3 nearby screens
4. Uploads promotional video
5. Tracks impressions in real-time
6. Adjusts campaign based on performance

### Value Delivered
- Affordable local advertising
- Geographic targeting
- Real-time optimization
- Transparent costs

---

## Use Case 4: Event Promotion

### Scenario
A concert organizer needs to promote an upcoming event.

### Flow
1. Creates time-bound campaign (2 weeks)
2. Books premium slots across city
3. Uploads countdown-style creative
4. Monitors impression build-up
5. Adjusts slots based on performance
6. Sees spike in ticket sales

### Value Delivered
- Time-sensitive advertising
- Wide reach
- Performance correlation
- Proof of advertising impact

---

## Use Case 5: Corporate Office Displays

### Scenario
A corporation wants to use their lobby screens for both internal communication and ad revenue.

### Flow
1. Registers lobby screens
2. Sets owner content for company updates
3. Sells remaining slots to advertisers
4. B2B advertisers book slots
5. Mix of corporate and ads plays
6. Generates revenue from excess capacity

### Value Delivered
- Dual-purpose screens
- Revenue from idle time
- Professional ad quality
- Automated scheduling

---

# 🚶 User Journeys

## Advertiser Journey

```
Register Account
     ↓
Verify Email & Phone
     ↓
Create Campaign
     ↓
Upload Creative
     ↓
Browse Available Screens
     ↓
Book Slots
     ↓
Wait for Approval
     ↓
Monitor Live Playback
     ↓
View Impression Reports
     ↓
Pay for Verified Plays
```

## Screen Owner Journey

```
Register Account
     ↓
Add Screen Details
     ↓
Configure Player
     ↓
Set Pricing & Hours
     ↓
Receive Booking Requests
     ↓
Review & Approve
     ↓
Monitor Playback
     ↓
Track Earnings
     ↓
Receive Payments
```

## Player Device Journey

```
Power On
     ↓
Load Configuration
     ↓
Handshake with Server
     ↓
Download Playlist
     ↓
Cache Videos
     ↓
Start Playback Loop
     ↓
Send Heartbeats
     ↓
Record Impressions
     ↓
Sync Data
```

---

# 🏗️ Technical Architecture

## System Components

```
┌─────────────────────────────────────────────────────────────────┐
│                         FRONTEND                                 │
│            React + TypeScript + Material UI                      │
│         (Dashboard, Booking UI, Live Monitor)                    │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                         BACKEND API                              │
│              ASP.NET Core 8 + SignalR                           │
│    (REST APIs, WebSocket Hub, Business Logic)                   │
└─────────────────────────────────────────────────────────────────┘
                              │
            ┌─────────────────┼─────────────────┐
            ▼                 ▼                 ▼
┌───────────────────┐ ┌──────────────┐ ┌───────────────────┐
│    PostgreSQL     │ │ Cloudflare   │ │   Raspberry Pi    │
│   (Neon Cloud)    │ │   R2 Storage │ │     Players       │
│  (Data + Schema)  │ │  (Videos)    │ │ (Playback Engine) │
└───────────────────┘ └──────────────┘ └───────────────────┘
```

## Tech Stack Summary

| Layer | Technology |
|-------|------------|
| Frontend | React 18, TypeScript, Material UI, Vite |
| Backend | ASP.NET Core 8, MediatR (CQRS), SignalR |
| Database | PostgreSQL (Neon Cloud) |
| Storage | Cloudflare R2 (S3-compatible) |
| Player | Python 3.9+, MPV/VLC, SQLite |
| Real-time | SignalR WebSockets |
| Auth | JWT + Refresh Tokens |

---

# 🚀 Future Roadmap

## Phase 1: Foundation Enhancement (Q1 2026)

### 1.1 Payment Integration
- [ ] Razorpay/Stripe integration
- [ ] Wallet system for advertisers
- [ ] Automated screen owner payouts
- [ ] Invoice generation
- [ ] GST compliance

### 1.2 Advanced Analytics
- [ ] Hourly/daily/weekly heatmaps
- [ ] Screen performance comparison
- [ ] Campaign ROI calculator
- [ ] PDF report export
- [ ] Email scheduled reports

### 1.3 Notification System
- [ ] Email notifications (booking status)
- [ ] SMS alerts (critical events)
- [ ] In-app notifications
- [ ] Push notifications (mobile)

---

## Phase 2: Intelligence Layer (Q2-Q3 2026)

### 2.1 AI Content Moderation
- [ ] Automatic creative review
- [ ] Inappropriate content detection
- [ ] Brand safety scoring
- [ ] Auto-approval for trusted advertisers

### 2.2 Dynamic Pricing Engine
- [ ] Demand-based pricing
- [ ] Peak hour premiums
- [ ] Last-minute discounts
- [ ] Seasonal adjustments
- [ ] Location-based pricing tiers

### 2.3 Programmatic Buying
- [ ] Real-time bidding (RTB) API
- [ ] DSP integration
- [ ] Automated slot purchasing
- [ ] Budget optimization algorithms

---

## Phase 3: Scale & Expansion (Q4 2026 - 2027)

### 3.1 Audience Analytics
- [ ] Camera-based people counting
- [ ] Demographic estimation (age, gender)
- [ ] Attention time measurement
- [ ] Audience composition reports
- [ ] Privacy-compliant analytics

### 3.2 Multi-Platform Expansion
- [ ] iOS mobile app
- [ ] Android mobile app
- [ ] Tablet-optimized dashboard
- [ ] Apple TV player app
- [ ] Android TV player app

### 3.3 Enterprise Features
- [ ] White-label deployments
- [ ] Multi-tenant architecture
- [ ] Custom branding
- [ ] SSO integration (SAML/OAuth)
- [ ] API for third-party integrations

### 3.4 Global Expansion
- [ ] Multi-language support
- [ ] Multi-currency support
- [ ] Regional compliance (GDPR, etc.)
- [ ] CDN-based video delivery
- [ ] Regional data centers

---

# 🌍 Industry Revolution Plan

## How PixelSpot Will Transform DOOH Advertising

### 1. **Democratization of Advertising**

**Current State**: Large billboards require minimum ₹50,000+ budgets, excluding small businesses.

**PixelSpot Revolution**:
- Book single slots for as low as ₹100
- Pay per verified play, not estimated reach
- Small businesses can afford premium locations
- Flexible budgets for any business size

### 2. **Transparency Through Verification**

**Current State**: "Trust us, your ad played" - no proof.

**PixelSpot Revolution**:
- Every play cryptographically verified
- Real-time playback monitoring
- Tamper-proof impression records
- Dispute resolution with play logs

### 3. **Screen Owner Empowerment**

**Current State**: Complex agency relationships, delayed payments.

**PixelSpot Revolution**:
- Direct marketplace access
- Instant booking notifications
- Automated scheduling
- Transparent earnings dashboard
- Quick payouts

### 4. **Data-Driven Decisions**

**Current State**: "We estimate 10,000 daily viewers" - pure guesswork.

**PixelSpot Revolution**:
- Exact play counts
- Time-of-day performance
- Screen comparison analytics
- Campaign optimization insights
- A/B testing capability

### 5. **Market Efficiency**

**Current State**: Months to negotiate, manual contracts, slow approvals.

**PixelSpot Revolution**:
- Book in minutes
- Instant availability check
- Digital approvals
- Automated invoicing
- Quick campaign launch

---

## Disruption Strategy

### Phase 1: Market Entry
- Focus on tier-1 cities (Mumbai, Delhi, Bangalore)
- Target 1,000 screens in Year 1
- Free platform for screen owners
- Competitive commission rates

### Phase 2: Network Effect
- More screens attract more advertisers
- More advertisers attract more screens
- Premium features for power users
- Self-service booking for small advertisers

### Phase 3: Platform Dominance
- Become the "Booking.com of DOOH"
- API ecosystem for agencies
- Programmatic integration
- International expansion

---

# 🏆 Competitive Advantage

## Why PixelSpot Wins

| Factor | Traditional DOOH | PixelSpot |
|--------|------------------|-----------|
| Minimum Budget | ₹50,000+ | ₹100 |
| Booking Time | Weeks | Minutes |
| Proof of Play | None | Real-time |
| Targeting | Limited | Precise |
| Payment | Monthly invoices | Pay-per-play |
| Analytics | Basic | Comprehensive |
| Technology | Outdated | Modern cloud |

## Key Differentiators

1. **Real-Time Verification**: Only platform with cryptographic proof-of-play
2. **Micro-Transactions**: Enable small budget advertising
3. **Self-Service**: No agency needed, fully automated
4. **Open Marketplace**: Any screen owner can join
5. **Developer-Friendly**: API for integrations

---

# 📞 Contact & Next Steps

## For Screen Owners
Ready to monetize your displays? Register at [app.pixelspot.in](http://localhost:5173)

## For Advertisers
Want verified impressions? Create your campaign today.

## For Developers
Integration API documentation available upon request.

---

**PixelSpot - Every Screen, Every Second, Verified.**

*Document Version: 1.0*
*Last Updated: January 2026*
