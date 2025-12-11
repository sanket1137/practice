import { useState } from 'react';
import {
    Box,
    TextField,
    Select,
    MenuItem,
    FormControl,
    InputLabel,
    Button,
    Chip,
    Stack,
} from '@mui/material';
import type { SelectChangeEvent } from '@mui/material/Select';
import { FilterList as FilterIcon, Clear as ClearIcon } from '@mui/icons-material';
import type { BookingStatus } from '../../constants/statusConfig';

interface BookingFilters {
    status: BookingStatus | 'all';
    search: string;
    dateFrom: string;
    dateTo: string;
}

interface BookingFiltersBarProps {
    filters: BookingFilters;
    onFiltersChange: (filters: BookingFilters) => void;
    onClearFilters: () => void;
}

export default function BookingFiltersBar({
    filters,
    onFiltersChange,
    onClearFilters,
}: BookingFiltersBarProps) {
    const [expanded, setExpanded] = useState(false);

    const handleStatusChange = (event: SelectChangeEvent) => {
        onFiltersChange({
            ...filters,
            status: event.target.value as BookingStatus | 'all',
        });
    };

    const handleSearchChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        onFiltersChange({
            ...filters,
            search: event.target.value,
        });
    };

    const hasActiveFilters =
        filters.status !== 'all' ||
        filters.search !== '' ||
        filters.dateFrom !== '' ||
        filters.dateTo !== '';

    return (
        <Box sx={{ mb: 3 }}>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems="center">
                {/* Search */}
                <TextField
                    size="small"
                    placeholder="Search bookings..."
                    value={filters.search}
                    onChange={handleSearchChange}
                    sx={{ flexGrow: 1, minWidth: { xs: '100%', sm: 200 } }}
                />

                {/* Status Filter */}
                <FormControl size="small" sx={{ minWidth: { xs: '100%', sm: 150 } }}>
                    <InputLabel>Status</InputLabel>
                    <Select
                        value={filters.status}
                        label="Status"
                        onChange={handleStatusChange}
                    >
                        <MenuItem value="all">All Status</MenuItem>
                        <MenuItem value="Pending">Pending</MenuItem>
                        <MenuItem value="Approved">Approved</MenuItem>
                        <MenuItem value="Active">Active</MenuItem>
                        <MenuItem value="Completed">Completed</MenuItem>
                        <MenuItem value="Rejected">Rejected</MenuItem>
                    </Select>
                </FormControl>

                {/* More Filters Toggle */}
                <Button
                    size="small"
                    startIcon={<FilterIcon />}
                    onClick={() => setExpanded(!expanded)}
                    variant={expanded ? 'contained' : 'outlined'}
                >
                    {expanded ? 'Less' : 'More'} Filters
                </Button>

                {/* Clear Filters */}
                {hasActiveFilters && (
                    <Button
                        size="small"
                        startIcon={<ClearIcon />}
                        onClick={onClearFilters}
                        color="secondary"
                    >
                        Clear
                    </Button>
                )}
            </Stack>

            {/* Expanded Filters */}
            {expanded && (
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} mt={2}>
                    <TextField
                        size="small"
                        label="From Date"
                        type="date"
                        value={filters.dateFrom}
                        onChange={(e) => onFiltersChange({ ...filters, dateFrom: e.target.value })}
                        InputLabelProps={{ shrink: true }}
                        sx={{ minWidth: { xs: '100%', sm: 200 } }}
                    />
                    <TextField
                        size="small"
                        label="To Date"
                        type="date"
                        value={filters.dateTo}
                        onChange={(e) => onFiltersChange({ ...filters, dateTo: e.target.value })}
                        InputLabelProps={{ shrink: true }}
                        sx={{ minWidth: { xs: '100%', sm: 200 } }}
                    />
                </Stack>
            )}

            {/* Active Filters Display */}
            {hasActiveFilters && (
                <Box mt={2}>
                    <Stack direction="row" spacing={1} flexWrap="wrap">
                        {filters.status !== 'all' && (
                            <Chip
                                label={`Status: ${filters.status}`}
                                onDelete={() => onFiltersChange({ ...filters, status: 'all' })}
                                size="small"
                            />
                        )}
                        {filters.search && (
                            <Chip
                                label={`Search: ${filters.search}`}
                                onDelete={() => onFiltersChange({ ...filters, search: '' })}
                                size="small"
                            />
                        )}
                        {filters.dateFrom && (
                            <Chip
                                label={`From: ${filters.dateFrom}`}
                                onDelete={() => onFiltersChange({ ...filters, dateFrom: '' })}
                                size="small"
                            />
                        )}
                        {filters.dateTo && (
                            <Chip
                                label={`To: ${filters.dateTo}`}
                                onDelete={() => onFiltersChange({ ...filters, dateTo: '' })}
                                size="small"
                            />
                        )}
                    </Stack>
                </Box>
            )}
        </Box>
    );
}
