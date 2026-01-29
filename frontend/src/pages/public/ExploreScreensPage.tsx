import { useState, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
    Box,
    Paper,
    Typography,
    TextField,
    InputAdornment,
    IconButton,
    Button,
    Chip,
    Card,
    CardContent,
    Stack,
    Drawer,
    List,
    ListItemButton,
    ListItemText,
    ListItemIcon,
    Divider,
    FormControl,
    InputLabel,
    Select,
    MenuItem,
    useMediaQuery,
    useTheme,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Alert,
    CircularProgress,
    Tooltip,
    Badge,
} from '@mui/material';
import {
    Search as SearchIcon,
    FilterList as FilterIcon,
    Map as MapIcon,
    ViewList as ListIcon,
    Close as CloseIcon,
    Tv as TvIcon,
    Circle as CircleIcon,
    LocationOn as LocationIcon,
    Login as LoginIcon,
    PersonAdd as SignUpIcon,
    ChevronLeft as ChevronLeftIcon,
    ChevronRight as ChevronRightIcon,
} from '@mui/icons-material';
import { ScreensMap } from '../../components/map';
import { useAuthStore } from '../../store/authStore';
import {
    exploreScreens,
    getUniqueCities,
    getUniqueStates,
    type PublicScreen,
    type PublicSearchRequest,
    type BoundingBox,
} from '../../services/publicScreensService';

const DRAWER_WIDTH = 380;

interface FilterState {
    searchText: string;
    city: string;
    state: string;
    country: string;
    tagCategory: string;
    minPrice?: number;
    maxPrice?: number;
}

export default function ExploreScreensPage() {
    const navigate = useNavigate();
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down('md'));
    const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

    // View state
    const [viewMode, setViewMode] = useState<'map' | 'list'>('map');
    const [drawerOpen, setDrawerOpen] = useState(!isMobile);
    const [selectedScreen, setSelectedScreen] = useState<PublicScreen | null>(null);
    const [hoveredScreen, setHoveredScreen] = useState<PublicScreen | null>(null);
    const [showAuthDialog, setShowAuthDialog] = useState(false);
    const [filterDrawerOpen, setFilterDrawerOpen] = useState(false);

    // Search/filter state
    const [filters, setFilters] = useState<FilterState>({
        searchText: '',
        city: '',
        state: '',
        country: 'India', // Default to India
        tagCategory: '',
    });

    // Map bounds for search (stored for potential future use)
    const [, setMapBounds] = useState<BoundingBox | null>(null);
    const [searchCenter, setSearchCenter] = useState<{ lat: number; lng: number } | null>(null);
    const [searchRadius, setSearchRadius] = useState<number | null>(null);

    // Build search request
    const searchRequest = useMemo<PublicSearchRequest>(() => ({
        searchText: filters.searchText || undefined,
        city: filters.city || undefined,
        state: filters.state || undefined,
        country: filters.country || undefined,
        tagCategory: filters.tagCategory || undefined,
        minPrice: filters.minPrice,
        maxPrice: filters.maxPrice,
        latitude: searchCenter?.lat,
        longitude: searchCenter?.lng,
        radiusKm: searchRadius ?? undefined,
        page: 1,
        pageSize: 500, // Load more for map view
    }), [filters, searchCenter, searchRadius]);

    // Fetch screens
    const { data, isLoading } = useQuery({
        queryKey: ['explore-screens', searchRequest],
        queryFn: () => exploreScreens(searchRequest),
        staleTime: 30000,
    });

    const screens = data?.screens || [];
    const totalCount = data?.totalCount || 0;

    // Get unique filter options from data
    const cities = useMemo(() => getUniqueCities(screens), [screens]);
    const states = useMemo(() => getUniqueStates(screens), [screens]);

    // Handle screen click
    const handleScreenClick = useCallback((screen: PublicScreen) => {
        if (isAuthenticated) {
            navigate(`/screens/${screen.id}`);
        } else {
            setSelectedScreen(screen);
            setShowAuthDialog(true);
        }
    }, [isAuthenticated, navigate]);

    // Handle screen hover
    const handleScreenHover = useCallback((screen: PublicScreen | null) => {
        setHoveredScreen(screen);
    }, []);

    // Handle map bounds change
    const handleBoundsChange = useCallback((bounds: any) => {
        setMapBounds({
            north: bounds.north,
            south: bounds.south,
            east: bounds.east,
            west: bounds.west,
        });
    }, []);

    // Handle "Search This Area"
    const handleSearchArea = useCallback((center: { lat: number; lng: number }, radiusKm: number) => {
        setSearchCenter(center);
        setSearchRadius(radiusKm);
    }, []);

    // Handle filter change
    const handleFilterChange = (field: keyof FilterState, value: any) => {
        setFilters(prev => ({ ...prev, [field]: value }));
        // Reset location search when filters change
        setSearchCenter(null);
        setSearchRadius(null);
    };

    // Reset filters
    const handleResetFilters = () => {
        setFilters({
            searchText: '',
            city: '',
            state: '',
            country: 'India',
            tagCategory: '',
        });
        setSearchCenter(null);
        setSearchRadius(null);
    };

    // Count active filters
    const activeFilterCount = useMemo(() => {
        let count = 0;
        if (filters.searchText) count++;
        if (filters.city) count++;
        if (filters.state) count++;
        if (filters.tagCategory) count++;
        if (filters.minPrice) count++;
        if (filters.maxPrice) count++;
        return count;
    }, [filters]);

    // Screen list for sidebar
    const renderScreenList = () => (
        <List sx={{ overflow: 'auto', flex: 1 }}>
            {screens.map((screen) => (
                <ListItemButton
                    key={screen.id}
                    selected={selectedScreen?.id === screen.id || hoveredScreen?.id === screen.id}
                    onClick={() => handleScreenClick(screen)}
                    sx={{
                        borderRadius: 1,
                        mb: 0.5,
                        mx: 1,
                        '&.Mui-selected': {
                            bgcolor: 'primary.light',
                            '&:hover': { bgcolor: 'primary.light' },
                        },
                    }}
                >
                    <ListItemIcon>
                        <Box
                            sx={{
                                width: 60,
                                height: 45,
                                bgcolor: 'grey.800',
                                borderRadius: 1,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                position: 'relative',
                            }}
                        >
                            <TvIcon sx={{ color: 'grey.400' }} />
                            <CircleIcon
                                sx={{
                                    position: 'absolute',
                                    top: 4,
                                    right: 4,
                                    fontSize: 10,
                                    color: screen.isOnline ? 'success.main' : 'grey.500',
                                }}
                            />
                        </Box>
                    </ListItemIcon>
                    <ListItemText
                        primary={
                            <Box display="flex" alignItems="center" gap={1}>
                                <Typography variant="subtitle2" fontWeight={600}>
                                    {screen.startingPrice && (
                                        <span style={{ color: theme.palette.success.main }}>
                                            {screen.currency || 'INR'} {screen.startingPrice}
                                            <Typography component="span" variant="caption" color="text.secondary">
                                                {' '}/play
                                            </Typography>
                                        </span>
                                    )}
                                </Typography>
                            </Box>
                        }
                        secondary={
                            <Box>
                                <Typography variant="body2" color="text.secondary" noWrap>
                                    {screen.primaryTagName && (
                                        <Chip
                                            label={screen.primaryTagName}
                                            size="small"
                                            sx={{ 
                                                height: 18, 
                                                fontSize: '0.65rem',
                                                mr: 0.5,
                                                bgcolor: 'primary.dark',
                                                color: 'white',
                                            }}
                                        />
                                    )}
                                </Typography>
                                <Typography variant="caption" color="text.secondary">
                                    {screen.name}
                                </Typography>
                            </Box>
                        }
                    />
                </ListItemButton>
            ))}
        </List>
    );

    // Sidebar drawer content
    const sidebarContent = (
        <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            {/* Header */}
            <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
                <Box display="flex" alignItems="center" justifyContent="space-between" mb={1}>
                    <IconButton size="small" onClick={() => setDrawerOpen(false)}>
                        <ChevronLeftIcon />
                    </IconButton>
                    <Typography variant="h6" fontWeight={700}>
                        Find some boards.
                    </Typography>
                    <Box width={32} /> {/* Spacer */}
                </Box>

                {/* Filters Button */}
                <Button
                    fullWidth
                    variant="outlined"
                    startIcon={<FilterIcon />}
                    onClick={() => setFilterDrawerOpen(true)}
                    sx={{
                        borderColor: 'divider',
                        color: 'text.primary',
                        justifyContent: 'center',
                        mb: 1,
                    }}
                >
                    <Badge badgeContent={activeFilterCount} color="primary">
                        FILTERS
                    </Badge>
                </Button>

                {/* Stats */}
                <Alert severity="info" sx={{ py: 0.5, fontSize: '0.75rem' }}>
                    <Typography variant="caption">
                        There are <strong>{totalCount.toLocaleString()}</strong> boards here.
                        Try using <strong>filters</strong> to narrow down.
                    </Typography>
                </Alert>
            </Box>

            {/* Screen List */}
            {isLoading ? (
                <Box display="flex" justifyContent="center" alignItems="center" flex={1}>
                    <CircularProgress />
                </Box>
            ) : screens.length === 0 ? (
                <Box display="flex" justifyContent="center" alignItems="center" flex={1} p={3}>
                    <Typography color="text.secondary" textAlign="center">
                        No screens found. Try adjusting your filters.
                    </Typography>
                </Box>
            ) : (
                renderScreenList()
            )}

            {/* Auth CTA */}
            {!isAuthenticated && (
                <Box sx={{ p: 2, borderTop: 1, borderColor: 'divider', bgcolor: 'primary.dark' }}>
                    <Typography variant="body2" color="white" mb={1}>
                        This is a <strong>preview</strong> of all boards.
                    </Typography>
                    <Typography variant="caption" color="grey.300" display="block" mb={2}>
                        Pan around and see what boards are near you. Create an account to book.
                    </Typography>
                    <Stack direction="row" spacing={1}>
                        <Button
                            variant="contained"
                            color="success"
                            startIcon={<SignUpIcon />}
                            onClick={() => navigate('/register')}
                            fullWidth
                        >
                            Sign Up
                        </Button>
                        <Button
                            variant="outlined"
                            sx={{ borderColor: 'white', color: 'white' }}
                            onClick={() => navigate('/login')}
                            fullWidth
                        >
                            Log In
                        </Button>
                    </Stack>
                </Box>
            )}
        </Box>
    );

    // Filter drawer content
    const filterContent = (
        <Box sx={{ p: 2, width: 300 }}>
            <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                <Typography variant="h6">Filters</Typography>
                <IconButton onClick={() => setFilterDrawerOpen(false)}>
                    <CloseIcon />
                </IconButton>
            </Box>

            <Stack spacing={2}>
                {/* Search */}
                <TextField
                    fullWidth
                    size="small"
                    placeholder="Search by name or location..."
                    value={filters.searchText}
                    onChange={(e) => handleFilterChange('searchText', e.target.value)}
                    InputProps={{
                        startAdornment: (
                            <InputAdornment position="start">
                                <SearchIcon />
                            </InputAdornment>
                        ),
                    }}
                />

                {/* Country */}
                <FormControl fullWidth size="small">
                    <InputLabel>Country</InputLabel>
                    <Select
                        value={filters.country}
                        label="Country"
                        onChange={(e) => handleFilterChange('country', e.target.value)}
                    >
                        <MenuItem value="">All Countries</MenuItem>
                        <MenuItem value="India">India</MenuItem>
                        <MenuItem value="United States">United States</MenuItem>
                        <MenuItem value="United Kingdom">United Kingdom</MenuItem>
                    </Select>
                </FormControl>

                {/* State */}
                <FormControl fullWidth size="small">
                    <InputLabel>State</InputLabel>
                    <Select
                        value={filters.state}
                        label="State"
                        onChange={(e) => handleFilterChange('state', e.target.value)}
                    >
                        <MenuItem value="">All States</MenuItem>
                        {states.map((state) => (
                            <MenuItem key={state} value={state}>{state}</MenuItem>
                        ))}
                    </Select>
                </FormControl>

                {/* City */}
                <FormControl fullWidth size="small">
                    <InputLabel>City</InputLabel>
                    <Select
                        value={filters.city}
                        label="City"
                        onChange={(e) => handleFilterChange('city', e.target.value)}
                    >
                        <MenuItem value="">All Cities</MenuItem>
                        {cities.map((city) => (
                            <MenuItem key={city} value={city}>{city}</MenuItem>
                        ))}
                    </Select>
                </FormControl>

                {/* Tag Category */}
                <FormControl fullWidth size="small">
                    <InputLabel>Category</InputLabel>
                    <Select
                        value={filters.tagCategory}
                        label="Category"
                        onChange={(e) => handleFilterChange('tagCategory', e.target.value)}
                    >
                        <MenuItem value="">All Categories</MenuItem>
                        <MenuItem value="Venue">Venue Type</MenuItem>
                        <MenuItem value="Audience">Audience</MenuItem>
                        <MenuItem value="Industry">Industry</MenuItem>
                        <MenuItem value="Amenity">Amenities</MenuItem>
                    </Select>
                </FormControl>

                <Divider />

                <Button
                    variant="outlined"
                    onClick={handleResetFilters}
                    fullWidth
                >
                    Reset Filters
                </Button>
            </Stack>
        </Box>
    );

    return (
        <Box sx={{ height: '100vh', display: 'flex', overflow: 'hidden' }}>
            {/* Sidebar Drawer */}
            <Drawer
                variant={isMobile ? 'temporary' : 'persistent'}
                open={drawerOpen}
                onClose={() => setDrawerOpen(false)}
                sx={{
                    width: drawerOpen ? DRAWER_WIDTH : 0,
                    flexShrink: 0,
                    '& .MuiDrawer-paper': {
                        width: DRAWER_WIDTH,
                        boxSizing: 'border-box',
                        bgcolor: 'background.default',
                    },
                }}
            >
                {sidebarContent}
            </Drawer>

            {/* Filter Drawer */}
            <Drawer
                anchor="right"
                open={filterDrawerOpen}
                onClose={() => setFilterDrawerOpen(false)}
            >
                {filterContent}
            </Drawer>

            {/* Main Content */}
            <Box
                component="main"
                sx={{
                    flexGrow: 1,
                    height: '100%',
                    position: 'relative',
                }}
            >
                {/* Top Bar */}
                <Paper
                    elevation={2}
                    sx={{
                        position: 'absolute',
                        top: 16,
                        left: '50%',
                        transform: 'translateX(-50%)',
                        zIndex: 1000,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 1,
                        p: 1,
                        borderRadius: 2,
                    }}
                >
                    <TextField
                        size="small"
                        placeholder="Search for a city or address..."
                        value={filters.searchText}
                        onChange={(e) => handleFilterChange('searchText', e.target.value)}
                        sx={{ width: 280 }}
                        InputProps={{
                            startAdornment: (
                                <InputAdornment position="start">
                                    <SearchIcon />
                                </InputAdornment>
                            ),
                        }}
                    />
                    <FormControl size="small" sx={{ minWidth: 80 }}>
                        <Select
                            value={filters.country === 'India' ? 'IN' : filters.country === 'United States' ? 'US' : 'ALL'}
                            onChange={(e) => {
                                const val = e.target.value;
                                handleFilterChange('country', val === 'IN' ? 'India' : val === 'US' ? 'United States' : '');
                            }}
                        >
                            <MenuItem value="IN">IN</MenuItem>
                            <MenuItem value="US">US</MenuItem>
                            <MenuItem value="ALL">All</MenuItem>
                        </Select>
                    </FormControl>
                </Paper>

                {/* Toggle Drawer Button */}
                {!drawerOpen && (
                    <IconButton
                        onClick={() => setDrawerOpen(true)}
                        sx={{
                            position: 'absolute',
                            top: 16,
                            left: 16,
                            zIndex: 1000,
                            bgcolor: 'background.paper',
                            boxShadow: 2,
                            '&:hover': { bgcolor: 'background.paper' },
                        }}
                    >
                        <ChevronRightIcon />
                    </IconButton>
                )}

                {/* View Toggle */}
                <Paper
                    elevation={2}
                    sx={{
                        position: 'absolute',
                        top: 16,
                        right: 16,
                        zIndex: 1000,
                        display: 'flex',
                        borderRadius: 1,
                        overflow: 'hidden',
                    }}
                >
                    <Tooltip title="Map View">
                        <IconButton
                            onClick={() => setViewMode('map')}
                            sx={{
                                borderRadius: 0,
                                bgcolor: viewMode === 'map' ? 'primary.main' : 'background.paper',
                                color: viewMode === 'map' ? 'white' : 'text.primary',
                                '&:hover': {
                                    bgcolor: viewMode === 'map' ? 'primary.dark' : 'action.hover',
                                },
                            }}
                        >
                            <MapIcon />
                        </IconButton>
                    </Tooltip>
                    <Tooltip title="List View">
                        <IconButton
                            onClick={() => setViewMode('list')}
                            sx={{
                                borderRadius: 0,
                                bgcolor: viewMode === 'list' ? 'primary.main' : 'background.paper',
                                color: viewMode === 'list' ? 'white' : 'text.primary',
                                '&:hover': {
                                    bgcolor: viewMode === 'list' ? 'primary.dark' : 'action.hover',
                                },
                            }}
                        >
                            <ListIcon />
                        </IconButton>
                    </Tooltip>
                </Paper>

                {/* Map View */}
                {viewMode === 'map' && (
                    <ScreensMap
                        screens={screens as any} // Convert PublicScreen to Screen type
                        isLoading={isLoading}
                        onScreenClick={handleScreenClick as any}
                        onScreenHover={handleScreenHover as any}
                        onBoundsChange={handleBoundsChange}
                        onSearchArea={handleSearchArea}
                        selectedScreenId={selectedScreen?.id}
                        showSearchAreaButton={true}
                    />
                )}

                {/* List View */}
                {viewMode === 'list' && (
                    <Box sx={{ height: '100%', overflow: 'auto', p: 3, pt: 10 }}>
                        <Typography variant="h5" gutterBottom>
                            {totalCount.toLocaleString()} Screens Available
                        </Typography>
                        <Box
                            sx={{
                                display: 'grid',
                                gridTemplateColumns: {
                                    xs: '1fr',
                                    sm: 'repeat(2, 1fr)',
                                    md: 'repeat(3, 1fr)',
                                    lg: 'repeat(4, 1fr)',
                                },
                                gap: 2,
                            }}
                        >
                            {screens.map((screen) => (
                                <Card
                                    key={screen.id}
                                    sx={{
                                        cursor: 'pointer',
                                        transition: 'transform 0.2s',
                                        '&:hover': { transform: 'translateY(-4px)' },
                                    }}
                                    onClick={() => handleScreenClick(screen)}
                                >
                                    <Box
                                        sx={{
                                            height: 120,
                                            bgcolor: 'grey.800',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            position: 'relative',
                                        }}
                                    >
                                        <TvIcon sx={{ fontSize: 48, color: 'grey.500' }} />
                                        <CircleIcon
                                            sx={{
                                                position: 'absolute',
                                                top: 8,
                                                right: 8,
                                                fontSize: 12,
                                                color: screen.isOnline ? 'success.main' : 'grey.500',
                                            }}
                                        />
                                        {screen.primaryTagName && (
                                            <Chip
                                                label={screen.primaryTagName}
                                                size="small"
                                                sx={{
                                                    position: 'absolute',
                                                    bottom: 8,
                                                    left: 8,
                                                    bgcolor: 'primary.dark',
                                                    color: 'white',
                                                    fontSize: '0.7rem',
                                                }}
                                            />
                                        )}
                                    </Box>
                                    <CardContent>
                                        <Typography variant="subtitle2" noWrap>
                                            {screen.name}
                                        </Typography>
                                        <Typography variant="caption" color="text.secondary" display="block">
                                            <LocationIcon sx={{ fontSize: 12, mr: 0.5, verticalAlign: 'middle' }} />
                                            {screen.city}, {screen.state}
                                        </Typography>
                                        {screen.startingPrice && (
                                            <Typography variant="h6" color="success.main" mt={1}>
                                                {screen.currency || 'INR'} {screen.startingPrice}
                                                <Typography component="span" variant="caption" color="text.secondary">
                                                    {' '}/play
                                                </Typography>
                                            </Typography>
                                        )}
                                    </CardContent>
                                </Card>
                            ))}
                        </Box>
                    </Box>
                )}
            </Box>

            {/* Auth Dialog */}
            <Dialog open={showAuthDialog} onClose={() => setShowAuthDialog(false)}>
                <DialogTitle>
                    Sign in to continue
                </DialogTitle>
                <DialogContent>
                    <Typography variant="body2" color="text.secondary" mb={2}>
                        Create a free account to view screen details and book advertising slots.
                    </Typography>
                    {selectedScreen && (
                        <Card variant="outlined" sx={{ mb: 2 }}>
                            <CardContent>
                                <Typography variant="subtitle2">{selectedScreen.name}</Typography>
                                <Typography variant="caption" color="text.secondary">
                                    {selectedScreen.city}, {selectedScreen.state}
                                </Typography>
                            </CardContent>
                        </Card>
                    )}
                </DialogContent>
                <DialogActions sx={{ p: 2, pt: 0 }}>
                    <Button onClick={() => setShowAuthDialog(false)}>
                        Cancel
                    </Button>
                    <Button
                        variant="outlined"
                        startIcon={<LoginIcon />}
                        onClick={() => navigate('/login')}
                    >
                        Log In
                    </Button>
                    <Button
                        variant="contained"
                        color="success"
                        startIcon={<SignUpIcon />}
                        onClick={() => navigate('/register')}
                    >
                        Sign Up Free
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
}
