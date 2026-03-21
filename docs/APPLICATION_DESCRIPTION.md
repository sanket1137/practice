# PixelSpot CCMS — Application Description & Operations Guide

> **Version:** 1.0 | **Last Updated:** 2026-03-17  
> **Domain:** https://ccms.pixelspot.in  
> **Branding:** © 2024-2026 PixelSpot Technologies

---

## Table of Contents

1. [Application Summary](#1-application-summary)
2. [Business Model](#2-business-model)
3. [Roles & Responsibilities](#3-roles--responsibilities)
4. [Screen Owner — All Operations](#4-screen-owner--all-operations)
5. [Advertiser — All Operations](#5-advertiser--all-operations)
6. [Admin (PixelSpot) — All Operations](#6-admin-pixelspot--all-operations)
7. [Cross-Role Shared Operations](#7-cross-role-shared-operations)
8. [Operation Flows — Detailed](#8-operation-flows--detailed)
9. [How Everything Connects — Internal Relationships](#9-how-everything-connects--internal-relationships)
10. [Real-Time System](#10-real-time-system)
11. [Player Ecosystem](#11-player-ecosystem)
12. [Entity Relationship Summary](#12-entity-relationship-summary)

---

## 1. Application Summary

**PixelSpot CCMS** (Content & Campaign Management System) is a Digital Out-of-Home (DOOH) advertising SaaS platform. It is a **two-sided marketplace** that connects:

- **Screen Owners** — people or businesses with physical digital displays (shop screens, mall screens, office lobby displays, restaurant TVs)
- **Advertisers** — brands, agencies, or local businesses who want to run video/image ads on those physical screens

The platform handles the entire lifecycle from screen registration → ad campaign creation → slot booking → payment → content delivery → impression tracking → payout settlement.

**What makes it work:**
- A **Raspberry Pi / Android TV / ChromeOS** player device is attached to the physical screen
- The player connects to the platform, downloads a playlist, and plays ads in assigned time slots
- Every ad play is tracked as an **impression**, giving advertisers proof of delivery
- Screen owners get paid based on their screen's bookings

**Tech Stack:** React 19 (TypeScript) frontend, ASP.NET Core 8 backend, PostgreSQL database, Razorpay payments, SignalR WebSockets, Azure Functions for background jobs, Cloudflare R2 for media storage.

---

## 2. Business Model

### Slot-Based Advertising
- Each screen has **6 ad slots per hour** (10 minutes each)
- An advertiser books one or more slots on a screen for a date range (e.g., Slot 3 on Screen "Mall Entrance" from March 20 to April 5)
- The screen owner sets the **price per slot per day**
- The platform charges a **commission percentage** (configured per screen) from the screen owner's earnings

### Revenue Flow
```
Advertiser pays ₹X for booking
         │
         ▼
    Razorpay captures payment
         │
         ▼
    Platform holds funds
         │
         ├── Advance payout to Screen Owner (50%) — after booking starts
         │
         └── Final payout to Screen Owner (remaining) — after booking completes
              minus platform commission
```

### Booking Types
| Type | Description |
|------|-------------|
| **Platform Booking** | Advertiser books a screen through the marketplace |
| **Self-Reserved** | Screen owner reserves their own slot (for personal content, no payment needed) |

---

## 3. Roles & Responsibilities

### Screen Owner
A person or business that owns physical digital displays and wants to monetize them by allowing advertisers to run ads.

**Motivation:** Earn passive income from idle screen time  
**Key activities:** Register screens, approve/reject bookings, monitor screen health, track earnings, request payouts

### Advertiser
A brand, agency, or local business wanting to display ads on physical screens in strategic locations.

**Motivation:** Reach target audiences through strategically placed digital signs  
**Key activities:** Create campaigns, upload creatives (video/image ads), discover and book screens, make payments, track impressions

### Admin (PixelSpot)
The platform operator — PixelSpot team members who manage the marketplace.

**Motivation:** Platform growth, quality control, dispute resolution, payout processing  
**Key activities:** Monitor all activity, verify screens physically, process payouts, manage machines, resolve disputes, platform analytics

---

## 4. Screen Owner — All Operations

### 4.1 Screen Management

| # | Operation | Description |
|---|-----------|-------------|
| 1 | **Register Screen** | Add a new screen with name, location (address + GPS coordinates), resolution, dimensions, timezone, operating hours, pricing, and photos |
| 2 | **Upload Screen Images** | Drag-and-drop upload of screen photos and surrounding area photos (for advertiser reference) |
| 3 | **Set Operating Schedule** | Configure per-day operating hours (Mon–Sun start/end times) |
| 4 | **Set Pricing** | Set price per slot, currency, and commission percentage |
| 5 | **Upload Default Video** | Upload a fallback video that plays when no ads are booked for a slot |
| 6 | **Upload Owner Content** | Upload custom content for specific slots (e.g., store promotions) |
| 7 | **Edit Screen** | Update any screen property — name, location, pricing, schedule |
| 8 | **Delete Screen** | Remove a screen (only if no active bookings) |
| 9 | **View Screen Detail** | See all screen info: images, availability heatmap, tags, live activity, device info, revenue |
| 10 | **View Slot Calendar** | Day-by-day view of all 6 slots showing which are booked, available, or self-reserved |
| 11 | **Monitor Screen Health** | See online/offline status, last seen timestamp, device fingerprint |
| 12 | **Rotate API Key** | Generate a new API key for the player device (invalidates old key) |
| 13 | **View Screen Tags** | See auto-generated tags from location analysis (150+ tags across 17 categories) |
| 14 | **View Revenue Estimates** | Projected vs actual earnings per screen |

#### Flow: Register a New Screen
```
Screen Owner fills form → POST /screens
   │
   ├── Screen created in DB (Status: Active, IsOnline: false)
   ├── API key generated (hashed with BCrypt, plain key shown once)
   ├── Tags auto-assigned based on lat/lng (Google Places API)
   └── Screen appears on public Explore map (if account visibility = Public)
         │
         ▼
   Owner sets up Player device (Raspberry Pi / Android TV / ChromeOS)
   └── Enters Screen ID + API key into player
         │
         ▼
   Player performs Handshake → POST /player/handshake
   └── Screen goes Online (IsOnline: true, LastSeenAt updated)
```

### 4.2 Booking Management

| # | Operation | Description |
|---|-----------|-------------|
| 15 | **View Booking Requests** | See all bookings on owned screens (Active tab + History tab) |
| 16 | **Approve Booking** | Accept an advertiser's booking request — triggers payment order creation |
| 17 | **Reject Booking** | Decline a booking with a reason |
| 18 | **Cancel Booking** | Cancel an existing booking (triggers refund if already paid) |
| 19 | **Self-Reserve Slot** | Reserve a slot on own screen for personal content (no payment required) |
| 20 | **View Booking Detail** | See full booking info: campaign, creative, dates, slot, payment status, impressions |

#### Flow: Approve a Booking
```
Screen Owner clicks "Approve" on a Pending booking
   │
   ▼
Backend: ApproveBookingCommandHandler
   │
   ├── Validates: booking is Pending, screen belongs to owner
   ├── Reserves slots (marks slot availability entries)
   ├── Locks creative (prevents deletion while in use)
   ├── Creates Razorpay order (amount = TotalPrice from booking)
   ├── Optionally creates Virtual Account (for bank transfer option)
   ├── Sets: BookingStatus = Approved
   │         PaymentStatus = OrderCreated
   │         PaymentExpiresAt = now + 24 hours
   │         RazorpayOrderId = order.Id
   ├── Creates Notification → Advertiser ("Your booking was approved, pay within 24h")
   └── Returns success
         │
         ▼
   Advertiser sees "PaymentPending" status with countdown timer
   └── Has 24 hours to complete payment (UPI / Bank Transfer)
```

### 4.3 Financial Operations

| # | Operation | Description |
|---|-----------|-------------|
| 21 | **View Payout Summary** | See total earned, pending payout, completed payouts |
| 22 | **View Payout History** | List of all payout transactions with status |
| 23 | **Request Payout** | Request withdrawal for a specific period |
| 24 | **Add/Edit Bank Account** | Save bank details (account holder, number, IFSC, bank name) |
| 25 | **Delete Bank Account** | Remove stored bank details |
| 26 | **Download Invoice** | Download PDF invoice for a completed booking (QuestPDF-generated) |

#### Flow: Payout Settlement
```
Booking becomes Active (paid + start date reached)
   │
   ▼
Advance Payout created (50% of booking amount - commission)
   │ PayoutType = Advance, PayoutStatus = Pending
   │
   ▼
Admin reviews + processes payout
   │ PayoutStatus = Completed
   │ Screen Owner receives funds to bank account
   │
   ▼
Booking Completes (end date passes)
   │
   ▼
Final Payout created (remaining 50% - commission)
   │ PayoutType = Final, PayoutStatus = Pending
   │
   ▼
Admin reviews delivery summary (expected vs delivered impressions)
   │ Adjusts amount if under-delivery detected
   └── Processes final payout
```

### 4.4 Analytics & Monitoring

| # | Operation | Description |
|---|-----------|-------------|
| 27 | **View Dashboard** | Stat cards (screens, bookings, revenue), screen status grid, approval queue |
| 28 | **View Earnings Analytics** | Revenue charts (daily/weekly/monthly), screen performance table |
| 29 | **View Live Activity** | Real-time play logs, currently playing content, live impression counter |
| 30 | **View Live Stream** | WebRTC live preview of what the screen is currently showing |

---

## 5. Advertiser — All Operations

### 5.1 Campaign Management

| # | Operation | Description |
|---|-----------|-------------|
| 1 | **Create Campaign** | Create a new ad campaign with name, description, date range, budget, currency |
| 2 | **Edit Campaign** | Update campaign details |
| 3 | **Delete Campaign** | Remove campaign (only if no active bookings using its creatives) |
| 4 | **View Campaign List** | See all campaigns with search and status filters |
| 5 | **View Campaign Detail** | See campaign info, creatives, bookings, screen stats |
| 6 | **View Campaign Report** | Aggregated performance across all bookings under campaign |

#### Flow: Create a Campaign
```
Advertiser fills campaign form → POST /campaigns
   │
   ├── Campaign created (Status: Draft)
   ├── No budget is charged yet (budget is informational)
   └── Advertiser proceeds to upload creatives
         │
         ▼
   Advertiser uploads video/image → POST /creatives/upload
   │
   ├── File uploaded to Cloudflare R2 (random GUID filename)
   ├── Thumbnail auto-generated (for video)
   ├── File metadata stored: dimensions, duration, MIME type, SHA hash
   ├── Creative linked to campaign
   └── Creative ready for use in bookings
```

### 5.2 Creative Management

| # | Operation | Description |
|---|-----------|-------------|
| 7 | **Upload Creative** | Drag-and-drop upload of video (MP4) or image (JPEG/PNG), max 100MB |
| 8 | **View Creative** | Preview uploaded creative (video player or image viewer) |
| 9 | **Delete Creative** | Remove creative (only if not locked by an active booking) |
| 10 | **View Creative Lock Status** | Check if creative is locked (used in an approved/active booking) |

#### Flow: Upload a Creative
```
Advertiser drags video file into upload zone
   │
   ▼
Frontend: validates file type + size client-side
   │
   ▼
POST /creatives/upload (multipart form data)
   │
   ├── Server validates MIME type (server-side, not just Content-Type header)
   ├── Generates random GUID filename (never uses user-provided name)
   ├── Uploads to Cloudflare R2 storage
   ├── Extracts metadata: width, height, duration, file hash
   ├── Generates thumbnail if video
   ├── Stores Creative entity in DB
   └── Returns creative details to frontend
         │
         ▼
   Frontend shows preview (video player or image)
```

### 5.3 Screen Discovery & Booking

| # | Operation | Description |
|---|-----------|-------------|
| 11 | **Discover Screens** | Browse public screens on an interactive map with filters (location, tags, price, availability) |
| 12 | **Explore Screens (Public)** | Browse screens without logging in (public Leaflet map with clustered markers) |
| 13 | **View Screen Detail** | See screen info, images, availability heatmap, tags, location |
| 14 | **Check Slot Availability** | View which slots are available on specific dates for a screen |
| 15 | **Create Booking** | Book one or more slots on a screen for a date range |
| 16 | **View Bookings List** | See all bookings with Active/History tabs, filters, and status chips |
| 17 | **View Booking Detail** | Full booking info with payment status, impressions, and actions |
| 18 | **Pay for Booking** | Complete payment via UPI QR, UPI apps, or bank transfer |
| 19 | **Cancel Booking** | Cancel a booking (refund if already paid) |
| 20 | **Update Booking Dates** | Change start/end dates for an approved booking (re-triggers approval) |
| 21 | **Re-request Rejected Booking** | Modify and resubmit a rejected booking |

#### Flow: Book a Screen (End-to-End)
```
Step 1: Discover
   Advertiser opens Discover Screens → Leaflet map loads
   ├── Filters: location, tags, price range
   ├── Clicks screen marker → sees screen detail popup
   └── Clicks "Book" → opens BookScreenDialog

Step 2: Create Booking
   Advertiser selects: Campaign → Creative → Date Range → Slot(s)
   │
   ├── Frontend calls GET /screens/{id}/slot-calendar → shows availability
   ├── Calculates price: slots × days × pricePerSlot
   └── Confirms in BookingConfirmationDialog → POST /bookings
         │
         ▼
   Backend: CreateBookingCommand
   ├── Validates: campaign belongs to advertiser
   ├── Validates: creative belongs to campaign
   ├── Validates: screen exists and slots are available
   ├── Validates: dates are in the future
   ├── Calculates ExpectedImpressions
   ├── Creates Booking (Status: Pending, PaymentStatus: None)
   ├── Creates Notification → Screen Owner ("New booking request")
   └── Returns booking ID

Step 3: Screen Owner Approves
   (See flow in Section 4.2 — Approve a Booking)
   └── PaymentStatus → OrderCreated, 24h countdown starts

Step 4: Advertiser Pays
   Advertiser clicks "Pay Now" → PaymentScreen opens
   │
   ├── Tab 1: UPI QR Code (scan with any UPI app)
   ├── Tab 2: UPI App Links (GPay, PhonePe, Paytm, BHIM deep links)
   └── Tab 3: Bank Transfer (Virtual Account number + IFSC)
         │
         ▼
   Payment captured by Razorpay
   ├── Webhook: payment.captured → POST /payments/webhook
   ├── PaymentStatus → Captured
   ├── RazorpayPaymentId stored
   ├── If start date ≤ today: BookingStatus → Active immediately
   │   Else: stays Approved (Azure Function transitions later)
   ├── Advance Payout created for Screen Owner
   └── Notification → Screen Owner ("Payment received for booking")

Step 5: Booking Goes Active
   Azure Function (every 15 min) checks:
   ├── Is PaymentStatus == Captured?
   ├── Is StartDate ≤ today?
   └── If both: BookingStatus → Active
         │
         ▼
   Player gets updated playlist on next sync
   └── Ad starts playing on physical screen

Step 6: Impressions Tracked
   Player plays ad → records impression locally
   ├── Syncs to server every 1-10 min (adaptive based on viewer presence)
   ├── Each impression has SlotPlayKey (SHA256 dedup)
   ├── Server validates and stores in Impressions table
   └── Daily aggregation into ImpressionDailySummary

Step 7: Booking Completes
   Azure Function detects end date passed
   ├── BookingStatus → Completed
   ├── Creative unlocked
   ├── Slots released
   └── Final payout created for Screen Owner
```

### 5.4 Payment

| # | Operation | Description |
|---|-----------|-------------|
| 22 | **Pay via UPI QR** | Scan QR code with any UPI app |
| 23 | **Pay via UPI App** | Deep link to GPay, PhonePe, Paytm, or BHIM |
| 24 | **Pay via Bank Transfer** | Transfer to a Razorpay Virtual Account |
| 25 | **View Payment Status** | Real-time polling shows payment progress |
| 26 | **Download Invoice** | Download PDF invoice for paid booking |

#### Flow: Payment Processing
```
Frontend: PaymentScreen component
   │
   ├── Calls POST /payments/create-order
   │   ├── Backend checks: does Razorpay order already exist? (idempotent)
   │   │   ├── Yes → return existing order details
   │   │   └── No → create new Razorpay order
   │   └── Returns: orderId, amount, currency, keyId, virtualAccount, expiresAt
   │
   ├── Displays 3 payment tabs:
   │   ├── UPI QR: QRCodeSVG with Razorpay UPI link
   │   ├── UPI Apps: Deep links with amount pre-filled
   │   └── Bank Transfer: Virtual account number + IFSC + copy button
   │
   ├── usePaymentPoller hook runs (polls every 5 seconds):
   │   └── GET /payments/booking/{bookingId}/status
   │       ├── Returns: paymentStatus, razorpayPaymentId, paymentMethod
   │       └── Stops polling when status is terminal (Captured/Expired)
   │
   └── On capture detected:
       ├── Dialog shows success state with checkmark
       ├── React Query cache invalidated (bookings refetched)
       └── Snackbar: "Payment successful!"

Backend: Razorpay Webhook (async)
   │
   ├── POST /payments/webhook
   ├── Validates HMAC-SHA256 signature
   ├── Finds booking by RazorpayOrderId
   ├── Event: payment.captured
   │   ├── PaymentStatus → Captured
   │   ├── BookingStatus → Active (if start date ≤ today)
   │   ├── Creates Payment record
   │   └── Creates Advance Payout for screen owner
   │
   ├── Event: payment.failed
   │   └── Logs failure (booking remains Approved for retry)
   │
   ├── Event: refund.processed
   │   ├── PaymentStatus → Refunded
   │   └── Creates Notification → Advertiser
   │
   └── Event: virtual_account.credited
       └── Same as payment.captured flow

Payment Expiry:
   Azure Function (every 15 min)
   ├── Finds OrderCreated bookings where PaymentExpiresAt < now
   ├── BookingStatus → Cancelled
   ├── PaymentStatus → Expired
   ├── Releases reserved slots
   ├── Unlocks creative
   └── Notification → Advertiser ("Booking expired due to non-payment")
```

### 5.5 Analytics & Reports

| # | Operation | Description |
|---|-----------|-------------|
| 27 | **View Dashboard** | Stat cards (campaigns, bookings, impressions, spend), campaign performance chart |
| 28 | **View Campaign Analytics** | Impressions chart, campaign comparison, screen-level breakdown |
| 29 | **View Booking Report** | Per-booking impression report with daily chart, play logs |
| 30 | **View Campaign Report** | Aggregated performance across all bookings in a campaign |
| 31 | **Download Report PDF** | Download booking invoice / report as PDF |

---

## 6. Admin (PixelSpot) — All Operations

### 6.1 Platform Monitoring

| # | Operation | Description |
|---|-----------|-------------|
| 1 | **View Dashboard** | Platform-wide stats: total users, screens, campaigns, bookings, revenue |
| 2 | **View Platform Analytics** | GMV, active screens, fill rates, growth charts |
| 3 | **View All Bookings** | See every booking across the entire platform |
| 4 | **View All Campaigns** | See every campaign across the entire platform |
| 5 | **View All Screens** | See every screen across the entire platform |

### 6.2 Financial Operations

| # | Operation | Description |
|---|-----------|-------------|
| 6 | **View Pending Payouts** | List of all screen owner payout requests awaiting processing |
| 7 | **Process Payout** | Approve and release funds to screen owner's bank account |
| 8 | **Fail Payout** | Mark payout as failed with reason |
| 9 | **Release Final Payout** | Release final payout after booking completion (with optional adjustment) |
| 10 | **View Delivery Summary** | Compare expected vs delivered impressions before releasing final payout |
| 11 | **View Payout History** | Complete payout transaction log |
| 12 | **Refund Payment** | Manually initiate a refund for any payment |

#### Flow: Process a Payout
```
Advance payout auto-created when payment captured
   │
   ▼
Admin opens Admin Payouts page → sees pending payouts
   │
   ├── Reviews: booking details, screen owner, amount, commission
   ├── For Final payouts: checks delivery summary
   │   ├── Expected impressions: 4,320
   │   ├── Delivered impressions: 4,100 (95%)
   │   └── Admin decides: full amount or adjusted
   │
   ├── Admin clicks "Process" 
   │   ├── Machine fingerprint validation (authorized admin machine)
   │   ├── PayoutStatus → Completed
   │   ├── Notification → Screen Owner ("Payout processed: ₹X")
   │   └── Funds transferred to bank account
   │
   └── OR Admin clicks "Fail" with reason
       ├── PayoutStatus → Failed
       └── Notification → Screen Owner ("Payout failed: {reason}")
```

### 6.3 Screen Verification

| # | Operation | Description |
|---|-----------|-------------|
| 13 | **View Pending Verifications** | Screens awaiting physical verification |
| 14 | **Admin-Verify Screen** | Manually verify a screen (bypasses QR flow) |
| 15 | **Review QR Verification** | Review QR scan submitted by user, approve or reject |

#### Flow: Screen Verification (QR-Based)
```
Player displays QR challenge code on screen (refreshes every 5 min)
   │
   ├── Backend: POST /screens/{id}/verification/qr-challenge
   │   └── Returns: challengeCode, expiresAt
   │
   ▼
User physically at the screen location scans QR code
   │
   ├── POST /screens/{id}/verification/qr-verify
   │   ├── Validates challenge code is correct and not expired
   │   └── VerificationStatus → PendingReview
   │
   ▼
Admin reviews verification
   │
   ├── POST /screens/{id}/verification/admin-verify
   │   ├── VerificationStatus → Verified
   │   └── VerifiedAt + VerifiedByAdminUserId set
   │
   └── OR Admin rejects
       └── VerificationStatus → Rejected (with notes)
```

### 6.4 Machine Authorization

| # | Operation | Description |
|---|-----------|-------------|
| 16 | **View All Machines** | List of admin-authorized machines for sensitive operations |
| 17 | **Authorize Machine** | Register a new admin machine by fingerprint |
| 18 | **Revoke Machine** | Deauthorize a previously trusted machine |
| 19 | **Check Machine Status** | Verify if a specific machine fingerprint is authorized |

### 6.5 System Operations

| # | Operation | Description |
|---|-----------|-------------|
| 20 | **Trigger Booking Status Update** | Manually run the Azure Function logic (dev/debug) |
| 21 | **View Health Check** | Platform and database health status |
| 22 | **Clear Cache** | Purge application-level caches |

---

## 7. Cross-Role Shared Operations

These operations are available to all authenticated users regardless of role.

### 7.1 Authentication

| # | Operation | Description |
|---|-----------|-------------|
| 1 | **Register** | Create account as Screen Owner or Advertiser |
| 2 | **Login** | Email + password authentication |
| 3 | **Verify Email** | Click verification link from email |
| 4 | **Verify Phone** | Enter 6-digit OTP sent to phone |
| 5 | **Resend Verification** | Re-trigger email or phone verification |
| 6 | **Forgot Password** | Request password reset link |
| 7 | **Reset Password** | Set new password via reset token |
| 8 | **Logout** | Revoke refresh token |

#### Flow: Registration → First Login
```
User fills registration form
   │
   ├── POST /auth/register
   │   ├── Creates User (IsEmailVerified: false, IsPhoneVerified: false)
   │   ├── Hashes password with BCrypt
   │   ├── Sends verification email (token-based link)
   │   └── Sends phone OTP
   │
   ▼
User clicks email verification link
   │
   ├── POST /auth/verify-email?token=xxx
   │   └── IsEmailVerified → true
   │
   ▼
User enters phone OTP
   │
   ├── POST /auth/verify-phone-otp
   │   ├── Validates OTP + expiry + attempt count
   │   └── IsPhoneVerified → true
   │
   ▼
User logs in
   │
   ├── POST /auth/login
   │   ├── Validates email + password (BCrypt compare)
   │   ├── Checks: IsEmailVerified && IsPhoneVerified
   │   ├── Generates JWT access token (15-min expiry)
   │   ├── Generates refresh token (7-day sliding expiry)
   │   └── Returns: accessToken, refreshToken, user profile
   │
   ▼
Frontend stores tokens → redirects to Dashboard
   └── Axios interceptor auto-refreshes token when expired
```

### 7.2 Profile & Settings

| # | Operation | Description |
|---|-----------|-------------|
| 9 | **View Profile** | See all personal information |
| 10 | **Update Profile** | Edit name, phone, company name, GST number |
| 11 | **Upload Profile Image** | Change profile picture |
| 12 | **Change Password** | Update password (requires current password) |
| 13 | **Set Timezone** | Choose preferred timezone (IANA format) |
| 14 | **Set Visibility** | Toggle account visibility (Public/Private) — Screen Owner only |

### 7.3 Notifications

| # | Operation | Description |
|---|-----------|-------------|
| 15 | **View Notifications** | Chronological feed of all notifications |
| 16 | **Mark as Read** | Mark individual notification as read |
| 17 | **Mark All as Read** | Clear all unread notifications |
| 18 | **Unread Count Badge** | Real-time unread count in navbar (via SignalR) |

#### Notification Types & Triggers
| Event | Recipients | Message |
|-------|-----------|---------|
| Booking Created | Screen Owner | "New booking request for {screen}" |
| Booking Approved | Advertiser | "Your booking was approved — pay within 24h" |
| Booking Rejected | Advertiser | "Your booking was rejected: {reason}" |
| Booking Cancelled | Both parties | "Booking was cancelled" |
| Booking Updated | Screen Owner | "Advertiser updated booking dates" |
| Payment Received | Screen Owner, Admin | "Payment of ₹{amount} received for booking" |
| Refund Processed | Advertiser | "Refund of ₹{amount} processed" |
| Payout Advance Processed | Screen Owner | "Advance payout of ₹{amount} processed" |
| Payout Final Pending | Admin | "Final payout pending for booking {id}" |
| Payout Final Processed | Screen Owner | "Final payout of ₹{amount} processed" |
| System Alert | Targeted user(s) | Platform-specific messages |

---

## 8. Operation Flows — Detailed

### 8.1 Complete Booking Lifecycle (Master Flow)

This is the central flow that ties together Screen Owners, Advertisers, the Platform, and the Player.

```
                    ADVERTISER                           SCREEN OWNER                         ADMIN
                        │                                     │                                 │
    ┌───────────────────┤                                     │                                 │
    │ Creates Campaign  │                                     │                                 │
    │ Uploads Creative  │                                     │                                 │
    └───────────────────┤                                     │                                 │
                        │                                     │                                 │
    ┌───────────────────┤                                     │                                 │
    │ Discovers Screens │                                     │                                 │
    │ Checks Slots      │                                     │                                 │
    │ Creates Booking ──┼──── Notification: "New request" ───▶│                                 │
    └───────────────────┤                                     │                                 │
                        │                               ┌─────┤                                 │
                        │                               │Reviews│                                │
                        │                               │Booking│                                │
                        │                               └──┬──┘                                 │
                        │                                  │                                    │
                        │              ┌───────────────────┼───────────────────┐                │
                        │              ▼                   │                   ▼                │
                        │         [APPROVE]                │             [REJECT]               │
                        │              │                   │                   │                │
                        │    Razorpay Order Created         │     Notification ──▶ Advertiser    │
                        │    Slots Reserved                │     (with reason)                  │
                        │    Creative Locked               │                                    │
                        │    24h Payment Window             │                                    │
                        │              │                   │                                    │
    ┌───────────────────┤◀─ Notification                   │                                    │
    │ PaymentPending    │  "Pay within 24h"                │                                    │
    │ Countdown Timer   │                                  │                                    │
    │                   │                                  │                                    │
    │ Opens Payment     │                                  │                                    │
    │ Screen (UPI/Bank) │                                  │                                    │
    └──────────┬────────┤                                  │                                    │
               │        │                                  │                                    │
               ▼        │                                  │                                    │
    ┌─────────────────┐ │                                  │                                    │
    │ RAZORPAY        │ │                                  │                                    │
    │ Captures Payment│ │                                  │                                    │
    └────────┬────────┘ │                                  │                                    │
             │          │                                  │                                    │
             │   Webhook: payment.captured                 │                                    │
             │          │                                  │                                    │
             ├──────────┼── PaymentStatus → Captured       │                                    │
             ├──────────┼── Booking → Active (if date)     │                                    │
             ├──────────┼── Advance Payout Created ────────┼──────────── Visible ──────────────▶│
             └──────────┼── Notification ──────────────────▶ "Payment received"                 │
                        │                                  │                                    │
                        │                                  │                   ┌────────────────┤
                        │                                  │                   │ Process Payout │
                        │                                  │◀─ Notification ── │ to Screen Owner│
                        │                                  │  "₹X deposited"  └────────────────┤
                        │                                  │                                    │
    ════════════════════╪══════════════════════════════════╪════════════════════════════════════╪═══
                        │          BOOKING ACTIVE — ADS PLAYING ON SCREEN                      │
    ════════════════════╪══════════════════════════════════╪════════════════════════════════════╪═══
                        │                                  │                                    │
                   PLAYER DEVICE                           │                                    │
                   ┌────────────┐                          │                                    │
                   │ Plays Ads  │                          │                                    │
                   │ Tracks     │  Impressions synced      │                                    │
                   │ Impressions│  every 1-10 min          │                                    │
                   └────────────┘                          │                                    │
                        │                                  │                                    │
    ════════════════════╪══════════════════════════════════╪════════════════════════════════════╪═══
                        │          BOOKING COMPLETES (END DATE PASSES)                         │
    ════════════════════╪══════════════════════════════════╪════════════════════════════════════╪═══
                        │                                  │                                    │
             Azure Function: Booking → Completed           │                                    │
                        │                                  │                   ┌────────────────┤
                        │  Final Payout Created ───────────┼──────────────────▶│ Reviews        │
                        │  Creative Unlocked               │                   │ Delivery       │
                        │  Slots Released                  │                   │ Processes Final│
                        │                                  │◀─ Notification ── │ Payout         │
                        │                                  │  "₹X deposited"  └────────────────┤
                        │                                  │                                    │
```

### 8.2 Cancellation & Refund Flow

```
Either party clicks "Cancel Booking"
   │
   ▼
POST /bookings/{id}/cancel
   │
   ├── Validates: booking is in cancellable state (Pending/Approved/Active)
   │
   ├── If PaymentStatus == Captured (money was paid):
   │   ├── Calls Razorpay Refund API
   │   ├── PaymentStatus → RefundInitiated
   │   ├── RazorpayRefundId stored
   │   └── Azure Function polls refund status every 15 min
   │       └── When Razorpay confirms: PaymentStatus → Refunded
   │
   ├── If PaymentStatus == OrderCreated (not yet paid):
   │   └── PaymentStatus → Expired
   │
   ├── If PaymentStatus == None (Pending booking):
   │   └── No payment action needed
   │
   ├── BookingStatus → Cancelled
   ├── Slots released back to available
   ├── Creative unlocked
   ├── Notifications → both parties
   └── If payout was already created → payout voided/adjusted
```

### 8.3 Screen Owner Self-Reservation Flow

```
Screen Owner wants to use their own slot for promotional content
   │
   ▼
POST /bookings/self-reserve
   │
   ├── Body: screenId, slotNumbers, startDate, endDate, clientName (optional)
   ├── Validates: owner owns the screen
   ├── Validates: requested slots are available
   ├── Creates Booking with:
   │   ├── Source = SelfReserved
   │   ├── BookingStatus = Active (immediately, no approval needed)
   │   ├── PaymentStatus = None (no payment required)
   │   └── TotalPrice = 0
   ├── Slots marked as reserved
   └── If owner uploaded content → plays that; else → plays default video
```

### 8.4 Token Refresh Flow

```
Frontend Axios interceptor detects 401 Unauthorized
   │
   ├── Puts all pending requests in a queue
   ├── POST /auth/refresh (with refreshToken)
   │   ├── Success → new accessToken + new refreshToken
   │   │   ├── Stores new tokens
   │   │   └── Retries all queued requests with new token
   │   └── Failure (refresh token expired/revoked)
   │       ├── Clears auth state (Zustand store)
   │       └── Redirects to /login
   │
   └── Rate limiting: auth endpoints limited to 10 req/min
```

---

## 9. How Everything Connects — Internal Relationships

### 9.1 Entity Relationships

```
User (Role: ScreenOwner)
 ├── owns → Screen (1:many)
 │            ├── has → ScreenImage (1:many)
 │            ├── has → ScreenTag (many:many via ScreenTagAssignment)
 │            ├── has → OwnerContent (1:many, per slot)
 │            ├── has → SlotAvailability (1:many, per date per slot)
 │            ├── has → ScreenVerification (1:many)
 │            └── appears in → Booking (1:many)
 ├── has → BankAccount (1:1)
 ├── receives → Payout (1:many)
 └── receives → Notification (1:many)

User (Role: Advertiser)
 ├── creates → Campaign (1:many)
 │               └── has → Creative (1:many)
 │                          └── used in → Booking (1:many)
 ├── creates → Booking (1:many)
 │               ├── belongs to → Screen
 │               ├── belongs to → Campaign
 │               ├── uses → Creative
 │               ├── has → Payment (1:many)
 │               ├── has → Impression (1:many)
 │               ├── generates → Payout (to screen owner)
 │               └── has → SlotAvailability entries
 └── receives → Notification (1:many)

User (Role: Admin)
 ├── processes → Payout
 ├── verifies → Screen (via ScreenVerification)
 ├── has → AdminAuthorizedMachine (for payout security)
 └── receives → Notification (1:many)
```

### 9.2 Booking is the Central Entity

The **Booking** entity is the nucleus of the entire system. Almost everything relates back to it:

```
                              ┌──────────┐
                              │ Campaign │
                              └────┬─────┘
                                   │ contains creatives,
                                   │ groups bookings
                              ┌────▼─────┐
        ┌─────────┐          │          │          ┌────────┐
        │ Screen  │◀─────────│ BOOKING  │─────────▶│Creative│
        └────┬────┘          │          │          └────────┘
             │               └──┬──┬──┬─┘
             │                  │  │  │
    ┌────────▼────────┐   ┌────▼┐ │ ┌▼──────┐
    │SlotAvailability │   │Pay- │ │ │Impres-│
    │(reserves slots) │   │ment │ │ │sions  │
    └─────────────────┘   └─────┘ │ └───────┘
                                  │
                            ┌─────▼─────┐
                            │  Payout   │
                            │(to owner) │
                            └───────────┘
```

**How they connect:**
- A **Booking** links an **Advertiser's Creative** (from a **Campaign**) to a **Screen Owner's Screen** for specific date range and time slots
- When a Booking is approved, **SlotAvailability** entries are reserved, preventing double-booking
- When payment is captured, a **Payment** record is created and an advance **Payout** is generated for the Screen Owner
- When the player plays the ad, **Impressions** are recorded against the Booking
- When the Booking completes, the final **Payout** is generated based on delivered Impressions

### 9.3 Data Flow: API → CQRS → Database

```
Frontend (React)
   │
   ├── Axios HTTP request
   │
   ▼
Controller (ASP.NET Core)
   │
   ├── Model binding + basic auth check
   │
   ▼
MediatR Dispatch
   │
   ├── Command (write) or Query (read)
   │
   ▼
Handler
   │
   ├── FluentValidation (input validation)
   ├── Business logic
   ├── Entity Framework Core (DB operations)
   ├── External services (Razorpay, R2, email, SMS)
   │
   ▼
Response → Controller → JSON → Frontend
   │
   └── SignalR broadcasts (if real-time event)
       └── Connected clients receive updates
```

### 9.4 Payment ↔ Booking ↔ Payout Chain

```
ORDER CREATED            PAYMENT CAPTURED          BOOKING ACTIVE              BOOKING COMPLETED
─────────────────────▶──────────────────────▶─────────────────────────▶──────────────────────────
                      │                      │                         │
Razorpay Order        │  Razorpay Payment    │  Player plays ads       │  Azure Function
PaymentStatus:        │  PaymentStatus:      │  Impressions tracked    │  BookingStatus:
  OrderCreated        │    Captured          │  Advance payout created │    Completed
24h countdown         │  Create Payment      │  Admin processes payout │  Final payout created
                      │  entity              │                         │  Admin reviews delivery
                      │                      │                         │  Admin processes final
```

### 9.5 Real-Time Event Chain

```
Player Device                  Backend (SignalR)              Frontend (React)
─────────────────────────────────────────────────────────────────────────────
Plays ad (slot 3)        →    AdStarted event          →    LiveActivityTab updates
Ad completes (10 min)    →    AdCompleted event         →    Impression counter +1
                              + Impression recorded           Dashboard sparkline updates
                              
Heartbeat (30s)          →    Screen status updated     →    ScreenStatusGrid: "Online"
                              LastSeenAt refreshed

Missing heartbeat (5min) →    Screen marked offline     →    ScreenStatusGrid: "Offline"

Booking approved         →    Playlist recalculated     →    Player gets new playlist
                              SlotStatusChanged event          on next sync cycle
```

---

## 10. Real-Time System

### SignalR Hubs & Their Purpose

| Hub | Purpose | Who Connects |
|-----|---------|-------------|
| **PlayerHub** | Player ↔ Server communication: handshake, sync, heartbeat | Player devices |
| **PlaybackHub** | Live ad events: ad started/completed, slot changes, screen status | Dashboard users, advertisers |
| **StreamingHub** | WebRTC signaling for live screen preview | Player (broadcaster), Users (viewers) |
| **NotificationHub** | Push notifications to authenticated users | All authenticated users |

### Event Flow Examples

**When an ad starts playing:**
```
Player → PlaybackHub.AdStarted(screenId, creativeId, slotNumber, timestamp)
   │
   ├── Server broadcasts to: ScreenSubscribers (screen owner dashboard)
   ├── Server broadcasts to: CampaignSubscribers (advertiser tracking)
   └── Server broadcasts to: BookingSubscribers (both parties)
```

**When a booking is approved:**
```
Backend → NotificationHub.ReceiveNotification → Advertiser
   │
   ├── Unread count badge updates in real-time
   └── Notification appears in feed
   
Backend → PlaybackHub.SlotStatusChanged → Screen detail subscribers
   └── Availability heatmap/calendar updates live
```

---

## 11. Player Ecosystem

### Three Player Implementations

| Platform | Technology | Use Case |
|----------|-----------|----------|
| **Raspberry Pi** | Python + MPV player | Primary — cheap, reliable, purpose-built |
| **Android TV** | Kotlin + ExoPlayer (Media3) | Smart TVs, Android-based displays |
| **ChromeOS** | TypeScript + Vite PWA | Chrome devices, browser-based displays |

### Player Communication Protocol

```
1. HANDSHAKE (startup)
   Player → POST /player/handshake
   ├── Sends: screenId, apiKey, deviceFingerprint, playerVersion
   ├── Server validates API key (BCrypt compare)
   ├── Server validates device fingerprint binding
   └── Returns: playlist (videos/images with slot assignments), syncInterval, serverTime

2. HEARTBEAT (every 30 seconds)
   Player → SignalR: PlayerHub.HeartBeat(screenId)
   ├── Server updates: Screen.IsOnline = true, LastSeenAt = now
   └── If missed for 5 min: Screen.IsOnline = false

3. CONTENT PLAYBACK (continuous)
   Player checks current time → determines active slot (1-6)
   ├── Looks up playlist assignment for this slot
   ├── If booked: plays advertiser's creative (video/image)
   ├── If owner content: plays screen owner's custom content
   └── If empty: plays default video (or PixelSpot branding)
   
   Each play → records impression locally:
   └── {screenId, bookingId, creativeId, slotNumber, playedAt, slotPlayKey}

4. SYNC (every 1-10 minutes, adaptive)
   Player → POST /player/sync
   ├── Batch uploads local impressions
   ├── Server validates SlotPlayKey (SHA256 dedup)
   ├── Server stores in Impressions table
   └── Returns: updated playlist (if changed), new sync interval

5. SIGNALR EVENTS (real-time)
   Server → Player:
   ├── PlaylistUpdated → Player re-downloads playlist
   ├── SlotStatusChanged → Slot booking changed
   ├── SetSyncMode("fast") → Switch to 1-min sync (viewer is watching)
   └── SetSyncMode("normal") → Switch to 10-min sync (no viewer)
```

### Impression Tracking & Integrity

```
Security measures for impression authenticity:

1. SlotPlayKey = SHA256(screenId | date | slotNumber | secondOfDay)
   └── Prevents duplicate counting — UNIQUE constraint in DB

2. VerificationHash = HMAC-SHA256(bookingId + playedAt + slotNumber, apiKey)
   └── Server verifies hash to ensure impression came from authorized player

3. Device Fingerprint binding
   └── Each screen bound to specific device hardware — prevents spoofing

4. Server-side dedup via UNIQUE(SlotPlayKey) constraint
   └── Even if player sends same impression twice, DB rejects duplicate
```

---

## 12. Entity Relationship Summary

### Core Entities & Counts

| Entity | Key Purpose | Approximate Relations |
|--------|------------|----------------------|
| **User** | Platform participant | → Screens, Campaigns, Bookings, Payments, Notifications |
| **Screen** | Physical digital display | → Bookings, Images, Tags, Slots, Verifications, OwnerContent |
| **Campaign** | Ad campaign container | → Creatives, Bookings |
| **Creative** | Video/image ad asset | → Bookings (locked when in use) |
| **Booking** | Slot reservation (nucleus) | → Screen, Campaign, Creative, Payments, Impressions, Payouts, Slots |
| **Payment** | Razorpay transaction record | → Booking, User |
| **Payout** | Screen owner earnings | → Booking, ScreenOwner |
| **Impression** | Single ad play event | → Booking, Screen, Campaign, Creative |
| **Notification** | User alert | → User, Reference entity |
| **SlotAvailability** | Slot reservation tracker | → Screen, Booking |
| **ScreenTag** | Location categorization | → Screens (many:many) |
| **BankAccount** | Payout destination | → User (1:1) |

### Status Enums Quick Reference

| Entity | Statuses |
|--------|----------|
| **Booking** | Pending → Approved → Active → Completed / Cancelled / Rejected |
| **Payment** | None → OrderCreated → Captured / Expired / RefundInitiated → Refunded |
| **Campaign** | Draft → Active → Paused → Completed / Cancelled |
| **Payout** | Pending → Processing → Completed / Failed |
| **Screen** | Active / Inactive / Maintenance / Offline |
| **Verification** | Unverified → QrDisplayed → PendingReview → Verified / Rejected |

---

*This document provides a complete operational view of PixelSpot CCMS. For technical implementation details, see [APPLICATION_FLOW.md](APPLICATION_FLOW.md). For UI specifications, see [docs/UI_DESCRIPTION.md](docs/UI_DESCRIPTION.md).*
