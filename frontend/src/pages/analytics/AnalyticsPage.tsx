import {
    Box,
    Container,
    Grid,
    Paper,
    Typography,
    Card,
    CardContent,
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
import { useUserRole } from '../../hooks/useUserRole';

const impressionData = [
    { name: 'Mon', impressions: 4000, bookings: 24 },
    { name: 'Tue', impressions: 3000, bookings: 13 },
    { name: 'Wed', impressions: 2000, bookings: 98 },
    { name: 'Thu', impressions: 2780, bookings: 39 },
    { name: 'Fri', impressions: 1890, bookings: 48 },
    { name: 'Sat', impressions: 2390, bookings: 38 },
    { name: 'Sun', impressions: 3490, bookings: 43 },
];

const revenueData = [
    { name: 'Mon', revenue: 1200 },
    { name: 'Tue', revenue: 980 },
    { name: 'Wed', revenue: 1560 },
    { name: 'Thu', revenue: 1340 },
    { name: 'Fri', revenue: 890 },
    { name: 'Sat', revenue: 1120 },
    { name: 'Sun', revenue: 1450 },
];


export default function AnalyticsPage() {
    const { isScreenOwner, isAdvertiser } = useUserRole();

    // ==========================================
    // SCREEN OWNER ANALYTICS - Focus on Earnings
    // ==========================================
    if (isScreenOwner) {
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
                        <Card>
                            <CardContent>
                                <Typography color="textSecondary" gutterBottom>
                                    Total Revenue (Month)
                                </Typography>
                                <Typography variant="h4" color="success.main">₹8,540</Typography>
                                <Typography variant="body2" color="success.main">
                                    +15% from last month
                                </Typography>
                            </CardContent>
                        </Card>
                    </Grid>
                    <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                        <Card>
                            <CardContent>
                                <Typography color="textSecondary" gutterBottom>
                                    Avg. Daily Earnings
                                </Typography>
                                <Typography variant="h4">₹284</Typography>
                                <Typography variant="body2" color="text.secondary">
                                    Across all screens
                                </Typography>
                            </CardContent>
                        </Card>
                    </Grid>
                    <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                        <Card>
                            <CardContent>
                                <Typography color="textSecondary" gutterBottom>
                                    Active Bookings
                                </Typography>
                                <Typography variant="h4">12</Typography>
                                <Typography variant="body2" color="text.secondary">
                                    Currently running
                                </Typography>
                            </CardContent>
                        </Card>
                    </Grid>
                    <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                        <Card>
                            <CardContent>
                                <Typography color="textSecondary" gutterBottom>
                                    Screen Uptime
                                </Typography>
                                <Typography variant="h4" color="info.main">98.5%</Typography>
                                <Typography variant="body2" color="text.secondary">
                                    This month
                                </Typography>
                            </CardContent>
                        </Card>
                    </Grid>
                </Grid>

                <Grid container spacing={3}>
                    {/* Revenue Chart */}
                    <Grid size={{ xs: 12, md: 8 }}>
                        <Paper sx={{ p: 3, height: 400 }}>
                            <Typography variant="h6" gutterBottom>
                                Weekly Revenue
                            </Typography>
                            <ResponsiveContainer width="100%" height="90%">
                                <BarChart
                                    data={revenueData}
                                    margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                                >
                                    <CartesianGrid strokeDasharray="3 3" />
                                    <XAxis dataKey="name" />
                                    <YAxis />
                                    <Tooltip />
                                    <Legend />
                                    <Bar dataKey="revenue" fill="#4caf50" name="Revenue (₹)" />
                                </BarChart>
                            </ResponsiveContainer>
                        </Paper>
                    </Grid>

                    {/* Earnings Summary */}
                    <Grid size={{ xs: 12, md: 4 }}>
                        <Paper sx={{ p: 3, height: 400 }}>
                            <Typography variant="h6" gutterBottom>
                                Revenue Breakdown
                            </Typography>
                            <Box sx={{ mt: 3 }}>
                                <Box mb={3}>
                                    <Typography variant="body2" color="textSecondary">
                                        Screen 1 - Downtown
                                    </Typography>
                                    <Typography variant="h5">₹3,240</Typography>
                                </Box>
                                <Box mb={3}>
                                    <Typography variant="body2" color="textSecondary">
                                        Screen 2 - Mall
                                    </Typography>
                                    <Typography variant="h5">₹2,890</Typography>
                                </Box>
                                <Box mb={3}>
                                    <Typography variant="body2" color="textSecondary">
                                        Screen 3 - Station
                                    </Typography>
                                    <Typography variant="h5">₹2,410</Typography>
                                </Box>
                            </Box>
                        </Paper>
                    </Grid>

                    {/* Impressions */}
                    <Grid size={{ xs: 12 }}>
                        <Paper sx={{ p: 3, height: 400 }}>
                            <Typography variant="h6" gutterBottom>
                                Total Impressions Delivered
                            </Typography>
                            <ResponsiveContainer width="100%" height="90%">
                                <LineChart
                                    data={impressionData}
                                    margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                                >
                                    <CartesianGrid strokeDasharray="3 3" />
                                    <XAxis dataKey="name" />
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
                        </Paper>
                    </Grid>
                </Grid>
            </Container>
        );
    }

    // ==========================================
    // ADVERTISER ANALYTICS - Focus on Campaign Performance
    // ==========================================
    if (isAdvertiser) {
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
                        <Card>
                            <CardContent>
                                <Typography color="textSecondary" gutterBottom>
                                    Total Impressions
                                </Typography>
                                <Typography variant="h4">19,550</Typography>
                                <Typography variant="body2" color="success.main">
                                    +12% from last week
                                </Typography>
                            </CardContent>
                        </Card>
                    </Grid>
                    <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                        <Card>
                            <CardContent>
                                <Typography color="textSecondary" gutterBottom>
                                    Total Spend
                                </Typography>
                                <Typography variant="h4">₹4,250</Typography>
                                <Typography variant="body2" color="text.secondary">
                                    This month
                                </Typography>
                            </CardContent>
                        </Card>
                    </Grid>
                    <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                        <Card>
                            <CardContent>
                                <Typography color="textSecondary" gutterBottom>
                                    Avg. CPM
                                </Typography>
                                <Typography variant="h4">₹217</Typography>
                                <Typography variant="body2" color="success.main">
                                    -8% from last month
                                </Typography>
                            </CardContent>
                        </Card>
                    </Grid>
                    <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                        <Card>
                            <CardContent>
                                <Typography color="textSecondary" gutterBottom>
                                    Active Campaigns
                                </Typography>
                                <Typography variant="h4" color="primary">3</Typography>
                                <Typography variant="body2" color="text.secondary">
                                    Currently running
                                </Typography>
                            </CardContent>
                        </Card>
                    </Grid>
                </Grid>

                <Grid container spacing={3}>
                    {/* Impressions Chart */}
                    <Grid size={{ xs: 12, md: 8 }}>
                        <Paper sx={{ p: 3, height: 400 }}>
                            <Typography variant="h6" gutterBottom>
                                Weekly Impressions
                            </Typography>
                            <ResponsiveContainer width="100%" height="90%">
                                <BarChart
                                    data={impressionData}
                                    margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                                >
                                    <CartesianGrid strokeDasharray="3 3" />
                                    <XAxis dataKey="name" />
                                    <YAxis />
                                    <Tooltip />
                                    <Legend />
                                    <Bar dataKey="impressions" fill="#8884d8" name="Impressions" />
                                </BarChart>
                            </ResponsiveContainer>
                        </Paper>
                    </Grid>

                    {/* Campaign Summary */}
                    <Grid size={{ xs: 12, md: 4 }}>
                        <Paper sx={{ p: 3, height: 400 }}>
                            <Typography variant="h6" gutterBottom>
                                Campaign Performance
                            </Typography>
                            <Box sx={{ mt: 3 }}>
                                <Box mb={3}>
                                    <Typography variant="body2" color="textSecondary">
                                        Summer Sale Campaign
                                    </Typography>
                                    <Typography variant="h5">8,240 plays</Typography>
                                    <Typography variant="body2" color="success.main">
                                        42% of target
                                    </Typography>
                                </Box>
                                <Box mb={3}>
                                    <Typography variant="body2" color="textSecondary">
                                        Brand Awareness
                                    </Typography>
                                    <Typography variant="h5">6,890 plays</Typography>
                                    <Typography variant="body2" color="success.main">
                                        78% of target
                                    </Typography>
                                </Box>
                                <Box mb={3}>
                                    <Typography variant="body2" color="textSecondary">
                                        New Product Launch
                                    </Typography>
                                    <Typography variant="h5">4,420 plays</Typography>
                                    <Typography variant="body2" color="warning.main">
                                        35% of target
                                    </Typography>
                                </Box>
                            </Box>
                        </Paper>
                    </Grid>

                    {/* Booking Trends */}
                    <Grid size={{ xs: 12 }}>
                        <Paper sx={{ p: 3, height: 400 }}>
                            <Typography variant="h6" gutterBottom>
                                Booking Trends
                            </Typography>
                            <ResponsiveContainer width="100%" height="90%">
                                <LineChart
                                    data={impressionData}
                                    margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                                >
                                    <CartesianGrid strokeDasharray="3 3" />
                                    <XAxis dataKey="name" />
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
                        </Paper>
                    </Grid>
                </Grid>
            </Container>
        );
    }

    // ==========================================
    // ADMIN ANALYTICS - Platform Overview (Default)
    // ==========================================
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
                    <Card>
                        <CardContent>
                            <Typography color="textSecondary" gutterBottom>
                                Total Impressions
                            </Typography>
                            <Typography variant="h4">19,550</Typography>
                            <Typography variant="body2" color="success.main">
                                +12% from last week
                            </Typography>
                        </CardContent>
                    </Card>
                </Grid>
                <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                    <Card>
                        <CardContent>
                            <Typography color="textSecondary" gutterBottom>
                                Total Revenue
                            </Typography>
                            <Typography variant="h4">₹4,250</Typography>
                            <Typography variant="body2" color="success.main">
                                +8% from last week
                            </Typography>
                        </CardContent>
                    </Card>
                </Grid>
                <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                    <Card>
                        <CardContent>
                            <Typography color="textSecondary" gutterBottom>
                                Active Screens
                            </Typography>
                            <Typography variant="h4">24</Typography>
                            <Typography variant="body2" color="text.secondary">
                                92% uptime
                            </Typography>
                        </CardContent>
                    </Card>
                </Grid>
                <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                    <Card>
                        <CardContent>
                            <Typography color="textSecondary" gutterBottom>
                                Active Campaigns
                            </Typography>
                            <Typography variant="h4">18</Typography>
                            <Typography variant="body2" color="text.secondary">
                                Across 8 advertisers
                            </Typography>
                        </CardContent>
                    </Card>
                </Grid>

                {/* Impressions Chart */}
                <Grid size={{ xs: 12, md: 8 }}>
                    <Paper sx={{ p: 3, height: 400 }}>
                        <Typography variant="h6" gutterBottom>
                            Weekly Impressions
                        </Typography>
                        <ResponsiveContainer width="100%" height="90%">
                            <BarChart
                                data={impressionData}
                                margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                            >
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis dataKey="name" />
                                <YAxis />
                                <Tooltip />
                                <Legend />
                                <Bar dataKey="impressions" fill="#8884d8" name="Impressions" />
                            </BarChart>
                        </ResponsiveContainer>
                    </Paper>
                </Grid>

                {/* Revenue Summary */}
                <Grid size={{ xs: 12, md: 4 }}>
                    <Grid container spacing={3}>
                        <Grid size={{ xs: 12 }}>
                            <Card>
                                <CardContent>
                                    <Typography color="textSecondary" gutterBottom>
                                        Total Revenue (Month)
                                    </Typography>
                                    <Typography variant="h4" color="success.main">₹42,500</Typography>
                                    <Typography variant="body2" color="success.main">
                                        +18% from last month
                                    </Typography>
                                </CardContent>
                            </Card>
                        </Grid>
                        <Grid size={{ xs: 12 }}>
                            <Card>
                                <CardContent>
                                    <Typography color="textSecondary" gutterBottom>
                                        Pending Approvals
                                    </Typography>
                                    <Typography variant="h4" color="warning.main">7</Typography>
                                    <Typography variant="body2" color="text.secondary">
                                        Booking requests
                                    </Typography>
                                </CardContent>
                            </Card>
                        </Grid>
                    </Grid>
                </Grid>

                {/* Bookings Trend */}
                <Grid size={{ xs: 12 }}>
                    <Paper sx={{ p: 3, height: 400 }}>
                        <Typography variant="h6" gutterBottom>
                            Booking Trends
                        </Typography>
                        <ResponsiveContainer width="100%" height="90%">
                            <LineChart
                                data={impressionData}
                                margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                            >
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis dataKey="name" />
                                <YAxis />
                                <Tooltip />
                                <Legend />
                                <Line
                                    type="monotone"
                                    dataKey="bookings"
                                    stroke="#82ca9d"
                                    name="Bookings"
                                />
                            </LineChart>
                        </ResponsiveContainer>
                    </Paper>
                </Grid>
            </Grid>
        </Container>
    );
}
