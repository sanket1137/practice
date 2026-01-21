import { useState, useEffect } from 'react';
import {
    Box,
    Container,
    Typography,
    Paper,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Button,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    TextField,
    Card,
    CardMedia,
    CardContent,
    Grid,
    Tooltip,
} from '@mui/material';
import {
    CheckCircle as ApproveIcon,
    Cancel as RejectIcon,
    Warning as WarningIcon,
} from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSnackbar } from 'notistack';
import { api } from '../../services/api';
import { useAuthStore } from '../../store/authStore';
import { format } from 'date-fns';
import BookingFiltersBar from '../../components/bookings/BookingFiltersBar';
import StatusChip from '../../components/common/StatusChip';
import { TableSkeleton } from '../../components/common/LoadingSkeletons';
import EmptyState from '../../components/common/EmptyState';
import type { BookingStatus } from '../../constants/statusConfig';
import { websocketService } from '../../services/websocket';

interface BookingDateBreakdown {
    requestedDates: string[];
    availableDates: string[];
    unavailableDates: string[];
    totalRequested: number;
    totalAvailable: number;
    totalUnavailable: number;
    isPartialBooking: boolean;
}

interface Booking {
    id: string;
    campaignName: string;
    screenName: string;
    creativeName: string;
    creativeFileUrl: string;
    creativeMimeType: string;
    status: BookingStatus;
    startDate: string;
    endDate: string;
    totalPrice: number;
    currency: string;
    createdAt: string;
    expectedImpressions: number;
    bookedDates?: string[];
    dateBreakdown?: BookingDateBreakdown;
}

export default function BookingsPage() {
    const { user } = useAuthStore();
    const queryClient = useQueryClient();
    const { enqueueSnackbar } = useSnackbar();
    const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
    const [approveDialogOpen, setApproveDialogOpen] = useState(false);
    const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
    const [rejectNote, setRejectNote] = useState('');

    // Filter state
    const [filters, setFilters] = useState({
        status: 'all' as BookingStatus | 'all',
        search: '',
        dateFrom: '',
        dateTo: '',
    });

    // Real-time SignalR subscription for booking updates
    useEffect(() => {
        const connectAndSubscribe = async () => {
            try {
                // Connect to SignalR hub if not already connected
                if (!websocketService.isConnected()) {
                    await websocketService.connect();
                }

                // Subscribe to booking events for current user
                if (user?.id) {
                    await websocketService.invoke('SubscribeToBookings', user.id);
                    console.log('[BookingsPage] Subscribed to booking events for user:', user.id);
                }
            } catch (error) {
                console.error('[BookingsPage] Failed to connect to SignalR:', error);
            }
        };

        connectAndSubscribe();

        // Handle booking created event
        const handleBookingCreated = (data: { Booking: Booking; Message?: string }) => {
            console.log('[BookingsPage] Received BookingCreated event:', data);
            // Invalidate and refetch bookings query
            queryClient.invalidateQueries({ queryKey: ['bookings'] });
            if (data.Message) {
                enqueueSnackbar(data.Message, { variant: 'info' });
            }
        };

        // Handle booking approved event
        const handleBookingApproved = (data: { Booking: Booking; Message?: string }) => {
            console.log('[BookingsPage] Received BookingApproved event:', data);
            queryClient.invalidateQueries({ queryKey: ['bookings'] });
            if (data.Message) {
                enqueueSnackbar(data.Message, { variant: 'success' });
            }
        };

        // Handle booking rejected event
        const handleBookingRejected = (data: { Booking: Booking; Reason?: string; Message?: string }) => {
            console.log('[BookingsPage] Received BookingRejected event:', data);
            queryClient.invalidateQueries({ queryKey: ['bookings'] });
            if (data.Message) {
                enqueueSnackbar(data.Message, { variant: 'warning' });
            }
        };

        // Handle booking updated event
        const handleBookingUpdated = (data: { Booking: Booking }) => {
            console.log('[BookingsPage] Received BookingUpdated event:', data);
            queryClient.invalidateQueries({ queryKey: ['bookings'] });
        };

        // Register event handlers
        websocketService.on('BookingCreated', handleBookingCreated);
        websocketService.on('BookingApproved', handleBookingApproved);
        websocketService.on('BookingRejected', handleBookingRejected);
        websocketService.on('BookingUpdated', handleBookingUpdated);

        // Cleanup on unmount
        return () => {
            websocketService.off('BookingCreated', handleBookingCreated);
            websocketService.off('BookingApproved', handleBookingApproved);
            websocketService.off('BookingRejected', handleBookingRejected);
            websocketService.off('BookingUpdated', handleBookingUpdated);
            // Use invokeIfConnected for cleanup to avoid errors when connection failed
            if (user?.id) {
                websocketService.invokeIfConnected('UnsubscribeFromBookings', user.id);
            }
        };
    }, [user?.id, queryClient, enqueueSnackbar]);

    // Fetch bookings
    const { data: bookings, isLoading, error } = useQuery<Booking[]>({
        queryKey: ['bookings'],
        queryFn: async () => {
            console.log('Fetching bookings...');
            const response = await api.get('/bookings');
            console.log('Bookings response:', response);
            if (response.data?.data) {
                return response.data.data;
            }
            return response.data || [];
        },
    });

    console.log('Bookings state:', { bookings, isLoading, error });

    // Apply filters
    const filteredBookings = bookings?.filter((booking) => {
        // Search filter
        if (filters.search) {
            const searchLower = filters.search.toLowerCase();
            const matchesSearch =
                booking.campaignName.toLowerCase().includes(searchLower) ||
                booking.screenName.toLowerCase().includes(searchLower) ||
                booking.creativeName.toLowerCase().includes(searchLower);
            if (!matchesSearch) return false;
        }

        // Status filter
        if (filters.status !== 'all' && booking.status !== filters.status) {
            return false;
        }

        // Date filters
        if (filters.dateFrom && new Date(booking.startDate) < new Date(filters.dateFrom)) {
            return false;
        }
        if (filters.dateTo && new Date(booking.endDate) > new Date(filters.dateTo)) {
            return false;
        }

        return true;
    }) || [];

    // Approve booking mutation
    const approveMutation = useMutation({
        mutationFn: async (bookingId: string) => {
            await api.post(`/bookings/${bookingId}/approve`);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['bookings'] });
            enqueueSnackbar('Booking approved successfully', { variant: 'success' });
            setApproveDialogOpen(false);
            setSelectedBooking(null);
        },
        onError: () => {
            enqueueSnackbar('Failed to approve booking', { variant: 'error' });
        },
    });

    // Reject booking mutation
    const rejectMutation = useMutation({
        mutationFn: async ({ bookingId, note }: { bookingId: string; note: string }) => {
            await api.post(`/bookings/${bookingId}/reject`, { rejectionNote: note });
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['bookings'] });
            enqueueSnackbar('Booking rejected', { variant: 'info' });
            setRejectDialogOpen(false);
            setSelectedBooking(null);
            setRejectNote('');
        },
        onError: () => {
            enqueueSnackbar('Failed to reject booking', { variant: 'error' });
        },
    });

    const handleOpenApprove = (booking: Booking) => {
        setSelectedBooking(booking);
        setApproveDialogOpen(true);
    };

    const handleOpenReject = (booking: Booking) => {
        setSelectedBooking(booking);
        setRejectDialogOpen(true);
    };

    const renderBookingsTable = (bookingsList: Booking[], showActions: boolean = false) => {
        if (bookingsList.length === 0) {
            return (
                <EmptyState
                    title="No bookings found"
                    message={filters.search ? "Try adjusting your filters" : "Create a new booking to get started"}
                />
            );
        }

        return (
            <TableContainer>
                <Table>
                    <TableHead>
                        <TableRow>
                            <TableCell>Campaign</TableCell>
                            <TableCell>Screen</TableCell>
                            <TableCell>Creative</TableCell>
                            <TableCell>Period</TableCell>
                            <TableCell>Type</TableCell>
                            <TableCell>Created</TableCell>
                            <TableCell>Impressions</TableCell>
                            <TableCell>Price</TableCell>
                            <TableCell>Status</TableCell>
                            {showActions && <TableCell align="right">Actions</TableCell>}
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {bookingsList.map((booking) => (
                            <TableRow key={booking.id} hover>
                                <TableCell>{booking.campaignName}</TableCell>
                                <TableCell>{booking.screenName}</TableCell>
                                <TableCell>{booking.creativeName}</TableCell>
                                <TableCell>
                                    <Box>
                                        <Typography variant="body2">
                                            {new Date(booking.startDate).toLocaleDateString()} -{' '}
                                            {new Date(booking.endDate).toLocaleDateString()}
                                        </Typography>
                                        {booking.dateBreakdown?.isPartialBooking && (
                                            <Tooltip
                                                title={`${booking.dateBreakdown.totalAvailable} of ${booking.dateBreakdown.totalRequested} days booked`}
                                            >
                                                <Box
                                                    component="span"
                                                    sx={{
                                                        display: 'inline-flex',
                                                        alignItems: 'center',
                                                        gap: 0.5,
                                                        mt: 0.5,
                                                        px: 1,
                                                        py: 0.25,
                                                        bgcolor: 'warning.lighter',
                                                        borderRadius: 1,
                                                        fontSize: '0.75rem',
                                                        color: 'warning.dark',
                                                    }}
                                                >
                                                    <WarningIcon fontSize="small" />
                                                    {booking.dateBreakdown.totalAvailable}/
                                                    {booking.dateBreakdown.totalRequested} days
                                                </Box>
                                            </Tooltip>
                                        )}
                                    </Box>
                                </TableCell>
                                <TableCell>
                                    {booking.dateBreakdown?.isPartialBooking ? (
                                        <Tooltip
                                            title={
                                                <Box>
                                                    <Typography variant="caption" fontWeight="bold" display="block">
                                                        Requested: {booking.dateBreakdown.totalRequested} days
                                                    </Typography>
                                                    <Typography variant="caption" display="block" sx={{ mt: 0.5 }}>
                                                        ✅ Booked:
                                                    </Typography>
                                                    <Typography variant="caption" display="block">
                                                        {booking.dateBreakdown.availableDates
                                                            .map(d => format(new Date(d), 'MMM dd'))
                                                            .join(', ')}
                                                    </Typography>
                                                    <Typography variant="caption" display="block" sx={{ mt: 0.5 }}>
                                                        ❌ Excluded:
                                                    </Typography>
                                                    <Typography variant="caption" display="block">
                                                        {booking.dateBreakdown.unavailableDates
                                                            .map(d => format(new Date(d), 'MMM dd'))
                                                            .join(', ')}
                                                    </Typography>
                                                </Box>
                                            }
                                        >
                                            <Box
                                                component="span"
                                                sx={{
                                                    display: 'inline-flex',
                                                    alignItems: 'center',
                                                    gap: 0.5,
                                                    px: 1.5,
                                                    py: 0.5,
                                                    bgcolor: 'warning.lighter',
                                                    color: 'warning.dark',
                                                    borderRadius: 1,
                                                    fontSize: '0.875rem',
                                                    fontWeight: 500,
                                                }}
                                            >
                                                <WarningIcon fontSize="small" />
                                                Partial
                                            </Box>
                                        </Tooltip>
                                    ) : (
                                        <Box
                                            component="span"
                                            sx={{
                                                display: 'inline-flex',
                                                alignItems: 'center',
                                                gap: 0.5,
                                                px: 1.5,
                                                py: 0.5,
                                                bgcolor: 'success.lighter',
                                                color: 'success.dark',
                                                borderRadius: 1,
                                                fontSize: '0.875rem',
                                                fontWeight: 500,
                                            }}
                                        >
                                            ✓ Full
                                        </Box>
                                    )}
                                </TableCell>
                                <TableCell>{new Date(booking.createdAt).toLocaleDateString()}</TableCell>
                                <TableCell>{booking.expectedImpressions.toLocaleString()}</TableCell>
                                <TableCell>
                                    {booking.currency} {booking.totalPrice.toLocaleString()}
                                </TableCell>
                                <TableCell>
                                    <StatusChip status={booking.status} type="booking" />
                                </TableCell>
                                {showActions && (
                                    <TableCell align="right">
                                        {booking.status === 'Pending' ? (
                                            <Box display="flex" gap={1} justifyContent="flex-end">
                                                <Button
                                                    size="small"
                                                    variant="contained"
                                                    startIcon={<ApproveIcon />}
                                                    color="success"
                                                    onClick={() => handleOpenApprove(booking)}
                                                >
                                                    Approve
                                                </Button>
                                                <Button
                                                    size="small"
                                                    variant="outlined"
                                                    startIcon={<RejectIcon />}
                                                    color="error"
                                                    onClick={() => handleOpenReject(booking)}
                                                >
                                                    Reject
                                                </Button>
                                            </Box>
                                        ) : (
                                            <Typography variant="body2" color="text.secondary">
                                                {booking.status === 'Approved' && '✓ Approved'}
                                                {booking.status === 'Rejected' && '✗ Rejected'}
                                                {booking.status === 'Cancelled' && '⊗ Cancelled'}
                                                {booking.status === 'Active' && '▶ Active'}
                                                {booking.status === 'Completed' && '✓ Completed'}
                                            </Typography>
                                        )}
                                    </TableCell>
                                )}
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </TableContainer>
        );
    };

    if (isLoading) {
        return (
            <Container maxWidth="xl" sx={{ mt: 4 }}>
                <Typography variant="h4" gutterBottom>
                    Booking Management
                </Typography>
                <TableSkeleton rows={8} columns={10} />
            </Container>
        );
    }

    if (error) {
        return (
            <Container maxWidth="xl" sx={{ mt: 4 }}>
                <Typography variant="h4" gutterBottom>
                    Booking Management
                </Typography>
                <Box
                    sx={{
                        bgcolor: 'error.lighter',
                        color: 'error.dark',
                        p: 3,
                        borderRadius: 1,
                        textAlign: 'center',
                    }}
                >
                    <Typography variant="h6" gutterBottom>
                        Failed to load bookings
                    </Typography>
                    <Typography variant="body2">
                        {error instanceof Error ? error.message : 'An error occurred'}
                    </Typography>
                    <Button
                        variant="contained"
                        color="error"
                        sx={{ mt: 2 }}
                        onClick={() => window.location.reload()}
                    >
                        Retry
                    </Button>
                </Box>
            </Container>
        );
    }

    return (
        <Container maxWidth="xl" sx={{ mt: 4, mb: 4 }}>
            <Box mb={3}>
                <Typography variant="h4" gutterBottom>
                    {user?.role === 'ScreenOwner'
                        ? 'Booking Requests'
                        : user?.role === 'Advertiser'
                            ? 'My Bookings'
                            : 'All Bookings'}
                </Typography>
                <Typography variant="body1" color="textSecondary">
                    {user?.role === 'ScreenOwner'
                        ? 'Review and approve booking requests for your screens'
                        : user?.role === 'Advertiser'
                            ? 'Track the status of your submitted booking requests'
                            : 'View and manage all bookings on the platform'}
                </Typography>
            </Box>
            {/* Filters */}
            <BookingFiltersBar
                filters={filters}
                onFiltersChange={setFilters}
                onClearFilters={() =>
                    setFilters({
                        status: 'all',
                        search: '',
                        dateFrom: '',
                        dateTo: '',
                    })
                }
            />
            <Paper>
                <Box p={3}>
                    {renderBookingsTable(filteredBookings, user?.role === 'ScreenOwner')}
                </Box>
            </Paper>
            {/* Approve Dialog */}
            <Dialog open={approveDialogOpen} onClose={() => setApproveDialogOpen(false)} maxWidth="md" fullWidth>
                <DialogTitle>Approve Booking Request</DialogTitle>
                <DialogContent>
                    {selectedBooking && (
                        <Grid container spacing={3} sx={{ mt: 1 }}>
                            <Grid
                                size={{
                                    xs: 12,
                                    md: 6
                                }}>
                                <Card>
                                    <CardMedia
                                        component={selectedBooking.creativeMimeType.startsWith('video/') ? 'video' : 'img'}
                                        image={selectedBooking.creativeFileUrl}
                                        sx={{ height: 300 }}
                                        controls={selectedBooking.creativeMimeType.startsWith('video/')}
                                    />
                                    <CardContent>
                                        <Typography variant="h6">{selectedBooking.creativeName}</Typography>
                                        <Typography variant="body2" color="textSecondary">
                                            {selectedBooking.creativeMimeType}
                                        </Typography>
                                    </CardContent>
                                </Card>
                            </Grid>
                            <Grid
                                size={{
                                    xs: 12,
                                    md: 6
                                }}>
                                <Typography variant="h6" gutterBottom>
                                    Booking Details
                                </Typography>
                                <Box sx={{ '& > *': { mb: 2 } }}>
                                    <div>
                                        <Typography variant="body2" color="textSecondary">
                                            Campaign
                                        </Typography>
                                        <Typography variant="body1">{selectedBooking.campaignName}</Typography>
                                    </div>
                                    <div>
                                        <Typography variant="body2" color="textSecondary">
                                            Screen
                                        </Typography>
                                        <Typography variant="body1">{selectedBooking.screenName}</Typography>
                                    </div>
                                    <div>
                                        <Typography variant="body2" color="textSecondary">
                                            Period
                                        </Typography>
                                        <Typography variant="body1">
                                            {new Date(selectedBooking.startDate).toLocaleDateString()} -{' '}
                                            {new Date(selectedBooking.endDate).toLocaleDateString()}
                                        </Typography>
                                    </div>
                                    <div>
                                        <Typography variant="body2" color="textSecondary">
                                            Expected Impressions
                                        </Typography>
                                        <Typography variant="body1">
                                            {selectedBooking.expectedImpressions.toLocaleString()}
                                        </Typography>
                                    </div>
                                    <div>
                                        <Typography variant="body2" color="textSecondary">
                                            Total Price
                                        </Typography>
                                        <Typography variant="h6" color="primary">
                                            {selectedBooking.currency} {selectedBooking.totalPrice.toLocaleString()}
                                        </Typography>
                                    </div>
                                </Box>
                            </Grid>
                        </Grid>
                    )}
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setApproveDialogOpen(false)}>Cancel</Button>
                    <Button
                        variant="contained"
                        color="success"
                        onClick={() => selectedBooking && approveMutation.mutate(selectedBooking.id)}
                        disabled={approveMutation.isPending}
                    >
                        {approveMutation.isPending ? 'Approving...' : 'Approve Booking'}
                    </Button>
                </DialogActions>
            </Dialog>
            {/* Reject Dialog */}
            <Dialog open={rejectDialogOpen} onClose={() => setRejectDialogOpen(false)}>
                <DialogTitle>Reject Booking Request</DialogTitle>
                <DialogContent>
                    <Typography variant="body2" color="textSecondary" sx={{ mb: 2 }}>
                        Please provide a reason for rejecting this booking request.
                    </Typography>
                    <TextField
                        fullWidth
                        multiline
                        rows={4}
                        label="Rejection Note"
                        value={rejectNote}
                        onChange={(e) => setRejectNote(e.target.value)}
                        placeholder="Enter reason for rejection..."
                    />
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setRejectDialogOpen(false)}>Cancel</Button>
                    <Button
                        variant="contained"
                        color="error"
                        onClick={() =>
                            selectedBooking &&
                            rejectMutation.mutate({
                                bookingId: selectedBooking.id,
                                note: rejectNote,
                            })
                        }
                        disabled={rejectMutation.isPending || !rejectNote.trim()}
                    >
                        {rejectMutation.isPending ? 'Rejecting...' : 'Reject Booking'}
                    </Button>
                </DialogActions>
            </Dialog>
        </Container>
    );
}
