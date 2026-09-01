import { useEffect, useState } from 'react';
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
    ToggleButton,
    ToggleButtonGroup,
    Tooltip,
    IconButton,
    List,
    ListItemButton,
    ListItemIcon,
    ListItemText,
    Chip,
    Alert,
} from '@mui/material';
import {
    Search as SearchIcon,
    Add as AddIcon,
    Map as MapIcon,
    ViewList as ViewListIcon,
    Fullscreen as FullscreenIcon,
    FullscreenExit as FullscreenExitIcon,
    Monitor as MonitorIcon,
    Circle as CircleIcon,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { websocketService } from '../../services/websocket';
import { api } from '../../services/api';
import { useAuthStore } from '../../store/authStore';
import { useAccountVisibility } from '../../hooks/useAccountVisibility';
import EnhancedScreenCard from '../../components/screens/EnhancedScreenCard';
import { CardSkeleton } from '../../components/common/LoadingSkeletons';
import EmptyState from '../../components/common/EmptyState';
import { ScreensMap } from '../../components/map';

const SIDEBAR_WIDTH = 380;

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
    latitude?: number;
    longitude?: number;
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
    primaryTags?: Array<{ displayName: string }>;
}

export default function ScreensPage() {
    const navigate = useNavigate();
    const user = useAuthStore((state) => state.user);
    const isAdvertiser = user?.role === 'Advertiser';
    const isScreenOwner = user?.role === 'ScreenOwner';
    const { isPrivate } = useAccountVisibility();
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');
    const [viewMode, setViewMode] = useState<'list' | 'map'>('list');
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [selectedScreenId, setSelectedScreenId] = useState<string | null>(null);

    // Fetch screens
    const queryClient = useQueryClient();
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

    // Live online/offline + lifecycle updates. ScreenStatusChanged fires on
    // heartbeat transitions (player came online / went offline) and
    // ScreenLifecycleChanged when the owner changes Active/Inactive/Maintenance —
    // both patch the cached list in place, no refresh required.
    useEffect(() => {
        const handleStatusChanged = (data: { screenId: string; isOnline: boolean }) => {
            queryClient.setQueryData<Screen[]>(['screens'], prev =>
                prev?.map(s => (s.id === data.screenId ? { ...s, isOnline: data.isOnline } : s))
            );
        };
        const handleLifecycleChanged = (data: { screenId: string; status: string }) => {
            queryClient.setQueryData<Screen[]>(['screens'], prev =>
                prev?.map(s => (s.id === data.screenId ? { ...s, status: data.status } : s))
            );
        };

        websocketService.on('ScreenStatusChanged', handleStatusChanged);
        websocketService.on('ScreenLifecycleChanged', handleLifecycleChanged);
        websocketService.connect().catch(() => { /* page still works via REST */ });

        return () => {
            websocketService.off('ScreenStatusChanged', handleStatusChanged);
            websocketService.off('ScreenLifecycleChanged', handleLifecycleChanged);
        };
    }, [queryClient]);

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

    // Map view - fills entire content area with sidebar containing all controls
    if (viewMode === 'map') {
        return (
            <Box
                sx={{
                    position: isFullscreen ? 'fixed' : 'relative',
                    top: isFullscreen ? 0 : 'auto',
                    left: isFullscreen ? 0 : 'auto',
                    right: isFullscreen ? 0 : 'auto',
                    bottom: isFullscreen ? 0 : 'auto',
                    zIndex: isFullscreen ? 1300 : 'auto',
                    height: isFullscreen ? '100vh' : 'calc(100vh - 64px)',
                    minHeight: 500,
                    display: 'flex',
                    bgcolor: 'background.default',
                }}
            >
                {/* Sidebar with all controls and screen list */}
                <Paper
                    sx={{
                        width: SIDEBAR_WIDTH,
                        flexShrink: 0,
                        display: 'flex',
                        flexDirection: 'column',
                        borderRadius: 0,
                        overflow: 'hidden',
                        zIndex: 1,
                    }}
                >
                    {/* Header with Title and Add Button */}
                    <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
                            <Box>
                                <Typography variant="h6" fontWeight={600}>
                                    {isScreenOwner ? 'My Screens' : 'Screens'}
                                </Typography>
                                <Typography variant="caption" color="text.secondary">
                                    {isScreenOwner 
                                        ? 'Manage your digital signage screens'
                                        : 'Browse available screens'}
                                </Typography>
                            </Box>
                            {isFullscreen && (
                                <IconButton size="small" onClick={() => setIsFullscreen(false)}>
                                    <FullscreenExitIcon />
                                </IconButton>
                            )}
                        </Box>
                        {isScreenOwner && (
                            <Button
                                fullWidth
                                variant="contained"
                                startIcon={<AddIcon />}
                                onClick={() => navigate('/screens/new')}
                                size="small"
                                sx={{ mt: 1 }}
                            >
                                Add New Screen
                            </Button>
                        )}
                    </Box>

                    {/* Search and Filters */}
                    <Box sx={{ p: 1.5, borderBottom: 1, borderColor: 'divider' }}>
                        <TextField
                            fullWidth
                            size="small"
                            placeholder="Search screens..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            InputProps={{
                                startAdornment: (
                                    <InputAdornment position="start">
                                        <SearchIcon fontSize="small" />
                                    </InputAdornment>
                                ),
                            }}
                            sx={{ mb: 1 }}
                        />
                        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                            <FormControl size="small" sx={{ flex: 1 }}>
                                <Select
                                    value={statusFilter}
                                    onChange={(e) => setStatusFilter(e.target.value)}
                                    displayEmpty
                                >
                                    <MenuItem value="all">All Statuses</MenuItem>
                                    <MenuItem value="Draft">Draft</MenuItem>
                                    <MenuItem value="PendingVerification">Pending Verification</MenuItem>
                                    <MenuItem value="Ready">Ready</MenuItem>
                                    <MenuItem value="Active">Active</MenuItem>
                                    <MenuItem value="Paused">Paused</MenuItem>
                                    <MenuItem value="Maintenance">Maintenance</MenuItem>
                                    <MenuItem value="Archived">Archived</MenuItem>
                                </Select>
                            </FormControl>
                            <ToggleButtonGroup
                                value={viewMode}
                                exclusive
                                onChange={(_, newMode) => newMode && setViewMode(newMode)}
                                size="small"
                            >
                                <ToggleButton value="list" aria-label="list view">
                                    <ViewListIcon fontSize="small" />
                                </ToggleButton>
                                <ToggleButton value="map" aria-label="map view">
                                    <MapIcon fontSize="small" />
                                </ToggleButton>
                            </ToggleButtonGroup>
                            <Tooltip title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}>
                                <IconButton 
                                    onClick={() => setIsFullscreen(!isFullscreen)}
                                    size="small"
                                >
                                    {isFullscreen ? <FullscreenExitIcon fontSize="small" /> : <FullscreenIcon fontSize="small" />}
                                </IconButton>
                            </Tooltip>
                        </Box>
                    </Box>

                    {/* Screen Count */}
                    <Box sx={{ px: 2, py: 1, bgcolor: 'action.hover' }}>
                        <Typography variant="body2" fontWeight={600}>
                            {filteredScreens?.filter(s => s.latitude && s.longitude).length || 0} screens
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                            Click a screen to view on map
                        </Typography>
                    </Box>

                    {/* Screen List */}
                    <List sx={{ flex: 1, overflow: 'auto', py: 0 }}>
                        {filteredScreens?.filter(s => s.latitude && s.longitude).map((screen) => (
                            <ListItemButton
                                key={screen.id}
                                selected={selectedScreenId === screen.id}
                                onClick={() => setSelectedScreenId(screen.id)}
                                sx={{
                                    borderBottom: 1,
                                    borderColor: 'divider',
                                    py: 1.5,
                                    '&.Mui-selected': {
                                        bgcolor: 'action.selected',
                                    },
                                }}
                            >
                                <ListItemIcon sx={{ minWidth: 48 }}>
                                    <MonitorIcon sx={{ color: 'text.secondary' }} />
                                </ListItemIcon>
                                <ListItemText
                                    primary={
                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                            <CircleIcon 
                                                sx={{ 
                                                    fontSize: 8, 
                                                    color: screen.isOnline || screen.status === 'Active' ? 'success.main' : 'warning.main' 
                                                }} 
                                            />
                                            <Typography variant="body2" fontWeight={600} color="primary">
                                                INR {screen.pricePerSlot?.toLocaleString() || '0'} <Typography component="span" variant="caption" color="text.secondary">/play</Typography>
                                            </Typography>
                                        </Box>
                                    }
                                    secondary={
                                        <Box>
                                            {screen.primaryTags?.[0] && (
                                                <Chip
                                                    label={screen.primaryTags[0].displayName}
                                                    size="small"
                                                    sx={{ 
                                                        mt: 0.5, 
                                                        mb: 0.5,
                                                        height: 20,
                                                        fontSize: '0.7rem',
                                                        bgcolor: 'info.main',
                                                        color: 'info.contrastText',
                                                    }}
                                                />
                                            )}
                                            <Typography variant="body2" color="text.secondary">
                                                {screen.name}
                                            </Typography>
                                        </Box>
                                    }
                                />
                            </ListItemButton>
                        ))}
                        {(!filteredScreens || filteredScreens.filter(s => s.latitude && s.longitude).length === 0) && (
                            <Box sx={{ p: 3, textAlign: 'center' }}>
                                <MonitorIcon sx={{ fontSize: 48, color: 'text.disabled', mb: 1 }} />
                                <Typography variant="body2" color="text.secondary">
                                    No screens with location data
                                </Typography>
                            </Box>
                        )}
                    </List>
                </Paper>

                {/* Map - fills remaining space */}
                <Box sx={{ flex: 1, overflow: 'hidden' }}>
                    <ScreensMap
                        screens={filteredScreens?.filter(s => s.latitude && s.longitude).map(s => ({
                            id: s.id,
                            name: s.name,
                            description: s.description,
                            status: s.status,
                            latitude: s.latitude,
                            longitude: s.longitude,
                            pricePerSlot: s.pricePerSlot,
                            isOnline: s.isOnline,
                            createdAt: '',
                            primaryTags: s.primaryTags?.map(t => ({ 
                                tagId: '', 
                                slug: '', 
                                displayName: t.displayName, 
                                category: '',
                                source: 'Manual' as const,
                                isPrimary: true 
                            })),
                        })) || []}
                        onScreenClick={(screen) => navigate(`/screens/${screen.id}`)}
                        selectedScreenId={selectedScreenId || undefined}
                        isOwnerView={true}
                    />
                </Box>
            </Box>
        );
    }

    // List view
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

            {isPrivate && isScreenOwner && (
                <Alert severity="info" sx={{ mb: 3 }}>
                    Your account is Private. Your screens are not visible to advertisers. To go public, submit a request from your Profile Settings.
                </Alert>
            )}

            {/* Filters */}
            <Paper sx={{ p: 2, mb: 3 }}>
                <Grid container spacing={2} alignItems="center">
                    <Grid size={{ xs: 12, md: 6 }}>
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
                    <Grid size={{ xs: 12, md: 3 }}>
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
                    <Grid size={{ xs: 12, md: 3 }}>
                        <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1, alignItems: 'center' }}>
                            <ToggleButtonGroup
                                value={viewMode}
                                exclusive
                                onChange={(_, newMode) => newMode && setViewMode(newMode)}
                                size="small"
                            >
                                <ToggleButton value="list" aria-label="list view">
                                    <Tooltip title="List View">
                                        <ViewListIcon />
                                    </Tooltip>
                                </ToggleButton>
                                <ToggleButton value="map" aria-label="map view">
                                    <Tooltip title="Map View">
                                        <MapIcon />
                                    </Tooltip>
                                </ToggleButton>
                            </ToggleButtonGroup>
                        </Box>
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
                                    bookedSlots: screen.bookedSlots || 0,
                                    revenue: screen.revenueEstimate?.daily?.[new Date().toISOString().split('T')[0]] || 0,
                                    currency: screen.currency,
                                    activeBookings: screen.activeBookings || 0,
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
