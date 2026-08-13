import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
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
    Alert,
} from '@mui/material';
import type { ChipProps } from '@mui/material';
import {
    ArrowBack as BackIcon,
    Assessment as ReportIcon,
    Payment as PaymentIcon,
    Timer as TimerIcon,
} from '@mui/icons-material';
import { formatDistanceToNow } from 'date-fns';
import { useAuthStore } from '../../store/authStore';
import { createPaymentOrder } from '../../services/paymentApi';
import PaymentScreen from '../../components/bookings/PaymentScreen';
import type { CreateOrderResponse } from '../../types/payment';
import { useSnackbar } from 'notistack';

export default function BookingDetailPage() {
    const { id } = useParams();
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const { user } = useAuthStore();
    const { enqueueSnackbar } = useSnackbar();
    const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
    const [paymentOrderDetails, setPaymentOrderDetails] = useState<CreateOrderResponse | null>(null);

    const { data: booking, isLoading } = useQuery({
        queryKey: ['booking', id],
        queryFn: async () => {
            const response = await api.get(`/bookings/${id}`);
            return response.data.data;
        },
    });

    const isPaymentPending = booking?.status === 'Approved' && booking?.paymentStatus === 'OrderCreated';

    const handlePayNow = async () => {
        if (!id) return;
        try {
            const order = await createPaymentOrder(id);
            setPaymentOrderDetails(order);
            setPaymentDialogOpen(true);
        } catch {
            enqueueSnackbar('Failed to initiate payment', { variant: 'error' });
        }
    };

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

    const getStatusColor = (status: string): ChipProps['color'] => {
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
                        <Chip label={booking.status} color={getStatusColor(booking.status)} />
                    </Box>
                    <Box display="flex" gap={1}>
                        {['Active', 'Approved', 'Completed'].includes(booking.status) && (
                            <Button
                                variant="contained"
                                color="primary"
                                startIcon={<ReportIcon />}
                                onClick={() => navigate(`/reports/bookings/${id}`)}
                            >
                                View Report
                            </Button>
                        )}
                    </Box>
                </Box>

                {/* Payment Callout for awaiting payment */}
                {isPaymentPending && user?.role === 'Advertiser' && (
                    <Alert
                        severity="warning"
                        icon={<PaymentIcon />}
                        sx={{ mb: 3 }}
                        action={
                            <Button
                                color="warning"
                                variant="contained"
                                size="small"
                                startIcon={<PaymentIcon />}
                                onClick={handlePayNow}
                            >
                                Pay Now
                            </Button>
                        }
                    >
                        <Typography variant="subtitle2" fontWeight={600}>
                            Payment Required — {booking.currency} {booking.totalPrice?.toLocaleString()}
                        </Typography>
                        {booking.paymentExpiresAt && (
                            <Typography variant="caption" sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.5 }}>
                                <TimerIcon sx={{ fontSize: 14 }} />
                                Expires {formatDistanceToNow(new Date(booking.paymentExpiresAt), { addSuffix: true })}
                            </Typography>
                        )}
                    </Alert>
                )}

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

            {/* Payment Screen Dialog */}
            <PaymentScreen
                open={paymentDialogOpen}
                onClose={() => {
                    setPaymentDialogOpen(false);
                    setPaymentOrderDetails(null);
                }}
                orderDetails={paymentOrderDetails}
                bookingId={id || ''}
                onPaymentConfirmed={() => {
                    setPaymentDialogOpen(false);
                    setPaymentOrderDetails(null);
                    queryClient.invalidateQueries({ queryKey: ['booking', id] });
                    queryClient.invalidateQueries({ queryKey: ['bookings'] });
                }}
            />
        </Container>
    );
}
