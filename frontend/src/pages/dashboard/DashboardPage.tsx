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
    Alert,
    IconButton,
    Tooltip,
} from '@mui/material';
import {
    Campaign as CampaignIcon,
    Tv as ScreenIcon,
    BookOnline as BookingIcon,
    TrendingUp as TrendingUpIcon,
    Image as CreativeIcon,
    AttachMoney as MoneyIcon,
    Search as SearchIcon,
    Close as CloseIcon,
    AutoAwesome as AutoAwesomeIcon,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../services/api';
import { proposalsApi } from '../../services/proposalsApi';
import { useAuthStore } from '../../store/authStore';
import { useUserRole } from '../../hooks/useUserRole';
import { useAccountVisibility } from '../../hooks/useAccountVisibility';
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
    const { isPrivate } = useAccountVisibility();

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

    const queryClient = useQueryClient();

    // Smart Proposals (advertiser only)
    const { data: proposals } = useQuery({
        queryKey: ['proposals'],
        queryFn: proposalsApi.getProposals,
        enabled: isAdvertiser,
        staleTime: 5 * 60 * 1000,
    });

    const dismissMutation = useMutation({
        mutationFn: proposalsApi.dismiss,
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['proposals'] }),
    });

    const acceptMutation = useMutation({
        mutationFn: proposalsApi.accept,
        onSuccess: (result) => navigate(`/campaigns/new?screen=${result.screenId}`),
    });

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

    const pageSx = {
        mt: 4,
        mb: 4,
    };

    const heroPanelSx = {
        mb: 4,
        p: { xs: 2, md: 3 },
        borderRadius: 3,
        border: '1px solid rgba(16, 24, 40, 0.08)',
        background:
            'radial-gradient(900px 360px at 100% -10%, rgba(10,102,216,0.12), transparent 60%), #ffffff',
    };

    if (isLoading) {
        return (
            <Container maxWidth="lg" sx={pageSx}>
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
        const ownerTitle = isPrivate ? 'Private Operations Dashboard' : 'Public Marketplace Dashboard';
        const ownerSubtitle = isPrivate
            ? 'Operate your screen network in self-managed mode with uptime and playback control.'
            : 'Manage your screens, approve booking requests, and track earnings in real time.';

        const privateOpsCards = [
            {
                title: 'Total Screens',
                value: stats.totalScreens,
                subtitle: `${stats.onlineScreens} online`,
                icon: <ScreenIcon />,
                color: 'primary.main',
            },
            {
                title: 'Screen Health',
                value: `${stats.onlineScreens}/${Math.max(stats.totalScreens, 1)}`,
                subtitle: 'Operational screens',
                icon: <TrendingUpIcon />,
                color: 'success.main',
            },
            {
                title: 'Network Uptime',
                value: `${Math.round((stats.onlineScreens / Math.max(stats.totalScreens, 1)) * 100)}%`,
                subtitle: 'Live availability',
                icon: <TrendingUpIcon />,
                color: 'info.main',
            },
            {
                title: 'Scheduled Plays',
                value: bookings?.filter((b) => b.status === 'Approved' || b.status === 'Active').length || 0,
                subtitle: 'Current active schedule',
                icon: <BookingIcon />,
                color: 'warning.main',
            },
        ];

        const publicOwnerCards = [
            {
                title: 'My Screens',
                value: stats.totalScreens,
                subtitle: `${stats.onlineScreens} online`,
                icon: <ScreenIcon />,
                color: 'primary.main',
            },
            {
                title: 'Pending Requests',
                value: stats.pendingBookings,
                subtitle: 'Awaiting approval',
                icon: <BookingIcon />,
                color: 'warning.main',
            },
            {
                title: 'Active Bookings',
                value: bookings?.filter(b => {
                    const isActive = b.status === 'Approved' || b.status === 'Active';
                    const notExpired = new Date(b.endDate + 'T23:59:59') >= new Date(new Date().setHours(0, 0, 0, 0));
                    return isActive && notExpired;
                }).length || 0,
                subtitle: 'Currently running',
                icon: <TrendingUpIcon />,
                color: 'success.main',
            },
            {
                title: 'Total Revenue',
                value: `INR ${stats.totalRevenue.toLocaleString()}`,
                subtitle: 'From approved bookings',
                icon: <MoneyIcon />,
                color: 'info.main',
            },
        ];

        const ownerCards = isPrivate ? privateOpsCards : publicOwnerCards;

        return (
            <Container maxWidth="lg" sx={pageSx}>
                {/* Welcome Section */}
                <Paper sx={heroPanelSx}>
                    <Box display="flex" alignItems="center" gap={2} mb={1}>
                        <Typography variant="h4">
                            {ownerTitle}
                        </Typography>
                        <Chip label={getRoleLabel()} color={getRoleColor() as any} size="small" />
                        <Chip
                            label={isPrivate ? 'Mode: Private' : 'Mode: Public'}
                            color={isPrivate ? 'warning' : 'success'}
                            size="small"
                            variant="outlined"
                        />
                    </Box>
                    <Typography variant="body1" color="textSecondary">
                        {ownerSubtitle}
                    </Typography>
                </Paper>

                {isPrivate && (
                    <Alert
                        severity="info"
                        sx={{ mb: 3, borderRadius: 2 }}
                        action={
                            <Button color="inherit" size="small" onClick={() => navigate('/profile')}>
                                Go to settings
                            </Button>
                        }
                    >
                        Your account is set to Private. Your screens are not visible to advertisers in the marketplace. To go public, submit a request from your Profile Settings.
                    </Alert>
                )}

                {/* Owner Stats Grid */}
                <Grid container spacing={3} sx={{ mb: 4 }}>
                    {ownerCards.map((card) => (
                        <Grid key={card.title} size={{ xs: 12, sm: 6, md: 3 }}>
                            <EnhancedStatCard
                                title={card.title}
                                value={card.value}
                                subtitle={card.subtitle}
                                icon={card.icon}
                                color={card.color}
                            />
                        </Grid>
                    ))}
                </Grid>

                {/* Main Content */}
                <Grid container spacing={3}>
                    {!isPrivate && (
                        <Grid size={{ xs: 12, md: 6 }}>
                            <OwnerApprovalQueue />
                        </Grid>
                    )}

                    <Grid size={{ xs: 12, md: isPrivate ? 12 : 6 }}>
                        <ScreenStatusGrid />
                    </Grid>

                    {isPrivate && (
                        <Grid size={{ xs: 12 }}>
                            <Paper sx={{ p: 3 }}>
                                <Typography variant="h6" mb={1.5}>Operations Snapshot</Typography>
                                <Typography variant="body2" color="text.secondary" mb={2}>
                                    Private mode focuses on uptime, playback continuity, and content freshness. Marketplace booking and payout workflows are intentionally hidden.
                                </Typography>
                                <Button variant="outlined" onClick={() => navigate('/analytics')}>
                                    Open screen analytics
                                </Button>
                            </Paper>
                        </Grid>
                    )}
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
                        {!isPrivate && (
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
                        )}
                        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                            <Button
                                fullWidth
                                variant="outlined"
                                startIcon={<TrendingUpIcon />}
                                onClick={() => navigate('/analytics')}
                            >
                                {isPrivate ? 'View Screen Health' : 'View Earnings'}
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
            <Container maxWidth="lg" sx={pageSx}>
                {/* Welcome Section */}
                <Paper sx={heroPanelSx}>
                    <Box display="flex" alignItems="center" gap={2} mb={1}>
                        <Typography variant="h4">
                            Advertiser Command Center
                        </Typography>
                        <Chip label={getRoleLabel()} color={getRoleColor() as any} size="small" />
                    </Box>
                    <Typography variant="body1" color="textSecondary">
                        Create campaigns and track your advertising performance
                    </Typography>
                </Paper>

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

                {/* Smart Proposals */}
                {proposals && proposals.length > 0 && (
                    <Box mb={4} mt={2}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                            <AutoAwesomeIcon sx={{ color: 'secondary.main' }} fontSize="small" />
                            <Typography variant="h6">Smart Proposals</Typography>
                            <Chip label={proposals.length} size="small" color="secondary" />
                        </Box>
                        <Grid container spacing={2}>
                            {proposals.map((p) => (
                                <Grid size={{ xs: 12, sm: 6, md: 4 }} key={p.id}>
                                    <Card variant="outlined" sx={{ bgcolor: 'background.paper', border: '1px solid', borderColor: 'secondary.main' }}>
                                        <CardContent sx={{ pb: 1 }}>
                                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                                <Typography variant="subtitle2" fontWeight={600}>{p.title}</Typography>
                                                <Tooltip title="Dismiss">
                                                    <IconButton size="small" onClick={() => dismissMutation.mutate(p.id)}>
                                                        <CloseIcon fontSize="small" />
                                                    </IconButton>
                                                </Tooltip>
                                            </Box>
                                            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>{p.message}</Typography>
                                            {p.screen && (
                                                <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 1 }}>
                                                    {p.screen.name} · ₹{(p.screen.pricePerSlot ?? 0).toFixed(0)}/slot
                                                </Typography>
                                            )}
                                        </CardContent>
                                        <CardActions>
                                            <Button
                                                size="small"
                                                variant="contained"
                                                color="secondary"
                                                onClick={() => acceptMutation.mutate(p.id)}
                                                disabled={acceptMutation.isPending}
                                            >
                                                Book This Screen →
                                            </Button>
                                        </CardActions>
                                    </Card>
                                </Grid>
                            ))}
                        </Grid>
                    </Box>
                )}

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
        <Container maxWidth="lg" sx={pageSx}>
            {/* Welcome Section */}
            <Paper sx={heroPanelSx}>
                <Box display="flex" alignItems="center" gap={2} mb={1}>
                    <Typography variant="h4">
                        Platform Control Center
                    </Typography>
                    <Chip label={getRoleLabel()} color={getRoleColor() as any} size="small" />
                </Box>
                <Typography variant="body1" color="textSecondary">
                    Platform overview and management
                </Typography>
            </Paper>

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
