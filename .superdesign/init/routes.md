# Routes — PixelSpot CCMS

Framework: React Router DOM 7.10 (config-based routing in App.tsx)

## Full Route Config (`frontend/src/App.tsx`)

```typescript
<Routes>
  {/* Public Routes — no auth required */}
  <Route path="/login" element={<LoginPage />} />
  <Route path="/register" element={<RegisterPage />} />
  <Route path="/verify-email" element={<VerifyEmailPage />} />
  <Route path="/verify-phone" element={<VerifyPhonePage />} />
  <Route path="/resend-verification" element={<ResendVerificationPage />} />
  <Route path="/demo" element={<DemoPage />} />
  <Route path="/explore" element={<ExploreScreensPage />} />

  {/* Protected Routes — wrapped in MainLayout */}
  <Route path="/" element={<ProtectedRoute><MainLayout /></ProtectedRoute>}>
    <Route index element={<Navigate to="/dashboard" replace />} />
    <Route path="dashboard" element={<DashboardPage />} />
    <Route path="campaigns" element={<CampaignsPage />} />
    <Route path="campaigns/new" element={<CreateCampaignPage />} />
    <Route path="campaigns/:id/edit" element={<EditCampaignPage />} />
    <Route path="campaigns/:id" element={<CampaignDetailPage />} />
    <Route path="campaigns/:id/creatives/new" element={<UploadCreativePage />} />
    <Route path="screens" element={<ScreensPage />} />
    <Route path="screens/new" element={<CreateScreenPage />} />
    <Route path="screens/discover" element={<DiscoverScreensPage />} />
    <Route path="screens/:id/edit" element={<UpdateScreenPage />} />
    <Route path="screens/:id" element={<ScreenDetailPage />} />
    <Route path="bookings" element={<BookingsPage />} />
    <Route path="bookings/new" element={<CreateBookingPage />} />
    <Route path="bookings/:id" element={<BookingDetailPage />} />
    <Route path="reports/bookings/:bookingId" element={<AdvertiserReportPage />} />
    <Route path="reports/campaigns/:campaignId" element={<CampaignReportPage />} />
    <Route path="analytics" element={<AnalyticsPage />} />
    <Route path="wallet" element={<WalletPage />} />
    <Route path="payouts" element={<PayoutsPage />} />
    <Route path="notifications" element={<NotificationsPage />} />
    <Route path="profile" element={<ProfileSettingsPage />} />
    <Route path="admin/payouts" element={<AdminPayoutsPage />} />
    <Route path="admin/machines" element={<AdminMachinesPage />} />
  </Route>
</Routes>
```

## Page Summary

| Route | Component File | Description |
|-------|---------------|-------------|
| `/login` | `pages/auth/LoginPage.tsx` | Auth: email+password login form |
| `/register` | `pages/auth/RegisterPage.tsx` | Auth: role selection + registration form |
| `/demo` | `pages/demo/DemoPage.tsx` | Interactive split-screen demo (24 sub-components) |
| `/explore` | `pages/public/ExploreScreensPage.tsx` | Public Leaflet map of all screens |
| `/dashboard` | `pages/dashboard/DashboardPage.tsx` | Role-aware stat cards + charts + approval queue |
| `/campaigns` | `pages/campaigns/CampaignsPage.tsx` | Campaign grid with filters |
| `/campaigns/new` | `pages/campaigns/CreateCampaignPage.tsx` | Campaign creation form |
| `/campaigns/:id` | `pages/campaigns/CampaignDetailPage.tsx` | Campaign detail + tabs |
| `/screens` | `pages/screens/ScreensPage.tsx` | Screen grid (Screen Owner) |
| `/screens/discover` | `pages/screens/DiscoverScreensPage.tsx` | Map + filter + book (Advertiser) |
| `/screens/:id` | `pages/screens/ScreenDetailPage.tsx` | Screen detail + tabs |
| `/bookings` | `pages/bookings/BookingsPage.tsx` | Active/History tabs + booking table |
| `/analytics` | `pages/analytics/AnalyticsPage.tsx` | Charts + tables per role |
| `/wallet` | `pages/wallet/WalletPage.tsx` | Wallet balance + transactions |
| `/payouts` | `pages/payouts/PayoutsPage.tsx` | Payout requests + history |
| `/profile` | `pages/profile/ProfileSettingsPage.tsx` | Profile + preferences + bank |
| `/admin/machines` | `pages/admin/AdminMachinesPage.tsx` | Raspberry Pi device management |

## Missing Route: Landing Page
Currently `/` redirects to `/login` for unauthenticated users. There is **no dedicated marketing landing page**. This is a key improvement area — needs a public `/` route with `LandingPage` component.
