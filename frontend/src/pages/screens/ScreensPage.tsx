import { useState } from 'react';
import {
    Box,
    Container,
    Typography,
    Button,
    Paper,
    Grid,
    TextField,
    InputAdornment,
    MenuItem,
    Select,
    FormControl,
    InputLabel,
} from '@mui/material';
import {
    Search as SearchIcon,
    Add as AddIcon,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../services/api';
import { useAuthStore } from '../../store/authStore';
import EnhancedScreenCard from '../../components/screens/EnhancedScreenCard';
import { CardSkeleton } from '../../components/common/LoadingSkeletons';
import EmptyState from '../../components/common/EmptyState';

interface Screen {
    id: string;
    name: string;
    description: string;
    status: string;
    resolutionWidth: number;
    resolutionHeight: number;
    pricePerSlot: number;
    currency: string;
    location: {
        city: string;
        state: string;
        country: string;
    };
    slotsPerFrame: number;
    timeFrameMinutes: number;
    isOnline: boolean;
    lastSeenAt?: string;
    totalSlots: number;
    bookedSlots?: number;  // Added: number of booked slots
    activeBookings?: number;  // Added: number of active bookings
    revenueEstimate?: {
        daily?: { [key: string]: number };
    };
}

export default function ScreensPage() {
    const navigate = useNavigate();
    const user = useAuthStore((state) => state.user);
    const isAdvertiser = user?.role === 'Advertiser';
    const isScreenOwner = user?.role === 'ScreenOwner';
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');

    // Fetch screens
    const { data: screens, isLoading } = useQuery<Screen[]>({
        queryKey: ['screens'],
        queryFn: async () => {
            const response = await api.get('/screens');
            // API returns ApiResponse<IEnumerable<ScreenDto>> with .data property
            const data = response.data?.data;
            // Ensure we always return an array
            return Array.isArray(data) ? data : [];
        },
    });

    const filteredScreens = screens?.filter((screen) => {
        const matchesSearch =
            screen.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            screen.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
            screen.location.city.toLowerCase().includes(searchQuery.toLowerCase());

        const matchesStatus = statusFilter === 'all' || screen.status === statusFilter;

        return matchesSearch && matchesStatus;
    });

    if (isLoading) {
        return (
            <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
                <Box mb={3}>
                    <Typography variant="h4" gutterBottom>
                        {isScreenOwner ? 'My Screens' : 'Available Screens'}
                    </Typography>
                </Box>
                <CardSkeleton count={6} />
            </Container>
        );
    }

    return (
        <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
            {/* Header */}
            <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
                <Box>
                    <Typography variant="h4" gutterBottom>
                        {isScreenOwner ? 'My Screens' : isAdvertiser ? 'Screen Marketplace' : 'All Screens'}
                    </Typography>
                    <Typography variant="body1" color="textSecondary">
                        {isAdvertiser
                            ? 'Discover screens and book slots for your campaigns'
                            : isScreenOwner
                                ? 'Manage your digital signage screens and track performance'
                                : 'View and manage all screens on the platform'}
                    </Typography>
                </Box>
                {isScreenOwner && (
                    <Button
                        variant="contained"
                        startIcon={<AddIcon />}
                        onClick={() => navigate('/screens/new')}
                    >
                        Add New Screen
                    </Button>
                )}
            </Box>

            {/* Filters */}
            <Paper sx={{ p: 2, mb: 3 }}>
                <Grid container spacing={2}>
                    <Grid size={{ xs: 12, md: 8 }}>
                        <TextField
                            fullWidth
                            placeholder="Search by name, location, or description..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            InputProps={{
                                startAdornment: (
                                    <InputAdornment position="start">
                                        <SearchIcon />
                                    </InputAdornment>
                                ),
                            }}
                        />
                    </Grid>
                    <Grid size={{ xs: 12, md: 4 }}>
                        <FormControl fullWidth>
                            <InputLabel>Status</InputLabel>
                            <Select
                                value={statusFilter}
                                label="Status"
                                onChange={(e) => setStatusFilter(e.target.value)}
                            >
                                <MenuItem value="all">All Statuses</MenuItem>
                                <MenuItem value="Active">Active</MenuItem>
                                <MenuItem value="Inactive">Inactive</MenuItem>
                                <MenuItem value="Maintenance">Maintenance</MenuItem>
                            </Select>
                        </FormControl>
                    </Grid>
                </Grid>
            </Paper>

            {/* Screens Grid */}
            {!filteredScreens || filteredScreens.length === 0 ? (
                <EmptyState
                    title="No screens found"
                    message={
                        searchQuery || statusFilter !== 'all'
                            ? 'Try adjusting your filters'
                            : isScreenOwner
                                ? 'Add your first screen to start accepting bookings'
                                : 'No screens are currently available'
                    }
                    action={
                        isScreenOwner
                            ? {
                                label: 'Add Screen',
                                onClick: () => navigate('/screens/new'),
                            }
                            : searchQuery || statusFilter !== 'all'
                                ? {
                                    label: 'Clear Filters',
                                    onClick: () => {
                                        setSearchQuery('');
                                        setStatusFilter('all');
                                    },
                                }
                                : undefined
                    }
                />
            ) : (
                <Grid container spacing={3}>
                    {filteredScreens.map((screen) => (
                        <Grid key={screen.id} size={{ xs: 12, sm: 6, md: 4 }}>
                            <EnhancedScreenCard
                                screen={{
                                    id: screen.id,
                                    name: screen.name,
                                    location: `${screen.location.city}, ${screen.location.state}`,
                                    city: screen.location.city,
                                    totalSlots: screen.slotsPerFrame,
                                    bookedSlots: screen.bookedSlots || 0,  // Use real data from backend
                                    revenue: screen.revenueEstimate?.daily?.[new Date().toISOString().split('T')[0]] || 0,
                                    currency: screen.currency,
                                    activeBookings: screen.activeBookings || 0,  // Use real data from backend
                                }}
                                onClick={() => navigate(`/screens/${screen.id}`)}
                            />
                        </Grid>
                    ))}
                </Grid>
            )}
        </Container>
    );
}
