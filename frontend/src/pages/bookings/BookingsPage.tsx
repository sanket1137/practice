import { useState } from 'react';
import {
    Box,
    Container,
    Typography,
    Paper,
    Tabs,
    Tab,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Chip,
    Button,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    TextField,
    LinearProgress,
    Card,
    CardMedia,
    CardContent,
    Grid,
} from '@mui/material';
import {
    CheckCircle as ApproveIcon,
    Cancel as RejectIcon,
    Visibility as ViewIcon,
} from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSnackbar } from 'notistack';
import { api } from '../../services/api';
import { useAuthStore } from '../../store/authStore';

interface Booking {
    id: string;
    campaignName: string;
    screenName: string;
    creativeName: string;
    creativeFileUrl: string;
    creativeMimeType: string;
    status: string;
    startDate: string;
    endDate: string;
    totalPrice: number;
    currency: string;
    createdAt: string;
    expectedImpressions: number;
}

export default function BookingsPage() {
    const { user } = useAuthStore();
    const queryClient = useQueryClient();
    const { enqueueSnackbar } = useSnackbar();
    const [tabValue, setTabValue] = useState(0);
    const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
    const [approveDialogOpen, setApproveDialogOpen] = useState(false);
    const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
    const [rejectNote, setRejectNote] = useState('');

    // Fetch bookings
    const { data: bookings, isLoading } = useQuery<Booking[]>({
        queryKey: ['bookings'],
        queryFn: async () => {
            const response = await api.get('/bookings');
            // Handle both ApiResponse wrapper and direct array
            if (response.data?.data) {
                return response.data.data;
            }
            // Direct array response
            return response.data || [];
        },
    });

    // Filter bookings by status
    const pendingBookings = bookings?.filter(b => b.status === 'Pending') || [];
    const approvedBookings = bookings?.filter(b => b.status === 'Approved') || [];
    const rejectedBookings = bookings?.filter(b => b.status === 'Rejected') || [];

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
        mutationFn: async ({ bookingId, note }: { bookingId: string, note: string }) => {
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

    const renderBookingsTable = (bookingsList: Booking[], showActions: boolean = false) => (
        <TableContainer>
            <Table>
                <TableHead>
                    <TableRow>
                        <TableCell>Campaign</TableCell>
                        <TableCell>Screen</TableCell>
                        <TableCell>Creative</TableCell>
                        <TableCell>Period</TableCell>
                        <TableCell>Created</TableCell>
                        <TableCell>Impressions</TableCell>
                        <TableCell>Price</TableCell>
                        <TableCell>Status</TableCell>
                        {showActions && <TableCell align="right">Actions</TableCell>}
                    </TableRow>
                </TableHead>
                <TableBody>
                    {bookingsList.length === 0 ? (
                        <TableRow>
                            <TableCell colSpan={showActions ? 9 : 8} align="center">
                                <Typography color="textSecondary">No bookings found</Typography>
                            </TableCell>
                        </TableRow>
                    ) : (
                        bookingsList.map((booking) => (
                            <TableRow key={booking.id}>
                                <TableCell>{booking.campaignName}</TableCell>
                                <TableCell>{booking.screenName}</TableCell>
                                <TableCell>{booking.creativeName}</TableCell>
                                <TableCell>
                                    {new Date(booking.startDate).toLocaleDateString()} -{' '}
                                    {new Date(booking.endDate).toLocaleDateString()}
                                </TableCell>
                                <TableCell>
                                    {new Date(booking.createdAt).toLocaleDateString()}
                                </TableCell>
                                <TableCell>{booking.expectedImpressions.toLocaleString()}</TableCell>
                                <TableCell>
                                    {booking.currency} {booking.totalPrice.toLocaleString()}
                                </TableCell>
                                <TableCell>
                                    <Chip
                                        label={booking.status}
                                        size="small"
                                        color={
                                            booking.status === 'Approved' ? 'success' :
                                                booking.status === 'Rejected' ? 'error' :
                                                    'warning'
                                        }
                                    />
                                </TableCell>
                                {showActions && (
                                    <TableCell align="right">
                                        <Button
                                            size="small"
                                            startIcon={<ApproveIcon />}
                                            color="success"
                                            onClick={() => handleOpenApprove(booking)}
                                            sx={{ mr: 1 }}
                                        >
                                            Approve
                                        </Button>
                                        <Button
                                            size="small"
                                            startIcon={<RejectIcon />}
                                            color="error"
                                            onClick={() => handleOpenReject(booking)}
                                        >
                                            Reject
                                        </Button>
                                    </TableCell>
                                )}
                            </TableRow>
                        ))
                    )}
                </TableBody>
            </Table>
        </TableContainer>
    );

    if (isLoading) {
        return (
            <Container maxWidth="xl" sx={{ mt: 4 }}>
                <LinearProgress />
            </Container>
        );
    }

    return (
        <Container maxWidth="xl" sx={{ mt: 4, mb: 4 }}>
            <Box mb={3}>
                <Typography variant="h4" gutterBottom>
                    Booking Management
                </Typography>
                <Typography variant="body1" color="textSecondary">
                    {user?.role === 'ScreenOwner'
                        ? 'Review and approve booking requests for your screens'
                        : 'View and manage your bookings'}
                </Typography>
            </Box>

            <Paper>
                <Tabs value={tabValue} onChange={(_, newValue) => setTabValue(newValue)}>
                    <Tab label={`Pending (${pendingBookings.length})`} />
                    <Tab label={`Approved (${approvedBookings.length})`} />
                    <Tab label={`Rejected (${rejectedBookings.length})`} />
                </Tabs>

                <Box p={3}>
                    {tabValue === 0 && renderBookingsTable(pendingBookings, user?.role === 'ScreenOwner')}
                    {tabValue === 1 && renderBookingsTable(approvedBookings)}
                    {tabValue === 2 && renderBookingsTable(rejectedBookings)}
                </Box>
            </Paper>

            {/* Approve Dialog */}
            <Dialog open={approveDialogOpen} onClose={() => setApproveDialogOpen(false)} maxWidth="md" fullWidth>
                <DialogTitle>Approve Booking Request</DialogTitle>
                <DialogContent>
                    {selectedBooking && (
                        <Grid container spacing={3} sx={{ mt: 1 }}>
                            <Grid item xs={12} md={6}>
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
                            <Grid item xs={12} md={6}>
                                <Typography variant="h6" gutterBottom>Booking Details</Typography>
                                <Box sx={{ '& > *': { mb: 2 } }}>
                                    <div>
                                        <Typography variant="body2" color="textSecondary">Campaign</Typography>
                                        <Typography variant="body1">{selectedBooking.campaignName}</Typography>
                                    </div>
                                    <div>
                                        <Typography variant="body2" color="textSecondary">Screen</Typography>
                                        <Typography variant="body1">{selectedBooking.screenName}</Typography>
                                    </div>
                                    <div>
                                        <Typography variant="body2" color="textSecondary">Period</Typography>
                                        <Typography variant="body1">
                                            {new Date(selectedBooking.startDate).toLocaleDateString()} - {new Date(selectedBooking.endDate).toLocaleDateString()}
                                        </Typography>
                                    </div>
                                    <div>
                                        <Typography variant="body2" color="textSecondary">Expected Impressions</Typography>
                                        <Typography variant="body1">{selectedBooking.expectedImpressions.toLocaleString()}</Typography>
                                    </div>
                                    <div>
                                        <Typography variant="body2" color="textSecondary">Total Price</Typography>
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
                        onClick={() => selectedBooking && rejectMutation.mutate({
                            bookingId: selectedBooking.id,
                            note: rejectNote
                        })}
                        disabled={rejectMutation.isPending || !rejectNote.trim()}
                    >
                        {rejectMutation.isPending ? 'Rejecting...' : 'Reject Booking'}
                    </Button>
                </DialogActions>
            </Dialog>
        </Container>
    );
}
