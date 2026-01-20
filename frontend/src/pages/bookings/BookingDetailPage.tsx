import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../services/api';
import {
    Container,
    Paper,
    Typography,
    Box,
    Grid,
    Chip,
    Button,
    Card,
    CardContent,
    LinearProgress,
} from '@mui/material';
import { ArrowBack as BackIcon } from '@mui/icons-material';

export default function BookingDetailPage() {
    const { id } = useParams();
    const navigate = useNavigate();

    const { data: booking, isLoading } = useQuery({
        queryKey: ['booking', id],
        queryFn: async () => {
            const response = await api.get(`/bookings/${id}`);
            return response.data.data;
        },
    });

    if (isLoading) {
        return (
            <Container maxWidth="lg" sx={{ mt: 4 }}>
                <LinearProgress />
            </Container>
        );
    }

    if (!booking) {
        return (
            <Container maxWidth="lg" sx={{ mt: 4 }}>
                <Typography>Booking not found</Typography>
            </Container>
        );
    }

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'Approved': case 'Active': case 'Completed':
                return 'success';
            case 'Pending':
                return 'warning';
            case 'Rejected': case 'Cancelled':
                return 'error';
            default:
                return 'default';
        }
    };

    return (
        <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
            <Button startIcon={<BackIcon />} onClick={() => navigate(-1)} sx={{ mb: 2 }}>
                Back
            </Button>
            <Paper sx={{ p: 4 }}>
                <Box display="flex" justifyContent="space-between" alignItems="start" mb={3}>
                    <Box>
                        <Typography variant="h4" gutterBottom>
                            Booking Details
                        </Typography>
                        <Chip label={booking.status} color={getStatusColor(booking.status) as any} />
                    </Box>
                </Box>

                <Grid container spacing={3}>
                    <Grid
                        size={{
                            xs: 12,
                            md: 6
                        }}>
                        <Card>
                            <CardContent>
                                <Typography color="textSecondary" gutterBottom>
                                    Campaign
                                </Typography>
                                <Typography variant="h6">
                                    {booking.campaignName || 'N/A'}
                                </Typography>
                            </CardContent>
                        </Card>
                    </Grid>

                    <Grid
                        size={{
                            xs: 12,
                            md: 6
                        }}>
                        <Card>
                            <CardContent>
                                <Typography color="textSecondary" gutterBottom>
                                    Screen
                                </Typography>
                                <Typography variant="h6">
                                    {booking.screenName || 'N/A'}
                                </Typography>
                            </CardContent>
                        </Card>
                    </Grid>

                    <Grid
                        size={{
                            xs: 12,
                            md: 4
                        }}>
                        <Card>
                            <CardContent>
                                <Typography color="textSecondary" gutterBottom>
                                    Start Date
                                </Typography>
                                <Typography variant="h6">
                                    {new Date(booking.startDate).toLocaleDateString()}
                                </Typography>
                            </CardContent>
                        </Card>
                    </Grid>

                    <Grid
                        size={{
                            xs: 12,
                            md: 4
                        }}>
                        <Card>
                            <CardContent>
                                <Typography color="textSecondary" gutterBottom>
                                    End Date
                                </Typography>
                                <Typography variant="h6">
                                    {new Date(booking.endDate).toLocaleDateString()}
                                </Typography>
                            </CardContent>
                        </Card>
                    </Grid>

                    <Grid
                        size={{
                            xs: 12,
                            md: 4
                        }}>
                        <Card>
                            <CardContent>
                                <Typography color="textSecondary" gutterBottom>
                                    Total Price
                                </Typography>
                                <Typography variant="h6" color="success.main">
                                    {booking.currency} {booking.totalPrice?.toLocaleString() || 0}
                                </Typography>
                            </CardContent>
                        </Card>
                    </Grid>

                    <Grid size={12}>
                        <Card>
                            <CardContent>
                                <Typography color="textSecondary" gutterBottom>
                                    Slot Numbers
                                </Typography>
                                <Box display="flex" gap={1} flexWrap="wrap">
                                    {booking.slotNumbers?.map((slot: number) => (
                                        <Chip key={slot} label={`Slot ${slot}`} size="small" />
                                    )) || <Typography variant="body2" color="textSecondary">No slots assigned</Typography>}
                                </Box>
                            </CardContent>
                        </Card>
                    </Grid>
                </Grid>
            </Paper>
        </Container>
    );
}
