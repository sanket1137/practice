import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider, CssBaseline } from '@mui/material';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SnackbarProvider } from 'notistack';
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
import UploadCreativePage from './pages/creatives/UploadCreativePage';
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
import VerifyScreenPage from './pages/verification/VerifyScreenPage';

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
                <Route path="/register" element={<RegisterPage />} />
                <Route path="/verify-email" element={<VerifyEmailPage />} />
                <Route path="/verify-phone" element={<VerifyPhonePage />} />
                <Route path="/resend-verification" element={<ResendVerificationPage />} />
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
                  <Route path="payouts" element={<PayoutsPage />} />
                  <Route path="notifications" element={<NotificationsPage />} />
                  <Route path="profile" element={<ProfileSettingsPage />} />
                  <Route path="admin/payouts" element={<AdminPayoutsPage />} />
                  <Route path="admin/machines" element={<AdminMachinesPage />} />
                  <Route path="admin/verifications" element={<AdminVerificationsPage />} />
                </Route>
              </Routes>
              </BrowserRouter>
            </AppGlobalHandlers>
          </SnackbarProvider>
        </ThemeProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

export default App;
