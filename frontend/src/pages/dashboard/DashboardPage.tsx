import {
    Box,
    Container,
    Grid,
    Typography,
    Paper,
    Card,
    CardContent,
    CardActions,
    Button,
    Chip,
} from '@mui/material';
import {
    Campaign as CampaignIcon,
    Tv as ScreenIcon,
    BookOnline as BookingIcon,
    TrendingUp as TrendingUpIcon,
    Image as CreativeIcon,
    AttachMoney as MoneyIcon,
    Search as SearchIcon,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../services/api';
import { useAuthStore } from '../../store/authStore';
import { useUserRole } from '../../hooks/useUserRole';
import EnhancedStatCard from '../../components/dashboard/EnhancedStatCard';
import OwnerApprovalQueue from '../../components/dashboard/OwnerApprovalQueue';
import ScreenStatusGrid from '../../components/dashboard/ScreenStatusGrid';
import CampaignPerformanceCard from '../../components/dashboard/CampaignPerformanceCard';
import { StatCardSkeleton } from '../../components/common/LoadingSkeletons';

interface DashboardStats {
    totalCampaigns: number;
    activeCampaigns: number;
    totalCreatives: number;
    totalBookings: number;
    pendingBookings: number;
    totalImpressions: number;
    totalScreens: number;
    onlineScreens: number;
    totalRevenue: number;
}

interface Campaign {
    id: string;
    name: string;
    status: string;
    budget: number;
    currency: string;
    startDate: string;
    endDate: string;
}

interface Booking {
    id: string;
    screenName: string;
    campaignName: string;
    status: string;
    startDate: string;
    endDate: string;
    totalPrice: number;
    currency: string;
}

interface Screen {
    id: string;
    name: string;
    status: string;
    isOnline: boolean;
}

export default function DashboardPage() {
    const navigate = useNavigate();
    const { user } = useAuthStore();
    const { isScreenOwner, isAdvertiser, role } = useUserRole();

    // Fetch campaigns
    const { data: campaigns, isLoading: campaignsLoading } = useQuery<Campaign[]>({
        queryKey: ['campaigns'],
        queryFn: async () => {
            const response = await api.get('/campaigns');
            return response.data.data;
        },
    });

    // Fetch bookings
    const { data: bookings, isLoading: bookingsLoading } = useQuery<Booking[]>({
        queryKey: ['bookings'],
        queryFn: async () => {
            const response = await api.get('/bookings');
            return response.data.data;
        },
    });

    // Fetch screens
    const { data: screens, isLoading: screensLoading } = useQuery<Screen[]>({
        queryKey: ['screens'],
        queryFn: async () => {
            const response = await api.get('/screens');
            return response.data?.data || [];
        },
    });

    const isLoading = campaignsLoading || bookingsLoading || screensLoading;

    // Calculate stats
    const stats: DashboardStats = {
        totalCampaigns: campaigns?.length || 0,
        activeCampaigns: campaigns?.filter(c => c.status === 'Active').length || 0,
        totalCreatives: 0,
        totalBookings: bookings?.length || 0,
        pendingBookings: bookings?.filter(b => b.status === 'Pending').length || 0,
        totalImpressions: 0,
        totalScreens: screens?.length || 0,
        onlineScreens: screens?.filter(s => s.isOnline).length || 0,
        totalRevenue: bookings?.filter(b => b.status === 'Approved' || b.status === 'Active' || b.status === 'Completed')
            .reduce((sum, b) => sum + b.totalPrice, 0) || 0,
    };

    const getRoleLabel = () => {
        switch (role) {
            case 'ScreenOwner': return 'Screen Owner';
            case 'Advertiser': return 'Advertiser';
            case 'Admin': return 'Administrator';
            default: return role;
        }
    };

    const getRoleColor = () => {
        switch (role) {
            case 'ScreenOwner': return 'primary';
            case 'Advertiser': return 'secondary';
            case 'Admin': return 'error';
            default: return 'default';
        }
    };

    if (isLoading) {
        return (
            <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
                <Typography variant="h4" gutterBottom>
                    Welcome back, {user?.firstName}!
                </Typography>
                <StatCardSkeleton count={4} />
            </Container>
        );
    }

    // ==========================================
    // SCREEN OWNER DASHBOARD
    // ==========================================
    if (isScreenOwner) {
        return (
            <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
                {/* Welcome Section */}
                <Box mb={4}>
                    <Box display="flex" alignItems="center" gap={2} mb={1}>
                        <Typography variant="h4">
                            Welcome back, {user?.firstName}!
                        </Typography>
                        <Chip label={getRoleLabel()} color={getRoleColor() as any} size="small" />
                    </Box>
                    <Typography variant="body1" color="textSecondary">
                        Manage your screens and review booking requests
                    </Typography>
                </Box>

                {/* Owner Stats Grid */}
                <Grid container spacing={3} sx={{ mb: 4 }}>
                    <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                        <EnhancedStatCard
                            title="My Screens"
                            value={stats.totalScreens}
                            subtitle={`${stats.onlineScreens} online`}
                            icon={<ScreenIcon />}
                            color="primary.main"
                        />
                    </Grid>
                    <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                        <EnhancedStatCard
                            title="Pending Requests"
                            value={stats.pendingBookings}
                            subtitle="Awaiting approval"
                            icon={<BookingIcon />}
                            color="warning.main"
                        />
                    </Grid>
                    <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                        <EnhancedStatCard
                            title="Active Bookings"
                            value={bookings?.filter(b => b.status === 'Approved' || b.status === 'Active').length || 0}
                            subtitle="Currently running"
                            icon={<TrendingUpIcon />}
                            color="success.main"
                        />
                    </Grid>
                    <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                        <EnhancedStatCard
                            title="Total Revenue"
                            value={`₹${stats.totalRevenue.toLocaleString()}`}
                            subtitle="From approved bookings"
                            icon={<MoneyIcon />}
                            color="info.main"
                        />
                    </Grid>
                </Grid>

                {/* Main Content */}
                <Grid container spacing={3}>
                    {/* Pending Approvals - Prominent Position */}
                    <Grid size={{ xs: 12, md: 6 }}>
                        <OwnerApprovalQueue />
                    </Grid>

                    {/* Screen Status Grid */}
                    <Grid size={{ xs: 12, md: 6 }}>
                        <ScreenStatusGrid />
                    </Grid>
                </Grid>

                {/* Quick Actions */}
                <Paper sx={{ p: 3, mt: 3 }}>
                    <Typography variant="h6" mb={2}>
                        Quick Actions
                    </Typography>
                    <Grid container spacing={2}>
                        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                            <Button
                                fullWidth
                                variant="contained"
                                startIcon={<ScreenIcon />}
                                onClick={() => navigate('/screens/new')}
                            >
                                Add New Screen
                            </Button>
                        </Grid>
                        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                            <Button
                                fullWidth
                                variant="outlined"
                                startIcon={<ScreenIcon />}
                                onClick={() => navigate('/screens')}
                            >
                                Manage Screens
                            </Button>
                        </Grid>
                        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                            <Button
                                fullWidth
                                variant="outlined"
                                startIcon={<BookingIcon />}
                                onClick={() => navigate('/bookings')}
                            >
                                View All Requests
                            </Button>
                        </Grid>
                        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                            <Button
                                fullWidth
                                variant="outlined"
                                startIcon={<TrendingUpIcon />}
                                onClick={() => navigate('/analytics')}
                            >
                                View Earnings
                            </Button>
                        </Grid>
                    </Grid>
                </Paper>
            </Container>
        );
    }

    // ==========================================
    // ADVERTISER DASHBOARD
    // ==========================================
    if (isAdvertiser) {
        return (
            <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
                {/* Welcome Section */}
                <Box mb={4}>
                    <Box display="flex" alignItems="center" gap={2} mb={1}>
                        <Typography variant="h4">
                            Welcome back, {user?.firstName}!
                        </Typography>
                        <Chip label={getRoleLabel()} color={getRoleColor() as any} size="small" />
                    </Box>
                    <Typography variant="body1" color="textSecondary">
                        Create campaigns and track your advertising performance
                    </Typography>
                </Box>

                {/* Advertiser Stats Grid */}
                <Grid container spacing={3} sx={{ mb: 4 }}>
                    <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                        <EnhancedStatCard
                            title="My Campaigns"
                            value={stats.totalCampaigns}
                            subtitle={`${stats.activeCampaigns} active`}
                            icon={<CampaignIcon />}
                            color="primary.main"
                        />
                    </Grid>
                    <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                        <EnhancedStatCard
                            title="My Bookings"
                            value={stats.totalBookings}
                            subtitle={`${stats.pendingBookings} pending approval`}
                            icon={<BookingIcon />}
                            color="success.main"
                        />
                    </Grid>
                    <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                        <EnhancedStatCard
                            title="Available Screens"
                            value={stats.totalScreens}
                            subtitle="Browse marketplace"
                            icon={<ScreenIcon />}
                            color="warning.main"
                        />
                    </Grid>
                    <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                        <EnhancedStatCard
                            title="Total Impressions"
                            value={stats.totalImpressions.toLocaleString()}
                            subtitle="Verified plays"
                            icon={<TrendingUpIcon />}
                            color="info.main"
                        />
                    </Grid>
                </Grid>

                {/* Main Content */}
                <Grid container spacing={3}>
                    {/* Campaign Performance */}
                    <Grid size={{ xs: 12, md: 6 }}>
                        <CampaignPerformanceCard />
                    </Grid>

                    {/* Recent Bookings */}
                    <Grid size={{ xs: 12, md: 6 }}>
                        <Paper sx={{ p: 3, height: '100%' }}>
                            <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                                <Typography variant="h6">My Recent Bookings</Typography>
                                <Button size="small" onClick={() => navigate('/bookings')}>
                                    View All
                                </Button>
                            </Box>
                            {bookings && bookings.length > 0 ? (
                                bookings.slice(0, 5).map((booking) => (
                                    <Card key={booking.id} sx={{ mb: 2 }}>
                                        <CardContent sx={{ pb: 1 }}>
                                            <Box display="flex" justifyContent="space-between" alignItems="start">
                                                <Box>
                                                    <Typography variant="subtitle1" fontWeight="bold">
                                                        {booking.screenName}
                                                    </Typography>
                                                    <Typography variant="body2" color="textSecondary">
                                                        {booking.campaignName}
                                                    </Typography>
                                                    <Typography variant="body2" color="textSecondary">
                                                        {new Date(booking.startDate).toLocaleDateString()} -{' '}
                                                        {new Date(booking.endDate).toLocaleDateString()}
                                                    </Typography>
                                                </Box>
                                                <Chip
                                                    label={booking.status}
                                                    color={
                                                        booking.status === 'Approved' || booking.status === 'Active'
                                                            ? 'success'
                                                            : booking.status === 'Pending'
                                                                ? 'warning'
                                                                : 'error'
                                                    }
                                                    size="small"
                                                />
                                            </Box>
                                            <Typography variant="body2" sx={{ mt: 1 }}>
                                                Price: {booking.currency} {booking.totalPrice.toLocaleString()}
                                            </Typography>
                                        </CardContent>
                                        <CardActions sx={{ pt: 0 }}>
                                            <Button
                                                size="small"
                                                onClick={() => navigate(`/bookings/${booking.id}`)}
                                            >
                                                View Details
                                            </Button>
                                        </CardActions>
                                    </Card>
                                ))
                            ) : (
                                <Box textAlign="center" py={4}>
                                    <Typography color="textSecondary">No bookings yet</Typography>
                                    <Button
                                        variant="contained"
                                        sx={{ mt: 2 }}
                                        onClick={() => navigate('/screens')}
                                    >
                                        Browse Screens
                                    </Button>
                                </Box>
                            )}
                        </Paper>
                    </Grid>
                </Grid>

                {/* Quick Actions */}
                <Paper sx={{ p: 3, mt: 3 }}>
                    <Typography variant="h6" mb={2}>
                        Quick Actions
                    </Typography>
                    <Grid container spacing={2}>
                        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                            <Button
                                fullWidth
                                variant="contained"
                                startIcon={<CampaignIcon />}
                                onClick={() => navigate('/campaigns/new')}
                            >
                                New Campaign
                            </Button>
                        </Grid>
                        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                            <Button
                                fullWidth
                                variant="outlined"
                                startIcon={<SearchIcon />}
                                onClick={() => navigate('/screens')}
                            >
                                Browse Screens
                            </Button>
                        </Grid>
                        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                            <Button
                                fullWidth
                                variant="outlined"
                                startIcon={<CreativeIcon />}
                                onClick={() => navigate('/campaigns')}
                            >
                                Upload Creative
                            </Button>
                        </Grid>
                        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                            <Button
                                fullWidth
                                variant="outlined"
                                startIcon={<TrendingUpIcon />}
                                onClick={() => navigate('/analytics')}
                            >
                                View Analytics
                            </Button>
                        </Grid>
                    </Grid>
                </Paper>
            </Container>
        );
    }

    // ==========================================
    // ADMIN DASHBOARD
    // ==========================================
    return (
        <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
            {/* Welcome Section */}
            <Box mb={4}>
                <Box display="flex" alignItems="center" gap={2} mb={1}>
                    <Typography variant="h4">
                        Welcome back, {user?.firstName}!
                    </Typography>
                    <Chip label={getRoleLabel()} color={getRoleColor() as any} size="small" />
                </Box>
                <Typography variant="body1" color="textSecondary">
                    Platform overview and management
                </Typography>
            </Box>

            {/* Admin Stats Grid */}
            <Grid container spacing={3} sx={{ mb: 4 }}>
                <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                    <EnhancedStatCard
                        title="Total Campaigns"
                        value={stats.totalCampaigns}
                        subtitle={`${stats.activeCampaigns} active`}
                        icon={<CampaignIcon />}
                        color="primary.main"
                    />
                </Grid>
                <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                    <EnhancedStatCard
                        title="Total Screens"
                        value={stats.totalScreens}
                        subtitle={`${stats.onlineScreens} online`}
                        icon={<ScreenIcon />}
                        color="success.main"
                    />
                </Grid>
                <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                    <EnhancedStatCard
                        title="Total Bookings"
                        value={stats.totalBookings}
                        subtitle={`${stats.pendingBookings} pending`}
                        icon={<BookingIcon />}
                        color="warning.main"
                    />
                </Grid>
                <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                    <EnhancedStatCard
                        title="Platform Revenue"
                        value={`₹${stats.totalRevenue.toLocaleString()}`}
                        subtitle="Total bookings value"
                        icon={<MoneyIcon />}
                        color="info.main"
                    />
                </Grid>
            </Grid>

            {/* Main Content */}
            <Grid container spacing={3}>
                {/* Campaign Performance */}
                <Grid size={{ xs: 12, md: 6 }}>
                    <CampaignPerformanceCard />
                </Grid>

                {/* Screen Status */}
                <Grid size={{ xs: 12, md: 6 }}>
                    <ScreenStatusGrid />
                </Grid>
            </Grid>

            {/* Quick Actions */}
            <Paper sx={{ p: 3, mt: 3 }}>
                <Typography variant="h6" mb={2}>
                    Admin Actions
                </Typography>
                <Grid container spacing={2}>
                    <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                        <Button
                            fullWidth
                            variant="outlined"
                            startIcon={<CampaignIcon />}
                            onClick={() => navigate('/campaigns')}
                        >
                            All Campaigns
                        </Button>
                    </Grid>
                    <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                        <Button
                            fullWidth
                            variant="outlined"
                            startIcon={<ScreenIcon />}
                            onClick={() => navigate('/screens')}
                        >
                            All Screens
                        </Button>
                    </Grid>
                    <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                        <Button
                            fullWidth
                            variant="outlined"
                            startIcon={<BookingIcon />}
                            onClick={() => navigate('/bookings')}
                        >
                            All Bookings
                        </Button>
                    </Grid>
                    <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                        <Button
                            fullWidth
                            variant="outlined"
                            startIcon={<TrendingUpIcon />}
                            onClick={() => navigate('/analytics')}
                        >
                            Platform Analytics
                        </Button>
                    </Grid>
                </Grid>
            </Paper>
        </Container>
    );
}
