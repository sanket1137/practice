import React, { useState } from 'react';
import {
    Card,
    CardContent,
    Typography,
    Box,
    Chip,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Paper,
    CircularProgress,
    Alert,
    TextField,
    Grid,
} from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../services/api';
import { addDays } from 'date-fns';

interface SlotBookingsCardProps {
    screenId: string;
}

interface Booking {
    id: string;
    campaignName: string;
    advertiserName: string;
    startDate: string;
    endDate: string;
    slotNumbers: number[];
    totalPrice: number;
    currency: string;
    status: string;
}

const SlotBookingsCard: React.FC<SlotBookingsCardProps> = ({ screenId }) => {
    const [startDate, setStartDate] = useState<Date>(new Date());
    const [endDate, setEndDate] = useState<Date>(addDays(new Date(), 7));

    const { data: bookings, isLoading, error } = useQuery<Booking[]>({
        queryKey: ['screen-bookings', screenId, startDate, endDate],
        queryFn: async () => {
            const response = await api.get(`/bookings`, {
                params: {
                    screenId,
                    startDate: startDate.toISOString().split('T')[0],
                    endDate: endDate.toISOString().split('T')[0],
                },
            });
            return response.data.data;
        },
        enabled: !!screenId,
    });

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'Approved':
                return 'success';
            case 'Pending':
                return 'warning';
            case 'Rejected':
                return 'error';
            default:
                return 'default';
        }
    };

    // Revenue calculation - only count Approved, Active, and Completed bookings
    const confirmedBookings = bookings?.filter(b =>
        b.status === 'Approved' || b.status === 'Active' || b.status === 'Completed'
    ) || [];

    const pendingBookings = bookings?.filter(b => b.status === 'Pending') || [];

    const totalRevenue = confirmedBookings.reduce((sum, booking) => sum + booking.totalPrice, 0);
    const potentialRevenue = pendingBookings.reduce((sum, booking) => sum + booking.totalPrice, 0);

    if (isLoading) {
        return (
            <Card>
                <CardContent>
                    <Box display="flex" alignItems="center" gap={2}>
                        <CircularProgress size={20} />
                        <Typography>Loading bookings...</Typography>
                    </Box>
                </CardContent>
            </Card>
        );
    }

    if (error) {
        return (
            <Alert severity="error">
                Failed to load bookings. Please try again.
            </Alert>
        );
    }

    return (
        <Card>
            <CardContent>
                <Typography variant="h6" gutterBottom>
                    📅 Slot Bookings
                </Typography>

                {/* Date Range Selector */}
                <LocalizationProvider dateAdapter={AdapterDateFns}>
                    <Grid container spacing={2} sx={{ mb: 3 }}>
                        <Grid
                            size={{
                                xs: 12,
                                sm: 6
                            }}>
                            <DatePicker
                                label="Start Date"
                                value={startDate}
                                onChange={(date) => date && setStartDate(date)}
                                slotProps={{
                                    textField: {
                                        fullWidth: true,
                                        size: 'small',
                                    },
                                }}
                            />
                        </Grid>
                        <Grid
                            size={{
                                xs: 12,
                                sm: 6
                            }}>
                            <DatePicker
                                label="End Date"
                                value={endDate}
                                onChange={(date) => date && setEndDate(date)}
                                minDate={startDate}
                                slotProps={{
                                    textField: {
                                        fullWidth: true,
                                        size: 'small',
                                    },
                                }}
                            />
                        </Grid>
                    </Grid>
                </LocalizationProvider>

                {/* Summary */}
                <Box sx={{ mb: 3, p: 2, bgcolor: 'background.default', borderRadius: 1 }}>
                    <Grid container spacing={2}>
                        <Grid
                            size={{
                                xs: 12,
                                sm: 4
                            }}>
                            <Typography variant="caption" color="textSecondary">
                                Total Bookings
                            </Typography>
                            <Typography variant="h5">
                                {confirmedBookings.length}
                            </Typography>
                            <Typography variant="caption" color="textSecondary">
                                (Approved/Active/Completed)
                            </Typography>
                        </Grid>
                        <Grid size={6}>
                            <Typography variant="caption" color="textSecondary">
                                Total Revenue
                            </Typography>
                            <Typography variant="h5" color="success.main">
                                {bookings && bookings.length > 0
                                    ? `${bookings[0].currency} ${totalRevenue.toLocaleString()}`
                                    : 'INR 0'}
                            </Typography>
                        </Grid>
                    </Grid>
                </Box>

                {/* Bookings Table */}
                {!bookings || bookings.length === 0 ? (
                    <Alert severity="info">
                        No bookings found for the selected date range.
                    </Alert>
                ) : (
                    <TableContainer component={Paper} variant="outlined">
                        <Table size="small">
                            <TableHead>
                                <TableRow>
                                    <TableCell>Campaign</TableCell>
                                    <TableCell>Advertiser</TableCell>
                                    <TableCell>Period</TableCell>
                                    <TableCell>Slots</TableCell>
                                    <TableCell align="right">Price</TableCell>
                                    <TableCell>Status</TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {bookings.map((booking) => (
                                    <TableRow key={booking.id} hover>
                                        <TableCell>
                                            <Typography variant="body2" fontWeight="medium">
                                                {booking.campaignName}
                                            </Typography>
                                        </TableCell>
                                        <TableCell>
                                            <Typography variant="body2">
                                                {booking.advertiserName}
                                            </Typography>
                                        </TableCell>
                                        <TableCell>
                                            <Typography variant="caption">
                                                {new Date(booking.startDate).toLocaleDateString()} -{' '}
                                                {new Date(booking.endDate).toLocaleDateString()}
                                            </Typography>
                                        </TableCell>
                                        <TableCell>
                                            <Box display="flex" gap={0.5} flexWrap="wrap">
                                                {booking.slotNumbers.map((slot) => (
                                                    <Chip
                                                        key={slot}
                                                        label={`#${slot}`}
                                                        size="small"
                                                        variant="outlined"
                                                    />
                                                ))}
                                            </Box>
                                        </TableCell>
                                        <TableCell align="right">
                                            <Typography variant="body2" fontWeight="medium">
                                                {booking.currency} {booking.totalPrice.toLocaleString()}
                                            </Typography>
                                        </TableCell>
                                        <TableCell>
                                            <Chip
                                                label={booking.status}
                                                color={getStatusColor(booking.status) as any}
                                                size="small"
                                            />
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </TableContainer>
                )}
            </CardContent>
        </Card>
    );
};

export default SlotBookingsCard;
