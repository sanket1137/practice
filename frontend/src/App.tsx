import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider, CssBaseline } from '@mui/material';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SnackbarProvider } from 'notistack';
import * as Sentry from '@sentry/react';
import theme from './theme';
import { useAuthStore } from './store/authStore';
import { ErrorBoundary } from './components/common/ErrorBoundary';
import { OfflineBanner } from './components/common/OfflineBanner';
import { useRateLimitHandler } from './hooks/useRateLimitHandler';
import LoginPage from './pages/auth/LoginPage';
import RegisterPage from './pages/auth/RegisterPage';
import VerifyEmailPage from './pages/auth/VerifyEmailPage';
import VerifyPhonePage from './pages/auth/VerifyPhonePage';
import ResendVerificationPage from './pages/auth/ResendVerificationPage';
import ForgotPasswordPage from './pages/auth/ForgotPasswordPage';
import ResetPasswordPage from './pages/auth/ResetPasswordPage';
import DashboardPage from './pages/dashboard/DashboardPage';
import CampaignsPage from './pages/campaigns/CampaignsPage';
import CreateCampaignPage from './pages/campaigns/CreateCampaignPage';
import EditCampaignPage from './pages/campaigns/EditCampaignPage';
import CampaignDetailPage from './pages/campaigns/CampaignDetailPage';
import ScreensPage from './pages/screens/ScreensPage';
import CreateScreenPage from './pages/screens/CreateScreenPage';
import UpdateScreenPage from './pages/screens/UpdateScreenPage';
import ScreenDetailPage from './pages/screens/ScreenDetailPage';
import DiscoverScreensPage from './pages/screens/DiscoverScreensPage';
import BookingsPage from './pages/bookings/BookingsPage';
import CreateBookingPage from './pages/bookings/CreateBookingPage';
import BookingDetailPage from './pages/bookings/BookingDetailPage';
import AnalyticsPage from './pages/analytics/AnalyticsPage';
import AdvertiserReportPage from './pages/reports/AdvertiserReportPage';
import CampaignReportPage from './pages/reports/CampaignReportPage';
import PayoutsPage from './pages/payouts/PayoutsPage';
import NotificationsPage from './pages/notifications/NotificationsPage';
import MainLayout from './components/Layout/MainLayout';
import DemoPage from './pages/demo/DemoPage';
import ExploreScreensPage from './pages/public/ExploreScreensPage';
import LandingPage from './pages/public/LandingPage';
import ProfileSettingsPage from './pages/profile/ProfileSettingsPage';
import AdminPayoutsPage from './pages/payouts/AdminPayoutsPage';
import AdminMachinesPage from './pages/admin/AdminMachinesPage';
import AdminVerificationsPage from './pages/admin/AdminVerificationsPage';
import AdminVisibilityRequestsPage from './pages/admin/AdminVisibilityRequestsPage';
import VerifyScreenPage from './pages/verification/VerifyScreenPage';
import ClaimPlayerQrPage from './pages/player-pairing/ClaimPlayerQrPage';
import PricingRulesPage from './pages/screens/PricingRulesPage';
import AdminCreativeReviewPage from './pages/admin/AdminCreativeReviewPage';
import MediaLibraryPage from './pages/media/MediaLibraryPage';
import { FestivePricingPage } from './pages/screens/FestivePricingPage';
import { CmsBillingPage } from './pages/cms/CmsBillingPage';

// CMS subsystem
import CmsLayout from './pages/cms/CmsLayout';
import CmsScreensPage from './pages/cms/CmsScreensPage';
import CmsMediaPage from './pages/cms/CmsMediaPage';
import CmsPlaylistsPage from './pages/cms/CmsPlaylistsPage';
import CmsRemoteControlPage from './pages/cms/CmsRemoteControlPage';
import CmsSchedulePage from './pages/cms/CmsSchedulePage';
import CmsScreenGroupsPage from './pages/cms/CmsScreenGroupsPage';
import CmsMosaicEditorPage from './pages/cms/CmsMosaicEditorPage';
import LedZoneConfigPage from './pages/screens/LedZoneConfigPage';
import NotificationPreferencesPage from './pages/notifications/NotificationPreferencesPage';
import RoleAccessGate from './components/common/RoleAccessGate';

const queryClient = new QueryClient();

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  return isAuthenticated ? <>{children}</> : <Navigate to="/login" />;
};

// Shows landing page for guests; redirects authenticated users into the app
const SmartRoot: React.FC = () => {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  return isAuthenticated ? <Navigate to="/dashboard" replace /> : <LandingPage />;
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
                <Routes>
                {/* Landing page — public for guests, redirects to dashboard if authenticated */}
                <Route path="/" element={<SmartRoot />} />
                {/* Public Routes */}
                <Route path="/login" element={<LoginPage />} />
                <Route path="/register" element={<RegisterPage />} />                  <Route path="/register/private" element={<RegisterPage mode="private" />} />                <Route path="/verify-email" element={<VerifyEmailPage />} />
                <Route path="/verify-phone" element={<VerifyPhonePage />} />
                <Route path="/resend-verification" element={<ResendVerificationPage />} />
                <Route path="/forgot-password" element={<ForgotPasswordPage />} />
                <Route path="/reset-password" element={<ResetPasswordPage />} />
                <Route path="/demo" element={<DemoPage />} />
                <Route path="/explore" element={<ExploreScreensPage />} />
                <Route path="/verify/:screenId" element={<VerifyScreenPage />} />
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
              </Routes>
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
