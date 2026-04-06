# PixelSpot CCMS — Building a DOOH Advertising Platform from Scratch

> A blog series documenting the journey of building PixelSpot CCMS — a Digital Out-of-Home (DOOH) advertising SaaS platform. From concept to production, every feature, every real problem, and every solution.

**Production:** [https://ccms.pixelspot.in](https://ccms.pixelspot.in)

---

## Blog 1: Introduction — The Problem with Digital Out-of-Home Advertising

**Published:** Series Introduction

### The Problem

The global Digital Out-of-Home (DOOH) advertising market is worth over $100 billion, yet it's plagued by problems that haven't changed in decades:

- **No proof of play** — Advertisers pay for ad slots but have zero proof their ad actually displayed on a physical screen. It's a trust-based system and trust is expensive.
- **Manual coordination** — Booking a billboard or shop screen involves phone calls, emails, Excel sheets, and handshake deals. Scheduling is a nightmare.
- **Fragmented market** — Screen owners (shops, malls, lobbies) have idle screens generating zero revenue. Advertisers can't discover them.
- **No audience data** — Traditional DOOH has no concept of demographics. A screen in a tech park gets the same treatment as one near a school.
- **Delayed reporting** — Campaign reports arrive days or weeks later. Real-time feedback? Forget it.
- **Manual scheduling** — Content is loaded via USB drives. A human physically visits the screen to update ads.

### What We're Building

**PixelSpot CCMS** — a two-sided SaaS marketplace that connects:

| Side | Who | What They Do |
|------|-----|-------------|
| **Supply** | Screen Owners | Register physical digital displays (shop screens, mall boards, lobby screens, restaurant TVs) and monetize idle screen time |
| **Demand** | Advertisers | Run targeted ad campaigns on discovered screens through slot-based bookings |
| **Platform** | Admin | Manage marketplace health — verify screens, process payouts, resolve disputes |

### The Core Innovation: Slot-Based Architecture

Every screen operates on a simple time-division model:

- **6 ad slots per hour** (10 minutes each)
- Advertisers book **date ranges** (e.g., March 20 – April 5, Slot 3)
- Pricing is configurable: per-screen, per-slot, per-day
- Each slot is a guaranteed, exclusive 10-minute window

This means a single screen can generate revenue from up to 6 different advertisers simultaneously, every hour of every day.

### The Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19 + TypeScript + Vite + MUI 7 |
| Backend | ASP.NET Core 8 + Entity Framework Core 8 + MediatR (CQRS) |
| Database | PostgreSQL (Neon) |
| Real-Time | SignalR (WebSocket hubs) |
| Payments | Razorpay (UPI + Bank Transfer) |
| Storage | Cloudflare R2 (videos/images) |
| Player Devices | Raspberry Pi (Python + MPV), Android TV (Kotlin + ExoPlayer), ChromeOS (TypeScript PWA) |
| Infrastructure | Docker Compose + Nginx on Hetzner VPS |
| Background Jobs | Azure Functions |

### What's Coming in This Series

Each blog post documents a specific feature area — the problem it solves, what we built, and the real production problems we encountered and fixed:

1. **Blog 1** — Introduction (this post)
2. **Blog 2** — Authentication & Security (JWT, device fingerprinting, multi-role access)
3. **Blog 3** — Screen Management & Intelligent Tagging (6-phase demographic pipeline)
4. **Blog 4** — Campaign, Creative & Booking System (slot-based marketplace)
5. **Blog 5** — Payment System Rewrite (wallet → per-booking Razorpay)
6. **Blog 6** — Raspberry Pi Player (gapless playback, offline impressions)
7. **Blog 7** — Android TV Player (ExoPlayer, foreground service)
8. **Blog 8** — Real-Time System (SignalR, WebRTC live streaming)
9. **Blog 9** — Analytics, Impressions & Payout Settlement
10. **Blog 10** — Screen Discovery Map & Tag-Based Search
11. **Blog 11** — ChromeOS PWA Player (production bugs and fixes)
12. **Blog 12** — Future Roadmap

**CTO Technical Deep Dives:**

13. **Blog 13** — Database Migration: SQL Server → PostgreSQL Mid-Flight
14. **Blog 14** — The R2 Subdomain Incident (why you never hardcode CDN URLs)
15. **Blog 15** — Preventing Timing Attacks on Player Authentication
16. **Blog 16** — How a NaN Crashed Our Server (the SetSyncMode flood)
17. **Blog 17** — Admin Payout Security with Machine Fingerprinting
18. **Blog 18** — DeviceOverride State Loss and the ConcurrentDictionary Trap
19. **Blog 19** — Deploying to a Hetzner VPS with Zero Downtime
20. **Blog 20** — The Impression Deduplication Problem
21. **Blog 21** — Nginx Rate Limiting That Saved Us

---

## Blog 2: Authentication & Security — Multi-Tenant Access for a DOOH Platform

**Published:** Authentication System

### The Problem

A DOOH marketplace has three completely different user types with different security requirements:

- **Screen Owners** need to manage physical displays and approve/reject bookings
- **Advertisers** need to create campaigns and make payments
- **Admin** needs full platform control including payout processing
- **Player devices** (Raspberry Pi, Android TV, ChromeOS) need machine-level authentication — no human login

Each role accesses different data, performs different actions, and has different security needs. Player devices are physically deployed in public locations and can be tampered with.

### What We Built

#### JWT Token System
- **Access tokens:** 15-minute expiry (short-lived for security)
- **Refresh tokens:** 7-day sliding window expiry (auto-rotated on each refresh)
- Every protected endpoint requires `[Authorize]` attribute
- Resource ownership validated server-side — we never trust client-provided IDs

#### Registration + Verification Flow
1. Email + password signup → BCrypt password hashing
2. Email verification link sent via AWS SES
3. Phone OTP verification via ComBirds (India-specific)
4. Account activated only after both verifications pass

#### Forgot/Reset Password Flow
1. User enters email → reset link sent via AWS SES
2. Link valid for 1 hour (cryptographically signed token)
3. New password set → **all existing refresh tokens invalidated** (security measure)
4. User must re-login on all devices

#### Player Device Authentication (Different Protocol)
Player devices don't use JWT. They use a machine-level API key system:

- Each screen gets a unique API key at creation (stored BCrypt-hashed server-side)
- Player sends `Screen ID + raw API key` → Backend verifies against BCrypt hash
- First successful handshake → device fingerprint recorded (hardware binding)
- Subsequent handshakes must match fingerprint (prevents key theft)
- 24-hour session tokens issued after handshake

#### Role-Based Access Control
```
Admin         → Full system access (payouts, verification, user management)
ScreenOwner   → Own screens + booking approvals + revenue
Advertiser    → Campaigns + bookings + payments
Player        → API key auth only (no JWT)
```

### Real Problem Solved: Device Fingerprint Mismatch

**The Bug:** A screen owner re-flashed their Raspberry Pi's SD card (common maintenance). After re-flash, the device fingerprint changed. The player's handshake started returning 401 Unauthorized even with the correct API key.

**Root Cause:** The device fingerprint was bound on first handshake and never updated. A hardware change (new SD card, new OS install) generated a different fingerprint.

**The Fix:** Added an admin endpoint to clear a screen's stored device fingerprint. On next handshake, the new fingerprint is recorded. The screen owner doesn't need a new API key — just a fingerprint reset.

### Security Measures
- Rate limiting on all auth endpoints (login, register, OTP resend)
- CORS whitelist is explicit — never `*` in production
- HTTPS enforced — HTTP redirects to HTTPS
- Secrets in environment variables — zero secrets in source code
- Razorpay webhook signatures verified with HMAC-SHA256

---

## Blog 3: Screen Management & Intelligent Tagging — 100+ Demographic Tags from Geography

**Published:** Screen Management

### The Problem

When an advertiser wants to run a campaign, they don't think in terms of GPS coordinates. They think:

- *"I want to reach **young professionals** near **metro stations** during **morning rush hour**"*
- *"Show my ad near **foodie zones** and **cafes** frequented by **college students**"*
- *"Target **family audiences** in **residential neighborhoods** near **schools**"*

But all we have is a latitude/longitude pair and a screen name. How do you derive "young professionals near metro stations" from `(12.9716, 77.5946)`?

### What We Built: 6-Phase Demographic Tagging Pipeline

Every screen registered on PixelSpot automatically gets 100+ demographic and psychographic tags derived entirely from its geographic location.

#### Phase 1: Multi-Radius POI Search
We query Google Maps Places API at **5 concentric radii** around the screen:

| Zone | Radius | Weight | Rationale |
|------|--------|--------|-----------|
| Immediate | 0–250m | 1.0 | Direct pedestrian view |
| Near | 250–500m | 0.7 | Walking distance |
| Moderate | 500–750m | 0.5 | Short walk |
| Extended | 750–1000m | 0.3 | General vicinity |
| Catchment | 1–2km | 0.15 | Broader context |

Up to 100 POI results are collected across all zones — restaurants, cafes, metro stations, schools, hospitals, gyms, hotels, parks, malls, banks, bars, coworking spaces, and more.

#### Phase 2: POI Data Extraction
For each POI: name, types, distance (Haversine formula), Google rating, user rating count, price level, business status. Closed businesses are filtered out.

#### Phase 3: Proximity-Based Tags
Single significant POI triggers a tag:
- Metro station ≤500m → `metro_station_proximity`, `daily_commuters`, `morning_commuter_zone`
- Hospital ≤1km → `hospital_proximity`
- School ≤500m → `school_zone`

#### Phase 4: Density-Based Tags
Count POIs by type → apply density thresholds:
- 1–4 restaurants in 500m → `restaurants_nearby`
- 5–14 restaurants → `restaurant_cluster`
- 15+ restaurants → `foodie_zone`

Applied across: restaurants, cafes, gyms, banks, bars, shops, hotels.

#### Phase 5: Weighted Scoring
```
Score = Base(100) × Distance Weight × Quality Multiplier

Quality Multiplier (by Google rating):
  4.5+  → 1.2x    4.0–4.4 → 1.0x
  3.5–3.9 → 0.8x   <3.5 → 0.6x
```

Example: 3 restaurants near a screen
- Fine dining @ 200m, rating 4.6 → 100 × 1.0 × 1.2 = **120**
- Cafe @ 450m, rating 4.1 → 100 × 0.7 × 1.0 = **70**
- Fast food @ 800m, rating 3.8 → 100 × 0.3 × 0.8 = **24**
- **Total: 214** → Threshold 200 met → `foodie_zone` tag applied

#### Phase 6: Composite & Audience Tags
Multi-factor conditions produce high-value targeting tags:

- **`tech_startup_ecosystem`** = IT park ≤1km + cafes ≥3 within 500m + university ≤2km + modern restaurants ≥5 within 1km
- **`family_friendly_zone`** = schools ≥2 within 500m + parks ≥1 + family restaurants ≥3 + supermarkets ≥1
- **`luxury_lifestyle_zone`** = luxury hotels ≥1 + fine dining ≥3 + designer stores ≥2 + spas ≥1

**Audience Profile Tags** derived from primary tags:
- `young_professionals` → corporate_zone + metro_proximity + lunch_restaurants
- `student_audience` → university + cafes + affordable_dining
- `family_audience` → schools + parks + family_restaurants
- `health_enthusiasts` → gyms + yoga + health food stores

**Time-Based Tags** derived from peak hour patterns:
- `morning_rush_zone` → Metro + offices (7–10 AM)
- `lunch_hour_zone` → Corporate zone + 10+ restaurants (12–2 PM)
- `evening_rush_zone` → Metro + residential (5–8 PM)
- `night_active_zone` → Bars ≥3 or nightclubs ≥1 (9 PM–2 AM)

### Real Problem Solved: QR Screen Verification

**The Problem:** How do you verify that a registered screen actually exists at the claimed location? Anyone could register a fake screen at a premium location.

**The Solution:** QR-based physical verification flow:
1. Screen displays a QR code (valid for 4 minutes)
2. Admin physically visits location and scans QR code
3. QR contains a challenge token → sent to backend
4. Backend verifies: token valid, not expired, matches screen
5. Admin's machine fingerprint recorded (authorized device)
6. Screen status: `Pending → Verified`

If verification expires or fails, the screen cannot receive bookings.

### Re-Tagging Schedule
- **Quarterly** (90-day intervals): Full re-scan of all screens
- **On-demand:** Screen owner requests refresh
- **Event-triggered:** Major POI changes (±20% count) → auto-update

---

## Blog 4: Campaign, Creative & Booking System — The Slot-Based Marketplace

**Published:** Core Marketplace

### The Problem

Three things need to work together seamlessly:
1. **Campaigns** — Advertisers group their ads under campaigns (like folders)
2. **Creatives** — The actual video/image files that play on screens
3. **Bookings** — The connection between a creative and a specific screen slot on specific dates

The booking lifecycle is the most complex part — it involves availability checking, approval workflows, payment triggers, slot reservations, and status cascading across multiple entities.

### What We Built

#### Campaign Management
- Advertisers create campaigns with: name, description, date range, budget (informational)
- Status lifecycle: `Draft → Active → Completed → Archived`
- A campaign can have multiple creatives and multiple bookings

#### Creative Upload Pipeline
1. **Client-side validation** — File type (MP4, JPEG, PNG only), max 100MB, dimension check
2. **Server-side validation** — MIME type verified server-side (never trust Content-Type header)
3. **Cloudflare R2 upload** — Random GUID filename (never user-provided names, prevents path traversal)
4. **Metadata extraction** — Duration, dimensions, FPS for videos; dimensions/format for images
5. **SHA-256 hashing** — Deduplication check
6. **Thumbnail generation** — Auto-generated from frame at 1 second (videos) or used as-is (images)

**Creative Lock Mechanism:** When a booking is approved, the associated creative is locked — it cannot be deleted while the booking is active. This prevents the nightmare scenario of a creative being deleted mid-campaign, leaving a blank screen and lost impressions.

#### Booking Lifecycle

```
Advertiser creates booking → Pending
                                ↓
           Screen Owner reviews booking
              ├→ Approve → Approved (Razorpay order created, 24h payment window)
              │     ├→ Payment captured → Active (when start date reached)
              │     │     └→ End date passed → Completed
              │     └→ 24h timeout → Expired/Cancelled
              │
              └→ Reject → Rejected (with reason)

Either party can Cancel at any point → Cancelled (refund if paid)
```

#### Slot Availability Engine
- Each screen has a `SlotAvailability` table: one entry per slot per date
- 6 slots per date, each capacity = 1 (exclusive)
- Slot calendar API: `GET /api/screens/{id}/slot-calendar?startDate=X&endDate=Y`
- Returns a date × slot grid showing booked/available status
- When booking approved: slots **reserved** (prevents double-booking)
- When booking cancelled/rejected: slots **released**

#### Expected Impressions Calculation
```
ExpectedImpressions = SlotCount × DayCount × (600 seconds ÷ CreativeDuration)

Example: Slot 3, March 20–22 (3 days), 30-second video
= 1 × 3 × (600 ÷ 30) = 60 expected plays
```

This pre-calculated number is used later for delivery rate comparisons in the payout settlement.

### Real Problem Solved: Overbooking Prevention

**The Problem:** Two advertisers submit bookings for the same slot on the same dates. Both are "Pending". Screen owner approves both. Now the same slot has two ads — one of them will never play.

**The Fix:** Slot reservation happens atomically at approval time. The `ApproveBookingCommandHandler` checks slot availability within a database transaction. If the slot was already reserved by another approval that happened moments earlier, the second approval is rejected with a `409 Conflict` response.

---

## Blog 5: Payment System Rewrite — From Wallet to Per-Booking Razorpay

**Published:** Payment Architecture

### The Problem

Our original payment system used a **wallet model**: advertisers pre-loaded their wallet with funds, and when a booking was approved, money was auto-debited. It seemed clean in theory.

**Why it failed:**
- **Locked capital:** Sporadic advertisers (who book once a month) had ₹10,000 sitting in a wallet doing nothing
- **Wallet management overhead:** Top-ups, disputes, and refunds became complex
- **Trust issues:** "Where is my money?" was a real support ticket category
- **B2B friction:** Enterprise advertisers couldn't justify pre-loading a wallet — they needed per-transaction invoices

### What We Built: Per-Booking Razorpay Orders

Complete rewrite. Every booking approval creates an independent Razorpay order with a 24-hour payment window.

#### The New Payment Flow

**Step 1: Booking Approved → Razorpay Order Created**
- Screen owner clicks "Approve"
- Backend creates Razorpay order: `Amount = Slots × Days × PricePerSlot`
- Sets `PaymentStatus = OrderCreated`, `PaymentExpiresAt = Now + 24 hours`
- Optionally creates Virtual Account (for bank transfer option)

**Step 2: Advertiser Pays (3 Options)**

| Tab | Method | How It Works |
|-----|--------|-------------|
| UPI QR Code | QR scan | `upi://pay?pa={merchant}&am={amount}&cu=INR` — scan with GPay, PhonePe, Paytm, BHIM |
| UPI Deep Links | App buttons | Single-tap payment from installed UPI app |
| Bank Transfer | Virtual Account | Transfer to generated VA number + IFSC — credited automatically |

A countdown timer shows: *"Payment expires in Xh Ym"*

**Step 3: Frontend Payment Polling**
- Custom hook `usePaymentPoller` polls payment status every 5 seconds
- Terminal states: `Captured`, `Refunded`, `Expired`
- Success → Confetti animation + booking status update

**Step 4: Webhook Processing**
- Razorpay sends `POST /api/payments/webhook` with HMAC-SHA256 signature
- Events: `payment.captured` → Activate booking, `payment.failed` → Mark expired, `refund.processed` → Mark refunded, `virtual_account.credited` → Same as captured

**Step 5: Auto-Expiry (Azure Function)**
- Runs every 15 minutes
- Finds bookings: `PaymentStatus == OrderCreated AND PaymentExpiresAt < UtcNow`
- Auto-cancels: releases slots, unlocks creative, notifies advertiser

#### Payment Status Lifecycle
```
None → OrderCreated → Captured → [RefundInitiated → Refunded]
                    ↘ Expired (24h timeout)
```

#### Idempotency & Safety
- Creating an order twice for the same booking returns the existing order
- Webhook handlers are idempotent (Razorpay retries on failure)
- Payment polling is safe to call repeatedly (cached results)

### Real Problems Solved

1. **Virtual accounts not created** alongside orders → Added fail-safe: create VA at order creation time
2. **Payment status stuck at OrderCreated** → Azure Function auto-expires after 24 hours
3. **Webhook signature not validated** → Added HMAC-SHA256 verification (prevents spoofed webhooks)
4. **No visual feedback after payment** → Added frontend polling + success animation
5. **Race condition on booking activation** → Added check: `PaymentStatus == Captured AND StartDate ≤ Today`

---

## Blog 6: Raspberry Pi Player — Gapless Video Playback on Edge Devices

**Published:** Player Infrastructure

### The Problem

The physical player device is the most critical component in the entire system. If it fails:
- Screens go black → Screen owners lose trust
- Ads don't play → Impressions lost → Advertisers lose trust
- Revenue drops → Platform dies

A player device must handle:
- **Gapless playback** — No black screens between videos (10-minute slots must be seamless)
- **Offline operation** — Network goes down for hours; the screen must keep playing
- **Tamper-proof tracking** — Every impression must be verifiable and non-duplicable
- **Auto-recovery** — If the player crashes at 2 AM, it must restart itself
- **Remote updates** — Playlists change in real-time; no USB drives

### What We Built: Python + MPV on Raspberry Pi 4

#### Architecture
```
┌──────────────────────────────────────┐
│  ccms_player.py (Main Loop)          │
│  ├─ Handshake → Screen ID + API Key  │
│  ├─ Heartbeat → 30s keep-alive       │
│  ├─ Sync → 1-10 min playlist/impr.   │
│  ├─ mpv_dual_player.py → Gapless     │
│  ├─ cache_manager.py → Video cache   │
│  └─ impression_store.py → SQLite     │
└──────────────────────────────────────┘
```

#### Gapless Playback (Dual MPV Instances)
The key innovation: **two MPV player instances running simultaneously**.

1. While Video A plays, Video B is silently preloaded in a buffer
2. At the exact moment Video A ends, switch to Video B instantly
3. Meanwhile, preload Video C into the now-free buffer
4. Result: zero black frames, seamless 10-minute ad slots back-to-back

#### Video Cache Manager
- Videos downloaded to `/video_cache/` on first play
- SHA-256 hash verification on download AND on play (prevents tampering)
- LRU eviction when cache approaches capacity
- Replays from local cache if hash matches — no re-download

#### Offline Impression Queue (SQLite)
When the network goes down:
1. Player keeps playing from local cache
2. Impressions recorded locally in SQLite database
3. Each impression tagged with `SlotPlayKey = SHA256(screenId | date | slot | timestamp)` — unique per play
4. When network restores: batch sync to server
5. Server deduplicates by SlotPlayKey — even if sync is retried, no double-counting

#### Auto-Start on Boot (systemd)
```
[Service]
ExecStart=/home/pi/pixelspot-player/venv/bin/python ccms_player.py
Restart=always
```
If the player crashes for any reason, systemd restarts it within seconds.

### Real Problems Solved

1. **Video frame drops on Raspberry Pi 3** → Upgraded requirement to Pi 4 with GPU-accelerated decoding (`h264_v4l2m2m`)
2. **Black screen transitions** → Dual MPV buffer system eliminated all visible transitions
3. **Crashes on network loss** → Wrapped all network calls in try-catch + auto-restart via systemd
4. **Playlists not updating** → Added SignalR `PlaylistUpdated` listener for instant push updates
5. **Impression sync failures** → Local SQLite queue with retry logic — zero impressions lost

---

## Blog 7: Android TV Player — Native Playback for Smart Displays

**Published:** Android TV Support

### The Problem

Not every screen runs on a Raspberry Pi. Many commercial displays are Android-based — Samsung smart signage, LG webOS (with Android compatibility), generic Android TV boxes. We needed a native Android player that could:

- Use hardware-accelerated video decoding (ExoPlayer/Media3)
- Survive Android's aggressive process killing (foreground service)
- Store videos locally without filling up limited storage (smart eviction)
- Run headlessly on TVs with no touch input

### What We Built: Kotlin + ExoPlayer

#### Tech Stack
- **Kotlin** — Modern, null-safe language for Android
- **ExoPlayer (Media3)** — Google's media player library with hardware codec support
- **Room Database** — Local storage for cache metadata and impression queue
- **Work Manager** — Reliable background sync scheduling
- **Foreground Service** — Prevents Android from killing the player process
- **EncryptedSharedPreferences** — API key stored encrypted at rest

#### Key Features

**Local Video Cache (Room Database)**
```
CreativeCache:
  - id, url, filePath, fileHash (SHA-256), size, cachedAt, lastAccessed

ImpressionQueue:
  - id, slotPlayKey, creativeId, timestamp, synced
```
- LRU eviction based on `lastAccessed` when storage limit reached
- Hash verification on every playback start

**Foreground Service**
Android kills background apps aggressively. The player runs as a foreground service with a persistent notification — Android won't kill it even under memory pressure.

**Diagnostic Screen**
A hidden overlay (triggered by remote control combo) showing:
- Memory usage, player uptime, network status
- Current playlist, impression count
- Last sync time, error log
- Essential for remote debugging when you can't physically access the device

#### Security
- API key encrypted at rest (EncryptedSharedPreferences)
- HMAC signing on all API requests
- Device fingerprint bound on first handshake (same protocol as Raspberry Pi)

### Same Core Protocol
The Android player implements the same backend integration as the Raspberry Pi player:
- Handshake (Screen ID + API Key → Session Token)
- Heartbeat (30-second keep-alive)
- Sync (1–10 minute adaptive with impression batch upload)
- SignalR (real-time playlist push, sync mode changes)

---

## Blog 8: Real-Time System — SignalR Hubs & WebRTC Live Streaming

**Published:** Real-Time Architecture

### The Problem

A DOOH platform without real-time capabilities is a blind platform:
- Screen owners can't see if their screen is online
- Advertisers can't see if their ad is actually playing
- Playlist updates take 10+ minutes to propagate (sync interval)
- There's no way to preview a screen's current playback remotely

### What We Built: 3 SignalR Hubs + WebRTC

#### Hub 1: PlaybackHub (`/hubs/playback`)
**Purpose:** Real-time impression events from player devices

- `AdStarted` → Log impression start time
- `AdCompleted` → Log impression completion

The dashboard shows a **live impression counter** — advertisers can watch impressions tick up in real-time as their ad plays on screens.

#### Hub 2: PlayerHub (`/hubs/player`)
**Purpose:** Remote control and management of player devices

- `PlaylistUpdated` → Player fetches new playlist immediately (no more waiting for next sync)
- `SlotStatusChanged` → Notify player of booking approval/cancellation  
- `SetSyncMode` → Dynamically change sync interval (adaptive based on network conditions)

**Use Case:** Admin approves a booking → Backend broadcasts `PlaylistUpdated` to that screen's player → Player downloads new content → Ad starts playing within seconds (not 10 minutes).

#### Hub 3: StreamingHub (`/hubs/streaming`)
**Purpose:** WebRTC signaling for live screen preview

```
Advertiser clicks "Watch Live" on a booking
        ↓
StreamingHub.RequestStream(bookingId)
        ↓
Backend validates: Advertiser owns booking, access window valid
        ↓
WebRTC peer connection initiated → ICE candidates exchanged
        ↓
Player streams live video to advertiser's browser
        ↓
Advertiser sees real-time screen playback from their desk
```

This is one of our most unique features — advertisers can verify their ad is playing on a physical screen thousands of kilometers away, in real-time, from their browser.

### Real Problem Solved: SetSyncMode NaN Flood

**The Bug:** The `SetSyncMode` SignalR event was sending a string value (e.g., `"adaptive"`) but the player was parsing it as a number for the sync interval. `parseInt("adaptive")` returns `NaN`. The sync loop then ran with `NaN` milliseconds — which JavaScript interpreted as "run immediately, forever."

Result: The player was sending sync requests thousands of times per second, flooding the server with 429 (rate limit) and 500 (server overload) responses.

**The Fix:** Added a string-to-number mapping (`"low"` → 10, `"medium"` → 5, `"high"` → 1) and a guard clause: if the parsed value is `NaN`, fall back to 5-minute default.

---

## Blog 9: Analytics, Impressions & Payout Settlement

**Published:** Analytics & Finance

### The Problem

Three interconnected problems:
1. **Proof of play:** Did the ad actually display? For how long? How many times?
2. **Fair settlement:** Screen owners should be paid proportionally to delivery performance
3. **Real-time visibility:** Both parties want to see campaign performance as it happens

### What We Built

#### Impression Tracking Pipeline

**Step 1: Local Recording (Player Device)**
- Video completes → Player records impression locally
- Data: CreativeId, ScreenId, SlotNumber, Timestamp, Duration
- Dedup key: `SlotPlayKey = SHA256(screenId | date | slotNumber | timestamp)`
- Stored in: SQLite (Pi), Room DB (Android), IndexedDB (ChromeOS)

**Step 2: Batch Sync (Adaptive 1–10 min)**
```json
POST /api/player/sync
{
  "sessionToken": "...",
  "impressions": [
    { "creativeId": "guid", "slotKey": "sha256_hash", "timestamp": "ISO8601" }
  ]
}
```

**Step 3: Server Deduplication**
- Backend checks: `SlotPlayKey` already exists?
  - Yes → Skip (no double-counting, even if sync retried)
  - No → Insert into Impressions table
- Validates: Was this slot actually booked for this date? Is the creative valid?

**Step 4: Daily Aggregation**
`ImpressionDailySummary` table: per-booking, per-date counts — used by dashboards and settlement.

**Step 5: Settlement Calculation**
```
Delivery Rate = Actual Impressions ÷ Expected Impressions

Example:
  Expected: 60 plays (Slot 3, 3 days, 30-sec video)
  Actual: 54 plays (3 brief network outages)
  Delivery Rate: 90%
```

#### Payout Settlement Model

**Two-Phase Payout:**

| Phase | When | Amount | Formula |
|-------|------|--------|---------|
| **Advance** | Payment captured | 50% of booking total | `(BookingTotal × 0.5) - Commission` |
| **Final** | Booking completed | Remaining 50%, adjusted | `(BookingTotal × 0.5 × DeliveryRate) - Commission` |

*Why two phases?*
- **Advance payout** gives screen owners cash flow confidence upfront
- **Final payout** is adjusted by delivery rate — if the screen was offline for 20% of the campaign, the final payout reflects that

**Admin Payout Dashboard:**
- Lists all pending payouts (Advance + Final)
- For Final payouts: shows expected vs actual impressions, delivery rate %
- Admin clicks "Process" → funds transferred to screen owner's bank
- Machine fingerprint validation (only authorized admin devices can process payouts)

#### Analytics Dashboards

| View | Metrics |
|------|---------|
| Campaign (Advertiser) | Total impressions, daily chart, screen breakdown, spend |
| Booking (Both) | Daily impressions chart, play logs, delivery %, invoice |
| Screen (Owner) | Total earnings, impressions per booking, revenue trend |
| Platform (Admin) | Total GMV, active screens, fill rate, growth curves |

### Real Problem Solved: Commission Calculation Drift

**The Problem:** Commission percentage was being calculated dynamically at payout processing time. But commission rates could change between booking approval and payout. A booking approved at 15% commission might settle at 18% commission — unfair to the screen owner.

**The Fix:** Commission percentage is now stored on the booking record at approval time. It's immutable — the commission rate that was active when the booking was approved is the rate used for settlement, regardless of any later changes.

---

## Blog 10: Screen Discovery Map & Tag-Based Search

**Published:** Marketplace Discovery

### The Problem

An advertiser signs up and wants to book screens. But where? They need to:
- Browse screens geographically (map view)
- Filter by demographics ("show me screens near tech parks frequented by young professionals")
- Compare pricing across screens
- Check availability for their campaign dates
- Do all of this without needing an account (public exploration)

### What We Built

#### Interactive Map (Leaflet + React-Leaflet)

**Technologies:**
- Leaflet 1.9 with React-Leaflet bindings
- OpenStreetMap tiles (free, no API key needed)
- `react-leaflet-cluster` for marker clustering
- Real-time price display on markers

**Features:**
- **Marker clustering:** 50 screens in one area → single cluster icon showing count. Click to zoom in.
- **Screen popup:** Click a marker → popup with: name, type, price per slot, key tags, distance from map center, "Book this screen" button
- **Responsive:** Works on mobile (touch-friendly clusters) and desktop (hover previews)

#### Tag-Based Search & Filtering

The 100+ tags from Blog 3's tagging pipeline power the search:

| Filter | Type | Example |
|--------|------|---------|
| Location | City/area or draw-on-map | "Bengaluru, Koramangala" |
| Audience | Multi-select checkboxes | `young_professionals`, `student_audience`, `family_audience` |
| Time | Multi-select | `morning_rush_zone`, `lunch_hour_zone`, `night_active_zone` |
| Category | Multi-select | `foodie_zone`, `corporate_zone`, `retail_district` |
| Price Range | Min-max slider | ₹500 – ₹5,000 per slot |
| Availability | Date range picker | March 25 – April 10 |

Applying filters:
1. Map bounds adjust to show matching results
2. Markers cluster/uncluster as zoom changes
3. Count badge updates ("23 screens found")

#### Public Explore Page
- Route: `/explore` — no login required
- Shows all screens with `ScreenVisibility = Public`
- Full map + filter functionality
- "Book this screen" button → redirects to login/register

This is the top of the funnel — advertisers discover the platform by exploring the map before committing to an account.

---

## Blog 11: ChromeOS PWA Player — Building for Managed Kiosks & 6 Production Bugs

**Published:** Latest Feature

### The Problem

Raspberry Pi requires hardware provisioning. Android TV requires Play Store distribution. For ChromeOS kiosk deployments (libraries, schools, enterprise lobbies, co-working spaces), we needed:

- **No app store** — Just a URL
- **Auto-updates** — Browser refresh pulls latest code
- **Managed device compatibility** — ChromeOS enterprise management
- **Offline capability** — Service Worker for app shell caching

### What We Built: TypeScript + Vite PWA

A Progressive Web App that runs in Chrome/Chromium on any ChromeOS device (or any browser).

**Stack:**
- TypeScript (strict mode)
- Vite build tool
- Service Worker (Workbox) for offline app shell
- IndexedDB for impression storage
- SignalR client for real-time updates

**Same Core Protocol:**
- Handshake (Screen ID + API key → Session Token)
- Heartbeat (30-second keep-alive)
- Sync (1–10 min adaptive with impression batch)
- SignalR (real-time playlist push)
- Operating hours enforcement

### 6 Real Production Bugs Fixed

#### Bug 1: `creativeUrl` Field Name Mismatch

**Symptom:** Videos wouldn't play. The video element's `src` was `undefined`.

**Root Cause:** The backend API returned `creativeUrl` but the player code was reading `videoUrl`.

**Fix:** Changed all references from `videoUrl` to `creativeUrl` in the video player.

#### Bug 2: IndexedDB Boolean Key Issue

**Symptom:** Impressions were being stored but never flagged as "synced" after successful upload.

**Root Cause:** IndexedDB doesn't support boolean index keys. The code was querying `synced: false` but IDB was storing booleans which can't be used as index keys.

**Fix:** Changed to numeric representation: `0` for unsynced, `1` for synced.

#### Bug 3: SignalR Method Name Mismatch

**Symptom:** Real-time playlist updates weren't reaching the player. Player received no SignalR events.

**Root Cause:** Player was subscribing to `SubscribeToScreen` but the hub was broadcasting on a different method name.

**Fix:** Aligned the SignalR method names between player and backend hub.

#### Bug 4: SetSyncMode NaN Causing Request Flood

**Symptom:** Server getting hammered with thousands of sync requests per second from a single player. 429 and 500 responses everywhere.

**Root Cause:** `SetSyncMode` sent string `"adaptive"` → player did `parseInt("adaptive")` → `NaN` → sync interval became `NaN` milliseconds → `setInterval(fn, NaN)` fires immediately, repeatedly, forever.

**Fix:** String-to-number mapping (`"low"` → 10min, `"medium"` → 5min, `"high"` → 1min) plus a guard: if parsed value is `NaN` or ≤ 0, default to 5 minutes.

#### Bug 5: Operating Hours Blocking All Playback

**Symptom:** Player showed "Outside operating hours — deferring playback" 24/7, even during configured hours.

**Root Cause:** When a screen had no operating hours schedule configured (meaning "always on"), the code was treating the empty/null schedule as "outside hours" instead of "no restriction."

**Fix:** If operating hours schedule is empty/null/undefined → return `true` (always within operating hours). Only enforce the schedule when one is explicitly configured.

#### Bug 6: 401 Unauthorized After SD Card Re-Flash

**Symptom:** After re-flashing a Raspberry Pi's SD card, the device's handshake returned 401 even with the correct API key.

**Root Cause:** Device fingerprint changed after OS re-install. The stored fingerprint no longer matched.

**Fix:** Admin endpoint to clear stored device fingerprint. Next handshake re-records the new fingerprint.

### Current Limitation

The ChromeOS player's Service Worker currently only caches the **app shell** (HTML, JS, CSS, icons). Video content is streamed from Cloudflare R2 on every playback. If the network goes down, the app loads but videos won't play.

This is the **#1 priority** for the next development phase (see Blog 12).

---

## Blog 12: Future Roadmap — What We're Building Next

**Published:** Roadmap

### P0 — Critical: Offline Video Playback (ChromeOS)

**The Problem:** Network interruption = blank screen for ChromeOS kiosks. Raspberry Pi and Android TV have local cache. ChromeOS doesn't.

**The Solution:**
1. After playlist sync: download all video files into Cache Storage API
2. Enhanced Service Worker intercepts video URL fetches → serves from cache when available
3. IndexedDB for cache metadata (which videos cached, sizes, freshness)
4. LRU eviction when storage quota approaches
5. On reconnect: `navigator.onLine` change detection → sync impressions + check for playlist updates

### P1 — Reliability: Graceful Network Degradation

**Handshake Fallback:**
- Cache last successful handshake response (playlist + operating hours)
- On handshake failure: fall back to cached data with "Last updated X ago" indicator
- Background retry every 5 minutes until connection restores

**Video Playback Error Recovery:**
- Retry same video 3× with exponential backoff (1s, 2s, 4s)
- Track error rate per URL — disable high-failure URLs after threshold
- Show last good frame (not black screen) during recovery

**Impression Sync Confirmation:**
- Server returns confirmed SlotPlayKey list in sync response
- Only mark impressions as synced after server confirmation
- Re-sync unconfirmed records after 1 hour

### P2 — Monitoring: Player Telemetry Dashboard

**Metrics to Collect:**
- Handshake success rate and latency (by geography)
- Video playback error distribution (by URL, by device)
- Impression sync success rate and lag
- Memory/CPU trends per player device
- Uptime percentage per screen

**Implementation:**
- Circular log buffer in localStorage/IndexedDB (last 1000 entries)
- Batch upload to server every 12 hours (or on demand)
- Admin dashboard with heatmaps, trend charts, alerting

### P3 — Playlist Intelligence

**Smart Playlist Updates:**
- Queue playlist updates until current video finishes (don't interrupt mid-play)
- Compare incoming playlist with current — only download new/changed entries
- Emergency filler content: if playlist is empty, request yesterday's playlist or show branded screensaver

### P4 — Security Hardening

**API Key Storage:**
- Move from plain `localStorage` to `sessionStorage` or server-side API proxy
- Encrypt API key at rest with Web Crypto API

**HTTPS Enforcement:**
- Block all non-HTTPS URLs except `localhost`
- Validate TLS certificate pinning for API endpoint

### P5 — Build & Deployment

**Automated Player Deployment:**
- Docker image for ChromeOS player (self-hosted kiosk mode)
- OTA (Over-The-Air) update mechanism via Service Worker version detection
- Automated testing: headless Chrome running through playlist scenarios

---

## Blog 13: CTO Diary — Database Migration from SQL Server to PostgreSQL Mid-Flight

**Published:** Technical Deep Dive

### The Problem

We started development on SQL Server. Local dev was fine. Then came production reality:

- **SQL Server licensing** on a Linux VPS is expensive and complex
- **Neon PostgreSQL** offered serverless, auto-scaling, EU-hosted (Frankfurt) with a generous free tier
- We had 30+ EF Core migrations, multiple raw SQL scripts, and SQL Server-specific syntax scattered across the codebase

We needed to migrate the database provider without breaking a running application.

### How I Solved It: Dual-Provider Abstraction

Instead of a hard cutover, I built a **provider switch** directly into `Program.cs`:

```csharp
var databaseProvider = builder.Configuration["Database:Provider"] ?? "SqlServer";

if (databaseProvider.Equals("PostgreSQL", StringComparison.OrdinalIgnoreCase))
{
    builder.Services.AddDbContext<ApplicationDbContext>(options =>
        options.UseNpgsql(connectionString, npgsqlOptions => {
            npgsqlOptions.EnableRetryOnFailure(maxRetryCount: 5, maxRetryDelay: TimeSpan.FromSeconds(30), errorCodesToAdd: null);
            npgsqlOptions.UseQuerySplittingBehavior(QuerySplittingBehavior.SplitQuery);
        }));
}
else
{
    builder.Services.AddDbContext<ApplicationDbContext>(options =>
        options.UseSqlServer(connectionString));
}
```

This meant:
- **Development** could keep using SQL Server if needed (flip a config flag)
- **Production** pointed at PostgreSQL immediately
- The `SplitQuery` behavior was critical — our `Include()` chains across Bookings → Screens → Creatives were causing **Cartesian explosion** on Postgres (hundreds of duplicate rows returned). Split queries fixed it.

### The Migration Gotchas

**1. Boolean columns:** SQL Server uses `BIT`, PostgreSQL uses `BOOLEAN`. EF Core handles this transparently — but raw SQL scripts needed rewriting. Every `.csx` script and migration SQL file had to be audited.

**2. String comparison:** SQL Server is case-insensitive by default. PostgreSQL is case-sensitive. Queries like `WHERE Email = @email` stopped matching `"Sanket@pixelspot.in"` vs `"sanket@pixelspot.in"`. Fixed with `ILIKE` and `LOWER()` where needed.

**3. Quoted identifiers:** PostgreSQL requires double-quoted identifiers for case-sensitive column names. All raw SQL became `"Screens"."IsOnline"` instead of `Screens.IsOnline`.

**4. DateTime handling:** SQL Server's `GETUTCDATE()` doesn't exist in PostgreSQL. Replaced with `NOW() AT TIME ZONE 'UTC'` in all migration scripts.

### Lesson Learned
Never hardcode a database provider assumption. The dual-provider switch cost 2 hours to build but saved weeks of migration pain. Config-driven infrastructure decisions are always worth the initial investment.

---

## Blog 14: CTO Diary — The R2 Subdomain Incident (Why You Never Hardcode CDN URLs)

**Published:** Production Incident

### The Incident

One morning, every video on every screen stopped playing. The player logs showed `403 Forbidden` on all creative URLs. The dashboard showed broken thumbnails everywhere.

### Root Cause

Cloudflare R2's public access URLs use a subdomain format: `https://pub-{hash}.r2.dev`. When we reconfigured our R2 bucket's public access settings, **the subdomain hash changed**:

```
Old: https://pub-c37d8aeca6e04cb7bb13a43d90d86fd6.r2.dev
New: https://pub-8b275ed0704741b798c135d2ba0f55f9.r2.dev
```

Every creative URL and thumbnail URL in the database was now pointing to a dead subdomain.

### The Fix: Emergency Database URL Rewrite

I wrote a C# script (`fix_r2_urls.csx`) that performed a bulk `REPLACE` across three tables:

```csharp
// Update Creatives FileUrl
"UPDATE \"Creatives\" SET \"FileUrl\" = REPLACE(\"FileUrl\", @oldUrl, @newUrl)
 WHERE \"FileUrl\" LIKE @pattern RETURNING \"Id\", \"Name\", \"FileUrl\""

// Update Creatives ThumbnailUrl
"UPDATE \"Creatives\" SET \"ThumbnailUrl\" = REPLACE(\"ThumbnailUrl\", @oldUrl, @newUrl)
 WHERE \"ThumbnailUrl\" LIKE @pattern RETURNING \"Id\", \"Name\", \"ThumbnailUrl\""

// Update Screens DefaultVideoUrl
"UPDATE \"Screens\" SET \"DefaultVideoUrl\" = REPLACE(\"DefaultVideoUrl\", @oldUrl, @newUrl)
 WHERE \"DefaultVideoUrl\" LIKE @pattern RETURNING \"Id\", \"Name\", \"DefaultVideoUrl\""
```

Then I wrote a verification script (`check_r2.csx`) that checked every file in R2 was accessible from the new URL.

### Architectural Fix

After the incident, I moved the R2 base URL to a **server-side configuration** (`R2__PublicUrlBase` environment variable). The database now stores only the relative path (`/creatives/{guid}.mp4`), and the full URL is constructed at API response time. If the CDN provider changes their URL scheme again, it's a one-line env var update — zero database changes.

### Lesson Learned
Never persist full external URLs in your database. Store relative paths and construct URLs dynamically from configuration. CDN providers change their URL schemes more often than you'd expect.

---

## Blog 15: CTO Diary — Preventing Timing Attacks on Player Authentication

**Published:** Security Engineering

### The Problem

Our player devices authenticate with HMAC-SHA256 signatures on every API request. The signature is: `HMAC(payload | timestamp | sessionToken, apiKey + serverSalt)`. Standard stuff.

But during a security audit, I realized our signature comparison was vulnerable to **timing attacks**.

### What's a Timing Attack?

String comparison (`==`) exits on the first mismatched character. An attacker can measure response times to determine how many characters of their forged signature match. Given enough requests, they can reconstruct a valid signature byte-by-byte without knowing the key.

### The Fix: Constant-Time Comparison

```csharp
// ❌ WRONG — vulnerable to timing attack
return expectedSignature == providedSignature;

// ✅ CORRECT — constant-time comparison
return CryptographicOperations.FixedTimeEquals(
    Encoding.UTF8.GetBytes(expectedSignature),
    Encoding.UTF8.GetBytes(providedSignature.ToLowerInvariant())
);
```

`FixedTimeEquals` compares every byte regardless of where mismatches occur. The comparison always takes the same time whether 0 bytes match or all bytes match.

### Additional Hardening: Replay Attack Prevention

Even with a valid signature, a captured request could be replayed. I added a **5-minute timestamp drift window**:

```csharp
var requestTime = DateTimeOffset.FromUnixTimeSeconds(timestampValue);
var drift = Math.Abs((DateTimeOffset.UtcNow - requestTime).TotalSeconds);

if (drift > MAX_TIMESTAMP_DRIFT_SECONDS) // 300 seconds
{
    _logger.LogWarning("Timestamp drift too large: {Drift}s", drift);
    return false;
}
```

Every player request includes a Unix timestamp. If the timestamp is older than 5 minutes, the signature is rejected — even if it's mathematically valid. This prevents captured requests from being replayed hours or days later.

### Lesson Learned
Cryptographic operations need constant-time comparisons everywhere — signature validation, token verification, password checks. Standard string equality is never safe for security-critical comparisons.

---

## Blog 16: CTO Diary — How a NaN Crashed Our Server (The SetSyncMode Flood)

**Published:** Debugging War Story

### The Incident

The server monitoring dashboard turned red. CPU at 100%. Thousands of 429 (rate limit) and 500 (internal server error) responses per second. All from a single player device.

### Investigation

The player's sync endpoint (`POST /api/player/sync`) was being called thousands of times per second from one ChromeOS kiosk. That's not a DDoS — that's a bug.

I traced the SignalR event chain:

1. Backend sent `SetSyncMode("adaptive")` via SignalR to the player
2. Player received the string `"adaptive"`
3. Player code: `const interval = parseInt(mode);` → `parseInt("adaptive")` returns `NaN`
4. Player code: `setInterval(syncFunction, interval * 60 * 1000)` → `NaN * 60 * 1000` = `NaN`
5. JavaScript's `setInterval(fn, NaN)` behaves like `setInterval(fn, 0)` — fires immediately, forever
6. The player was now sending sync requests as fast as the browser could fire them

### The Cascade

- Player floods server → Nginx rate limiter kicks in → 429 responses
- Some requests slip through → Backend processes them → CPU spikes → 500 errors
- Other players on the same server start getting timeouts
- Dashboard becomes unresponsive

### The Fix

**Player-side:** String-to-number mapping with a NaN guard:

```typescript
function parseSyncMode(mode: string): number {
  const modeMap: Record<string, number> = {
    'low': 10,
    'medium': 5,
    'high': 1,
    'adaptive': 5,
  };

  const minutes = modeMap[mode.toLowerCase()] ?? parseInt(mode);

  // Guard: if still NaN or <= 0, default to 5 minutes
  if (isNaN(minutes) || minutes <= 0) {
    console.warn(`[Sync] Invalid sync mode "${mode}", defaulting to 5 min`);
    return 5;
  }
  return minutes;
}
```

**Server-side:** Added per-device rate limiting on the sync endpoint — max 1 request per 30 seconds per device, regardless of global rate limits.

### Lesson Learned
Never trust `parseInt()` with non-numeric strings in production code. Always validate the output. A single `NaN` in a timing function can cascade into a self-inflicted DDoS. Defense in depth: client-side validation + server-side rate limiting per device.

---

## Blog 17: CTO Diary — Admin Payout Security with Machine Fingerprinting

**Published:** Security Architecture

### The Problem

Payouts are the most sensitive operation on the platform — real money leaving the system. If an admin account is compromised (stolen credentials, session hijack), the attacker could drain funds by processing fake payouts.

Standard 2FA (SMS, authenticator app) adds friction to every payout. I needed something that:
- Doesn't require manual input for each operation
- Binds payout authorization to a **physical machine**
- Can't be replicated from a stolen session

### The Solution: Machine Fingerprint Binding

Every admin payout request includes an `X-Machine-Fingerprint` header — a hash of the device's hardware characteristics (CPU cores, screen resolution, OS, browser version, installed fonts, WebGL renderer).

```csharp
// Server-side: Hash the fingerprint and check against registered machines
var fingerprintHash = HashFingerprint(fingerprint);  // SHA256

var machines = await _machineRepository.FindAsync(m =>
    m.AdminUserId == userGuid &&
    m.MachineFingerprintHash == fingerprintHash &&
    m.Status == AdminMachineStatus.Active);

if (machine == null)
{
    _logger.LogWarning("Unauthorized machine attempt by admin {AdminId}", userId);
    return 403; // "This machine is not authorized for payout operations"
}

// Update last used timestamp for audit trail
machine.LastUsedAt = DateTime.UtcNow;
```

### How Machine Registration Works

1. Admin navigates to "Security" settings → "Register this machine"
2. Frontend collects device fingerprint using FingerprintJS
3. Fingerprint hash stored in `AdminMachines` table with: machine name, fingerprint hash, registered date, status
4. Subsequent payout requests from this machine are auto-validated
5. Admin can deauthorize machines from the settings page

### Why Not Just MFA?

- **MFA protects the session** — machine fingerprinting protects the **operation**
- Even with a valid session token stolen via XSS, the attacker needs to be on the registered physical machine
- A stolen laptop with logged-in session? Deauthorize the machine remotely — instant revocation
- Audit trail: every payout shows which physical machine processed it

### Lesson Learned
For financial operations, session-level security isn't enough. Bind critical operations to a physical device. The attacker needs both the session AND the machine — exponentially harder to compromise both.

---

## Blog 18: CTO Diary — DeviceOverride State Loss and the ConcurrentDictionary Trap

**Published:** Architecture Decision

### The Problem

Players authenticate by sending a device fingerprint on their first handshake. This fingerprint is bound to the screen — subsequent handshakes must match. But what happens when a screen owner re-flashes their Raspberry Pi?

**The original approach:** When an admin cleared a device fingerprint, we stored the "override" in a `ConcurrentDictionary<Guid, DeviceOverride>` in memory. The next handshake would check: "is there an active override for this screen?" → if yes, accept the new fingerprint and clear the override.

**The failure:** The backend restarted (deployment, crash, Docker container recycle). The `ConcurrentDictionary` was in-process memory. All pending overrides vanished. Screen owners who had just gotten their fingerprint cleared found their devices still rejected.

### The Fix: Persist Override State

Created a `DeviceOverrideHistories` table:

```sql
CREATE TABLE IF NOT EXISTS "DeviceOverrideHistories" (
    "Id" uuid NOT NULL,
    "ScreenId" uuid NOT NULL,
    "Action" character varying(50) NOT NULL,
    "Reason" character varying(500) NOT NULL,
    "OldFingerprintHash" character varying(100),
    "NewFingerprintHash" character varying(100),
    "IsPending" boolean NOT NULL DEFAULT false,
    "CreatedAt" timestamp with time zone NOT NULL,
    "ProcessedAt" timestamp with time zone,
    CONSTRAINT "PK_DeviceOverrideHistories" PRIMARY KEY ("Id")
);

-- Index for the hot path during handshake
CREATE INDEX "IX_DeviceOverrideHistory_Screen_Pending"
    ON "DeviceOverrideHistories" ("ScreenId", "IsPending");
```

Now the handshake checks the database (not memory) for pending overrides. Restarts, deployments, container recycles — overrides persist. The composite index on `(ScreenId, IsPending)` ensures this check adds negligible latency to the handshake hot path.

### Broader Rule

**Never use in-memory state for operations that span time.** If the state needs to survive a process restart, it must be persisted. `ConcurrentDictionary` is for request-scoped caching, not cross-request workflows.

---

## Blog 19: CTO Diary — Deploying to a Hetzner VPS with Zero Downtime (Almost)

**Published:** DevOps

### The Problem

We deploy to a single Hetzner VPS (`91.99.190.216`) running Docker Compose. No Kubernetes, no blue-green infrastructure, no managed deployment service. Just SSH + tar + Docker.

The challenge: deploy new code without leaving the platform down for minutes. A screen going offline during deployment means lost impressions and a bad experience for screen owners.

### The Deployment Pipeline I Built

```
Local Machine → SSH → Hetzner VPS
    1. Verify SSH connectivity (fail fast)
    2. Create tar archives (backend + frontend + nginx + docker configs)
    3. Exclude build artifacts (bin, obj, node_modules, uploads)
    4. SCP tar files to server
    5. Clean remote directories (fresh state)
    6. Extract archives
    7. docker compose build --no-cache
    8. docker compose up -d
    9. Health check loop (30 retries × 5 seconds = 2.5 min max wait)
    10. Report deploy status + container health
```

### Hard-Won Deployment Lessons

**1. Never use `scp -r`**
The PowerShell deploy script uses `tar` + `scp` instead of `scp -r` (recursive copy). Why? `scp -r` can silently corrupt files on network interruption — you end up with half-copied binaries that crash at runtime with cryptic errors. A tar archive is atomic: it either transfers completely or fails entirely.

**2. Always clean before extracting**
Early deployments used incremental sync (only copy changed files). This left stale files from previous versions — old DLLs that conflicted with new ones, old config files that overrode new settings. Now we do a full `rm -rf` + fresh extract every time. Disk is cheap; debugging stale-state issues is expensive.

**3. Health check with retry is non-negotiable**
The backend takes 15–30 seconds to start (EF Core migration check, SignalR hub initialization, R2 client startup). Without a health check loop, the deploy script would report "success" while the backend was still booting. My script waits up to 150 seconds, checking `http://localhost:5000/api/health` every 5 seconds.

**4. File size validation after transfer**
The deploy script reports file sizes before and after transfer. If the tar archive on the server is smaller than what was sent, something went wrong during transfer. This caught a corrupted upload once that would have deployed a broken backend.

### What "Zero Downtime" Actually Means

With Docker Compose (no orchestrator), there's a ~5-second window during `docker compose up -d` where the old containers are stopping and new ones are starting. Nginx is configured with `proxy_connect_timeout 5` and `proxy_read_timeout 30`, so player heartbeats that land during this window get a connection error and retry on the next 30-second cycle. Not truly zero-downtime, but functionally invisible.

---

## Blog 20: CTO Diary — The Impression Deduplication Problem

**Published:** Data Integrity

### The Problem

Players batch-sync impressions every 1–10 minutes. Network is unreliable. The server might receive the batch, process it, but the response gets lost before reaching the player. The player thinks the sync failed and retries — now the same impressions are uploaded twice.

Double-counted impressions mean:
- Advertisers are charged for plays that didn't happen
- Screen owners get overpaid
- Analytics become unreliable
- The entire trust model breaks

### The Solution: SlotPlayKey Deduplication

Every impression gets a unique, deterministic key:

```
SlotPlayKey = SHA256(screenId | date | slotNumber | timestamp)
```

This key is:
- **Deterministic:** Same play always produces the same key
- **Unique:** No two different plays can produce the same key
- **Verifiable:** Server can validate the inputs match the claimed play

The database has a **unique index** on `SlotPlayKey`:

```sql
CREATE UNIQUE INDEX "IX_Impressions_SlotPlayKey"
    ON "Impressions" ("SlotPlayKey")
    WHERE "SlotPlayKey" IS NOT NULL;
```

The `WHERE NOT NULL` clause is critical for PostgreSQL — it allows multiple NULL values in a unique column (for legacy records that didn't have the key).

### How It Works in Practice

1. Player records impression: `SlotPlayKey = SHA256("screen123|2026-03-23|3|1679558400")`
2. First sync: Server receives → inserts → returns `200 OK` with confirmed keys
3. Response lost (network timeout)
4. Player retries same batch
5. Server tries to insert → unique constraint violation → **skips** duplicate, returns `200 OK`
6. Player marks impressions as successfully synced

Zero double-counting. Zero lost impressions. The system is idempotent by design.

### Why Not Just Check "Already Synced" Locally?

We do that too — IndexedDB/SQLite marks impressions as `synced: 1`. But the player can crash between server confirmation and local update. The database unique index is the **last line of defense** — even if the client-side tracking fails, the server won't accept duplicates.

### Lesson Learned
For any system that handles financial data with unreliable delivery, idempotency keys are not optional. Design every mutation to be safe for retry. The dedup key should be deterministic (derived from the event, not random) so that retries produce the same key as the original.

---

## Blog 21: CTO Diary — Nginx Rate Limiting That Saved Us

**Published:** Infrastructure Security

### The Problem

A public-facing API serving both web dashboard users and edge player devices is a target. We needed rate limiting that was smart enough to:
- Let normal dashboard browsing work (10+ API calls per page load)
- Let players sync without being throttled (heartbeat every 30s)
- Block brute-force login attempts
- Prevent the SetSyncMode NaN flood (Blog 16) from happening again

### The Implementation

```nginx
# Zone 1: General API — 10 requests/second per IP
limit_req_zone $binary_remote_addr zone=api:10m rate=10r/s;

# Zone 2: Login/Auth — 5 requests/minute per IP
limit_req_zone $binary_remote_addr zone=login:10m rate=5r/m;

# Apply to API routes
location /api/ {
    limit_req zone=api burst=20 nodelay;
    proxy_pass http://backend:5000;
}

# Apply to auth routes (stricter)
location /api/auth/ {
    limit_req zone=login burst=3 nodelay;
    proxy_pass http://backend:5000;
}
```

### Security Headers (Defense in Depth)

```nginx
add_header X-Frame-Options "SAMEORIGIN" always;          # Prevent clickjacking
add_header X-Content-Type-Options "nosniff" always;       # Prevent MIME sniffing
add_header X-XSS-Protection "1; mode=block" always;       # XSS filter
add_header Referrer-Policy "strict-origin-when-cross-origin" always;
```

### How It Saved Us

During the SetSyncMode NaN flood (Blog 16), Nginx was rate-limiting the rogue player at the edge. Instead of thousands of requests hitting our C# backend and consuming CPU/memory, Nginx was returning `429 Too Many Requests` at the reverse proxy level — negligible overhead. The backend stayed healthy for all other users and devices while we diagnosed and fixed the player bug.

**Without rate limiting:** Full server outage for all users.
**With rate limiting:** One player got 429s, everyone else was unaffected.

### Lesson Learned
Rate limiting belongs at the **edge** (Nginx/reverse proxy), not in application code. By the time a request reaches your C# or Node backend, you've already paid the TCP, TLS, and HTTP parsing cost. Reject bad traffic before it touches your application.

---

## Summary

| Blog | Topic | Key Innovation |
|------|-------|---------------|
| 1 | Introduction | Slot-based DOOH marketplace (6 slots/hour) |
| 2 | Authentication | Device fingerprinting + machine-level API keys for players |
| 3 | Screen Management | 6-phase geographic tagging → 100+ demographic tags from lat/lng |
| 4 | Campaigns & Bookings | Atomic slot reservation preventing overbooking |
| 5 | Payments | Wallet → per-booking Razorpay with 24h window + auto-expiry |
| 6 | Raspberry Pi Player | Dual MPV instances for gapless playback + SQLite offline queue |
| 7 | Android TV Player | ExoPlayer + foreground service + encrypted key storage |
| 8 | Real-Time System | 3 SignalR hubs + WebRTC live stream from physical screen to browser |
| 9 | Analytics & Payouts | SHA-256 dedup impressions + two-phase settlement (advance + delivery-adjusted final) |
| 10 | Screen Discovery | Leaflet map + tag-based search for 100+ demographic filters |
| 11 | ChromeOS Player | PWA for managed kiosks + 6 real production bugs documented |
| 12 | Future Roadmap | Offline video caching, telemetry, graceful degradation |
| **13** | **CTO: DB Migration** | **SQL Server → PostgreSQL mid-flight with dual-provider config** |
| **14** | **CTO: R2 Incident** | **CDN URL rewrite after subdomain hash change** |
| **15** | **CTO: Timing Attacks** | **Constant-time HMAC comparison + replay prevention** |
| **16** | **CTO: NaN Flood** | **parseInt("adaptive") → NaN → self-inflicted DDoS** |
| **17** | **CTO: Payout Security** | **Machine fingerprint binding for financial operations** |
| **18** | **CTO: State Loss** | **ConcurrentDictionary trap → persisted DeviceOverrideHistories** |
| **19** | **CTO: Deployment** | **tar + scp + health-check on single Hetzner VPS** |
| **20** | **CTO: Deduplication** | **SHA-256 SlotPlayKey unique index for idempotent impressions** |
| **21** | **CTO: Rate Limiting** | **Nginx edge rate limiting that contained the NaN flood** |

---

*Built with ❤️ by the PixelSpot team.*
*Production: [https://ccms.pixelspot.in](https://ccms.pixelspot.in)*
