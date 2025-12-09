import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider, CssBaseline } from '@mui/material';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SnackbarProvider } from 'notistack';
import theme from './theme';
import { useAuthStore } from './store/authStore';
import LoginPage from './pages/auth/LoginPage';
import RegisterPage from './pages/auth/RegisterPage';
import DashboardPage from './pages/dashboard/DashboardPage';
import CampaignsPage from './pages/campaigns/CampaignsPage';
import CreateCampaignPage from './pages/campaigns/CreateCampaignPage';
import EditCampaignPage from './pages/campaigns/EditCampaignPage';
import CampaignDetailPage from './pages/campaigns/CampaignDetailPage';
import ScreensPage from './pages/screens/ScreensPage';
import CreateScreenPage from './pages/screens/CreateScreenPage';
import ScreenDetailPage from './pages/screens/ScreenDetailPage';
import BookingsPage from './pages/bookings/BookingsPage';
import CreateBookingPage from './pages/bookings/CreateBookingPage';
import UploadCreativePage from './pages/creatives/UploadCreativePage';
import AnalyticsPage from './pages/analytics/AnalyticsPage';
import MainLayout from './components/Layout/MainLayout';

const queryClient = new QueryClient();

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  return isAuthenticated ? <>{children}</> : <Navigate to="/login" />;
};

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <SnackbarProvider maxSnack={3}>
          <BrowserRouter>
            <Routes>
              <Route path="/login" element={<LoginPage />} />
              <Route path="/register" element={<RegisterPage />} />
              <Route
                path="/"
                element={
                  <ProtectedRoute>
                    <MainLayout />
                  </ProtectedRoute>
                }
              >
                <Route index element={<Navigate to="/dashboard" replace />} />
                <Route path="dashboard" element={<DashboardPage />} />
                <Route path="campaigns" element={<CampaignsPage />} />
                <Route path="campaigns/new" element={<CreateCampaignPage />} />
                <Route path="campaigns/:id/edit" element={<EditCampaignPage />} />
                <Route path="campaigns/:id" element={<CampaignDetailPage />} />
                <Route path="campaigns/:id/creatives/new" element={<UploadCreativePage />} />
                <Route path="screens" element={<ScreensPage />} />
                <Route path="screens/new" element={<CreateScreenPage />} />
                <Route path="screens/:id" element={<ScreenDetailPage />} />
                <Route path="bookings" element={<BookingsPage />} />
                <Route path="bookings/new" element={<CreateBookingPage />} />
                <Route path="analytics" element={<AnalyticsPage />} />
              </Route>
            </Routes>
          </BrowserRouter>
        </SnackbarProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
