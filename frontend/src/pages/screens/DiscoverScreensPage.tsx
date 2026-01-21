import { useState, useCallback } from 'react';
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
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import FilterListIcon from '@mui/icons-material/FilterList';
import LocationOnIcon from '@mui/icons-material/LocationOn';
import MonitorIcon from '@mui/icons-material/Monitor';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import ClearIcon from '@mui/icons-material/Clear';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { searchScreens, getAllTags } from '../../services/screenTagsService';
import ScreenTagChip from '../../components/screens/ScreenTagChip';
import type { Screen, MasterTag, SearchScreensRequest } from '../../types/screen';
import { TAG_CATEGORIES, TAG_CATEGORY_LABELS } from '../../types/screen';

const DEFAULT_PAGE_SIZE = 12;

export default function DiscoverScreensPage() {
    const [showFilters, setShowFilters] = useState(false);
    
    // Search and filter state
    const [searchText, setSearchText] = useState('');
    const [selectedTags, setSelectedTags] = useState<MasterTag[]>([]);
    const [selectedCategory, setSelectedCategory] = useState<string>('');
    const [city, setCity] = useState('');
    const [state, setState] = useState('');
    const [priceRange, setPriceRange] = useState<[number, number]>([0, 10000]);
    const [sortBy, setSortBy] = useState<string>('created');
    const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
    const [page, setPage] = useState(1);

    // Build search request
    const buildSearchRequest = useCallback((): SearchScreensRequest => {
        const request: SearchScreensRequest = {
            page,
            pageSize: DEFAULT_PAGE_SIZE,
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

        return request;
    }, [page, searchText, city, state, selectedTags, selectedCategory, priceRange, sortBy, sortDirection]);

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

    const hasActiveFilters = searchText || selectedTags.length > 0 || selectedCategory || city || state || priceRange[0] > 0 || priceRange[1] < 10000;

    return (
        <Container maxWidth="xl" sx={{ mt: 4, mb: 4 }}>
            {/* Header */}
            <Box sx={{ mb: 4 }}>
                <Typography variant="h4" gutterBottom>
                    Discover Screens
                </Typography>
                <Typography variant="body1" color="text.secondary">
                    Find the perfect digital screens for your advertising campaigns. Filter by location, audience, and more.
                </Typography>
            </Box>

            {/* Search Bar */}
            <Paper sx={{ p: 2, mb: 3 }}>
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
            </Box>

            {/* Results */}
            {isLoading ? (
                <Grid container spacing={3}>
                    {[...Array(6)].map((_, i) => (
                        <Grid key={i} size={{ xs: 12, sm: 6, md: 4 }}>
                            <Skeleton variant="rectangular" height={300} />
                        </Grid>
                    ))}
                </Grid>
            ) : error ? (
                <Alert severity="error">
                    Failed to load screens. Please try again.
                </Alert>
            ) : searchResult?.screens.length === 0 ? (
                <Paper sx={{ p: 4, textAlign: 'center' }}>
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
                                <ScreenCard screen={screen} onTagClick={handleTagClick} />
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
        </Container>
    );
}

interface ScreenCardProps {
    screen: Screen;
    onTagClick?: (tag: MasterTag) => void;
}

function ScreenCard({ screen, onTagClick }: ScreenCardProps) {
    const navigate = useNavigate();

    return (
        <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            <CardContent sx={{ flexGrow: 1 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
                    <Typography variant="h6" component="div" noWrap sx={{ maxWidth: '70%' }}>
                        {screen.name}
                    </Typography>
                    <Chip
                        label={screen.status}
                        size="small"
                        color={screen.status === 'Active' ? 'success' : 'default'}
                    />
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
                <Button size="small" color="primary" onClick={() => navigate(`/campaigns/create?screenId=${screen.id}`)}>
                    Book Now
                </Button>
            </CardActions>
        </Card>
    );
}
