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

const data = [
    { name: 'Mon', impressions: 4000, bookings: 24 },
    { name: 'Tue', impressions: 3000, bookings: 13 },
    { name: 'Wed', impressions: 2000, bookings: 98 },
    { name: 'Thu', impressions: 2780, bookings: 39 },
    { name: 'Fri', impressions: 1890, bookings: 48 },
    { name: 'Sat', impressions: 2390, bookings: 38 },
    { name: 'Sun', impressions: 3490, bookings: 43 },
];

export default function AnalyticsPage() {
    return (
        <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
            <Box mb={4}>
                <Typography variant="h4" gutterBottom>
                    Analytics Dashboard
                </Typography>
                <Typography variant="body1" color="textSecondary">
                    Performance metrics for your screens and campaigns
                </Typography>
            </Box>

            <Grid container spacing={3}>
                {/* Impressions Chart */}
                <Grid item xs={12} md={8}>
                    <Paper sx={{ p: 3, height: 400 }}>
                        <Typography variant="h6" gutterBottom>
                            Weekly Impressions
                        </Typography>
                        <ResponsiveContainer width="100%" height="90%">
                            <BarChart
                                data={data}
                                margin={{
                                    top: 5,
                                    right: 30,
                                    left: 20,
                                    bottom: 5,
                                }}
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

                {/* Summary Cards */}
                <Grid item xs={12} md={4}>
                    <Grid container spacing={3}>
                        <Grid item xs={12}>
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
                        <Grid item xs={12}>
                            <Card>
                                <CardContent>
                                    <Typography color="textSecondary" gutterBottom>
                                        Total Revenue
                                    </Typography>
                                    <Typography variant="h4">$4,250</Typography>
                                    <Typography variant="body2" color="success.main">
                                        +8% from last week
                                    </Typography>
                                </CardContent>
                            </Card>
                        </Grid>
                    </Grid>
                </Grid>

                {/* Bookings Trend */}
                <Grid item xs={12}>
                    <Paper sx={{ p: 3, height: 400 }}>
                        <Typography variant="h6" gutterBottom>
                            Booking Trends
                        </Typography>
                        <ResponsiveContainer width="100%" height="90%">
                            <LineChart
                                data={data}
                                margin={{
                                    top: 5,
                                    right: 30,
                                    left: 20,
                                    bottom: 5,
                                }}
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
