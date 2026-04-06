# Private Screens — End-to-End Implementation Document

> **Feature**: Account-level Private/Public visibility for Screen Owners  
> **Scope**: Separate registration, portal UI adaptation, admin approval for Private→Public  
> **Status**: Planning (pre-implementation)

---

## Table of Contents

1. [Feature Overview](#1-feature-overview)
2. [User Stories](#2-user-stories)
3. [System Architecture](#3-system-architecture)
4. [Flow 1: Private Screen Owner Registration](#4-flow-1-private-screen-owner-registration)
5. [Flow 2: Private Screen Owner Portal Experience](#5-flow-2-private-screen-owner-portal-experience)
6. [Flow 3: Public→Private Toggle (Self-Service)](#6-flow-3-publicprivate-toggle)
7. [Flow 4: Private→Public Request + Admin Approval](#7-flow-4-privatepublic-request--admin-approval)
8. [Flow 5: Backend Visibility Enforcement](#8-flow-5-backend-visibility-enforcement)
9. [Flow 6: Admin Visibility Management Portal](#9-flow-6-admin-visibility-management-portal)
10. [Database Changes](#10-database-changes)
11. [API Contract](#11-api-contract)
12. [Frontend Component Changes](#12-frontend-component-changes)
13. [Notification System](#13-notification-system)
14. [Security Considerations](#14-security-considerations)
15. [Migration Strategy](#15-migration-strategy)
16. [Testing Plan](#16-testing-plan)
17. [File Change Inventory](#17-file-change-inventory)

---

## 1. Feature Overview

### What is a Private Screen Owner?

A Private Screen Owner uses PixelSpot CCMS purely for **self-managed digital signage** — playing their own content on their own screens without participating in the advertising marketplace.

### Key Behaviors

| Aspect | Public (Marketplace) | Private (Self-Managed) |
|--------|---------------------|----------------------|
| Screens visible to advertisers | Yes | No |
| Can receive booking requests | Yes | No |
| Pricing / Slots / Tags | Configurable | Hidden from UI |
| Payouts / Revenue | Yes | N/A |
| Device management | Yes | Yes |
| Default video / content | Yes | Yes |
| Live preview / streaming | Yes | Yes |
| Operating schedule | Yes | Yes |
| Registration path | `/register` (standard) | `/register/private` (dedicated link) |
| Switch to Public | N/A | Requires admin approval |
| Switch to Private | Allowed if no active/upcoming bookings | N/A (already private) |

### What Already Exists

- `User.AccountVisibility` field in DB (`ScreenVisibility.Public = 0`, `Private = 1`), defaults to `Public`
- `ExploreScreens` (public API) already filters by `AccountVisibility == Public`
- `SearchScreens` (authenticated API) already filters by `AccountVisibility == Public`
- Profile settings page has a `Switch` toggle for visibility
- `CreateBookingCommandHandler` already checks `AccountVisibility` and blocks private

### What's Missing

- Separate registration page for Private screen owners
- Backend registration to accept `AccountVisibility` from the dedicated registration path
- Admin approval workflow for Private→Public transitions
- New domain entity: `VisibilityChangeRequest`
- Backend enforcement on authenticated endpoints (`GetScreensPaged`, `GetScreenById`, `SlotCalendar`, `SlotAvailability`)
- Frontend portal UI conditional rendering (hide marketplace-related features for private accounts)
- Admin portal page for managing visibility requests
- Route guards on frontend for private accounts
- Notification types for visibility approval/rejection

---

## 2. User Stories

### US-1: Private Registration
> As a screen owner who only wants to manage my own digital signage, I can register via a dedicated private link (`/register/private`) so my account starts as Private and I'm never exposed to the marketplace.

**Acceptance Criteria:**
- `/register/private` renders the same registration form but with role locked to `ScreenOwner` and `AccountVisibility` set to `Private`
- No role selector shown (role is always `ScreenOwner`)
- After registration, the user enters the Private portal experience immediately (after email + phone verification)
- The standard `/register` page is unaffected

### US-2: Private Portal Experience
> As a private screen owner, I see a simplified portal that shows only device management, content management, and screen status — without bookings, payouts, pricing, tags, or revenue.

**Acceptance Criteria:**
- Sidebar hides: "Booking Requests", "Payouts"
- Sidebar shows: "Dashboard", "My Screens", "Screen Analytics", "Settings"
- Dashboard shows: "Total Screens", "Screens Online" stat cards + `ScreenStatusGrid` + relevant quick actions
- Dashboard hides: "Pending Requests", "Active Bookings", "Total Revenue", `OwnerApprovalQueue`
- Screen detail hides: Tags, Verification, Pricing, Revenue Estimate, Availability Heatmap
- Screen create/edit hides: Price per slot, Commission %, Tags
- Analytics shows: Screen uptime, Screens online, Total impressions
- Analytics hides: Revenue, Earnings, Active bookings
- `/bookings` and `/payouts` URLs redirect to `/dashboard` with toast

### US-3: Public→Private Toggle
> As a public screen owner with NO active or upcoming bookings, I can switch my account to Private via the profile settings toggle.

**Acceptance Criteria:**
- Confirmation dialog: "All your screens will be hidden from the marketplace. Are you sure?"
- Backend validates: no bookings with `Status IN (Pending, Approved, Active)` AND `EndDate >= today` on any owned screen
- If bookings exist: 400 error with message listing booking count
- If no bookings: immediate switch to Private, portal UI updates
- Success toast: "Your account is now private. Screens are hidden from the marketplace."

### US-4: Private→Public Request
> As a private screen owner, I can request to switch my account to Public. This sends a request to the admin for approval.

**Acceptance Criteria:**
- Profile settings shows a "Request Public Access" button (not an instant toggle) when account is Private
- Clicking opens a dialog with an optional message/reason field
- Creates a `VisibilityChangeRequest` in DB with status `Pending`
- Sends notification to all admins: "Screen owner {name} has requested public marketplace access"
- User sees a "Pending Approval" status badge on their profile
- While pending: user cannot submit another request (button disabled)
- If request was previously rejected: user can re-submit with a new reason

### US-5: Admin Approval
> As an admin, I can view, approve, or reject visibility change requests from the admin portal.

**Acceptance Criteria:**
- New admin page: `/admin/visibility-requests`
- Summary cards: Pending count, Approved (last 30 days), Rejected (last 30 days)
- Table: screen owner name, email, screens count, request date, status, actions
- Approve: sets `AccountVisibility = Public`, sends notification to user
- Reject: opens dialog for rejection reason (required), sends notification to user with reason
- After approval: user's portal immediately shows marketplace features
- After rejection: user sees reason in their profile settings section

### US-6: Admin Rejection Handling (User Side)
> As a private screen owner whose public request was rejected, I can see the rejection reason in my profile and submit a new request.

**Acceptance Criteria:**
- Profile settings shows: "Your request for public access was rejected. Reason: {reason}"
- "Request Again" button is enabled
- Previously rejected request stays in history (admin can see full history)

---

## 3. System Architecture

### State Machine

```
               ┌──────────────┐
               │   REGISTER   │
               │  /register   │
               └──────┬───────┘
                      │ AccountVisibility = Public (default)
                      ▼
              ┌───────────────┐      User toggles      ┌───────────────────────┐
              │    PUBLIC     │ ─────(no bookings)─────▶│       PRIVATE         │
              │  (Marketplace │                         │  (Self-Managed)       │
              │   Active)     │                         │                       │
              └───────────────┘                         └───────────┬───────────┘
                      ▲                                             │
                      │ Admin approves                              │ User requests
                      │                                             │ "Go Public"
              ┌───────┴───────────┐                                 │
              │  PENDING_PUBLIC   │◀────────────────────────────────┘
              │  (Awaiting Admin  │
              │   Approval)       │
              └───────┬───────────┘
                      │ Admin rejects (with reason)
                      ▼
              ┌───────────────────┐
              │    PRIVATE        │  User can re-request
              │  (Rejected,       │──────────────────▶ PENDING_PUBLIC
              │   reason shown)   │
              └───────────────────┘


               ┌──────────────────┐
               │    REGISTER      │
               │ /register/private│
               └──────┬───────────┘
                      │ AccountVisibility = Private (forced)
                      ▼
              ┌───────────────────┐
              │     PRIVATE       │   (same flow as above to go public)
              │  (Self-Managed)   │
              └───────────────────┘
```

### Component Interaction

```
┌─────────────────────────────────────────────────────────────────────┐
│                         FRONTEND                                    │
│                                                                     │
│  RegisterPage ── /register/private ──▶ POST /api/auth/register     │
│  (role=ScreenOwner, visibility=Private)     (with visibility field) │
│                                                                     │
│  ProfileSettingsPage                                                │
│    ├─ Public account: Toggle switch ──▶ PUT /api/v1/profile/vis.   │
│    │  (can go Private if no bookings)                               │
│    │                                                                │
│    └─ Private account:                                              │
│       ├─ "Request Public Access" btn ──▶ POST /api/v1/profile/     │
│       │                                    visibility-request       │
│       ├─ "Pending Approval" badge (if request pending)              │
│       └─ "Rejected: {reason}" alert (if request rejected)           │
│                                                                     │
│  MainLayout / MobileBottomNav                                       │
│    └─ Reads profile.accountVisibility ──▶ conditional nav items     │
│                                                                     │
│  DashboardPage / ScreenDetailPage / AnalyticsPage / etc.            │
│    └─ Reads profile.accountVisibility ──▶ conditional sections      │
│                                                                     │
│  AdminVisibilityRequestsPage (new)                                  │
│    └─ GET, Approve, Reject ──▶ /api/v1/admin/visibility-requests   │
│                                                                     │
├─────────────────────────────────────────────────────────────────────┤
│                         BACKEND                                     │
│                                                                     │
│  AuthService.RegisterAsync()                                        │
│    └─ Accepts optional `visibility` field from request              │
│    └─ Only sets Private if role=ScreenOwner                         │
│                                                                     │
│  ProfileController                                                  │
│    ├─ PUT /visibility ── toggle Public→Private (with booking guard) │
│    ├─ POST /visibility-request ── create request for Private→Public │
│    └─ GET /visibility-request ── get latest request status          │
│                                                                     │
│  AdminVisibilityController (new)                                    │
│    ├─ GET /admin/visibility-requests ── list paged + filtered       │
│    ├─ GET /admin/visibility-requests/{id} ── detail                 │
│    ├─ POST /admin/visibility-requests/{id}/approve ── approve       │
│    └─ POST /admin/visibility-requests/{id}/reject ── reject         │
│                                                                     │
│  Visibility Enforcement (on every screen-related query)             │
│    ├─ GetScreensPagedQueryHandler ── filter for advertisers         │
│    ├─ GetScreenByIdQueryHandler ── 404 for advertisers on private   │
│    ├─ GetScreensQueryHandler ── filter for advertisers              │
│    ├─ GetScreenAvailability ── 404 for non-owners on private        │
│    └─ GetSlotCalendar ── 404 for non-owners on private              │
│                                                                     │
│  NotificationService                                                │
│    ├─ Notify admins on new visibility request                       │
│    ├─ Notify user on approval                                       │
│    └─ Notify user on rejection (with reason)                        │
├─────────────────────────────────────────────────────────────────────┤
│                        DATABASE                                     │
│                                                                     │
│  Users table                                                        │
│    └─ AccountVisibility (int, existing) ── 0=Public, 1=Private      │
│                                                                     │
│  VisibilityChangeRequests table (NEW)                               │
│    └─ Id, UserId, RequestedVisibility, Status, RequestedAt,         │
│       RequestMessage, AdminReviewedByUserId, AdminReviewedAt,       │
│       RejectionReason                                               │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 4. Flow 1: Private Screen Owner Registration

### 4.1 Frontend — New Registration Route

**Route**: `/register/private`  
**Component**: Reuse existing `RegisterPage.tsx` with a `mode` prop or query param

**Behavior differences from standard `/register`:**
| Aspect | `/register` (standard) | `/register/private` |
|--------|----------------------|-------------------|
| Role selector | Shows "ScreenOwner" and "Advertiser" radio buttons | Hidden — locked to "ScreenOwner" |
| Title | "Create your account" | "Register for Private Screen Management" |
| Subtitle | — | "Manage your own digital signage without marketplace exposure" |
| Form fields | Same | Same (email, password, name, phone) |
| API payload | `{ ..., role: selected, visibility: undefined }` | `{ ..., role: "ScreenOwner", visibility: "Private" }` |
| After success | Standard verify flow | Same verify flow |

### 4.2 Frontend Implementation

```
File: frontend/src/App.tsx
Change: Add route — <Route path="/register/private" element={<RegisterPage mode="private" />} />

File: frontend/src/pages/auth/RegisterPage.tsx
Change:
  - Accept optional prop `mode?: 'standard' | 'private'`
  - When mode='private':
    - Hide role radio buttons
    - Set role = 'ScreenOwner' always
    - Add `visibility: 'Private'` to API payload
    - Show different title/subtitle text
  - When mode='standard' (default): no changes
```

### 4.3 Backend Implementation

```
File: backend/CCMS.Shared/DTOs/Auth/RegisterRequest.cs (or wherever RegisterRequest lives)
Change: Add optional field:
  public string? Visibility { get; set; }  // "Public" (default) or "Private"

File: backend/CCMS.Infrastructure/Services/AuthService.cs — RegisterAsync()
Change: After creating User entity, before saving:
  - If request.Visibility == "Private" AND userRole == UserRole.ScreenOwner:
      user.AccountVisibility = ScreenVisibility.Private;
  - If request.Visibility == "Private" AND userRole != UserRole.ScreenOwner:
      Ignore (only ScreenOwners can be private)
  - If request.Visibility is null or "Public":
      user.AccountVisibility = ScreenVisibility.Public; (existing default)
```

### 4.4 Sequence Diagram

```
User                    Frontend                   Backend                    DB
 │                         │                         │                        │
 │  Opens /register/private│                         │                        │
 │─────────────────────────▶                         │                        │
 │                         │ Renders form             │                        │
 │                         │ (role=ScreenOwner,       │                        │
 │                         │  no role selector)       │                        │
 │                         │                         │                        │
 │  Fills form + submits   │                         │                        │
 │─────────────────────────▶                         │                        │
 │                         │ POST /api/auth/register  │                        │
 │                         │ { email, password,       │                        │
 │                         │   firstName, lastName,   │                        │
 │                         │   phoneNumber,           │                        │
 │                         │   role: "ScreenOwner",   │                        │
 │                         │   visibility: "Private" }│                        │
 │                         │─────────────────────────▶│                        │
 │                         │                         │ Validate email+phone    │
 │                         │                         │ Hash password           │
 │                         │                         │ Create User with        │
 │                         │                         │ AccountVisibility=      │
 │                         │                         │ Private                 │
 │                         │                         │────────────────────────▶│
 │                         │                         │                        │ INSERT User
 │                         │                         │ Send email verification │
 │                         │                         │ Send phone OTP          │
 │                         │◀─────────────────────────│                        │
 │                         │ { requiresVerification } │                        │
 │  Redirect to            │                         │                        │
 │  /verify-phone          │                         │                        │
 │◀─────────────────────────│                         │                        │
 │                         │                         │                        │
 │  ... standard verify flow (same as public) ...    │                        │
 │                         │                         │                        │
 │  After both verified,   │                         │                        │
 │  login → dashboard      │                         │                        │
 │  sees PRIVATE portal UI │                         │                        │
```

---

## 5. Flow 2: Private Screen Owner Portal Experience

### 5.1 How the frontend knows the account is Private

The profile API response already includes `accountVisibility`:

```typescript
// GET /api/v1/profile → ProfileDto
{
  accountVisibility: "Private",  // or "Public"
  role: "ScreenOwner",
  ...
}
```

This is fetched via `useQuery({ queryKey: ['profile'] })` and available throughout the app.

### 5.2 Sidebar Navigation — Conditional Items

**Current sidebar (ScreenOwner, Public):**
1. Dashboard → `/dashboard`
2. My Screens → `/screens`
3. Booking Requests → `/bookings`
4. Payouts → `/payouts`
5. Earnings & Analytics → `/analytics`
6. Settings → `/profile`

**Private sidebar (ScreenOwner, Private):**
1. Dashboard → `/dashboard`
2. My Screens → `/screens`
3. Screen Analytics → `/analytics` *(renamed)*
4. Settings → `/profile`

**Implementation:**

```
File: frontend/src/components/Layout/MainLayout.tsx
Change: Filter nav items based on profile.accountVisibility
  - Read accountVisibility from profile query (or auth store)
  - If Private: exclude items with paths '/bookings' and '/payouts'
  - If Private: rename 'Earnings & Analytics' to 'Screen Analytics'
  - If Public: show all items (no change)

File: frontend/src/components/Layout/MobileBottomNav.tsx
Change: Same logic — hide Bookings tab when Private
```

### 5.3 Dashboard Page — Conditional Components

**Public Dashboard (current):**
```
┌──────────┬──────────┬──────────┬──────────┐
│ My       │ Pending  │ Active   │ Total    │
│ Screens  │ Requests │ Bookings │ Revenue  │
└──────────┴──────────┴──────────┴──────────┘
┌─────────────────────┬──────────────────────┐
│ OwnerApprovalQueue  │   ScreenStatusGrid   │
└─────────────────────┴──────────────────────┘
┌──────────┬──────────┬──────────┬──────────┐
│ Add New  │ Manage   │ View All │ View     │
│ Screen   │ Screens  │ Requests │ Earnings │
└──────────┴──────────┴──────────┴──────────┘
```

**Private Dashboard:**
```
┌──────────┬──────────┐
│ Total    │ Screens  │
│ Screens  │ Online   │
└──────────┴──────────┘
┌────────────────────────────────────────────┐
│          ScreenStatusGrid                  │
└────────────────────────────────────────────┘
┌──────────┬──────────┐
│ Add New  │ Manage   │
│ Screen   │ Screens  │
└──────────┴──────────┘
```

**Implementation:**

```
File: frontend/src/pages/dashboard/DashboardPage.tsx
Change:
  - Fetch profile (or read from existing query)
  - const isPrivate = profile?.accountVisibility === 'Private';
  - Conditional rendering:
    - Stat cards: if isPrivate → show only "Total Screens" and "Screens Online"
    - Components: if isPrivate → hide OwnerApprovalQueue, show only ScreenStatusGrid
    - Quick actions: if isPrivate → show only "Add New Screen" and "Manage Screens"
```

### 5.4 Screen Detail Page — Conditional Tabs/Sections

**Public screen detail tabs (current):**
- Overview (info, images, pricing, revenue estimate)
- Availability (heatmap, slot calendar)
- Tags (tag manager)
- Device Management
- Default Video
- Verification
- Live Preview

**Private screen detail tabs:**
- Overview (info, images — NO pricing, NO revenue estimate)
- Device Management
- Default Video
- Live Preview

**Implementation:**

```
File: frontend/src/pages/screens/ScreenDetailPage.tsx
Change:
  - const isPrivate = profile?.accountVisibility === 'Private';
  - Hide tabs: Tags, Verification, Availability
  - In Overview tab: hide PricePerSlot, CommissionPercentage, RevenueEstimateCard
  - Keep tabs: Device Management, Default Video, Live Preview
  - Keep in Overview: Name, Description, Location, Resolution, Operating Schedule, Images
```

### 5.5 Screen Create/Edit — Conditional Fields

**Public form fields (current):**
- Name, Description, Location (address + GPS)
- Resolution, Operating Schedule
- Price Per Slot, Commission %
- Images
- Tags

**Private form fields:**
- Name, Description, Location
- Resolution, Operating Schedule
- Images
- *(No pricing, no tags)*

**Implementation:**

```
File: frontend/src/pages/screens/CreateScreenPage.tsx
File: frontend/src/pages/screens/UpdateScreenPage.tsx
Change:
  - const isPrivate = profile?.accountVisibility === 'Private';
  - if isPrivate: hide PricePerSlot field, CommissionPercentage field, Tags section
  - Zod schema: make pricing fields optional when isPrivate
    (backend should already handle null/0 pricing for private screens)
```

### 5.6 Screens List Page — Conditional Columns

**Public list card info:** Name, Status, Location, Price, Revenue, Booking Count, Verification Badge  
**Private list card info:** Name, Status (online/offline), Location, Device Status, Last Sync

```
File: frontend/src/pages/screens/ScreensPage.tsx
Change:
  - const isPrivate = profile?.accountVisibility === 'Private';
  - if isPrivate: hide price display, revenue display, booking count, verification badge on screen cards
  - if isPrivate: show device status, last sync time prominently
```

### 5.7 Analytics Page — Conditional Charts/Cards

**Public analytics:** Total Revenue, Avg. Daily Earnings, Active Bookings, Screen Uptime, Weekly Revenue Chart, Revenue by Screen, Impressions Chart  
**Private analytics:** Screen Uptime, Screens Online, Total Impressions Chart

```
File: frontend/src/pages/analytics/AnalyticsPage.tsx
Change:
  - const isPrivate = profile?.accountVisibility === 'Private';
  - if isPrivate: hide all revenue/earnings/bookings stat cards and charts
  - if isPrivate: show Screen Uptime, Screens Online, Total Impressions
```

### 5.8 Route Guards — Redirect Hidden Pages

```
File: frontend/src/App.tsx
Change:
  - Create a PrivateGuard wrapper or add logic in ProtectedRoute
  - If user.accountVisibility === 'Private' and route is /bookings or /payouts:
    → Navigate to /dashboard
    → Show toast: "This feature is not available for private accounts"
  - This prevents direct URL access to hidden pages
```

---

## 6. Flow 3: Public→Private Toggle

### 6.1 Current Behavior

Currently `PUT /api/v1/profile/visibility` instantly sets `AccountVisibility` to whatever is requested. No guards.

### 6.2 New Behavior — Public→Private (Self-Service with Guard)

When a Public account tries to switch to Private:

1. **Frontend**: Shows confirmation dialog
2. **Backend**: Checks for active/upcoming bookings on owned screens
3. **If bookings exist**: Returns 400 with message
4. **If no bookings**: Sets `AccountVisibility = Private` immediately

### 6.3 Booking Guard Logic

```csharp
// In ProfileController.UpdateVisibility() — ONLY when switching Public → Private
var hasActiveBookings = await _context.Bookings
    .AsNoTracking()
    .AnyAsync(b =>
        b.Screen.OwnerId == userId &&
        b.EndDate >= DateOnly.FromDateTime(DateTime.UtcNow) &&
        (b.Status == BookingStatus.Pending ||
         b.Status == BookingStatus.Approved ||
         b.Status == BookingStatus.Active));

if (hasActiveBookings)
{
    return BadRequest(ApiResponse<ProfileDto>.ErrorResponse(
        "Cannot switch to private while you have active or upcoming bookings. " +
        "Please wait for all bookings to complete or cancel them first."));
}
```

### 6.4 Sequence Diagram

```
User                    Frontend                   Backend                    DB
 │                         │                         │                        │
 │  Clicks toggle switch   │                         │                        │
 │  (Public → Private)     │                         │                        │
 │─────────────────────────▶                         │                        │
 │                         │ Shows confirmation       │                        │
 │                         │ dialog: "All screens     │                        │
 │                         │ will be hidden..."       │                        │
 │                         │                         │                        │
 │  Confirms               │                         │                        │
 │─────────────────────────▶                         │                        │
 │                         │ PUT /profile/visibility  │                        │
 │                         │ { visibility: "Private" }│                        │
 │                         │─────────────────────────▶│                        │
 │                         │                         │ Check bookings          │
 │                         │                         │────────────────────────▶│
 │                         │                         │◀────────────────────────│
 │                         │                         │                        │
 │                         │        ┌─── IF bookings exist ───┐               │
 │                         │        │ 400: "Cannot switch..." │               │
 │                         │◀───────┤                         │               │
 │                         │        └─────────────────────────┘               │
 │  Shows error toast      │                         │                        │
 │◀─────────────────────────│                         │                        │
 │                         │                         │                        │
 │                         │        ┌─── IF no bookings ──────┐               │
 │                         │        │ Set AccountVisibility=  │               │
 │                         │        │ Private                  │               │
 │                         │        │────────────────────────▶│               │
 │                         │        │                          │ UPDATE User   │
 │                         │        │ 200: Updated profile     │               │
 │                         │◀───────┤                         │               │
 │                         │        └─────────────────────────┘               │
 │  Shows success toast    │                         │                        │
 │  Portal UI updates      │                         │                        │
 │  (nav items change,     │                         │                        │
 │   dashboard simplifies) │                         │                        │
 │◀─────────────────────────│                         │                        │
```

---

## 7. Flow 4: Private→Public Request + Admin Approval

This is the core new workflow. Private screen owners **cannot** self-switch to Public. They must submit a request that goes through admin review.

### 7.1 New Domain Entity: VisibilityChangeRequest

```csharp
public class VisibilityChangeRequest : BaseEntity
{
    public Guid UserId { get; set; }
    
    /// The visibility the user wants to switch TO (always Public for now)
    public ScreenVisibility RequestedVisibility { get; set; }
    
    /// Current visibility at time of request
    public ScreenVisibility CurrentVisibility { get; set; }
    
    public VisibilityRequestStatus Status { get; set; } = VisibilityRequestStatus.Pending;
    
    /// Optional message from the user explaining why they want to go public
    public string? RequestMessage { get; set; }
    
    public DateTime RequestedAt { get; set; } = DateTime.UtcNow;
    
    // Admin review
    public Guid? AdminReviewedByUserId { get; set; }
    public DateTime? AdminReviewedAt { get; set; }
    public string? RejectionReason { get; set; }
    
    // Navigation
    public virtual User User { get; set; } = null!;
    public virtual User? AdminReviewedByUser { get; set; }
}
```

### 7.2 New Enum: VisibilityRequestStatus

```csharp
public enum VisibilityRequestStatus
{
    Pending = 0,
    Approved = 1,
    Rejected = 2
}
```

### 7.3 User-Side Flow: Requesting Public Access

**Profile Settings UI (when Private):**

Instead of the Public/Private toggle switch, show:

```
┌─────────────────────────────────────────────────────────────────┐
│ Screen Visibility                                               │
│                                                                 │
│ 🔒 Your account is Private                                     │
│ Your screens are not visible on the marketplace.                │
│                                                                 │
│ ┌─────────────────────────────┐                                 │
│ │  Request Public Access      │  ← Primary button               │
│ └─────────────────────────────┘                                 │
│                                                                 │
│ ─── OR if request is pending: ──────────────────────────────── │
│                                                                 │
│ ⏳ Public access request pending                                │
│ Submitted on Apr 6, 2026. Awaiting admin review.               │
│                                                                 │
│ ─── OR if request was rejected: ────────────────────────────── │
│                                                                 │
│ ❌ Public access request rejected                               │
│ Reason: "Incomplete profile — please add screen images and     │
│ complete verification first."                                   │
│ Rejected on Apr 5, 2026                                        │
│                                                                 │
│ ┌─────────────────────────────┐                                 │
│ │  Request Again              │  ← Re-request button            │
│ └─────────────────────────────┘                                 │
│                                                                 │
│ ─── AND if account is Public: ──────────────────────────────── │
│                                                                 │
│ ✅ Your account is Public                                       │
│ Your screens are visible on the marketplace.                    │
│                                                                 │
│ [Toggle switch: Public ←→ Private]  ← Self-service toggle       │
│                                     (with booking guard)         │
└─────────────────────────────────────────────────────────────────┘
```

### 7.4 Request Dialog

When user clicks "Request Public Access":

```
┌────────────────────────────── Dialog ─────────────────────────────┐
│                                                                    │
│  Request Public Marketplace Access                                 │
│                                                                    │
│  Your screens will become visible to advertisers once approved.    │
│  Admin will review your account and screens before approval.       │
│                                                                    │
│  Why do you want to go public? (optional)                          │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │ I've set up 5 screens in shopping malls and want to start   │  │
│  │ accepting ad bookings from advertisers.                      │  │
│  │                                                              │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                                                    │
│                        ┌──────────┐  ┌────────────────────┐       │
│                        │  Cancel  │  │  Submit Request    │       │
│                        └──────────┘  └────────────────────┘       │
│                                                                    │
└────────────────────────────────────────────────────────────────────┘
```

### 7.5 Sequence Diagram — Request + Approval

```
User                    Frontend                   Backend                    DB              Admin
 │                         │                         │                        │                │
 │  Clicks "Request        │                         │                        │                │
 │  Public Access"         │                         │                        │                │
 │─────────────────────────▶                         │                        │                │
 │                         │ Shows request dialog     │                        │                │
 │  Fills message,         │                         │                        │                │
 │  clicks Submit          │                         │                        │                │
 │─────────────────────────▶                         │                        │                │
 │                         │ POST /profile/           │                        │                │
 │                         │ visibility-request       │                        │                │
 │                         │ { message: "..." }       │                        │                │
 │                         │─────────────────────────▶│                        │                │
 │                         │                         │ Validate:               │                │
 │                         │                         │ - User is Private       │                │
 │                         │                         │ - No pending request    │                │
 │                         │                         │                        │                │
 │                         │                         │ Create VisChange       │                │
 │                         │                         │ Request entity          │                │
 │                         │                         │────────────────────────▶│                │
 │                         │                         │                        │ INSERT          │
 │                         │                         │                        │                │
 │                         │                         │ Notify all admins       │                │
 │                         │                         │ (DB + SignalR)          │                │
 │                         │                         │────────────────────────▶│───────────────▶│
 │                         │                         │                        │                │
 │                         │ 200: { status: Pending } │                        │                │
 │                         │◀─────────────────────────│                        │                │
 │  Shows "Pending" badge  │                         │                        │                │
 │◀─────────────────────────│                         │                        │                │
 │                         │                         │                        │                │
 │                         │                         │                        │     Admin opens│
 │                         │                         │                        │     /admin/vis │
 │                         │                         │                        │     -requests  │
 │                         │                         │                        │                │
 │                         │                         │◀──────────────────────────────────────── │
 │                         │                         │ GET /admin/             │                │
 │                         │                         │ visibility-requests     │                │
 │                         │                         │────────────────────────▶│                │
 │                         │                         │◀────────────────────────│                │
 │                         │                         │───────────────────────────────────────── ▶│
 │                         │                         │ Returns list            │                │
 │                         │                         │                        │                │
 │                         │                         │                        │   Admin clicks │
 │                         │                         │                        │   "Approve"    │
 │                         │                         │◀───────────────────────────────────────── │
 │                         │                         │ POST /admin/            │                │
 │                         │                         │ visibility-requests/    │                │
 │                         │                         │ {id}/approve            │                │
 │                         │                         │                        │                │
 │                         │                         │ Set request.Status =    │                │
 │                         │                         │ Approved                │                │
 │                         │                         │ Set user.AccountVis =   │                │
 │                         │                         │ Public                  │                │
 │                         │                         │────────────────────────▶│                │
 │                         │                         │                        │ UPDATE both     │
 │                         │                         │                        │                │
 │                         │                         │ Notify user             │                │
 │                         │                         │ "Your account is now    │                │
 │                         │                         │  public!"               │                │
 │                         │                         │────────────────────────▶│                │
 │  Receives notification  │                         │                        │                │
 │  (SignalR real-time)    │                         │                        │                │
 │◀─────────────────────────│                         │                        │                │
 │                         │ Invalidate ['profile']   │                        │                │
 │                         │ query → refetch          │                        │                │
 │                         │ Portal UI updates to     │                        │                │
 │                         │ show Public features     │                        │                │
 │◀─────────────────────────│                         │                        │                │
```

### 7.6 Rejection Flow

```
Admin                      Backend                    DB                    User
 │                           │                        │                      │
 │  Clicks "Reject"          │                        │                      │
 │  Enters reason in dialog  │                        │                      │
 │──────────────────────────▶│                        │                      │
 │  POST /admin/             │                        │                      │
 │  visibility-requests/     │                        │                      │
 │  {id}/reject              │                        │                      │
 │  { reason: "Incomplete    │                        │                      │
 │    profile..." }          │                        │                      │
 │                           │ Set request.Status =   │                      │
 │                           │ Rejected               │                      │
 │                           │ Set RejectionReason    │                      │
 │                           │ Set AdminReviewedAt    │                      │
 │                           │ (DO NOT change         │                      │
 │                           │ AccountVisibility —    │                      │
 │                           │ stays Private)         │                      │
 │                           │────────────────────────▶│                      │
 │                           │                        │ UPDATE request       │
 │                           │                        │                      │
 │                           │ Notify user             │                      │
 │                           │ "Your public request    │                      │
 │                           │ was rejected.           │                      │
 │                           │ Reason: ..."            │                      │
 │                           │────────────────────────▶│─────────────────────▶│
 │                           │                        │                      │
 │                           │                        │     User sees        │
 │                           │                        │     rejection reason │
 │                           │                        │     in profile       │
 │                           │                        │     + can re-request │
```

---

## 8. Flow 5: Backend Visibility Enforcement

These are the server-side guards that prevent advertisers from seeing or interacting with private screens, regardless of frontend UI.

### 8.1 GetScreensPagedQuery Handler

```
File: backend/CCMS.Application/Features/Screens/Queries/GetScreensPagedQueryHandler.cs
Change:
  - Add CallerRole property to GetScreensPagedQuery
  - In handler, when CallerRole == "Advertiser":
      .Where(s => s.Owner.AccountVisibility == ScreenVisibility.Public)
  - When CallerRole == "ScreenOwner": filter by OwnerId only (existing)
  - When CallerRole == "Admin": no visibility filter (sees all)

File: backend/CCMS.Api/Controllers/ScreensController.cs
Change: Pass User role into GetScreensPagedQuery
```

### 8.2 GetScreenByIdQuery Handler

```
File: backend/CCMS.Application/Features/Screens/Queries/GetScreenByIdQueryHandler.cs
Change:
  - Add CallerUserId and CallerRole to the query
  - After fetching screen (with .Include(s => s.Owner)):
      if (CallerRole == "Advertiser" && screen.Owner.AccountVisibility == Private)
          return null;  // or throw NotFoundException
  - Owner and Admin always see their own screens
```

### 8.3 GetScreensQuery Handler

```
File: backend/CCMS.Application/Features/Screens/Queries/GetScreensQueryHandler.cs
Change: Same as 8.1 — add CallerRole, filter for advertisers
```

### 8.4 Slot Availability & Calendar Query Handlers

```
Files:
  - backend/CCMS.Application/Features/Screens/Queries/GetScreenAvailabilityQueryHandler.cs
  - backend/CCMS.Application/Features/Screens/Queries/GetSlotCalendarQueryHandler.cs
Change:
  - Add CallerUserId and CallerRole
  - If CallerRole == "Advertiser" AND screen.Owner.AccountVisibility == Private:
      return 404 (screen not found)
  - Screen owners can always check their own screen availability
```

### 8.5 CreateBookingCommand Handler (Already Done)

Already exists at line 73 of `CreateBookingCommandHandler.cs`:
```csharp
if (screenOwner != null && screenOwner.AccountVisibility == ScreenVisibility.Private)
```

No changes needed here.

### 8.6 Controller-Level Changes

```
File: backend/CCMS.Api/Controllers/ScreensController.cs
Change: For every endpoint that dispatches a query or returns screen data,
        extract the caller's userId and role from JWT claims and pass them
        to the query/command.

Pattern:
  var callerUserId = GetUserId();
  var callerRole = User.FindFirst(ClaimTypes.Role)?.Value ?? "";
  
  // Pass to query
  query.CallerUserId = callerUserId;
  query.CallerRole = callerRole;
```

---

## 9. Flow 6: Admin Visibility Management Portal

### 9.1 New Admin Page: `/admin/visibility-requests`

```
┌─────────────────────────────────────────────────────────────────────┐
│  Visibility Requests                                                │
│                                                                     │
│  ┌───────────┐  ┌───────────┐  ┌───────────┐                      │
│  │  Pending  │  │ Approved  │  │ Rejected  │                      │
│  │    3      │  │   12      │  │    2      │                      │
│  │  ⏳       │  │   ✅      │  │   ❌      │                      │
│  └───────────┘  └───────────┘  └───────────┘                      │
│                                                                     │
│  ┌──────────────┬─────────────────────────────────────────────────┐ │
│  │ Status: [All]│ Search: [____________]         │ Showing 1-10  │ │
│  └──────────────┴─────────────────────────────────────────────────┘ │
│                                                                     │
│  ┌──────────────────────────────────────────────────────────────── ┐│
│  │ Name          │ Email              │ Screens │ Requested │ Stat ││
│  ├───────────────┼────────────────────┼─────────┼───────────┼──── ┤│
│  │ Ravi Sharma   │ ravi@example.com   │ 5       │ Apr 5     │ ⏳  ││
│  │ Priya Patel   │ priya@example.com  │ 2       │ Apr 4     │ ⏳  ││
│  │ Amit Desai    │ amit@example.com   │ 8       │ Apr 3     │ ✅  ││
│  └──────────────────────────────────────────────────────────────── ┘│
│                                                                     │
│  Clicking a row opens the detail dialog                             │
└─────────────────────────────────────────────────────────────────────┘
```

### 9.2 Detail Dialog

```
┌───────────────── Visibility Request Detail ──────────────────────────┐
│                                                                       │
│  Screen Owner: Ravi Sharma                                            │
│  Email: ravi@example.com                                              │
│  Registered: Jan 15, 2026                                             │
│  Current Visibility: Private                                          │
│  Requested: Public                                                    │
│  Request Date: Apr 5, 2026                                            │
│                                                                       │
│  ── User's Message ──────────────────────────────────────────        │
│  "I've set up 5 screens in shopping malls and want to start          │
│   accepting ad bookings from advertisers."                            │
│  ────────────────────────────────────────────────────────────         │
│                                                                       │
│  ── Screens Overview ────────────────────────────────────────        │
│  │ Screen Name       │ Location      │ Status  │ Verified │          │
│  ├───────────────────┼───────────────┼─────────┼──────────┤          │
│  │ Mall Display #1   │ Mumbai, MH    │ Active  │ ✅       │          │
│  │ Lobby TV          │ Pune, MH      │ Active  │ ❌       │          │
│  │ Shop Window       │ Mumbai, MH    │ Offline │ ✅       │          │
│  └───────────────────────────────────────────────────────────        │
│                                                                       │
│  ── Previous Requests ───────────────────────────────────────        │
│  │ Date       │ Status   │ Reason                           │        │
│  ├────────────┼──────────┼──────────────────────────────────┤        │
│  │ Mar 20     │ Rejected │ "Please verify all screens first"│        │
│  └───────────────────────────────────────────────────────────        │
│                                                                       │
│                    ┌───────────┐  ┌─────────────┐                    │
│                    │  Reject   │  │   Approve   │                    │
│                    │  (red)    │  │   (green)   │                    │
│                    └───────────┘  └─────────────┘                    │
│                                                                       │
└───────────────────────────────────────────────────────────────────────┘
```

### 9.3 Reject Dialog

```
┌────────────────── Reject Request ──────────────────────────┐
│                                                              │
│  Rejection Reason (required):                                │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ Please verify all screens and complete your profile  │   │
│  │ (add company name, GST) before requesting public     │   │
│  │ access.                                              │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                              │
│                     ┌──────────┐  ┌──────────────┐          │
│                     │  Cancel  │  │ Reject       │          │
│                     └──────────┘  │ (red)        │          │
│                                   └──────────────┘          │
└──────────────────────────────────────────────────────────────┘
```

### 9.4 Implementation Files

```
Backend:
  NEW: backend/CCMS.Domain/Entities/VisibilityChangeRequest.cs — entity
  NEW: backend/CCMS.Domain/Enums/VisibilityRequestStatus.cs — enum
  EDIT: backend/CCMS.Infrastructure/ApplicationDbContext.cs — add DbSet
  NEW: migration — AddVisibilityChangeRequests table
  NEW: backend/CCMS.Api/Controllers/AdminVisibilityController.cs — admin endpoints
  EDIT: backend/CCMS.Api/Controllers/ProfileController.cs — add request endpoint
  EDIT: backend/CCMS.Domain/Enums/NotificationType.cs — add new types

Frontend:
  NEW: frontend/src/pages/admin/AdminVisibilityRequestsPage.tsx — admin page
  NEW: frontend/src/components/admin/VisibilityRequestDetailDialog.tsx — detail dialog
  NEW: frontend/src/hooks/useAdminVisibilityRequests.ts — admin hooks
  NEW: frontend/src/services/visibilityApi.ts — API service
  EDIT: frontend/src/App.tsx — add admin route
  EDIT: frontend/src/components/Layout/MainLayout.tsx — add admin nav item
```

---

## 10. Database Changes

### 10.1 New Table: VisibilityChangeRequests

```sql
CREATE TABLE "VisibilityChangeRequests" (
    "Id" uuid NOT NULL DEFAULT gen_random_uuid(),
    "UserId" uuid NOT NULL,
    "RequestedVisibility" integer NOT NULL,       -- 0=Public, 1=Private
    "CurrentVisibility" integer NOT NULL,          -- snapshot at request time
    "Status" integer NOT NULL DEFAULT 0,           -- 0=Pending, 1=Approved, 2=Rejected
    "RequestMessage" text NULL,                    -- optional user message
    "RequestedAt" timestamp with time zone NOT NULL DEFAULT now(),
    "AdminReviewedByUserId" uuid NULL,
    "AdminReviewedAt" timestamp with time zone NULL,
    "RejectionReason" text NULL,
    "CreatedAt" timestamp with time zone NOT NULL DEFAULT now(),
    "UpdatedAt" timestamp with time zone NULL,
    "IsDeleted" boolean NOT NULL DEFAULT false,
    CONSTRAINT "PK_VisibilityChangeRequests" PRIMARY KEY ("Id"),
    CONSTRAINT "FK_VisibilityChangeRequests_Users_UserId"
        FOREIGN KEY ("UserId") REFERENCES "Users" ("Id") ON DELETE CASCADE,
    CONSTRAINT "FK_VisibilityChangeRequests_Users_AdminReviewedByUserId"
        FOREIGN KEY ("AdminReviewedByUserId") REFERENCES "Users" ("Id") ON DELETE SET NULL
);

CREATE INDEX "IX_VisibilityChangeRequests_UserId" ON "VisibilityChangeRequests" ("UserId");
CREATE INDEX "IX_VisibilityChangeRequests_Status" ON "VisibilityChangeRequests" ("Status");
```

### 10.2 No Changes to Users Table

The existing `AccountVisibility` column (`integer NOT NULL DEFAULT 0`) is sufficient. No schema change needed.

### 10.3 EF Core Migration

```
Migration name: AddVisibilityChangeRequests
- Up(): Create table + indexes
- Down(): Drop table
```

---

## 11. API Contract

### 11.1 Registration (Modified)

```
POST /api/auth/register
Request:
{
  "email": "owner@example.com",
  "password": "SecurePass123!",
  "firstName": "Ravi",
  "lastName": "Sharma",
  "phoneNumber": "+919876543210",
  "role": "ScreenOwner",
  "visibility": "Private"           ← NEW optional field
}

Response (unchanged):
{
  "requiresVerification": true,
  "email": "owner@example.com",
  "phoneNumber": "987****210"
}
```

### 11.2 Profile Visibility — Toggle Public→Private (Modified)

```
PUT /api/v1/profile/visibility
Authorization: Bearer {token}
Request:
{
  "visibility": "Private"
}

Success Response (200):
{
  "data": { ... ProfileDto with accountVisibility: "Private" },
  "errors": []
}

Error Response (400) — if bookings exist:
{
  "data": null,
  "errors": ["Cannot switch to private while you have active or upcoming bookings."]
}

Error Response (400) — if trying Private→Public via this endpoint:
{
  "data": null,
  "errors": ["To switch to Public, please submit a visibility request for admin approval."]
}
```

### 11.3 Submit Visibility Request (New)

```
POST /api/v1/profile/visibility-request
Authorization: Bearer {token}
Request:
{
  "message": "I want to start accepting ad bookings."   ← optional
}

Success Response (201):
{
  "data": {
    "id": "uuid",
    "status": "Pending",
    "requestedAt": "2026-04-06T10:00:00Z",
    "requestMessage": "I want to start accepting ad bookings."
  },
  "errors": []
}

Error (400) — already pending:
{
  "data": null,
  "errors": ["You already have a pending visibility request."]
}

Error (400) — already public:
{
  "data": null,
  "errors": ["Your account is already public."]
}
```

### 11.4 Get Latest Visibility Request Status (New)

```
GET /api/v1/profile/visibility-request
Authorization: Bearer {token}

Response (200):
{
  "data": {
    "id": "uuid",
    "status": "Rejected",                ← Pending | Approved | Rejected
    "requestedAt": "2026-04-05T10:00:00Z",
    "requestMessage": "I want access...",
    "adminReviewedAt": "2026-04-05T14:00:00Z",
    "rejectionReason": "Please verify all screens first."
  },
  "errors": []
}

Response (200) — no requests exist:
{
  "data": null,
  "errors": []
}
```

### 11.5 Admin: List Visibility Requests (New)

```
GET /api/v1/admin/visibility-requests?status=Pending&page=1&pageSize=20&search=ravi
Authorization: Bearer {admin-token}

Response (200):
{
  "data": [
    {
      "id": "uuid",
      "userId": "uuid",
      "userName": "Ravi Sharma",
      "userEmail": "ravi@example.com",
      "screenCount": 5,
      "requestedVisibility": "Public",
      "currentVisibility": "Private",
      "status": "Pending",
      "requestMessage": "I want to start...",
      "requestedAt": "2026-04-05T10:00:00Z"
    }
  ],
  "pagination": { "total": 3, "page": 1, "pageSize": 20, "totalPages": 1 },
  "errors": []
}
```

### 11.6 Admin: Get Request Detail (New)

```
GET /api/v1/admin/visibility-requests/{id}
Authorization: Bearer {admin-token}

Response (200):
{
  "data": {
    "id": "uuid",
    "userId": "uuid",
    "userName": "Ravi Sharma",
    "userEmail": "ravi@example.com",
    "userRegisteredAt": "2026-01-15T00:00:00Z",
    "userCompanyName": "Sharma Displays",
    "screenCount": 5,
    "screens": [
      {
        "id": "uuid",
        "name": "Mall Display #1",
        "city": "Mumbai",
        "state": "Maharashtra",
        "status": "Active",
        "verificationStatus": "Verified"
      }
    ],
    "requestedVisibility": "Public",
    "currentVisibility": "Private",
    "status": "Pending",
    "requestMessage": "I want to start...",
    "requestedAt": "2026-04-05T10:00:00Z",
    "previousRequests": [
      {
        "id": "uuid",
        "status": "Rejected",
        "requestedAt": "2026-03-20T10:00:00Z",
        "rejectionReason": "Please verify all screens first"
      }
    ]
  },
  "errors": []
}
```

### 11.7 Admin: Approve Request (New)

```
POST /api/v1/admin/visibility-requests/{id}/approve
Authorization: Bearer {admin-token}

Response (200):
{
  "data": { "id": "uuid", "status": "Approved" },
  "errors": []
}

Side Effects:
  - request.Status = Approved
  - request.AdminReviewedByUserId = adminUserId
  - request.AdminReviewedAt = utcNow
  - user.AccountVisibility = Public
  - Notification sent to user: "Your public marketplace access has been approved!"
```

### 11.8 Admin: Reject Request (New)

```
POST /api/v1/admin/visibility-requests/{id}/reject
Authorization: Bearer {admin-token}
Request:
{
  "reason": "Please complete screen verification first."   ← required
}

Response (200):
{
  "data": { "id": "uuid", "status": "Rejected" },
  "errors": []
}

Side Effects:
  - request.Status = Rejected
  - request.RejectionReason = reason
  - request.AdminReviewedByUserId = adminUserId
  - request.AdminReviewedAt = utcNow
  - user.AccountVisibility stays Private (no change)
  - Notification sent to user: "Your public access request was rejected. Reason: ..."
```

---

## 12. Frontend Component Changes

### 12.1 Summary of All Frontend Files Changed/Created

| File | Action | Purpose |
|------|--------|---------|
| `App.tsx` | EDIT | Add `/register/private` route, add `/admin/visibility-requests` route, add private route guards |
| `RegisterPage.tsx` | EDIT | Accept `mode` prop, conditional role locking + visibility payload |
| `MainLayout.tsx` | EDIT | Conditional sidebar nav items based on `accountVisibility` |
| `MobileBottomNav.tsx` | EDIT | Conditional bottom nav items |
| `DashboardPage.tsx` | EDIT | Conditional stat cards, components, quick actions |
| `ScreenDetailPage.tsx` | EDIT | Conditional tabs (hide tags, verification, pricing, revenue) |
| `CreateScreenPage.tsx` | EDIT | Conditional fields (hide pricing, tags) |
| `UpdateScreenPage.tsx` | EDIT | Conditional fields (hide pricing, tags) |
| `ScreensPage.tsx` | EDIT | Conditional card info (hide price, revenue, booking count) |
| `AnalyticsPage.tsx` | EDIT | Conditional charts (hide revenue, show device stats only) |
| `ProfileSettingsPage.tsx` | EDIT | Rework visibility section: toggle (public), request button (private), status badges |
| `AdminVisibilityRequestsPage.tsx` | NEW | Admin visibility requests management page |
| `VisibilityRequestDetailDialog.tsx` | NEW | Admin detail dialog with approve/reject |
| `useAdminVisibilityRequests.ts` | NEW | React Query hooks for admin visibility requests |
| `useVisibilityRequest.ts` | NEW | React Query hooks for user's own visibility request |
| `visibilityApi.ts` | NEW | API service for visibility request endpoints |
| `profile.ts` (types) | EDIT | Add visibility request types |

### 12.2 How to Determine Privacy State in Components

All components that need to check privacy should follow this pattern:

```typescript
// In any component that needs to know account visibility:
import { useQuery } from '@tanstack/react-query';
import { getProfile } from '@/services/profileApi';

// Use the existing profile query (already cached by ProfileSettingsPage or MainLayout)
const { data: profile } = useQuery({
  queryKey: ['profile'],
  queryFn: getProfile,
});

const isPrivate = profile?.accountVisibility === 'Private';
```

Alternatively, if `accountVisibility` is included in the JWT claims or stored in the auth store, it can be read from there for synchronous access. However, using React Query is preferred because it stays in sync with backend state automatically on profile refetch.

### 12.3 Custom Hook for Clean Access

```typescript
// hooks/useAccountVisibility.ts
export function useAccountVisibility() {
  const { data: profile } = useQuery({
    queryKey: ['profile'],
    queryFn: getProfile,
    staleTime: 5 * 60 * 1000,
  });

  return {
    isPrivate: profile?.accountVisibility === 'Private',
    isPublic: profile?.accountVisibility === 'Public',
    accountVisibility: profile?.accountVisibility,
  };
}
```

---

## 13. Notification System

### 13.1 New Notification Types

Add to `NotificationType.cs`:

```csharp
VisibilityRequestSubmitted = 13,    // Sent to admins
VisibilityRequestApproved = 14,     // Sent to user
VisibilityRequestRejected = 15,     // Sent to user
```

### 13.2 Notification Messages

| Event | Recipient | Title | Message | ActionUrl |
|-------|-----------|-------|---------|-----------|
| Request submitted | All Admins | "Visibility Request" | "{userName} has requested public marketplace access" | `/admin/visibility-requests` |
| Request approved | User | "Public Access Approved" | "Your account is now visible on the marketplace!" | `/profile` |
| Request rejected | User | "Public Access Rejected" | "Your visibility request was rejected. Reason: {reason}" | `/profile` |

### 13.3 Delivery

Both notification types delivered via:
1. **Database**: Persisted via `NotificationService.CreateNotificationAsync()`
2. **Real-time**: SignalR broadcast via `NotificationHub` to target user/admin group
3. **Email** (optional): If email service is configured, send email notification too

---

## 14. Security Considerations

### 14.1 Registration Security

- The `/register/private` route accepts `visibility: "Private"` in the body. The backend MUST validate:
  - Only `"Public"` or `"Private"` values accepted (already handled by enum parse)
  - `visibility: "Private"` is only applied when `role: "ScreenOwner"` — if an Advertiser sends `visibility: "Private"`, it is ignored
  - `role: "Admin"` is still blocked (existing guard)
- The separate registration page is just a UX convenience — the same endpoint handles both

### 14.2 Visibility Toggle Security

- **Public→Private**: Only allowed when NO active/upcoming bookings exist. Backend enforces this regardless of frontend.
- **Private→Public**: NEVER directly settable by user. Must go through admin approval.
  - The `PUT /profile/visibility` endpoint MUST reject `{ visibility: "Public" }` when current account is Private
  - Only the admin approval endpoint can flip Private→Public

### 14.3 Backend Enforcement (Defense in Depth)

Even if all frontend guards fail, the backend ensures:
- Private screens never appear in marketplace queries
- Private screens return 404 for non-owner/non-admin access
- Booking creation is blocked for private screens (already exists)
- Slot availability/calendar is hidden for private screens

### 14.4 Admin Endpoint Authorization

All `/admin/*` endpoints require `[Authorize(Roles = "Admin")]` — existing pattern.

### 14.5 Information Hiding

- When an advertiser requests a private screen by ID: return 404 (not 403)
- This prevents information leaking about the existence of private screens

---

## 15. Migration Strategy

### 15.1 Database Migration Steps

1. Create EF Core migration `AddVisibilityChangeRequests`
2. Add `DbSet<VisibilityChangeRequest>` to `ApplicationDbContext`
3. Configure entity in `OnModelCreating` with relationships + indexes
4. Run migration locally: `dotnet ef database update`
5. Run migration on production Neon: same command against production connection string

### 15.2 Backward Compatibility

- All existing users remain Public (unchanged)
- Existing `AccountVisibility` field continues to work
- No data migration needed — only a new table is added
- Existing `ExploreScreens` and `SearchScreens` filters continue to work
- The `PUT /profile/visibility` endpoint is modified but the Public→Private direction still works the same (with added booking guard)

### 15.3 Deployment Order

1. **Database migration** (add new table)
2. **Backend deployment** (new endpoints + modified endpoints)
3. **Frontend deployment** (new pages + conditional UI)

All steps are backward compatible — each can be deployed independently without breaking the other.

---

## 16. Testing Plan

### 16.1 Registration Tests

| # | Test | Expected |
|---|------|----------|
| R1 | Register via `/register/private` with role=ScreenOwner, visibility=Private | User created with `AccountVisibility=Private` |
| R2 | Register via `/register` with role=ScreenOwner (no visibility field) | User created with `AccountVisibility=Public` (default) |
| R3 | Register via `/register` with role=Advertiser, visibility=Private | User created with `AccountVisibility=Public` (Private ignored for advertisers) |
| R4 | Register via `/register/private` with role=Advertiser | Should be blocked or ignored (force ScreenOwner) |

### 16.2 Visibility Toggle Tests

| # | Test | Expected |
|---|------|----------|
| V1 | Public owner toggles to Private (no bookings) | Success, AccountVisibility=Private |
| V2 | Public owner toggles to Private (has active booking) | 400 error, stays Public |
| V3 | Public owner toggles to Private (has pending booking) | 400 error, stays Public |
| V4 | Public owner toggles to Private (has completed bookings only) | Success, AccountVisibility=Private |
| V5 | Private owner tries `PUT visibility=Public` | 400 error: must use request workflow |

### 16.3 Visibility Request Tests

| # | Test | Expected |
|---|------|----------|
| VR1 | Private owner submits visibility request | 201, request created, admin notified |
| VR2 | Private owner submits while already has pending request | 400 error |
| VR3 | Public owner submits visibility request | 400 error (already public) |
| VR4 | Admin approves pending request | User's AccountVisibility=Public, user notified |
| VR5 | Admin rejects without reason | 400 error (reason required) |
| VR6 | Admin rejects with reason | Request=Rejected, user notified with reason |
| VR7 | User re-requests after rejection | 201, new request created |
| VR8 | Admin approves already-approved request | 400 error (already processed) |
| VR9 | Non-admin tries admin endpoints | 403 Forbidden |

### 16.4 Backend Enforcement Tests

| # | Test | Expected |
|---|------|----------|
| E1 | Advertiser calls GET /screens/paged → private screens excluded | Private screens not in results |
| E2 | Advertiser calls GET /screens/{privateId} | 404 Not Found |
| E3 | Owner calls GET /screens/{ownPrivateId} | 200, screen returned |
| E4 | Admin calls GET /screens/{privateId} | 200, screen returned |
| E5 | Advertiser calls GET /screens/{privateId}/calendar | 404 |
| E6 | Advertiser calls GET /screens/{privateId}/availability | 404 |
| E7 | POST /screens/explore → private screens excluded | Already works (existing) |
| E8 | POST /screens/search → private screens excluded | Already works (existing) |

### 16.5 Frontend UI Tests

| # | Test | Expected |
|---|------|----------|
| U1 | Private owner → sidebar shows Dashboard, Screens, Analytics, Settings only | Bookings, Payouts hidden |
| U2 | Private owner → dashboard shows Screens Online, Total Screens only | Revenue, bookings cards hidden |
| U3 | Private owner → screen detail hides tags, pricing, verification tabs | Device mgmt, video, streaming shown |
| U4 | Private owner → create screen hides pricing fields | Name, location, schedule, images shown |
| U5 | Private owner → navigates to /bookings URL directly | Redirected to /dashboard with toast |
| U6 | Private owner → navigates to /payouts URL directly | Redirected to /dashboard with toast |
| U7 | Private owner → profile shows "Request Public Access" button | No toggle switch |
| U8 | Public owner → profile shows toggle switch | Can switch to Private |
| U9 | After admin approval → profile invalidated → portal shows Public features | Immediate UI update |

---

## 17. File Change Inventory

### Backend — New Files

| File | Purpose |
|------|---------|
| `CCMS.Domain/Entities/VisibilityChangeRequest.cs` | Domain entity |
| `CCMS.Domain/Enums/VisibilityRequestStatus.cs` | Enum (Pending, Approved, Rejected) |
| `CCMS.Api/Controllers/AdminVisibilityController.cs` | Admin CRUD endpoints |

### Backend — Modified Files

| File | Change |
|------|--------|
| `CCMS.Domain/Enums/NotificationType.cs` | Add 3 new enum values |
| `CCMS.Domain/Enums/ScreenVisibility.cs` | No change (already has Public=0, Private=1) |
| `CCMS.Domain/Entities/User.cs` | Add navigation: `ICollection<VisibilityChangeRequest> VisibilityChangeRequests` |
| `CCMS.Infrastructure/ApplicationDbContext.cs` | Add `DbSet<VisibilityChangeRequest>`, configure entity |
| `CCMS.Infrastructure/Services/AuthService.cs` | Accept `Visibility` field in RegisterAsync |
| `CCMS.Shared/DTOs/Auth/RegisterRequest.cs` | Add `string? Visibility` property |
| `CCMS.Api/Controllers/ProfileController.cs` | Add booking guard on toggle, block Private→Public toggle, add POST/GET visibility-request endpoints |
| `CCMS.Api/Controllers/ScreensController.cs` | Pass CallerRole/CallerUserId to queries |
| `CCMS.Application/Features/Screens/Queries/GetScreensPagedQuery*.cs` | Add CallerRole, visibility filter |
| `CCMS.Application/Features/Screens/Queries/GetScreenByIdQuery*.cs` | Add CallerUserId/Role, visibility check |
| `CCMS.Application/Features/Screens/Queries/GetScreensQuery*.cs` | Add CallerRole, visibility filter |
| `CCMS.Application/Features/Screens/Queries/GetScreenAvailabilityQuery*.cs` | Add visibility check |
| `CCMS.Application/Features/Screens/Queries/GetSlotCalendarQuery*.cs` | Add visibility check |

### Frontend — New Files

| File | Purpose |
|------|---------|
| `src/pages/admin/AdminVisibilityRequestsPage.tsx` | Admin management page |
| `src/components/admin/VisibilityRequestDetailDialog.tsx` | Admin detail + approve/reject dialog |
| `src/hooks/useAdminVisibilityRequests.ts` | Admin React Query hooks |
| `src/hooks/useVisibilityRequest.ts` | User's own visibility request hook |
| `src/hooks/useAccountVisibility.ts` | Convenience hook for `isPrivate`/`isPublic` |
| `src/services/visibilityApi.ts` | Axios API functions for visibility endpoints |

### Frontend — Modified Files

| File | Change |
|------|--------|
| `src/App.tsx` | Add `/register/private` route, `/admin/visibility-requests` route, private route guards |
| `src/pages/auth/RegisterPage.tsx` | Accept `mode` prop, conditional UI for private registration |
| `src/components/Layout/MainLayout.tsx` | Conditional sidebar nav items |
| `src/components/Layout/MobileBottomNav.tsx` | Conditional mobile nav items |
| `src/pages/dashboard/DashboardPage.tsx` | Conditional stat cards + components |
| `src/pages/screens/ScreenDetailPage.tsx` | Conditional tabs/sections |
| `src/pages/screens/ScreensPage.tsx` | Conditional card info |
| `src/pages/screens/CreateScreenPage.tsx` | Conditional form fields |
| `src/pages/screens/UpdateScreenPage.tsx` | Conditional form fields |
| `src/pages/analytics/AnalyticsPage.tsx` | Conditional charts/stats |
| `src/pages/profile/ProfileSettingsPage.tsx` | Reworked visibility section |
| `src/types/profile.ts` | Add visibility request types |

### Database — New Migration

| Migration | Tables | Indexes |
|-----------|--------|---------|
| `AddVisibilityChangeRequests` | `VisibilityChangeRequests` | `IX_UserId`, `IX_Status` |

---

## Implementation Order

### Phase 1: Database + Domain (foundation)
1. Create `VisibilityChangeRequest` entity
2. Create `VisibilityRequestStatus` enum
3. Add to `NotificationType` enum
4. Add `DbSet` + configure in `ApplicationDbContext`
5. Generate + apply EF migration

### Phase 2: Backend API (enforcement)
6. Modify `AuthService.RegisterAsync` to accept `visibility` field
7. Modify `ProfileController.UpdateVisibility` (booking guard + block Private→Public)
8. Add `ProfileController` visibility request endpoints (POST + GET)
9. Create `AdminVisibilityController` (list, detail, approve, reject)
10. Add visibility enforcement to screen query handlers (Steps 8.1–8.4)
11. Update `ScreensController` to pass CallerRole/CallerUserId

### Phase 3: Frontend — Core UI
12. Create `useAccountVisibility` hook
13. Modify `MainLayout.tsx` (conditional sidebar)
14. Modify `MobileBottomNav.tsx` (conditional nav)
15. Modify `DashboardPage.tsx` (conditional cards)
16. Modify `ScreenDetailPage.tsx` (conditional tabs)
17. Modify `CreateScreenPage.tsx` + `UpdateScreenPage.tsx` (conditional fields)
18. Modify `ScreensPage.tsx` (conditional display)
19. Modify `AnalyticsPage.tsx` (conditional charts)

### Phase 4: Frontend — Registration + Profile
20. Modify `RegisterPage.tsx` (private mode)
21. Add `/register/private` route in `App.tsx`
22. Rework `ProfileSettingsPage.tsx` visibility section
23. Create `visibilityApi.ts` + `useVisibilityRequest.ts`
24. Add route guards in `App.tsx`

### Phase 5: Frontend — Admin Portal
25. Create `visibilityApi.ts` admin functions
26. Create `useAdminVisibilityRequests.ts`
27. Create `AdminVisibilityRequestsPage.tsx`
28. Create `VisibilityRequestDetailDialog.tsx`
29. Add `/admin/visibility-requests` route + admin nav item

### Phase 6: Testing + Verification
30. Run all test scenarios from Section 16
31. Verify on all breakpoints (375px, 768px, 1440px)
32. Verify notification delivery (DB + SignalR)
33. Verify admin approval flow end-to-end
