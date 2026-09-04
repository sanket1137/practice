import { useState, useCallback, useMemo } from 'react';
import {
    Container,
    Paper,
    Typography,
    TextField,
    Button,
    Grid,
    Box,
    Chip,
    Card,
    CardContent,
    CardActions,
    Autocomplete,
    Slider,
    FormControl,
    InputLabel,
    Select,
    MenuItem,
    Pagination,
    Skeleton,
    Alert,
    Collapse,
    IconButton,
    InputAdornment,
    Divider,
    Tooltip,
    ToggleButton,
    ToggleButtonGroup,
    List,
    ListItemIcon,
    ListItemText,
    ListItemButton,
    FormControlLabel,
    Switch,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import FilterListIcon from '@mui/icons-material/FilterList';
import LocationOnIcon from '@mui/icons-material/LocationOn';
import MonitorIcon from '@mui/icons-material/Monitor';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import ClearIcon from '@mui/icons-material/Clear';
import MapIcon from '@mui/icons-material/Map';
import ViewListIcon from '@mui/icons-material/ViewList';
import FullscreenIcon from '@mui/icons-material/Fullscreen';
import FullscreenExitIcon from '@mui/icons-material/FullscreenExit';
import CircleIcon from '@mui/icons-material/Circle';
import PlaylistAddIcon from '@mui/icons-material/PlaylistAdd';
import PlaylistAddCheckIcon from '@mui/icons-material/PlaylistAddCheck';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { searchScreens, getAllTags } from '../../services/screenTagsService';
import ScreenTagChip from '../../components/screens/ScreenTagChip';
import BookScreenDialog from '../../components/screens/BookScreenDialog';
import PlanTray from '../../components/screens/PlanTray';
import { usePlan, togglePlan } from '../../store/planStore';
import { ScreensMap } from '../../components/map';
import type { Screen, MasterTag, SearchScreensRequest } from '../../types/screen';
import { TAG_CATEGORIES, TAG_CATEGORY_LABELS, VENUE_TYPE_OPTIONS } from '../../types/screen';

const DEFAULT_PAGE_SIZE = 12;
const SCREEN_TYPE_OPTIONS = [
    { value: 'Billboard', label: 'Billboard' },
    { value: 'LedWall', label: 'LED Wall' },
    { value: 'VideoWall', label: 'Video Wall' },
    { value: 'TvDisplay', label: 'TV Display' },
    { value: 'Kiosk', label: 'Kiosk' },
    { value: 'Projection', label: 'Projection' },
    { value: 'TransitDisplay', label: 'Transit Display' },
    { value: 'Standee', label: 'Standee' },
];
const ENVIRONMENT_OPTIONS = [
    { value: 'Indoor', label: 'Indoor' },
    { value: 'Outdoor', label: 'Outdoor' },
    { value: 'SemiIndoor', label: 'Semi-indoor' },
];
const MAP_PAGE_SIZE = 200; // Load more screens for map view
const SIDEBAR_WIDTH = 380;
const PREMIUM_SURFACE = {
    backgroundColor: 'background.paper',
    border: '1px solid var(--ps-border)',
    boxShadow: '0 10px 28px rgba(16, 24, 40, 0.08)',
};

export default function DiscoverScreensPage() {
    const navigate = useNavigate();
    const [showFilters, setShowFilters] = useState(false);
    const [viewMode, setViewMode] = useState<'list' | 'map'>('list');
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [selectedScreenId, setSelectedScreenId] = useState<string | null>(null);
    
    // Book screen dialog state
    const [bookDialogOpen, setBookDialogOpen] = useState(false);
    const [screenToBook, setScreenToBook] = useState<{ id: string; name: string } | null>(null);
    
    const handleBookScreen = (screenId: string, screenName: string) => {
        setScreenToBook({ id: screenId, name: screenName });
        setBookDialogOpen(true);
    };

    const plan = usePlan();
    const planIds = useMemo(() => new Set(plan.map((p) => p.id)), [plan]);
    
    // Search and filter state
    const [searchText, setSearchText] = useState('');
    const [selectedTags, setSelectedTags] = useState<MasterTag[]>([]);
    const [selectedCategory, setSelectedCategory] = useState<string>('');
    const [city, setCity] = useState('');
    const [state, setState] = useState('');
    const [priceRange, setPriceRange] = useState<[number, number]>([0, 10000]);
    const [availableFrom, setAvailableFrom] = useState('');
    const [availableTo, setAvailableTo] = useState('');
    const [envType, setEnvType] = useState('');
    const [screenType, setScreenType] = useState('');
    const [venueType, setVenueType] = useState('');
    const [orientation, setOrientation] = useState('');
    const [onlineOnly, setOnlineOnly] = useState(false);
    const [minImpressions, setMinImpressions] = useState('');
    const [maxCpm, setMaxCpm] = useState('');
    const [sortBy, setSortBy] = useState<string>('created');
    const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
    const [page, setPage] = useState(1);

    // Build search request
    const buildSearchRequest = useCallback((): SearchScreensRequest => {
        const request: SearchScreensRequest = {
            page,
            pageSize: viewMode === 'map' ? MAP_PAGE_SIZE : DEFAULT_PAGE_SIZE,
            sortBy,
            sortDirection,
        };

        if (searchText.trim()) {
            request.searchText = searchText.trim();
        }
        if (city.trim()) {
            request.city = city.trim();
        }
        if (state.trim()) {
            request.state = state.trim();
        }
        if (selectedTags.length > 0) {
            request.anyTagIds = selectedTags.map(t => t.id);
        }
        if (selectedCategory) {
            request.tagCategory = selectedCategory;
        }
        if (priceRange[0] > 0) {
            request.minPrice = priceRange[0];
        }
        if (priceRange[1] < 10000) {
            request.maxPrice = priceRange[1];
        }
        if (availableFrom && availableTo && availableFrom <= availableTo) {
            request.availableFrom = availableFrom;
            request.availableTo = availableTo;
        }
        if (envType) {
            request.displayType = envType;
        }
        if (screenType) {
            request.screenType = screenType;
        }
        if (venueType) {
            request.venueType = venueType;
        }
        if (orientation) {
            request.orientation = orientation;
        }
        if (onlineOnly) {
            request.onlineOnly = true;
        }
        const minImp = parseInt(minImpressions, 10);
        if (!Number.isNaN(minImp) && minImp > 0) {
            request.minDailyImpressions = minImp;
        }
        const cpmCap = parseFloat(maxCpm);
        if (!Number.isNaN(cpmCap) && cpmCap > 0) {
            request.maxCpm = cpmCap;
        }

        return request;
    }, [page, viewMode, searchText, city, state, selectedTags, selectedCategory, priceRange,
        availableFrom, availableTo, envType, screenType, venueType, orientation, onlineOnly,
        minImpressions, maxCpm, sortBy, sortDirection]);

    // Fetch all master tags for filter
    const { data: allTags } = useQuery({
        queryKey: ['all-tags'],
        queryFn: () => getAllTags(),
    });

    // Search screens
    const {
        data: searchResult,
        isLoading,
        error,
        refetch,
    } = useQuery({
        queryKey: ['discover-screens', buildSearchRequest()],
        queryFn: () => searchScreens(buildSearchRequest()),
    });

    const handleSearch = () => {
        setPage(1);
        refetch();
    };

    const handleClearFilters = () => {
        setSearchText('');
        setSelectedTags([]);
        setSelectedCategory('');
        setCity('');
        setState('');
        setPriceRange([0, 10000]);
        setAvailableFrom('');
        setAvailableTo('');
        setEnvType('');
        setScreenType('');
        setVenueType('');
        setOrientation('');
        setOnlineOnly(false);
        setMinImpressions('');
        setMaxCpm('');
        setPage(1);
    };

    const handleTagClick = (tag: MasterTag) => {
        if (!selectedTags.find(t => t.id === tag.id)) {
            setSelectedTags([...selectedTags, tag]);
            setPage(1);
        }
    };

    const handleRemoveTag = (tagId: string) => {
        setSelectedTags(selectedTags.filter(t => t.id !== tagId));
        setPage(1);
    };

    const hasActiveFilters = searchText || selectedTags.length > 0 || selectedCategory || city || state
        || priceRange[0] > 0 || priceRange[1] < 10000
        || availableFrom || availableTo || envType || screenType || venueType || orientation
        || onlineOnly || minImpressions || maxCpm;

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
                        ...PREMIUM_SURFACE,
                    }}
                >
                    {/* Header */}
                    <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
                            <Box>
                                <Typography variant="h6" fontWeight={600}>
                                    Discover Screens
                                </Typography>
                                <Typography variant="caption" color="text.secondary">
                                    Find screens for your campaigns
                                </Typography>
                            </Box>
                            {isFullscreen && (
                                <IconButton size="small" onClick={() => setIsFullscreen(false)}>
                                    <FullscreenExitIcon />
                                </IconButton>
                            )}
                        </Box>
                    </Box>

                    {/* Search */}
                    <Box sx={{ p: 1.5, borderBottom: 1, borderColor: 'divider' }}>
                        <TextField
                            fullWidth
                            size="small"
                            placeholder="Search screens..."
                            value={searchText}
                            onChange={(e) => setSearchText(e.target.value)}
                            onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                            InputProps={{
                                startAdornment: (
                                    <InputAdornment position="start">
                                        <SearchIcon fontSize="small" />
                                    </InputAdornment>
                                ),
                                endAdornment: searchText && (
                                    <InputAdornment position="end">
                                        <IconButton size="small" onClick={() => setSearchText('')}>
                                            <ClearIcon fontSize="small" />
                                        </IconButton>
                                    </InputAdornment>
                                ),
                            }}
                            sx={{ mb: 1 }}
                        />
                        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                            <Button
                                size="small"
                                variant="contained"
                                onClick={handleSearch}
                                sx={{ flex: 1, py: 0.9 }}
                            >
                                Search
                            </Button>
                            <Button
                                size="small"
                                variant="outlined"
                                onClick={() => setShowFilters(!showFilters)}
                                startIcon={<FilterListIcon />}
                            >
                                {showFilters ? 'Hide' : 'Filters'}
                            </Button>
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

                    {/* Collapsible Filters */}
                    <Collapse in={showFilters}>
                        <Box sx={{ p: 1.5, borderBottom: 1, borderColor: 'divider', bgcolor: 'action.hover' }}>
                            <Grid container spacing={1}>
                                <Grid size={6}>
                                    <TextField
                                        fullWidth
                                        label="City"
                                        value={city}
                                        onChange={(e) => setCity(e.target.value)}
                                        size="small"
                                    />
                                </Grid>
                                <Grid size={6}>
                                    <TextField
                                        fullWidth
                                        label="State"
                                        value={state}
                                        onChange={(e) => setState(e.target.value)}
                                        size="small"
                                    />
                                </Grid>
                                <Grid size={12}>
                                    <FormControl fullWidth size="small">
                                        <InputLabel>Category</InputLabel>
                                        <Select
                                            value={selectedCategory}
                                            label="Category"
                                            onChange={(e) => setSelectedCategory(e.target.value)}
                                        >
                                            <MenuItem value="">All</MenuItem>
                                            {TAG_CATEGORIES.map(cat => (
                                                <MenuItem key={cat} value={cat}>
                                                    {TAG_CATEGORY_LABELS[cat]}
                                                </MenuItem>
                                            ))}
                                        </Select>
                                    </FormControl>
                                </Grid>
                                <Grid size={6}>
                                    <TextField
                                        fullWidth
                                        label="Available from"
                                        type="date"
                                        value={availableFrom}
                                        onChange={(e) => setAvailableFrom(e.target.value)}
                                        size="small"
                                        InputLabelProps={{ shrink: true }}
                                    />
                                </Grid>
                                <Grid size={6}>
                                    <TextField
                                        fullWidth
                                        label="Available to"
                                        type="date"
                                        value={availableTo}
                                        onChange={(e) => setAvailableTo(e.target.value)}
                                        size="small"
                                        InputLabelProps={{ shrink: true }}
                                    />
                                </Grid>
                                <Grid size={6}>
                                    <FormControl fullWidth size="small">
                                        <InputLabel>Environment</InputLabel>
                                        <Select
                                            value={envType}
                                            label="Environment"
                                            onChange={(e) => setEnvType(e.target.value)}
                                        >
                                            <MenuItem value="">Any</MenuItem>
                                            {ENVIRONMENT_OPTIONS.map(o => (
                                                <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>
                                            ))}
                                        </Select>
                                    </FormControl>
                                </Grid>
                                <Grid size={6}>
                                    <FormControl fullWidth size="small">
                                        <InputLabel>Screen type</InputLabel>
                                        <Select
                                            value={screenType}
                                            label="Screen type"
                                            onChange={(e) => setScreenType(e.target.value)}
                                        >
                                            <MenuItem value="">Any</MenuItem>
                                            {SCREEN_TYPE_OPTIONS.map(o => (
                                                <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>
                                            ))}
                                        </Select>
                                    </FormControl>
                                </Grid>
                                <Grid size={6}>
                                    <FormControl fullWidth size="small">
                                        <InputLabel>Venue</InputLabel>
                                        <Select
                                            value={venueType}
                                            label="Venue"
                                            onChange={(e) => setVenueType(e.target.value)}
                                        >
                                            <MenuItem value="">Any</MenuItem>
                                            {VENUE_TYPE_OPTIONS.map(o => (
                                                <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>
                                            ))}
                                        </Select>
                                    </FormControl>
                                </Grid>
                                <Grid size={6}>
                                    <FormControl fullWidth size="small">
                                        <InputLabel>Orientation</InputLabel>
                                        <Select
                                            value={orientation}
                                            label="Orientation"
                                            onChange={(e) => setOrientation(e.target.value)}
                                        >
                                            <MenuItem value="">Any</MenuItem>
                                            <MenuItem value="Landscape">Landscape</MenuItem>
                                            <MenuItem value="Portrait">Portrait</MenuItem>
                                        </Select>
                                    </FormControl>
                                </Grid>
                                <Grid size={6} sx={{ display: 'flex', alignItems: 'center' }}>
                                    <FormControlLabel
                                        control={
                                            <Switch
                                                size="small"
                                                checked={onlineOnly}
                                                onChange={(e) => setOnlineOnly(e.target.checked)}
                                            />
                                        }
                                        label={<Typography variant="caption">Online now</Typography>}
                                    />
                                </Grid>
                                <Grid size={6}>
                                    <TextField
                                        fullWidth
                                        label="Min views/day"
                                        type="number"
                                        value={minImpressions}
                                        onChange={(e) => setMinImpressions(e.target.value)}
                                        size="small"
                                    />
                                </Grid>
                                <Grid size={6}>
                                    <TextField
                                        fullWidth
                                        label="Max CPM ₹"
                                        type="number"
                                        value={maxCpm}
                                        onChange={(e) => setMaxCpm(e.target.value)}
                                        size="small"
                                    />
                                </Grid>
                                <Grid size={12}>
                                    <Typography variant="caption" color="text.secondary">
                                        Price: ₹{priceRange[0]} - ₹{priceRange[1]}
                                    </Typography>
                                    <Slider
                                        value={priceRange}
                                        onChange={(_, value) => setPriceRange(value as [number, number])}
                                        valueLabelDisplay="auto"
                                        min={0}
                                        max={10000}
                                        step={100}
                                        size="small"
                                    />
                                </Grid>
                                <Grid size={12}>
                                    <Autocomplete
                                        multiple
                                        size="small"
                                        options={allTags || []}
                                        getOptionLabel={(option) => option.displayName}
                                        value={selectedTags}
                                        onChange={(_, value) => setSelectedTags(value)}
                                        renderInput={(params) => (
                                            <TextField {...params} label="Tags" placeholder="Select..." />
                                        )}
                                        renderTags={(value, getTagProps) =>
                                            value.map((option, index) => (
                                                <Chip
                                                    {...getTagProps({ index })}
                                                    key={option.id}
                                                    label={option.displayName}
                                                    size="small"
                                                />
                                            ))
                                        }
                                        limitTags={2}
                                    />
                                </Grid>
                                {hasActiveFilters && (
                                    <Grid size={12}>
                                        <Button
                                            fullWidth
                                            size="small"
                                            onClick={handleClearFilters}
                                            startIcon={<ClearIcon />}
                                        >
                                            Clear Filters
                                        </Button>
                                    </Grid>
                                )}
                            </Grid>
                        </Box>
                    </Collapse>

                    {/* Screen Count */}
                    <Box sx={{ px: 2, py: 1, bgcolor: 'action.hover' }}>
                        <Typography variant="body2" fontWeight={600}>
                            {searchResult?.screens.filter(s => s.latitude && s.longitude).length || 0} screens
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                            Click a screen to view on map
                        </Typography>
                    </Box>

                    {/* Screen List */}
                    <List sx={{ flex: 1, overflow: 'auto', py: 0 }}>
                        {isLoading ? (
                            <Box sx={{ p: 3, textAlign: 'center' }}>
                                <Typography color="text.secondary">Loading...</Typography>
                            </Box>
                        ) : error ? (
                            <Box sx={{ p: 3, textAlign: 'center' }}>
                                <Typography color="error">Failed to load screens</Typography>
                            </Box>
                        ) : searchResult?.screens.filter(s => s.latitude && s.longitude).map((screen) => (
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
                                        <Box component="span" sx={{ display: 'block' }}>
                                            {screen.primaryTags?.[0] && (
                                                <Chip
                                                    label={screen.primaryTags[0].displayName}
                                                    size="small"
                                                    sx={{ 
                                                        mt: 0.5, 
                                                        mb: 0.5,
                                                        height: 20,
                                                        fontSize: '0.7rem',
                                                        bgcolor: 'primary.main',
                                                        color: 'primary.contrastText',
                                                    }}
                                                />
                                            )}
                                            <Typography component="span" variant="body2" color="text.secondary" sx={{ display: 'block' }}>
                                                {screen.name}
                                            </Typography>
                                        </Box>
                                    }
                                />
                                <Tooltip title={planIds.has(screen.id) ? 'Remove from plan' : 'Add to plan'}>
                                    <IconButton
                                        size="small"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            togglePlan(screen);
                                        }}
                                        sx={{ color: planIds.has(screen.id) ? '#8B5CF6' : 'text.secondary' }}
                                    >
                                        {planIds.has(screen.id)
                                            ? <PlaylistAddCheckIcon fontSize="small" />
                                            : <PlaylistAddIcon fontSize="small" />}
                                    </IconButton>
                                </Tooltip>
                            </ListItemButton>
                        ))}
                        {!isLoading && !error && (!searchResult?.screens || searchResult.screens.filter(s => s.latitude && s.longitude).length === 0) && (
                            <Box sx={{ p: 3, textAlign: 'center' }}>
                                <MonitorIcon sx={{ fontSize: 48, color: 'text.disabled', mb: 1 }} />
                                <Typography variant="body2" color="text.secondary">
                                    No screens found
                                </Typography>
                            </Box>
                        )}
                    </List>
                </Paper>

                {/* Map - fills remaining space */}
                <Box sx={{ flex: 1, overflow: 'hidden' }}>
                    <ScreensMap
                        screens={searchResult?.screens.filter(s => s.latitude && s.longitude) || []}
                        onScreenClick={(screen) => navigate(`/screens/${screen.id}`)}
                        selectedScreenId={selectedScreenId || undefined}
                        isOwnerView={false}
                        onAddToPlan={togglePlan}
                        planScreenIds={planIds}
                    />
                </Box>

                <PlanTray />
            </Box>
        );
    }

    // List view
    return (
        <Container maxWidth="xl" sx={{ mt: 4, mb: 4 }}>
            {/* Header */}
            <Paper
                sx={{
                    p: { xs: 2.5, md: 3.5 },
                    mb: 3,
                    borderRadius: 3,
                    background:
                        'radial-gradient(900px 340px at 100% -8%, rgba(10, 102, 216, 0.12), transparent 60%), var(--ps-surface)',
                    border: '1px solid var(--ps-border)',
                }}
            >
                <Typography variant="h4" gutterBottom>
                    Discover Screens
                </Typography>
                <Typography variant="body1" color="text.secondary">
                    Find premium placements by city, audience intent, and slot quality.
                </Typography>
            </Paper>

            {/* Search Bar */}
            <Paper sx={{ p: 2, mb: 3, borderRadius: 3, ...PREMIUM_SURFACE }}>
                <Grid container spacing={2} alignItems="center">
                    <Grid size={{ xs: 12, md: 6 }}>
                        <TextField
                            fullWidth
                            placeholder="Search screens by name, description, or location..."
                            value={searchText}
                            onChange={(e) => setSearchText(e.target.value)}
                            onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                            InputProps={{
                                startAdornment: (
                                    <InputAdornment position="start">
                                        <SearchIcon />
                                    </InputAdornment>
                                ),
                                endAdornment: searchText && (
                                    <InputAdornment position="end">
                                        <IconButton size="small" onClick={() => setSearchText('')}>
                                            <ClearIcon />
                                        </IconButton>
                                    </InputAdornment>
                                ),
                            }}
                        />
                    </Grid>
                    <Grid size={{ xs: 6, md: 2 }}>
                        <Button
                            fullWidth
                            variant="contained"
                            startIcon={<SearchIcon />}
                            onClick={handleSearch}
                            sx={{ py: 1.1 }}
                        >
                            Search
                        </Button>
                    </Grid>
                    <Grid size={{ xs: 6, md: 2 }}>
                        <Button
                            fullWidth
                            variant="outlined"
                            startIcon={<FilterListIcon />}
                            onClick={() => setShowFilters(!showFilters)}
                            endIcon={showFilters ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                        >
                            Filters
                        </Button>
                    </Grid>
                    {hasActiveFilters && (
                        <Grid size={{ xs: 12, md: 2 }}>
                            <Button
                                fullWidth
                                variant="text"
                                onClick={handleClearFilters}
                                startIcon={<ClearIcon />}
                            >
                                Clear All
                            </Button>
                        </Grid>
                    )}
                </Grid>

                {/* Active Filters */}
                {selectedTags.length > 0 && (
                    <Box sx={{ mt: 2, display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                        <Typography variant="body2" color="text.secondary" sx={{ mr: 1, alignSelf: 'center' }}>
                            Selected tags:
                        </Typography>
                        {selectedTags.map(tag => (
                            <Chip
                                key={tag.id}
                                label={tag.displayName}
                                size="small"
                                onDelete={() => handleRemoveTag(tag.id)}
                            />
                        ))}
                    </Box>
                )}

                {/* Expanded Filters */}
                <Collapse in={showFilters}>
                    <Divider sx={{ my: 2 }} />
                    <Grid container spacing={2}>
                        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                            <TextField
                                fullWidth
                                label="City"
                                value={city}
                                onChange={(e) => setCity(e.target.value)}
                                size="small"
                            />
                        </Grid>
                        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                            <TextField
                                fullWidth
                                label="State"
                                value={state}
                                onChange={(e) => setState(e.target.value)}
                                size="small"
                            />
                        </Grid>
                        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                            <FormControl fullWidth size="small">
                                <InputLabel>Tag Category</InputLabel>
                                <Select
                                    value={selectedCategory}
                                    label="Tag Category"
                                    onChange={(e) => setSelectedCategory(e.target.value)}
                                >
                                    <MenuItem value="">All Categories</MenuItem>
                                    {TAG_CATEGORIES.map(cat => (
                                        <MenuItem key={cat} value={cat}>
                                            {TAG_CATEGORY_LABELS[cat]}
                                        </MenuItem>
                                    ))}
                                </Select>
                            </FormControl>
                        </Grid>
                        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                            <FormControl fullWidth size="small">
                                <InputLabel>Sort By</InputLabel>
                                <Select
                                    value={`${sortBy}-${sortDirection}`}
                                    label="Sort By"
                                    onChange={(e) => {
                                        const [newSortBy, newDirection] = e.target.value.split('-');
                                        setSortBy(newSortBy);
                                        setSortDirection(newDirection as 'asc' | 'desc');
                                    }}
                                >
                                    <MenuItem value="created-desc">Newest First</MenuItem>
                                    <MenuItem value="created-asc">Oldest First</MenuItem>
                                    <MenuItem value="name-asc">Name (A-Z)</MenuItem>
                                    <MenuItem value="name-desc">Name (Z-A)</MenuItem>
                                    <MenuItem value="price-asc">Price (Low to High)</MenuItem>
                                    <MenuItem value="price-desc">Price (High to Low)</MenuItem>
                                </Select>
                            </FormControl>
                        </Grid>
                        <Grid size={{ xs: 12, md: 6 }}>
                            <Typography variant="body2" gutterBottom>
                                Price Range (per slot)
                            </Typography>
                            <Slider
                                value={priceRange}
                                onChange={(_, value) => setPriceRange(value as [number, number])}
                                valueLabelDisplay="auto"
                                min={0}
                                max={10000}
                                step={100}
                            />
                            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                                <Typography variant="caption">₹{priceRange[0]}</Typography>
                                <Typography variant="caption">₹{priceRange[1]}</Typography>
                            </Box>
                        </Grid>
                        <Grid size={{ xs: 12, md: 6 }}>
                            <Autocomplete
                                multiple
                                size="small"
                                options={allTags || []}
                                groupBy={(option) => TAG_CATEGORY_LABELS[option.category as keyof typeof TAG_CATEGORY_LABELS] || option.category}
                                getOptionLabel={(option) => option.displayName}
                                value={selectedTags}
                                onChange={(_, value) => setSelectedTags(value)}
                                renderInput={(params) => (
                                    <TextField {...params} label="Filter by Tags" placeholder="Select tags..." />
                                )}
                                renderTags={(value, getTagProps) =>
                                    value.map((option, index) => (
                                        <Chip
                                            {...getTagProps({ index })}
                                            key={option.id}
                                            label={option.displayName}
                                            size="small"
                                        />
                                    ))
                                }
                            />
                        </Grid>
                        <Grid size={12}>
                            <Divider textAlign="left">
                                <Typography variant="caption" color="text.secondary">
                                    Availability &amp; hardware
                                </Typography>
                            </Divider>
                        </Grid>
                        <Grid size={{ xs: 6, sm: 3, md: 2 }}>
                            <TextField
                                fullWidth
                                label="Available from"
                                type="date"
                                value={availableFrom}
                                onChange={(e) => setAvailableFrom(e.target.value)}
                                size="small"
                                InputLabelProps={{ shrink: true }}
                            />
                        </Grid>
                        <Grid size={{ xs: 6, sm: 3, md: 2 }}>
                            <TextField
                                fullWidth
                                label="Available to"
                                type="date"
                                value={availableTo}
                                onChange={(e) => setAvailableTo(e.target.value)}
                                size="small"
                                InputLabelProps={{ shrink: true }}
                            />
                        </Grid>
                        <Grid size={{ xs: 6, sm: 3, md: 2 }}>
                            <FormControl fullWidth size="small">
                                <InputLabel>Environment</InputLabel>
                                <Select
                                    value={envType}
                                    label="Environment"
                                    onChange={(e) => setEnvType(e.target.value)}
                                >
                                    <MenuItem value="">Any</MenuItem>
                                    {ENVIRONMENT_OPTIONS.map(o => (
                                        <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>
                                    ))}
                                </Select>
                            </FormControl>
                        </Grid>
                        <Grid size={{ xs: 6, sm: 3, md: 2 }}>
                            <FormControl fullWidth size="small">
                                <InputLabel>Screen type</InputLabel>
                                <Select
                                    value={screenType}
                                    label="Screen type"
                                    onChange={(e) => setScreenType(e.target.value)}
                                >
                                    <MenuItem value="">Any</MenuItem>
                                    {SCREEN_TYPE_OPTIONS.map(o => (
                                        <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>
                                    ))}
                                </Select>
                            </FormControl>
                        </Grid>
                        <Grid size={{ xs: 6, sm: 3, md: 2 }}>
                            <FormControl fullWidth size="small">
                                <InputLabel>Venue</InputLabel>
                                <Select
                                    value={venueType}
                                    label="Venue"
                                    onChange={(e) => setVenueType(e.target.value)}
                                >
                                    <MenuItem value="">Any</MenuItem>
                                    {VENUE_TYPE_OPTIONS.map(o => (
                                        <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>
                                    ))}
                                </Select>
                            </FormControl>
                        </Grid>
                        <Grid size={{ xs: 6, sm: 3, md: 2 }}>
                            <FormControl fullWidth size="small">
                                <InputLabel>Orientation</InputLabel>
                                <Select
                                    value={orientation}
                                    label="Orientation"
                                    onChange={(e) => setOrientation(e.target.value)}
                                >
                                    <MenuItem value="">Any</MenuItem>
                                    <MenuItem value="Landscape">Landscape</MenuItem>
                                    <MenuItem value="Portrait">Portrait</MenuItem>
                                </Select>
                            </FormControl>
                        </Grid>
                        <Grid size={{ xs: 6, sm: 3, md: 2 }} sx={{ display: 'flex', alignItems: 'center' }}>
                            <FormControlLabel
                                control={
                                    <Switch
                                        size="small"
                                        checked={onlineOnly}
                                        onChange={(e) => setOnlineOnly(e.target.checked)}
                                    />
                                }
                                label={<Typography variant="body2">Online now</Typography>}
                            />
                        </Grid>
                        <Grid size={{ xs: 6, sm: 3 }}>
                            <TextField
                                fullWidth
                                label="Min audience/day"
                                type="number"
                                value={minImpressions}
                                onChange={(e) => setMinImpressions(e.target.value)}
                                size="small"
                                helperText="Owner-declared daily views"
                            />
                        </Grid>
                        <Grid size={{ xs: 6, sm: 3 }}>
                            <TextField
                                fullWidth
                                label="Max CPM (₹)"
                                type="number"
                                value={maxCpm}
                                onChange={(e) => setMaxCpm(e.target.value)}
                                size="small"
                                helperText="Cost per 1,000 views"
                            />
                        </Grid>
                    </Grid>
                </Collapse>
            </Paper>

            {/* Results Summary */}
            <Box sx={{ mb: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Typography variant="body2" color="text.secondary">
                    {searchResult ? (
                        `Showing ${searchResult.screens.length} of ${searchResult.totalCount} screens`
                    ) : (
                        'Loading...'
                    )}
                </Typography>
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

            {/* Results - List View */}
            {isLoading ? (
                <Grid container spacing={3}>
                    {[...Array(6)].map((_, i) => (
                        <Grid key={i} size={{ xs: 12, sm: 6, md: 4 }}>
                            <Skeleton variant="rectangular" height={320} sx={{ borderRadius: 3 }} />
                        </Grid>
                    ))}
                </Grid>
            ) : error ? (
                <Alert severity="error">
                    Failed to load screens. Please try again.
                </Alert>
            ) : searchResult?.screens.length === 0 ? (
                <Paper sx={{ p: 4, textAlign: 'center', borderRadius: 3, ...PREMIUM_SURFACE }}>
                    <MonitorIcon sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
                    <Typography variant="h6" gutterBottom>
                        No screens found
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                        Try adjusting your filters or search terms.
                    </Typography>
                </Paper>
            ) : (
                <>
                    <Grid container spacing={3}>
                        {searchResult?.screens.map((screen) => (
                            <Grid key={screen.id} size={{ xs: 12, sm: 6, md: 4 }}>
                                <ScreenCard
                                    screen={screen}
                                    onTagClick={handleTagClick}
                                    onBook={handleBookScreen}
                                    inPlan={planIds.has(screen.id)}
                                    onTogglePlan={togglePlan}
                                />
                            </Grid>
                        ))}
                    </Grid>

                    {/* Pagination */}
                    {searchResult && searchResult.totalPages > 1 && (
                        <Box sx={{ mt: 4, display: 'flex', justifyContent: 'center' }}>
                            <Pagination
                                count={searchResult.totalPages}
                                page={page}
                                onChange={(_, value) => setPage(value)}
                                color="primary"
                            />
                        </Box>
                    )}
                </>
            )}

            <PlanTray />

            {/* Book Screen Dialog */}
            {screenToBook && (
                <BookScreenDialog
                    open={bookDialogOpen}
                    onClose={() => {
                        setBookDialogOpen(false);
                        setScreenToBook(null);
                    }}
                    screenId={screenToBook.id}
                    screenName={screenToBook.name}
                />
            )}
        </Container>
    );
}

interface ScreenCardProps {
    screen: Screen;
    onTagClick?: (tag: MasterTag) => void;
    onBook?: (screenId: string, screenName: string) => void;
    inPlan?: boolean;
    onTogglePlan?: (screen: Screen) => void;
}

function ScreenCard({ screen, onTagClick, onBook, inPlan = false, onTogglePlan }: ScreenCardProps) {
    const navigate = useNavigate();

    return (
        <Card
            sx={{
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                borderRadius: 3,
                transition: 'transform 0.2s ease, box-shadow 0.2s ease',
                '&:hover': {
                    transform: 'translateY(-4px)',
                    boxShadow: '0 18px 36px rgba(16, 24, 40, 0.12)',
                },
            }}
        >
            {/* Screen Image */}
            {screen.primaryImage?.imageUrl ? (
                <Box
                    component="img"
                    src={screen.primaryImage.imageUrl}
                    alt={screen.name}
                    sx={{
                        width: '100%',
                        height: 180,
                        objectFit: 'cover',
                    }}
                />
            ) : (
                <Box
                    sx={{
                        width: '100%',
                        height: 180,
                        bgcolor: 'grey.200',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                    }}
                >
                    <MonitorIcon sx={{ fontSize: 64, color: 'grey.400' }} />
                </Box>
            )}
            <CardContent sx={{ flexGrow: 1 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
                    <Typography variant="h6" component="div" noWrap sx={{ maxWidth: '70%' }}>
                        {screen.name}
                    </Typography>
                    <Box sx={{ display: 'flex', gap: 0.5 }}>
                        {screen.venueType && screen.venueType !== 'Unclassified' && (
                            <Chip
                                label={VENUE_TYPE_OPTIONS.find(v => v.value === screen.venueType)?.label ?? screen.venueType}
                                size="small"
                                variant="outlined"
                                sx={{ borderColor: '#8B5CF6', color: '#8B5CF6' }}
                            />
                        )}
                        <Chip
                            label={screen.status}
                            size="small"
                            color={screen.status === 'Active' ? 'success' : 'default'}
                            variant={screen.status === 'Active' ? 'filled' : 'outlined'}
                        />
                    </Box>
                </Box>

                <Typography variant="body2" color="text.secondary" sx={{ mb: 2, height: 40, overflow: 'hidden' }}>
                    {screen.description}
                </Typography>

                {screen.location && (
                    <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                        <LocationOnIcon fontSize="small" color="action" sx={{ mr: 0.5 }} />
                        <Typography variant="body2" color="text.secondary">
                            {screen.location.city}, {screen.location.state}
                        </Typography>
                    </Box>
                )}

                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
                    {screen.pricePerSlot && (
                        <Typography variant="h6" color="primary">
                            ₹{screen.pricePerSlot.toLocaleString()}/slot
                        </Typography>
                    )}
                    {screen.resolutionWidth && screen.resolutionHeight && (
                        <Typography variant="body2" color="text.secondary">
                            {screen.resolutionWidth}×{screen.resolutionHeight}
                        </Typography>
                    )}
                </Box>

                {/* Tags */}
                {screen.primaryTags && screen.primaryTags.length > 0 && (
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                        {screen.primaryTags.slice(0, 4).map((tag) => (
                            <Tooltip key={tag.tagId} title={`Click to filter by ${tag.displayName}`}>
                                <Box>
                                    <ScreenTagChip
                                        tag={tag}
                                        size="small"
                                        showSource={false}
                                        onClick={onTagClick ? () => onTagClick({
                                            id: tag.tagId,
                                            slug: tag.slug,
                                            displayName: tag.displayName,
                                            category: tag.category,
                                            priority: 0,
                                        }) : undefined}
                                    />
                                </Box>
                            </Tooltip>
                        ))}
                        {(screen.tags?.length || 0) > 4 && (
                            <Chip
                                label={`+${(screen.tags?.length || 0) - 4}`}
                                size="small"
                                variant="outlined"
                            />
                        )}
                    </Box>
                )}
            </CardContent>
            <CardActions>
                <Button size="small" onClick={() => navigate(`/screens/${screen.id}`)}>
                    View Details
                </Button>
                <Button size="small" color="primary" variant="contained" onClick={() => onBook?.(screen.id, screen.name)}>
                    Book now
                </Button>
                <Box sx={{ flex: 1 }} />
                <Tooltip title={inPlan ? 'Remove from plan' : 'Add to plan for a combined estimate & proposal'}>
                    <Button
                        size="small"
                        variant={inPlan ? 'contained' : 'outlined'}
                        startIcon={inPlan ? <PlaylistAddCheckIcon /> : <PlaylistAddIcon />}
                        onClick={() => onTogglePlan?.(screen)}
                        sx={inPlan
                            ? { bgcolor: '#8B5CF6', '&:hover': { bgcolor: '#7C3AED' } }
                            : { borderColor: '#8B5CF6', color: '#8B5CF6' }}
                    >
                        {inPlan ? 'In plan' : 'Plan'}
                    </Button>
                </Tooltip>
            </CardActions>
        </Card>
    );
}
