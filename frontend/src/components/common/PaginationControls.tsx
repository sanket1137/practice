import React from 'react';
import {
    Box,
    TablePagination,
    Select,
    MenuItem,
    FormControl,
    InputLabel,
    TextField,
    InputAdornment,
    IconButton,
    Chip,
    Stack,
    Typography,
    useTheme,
    useMediaQuery,
} from '@mui/material';
import {
    Search as SearchIcon,
    Clear as ClearIcon,
    FilterList as FilterIcon,
} from '@mui/icons-material';

export interface PaginationState {
    page: number;
    pageSize: number;
    totalCount: number;
    totalPages: number;
    searchTerm?: string;
    sortBy?: string;
    sortDirection?: 'asc' | 'desc';
    filters?: Record<string, string>;
}

export interface PaginationControlsProps {
    state: PaginationState;
    onPageChange: (page: number) => void;
    onPageSizeChange: (pageSize: number) => void;
    onSearchChange?: (searchTerm: string) => void;
    onSortChange?: (sortBy: string, sortDirection: 'asc' | 'desc') => void;
    onFilterChange?: (filters: Record<string, string>) => void;
    pageSizeOptions?: number[];
    sortOptions?: { value: string; label: string }[];
    filterOptions?: { field: string; label: string; options: { value: string; label: string }[] }[];
    showSearch?: boolean;
    showSort?: boolean;
    showFilters?: boolean;
    searchPlaceholder?: string;
    disabled?: boolean;
}

/**
 * Reusable pagination controls component with search, sort, and filter capabilities.
 * Uses Material UI components for consistent styling.
 */
export const PaginationControls: React.FC<PaginationControlsProps> = ({
    state,
    onPageChange,
    onPageSizeChange,
    onSearchChange,
    onSortChange,
    onFilterChange,
    pageSizeOptions = [5, 10, 25, 50],
    sortOptions = [],
    filterOptions = [],
    showSearch = true,
    showSort = false,
    showFilters = false,
    searchPlaceholder = 'Search...',
    disabled = false,
}) => {
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
    const [localSearch, setLocalSearch] = React.useState(state.searchTerm || '');
    const searchTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

    // Debounced search
    const handleSearchChange = (value: string) => {
        setLocalSearch(value);
        
        if (searchTimeoutRef.current) {
            clearTimeout(searchTimeoutRef.current);
        }
        
        searchTimeoutRef.current = setTimeout(() => {
            onSearchChange?.(value);
        }, 300);
    };

    const handleClearSearch = () => {
        setLocalSearch('');
        onSearchChange?.('');
    };

    const handleFilterChange = (field: string, value: string) => {
        const newFilters = { ...state.filters, [field]: value };
        if (!value) {
            delete newFilters[field];
        }
        onFilterChange?.(newFilters);
    };

    const activeFiltersCount = Object.keys(state.filters || {}).length;

    return (
        <Box sx={{ width: '100%' }}>
            {/* Search and Filters Row */}
            {(showSearch || showSort || showFilters) && (
                <Stack
                    direction={isMobile ? 'column' : 'row'}
                    spacing={2}
                    sx={{ mb: 2 }}
                    alignItems={isMobile ? 'stretch' : 'center'}
                >
                    {/* Search */}
                    {showSearch && onSearchChange && (
                        <TextField
                            size="small"
                            placeholder={searchPlaceholder}
                            value={localSearch}
                            onChange={(e) => handleSearchChange(e.target.value)}
                            disabled={disabled}
                            sx={{ minWidth: 200, flexGrow: isMobile ? 1 : 0 }}
                            InputProps={{
                                startAdornment: (
                                    <InputAdornment position="start">
                                        <SearchIcon fontSize="small" color="action" />
                                    </InputAdornment>
                                ),
                                endAdornment: localSearch && (
                                    <InputAdornment position="end">
                                        <IconButton
                                            size="small"
                                            onClick={handleClearSearch}
                                            edge="end"
                                        >
                                            <ClearIcon fontSize="small" />
                                        </IconButton>
                                    </InputAdornment>
                                ),
                            }}
                        />
                    )}

                    {/* Sort */}
                    {showSort && sortOptions.length > 0 && onSortChange && (
                        <Stack direction="row" spacing={1}>
                            <FormControl size="small" sx={{ minWidth: 120 }}>
                                <InputLabel>Sort By</InputLabel>
                                <Select
                                    value={state.sortBy || ''}
                                    label="Sort By"
                                    onChange={(e) => onSortChange(e.target.value, state.sortDirection || 'desc')}
                                    disabled={disabled}
                                >
                                    {sortOptions.map((option) => (
                                        <MenuItem key={option.value} value={option.value}>
                                            {option.label}
                                        </MenuItem>
                                    ))}
                                </Select>
                            </FormControl>
                            <FormControl size="small" sx={{ minWidth: 100 }}>
                                <InputLabel>Order</InputLabel>
                                <Select
                                    value={state.sortDirection || 'desc'}
                                    label="Order"
                                    onChange={(e) => onSortChange(state.sortBy || '', e.target.value as 'asc' | 'desc')}
                                    disabled={disabled}
                                >
                                    <MenuItem value="asc">Ascending</MenuItem>
                                    <MenuItem value="desc">Descending</MenuItem>
                                </Select>
                            </FormControl>
                        </Stack>
                    )}

                    {/* Filters */}
                    {showFilters && filterOptions.length > 0 && onFilterChange && (
                        <Stack direction="row" spacing={1} alignItems="center">
                            <FilterIcon fontSize="small" color="action" />
                            {filterOptions.map((filter) => (
                                <FormControl key={filter.field} size="small" sx={{ minWidth: 120 }}>
                                    <InputLabel>{filter.label}</InputLabel>
                                    <Select
                                        value={state.filters?.[filter.field] || ''}
                                        label={filter.label}
                                        onChange={(e) => handleFilterChange(filter.field, e.target.value)}
                                        disabled={disabled}
                                    >
                                        <MenuItem value="">All</MenuItem>
                                        {filter.options.map((option) => (
                                            <MenuItem key={option.value} value={option.value}>
                                                {option.label}
                                            </MenuItem>
                                        ))}
                                    </Select>
                                </FormControl>
                            ))}
                            {activeFiltersCount > 0 && (
                                <Chip
                                    label={`${activeFiltersCount} active`}
                                    size="small"
                                    onDelete={() => onFilterChange({})}
                                    color="primary"
                                    variant="outlined"
                                />
                            )}
                        </Stack>
                    )}
                </Stack>
            )}

            {/* Pagination Row */}
            <Box
                sx={{
                    display: 'flex',
                    flexDirection: isMobile ? 'column' : 'row',
                    justifyContent: 'space-between',
                    alignItems: isMobile ? 'flex-start' : 'center',
                    gap: 1,
                }}
            >
                <Typography variant="body2" color="text.secondary">
                    {state.totalCount === 0
                        ? 'No results'
                        : `Showing ${Math.min((state.page - 1) * state.pageSize + 1, state.totalCount)} - ${Math.min(state.page * state.pageSize, state.totalCount)} of ${state.totalCount}`}
                </Typography>

                <TablePagination
                    component="div"
                    count={state.totalCount}
                    page={state.page - 1} // MUI uses 0-based indexing
                    onPageChange={(_, newPage) => onPageChange(newPage + 1)}
                    rowsPerPage={state.pageSize}
                    onRowsPerPageChange={(e) => {
                        onPageSizeChange(parseInt(e.target.value, 10));
                        onPageChange(1); // Reset to first page when changing page size
                    }}
                    rowsPerPageOptions={pageSizeOptions}
                    disabled={disabled}
                    labelRowsPerPage={isMobile ? '' : 'Per page:'}
                    sx={{
                        '& .MuiTablePagination-toolbar': {
                            minHeight: 'auto',
                            paddingLeft: 0,
                        },
                        '& .MuiTablePagination-selectLabel': {
                            display: isMobile ? 'none' : 'block',
                        },
                    }}
                />
            </Box>
        </Box>
    );
};

export default PaginationControls;
