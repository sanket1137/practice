import React, { Suspense, lazy, useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider, CssBaseline, Box, CircularProgress } from '@mui/material';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SnackbarProvider } from 'notistack';
import * as Sentry from '@sentry/react';
import { isAxiosError } from 'axios';
import theme from './theme';
import { useAuthStore } from './store/authStore';
import { isTokenExpired } from './utils/tokenUtils';
import { doRefresh } from './services/api';
import { ErrorBoundary } from './components/common/ErrorBoundary';
import { OfflineBanner } from './components/common/OfflineBanner';
import { useRateLimitHandler } from './hooks/useRateLimitHandler';
import MainLayout from './components/Layout/MainLayout';
import RoleAccessGate from './components/common/RoleAccessGate';

// Auth pages (kept eager — first screens a guest sees)
import LoginPage from './pages/auth/LoginPage';
import RegisterPage from './pages/auth/RegisterPage';
import VerifyEmailPage from './pages/auth/VerifyEmailPage';
import VerifyPhonePage from './pages/auth/VerifyPhonePage';
import ResendVerificationPage from './pages/auth/ResendVerificationPage';
import ForgotPasswordPage from './pages/auth/ForgotPasswordPage';
import ResetPasswordPage from './pages/auth/ResetPasswordPage';

// Route-level code splitting: all app pages are lazy-loaded
const DashboardPage = lazy(() => import('./pages/dashboard/DashboardPage'));
const CampaignsPage = lazy(() => import('./pages/campaigns/CampaignsPage'));
const CreateCampaignPage = lazy(() => import('./pages/campaigns/CreateCampaignPage'));
const EditCampaignPage = lazy(() => import('./pages/campaigns/EditCampaignPage'));
const CampaignDetailPage = lazy(() => import('./pages/campaigns/CampaignDetailPage'));
const ScreensPage = lazy(() => import('./pages/screens/ScreensPage'));
const CreateScreenPage = lazy(() => import('./pages/screens/CreateScreenPage'));
const UpdateScreenPage = lazy(() => import('./pages/screens/UpdateScreenPage'));
const ScreenDetailPage = lazy(() => import('./pages/screens/ScreenDetailPage'));
const DiscoverScreensPage = lazy(() => import('./pages/screens/DiscoverScreensPage'));
const BookingsPage = lazy(() => import('./pages/bookings/BookingsPage'));
const CreateBookingPage = lazy(() => import('./pages/bookings/CreateBookingPage'));
const BookingDetailPage = lazy(() => import('./pages/bookings/BookingDetailPage'));
const AnalyticsPage = lazy(() => import('./pages/analytics/AnalyticsPage'));
const AdvertiserReportPage = lazy(() => import('./pages/reports/AdvertiserReportPage'));
const CampaignReportPage = lazy(() => import('./pages/reports/CampaignReportPage'));
const PayoutsPage = lazy(() => import('./pages/payouts/PayoutsPage'));
const NotificationsPage = lazy(() => import('./pages/notifications/NotificationsPage'));
const DemoPage = lazy(() => import('./pages/demo/DemoPage'));
const ExploreScreensPage = lazy(() => import('./pages/public/ExploreScreensPage'));
const AboutUs = lazy(() => import('./pages/legal/AboutUs'));
const ContactUs = lazy(() => import('./pages/legal/ContactUs'));
const PrivacyPolicy = lazy(() => import('./pages/legal/PrivacyPolicy'));
const RefundPolicy = lazy(() => import('./pages/legal/RefundPolicy'));
const TermsOfService = lazy(() => import('./pages/legal/TermsOfService'));
const CookiesPolicy = lazy(() => import('./pages/legal/CookiesPolicy'));
const ContentPolicy = lazy(() => import('./pages/legal/ContentPolicy'));
const CommunityGuidelines = lazy(() => import('./pages/legal/CommunityGuidelines'));
const Disclaimer = lazy(() => import('./pages/legal/Disclaimer'));
const ProfileSettingsPage = lazy(() => import('./pages/profile/ProfileSettingsPage'));
const AdminPayoutsPage = lazy(() => import('./pages/payouts/AdminPayoutsPage'));
const AdminMachinesPage = lazy(() => import('./pages/admin/AdminMachinesPage'));
const AdminVerificationsPage = lazy(() => import('./pages/admin/AdminVerificationsPage'));
const AdminVisibilityRequestsPage = lazy(() => import('./pages/admin/AdminVisibilityRequestsPage'));
const VerifyScreenPage = lazy(() => import('./pages/verification/VerifyScreenPage'));
const ClaimPlayerQrPage = lazy(() => import('./pages/player-pairing/ClaimPlayerQrPage'));
const PricingRulesPage = lazy(() => import('./pages/screens/PricingRulesPage'));
const AdminCreativeReviewPage = lazy(() => import('./pages/admin/AdminCreativeReviewPage'));
const MediaLibraryPage = lazy(() => import('./pages/media/MediaLibraryPage'));
const FestivePricingPage = lazy(() =>
  import('./pages/screens/FestivePricingPage').then((m) => ({ default: m.FestivePricingPage }))
);
const CmsBillingPage = lazy(() =>
  import('./pages/cms/CmsBillingPage').then((m) => ({ default: m.CmsBillingPage }))
);
const NotFoundPage = lazy(() => import('./pages/NotFoundPage'));

// CMS subsystem
const CmsLayout = lazy(() => import('./pages/cms/CmsLayout'));
const CmsScreensPage = lazy(() => import('./pages/cms/CmsScreensPage'));
const CmsMediaPage = lazy(() => import('./pages/cms/CmsMediaPage'));
const CmsPlaylistsPage = lazy(() => import('./pages/cms/CmsPlaylistsPage'));
const CmsRemoteControlPage = lazy(() => import('./pages/cms/CmsRemoteControlPage'));
const CmsSchedulePage = lazy(() => import('./pages/cms/CmsSchedulePage'));
const CmsScreenGroupsPage = lazy(() => import('./pages/cms/CmsScreenGroupsPage'));
const CmsMosaicEditorPage = lazy(() => import('./pages/cms/CmsMosaicEditorPage'));
const LedZoneConfigPage = lazy(() => import('./pages/screens/LedZoneConfigPage'));
const NotificationPreferencesPage = lazy(
  () => import('./pages/notifications/NotificationPreferencesPage')
);

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      refetchOnWindowFocus: false,
      retry: (failureCount, error) => {
        // Never retry client (4xx) errors — they won't succeed on retry
        if (isAxiosError(error)) {
          const status = error.response?.status;
          if (status !== undefined && status >= 400 && status < 500) {
            return false;
          }
        }
        // Retry network / 5xx errors up to 2 times
        return failureCount < 2;
      },
    },
  },
});

const SuspenseFallback = () => (
  <Box
    sx={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '60vh',
      width: '100%',
    }}
  >
    <CircularProgress />
  </Box>
);

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const accessToken = useAuthStore((state) => state.accessToken);
  const logout = useAuthStore((state) => state.logout);

  // The refresh token lives in an HttpOnly cookie now — JavaScript can't read
  // it to decide "is a refresh possible" up front. So: a valid access token
  // means usable immediately; an expired one means we don't know yet and
  // must ask the server (a silent refresh call, which succeeds only if the
  // browser still holds a valid refresh cookie).
  const [checking, setChecking] = useState(() => isAuthenticated && isTokenExpired(accessToken));

  useEffect(() => {
    if (!isAuthenticated) {
      setChecking(false);
      return;
    }
    if (!isTokenExpired(accessToken)) {
      setChecking(false);
      return;
    }

    let cancelled = false;
    setChecking(true);
    doRefresh()
      .catch(() => {
        if (!cancelled) logout();
      })
      .finally(() => {
        if (!cancelled) setChecking(false);
      });

    return () => {
      cancelled = true;
    };
    // Only re-run when auth identity or the specific token value changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, accessToken]);

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  if (checking) {
    return <SuspenseFallback />;
  }
  if (isTokenExpired(accessToken)) {
    return <Navigate to="/login" replace />;
  }
  return <>{children}</>;
};

// Shows landing page for guests; redirects authenticated users into the app
const SmartRoot: React.FC = () => {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  return isAuthenticated ? <Navigate to="/dashboard" replace /> : <Navigate to="/login" replace />;
};

// Component that initializes global handlers (must be inside SnackbarProvider)
const AppGlobalHandlers: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  useRateLimitHandler();
  return (
    <>
      <OfflineBanner variant="snackbar" />
      {children}
    </>
  );
};

function App() {
  return (
    <Sentry.ErrorBoundary fallback={<ErrorBoundary><div /></ErrorBoundary>}>
      <ErrorBoundary>
        <QueryClientProvider client={queryClient}>
        <ThemeProvider theme={theme}>
          <CssBaseline />
          <SnackbarProvider maxSnack={3}>
            <AppGlobalHandlers>
              <BrowserRouter>
                <Suspense fallback={<SuspenseFallback />}>
                <Routes>
                {/* Landing page — public for guests, redirects to dashboard if authenticated */}
                <Route path="/" element={<SmartRoot />} />
                {/* Public Routes */}
                <Route path="/login" element={<LoginPage />} />
                <Route path="/register" element={<RegisterPage />} />
                <Route path="/register/private" element={<RegisterPage mode="private" />} />
                <Route path="/verify-email" element={<VerifyEmailPage />} />
                <Route path="/verify-phone" element={<VerifyPhonePage />} />
                <Route path="/resend-verification" element={<ResendVerificationPage />} />
                <Route path="/forgot-password" element={<ForgotPasswordPage />} />
                <Route path="/reset-password" element={<ResetPasswordPage />} />
                <Route path="/demo" element={<DemoPage />} />
                <Route path="/explore" element={<ExploreScreensPage />} />
                <Route path="/verify/:screenId" element={<VerifyScreenPage />} />
                <Route path="/about" element={<AboutUs />} />
                <Route path="/contact" element={<ContactUs />} />
                <Route path="/privacy" element={<PrivacyPolicy />} />
                <Route path="/terms" element={<TermsOfService />} />
                <Route path="/refund" element={<RefundPolicy />} />
                <Route path="/cookies" element={<CookiesPolicy />} />
                <Route path="/content-policy" element={<ContentPolicy />} />
                <Route path="/community-guidelines" element={<CommunityGuidelines />} />
                <Route path="/disclaimer" element={<Disclaimer />} />
                <Route
                  path="/"
                  element={
                    <ProtectedRoute>
                      <MainLayout />
                    </ProtectedRoute>
                  }
                >
                  <Route path="dashboard" element={<DashboardPage />} />
                  <Route path="campaigns" element={<CampaignsPage />} />
                  <Route path="campaigns/new" element={<CreateCampaignPage />} />
                  <Route path="campaigns/create" element={<CreateCampaignPage />} />
                  <Route path="campaigns/:id/edit" element={<EditCampaignPage />} />
                  <Route path="campaigns/:id" element={<CampaignDetailPage />} />
                  <Route path="media" element={<MediaLibraryPage />} />
                  <Route path="screens" element={<ScreensPage />} />
                  <Route path="screens/new" element={<CreateScreenPage />} />
                  <Route path="screens/discover" element={<DiscoverScreensPage />} />
                  <Route path="screens/:id/edit" element={<UpdateScreenPage />} />
                  <Route path="screens/:id" element={<ScreenDetailPage />} />
                  <Route path="screens/:id/pricing" element={<PricingRulesPage />} />
                  <Route path="screens/:screenId/pricing/festive" element={<FestivePricingPage />} />
                  <Route path="bookings" element={<RoleAccessGate rule="bookings"><BookingsPage /></RoleAccessGate>} />
                  <Route path="bookings/new" element={<RoleAccessGate rule="bookings"><CreateBookingPage /></RoleAccessGate>} />
                  <Route path="bookings/:id" element={<RoleAccessGate rule="bookings"><BookingDetailPage /></RoleAccessGate>} />
                  <Route path="reports/bookings/:bookingId" element={<AdvertiserReportPage />} />
                  <Route path="reports/campaigns/:campaignId" element={<CampaignReportPage />} />
                  <Route path="analytics" element={<AnalyticsPage />} />
                  <Route path="payouts" element={<RoleAccessGate rule="payouts"><PayoutsPage /></RoleAccessGate>} />
                  <Route path="notifications" element={<NotificationsPage />} />
                  <Route path="notifications/settings" element={<NotificationPreferencesPage />} />
                  <Route path="profile" element={<ProfileSettingsPage />} />
                  <Route path="player-pair" element={<ClaimPlayerQrPage />} />
                  <Route path="admin/payouts" element={<RoleAccessGate rule="admin"><AdminPayoutsPage /></RoleAccessGate>} />
                  <Route path="admin/machines" element={<RoleAccessGate rule="admin"><AdminMachinesPage /></RoleAccessGate>} />
                  <Route path="admin/verifications" element={<RoleAccessGate rule="admin"><AdminVerificationsPage /></RoleAccessGate>} />
                  <Route path="admin/visibility-requests" element={<RoleAccessGate rule="admin"><AdminVisibilityRequestsPage /></RoleAccessGate>} />
                  <Route path="admin/creatives/review" element={<RoleAccessGate rule="admin"><AdminCreativeReviewPage /></RoleAccessGate>} />
                  <Route path="screens/:screenId/led-zones" element={<LedZoneConfigPage />} />
                </Route>

                {/* CMS subsystem (private CMS-mode owners) */}
                <Route
                  path="/cms"
                  element={
                    <ProtectedRoute>
                      <CmsLayout />
                    </ProtectedRoute>
                  }
                >
                  <Route index element={<Navigate to="screens" replace />} />
                  <Route path="screens" element={<CmsScreensPage />} />
                  <Route path="screens/:screenId/control" element={<CmsRemoteControlPage />} />
                  <Route path="media" element={<CmsMediaPage />} />
                  <Route path="playlists" element={<CmsPlaylistsPage />} />
                  <Route path="schedule" element={<CmsSchedulePage />} />
                  <Route path="groups" element={<CmsScreenGroupsPage />} />
                  <Route path="groups/:groupId/mosaic" element={<CmsMosaicEditorPage />} />
                  <Route path="billing" element={<CmsBillingPage />} />
                </Route>

                {/* 404 catch-all */}
                <Route path="*" element={<NotFoundPage />} />
              </Routes>
                </Suspense>
              </BrowserRouter>
            </AppGlobalHandlers>
          </SnackbarProvider>
        </ThemeProvider>
      </QueryClientProvider>
    </ErrorBoundary>
    </Sentry.ErrorBoundary>
  );
}

export default App;
