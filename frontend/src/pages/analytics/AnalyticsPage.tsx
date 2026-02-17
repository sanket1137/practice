import {
    Box,
    Container,
    Grid,
    Paper,
    Typography,
    Card,
    CardContent,
    Alert,
    Skeleton,
} from '@mui/material';
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer,
    LineChart,
    Line,
} from 'recharts';
import { useQuery } from '@tanstack/react-query';
import { useUserRole } from '../../hooks/useUserRole';
import {
    getOwnerAnalyticsSummary,
    getOwnerScreenBreakdown,
    getOwnerDailyRevenue,
    getAdvertiserAnalyticsSummary,
    getAdvertiserCampaigns,
    getAdvertiserDailyImpressions,
    getPlatformAnalyticsSummary,
    getPlatformDailyStats,
    type OwnerAnalyticsSummary,
    type ScreenRevenue,
    type DailyRevenue,
    type AdvertiserAnalyticsSummary,
    type CampaignPerformanceSummary,
    type DailyImpressions,
    type PlatformAnalyticsSummary,
    type PlatformDailyStats,
} from '../../services/analyticsApi';

// Helper to format currency
const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR',
        maximumFractionDigits: 0,
    }).format(amount);
};

// Helper to format change percent with color
const formatChangePercent = (percent: number): { text: string; color: string } => {
    const sign = percent >= 0 ? '+' : '';
    return {
        text: `${sign}${percent.toFixed(1)}%`,
        color: percent >= 0 ? 'success.main' : 'error.main',
    };
};

// Skeleton for stat cards
const StatCardSkeleton = () => (
    <Card>
        <CardContent>
            <Skeleton variant="text" width="60%" />
            <Skeleton variant="text" width="40%" height={40} />
            <Skeleton variant="text" width="50%" />
        </CardContent>
    </Card>
);

// Skeleton for charts
const ChartSkeleton = ({ height = 400 }: { height?: number }) => (
    <Paper sx={{ p: 3, height }}>
        <Skeleton variant="text" width="30%" sx={{ mb: 2 }} />
        <Skeleton variant="rectangular" height={height - 100} />
    </Paper>
);


export default function AnalyticsPage() {
    const { isScreenOwner, isAdvertiser } = useUserRole();

    // ==========================================
    // SCREEN OWNER ANALYTICS - Focus on Earnings
    // ==========================================
    if (isScreenOwner) {
        return <ScreenOwnerAnalytics />;
    }

    // ==========================================
    // ADVERTISER ANALYTICS - Focus on Campaign Performance
    // ==========================================
    if (isAdvertiser) {
        return <AdvertiserAnalytics />;
    }

    // ==========================================
    // ADMIN ANALYTICS - Platform Overview (Default)
    // ==========================================
    return <AdminAnalytics />;
}


// ============================================
// SCREEN OWNER ANALYTICS COMPONENT
// ============================================
function ScreenOwnerAnalytics() {
    const { data: summary, isLoading: summaryLoading, error: summaryError } = useQuery<OwnerAnalyticsSummary>({
        queryKey: ['analytics', 'owner', 'summary'],
        queryFn: getOwnerAnalyticsSummary,
    });

    const { data: screens, isLoading: screensLoading } = useQuery<ScreenRevenue[]>({
        queryKey: ['analytics', 'owner', 'screens'],
        queryFn: getOwnerScreenBreakdown,
    });

    const { data: dailyRevenue, isLoading: dailyLoading } = useQuery<DailyRevenue[]>({
        queryKey: ['analytics', 'owner', 'daily'],
        queryFn: () => getOwnerDailyRevenue(7),
    });

    const isLoading = summaryLoading || screensLoading || dailyLoading;

    if (summaryError) {
        return (
            <Container maxWidth="lg" sx={{ mt: 4 }}>
                <Alert severity="error">Failed to load analytics. Please try again later.</Alert>
            </Container>
        );
    }

    return (
        <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
            <Box mb={4}>
                <Typography variant="h4" gutterBottom>
                    Earnings & Analytics
                </Typography>
                <Typography variant="body1" color="textSecondary">
                    Track your screen performance and revenue
                </Typography>
            </Box>

            {/* Summary Cards */}
            <Grid container spacing={3} sx={{ mb: 4 }}>
                <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                    {isLoading ? <StatCardSkeleton /> : (
                        <Card>
                            <CardContent>
                                <Typography color="textSecondary" gutterBottom>
                                    Total Revenue (Month)
                                </Typography>
                                <Typography variant="h4" color="success.main">
                                    {formatCurrency(summary?.totalRevenueMonth || 0)}
                                </Typography>
                                <Typography variant="body2" sx={{ color: formatChangePercent(summary?.revenueChangePercent || 0).color }}>
                                    {formatChangePercent(summary?.revenueChangePercent || 0).text} from last month
                                </Typography>
                            </CardContent>
                        </Card>
                    )}
                </Grid>
                <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                    {isLoading ? <StatCardSkeleton /> : (
                        <Card>
                            <CardContent>
                                <Typography color="textSecondary" gutterBottom>
                                    Avg. Daily Earnings
                                </Typography>
                                <Typography variant="h4">{formatCurrency(summary?.avgDailyRevenue || 0)}</Typography>
                                <Typography variant="body2" color="text.secondary">
                                    Across all screens
                                </Typography>
                            </CardContent>
                        </Card>
                    )}
                </Grid>
                <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                    {isLoading ? <StatCardSkeleton /> : (
                        <Card>
                            <CardContent>
                                <Typography color="textSecondary" gutterBottom>
                                    Active Bookings
                                </Typography>
                                <Typography variant="h4">{summary?.activeBookings || 0}</Typography>
                                <Typography variant="body2" color="text.secondary">
                                    Currently running
                                </Typography>
                            </CardContent>
                        </Card>
                    )}
                </Grid>
                <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                    {isLoading ? <StatCardSkeleton /> : (
                        <Card>
                            <CardContent>
                                <Typography color="textSecondary" gutterBottom>
                                    Screen Uptime
                                </Typography>
                                <Typography variant="h4" color="info.main">
                                    {summary?.screenUptimePercent || 0}%
                                </Typography>
                                <Typography variant="body2" color="text.secondary">
                                    {summary?.onlineScreens || 0} of {summary?.totalScreens || 0} online
                                </Typography>
                            </CardContent>
                        </Card>
                    )}
                </Grid>
            </Grid>

            <Grid container spacing={3}>
                {/* Revenue Chart */}
                <Grid size={{ xs: 12, lg: 8 }}>
                    {dailyLoading ? <ChartSkeleton height={350} /> : (
                        <Paper sx={{ p: { xs: 2, sm: 3 }, height: { xs: 300, sm: 350, md: 400 } }}>
                            <Typography variant="h6" gutterBottom>
                                Weekly Revenue
                            </Typography>
                            {dailyRevenue && dailyRevenue.length > 0 ? (
                                <ResponsiveContainer width="100%" height="90%">
                                    <BarChart
                                        data={dailyRevenue}
                                        margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                                    >
                                        <CartesianGrid strokeDasharray="3 3" />
                                        <XAxis dataKey="dayName" />
                                        <YAxis />
                                        <Tooltip formatter={(value: number) => formatCurrency(value)} />
                                        <Legend />
                                        <Bar dataKey="revenue" fill="#4caf50" name="Revenue (₹)" />
                                    </BarChart>
                                </ResponsiveContainer>
                            ) : (
                                <Box display="flex" alignItems="center" justifyContent="center" height="80%">
                                    <Typography color="textSecondary">No revenue data available</Typography>
                                </Box>
                            )}
                        </Paper>
                    )}
                </Grid>

                {/* Earnings Summary */}
                <Grid size={{ xs: 12, lg: 4 }}>
                    {screensLoading ? <ChartSkeleton height={350} /> : (
                        <Paper sx={{ p: { xs: 2, sm: 3 }, height: { xs: 'auto', lg: 400 }, minHeight: { xs: 200, lg: 400 }, overflow: 'auto' }}>
                            <Typography variant="h6" gutterBottom>
                                Revenue by Screen
                            </Typography>
                            {screens && screens.length > 0 ? (
                                <Box sx={{ mt: 3 }}>
                                    {screens.slice(0, 5).map((screen) => (
                                        <Box key={screen.screenId} mb={3}>
                                            <Box display="flex" justifyContent="space-between" alignItems="center">
                                                <Typography variant="body2" color="textSecondary">
                                                    {screen.screenName}
                                                </Typography>
                                                <Box
                                                    sx={{
                                                        width: 8,
                                                        height: 8,
                                                        borderRadius: '50%',
                                                        bgcolor: screen.isOnline ? 'success.main' : 'grey.400',
                                                    }}
                                                />
                                            </Box>
                                            <Typography variant="h5">{formatCurrency(screen.revenue)}</Typography>
                                            <Typography variant="caption" color="textSecondary">
                                                {screen.impressions.toLocaleString()} plays • {screen.activeBookings} active bookings
                                            </Typography>
                                        </Box>
                                    ))}
                                </Box>
                            ) : (
                                <Box display="flex" alignItems="center" justifyContent="center" height="80%">
                                    <Typography color="textSecondary">No screens found</Typography>
                                </Box>
                            )}
                        </Paper>
                    )}
                </Grid>

                {/* Impressions */}
                <Grid size={{ xs: 12 }}>
                    {dailyLoading ? <ChartSkeleton height={350} /> : (
                        <Paper sx={{ p: { xs: 2, sm: 3 }, height: { xs: 300, sm: 350, md: 400 } }}>
                            <Typography variant="h6" gutterBottom>
                                Total Impressions Delivered
                            </Typography>
                            {dailyRevenue && dailyRevenue.length > 0 ? (
                                <ResponsiveContainer width="100%" height="90%">
                                    <LineChart
                                        data={dailyRevenue}
                                        margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                                    >
                                        <CartesianGrid strokeDasharray="3 3" />
                                        <XAxis dataKey="dayName" />
                                        <YAxis />
                                        <Tooltip />
                                        <Legend />
                                        <Line
                                            type="monotone"
                                            dataKey="impressions"
                                            stroke="#2196f3"
                                            name="Total Plays"
                                            strokeWidth={2}
                                        />
                                    </LineChart>
                                </ResponsiveContainer>
                            ) : (
                                <Box display="flex" alignItems="center" justifyContent="center" height="80%">
                                    <Typography color="textSecondary">No impression data available</Typography>
                                </Box>
                            )}
                        </Paper>
                    )}
                </Grid>
            </Grid>
        </Container>
    );
}


// ============================================
// ADVERTISER ANALYTICS COMPONENT
// ============================================
function AdvertiserAnalytics() {
    const { data: summary, isLoading: summaryLoading, error: summaryError } = useQuery<AdvertiserAnalyticsSummary>({
        queryKey: ['analytics', 'advertiser', 'summary'],
        queryFn: getAdvertiserAnalyticsSummary,
    });

    const { data: campaigns, isLoading: campaignsLoading } = useQuery<CampaignPerformanceSummary[]>({
        queryKey: ['analytics', 'advertiser', 'campaigns'],
        queryFn: getAdvertiserCampaigns,
    });

    const { data: dailyImpressions, isLoading: dailyLoading } = useQuery<DailyImpressions[]>({
        queryKey: ['analytics', 'advertiser', 'daily'],
        queryFn: () => getAdvertiserDailyImpressions(7),
    });

    const isLoading = summaryLoading || campaignsLoading || dailyLoading;

    if (summaryError) {
        return (
            <Container maxWidth="lg" sx={{ mt: 4 }}>
                <Alert severity="error">Failed to load analytics. Please try again later.</Alert>
            </Container>
        );
    }

    return (
        <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
            <Box mb={4}>
                <Typography variant="h4" gutterBottom>
                    Campaign Analytics
                </Typography>
                <Typography variant="body1" color="textSecondary">
                    Track your campaign performance and impressions
                </Typography>
            </Box>

            {/* Summary Cards */}
            <Grid container spacing={3} sx={{ mb: 4 }}>
                <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                    {isLoading ? <StatCardSkeleton /> : (
                        <Card>
                            <CardContent>
                                <Typography color="textSecondary" gutterBottom>
                                    Total Impressions
                                </Typography>
                                <Typography variant="h4">{(summary?.totalImpressions || 0).toLocaleString()}</Typography>
                                <Typography variant="body2" sx={{ color: formatChangePercent(summary?.impressionChangePercent || 0).color }}>
                                    {formatChangePercent(summary?.impressionChangePercent || 0).text} from last week
                                </Typography>
                            </CardContent>
                        </Card>
                    )}
                </Grid>
                <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                    {isLoading ? <StatCardSkeleton /> : (
                        <Card>
                            <CardContent>
                                <Typography color="textSecondary" gutterBottom>
                                    Total Spend
                                </Typography>
                                <Typography variant="h4">{formatCurrency(summary?.totalSpendMonth || 0)}</Typography>
                                <Typography variant="body2" color="text.secondary">
                                    This month
                                </Typography>
                            </CardContent>
                        </Card>
                    )}
                </Grid>
                <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                    {isLoading ? <StatCardSkeleton /> : (
                        <Card>
                            <CardContent>
                                <Typography color="textSecondary" gutterBottom>
                                    Avg. CPM
                                </Typography>
                                <Typography variant="h4">{formatCurrency(summary?.avgCpm || 0)}</Typography>
                                <Typography variant="body2" sx={{ color: formatChangePercent(-(summary?.cpmChangePercent || 0)).color }}>
                                    {formatChangePercent(-(summary?.cpmChangePercent || 0)).text} from last month
                                </Typography>
                            </CardContent>
                        </Card>
                    )}
                </Grid>
                <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                    {isLoading ? <StatCardSkeleton /> : (
                        <Card>
                            <CardContent>
                                <Typography color="textSecondary" gutterBottom>
                                    Active Campaigns
                                </Typography>
                                <Typography variant="h4" color="primary">{summary?.activeCampaigns || 0}</Typography>
                                <Typography variant="body2" color="text.secondary">
                                    of {summary?.totalCampaigns || 0} total
                                </Typography>
                            </CardContent>
                        </Card>
                    )}
                </Grid>
            </Grid>

            <Grid container spacing={3}>
                {/* Impressions Chart */}
                <Grid size={{ xs: 12, lg: 8 }}>
                    {dailyLoading ? <ChartSkeleton height={350} /> : (
                        <Paper sx={{ p: { xs: 2, sm: 3 }, height: { xs: 300, sm: 350, md: 400 } }}>
                            <Typography variant="h6" gutterBottom>
                                Weekly Impressions
                            </Typography>
                            {dailyImpressions && dailyImpressions.length > 0 ? (
                                <ResponsiveContainer width="100%" height="90%">
                                    <BarChart
                                        data={dailyImpressions}
                                        margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                                    >
                                        <CartesianGrid strokeDasharray="3 3" />
                                        <XAxis dataKey="dayName" />
                                        <YAxis />
                                        <Tooltip />
                                        <Legend />
                                        <Bar dataKey="impressions" fill="#8884d8" name="Impressions" />
                                    </BarChart>
                                </ResponsiveContainer>
                            ) : (
                                <Box display="flex" alignItems="center" justifyContent="center" height="80%">
                                    <Typography color="textSecondary">No impression data available</Typography>
                                </Box>
                            )}
                        </Paper>
                    )}
                </Grid>

                {/* Campaign Summary */}
                <Grid size={{ xs: 12, lg: 4 }}>
                    {campaignsLoading ? <ChartSkeleton height={350} /> : (
                        <Paper sx={{ p: { xs: 2, sm: 3 }, height: { xs: 'auto', lg: 400 }, minHeight: { xs: 200, lg: 400 }, overflow: 'auto' }}>
                            <Typography variant="h6" gutterBottom>
                                Campaign Performance
                            </Typography>
                            {campaigns && campaigns.length > 0 ? (
                                <Box sx={{ mt: 3 }}>
                                    {campaigns.slice(0, 5).map((campaign) => (
                                        <Box key={campaign.campaignId} mb={3}>
                                            <Typography variant="body2" color="textSecondary">
                                                {campaign.campaignName}
                                            </Typography>
                                            <Typography variant="h5">
                                                {campaign.deliveredImpressions.toLocaleString()} plays
                                            </Typography>
                                            <Typography 
                                                variant="body2" 
                                                sx={{ 
                                                    color: campaign.deliveryPercent >= 50 ? 'success.main' : 'warning.main' 
                                                }}
                                            >
                                                {campaign.deliveryPercent.toFixed(0)}% of target
                                            </Typography>
                                        </Box>
                                    ))}
                                </Box>
                            ) : (
                                <Box display="flex" alignItems="center" justifyContent="center" height="80%">
                                    <Typography color="textSecondary">No campaigns found</Typography>
                                </Box>
                            )}
                        </Paper>
                    )}
                </Grid>

                {/* Booking Trends */}
                <Grid size={{ xs: 12 }}>
                    {dailyLoading ? <ChartSkeleton height={350} /> : (
                        <Paper sx={{ p: { xs: 2, sm: 3 }, height: { xs: 300, sm: 350, md: 400 } }}>
                            <Typography variant="h6" gutterBottom>
                                Booking Trends
                            </Typography>
                            {dailyImpressions && dailyImpressions.length > 0 ? (
                                <ResponsiveContainer width="100%" height="90%">
                                    <LineChart
                                        data={dailyImpressions}
                                        margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                                    >
                                        <CartesianGrid strokeDasharray="3 3" />
                                        <XAxis dataKey="dayName" />
                                        <YAxis />
                                        <Tooltip />
                                        <Legend />
                                        <Line
                                            type="monotone"
                                            dataKey="bookings"
                                            stroke="#82ca9d"
                                            name="Bookings"
                                            strokeWidth={2}
                                        />
                                    </LineChart>
                                </ResponsiveContainer>
                            ) : (
                                <Box display="flex" alignItems="center" justifyContent="center" height="80%">
                                    <Typography color="textSecondary">No booking data available</Typography>
                                </Box>
                            )}
                        </Paper>
                    )}
                </Grid>
            </Grid>
        </Container>
    );
}


// ============================================
// ADMIN ANALYTICS COMPONENT
// ============================================
function AdminAnalytics() {
    const { data: summary, isLoading: summaryLoading, error: summaryError } = useQuery<PlatformAnalyticsSummary>({
        queryKey: ['analytics', 'admin', 'platform'],
        queryFn: getPlatformAnalyticsSummary,
    });

    const { data: dailyStats, isLoading: dailyLoading } = useQuery<PlatformDailyStats[]>({
        queryKey: ['analytics', 'admin', 'daily'],
        queryFn: () => getPlatformDailyStats(7),
    });

    const isLoading = summaryLoading || dailyLoading;

    if (summaryError) {
        return (
            <Container maxWidth="lg" sx={{ mt: 4 }}>
                <Alert severity="error">Failed to load platform analytics. You may not have admin access.</Alert>
            </Container>
        );
    }

    return (
        <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
            <Box mb={4}>
                <Typography variant="h4" gutterBottom>
                    Platform Analytics
                </Typography>
                <Typography variant="body1" color="textSecondary">
                    Performance metrics across all screens and campaigns
                </Typography>
            </Box>

            <Grid container spacing={3}>
                {/* Summary Cards */}
                <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                    {isLoading ? <StatCardSkeleton /> : (
                        <Card>
                            <CardContent>
                                <Typography color="textSecondary" gutterBottom>
                                    Total Impressions
                                </Typography>
                                <Typography variant="h4">{(summary?.totalImpressions || 0).toLocaleString()}</Typography>
                                <Typography variant="body2" sx={{ color: formatChangePercent(summary?.impressionChangePercent || 0).color }}>
                                    {formatChangePercent(summary?.impressionChangePercent || 0).text} from last month
                                </Typography>
                            </CardContent>
                        </Card>
                    )}
                </Grid>
                <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                    {isLoading ? <StatCardSkeleton /> : (
                        <Card>
                            <CardContent>
                                <Typography color="textSecondary" gutterBottom>
                                    Total Revenue
                                </Typography>
                                <Typography variant="h4">{formatCurrency(summary?.revenueThisMonth || 0)}</Typography>
                                <Typography variant="body2" sx={{ color: formatChangePercent(summary?.revenueChangePercent || 0).color }}>
                                    {formatChangePercent(summary?.revenueChangePercent || 0).text} from last month
                                </Typography>
                            </CardContent>
                        </Card>
                    )}
                </Grid>
                <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                    {isLoading ? <StatCardSkeleton /> : (
                        <Card>
                            <CardContent>
                                <Typography color="textSecondary" gutterBottom>
                                    Active Screens
                                </Typography>
                                <Typography variant="h4">{summary?.onlineScreens || 0}</Typography>
                                <Typography variant="body2" color="text.secondary">
                                    {summary?.avgScreenUptime || 0}% uptime
                                </Typography>
                            </CardContent>
                        </Card>
                    )}
                </Grid>
                <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                    {isLoading ? <StatCardSkeleton /> : (
                        <Card>
                            <CardContent>
                                <Typography color="textSecondary" gutterBottom>
                                    Active Campaigns
                                </Typography>
                                <Typography variant="h4">{summary?.activeCampaigns || 0}</Typography>
                                <Typography variant="body2" color="text.secondary">
                                    {summary?.totalAdvertisers || 0} advertisers
                                </Typography>
                            </CardContent>
                        </Card>
                    )}
                </Grid>

                {/* Impressions Chart */}
                <Grid size={{ xs: 12, lg: 8 }}>
                    {dailyLoading ? <ChartSkeleton height={350} /> : (
                        <Paper sx={{ p: { xs: 2, sm: 3 }, height: { xs: 300, sm: 350, md: 400 } }}>
                            <Typography variant="h6" gutterBottom>
                                Weekly Impressions
                            </Typography>
                            {dailyStats && dailyStats.length > 0 ? (
                                <ResponsiveContainer width="100%" height="90%">
                                    <BarChart
                                        data={dailyStats}
                                        margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                                    >
                                        <CartesianGrid strokeDasharray="3 3" />
                                        <XAxis dataKey="dayName" />
                                        <YAxis />
                                        <Tooltip />
                                        <Legend />
                                        <Bar dataKey="impressions" fill="#8884d8" name="Impressions" />
                                    </BarChart>
                                </ResponsiveContainer>
                            ) : (
                                <Box display="flex" alignItems="center" justifyContent="center" height="80%">
                                    <Typography color="textSecondary">No data available</Typography>
                                </Box>
                            )}
                        </Paper>
                    )}
                </Grid>

                {/* Revenue Summary */}
                <Grid size={{ xs: 12, lg: 4 }}>
                    <Grid container spacing={3}>
                        <Grid size={{ xs: 12 }}>
                            {isLoading ? <StatCardSkeleton /> : (
                                <Card>
                                    <CardContent>
                                        <Typography color="textSecondary" gutterBottom>
                                            Total Revenue (All Time)
                                        </Typography>
                                        <Typography variant="h4" color="success.main">
                                            {formatCurrency(summary?.totalRevenue || 0)}
                                        </Typography>
                                        <Typography variant="body2" color="text.secondary">
                                            {summary?.approvedBookings || 0} completed bookings
                                        </Typography>
                                    </CardContent>
                                </Card>
                            )}
                        </Grid>
                        <Grid size={{ xs: 12 }}>
                            {isLoading ? <StatCardSkeleton /> : (
                                <Card>
                                    <CardContent>
                                        <Typography color="textSecondary" gutterBottom>
                                            Pending Approvals
                                        </Typography>
                                        <Typography variant="h4" color="warning.main">
                                            {summary?.pendingApprovals || 0}
                                        </Typography>
                                        <Typography variant="body2" color="text.secondary">
                                            Booking requests
                                        </Typography>
                                    </CardContent>
                                </Card>
                            )}
                        </Grid>
                        <Grid size={{ xs: 12 }}>
                            {isLoading ? <StatCardSkeleton /> : (
                                <Card>
                                    <CardContent>
                                        <Typography color="textSecondary" gutterBottom>
                                            Platform Users
                                        </Typography>
                                        <Typography variant="h4">{summary?.totalUsers || 0}</Typography>
                                        <Typography variant="body2" color="success.main">
                                            +{summary?.newUsersThisMonth || 0} this month
                                        </Typography>
                                    </CardContent>
                                </Card>
                            )}
                        </Grid>
                    </Grid>
                </Grid>

                {/* Revenue Trend */}
                <Grid size={{ xs: 12 }}>
                    {dailyLoading ? <ChartSkeleton height={350} /> : (
                        <Paper sx={{ p: { xs: 2, sm: 3 }, height: { xs: 300, sm: 350, md: 400 } }}>
                            <Typography variant="h6" gutterBottom>
                                Revenue & Booking Trends
                            </Typography>
                            {dailyStats && dailyStats.length > 0 ? (
                                <ResponsiveContainer width="100%" height="90%">
                                    <LineChart
                                        data={dailyStats}
                                        margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                                    >
                                        <CartesianGrid strokeDasharray="3 3" />
                                        <XAxis dataKey="dayName" />
                                        <YAxis yAxisId="left" />
                                        <YAxis yAxisId="right" orientation="right" />
                                        <Tooltip formatter={(value: number, name: string) => 
                                            name === 'Revenue' ? formatCurrency(value) : value
                                        } />
                                        <Legend />
                                        <Line
                                            yAxisId="left"
                                            type="monotone"
                                            dataKey="revenue"
                                            stroke="#4caf50"
                                            name="Revenue"
                                            strokeWidth={2}
                                        />
                                        <Line
                                            yAxisId="right"
                                            type="monotone"
                                            dataKey="newBookings"
                                            stroke="#82ca9d"
                                            name="New Bookings"
                                            strokeWidth={2}
                                        />
                                    </LineChart>
                                </ResponsiveContainer>
                            ) : (
                                <Box display="flex" alignItems="center" justifyContent="center" height="80%">
                                    <Typography color="textSecondary">No data available</Typography>
                                </Box>
                            )}
                        </Paper>
                    )}
                </Grid>
            </Grid>
        </Container>
    );
}
