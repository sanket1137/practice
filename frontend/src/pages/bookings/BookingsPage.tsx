import { useState, useEffect, useMemo } from 'react';
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
    Tabs,
    Tab,
    Badge,
    Chip,
} from '@mui/material';
import {
    CheckCircle as ApproveIcon,
    Cancel as RejectIcon,
    Warning as WarningIcon,
    Payment as PaymentIcon,
    Edit as EditIcon,
    Timer as TimerIcon,
} from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSnackbar } from 'notistack';
import { api } from '../../services/api';
import { useAuthStore } from '../../store/authStore';
import { format, formatDistanceToNow } from 'date-fns';
import BookingFiltersBar from '../../components/bookings/BookingFiltersBar';
import StatusChip from '../../components/common/StatusChip';
import { TableSkeleton } from '../../components/common/LoadingSkeletons';
import EmptyState from '../../components/common/EmptyState';
import type { BookingStatus } from '../../constants/statusConfig';
import { websocketService } from '../../services/websocket';
import { createPaymentOrder } from '../../services/paymentApi';
import PaymentScreen from '../../components/bookings/PaymentScreen';
import type { CreateOrderResponse } from '../../types/payment';

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
    paymentStatus?: string;
    razorpayOrderId?: string;
    paymentExpiresAt?: string;
    virtualAccountNumber?: string;
    virtualAccountIfsc?: string;
}

export default function BookingsPage() {
    const { user } = useAuthStore();
    const queryClient = useQueryClient();
    const { enqueueSnackbar } = useSnackbar();
    const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
    const [approveDialogOpen, setApproveDialogOpen] = useState(false);
    const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
    const [rejectNote, setRejectNote] = useState('');
    const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
    const [cancelReason, setCancelReason] = useState('');
    const [activeTab, setActiveTab] = useState(0);
    const [updateDatesDialogOpen, setUpdateDatesDialogOpen] = useState(false);
    const [newStartDate, setNewStartDate] = useState('');
    const [newEndDate, setNewEndDate] = useState('');
    const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
    const [paymentOrderDetails, setPaymentOrderDetails] = useState<CreateOrderResponse | null>(null);
    const [paymentBookingId, setPaymentBookingId] = useState<string>('');
    // Date lifecycle helpers
    const today = useMemo(() => {
        const d = new Date();
        d.setHours(0, 0, 0, 0);
        return d;
    }, []);

    const isExpired = (booking: Booking) => new Date(booking.endDate + 'T23:59:59') < today;
    const isStartDatePassed = (booking: Booking) => new Date(booking.startDate) < today;

    const isActiveLifecycle = (booking: Booking) => {
        const activeStatuses = ['Pending', 'Approved', 'Active'];
        return activeStatuses.includes(booking.status) && !isExpired(booking);
    };

    const isHistoryLifecycle = (booking: Booking) => {
        const terminalStatuses = ['Completed', 'Rejected', 'Cancelled'];
        return terminalStatuses.includes(booking.status) || isExpired(booking);
    };

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

                // Subscribe to booking events for current user. subscribeToBookings
                // registers in the service's subscription registry, so the group is
                // automatically re-joined after a SignalR reconnect.
                if (user?.id) {
                    await websocketService.subscribeToBookings(user.id);
                }
            } catch (error) {
                console.error('[BookingsPage] Failed to connect to SignalR:', error);
            }
        };

        connectAndSubscribe();

        // SignalR payloads are camelCase on the wire — handlers used to read
        // PascalCase (data.Message), so delivered events showed no toasts.
        const handleBookingCreated = (data: { booking: Booking; message?: string }) => {
            console.log('[BookingsPage] Received BookingCreated event:', data);
            // Invalidate and refetch bookings query
            queryClient.invalidateQueries({ queryKey: ['bookings'] });
            if (data.message) {
                enqueueSnackbar(data.message, { variant: 'info' });
            }
        };

        // Handle booking approved event
        const handleBookingApproved = (data: { booking: Booking; message?: string }) => {
            console.log('[BookingsPage] Received BookingApproved event:', data);
            queryClient.invalidateQueries({ queryKey: ['bookings'] });
            if (data.message) {
                enqueueSnackbar(data.message, { variant: 'success' });
            }
        };

        // Handle booking rejected event
        const handleBookingRejected = (data: { booking: Booking; reason?: string; message?: string }) => {
            console.log('[BookingsPage] Received BookingRejected event:', data);
            queryClient.invalidateQueries({ queryKey: ['bookings'] });
            if (data.message) {
                enqueueSnackbar(data.message, { variant: 'warning' });
            }
        };

        // Handle booking updated event
        const handleBookingUpdated = (data: { booking: Booking }) => {
            console.log('[BookingsPage] Received BookingUpdated event:', data);
            queryClient.invalidateQueries({ queryKey: ['bookings'] });
        };

        // Handle booking cancelled event
        const handleBookingCancelled = (data: { booking: Booking; reason?: string; message?: string }) => {
            console.log('[BookingsPage] Received BookingCancelled event:', data);
            queryClient.invalidateQueries({ queryKey: ['bookings'] });
            if (data.message) {
                enqueueSnackbar(data.message, { variant: 'warning' });
            }
        };

        // Register event handlers
        websocketService.on('BookingCreated', handleBookingCreated);
        websocketService.on('BookingApproved', handleBookingApproved);
        websocketService.on('BookingRejected', handleBookingRejected);
        websocketService.on('BookingUpdated', handleBookingUpdated);
        websocketService.on('BookingCancelled', handleBookingCancelled);

        // Cleanup on unmount
        return () => {
            websocketService.off('BookingCreated', handleBookingCreated);
            websocketService.off('BookingApproved', handleBookingApproved);
            websocketService.off('BookingRejected', handleBookingRejected);
            websocketService.off('BookingUpdated', handleBookingUpdated);
            websocketService.off('BookingCancelled', handleBookingCancelled);
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

    // Cancel booking mutation
    const cancelMutation = useMutation({
        mutationFn: async ({ bookingId, reason }: { bookingId: string; reason?: string }) => {
            await api.post(`/bookings/${bookingId}/cancel`, { reason });
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['bookings'] });
            enqueueSnackbar('Booking cancelled successfully', { variant: 'info' });
            setCancelDialogOpen(false);
            setSelectedBooking(null);
            setCancelReason('');
        },
        onError: () => {
            enqueueSnackbar('Failed to cancel booking', { variant: 'error' });
        },
    });

    // Update booking dates mutation (re-request)
    const updateDatesMutation = useMutation({
        mutationFn: async ({ bookingId, startDate, endDate }: { bookingId: string; startDate: string; endDate: string }) => {
            await api.put(`/bookings/${bookingId}/update-dates`, {
                newStartDate: startDate,
                newEndDate: endDate,
            });
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['bookings'] });
            enqueueSnackbar('Booking dates updated and re-submitted for approval', { variant: 'success' });
            setUpdateDatesDialogOpen(false);
            setSelectedBooking(null);
            setNewStartDate('');
            setNewEndDate('');
        },
        onError: () => {
            enqueueSnackbar('Failed to update booking dates', { variant: 'error' });
        },
    });

    // Pay for booking — open PaymentScreen dialog
    const handlePayNow = async (booking: Booking) => {
        try {
            const order = await createPaymentOrder(booking.id);
            setPaymentOrderDetails(order);
            setPaymentBookingId(booking.id);
            setPaymentDialogOpen(true);
        } catch {
            enqueueSnackbar('Failed to initiate payment', { variant: 'error' });
        }
    };

    const isPaymentPending = (booking: Booking) =>
        booking.status === 'Approved' && booking.paymentStatus === 'OrderCreated';

    // Blur the currently focused element before opening a Dialog so MUI's
    // aria-hidden on #root doesn't conflict with a button that retained focus.
    // (Fixes the "Blocked aria-hidden on an element because its descendant
    // retained focus" warning in the browser console.)
    const blurActive = () => {
        if (typeof document !== 'undefined' && document.activeElement instanceof HTMLElement) {
            document.activeElement.blur();
        }
    };

    const handleOpenApprove = (booking: Booking) => {
        blurActive();
        setSelectedBooking(booking);
        setApproveDialogOpen(true);
    };

    const handleOpenReject = (booking: Booking) => {
        blurActive();
        setSelectedBooking(booking);
        setRejectDialogOpen(true);
    };

    const handleOpenCancel = (booking: Booking) => {
        blurActive();
        setSelectedBooking(booking);
        setCancelDialogOpen(true);
    };

    const handleOpenUpdateDates = (booking: Booking) => {
        blurActive();
        setSelectedBooking(booking);
        // Pre-fill with tomorrow as default start date
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        setNewStartDate(tomorrow.toISOString().split('T')[0]);
        setNewEndDate(booking.endDate);
        setUpdateDatesDialogOpen(true);
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
                                    {isPaymentPending(booking) ? (
                                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                                            <StatusChip status="PaymentPending" type="booking" />
                                            {booking.paymentExpiresAt && (
                                                <Typography variant="caption" sx={{ display: 'flex', alignItems: 'center', gap: 0.5, color: 'warning.main' }}>
                                                    <TimerIcon sx={{ fontSize: 14 }} />
                                                    {formatDistanceToNow(new Date(booking.paymentExpiresAt), { addSuffix: true })}
                                                </Typography>
                                            )}
                                        </Box>
                                    ) : (
                                        <StatusChip status={booking.status} type="booking" />
                                    )}
                                </TableCell>
                                {showActions && (
                                    <TableCell align="right">
                                        {/* ScreenOwner: Approve/Reject for Pending bookings that haven't expired */}
                                        {booking.status === 'Pending' && user?.role === 'ScreenOwner' && !isExpired(booking) ? (
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
                                        ) : /* Advertiser: Pay Now (only if start date not passed) + Cancel + Update Dates */
                                        (booking.status === 'Pending' || booking.status === 'Approved' || booking.status === 'Active') && !isExpired(booking) ? (
                                            <Box display="flex" gap={1} justifyContent="flex-end" flexWrap="wrap">
                                                {/* Pay Now: only for Advertiser, only Approved with OrderCreated payment, only if start date hasn't passed */}
                                                {user?.role === 'Advertiser' && booking.status === 'Approved' && !isStartDatePassed(booking) && (
                                                    <Button
                                                        size="small"
                                                        variant="contained"
                                                        startIcon={<PaymentIcon />}
                                                        color={isPaymentPending(booking) ? 'warning' : 'primary'}
                                                        onClick={() => handlePayNow(booking)}
                                                    >
                                                        Pay Now
                                                    </Button>
                                                )}
                                                {/* Update Dates: for Advertiser when start date has passed but booking not expired */}
                                                {user?.role === 'Advertiser' && (booking.status === 'Pending' || booking.status === 'Approved') && isStartDatePassed(booking) && (
                                                    <Button
                                                        size="small"
                                                        variant="outlined"
                                                        startIcon={<EditIcon />}
                                                        color="warning"
                                                        onClick={() => handleOpenUpdateDates(booking)}
                                                    >
                                                        Update Dates
                                                    </Button>
                                                )}
                                                {/* Cancel: available if not expired */}
                                                <Button
                                                    size="small"
                                                    variant="outlined"
                                                    startIcon={<RejectIcon />}
                                                    color="error"
                                                    onClick={() => handleOpenCancel(booking)}
                                                >
                                                    Cancel
                                                </Button>
                                            </Box>
                                        ) : /* Rejected: show Re-request for Advertiser */
                                        booking.status === 'Rejected' && user?.role === 'Advertiser' ? (
                                            <Box display="flex" gap={1} justifyContent="flex-end">
                                                <Button
                                                    size="small"
                                                    variant="outlined"
                                                    startIcon={<EditIcon />}
                                                    color="warning"
                                                    onClick={() => handleOpenUpdateDates(booking)}
                                                >
                                                    Re-request
                                                </Button>
                                            </Box>
                                        ) : /* Expired/Terminal: show status label */
                                        (
                                            <Typography variant="body2" color="text.secondary">
                                                {isExpired(booking) && (booking.status === 'Pending' || booking.status === 'Approved') && (
                                                    <Chip label="Expired" size="small" color="default" />
                                                )}
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
            <Paper
                sx={{
                    p: { xs: 2, md: 3 },
                    mb: 3,
                    borderRadius: 3,
                    background:
                        'radial-gradient(900px 340px at 100% -8%, rgba(10,102,216,0.12), transparent 60%), #ffffff',
                }}
            >
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
            </Paper>
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

            {/* Active / History Tabs */}
            <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}>
                <Tabs value={activeTab} onChange={(_, v) => setActiveTab(v)}>
                    <Tab
                        label={
                            <Badge badgeContent={filteredBookings.filter(isActiveLifecycle).length} color="primary" max={999}>
                                <Box sx={{ pr: 2 }}>Active</Box>
                            </Badge>
                        }
                    />
                    <Tab
                        label={
                            <Badge badgeContent={filteredBookings.filter(isHistoryLifecycle).length} color="default" max={999}>
                                <Box sx={{ pr: 2 }}>History</Box>
                            </Badge>
                        }
                    />
                </Tabs>
            </Box>

            <Paper sx={{ borderRadius: 3 }}>
                <Box p={3}>
                    {activeTab === 0 && renderBookingsTable(
                        filteredBookings.filter(isActiveLifecycle),
                        user?.role === 'ScreenOwner' || user?.role === 'Advertiser'
                    )}
                    {activeTab === 1 && renderBookingsTable(
                        filteredBookings.filter(isHistoryLifecycle),
                        user?.role === 'Advertiser' // Advertiser can re-request rejected bookings
                    )}
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
            {/* Cancel Dialog */}
            <Dialog open={cancelDialogOpen} onClose={() => setCancelDialogOpen(false)}>
                <DialogTitle>Cancel Booking</DialogTitle>
                <DialogContent>
                    <Typography variant="body2" color="textSecondary" sx={{ mb: 2 }}>
                        Are you sure you want to cancel this booking? This will release the booked slots and unlock the creative.
                    </Typography>
                    {selectedBooking && (
                        <Box sx={{ mb: 2, p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
                            <Typography variant="body2"><strong>Campaign:</strong> {selectedBooking.campaignName}</Typography>
                            <Typography variant="body2"><strong>Screen:</strong> {selectedBooking.screenName}</Typography>
                            <Typography variant="body2"><strong>Period:</strong> {new Date(selectedBooking.startDate).toLocaleDateString()} - {new Date(selectedBooking.endDate).toLocaleDateString()}</Typography>
                        </Box>
                    )}
                    <TextField
                        fullWidth
                        multiline
                        rows={3}
                        label="Cancellation Reason (optional)"
                        value={cancelReason}
                        onChange={(e) => setCancelReason(e.target.value)}
                        placeholder="Enter reason for cancellation..."
                    />
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setCancelDialogOpen(false)}>Back</Button>
                    <Button
                        variant="contained"
                        color="error"
                        onClick={() =>
                            selectedBooking &&
                            cancelMutation.mutate({
                                bookingId: selectedBooking.id,
                                reason: cancelReason || undefined,
                            })
                        }
                        disabled={cancelMutation.isPending}
                    >
                        {cancelMutation.isPending ? 'Cancelling...' : 'Cancel Booking'}
                    </Button>
                </DialogActions>
            </Dialog>
            {/* Update Dates / Re-request Dialog */}
            <Dialog open={updateDatesDialogOpen} onClose={() => setUpdateDatesDialogOpen(false)}>
                <DialogTitle>
                    {selectedBooking?.status === 'Rejected' ? 'Re-request Booking' : 'Update Booking Dates'}
                </DialogTitle>
                <DialogContent>
                    <Typography variant="body2" color="textSecondary" sx={{ mb: 2 }}>
                        {selectedBooking?.status === 'Rejected'
                            ? 'Update the dates and resubmit this booking for approval. The screen owner will review the new request.'
                            : 'The original start date has passed. Update the dates to resubmit for approval.'}
                    </Typography>
                    {selectedBooking && (
                        <Box sx={{ mb: 2, p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
                            <Typography variant="body2"><strong>Campaign:</strong> {selectedBooking.campaignName}</Typography>
                            <Typography variant="body2"><strong>Screen:</strong> {selectedBooking.screenName}</Typography>
                            <Typography variant="body2"><strong>Original Period:</strong> {new Date(selectedBooking.startDate).toLocaleDateString()} - {new Date(selectedBooking.endDate).toLocaleDateString()}</Typography>
                            {selectedBooking.status === 'Rejected' && selectedBooking.dateBreakdown && (
                                <Typography variant="body2" color="error"><strong>Rejection reason available in booking details</strong></Typography>
                            )}
                        </Box>
                    )}
                    <Box sx={{ display: 'flex', gap: 2, mt: 2 }}>
                        <TextField
                            fullWidth
                            label="New Start Date"
                            type="date"
                            value={newStartDate}
                            onChange={(e) => setNewStartDate(e.target.value)}
                            InputLabelProps={{ shrink: true }}
                            inputProps={{
                                // eslint-disable-next-line react-hooks/purity -- intentional: "tomorrow" as the min selectable date
                                min: new Date(Date.now() + 86400000).toISOString().split('T')[0],
                            }}
                        />
                        <TextField
                            fullWidth
                            label="New End Date"
                            type="date"
                            value={newEndDate}
                            onChange={(e) => setNewEndDate(e.target.value)}
                            InputLabelProps={{ shrink: true }}
                            inputProps={{
                                // eslint-disable-next-line react-hooks/purity -- intentional: "tomorrow" as the fallback min selectable date
                                min: newStartDate || new Date(Date.now() + 86400000).toISOString().split('T')[0],
                            }}
                        />
                    </Box>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setUpdateDatesDialogOpen(false)}>Cancel</Button>
                    <Button
                        variant="contained"
                        color="primary"
                        onClick={() =>
                            selectedBooking &&
                            updateDatesMutation.mutate({
                                bookingId: selectedBooking.id,
                                startDate: newStartDate,
                                endDate: newEndDate,
                            })
                        }
                        disabled={updateDatesMutation.isPending || !newStartDate || !newEndDate || newEndDate < newStartDate}
                    >
                        {updateDatesMutation.isPending ? 'Updating...' : selectedBooking?.status === 'Rejected' ? 'Re-request Booking' : 'Update & Resubmit'}
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Payment Screen Dialog */}
            <PaymentScreen
                open={paymentDialogOpen}
                onClose={() => {
                    setPaymentDialogOpen(false);
                    setPaymentOrderDetails(null);
                    setPaymentBookingId('');
                }}
                orderDetails={paymentOrderDetails}
                bookingId={paymentBookingId}
                onPaymentConfirmed={() => {
                    setPaymentDialogOpen(false);
                    setPaymentOrderDetails(null);
                    setPaymentBookingId('');
                    queryClient.invalidateQueries({ queryKey: ['bookings'] });
                }}
            />
        </Container>
    );
}
