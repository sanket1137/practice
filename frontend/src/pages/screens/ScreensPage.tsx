import { useState } from 'react';
import {
    Box,
    Container,
    Typography,
    Button,
    Paper,
    Grid,
    Card,
    CardContent,
    CardActions,
    CardMedia,
    Chip,
    TextField,
    InputAdornment,
    MenuItem,
    Select,
    FormControl,
    InputLabel,
    LinearProgress,
} from '@mui/material';
import {
    Search as SearchIcon,
    LocationOn as LocationIcon,
    Tv as TvIcon,
    AttachMoney as MoneyIcon,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../services/api';
import { useAuthStore } from '../../store/authStore';

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
}

export default function ScreensPage() {
    const navigate = useNavigate();
    const user = useAuthStore((state) => state.user);
    const isAdvertiser = user?.role === 'Advertiser';
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');

    // Fetch screens
    const { data: screens, isLoading } = useQuery<Screen[]>({
        queryKey: ['screens'],
        queryFn: async () => {
            const response = await api.get('/screens');
            return response.data.data; // ApiResponse wrapper
        },
    });

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'Active':
                return 'success';
            case 'Inactive':
                return 'error';
            case 'Maintenance':
                return 'warning';
            default:
                return 'default';
        }
    };

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
            <Container maxWidth="lg" sx={{ mt: 4 }}>
                <LinearProgress />
            </Container>
        );
    }

    return (
        <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
            {/* Header */}
            <Box mb={3}>
                <Typography variant="h4" gutterBottom>
                    Available Screens
                </Typography>
                <Typography variant="body1" color="textSecondary">
                    Browse and book digital signage screens for your campaigns
                </Typography>
            </Box>

            {/* Filters */}
            <Paper sx={{ p: 2, mb: 3 }}>
                <Grid container spacing={2}>
                    <Grid item xs={12} md={8}>
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
                    <Grid item xs={12} md={4}>
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
            {filteredScreens && filteredScreens.length > 0 ? (
                <Grid container spacing={3}>
                    {filteredScreens.map((screen) => (
                        <Grid item xs={12} sm={6} md={4} key={screen.id}>
                            <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                                <CardMedia
                                    component="div"
                                    sx={{
                                        height: 200,
                                        bgcolor: 'grey.200',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                    }}
                                >
                                    <TvIcon sx={{ fontSize: 80, color: 'grey.400' }} />
                                </CardMedia>
                                <CardContent sx={{ flexGrow: 1 }}>
                                    <Box display="flex" justifyContent="space-between" alignItems="start" mb={1}>
                                        <Typography variant="h6" component="div">
                                            {screen.name}
                                        </Typography>
                                        <Chip
                                            label={screen.status}
                                            color={getStatusColor(screen.status) as any}
                                            size="small"
                                        />
                                    </Box>

                                    {/* Online Status */}
                                    <Box display="flex" alignItems="center" gap={0.5} mb={1}>
                                        <Box
                                            sx={{
                                                width: 8,
                                                height: 8,
                                                borderRadius: '50%',
                                                bgcolor: screen.isOnline ? 'success.main' : 'grey.400',
                                            }}
                                        />
                                        <Typography variant="caption" color="textSecondary">
                                            {screen.isOnline ? 'Online' : screen.lastSeenAt
                                                ? `Offline (last seen ${new Date(screen.lastSeenAt).toLocaleString()})`
                                                : 'Never connected'}
                                        </Typography>
                                    </Box>

                                    <Typography variant="body2" color="textSecondary" paragraph>
                                        {screen.description.substring(0, 100)}
                                        {screen.description.length > 100 ? '...' : ''}
                                    </Typography>

                                    <Box display="flex" alignItems="center" gap={0.5} mb={1}>
                                        <LocationIcon fontSize="small" color="action" />
                                        <Typography variant="body2" color="textSecondary">
                                            {screen.location.city}, {screen.location.state}
                                        </Typography>
                                    </Box>

                                    <Box display="flex" alignItems="center" gap={0.5} mb={1}>
                                        <TvIcon fontSize="small" color="action" />
                                        <Typography variant="body2" color="textSecondary">
                                            {screen.resolutionWidth} x {screen.resolutionHeight}
                                        </Typography>
                                    </Box>

                                    <Box display="flex" alignItems="center" gap={0.5} mb={2}>
                                        <MoneyIcon fontSize="small" color="action" />
                                        <Typography variant="body2" color="textSecondary">
                                            {screen.currency} {screen.pricePerSlot.toLocaleString()} per slot
                                        </Typography>
                                    </Box>

                                    <Box>
                                        <Typography variant="caption" color="textSecondary">
                                            {screen.slotsPerFrame} slots per {screen.timeFrameMinutes} minutes
                                        </Typography>
                                    </Box>
                                </CardContent>
                                <CardActions>
                                    <Button
                                        size="small"
                                        onClick={() => navigate(`/screens/${screen.id}`)}
                                    >
                                        View Details
                                    </Button>
                                    {isAdvertiser && (
                                        <Button
                                            size="small"
                                            variant="contained"
                                            onClick={() => navigate(`/bookings/new?screenId=${screen.id}`)}
                                            disabled={screen.status !== 'Active'}
                                        >
                                            Book Now
                                        </Button>
                                    )}
                                </CardActions>
                            </Card>
                        </Grid>
                    ))}
                </Grid>
            ) : (
                <Paper sx={{ p: 4, textAlign: 'center' }}>
                    <Typography color="textSecondary" gutterBottom>
                        No screens found matching your criteria
                    </Typography>
                    <Button
                        variant="outlined"
                        sx={{ mt: 2 }}
                        onClick={() => {
                            setSearchQuery('');
                            setStatusFilter('all');
                        }}
                    >
                        Clear Filters
                    </Button>
                </Paper>
            )}
        </Container>
    );
}
