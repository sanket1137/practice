import { useState, useEffect, useRef } from 'react';
import {
    Dialog,
    DialogTitle,
    DialogContent,
    TextField,
    List,
    ListItem,
    ListItemButton,
    ListItemIcon,
    ListItemText,
    Box,
    Typography,
    Chip,
    InputAdornment,
    Divider,
} from '@mui/material';
import {
    Search as SearchIcon,
    Campaign as CampaignIcon,
    Tv as ScreenIcon,
    BookOnline as BookingIcon,
    History as HistoryIcon,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';

interface SearchResult {
    id: string;
    title: string;
    subtitle?: string;
    type: 'campaign' | 'screen' | 'booking' | 'recent';
    path: string;
}

interface GlobalSearchProps {
    open: boolean;
    onClose: () => void;
}

const ICON_MAP = {
    campaign: <CampaignIcon />,
    screen: <ScreenIcon />,
    booking: <BookingIcon />,
    recent: <HistoryIcon />,
};

const TYPE_LABELS = {
    campaign: 'Campaign',
    screen: 'Screen',
    booking: 'Booking',
    recent: 'Recent',
};

export default function GlobalSearch({ open, onClose }: GlobalSearchProps) {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<SearchResult[]>([]);
    const [selectedIndex, setSelectedIndex] = useState(0);
    const navigate = useNavigate();
    const inputRef = useRef<HTMLInputElement>(null);

    // Mock search function - replace with actual API call
    const performSearch = async (searchQuery: string): Promise<SearchResult[]> => {
        if (!searchQuery.trim()) {
            // Show recent items when no query
            return [
                {
                    id: '1',
                    title: 'Summer Sale Campaign',
                    subtitle: 'Last viewed',
                    type: 'recent',
                    path: '/campaigns/1',
                },
                {
                    id: '2',
                    title: 'Times Square Screen',
                    subtitle: 'Last viewed',
                    type: 'recent',
                    path: '/screens/2',
                },
            ];
        }

        // Simulate API search
        const mockResults: SearchResult[] = [
            {
                id: '1',
                title: 'Summer Sale 2025',
                subtitle: 'Active campaign',
                type: 'campaign',
                path: '/campaigns/1',
            },
            {
                id: '2',
                title: 'Times Square LED',
                subtitle: 'New York, NY',
                type: 'screen',
                path: '/screens/2',
            },
            {
                id: '3',
                title: 'Booking #12345',
                subtitle: 'Pending approval',
                type: 'booking',
                path: '/bookings/3',
            },
        ];

        return mockResults.filter(
            (result) =>
                result.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                result.subtitle?.toLowerCase().includes(searchQuery.toLowerCase())
        );
    };

    // Reset the query when the dialog transitions to open. Adjusting state during
    // render (rather than in an effect) avoids the extra render an effect-based
    // reset would cause. See: https://react.dev/learn/you-might-not-need-an-effect
    const [wasOpen, setWasOpen] = useState(open);
    if (open !== wasOpen) {
        setWasOpen(open);
        if (open) {
            setQuery('');
        }
    }

    useEffect(() => {
        if (open) {
            inputRef.current?.focus();
            performSearch('').then(setResults);
        }
    }, [open]);

    useEffect(() => {
        const timeoutId = setTimeout(() => {
            performSearch(query).then(setResults);
            setSelectedIndex(0);
        }, 300);

        return () => clearTimeout(timeoutId);
    }, [query]);

    const handleSelect = (result: SearchResult) => {
        navigate(result.path);
        onClose();
    };

    const handleKeyDown = (event: React.KeyboardEvent) => {
        if (event.key === 'ArrowDown') {
            event.preventDefault();
            setSelectedIndex((prev) => Math.min(prev + 1, results.length - 1));
        } else if (event.key === 'ArrowUp') {
            event.preventDefault();
            setSelectedIndex((prev) => Math.max(prev - 1, 0));
        } else if (event.key === 'Enter' && results[selectedIndex]) {
            handleSelect(results[selectedIndex]);
        }
    };

    return (
        <Dialog
            open={open}
            onClose={onClose}
            maxWidth="sm"
            fullWidth
            PaperProps={{
                sx: {
                    position: 'fixed',
                    top: 100,
                    m: 0,
                },
            }}
        >
            <DialogTitle sx={{ pb: 1 }}>
                <TextField
                    ref={inputRef}
                    fullWidth
                    placeholder="Search campaigns, screens, bookings..."
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onKeyDown={handleKeyDown}
                    InputProps={{
                        startAdornment: (
                            <InputAdornment position="start">
                                <SearchIcon />
                            </InputAdornment>
                        ),
                    }}
                    variant="outlined"
                    size="small"
                    autoFocus
                />
            </DialogTitle>
            <Divider />
            <DialogContent sx={{ p: 0, maxHeight: 400, overflow: 'auto' }}>
                {results.length === 0 ? (
                    <Box p={4} textAlign="center">
                        <Typography variant="body2" color="text.secondary">
                            {query ? 'No results found' : 'Start typing to search...'}
                        </Typography>
                    </Box>
                ) : (
                    <List disablePadding>
                        {results.map((result, index) => (
                            <ListItem key={result.id} disablePadding>
                                <ListItemButton
                                    selected={index === selectedIndex}
                                    onClick={() => handleSelect(result)}
                                    onMouseEnter={() => setSelectedIndex(index)}
                                >
                                    <ListItemIcon>{ICON_MAP[result.type]}</ListItemIcon>
                                    <ListItemText
                                        primary={result.title}
                                        secondary={result.subtitle}
                                        primaryTypographyProps={{ fontWeight: 'medium' }}
                                    />
                                    <Chip label={TYPE_LABELS[result.type]} size="small" variant="outlined" />
                                </ListItemButton>
                            </ListItem>
                        ))}
                    </List>
                )}
            </DialogContent>
            <Box p={1.5} bgcolor="background.default" borderTop={1} borderColor="divider">
                <Typography variant="caption" color="text.secondary">
                    Use ↑↓ to navigate • Enter to select • Esc to close
                </Typography>
            </Box>
        </Dialog>
    );
}
