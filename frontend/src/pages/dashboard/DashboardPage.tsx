import { useEffect } from 'react';
import {
    Box,
    Container,
    Grid,
    Paper,
    Typography,
    Card,
    CardContent,
    CardActions,
    Button,
    Chip,
    LinearProgress,
} from '@mui/material';
import {
    Campaign as CampaignIcon,
    Tv as ScreenIcon,
    Image as CreativeIcon,
    TrendingUp as TrendingUpIcon,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../services/api';
import { useAuthStore } from '../../store/authStore';
import { useUserRole } from '../../hooks/useUserRole';

interface DashboardStats {
    totalCampaigns: number;
    activeCampaigns: number;
    totalCreatives: number;
    totalBookings: number;
    pendingBookings: number;
    totalImpressions: number;
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

export default function DashboardPage() {
    const navigate = useNavigate();
    const { user } = useAuthStore();
    const { isScreenOwner, isAdvertiser } = useUserRole();

    // Fetch dashboard stats
    const { data: campaigns, isLoading: campaignsLoading } = useQuery<Campaign[]>({
        queryKey: ['campaigns'],
        queryFn: async () => {
            const response = await api.get('/campaigns');
            return response.data.data; // ApiResponse wrapper
        },
    });

    const { data: bookings, isLoading: bookingsLoading } = useQuery<Booking[]>({
        queryKey: ['bookings'],
        queryFn: async () => {
            const response = await api.get('/bookings');
            return response.data.data; // ApiResponse wrapper
        },
    });

    // Calculate stats
    const stats: DashboardStats = {
        totalCampaigns: campaigns?.length || 0,
        activeCampaigns: campaigns?.filter(c => c.status === 'Active').length || 0,
        totalCreatives: 0, // Will be populated when we fetch creatives
        totalBookings: bookings?.length || 0,
        pendingBookings: bookings?.filter(b => b.status === 'Pending').length || 0,
        totalImpressions: 0, // Will be populated from analytics
    };

    const StatCard = ({ title, value, icon, color, subtitle }: any) => (
        <Card sx={{ height: '100%' }}>
            <CardContent>
                <Box display="flex" alignItems="center" justifyContent="space-between">
                    <Box>
                        <Typography color="textSecondary" gutterBottom variant="body2">
                            {title}
                        </Typography>
                        <Typography variant="h4" component="div">
                            {value}
                        </Typography>
                        {subtitle && (
                            <Typography variant="body2" color="textSecondary" sx={{ mt: 1 }}>
                                {subtitle}
                            </Typography>
                        )}
                    </Box>
                    <Box
                        sx={{
                            backgroundColor: `${color}.light`,
                            borderRadius: 2,
                            p: 1.5,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                        }}
                    >
                        {icon}
                    </Box>
                </Box>
            </CardContent>
        </Card>
    );

    if (campaignsLoading || bookingsLoading) {
        return (
            <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
                <LinearProgress />
            </Container>
        );
    }

    return (
        <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
            {/* Welcome Section */}
            <Box mb={4}>
                <Typography variant="h4" gutterBottom>
                    Welcome back, {user?.firstName}!
                </Typography>
                <Typography variant="body1" color="textSecondary">
                    {isAdvertiser && "Here's what's happening with your campaigns today."}
                    {isScreenOwner && "Manage your screens, campaigns, and approve booking requests."}
                </Typography>
            </Box>

            {/* Stats Grid */}
            <Grid container spacing={3} mb={4}>
                <Grid item xs={12} sm={6} md={3}>
                    <StatCard
                        title="Total Campaigns"
                        value={stats.totalCampaigns}
                        subtitle={`${stats.activeCampaigns} active`}
                        icon={<CampaignIcon sx={{ fontSize: 40, color: 'primary.main' }} />}
                        color="primary"
                    />
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                    <StatCard
                        title="Total Bookings"
                        value={stats.totalBookings}
                        subtitle={`${stats.pendingBookings} pending`}
                        icon={<ScreenIcon sx={{ fontSize: 40, color: 'success.main' }} />}
                        color="success"
                    />
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                    <StatCard
                        title="Creatives"
                        value={stats.totalCreatives}
                        icon={<CreativeIcon sx={{ fontSize: 40, color: 'warning.main' }} />}
                        color="warning"
                    />
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                    <StatCard
                        title="Total Impressions"
                        value={stats.totalImpressions.toLocaleString()}
                        icon={<TrendingUpIcon sx={{ fontSize: 40, color: 'info.main' }} />}
                        color="info"
                    />
                </Grid>
            </Grid>

            {/* Recent Campaigns */}
            <Grid container spacing={3}>
                <Grid item xs={12} md={6}>
                    <Paper sx={{ p: 3 }}>
                        <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                            <Typography variant="h6">Recent Campaigns</Typography>
                            <Button size="small" onClick={() => navigate('/campaigns')}>
                                View All
                            </Button>
                        </Box>
                        {campaigns && campaigns.length > 0 ? (
                            campaigns.slice(0, 5).map((campaign) => (
                                <Card key={campaign.id} sx={{ mb: 2 }}>
                                    <CardContent>
                                        <Box display="flex" justifyContent="space-between" alignItems="start">
                                            <Box>
                                                <Typography variant="subtitle1" fontWeight="bold">
                                                    {campaign.name}
                                                </Typography>
                                                <Typography variant="body2" color="textSecondary">
                                                    {new Date(campaign.startDate).toLocaleDateString()} -{' '}
                                                    {new Date(campaign.endDate).toLocaleDateString()}
                                                </Typography>
                                            </Box>
                                            <Chip
                                                label={campaign.status}
                                                color={
                                                    campaign.status === 'Active'
                                                        ? 'success'
                                                        : campaign.status === 'Draft'
                                                            ? 'default'
                                                            : 'error'
                                                }
                                                size="small"
                                            />
                                        </Box>
                                        <Typography variant="body2" sx={{ mt: 1 }}>
                                            Budget: {campaign.currency} {campaign.budget.toLocaleString()}
                                        </Typography>
                                    </CardContent>
                                    <CardActions>
                                        <Button
                                            size="small"
                                            onClick={() => navigate(`/campaigns/${campaign.id}`)}
                                        >
                                            View Details
                                        </Button>
                                    </CardActions>
                                </Card>
                            ))
                        ) : (
                            <Box textAlign="center" py={4}>
                                {isAdvertiser ? (
                                    <>
                                        <Typography color="textSecondary">No campaigns yet</Typography>
                                        <Button
                                            variant="contained"
                                            sx={{ mt: 2 }}
                                            onClick={() => navigate('/campaigns/new')}
                                        >
                                            Create Your First Campaign
                                        </Button>
                                    </>
                                ) : (
                                    <Typography color="textSecondary">No campaigns to display</Typography>
                                )}
                            </Box>
                        )}
                    </Paper>
                </Grid>

                {/* Recent Bookings */}
                <Grid item xs={12} md={6}>
                    <Paper sx={{ p: 3 }}>
                        <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                            <Typography variant="h6">Recent Bookings</Typography>
                            <Button size="small" onClick={() => navigate('/bookings')}>
                                View All
                            </Button>
                        </Box>
                        {bookings && bookings.length > 0 ? (
                            bookings.slice(0, 5).map((booking) => (
                                <Card key={booking.id} sx={{ mb: 2 }}>
                                    <CardContent>
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
                                                    booking.status === 'Approved'
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
                                    <CardActions>
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
                    {isAdvertiser && (
                        <Grid item xs={12} sm={6} md={3}>
                            <Button
                                fullWidth
                                variant="outlined"
                                startIcon={<CampaignIcon />}
                                onClick={() => navigate('/campaigns/new')}
                            >
                                New Campaign
                            </Button>
                        </Grid>
                    )}
                    {isScreenOwner && (
                        <Grid item xs={12} sm={6} md={3}>
                            <Button
                                fullWidth
                                variant="outlined"
                                startIcon={<ScreenIcon />}
                                onClick={() => navigate('/screens/new')}
                            >
                                Add Screen
                            </Button>
                        </Grid>
                    )}
                    <Grid item xs={12} sm={6} md={3}>
                        <Button
                            fullWidth
                            variant="outlined"
                            startIcon={<ScreenIcon />}
                            onClick={() => navigate('/screens')}
                        >
                            {isScreenOwner ? 'My Screens' : 'Browse Screens'}
                        </Button>
                    </Grid>
                    {isAdvertiser && (
                        <Grid item xs={12} sm={6} md={3}>
                            <Button
                                fullWidth
                                variant="outlined"
                                startIcon={<CreativeIcon />}
                                onClick={() => navigate('/campaigns')}
                            >
                                Upload Creative
                            </Button>
                        </Grid>
                    )}
                    <Grid item xs={12} sm={6} md={3}>
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
