import { Box, Paper, Typography, Button, Chip, Avatar, Skeleton, Divider } from '@mui/material';
import { CheckCircle as ApproveIcon, Cancel as RejectIcon, CheckCircle } from '@mui/icons-material';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { api } from '../../services/api';
import { formatDistanceToNow } from 'date-fns';

interface PendingBooking {
    id: string;
    campaignName: string;
    screenName: string;
    creativeName: string;
    creativeFileUrl?: string;
    creativeMimeType?: string;
    startDate: string;
    endDate: string;
    totalPrice: number;
    currency: string;
    createdAt: string;
}

export default function OwnerApprovalQueue() {
    const navigate = useNavigate();

    const { data: bookings, isLoading } = useQuery<PendingBooking[]>({
        queryKey: ['pending-bookings'],
        queryFn: async () => {
            const response = await api.get<{ data: Array<PendingBooking & { status: string }> }>('/bookings');
            const allBookings = response.data?.data || [];
            // Filter only pending bookings
            return allBookings.filter((b) => b.status === 'Pending');
        },
    });

    if (isLoading) {
        return (
            <Paper sx={{ p: 3, height: '100%' }}>
                <Typography variant="h6" gutterBottom>Pending Approvals</Typography>
                <Skeleton variant="rectangular" height={80} sx={{ mb: 2, borderRadius: 1 }} />
                <Skeleton variant="rectangular" height={80} sx={{ mb: 2, borderRadius: 1 }} />
                <Skeleton variant="rectangular" height={80} sx={{ borderRadius: 1 }} />
            </Paper>
        );
    }

    const pendingCount = bookings?.length || 0;

    return (
        <Paper sx={{ p: 3, height: '100%' }}>
            <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                <Box display="flex" alignItems="center" gap={1}>
                    <Typography variant="h6">Pending Approvals</Typography>
                    {pendingCount > 0 && (
                        <Chip
                            label={pendingCount}
                            color="warning"
                            size="small"
                            sx={{ fontWeight: 'bold' }}
                        />
                    )}
                </Box>
                <Button size="small" onClick={() => navigate('/bookings')}>
                    View All
                </Button>
            </Box>

            {pendingCount === 0 ? (
                <Box
                    sx={{
                        textAlign: 'center',
                        py: 4,
                        bgcolor: 'success.lighter',
                        borderRadius: 2,
                    }}
                >
                    <CheckCircle sx={{ fontSize: 48, color: 'success.main', mb: 1 }} />
                    <Typography color="success.dark" fontWeight="medium">
                        All caught up!
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                        No pending booking requests
                    </Typography>
                </Box>
            ) : (
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    {bookings?.slice(0, 5).map((booking, index) => (
                        <Box key={booking.id}>
                            <Box
                                sx={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 2,
                                    p: 2,
                                    bgcolor: 'warning.lighter',
                                    borderRadius: 2,
                                    border: '1px solid',
                                    borderColor: 'warning.light',
                                    cursor: 'pointer',
                                    transition: 'all 0.2s',
                                    '&:hover': {
                                        bgcolor: 'warning.light',
                                        transform: 'translateX(4px)',
                                    },
                                }}
                                onClick={() => navigate(`/bookings/${booking.id}`)}
                            >
                                {booking.creativeFileUrl ? (
                                    (booking.creativeMimeType ?? '').startsWith('video') ? (
                                        <Box component="video" src={booking.creativeFileUrl} muted
                                            sx={{ width: 72, height: 44, objectFit: 'cover', borderRadius: 1, flexShrink: 0, bgcolor: 'black' }} />
                                    ) : (
                                        <Box component="img" src={booking.creativeFileUrl} alt=""
                                            sx={{ width: 72, height: 44, objectFit: 'cover', borderRadius: 1, flexShrink: 0 }} />
                                    )
                                ) : (
                                    <Avatar sx={{ bgcolor: 'warning.main' }}>
                                        {booking.campaignName.charAt(0)}
                                    </Avatar>
                                )}
                                <Box flex={1}>
                                    <Typography variant="subtitle2" fontWeight="bold">
                                        {booking.campaignName}
                                    </Typography>
                                    <Typography variant="body2" color="text.secondary">
                                        {booking.screenName} • {booking.currency} {booking.totalPrice.toLocaleString()}
                                    </Typography>
                                    <Typography variant="caption" color="text.secondary">
                                        Requested {formatDistanceToNow(new Date(booking.createdAt), { addSuffix: true })}
                                    </Typography>
                                </Box>
                                <Box display="flex" gap={1}>
                                    <Button
                                        size="small"
                                        variant="contained"
                                        color="success"
                                        startIcon={<ApproveIcon />}
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            navigate(`/bookings?action=approve&id=${booking.id}`);
                                        }}
                                    >
                                        Approve
                                    </Button>
                                    <Button
                                        size="small"
                                        variant="outlined"
                                        color="error"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            navigate(`/bookings?action=reject&id=${booking.id}`);
                                        }}
                                    >
                                        <RejectIcon />
                                    </Button>
                                </Box>
                            </Box>
                            {index < (bookings?.length || 0) - 1 && index < 4 && <Divider sx={{ mt: 2 }} />}
                        </Box>
                    ))}
                </Box>
            )}
        </Paper>
    );
}
