import { useState } from 'react';
import {
    Box,
    Container,
    Typography,
    Paper,
    Grid,
    Button,
    Chip,
    Card,
    CardContent,
    Tabs,
    Tab,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    LinearProgress,
    Divider,
} from '@mui/material';
import {
    Edit as EditIcon,
    Delete as DeleteIcon,
    Add as AddIcon,
    Image as CreativeIcon,
    Visibility as ViewIcon,
    Assessment as ReportIcon,
} from '@mui/icons-material';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSnackbar } from 'notistack';
import { api } from '../../services/api';
import LivePreviewWidget from '../../components/common/LivePreviewWidget';
import CampaignScreenStats from '../../components/campaigns/CampaignScreenStats';

interface Campaign {
    id: string;
    name: string;
    description: string;
    status: string;
    budget: number;
    currency: string;
    startDate: string;
    endDate: string;
    createdAt: string;
}

interface Creative {
    id: string;
    name: string;
    type: string;
    fileUrl: string;
    durationSeconds: number;
    status: string;
}

interface Booking {
    id: string;
    screenName: string;
    creativeName?: string;
    status: string;
    startDate: string;
    endDate: string;
    createdAt?: string;
    totalPrice: number;
    currency: string;
}

export default function CampaignDetailPage() {
    const { id } = useParams();
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const { enqueueSnackbar } = useSnackbar();
    const [tabValue, setTabValue] = useState(0);

    // Fetch campaign details
    const { data: campaign, isLoading: campaignLoading } = useQuery<Campaign>({
        queryKey: ['campaign', id],
        queryFn: async () => {
            const response = await api.get(`/campaigns/${id}`);
            return response.data.data; // ApiResponse wrapper
        },
    });

    // Fetch campaign creatives
    const { data: creatives, isLoading: creativesLoading } = useQuery<Creative[]>({
        queryKey: ['creatives', id],
        queryFn: async () => {
            const response = await api.get(`/campaigns/${id}/creatives`);
            return response.data.data; // ApiResponse wrapper
        },
    });

    // Fetch campaign bookings
    const { data: bookings, isLoading: bookingsLoading } = useQuery<Booking[]>({
        queryKey: ['campaign-bookings', id],
        queryFn: async () => {
            const response = await api.get(`/campaigns/${id}/bookings`);
            return response.data.data; // ApiResponse wrapper
        },
    });

    // Delete campaign mutation
    const deleteMutation = useMutation({
        mutationFn: async () => {
            await api.delete(`/campaigns/${id}`);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['campaigns'] });
            enqueueSnackbar('Campaign deleted successfully', { variant: 'success' });
            navigate('/campaigns');
        },
        onError: () => {
            enqueueSnackbar('Failed to delete campaign', { variant: 'error' });
        },
    });

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'Active':
                return 'success';
            case 'Completed':
                return 'default';
            case 'Draft':
                return 'warning';
            default:
                return 'default';
        }
    };

    if (campaignLoading) {
        return (
            <Container maxWidth="lg" sx={{ mt: 4 }}>
                <LinearProgress />
            </Container>
        );
    }

    if (!campaign) {
        return (
            <Container maxWidth="lg" sx={{ mt: 4 }}>
                <Typography>Campaign not found</Typography>
            </Container>
        );
    }

    return (
        <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
            {/* Header */}
            <Box display="flex" justifyContent="space-between" alignItems="start" mb={3}>
                <Box>
                    <Typography variant="h4" gutterBottom>
                        {campaign.name}
                    </Typography>
                    <Box display="flex" gap={1} alignItems="center">
                        <Chip label={campaign.status} color={getStatusColor(campaign.status) as any} />
                        <Typography variant="body2" color="textSecondary">
                            Created on {new Date(campaign.createdAt).toLocaleDateString()}
                        </Typography>
                    </Box>
                </Box>
                <Box display="flex" gap={1}>
                    <Button
                        variant="contained"
                        startIcon={<ReportIcon />}
                        onClick={() => navigate(`/reports/campaigns/${id}`)}
                    >
                        View Report
                    </Button>
                    <Button
                        variant="outlined"
                        startIcon={<EditIcon />}
                        onClick={() => navigate(`/campaigns/${id}/edit`)}
                    >
                        Edit
                    </Button>
                    <Button
                        variant="outlined"
                        color="error"
                        startIcon={<DeleteIcon />}
                        onClick={() => deleteMutation.mutate()}
                        disabled={deleteMutation.isPending}
                    >
                        Delete
                    </Button>
                </Box>
            </Box>
            {/* Campaign Info */}
            <Grid container spacing={3} mb={3}>
                <Grid
                    size={{
                        xs: 12,
                        md: 4
                    }}>
                    <Card>
                        <CardContent>
                            <Typography color="textSecondary" gutterBottom>
                                Budget
                            </Typography>
                            <Typography variant="h5">
                                {campaign.currency} {campaign.budget.toLocaleString()}
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
                                {new Date(campaign.startDate).toLocaleDateString()}
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
                                {new Date(campaign.endDate).toLocaleDateString()}
                            </Typography>
                        </CardContent>
                    </Card>
                </Grid>
            </Grid>
            {/* Description */}
            <Paper sx={{ p: 3, mb: 3 }}>
                <Typography variant="h6" gutterBottom>
                    Description
                </Typography>
                <Typography color="textSecondary">{campaign.description}</Typography>
            </Paper>
            {/* Tabs */}
            <Paper sx={{ mb: 3 }}>
                <Tabs value={tabValue} onChange={(_, newValue) => setTabValue(newValue)}>
                    <Tab label="Creatives" />
                    <Tab label="Bookings" />
                    <Tab label="Live Activity" />
                </Tabs>
                <Divider />

                {/* Creatives Tab */}
                {tabValue === 0 && (
                    <Box p={3}>
                        <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                            <Typography variant="h6">Campaign Creatives</Typography>
                            <Button
                                variant="contained"
                                startIcon={<AddIcon />}
                                onClick={() => navigate(`/campaigns/${id}/creatives/new`)}
                            >
                                Upload Creative
                            </Button>
                        </Box>
                        {creativesLoading ? (
                            <LinearProgress />
                        ) : creatives && creatives.length > 0 ? (
                            <Grid container spacing={2}>
                                {creatives.map((creative) => (
                                    <Grid
                                        key={creative.id}
                                        size={{
                                            xs: 12,
                                            sm: 6,
                                            md: 4
                                        }}>
                                        <Card>
                                            <Box
                                                sx={{
                                                    height: 200,
                                                    bgcolor: 'grey.200',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    overflow: 'hidden',
                                                    position: 'relative',
                                                }}
                                            >
                                                {creative.mimeType?.startsWith('image/') ? (
                                                    <img
                                                        src={creative.fileUrl}
                                                        alt={creative.name}
                                                        style={{
                                                            width: '100%',
                                                            height: '100%',
                                                            objectFit: 'cover',
                                                        }}
                                                    />
                                                ) : creative.mimeType?.startsWith('video/') ? (
                                                    <video
                                                        src={creative.fileUrl}
                                                        style={{
                                                            width: '100%',
                                                            height: '100%',
                                                            objectFit: 'cover',
                                                        }}
                                                    />
                                                ) : (
                                                    <CreativeIcon sx={{ fontSize: 60, color: 'grey.400' }} />
                                                )}
                                            </Box>
                                            <CardContent>
                                                <Typography variant="subtitle1" gutterBottom noWrap>
                                                    {creative.name}
                                                </Typography>
                                                <Typography variant="body2" color="textSecondary">
                                                    {creative.mimeType} • {creative.duration}s
                                                </Typography>
                                                <Typography variant="caption" color="textSecondary" display="block">
                                                    {(creative.fileSize / 1024 / 1024).toFixed(2)} MB
                                                </Typography>
                                            </CardContent>
                                        </Card>
                                    </Grid>
                                ))}
                            </Grid>
                        ) : (
                            <Box textAlign="center" py={4}>
                                <Typography color="textSecondary" gutterBottom>
                                    No creatives uploaded yet
                                </Typography>
                                <Button
                                    variant="contained"
                                    startIcon={<AddIcon />}
                                    onClick={() => navigate(`/campaigns/${id}/creatives/new`)}
                                    sx={{ mt: 2 }}
                                >
                                    Upload First Creative
                                </Button>
                            </Box>
                        )}
                    </Box>
                )}

                {/* Bookings Tab */}
                {tabValue === 1 && (
                    <Box p={3}>
                        <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                            <Typography variant="h6">Campaign Bookings</Typography>
                            <Button
                                variant="contained"
                                startIcon={<AddIcon />}
                                onClick={() => navigate(`/bookings/new?campaignId=${id}`)}
                            >
                                New Booking
                            </Button>
                        </Box>
                        {bookingsLoading ? (
                            <LinearProgress />
                        ) : bookings && bookings.length > 0 ? (
                            <TableContainer>
                                <Table>
                                    <TableHead>
                                        <TableRow>
                                            <TableCell>Screen</TableCell>
                                            <TableCell>Creative</TableCell>
                                            <TableCell>Status</TableCell>
                                            <TableCell>Plays Today</TableCell>
                                            <TableCell>Period</TableCell>
                                            <TableCell>Last Played</TableCell>
                                            <TableCell>Price</TableCell>
                                            <TableCell align="right">Actions</TableCell>
                                        </TableRow>
                                    </TableHead>
                                    <TableBody>
                                        {bookings.map((booking) => (
                                            <TableRow key={booking.id}>
                                                <TableCell>{booking.screenName}</TableCell>
                                                <TableCell>{booking.creativeName || 'N/A'}</TableCell>
                                                <TableCell>
                                                    <Chip
                                                        label={booking.status}
                                                        size="small"
                                                        color={
                                                            booking.status === 'Approved' ? 'success' :
                                                                booking.status === 'Rejected' ? 'error' :
                                                                    booking.status === 'Pending' ? 'warning' :
                                                                        'default'
                                                        }
                                                    />
                                                </TableCell>
                                                <TableCell>
                                                    <Box display="flex" alignItems="center" gap={0.5}>
                                                        <Typography variant="body2" fontWeight="bold" color="primary">
                                                            {(booking as any).playsToday || 0}
                                                        </Typography>
                                                        {(booking as any).isLive && (
                                                            <Chip label="LIVE" size="small" color="success" sx={{ height: 20, fontSize: '0.7rem' }} />
                                                        )}
                                                    </Box>
                                                </TableCell>
                                                <TableCell>
                                                    {new Date(booking.startDate).toLocaleDateString()} -{' '}
                                                    {new Date(booking.endDate).toLocaleDateString()}
                                                </TableCell>
                                                <TableCell>
                                                    {(booking as any).lastPlayed
                                                        ? new Date((booking as any).lastPlayed).toLocaleTimeString()
                                                        : '-'
                                                    }
                                                </TableCell>
                                                <TableCell>
                                                    {booking.currency} {booking.totalPrice.toLocaleString()}
                                                </TableCell>
                                                <TableCell align="right">
                                                    <Button
                                                        size="small"
                                                        startIcon={<ViewIcon />}
                                                        onClick={() => navigate(`/bookings/${booking.id}`)}
                                                    >
                                                        View
                                                    </Button>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </TableContainer>
                        ) : (
                            <Box textAlign="center" py={4}>
                                <Typography color="textSecondary" gutterBottom>
                                    No bookings for this campaign yet
                                </Typography>
                                <Button
                                    variant="contained"
                                    startIcon={<AddIcon />}
                                    onClick={() => navigate(`/bookings/new?campaignId=${id}`)}
                                    sx={{ mt: 2 }}
                                >
                                    Create First Booking
                                </Button>
                            </Box>
                        )}
                    </Box>
                )}

                {/* Live Activity Tab */}
                {tabValue === 2 && (
                    <Box p={3}>
                        <Typography variant="h6" gutterBottom>
                            Real-Time Campaign Activity
                        </Typography>
                        <Typography variant="body2" color="textSecondary" paragraph>
                            Monitor live playback of your campaign across all booked screens
                        </Typography>

                        {/* Screen-level breakdown */}
                        <CampaignScreenStats campaignId={id!} />

                        {/* Original live preview widget */}
                        <Box mt={3}>
                            <LivePreviewWidget campaignId={id!} mode="campaign" />
                        </Box>
                    </Box>
                )}
            </Paper>
        </Container>
    );
}
