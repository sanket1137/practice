# PixelSpot CCMS — Complete UI Description Document

> **Purpose:** Feed this document to a design AI to get UI improvement suggestions for the PixelSpot CCMS platform.

---

## 1. TECH STACK & UI LIBRARIES

### Core Framework
- **React 19.2** + **TypeScript 5.9** (Vite 7 bundler)
- **React Router DOM 7.10** — client-side routing with nested layouts

### UI Component Library
- **MUI (Material UI) v7.3.6** — primary component library
  - `@mui/material` — all core components (Box, Grid, Paper, Card, Button, TextField, Dialog, Table, Tabs, Chip, Badge, Tooltip, etc.)
  - `@mui/icons-material` — all icons (DashboardIcon, CampaignIcon, TvIcon, BookOnlineIcon, PaymentIcon, AnalyticsIcon, etc.)
  - `@mui/x-date-pickers v8.21` — date/time picker components

### Styling & Theming
- **@emotion/react + @emotion/styled** — CSS-in-JS (MUI's styling engine)
- **MUI createTheme** — centralized dark theme configuration
- No Tailwind CSS, no CSS modules — all styling via MUI `sx` prop and theme overrides

### State Management
- **Zustand 5.0** — lightweight state store (auth, UI state)
- **TanStack React Query 5.90** — server state, caching, mutations, query invalidation

### Forms & Validation
- **react-hook-form 7.67** — form state management
- **@hookform/resolvers 5.2** — schema resolver bridge
- **Zod 4.1** — schema validation

### Charts & Data Visualization
- **Recharts 3.5** — AreaChart, BarChart, LineChart, PieChart, ResponsiveContainer, Tooltip, Legend

### Maps
- **Leaflet 1.9** + **react-leaflet 5.0** — interactive maps
- **react-leaflet-cluster 4.0** — marker clustering for screen discovery
- **@react-leaflet/core 3.0** — core bindings

### Real-Time
- **@microsoft/signalr 10.0** — WebSocket hubs (PlaybackHub, PlayerHub, StreamingHub)

### HTTP & Auth
- **Axios 1.13** — API client with interceptors (token refresh, rate limit handling)
- **jwt-decode 4.0** — JWT token parsing

### Date/Time
- **date-fns 4.1** — date formatting, parsing
- **date-fns-tz 3.2** — timezone utilities

### UX Enhancements
- **notistack 3.0** — snackbar/toast notification system (stacked)
- **react-joyride 2.9** — guided tour / onboarding walkthrough
- **react-dropzone 14.3** — drag-and-drop file upload areas

### Payments
- **Razorpay SDK** (loaded via script tag) — payment gateway UI

---

## 2. THEME CONFIGURATION

```typescript
// File: frontend/src/theme.ts
palette: {
  mode: 'dark',
  primary:    { main: '#6366f1', light: '#818cf8', dark: '#4f46e5' },  // Indigo
  secondary:  { main: '#ec4899', light: '#f472b6', dark: '#db2777' },  // Pink
  background: { default: '#0f172a', paper: '#1e293b' },                // Slate 900/800
  text:       { primary: '#f8fafc', secondary: '#94a3b8' },            // Slate 50/400
}

typography: {
  fontFamily: '"Inter", "Roboto", "Helvetica", "Arial", sans-serif',
  h1: { fontWeight: 700, fontSize: '2.5rem' },
  h2: { fontWeight: 600, fontSize: '2rem' },
  // ... h3-h6 all fontWeight: 600
}

components: {
  MuiButton:  { textTransform: 'none', borderRadius: 8, fontWeight: 600 },
  MuiPaper:   { backgroundImage: 'none', borderRadius: 12 },
  MuiCard:    { borderRadius: 12, border: '1px solid rgba(255,255,255,0.1)' },
  MuiAppBar:  { backgroundColor: 'rgba(15,23,42,0.8)', backdropFilter: 'blur(8px)', borderBottom: '1px solid rgba(255,255,255,0.1)' },
}
```

### Design Tokens / Grid Constants
```typescript
// File: frontend/src/constants/layout.ts
RESPONSIVE_GRID = {
  stats: { xs: 12, sm: 6, md: 4, lg: 3 },   // Dashboard stat cards
  cards: { xs: 12, md: 6, lg: 4 },            // Content cards
  half:  { xs: 12, md: 6 },                   // Two-column
  third: { xs: 12, sm: 6, md: 4 },            // Three-column
  full:  { xs: 12 },                           // Full width
}
```

---

## 3. APPLICATION OVERVIEW

**PixelSpot CCMS** is a **Digital Out-of-Home (DOOH) advertising SaaS platform** targeting the Indian market. It's a two-sided marketplace connecting:
- **Screen Owners** (people with digital displays like shop screens, mall screens, office lobby displays)
- **Advertisers** (brands/agencies wanting to run ads on those physical screens)

With an **Admin** role for platform management.

**Business Model:** Slot-based advertising — screens have 6 slots per hour (10 min each). Advertisers book slots on specific screens for date ranges, screen owners approve/reject, and a Raspberry Pi player on the physical screen plays the video ads.

**Domain:** https://ccms.pixelspot.in  
**Branding:** PixelSpot — © 2024-2026 PixelSpot Technologies

---

## 4. USER ROLES & NAVIGATION

### Screen Owner Sidebar
| Icon | Label | Route |
|------|-------|-------|
| DashboardIcon | Dashboard | /dashboard |
| TvIcon | My Screens | /screens |
| BookOnlineIcon | Booking Requests | /bookings |
| AccountBalanceIcon | Payouts | /payouts |
| AnalyticsIcon | Earnings & Analytics | /analytics |
| SettingsIcon | Settings | /profile |

### Advertiser Sidebar
| Icon | Label | Route |
|------|-------|-------|
| DashboardIcon | Dashboard | /dashboard |
| CampaignIcon | Campaigns | /campaigns |
| ExploreIcon | Discover Screens | /screens/discover |
| BookOnlineIcon | My Bookings | /bookings |
| AnalyticsIcon | Campaign Analytics | /analytics |
| SettingsIcon | Settings | /profile |

### Admin Sidebar
| Icon | Label | Route |
|------|-------|-------|
| DashboardIcon | Dashboard | /dashboard |
| CampaignIcon | All Campaigns | /campaigns |
| TvIcon | All Screens | /screens |
| BookOnlineIcon | All Bookings | /bookings |
| AccountBalanceIcon | Payouts | /admin/payouts |
| SecurityIcon | Machines | /admin/machines |
| AnalyticsIcon | Platform Analytics | /analytics |
| SettingsIcon | Settings | /profile |

---

## 5. LAYOUT ARCHITECTURE

### MainLayout (authenticated pages)
```
┌─────────────────────────────────────────────────────────┐
│ AppBar (glassmorphism, sticky)                          │
│ [CCMS logo]  [BreadcrumbNav]  [ConnectionStatus]        │
│              [GlobalSearch ⌘K] [NotificationBell] [User]│
├──────────┬──────────────────────────────────────────────┤
│ Drawer   │  <Outlet /> (page content)                   │
│ (240px)  │                                              │
│          │  Container maxWidth="xl" sx={{ mt: 4 }}      │
│ ListItem │                                              │
│ ListItem │                                              │
│ ListItem │                                              │
│ ListItem │   [Page-specific content]                    │
│ ListItem │                                              │
│ ListItem │                                              │
│          │                                              │
│ [Logout] │                                              │
├──────────┴──────────────────────────────────────────────┤
│ MobileBottomNav (visible on xs/sm only)                 │
└─────────────────────────────────────────────────────────┘
```

**AppBar Features:**
- Glassmorphism: `rgba(15,23,42,0.8)` + `backdropFilter: blur(8px)`
- Breadcrumb navigation auto-generated from route
- GlobalSearch component (opens with Ctrl+K)
- ConnectionStatus indicator (green "Connected" / red "Disconnected" badge) — real-time WebSocket status
- Notification bell with unread count badge
- User avatar + name, click → profile/logout menu

**Drawer:** Permanent on desktop (240px), temporary on mobile (swipeable)

**MobileBottomNav:** BottomNavigation visible only on xs/sm breakpoints

---

## 6. ALL PAGES — DETAILED UI DESCRIPTION

### 6.1 Public Pages

#### Login Page (`/login`)
- Centered card on dark background
- Logo at top
- Email + Password TextFields
- "Forgot password?" link
- "Login" primary Button
- "Don't have an account? Register" link
- Notistack snackbar for errors

#### Register Page (`/register`)
- Centered card
- First Name, Last Name, Email, Phone, Password, Confirm Password fields
- Role selector: ScreenOwner or Advertiser (Radio or Select)
- Company Name field
- "Register" button → triggers email + phone verification flow
- Link to Login

#### Verify Email Page (`/verify-email`)
- Token-based verification (link from email)
- Auto-verifies on load, shows success/error

#### Verify Phone Page (`/verify-phone`)
- OTP input (6 digits)
- "Resend OTP" button with cooldown timer
- Shows progress: Email ✓ Phone pending

#### Resend Verification Page (`/resend-verification`)
- Email input, button to resend verification

#### Demo Page (`/demo`)
- Interactive demo with 24 sub-components simulating the platform
- Components: WelcomeTourModal, ScreenSelector, ScreenCard, ScreenCardSelector, SlotGrid, VideoUploader, VideoPreview, RotatingSlotVideo, ScreenPlayLogs, CampaignCard, CampaignLogs, CampaignRevenueBreakdown, LiveCampaignPreview, PricingCalculator, RevenueEstimator, ScreenOwnerPanel, AdvertiserPanel, GuidedTour (react-joyride), HelpModal, DebugSlots
- Split screen: ScreenOwner panel (left) + Advertiser panel (right)

#### Explore Screens Page (`/explore`)
- Public page, no login required
- Full-screen Leaflet map with clustered markers for all public screens
- ScreenMarker components showing screen details on click
- Filter/search overlay
- "Sign up to book" CTA

### 6.2 Dashboard (`/dashboard`)

#### Screen Owner Dashboard
- **Stat Cards Row** (Grid: xs:12, sm:6, md:4, lg:3):
  - Total Screens (count + online/offline)
  - Pending Bookings (awaiting approval)
  - Active Bookings (non-expired)
  - Total Revenue (INR)
  Each card: `EnhancedStatCard` — icon, value, label, trend %, sparkline mini-chart
- **ScreenStatusGrid** — grid of screen cards showing online/offline status per screen with Last Seen timestamp
- **OwnerApprovalQueue** — table of pending booking requests with quick Approve/Reject buttons, campaign name, screen, dates, price
- **Revenue chart** (Recharts AreaChart) — daily revenue for last 7/30 days

#### Advertiser Dashboard
- **Stat Cards Row:**
  - Total Campaigns
  - Active Campaigns
  - Total Bookings
  - Total Impressions
- **CampaignPerformanceCard** — top campaigns by impressions with horizontal BarChart
- **Recent campaigns** list with status chips
- **Quick Actions:** "Create Campaign", "Discover Screens", "View Bookings" buttons

#### Admin Dashboard
- Platform-wide stats: Total users, screens, campaigns, bookings, revenue
- Combined view of all roles

### 6.3 Campaigns

#### Campaigns List Page (`/campaigns`)
- Page title + "Create Campaign" button (top right)
- Search TextField + Status filter dropdown
- Grid of `EnhancedCampaignCard` components:
  - Card with campaign name, status Chip (Draft/Active/Paused/Completed/Cancelled)
  - Date range, budget, currency
  - Creative count, booking count
  - Progress indicator
  - Actions: View, Edit, Delete

#### Create Campaign Page (`/campaigns/new`)
- Multi-step form or single form:
  - Campaign Name (TextField)
  - Description (multiline TextField)
  - Start Date, End Date (DatePicker from @mui/x-date-pickers)
  - Budget (TextField number)
  - Currency (Select: INR/USD/EUR)
- Zod validation + react-hook-form
- Submit button

#### Campaign Detail Page (`/campaigns/:id`)
- Header: Campaign name + status Chip + Edit/Delete buttons
- **Info Section:** Grid with campaign details (dates, budget, status)
- **Creatives Tab:** Grid of creative cards (video thumbnail/image preview, filename, mime type, file size)
  - "Upload Creative" button → navigates to upload page
  - Creative lock status indicator (locked if used in approved booking)
- **Bookings Tab:** Table of bookings under this campaign
- **CampaignScreenStats** — which screens this campaign plays on, impression counts
- **Campaign Report** link

#### Edit Campaign Page (`/campaigns/:id/edit`)
- Same form as Create, pre-filled with existing data

#### Upload Creative Page (`/campaigns/:id/creatives/new`)
- `CreativeUpload` component:
  - react-dropzone area: "Drag & drop video/image here or click to browse"
  - File type validation (video/mp4, image/jpeg, image/png)
  - File size limit display
  - Upload progress bar
  - Preview after upload (video player or image)

### 6.4 Screens

#### My Screens Page (`/screens`) — Screen Owner
- "Add Screen" button (top right, FAB on mobile)
- Grid of `EnhancedScreenCard`:
  - Screen image (first from gallery)
  - Name, location text
  - Online/Offline status dot (green/red) + "Last seen X min ago"
  - Resolution, dimensions
  - Price per slot + currency
  - Total bookings count
  - Actions: View, Edit, Delete

#### Discover Screens Page (`/screens/discover`) — Advertiser
- **Split layout:**
  - **Left panel (filters):** Search by name/location, filter by tags (multi-select chips), price range slider, availability date range
  - **Right panel:** Leaflet map (`ScreensMap` component) with clustered markers
- Below map: Grid of available screen cards
- `BookScreenDialog` — opens when clicking "Book" on a screen card
  - Shows screen details, date picker, slot selector, price calculation
  - Confirms and creates a booking

#### Create Screen Page (`/screens/new`)
- Multi-section form:
  - **Basic Info:** Name, Description
  - **Physical:** Width, Height (inches), Resolution (e.g., 1920x1080)
  - **Location:** Address, City, State, Latitude, Longitude (map picker)
  - **Timezone:** `TimezoneSelector` component (IANA timezone dropdown)
  - **Operating Hours:** `OperatingScheduleForm` — per-day schedule (Mon-Sun start/end times)
  - **Pricing:** Price per slot, Currency select, Commission %
  - **Images:** `ScreenImageUpload` — multi-image drag-and-drop gallery
  - **Default Video:** `DefaultVideoSettings` — upload fallback video for empty slots

#### Screen Detail Page (`/screens/:id`)
- **Header:** Screen name + Online/Offline badge + Edit button
- **Image Gallery:** `ScreenImageGallery` — carousel/grid of screen photos
- **Info Grid:** Location, resolution, dimensions, pricing, timezone, operating hours
- **Tabs:**
  - **Availability Tab:** `AvailabilityHeatmap` — calendar heatmap showing slot fill rate per day; `SlotCalendarView` — detailed day view with 6 slots/hour; `SlotBookingsCard` — list of bookings on each slot
  - **Tags Tab:** `ScreenTagsTab` + `ScreenTagsManager` — view and manage auto-generated tags (150+ tags across 17 categories); `ScreenTagChip` — styled chip per tag with category color
  - **Live Activity Tab:** `LiveActivityTab` — real-time play logs, currently playing content, live impression counter
  - **Device Tab:** `DeviceManagementTab` — device fingerprint info, binding status, override controls, hardware serial
  - **Revenue Tab:** `RevenueEstimateCard` — projected vs actual earnings chart
- **Booking overlay** for advertisers to book directly

#### Update Screen Page (`/screens/:id/edit`)
- Same as Create form, pre-filled

### 6.5 Bookings

#### Bookings Page (`/bookings`)
- **BookingFiltersBar:** Search TextField + Status dropdown (All/Pending/Approved/Rejected/Cancelled/Active/Completed) + More Filters (date range)
- **Active/History Tabs** (MUI Tabs with Badge counts):
  - **Active Tab:** Bookings that are Pending/Approved/Active and NOT expired
  - **History Tab:** Completed/Rejected/Cancelled + expired bookings
- **Table** per tab:
  - Columns: Campaign, Screen, Creative, Period (startDate - endDate), Type (Full/Partial with tooltip), Created date, Impressions count, Price (currency + amount), Status (StatusChip)
  - **Actions column** (date-aware):
    - **Screen Owner + Pending + not expired:** Approve (green) + Reject (red) buttons
    - **Advertiser + Approved + start date not passed:** "Pay Now" (Razorpay) + Cancel
    - **Advertiser + start date passed but not expired:** "Update Dates" button
    - **Advertiser + Rejected:** "Re-request" button
    - **Expired:** Chip label "Expired"
    - **Active:** Cancel button
- **Dialogs:**
  - Approve Dialog: Creative preview (video/image Card), booking details Grid, "Approve Booking" button
  - Reject Dialog: Reason TextField (required), "Reject Booking" button
  - Cancel Dialog: Booking summary, optional reason TextField, "Cancel Booking" button
  - Update Dates / Re-request Dialog: Current booking info, New Start Date + New End Date pickers (min: tomorrow), "Update & Resubmit" button

#### Create Booking Page (`/bookings/new`)
- Step-by-step:
  1. Select Campaign (dropdown)
  2. Select Creative (from campaign's creatives)
  3. Select Screen (from discover list)
  4. Select Date Range (date pickers)
  5. View available slots → `SlotAvailabilityCard`
  6. `BookingConfirmationDialog` — summary with calculated price, confirm
- `BookingCalendarView` — calendar showing slot availability per day

#### Booking Detail Page (`/bookings/:id`)
- Full booking info: campaign, screen, creative, dates, slot numbers, pricing breakdown
- Status timeline/history
- Payment status
- Impression delivery progress (expected vs delivered)
- Actions based on status and role
- Link to Advertiser Report

### 6.6 Analytics (`/analytics`)

#### Screen Owner (Earnings & Analytics)
- **Revenue Overview:** Total earnings, pending payouts, completed payouts
- **Revenue Chart:** AreaChart — daily/weekly/monthly revenue (Recharts)
- **Screen Performance Table:** Per-screen breakdown (fill rate, impressions, earnings)
- **Top performing screens** ranking

#### Advertiser (Campaign Analytics)
- **Campaign Summary Stats:** Total spend, total impressions, avg CPM, active campaigns
- **Impressions Chart:** LineChart over time
- **Campaign Comparison Table:** Side-by-side campaign metrics
- **Screen-level breakdown** per campaign

#### Admin (Platform Analytics)
- Platform-wide metrics: GMV, total users, active screens, fill rates
- Charts for platform growth

### 6.7 Reports

#### Advertiser Booking Report (`/reports/bookings/:bookingId`)
- Detailed per-booking report: dates, impressions delivered per day, play logs
- Chart: daily impressions bar chart
- Download PDF option (generated server-side via QuestPDF)

#### Campaign Report (`/reports/campaigns/:campaignId`)
- Aggregated campaign performance across all bookings
- Screen-by-screen breakdown
- Impression delivery rate
- Cost analysis

### 6.8 Wallet (`/wallet`) — Advertiser
- **Balance Card:** Current wallet balance, currency
- **Actions:** "Top Up" button → Razorpay payment flow
- **Transaction History Table:** Date, Type (credit/debit/refund), Amount, Description, Running Balance
- Pagination controls

### 6.9 Payouts

#### Screen Owner Payouts (`/payouts`)
- **Payout Summary:** Total earned, pending payout, completed payouts
- **Bank Account Section:** Add/edit bank details
- **Payout History Table:** Date, Amount, Type (Advance/Final/Full), Status (Pending/Processing/Completed/Failed), Reference ID
- "Request Payout" button

#### Admin Payouts (`/admin/payouts`)
- **All Payouts Table:** All screen owner payout requests
- Columns: Owner name, Amount, Screen, Type, Status, Created date
- Actions: Approve, Process, Mark Failed
- Bulk action support

### 6.10 Notifications (`/notifications`)
- **Notification List:** Chronological feed
- Each notification: Icon (by type), Title, Message, Timestamp, Read/Unread indicator
- Types: BookingCreated, BookingApproved, BookingRejected, BookingCancelled, PaymentReceived, PayoutProcessed, SystemAlert, RefundProcessed
- "Mark all as read" button
- Pagination

### 6.11 Profile & Settings (`/profile`)
- **Profile Section:**
  - Avatar upload
  - First Name, Last Name, Email (read-only), Phone (read-only)
  - Company Name, GST Number
- **Preferences:**
  - Theme preference (dark/light — currently dark only)
  - Timezone preference
  - Currency preference
- **Screen Visibility** (Screen Owner only):
  - Toggle: Public / Private screens (account-level)
- **Bank Account** (Screen Owner only):
  - Account holder, Account number, IFSC, Bank name
- **Security:**
  - Change password form

### 6.12 Admin Pages

#### Admin Machines (`/admin/machines`)
- **Authorized Machines Table:**
  - Columns: Machine Name, IP Address, Device Fingerprint, Last Seen, Status, Added date
  - Actions: Authorize, Revoke, Edit
- "Add Machine" button → Dialog with name, IP, fingerprint fields
- Device override controls

---

## 7. REUSABLE COMPONENTS INVENTORY

### Common Components (frontend/src/components/common/)
| Component | Description |
|-----------|-------------|
| `StatusChip` | Color-coded MUI Chip for booking/campaign/payment statuses |
| `EnhancedStatCard` | Dashboard stat card with icon, value, label, trend %, sparkline |
| `LoadingSkeletons` | Skeleton loaders: TableSkeleton, StatCardSkeleton, CardSkeleton |
| `EmptyState` | "No data" illustration with title + message + optional CTA button |
| `ErrorState` | Error display with retry button |
| `ErrorBoundary` | React error boundary wrapper |
| `GlobalSearch` | Ctrl+K searchable command palette (searches campaigns, screens, bookings) |
| `GlobalLoading` | Full-page loading spinner overlay |
| `ConnectionStatus` | WebSocket connection indicator badge (green/red) |
| `BreadcrumbNavigation` | Auto-generated breadcrumbs from route path |
| `PageTransition` | Fade/slide animation wrapper for page transitions |
| `PaginationControls` | MUI Pagination + page size selector |
| `OfflineBanner` | Banner shown when browser is offline |
| `LivePreviewWidget` | Real-time impression counter badge (via SignalR) |
| `HelpTooltip` | Info icon with tooltip explanation |
| `KeyboardShortcutsPanel` | Dialog listing all keyboard shortcuts |
| `QuickActions` | Speed dial / floating action buttons |
| `BatchActions` | Multi-select toolbar for bulk operations |
| `MultiStepForm` | Step indicator + form wizard wrapper |
| `ValidatedTextField` | TextField with react-hook-form + Zod integration |
| `TimezoneSelector` | IANA timezone dropdown with search |

### Screen Components (frontend/src/components/screens/)
| Component | Description |
|-----------|-------------|
| `EnhancedScreenCard` | Screen listing card with image, status, location, pricing |
| `ScreenImageUpload` | Multi-image drag-drop uploader (react-dropzone) |
| `ScreenImageGallery` | Image carousel/grid viewer |
| `ScreenTagChip` | Styled chip for screen tags with category color |
| `ScreenTagsTab` | Tag display tab on screen detail |
| `ScreenTagsManager` | Admin interface to manage screen tags |
| `AvailabilityHeatmap` | Calendar heatmap of slot fill rates |
| `SlotCalendarView` | Detailed day-by-day slot grid |
| `SlotBookingsCard` | Slot-level booking list |
| `BookScreenDialog` | Booking creation dialog from screen detail |
| `OperatingScheduleForm` | Per-day operating hours form |
| `DefaultVideoSettings` | Default video upload and config |
| `RevenueEstimateCard` | Revenue projection vs actual chart |
| `LiveActivityTab` | Real-time play activity feed |
| `DeviceManagementTab` | Device fingerprint and binding controls |

### Booking Components (frontend/src/components/bookings/)
| Component | Description |
|-----------|-------------|
| `BookingFiltersBar` | Search + status + date range filters |
| `BookingCalendarView` | Calendar availability viewer |
| `BookingConfirmationDialog` | Booking summary + price confirmation |
| `SlotAvailabilityCard` | Visual slot grid showing available/booked slots |
| `SelfReserveDialog` | Screen owner self-booking dialog (with client name) |

### Campaign Components (frontend/src/components/campaigns/)
| Component | Description |
|-----------|-------------|
| `EnhancedCampaignCard` | Campaign listing card with status, budget, dates |
| `CampaignScreenStats` | Per-screen stats within a campaign |

### Dashboard Components (frontend/src/components/dashboard/)
| Component | Description |
|-----------|-------------|
| `EnhancedStatCard` | Stat card with icon, value, trend, sparkline |
| `ScreenStatusGrid` | Grid of screen online/offline cards |
| `OwnerApprovalQueue` | Pending booking approval table |
| `RecentActivityWidget` | Recent platform activity feed |
| `CampaignPerformanceCard` | Top campaigns by impressions chart |

### Map Components (frontend/src/components/map/)
| Component | Description |
|-----------|-------------|
| `ScreensMap` | Leaflet map with all public screens as markers |
| `ScreenMarker` | Individual screen marker with popup detail |

### Layout Components (frontend/src/components/Layout/)
| Component | Description |
|-----------|-------------|
| `MainLayout` | AppBar + Drawer + Outlet wrapper |
| `MobileBottomNav` | Bottom navigation for mobile viewports |

### Streaming Components (frontend/src/components/streaming/)
| Component | Description |
|-----------|-------------|
| `WebRTCPlayer` | WebRTC video player for live screen preview |

### Other
| Component | Description |
|-----------|-------------|
| `CreativeUpload` | Drag-drop creative file uploader with preview |
| `LivePreviewWidget` (in /live/) | Real-time play counter from SignalR |

---

## 8. STATUS ENUMS & COLOR MAPPING

### Booking Status
| Status | Color | Description |
|--------|-------|-------------|
| Pending | warning (orange) | Awaiting screen owner approval |
| Approved | info (blue) | Approved, awaiting payment |
| Rejected | error (red) | Rejected by screen owner |
| Cancelled | default (grey) | Cancelled by either party |
| Active | success (green) | Paid and currently running |
| Completed | success (darker) | Booking period ended |

### Campaign Status
| Status | Color |
|--------|-------|
| Draft | default (grey) |
| Active | success (green) |
| Paused | warning (orange) |
| Completed | info (blue) |
| Cancelled | error (red) |

### Payment Status
| Status | Color |
|--------|-------|
| Pending | warning |
| Authorized | info |
| Captured | success |
| Failed | error |
| Refunded | default |

### Screen Status
| Status | Indicator |
|--------|-----------|
| Online | Green dot + "Online" |
| Offline | Red dot + "Offline" + "Last seen X ago" |

---

## 9. UI PATTERNS & CONVENTIONS

### Data Tables
- MUI Table with TableHead/TableBody/TableRow/TableCell
- Hover effect on rows
- Action buttons in last column (right-aligned)
- StatusChip in status column
- Date formatting via date-fns: `toLocaleDateString()`
- Currency formatting: `{currency} {amount.toLocaleString()}`

### Cards
- MUI Card with 12px border-radius, subtle border
- CardContent for info, CardActions for buttons
- Image/video preview via CardMedia
- Responsive grid: xs:12, md:6, lg:4

### Dialogs
- MUI Dialog with DialogTitle, DialogContent, DialogActions
- Confirmation pattern: info summary → action buttons
- Form dialogs: TextField inputs → submit button with loading state
- Max width: "md" or "sm" depending on content

### Forms
- react-hook-form + Zod validation
- ValidatedTextField for consistent error display
- Grid layout for form fields
- Submit buttons show loading state (isPending from useMutation)
- Snackbar feedback on success/error (notistack)

### Loading States
- Skeleton components matching the final layout shape
- StatCardSkeleton, TableSkeleton for different content types
- GlobalLoading for full-page transitions

### Error States
- ErrorBoundary wrapping entire app
- Per-page error display with retry button
- API error handling via Axios interceptors → notistack snackbars

### Empty States
- EmptyState component with illustration, title, message, optional CTA
- Used in all list/table views when no data

### Real-Time Updates
- SignalR WebSocket connection with auto-reconnect
- Query invalidation on WebSocket events → TanStack Query refetches
- ConnectionStatus badge in AppBar (green "Connected" / red "Disconnected")
- Live impression counters via PlaybackHub

### Responsive Design
- MUI Grid v2 with `size` prop breakpoints
- Drawer: permanent on desktop, temporary (swipeable) on mobile
- MobileBottomNav visible only on small screens
- Tables become scrollable on mobile (TableContainer)
- Cards stack vertically on mobile (xs:12)

### Navigation
- BreadcrumbNavigation auto-generated from route
- GlobalSearch (Ctrl+K) command palette
- Sidebar navigation with active state highlighting
- react-router-dom for all routing

---

## 10. KEY IMPROVEMENT AREAS TO CONSIDER

1. **No landing page** — app opens directly to login, missing marketing/onboarding page
2. **Dark theme only** — no light theme toggle (preference stored but unused)
3. **Limited animations** — mostly static MUI components, could benefit from page transitions, micro-interactions
4. **Table-heavy views** — bookings, campaigns, payouts are all plain tables; could use card views or better visual hierarchy
5. **Status chips are small** — important status info is in tiny chips, could be more visual
6. **No data export** — no CSV/PDF export for tables
7. **Maps could be more prominent** — Discover Screens is the killer feature but map is only in one page
8. **Dashboard could be richer** — more charts, activity feeds, recent notifications inline
9. **Creative preview is basic** — no inline video preview in booking approval
10. **Mobile experience** — responsive but not mobile-first; bottom nav exists but limited
11. **Onboarding** — react-joyride exists in demo but not in main app
12. **Accessibility** — relying on MUI defaults, no custom ARIA labels or contrast testing
13. **No skeleton for charts** — charts just pop in without skeleton placeholder
14. **Calendar views** — could use a full calendar component instead of custom heatmaps
