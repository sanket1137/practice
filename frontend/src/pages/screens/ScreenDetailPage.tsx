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
    LinearProgress,
    Divider,
    List,
    ListItem,
    ListItemText,
} from '@mui/material';
import {
    LocationOn as LocationIcon,
    Tv as TvIcon,
    AttachMoney as MoneyIcon,
    Schedule as ScheduleIcon,
    BookOnline as BookIcon,
} from '@mui/icons-material';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../services/api';

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
        address: string;
        city: string;
        state: string;
        country: string;
        zipCode: string;
        latitude: number;
        longitude: number;
    };
    slotsPerFrame: number;
    timeFrameMinutes: number;
}

export default function ScreenDetailPage() {
    const { id } = useParams();
    const navigate = useNavigate();

    // Fetch screen details
    const { data: screen, isLoading } = useQuery<Screen>({
        queryKey: ['screen', id],
        queryFn: async () => {
            const response = await api.get(`/screens/${id}`);
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

    if (isLoading) {
        return (
            <Container maxWidth="lg" sx={{ mt: 4 }}>
                <LinearProgress />
            </Container>
        );
    }

    if (!screen) {
        return (
            <Container maxWidth="lg" sx={{ mt: 4 }}>
                <Typography>Screen not found</Typography>
            </Container>
        );
    }

    return (
        <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
            {/* Header */}
            <Box display="flex" justifyContent="space-between" alignItems="start" mb={3}>
                <Box>
                    <Typography variant="h4" gutterBottom>
                        {screen.name}
                    </Typography>
                    <Box display="flex" gap={1} alignItems="center">
                        <Chip label={screen.status} color={getStatusColor(screen.status) as any} />
                        <Box display="flex" alignItems="center" gap={0.5} ml={2}>
                            <LocationIcon fontSize="small" color="action" />
                            <Typography variant="body2" color="textSecondary">
                                {screen.location.city}, {screen.location.state}
                            </Typography>
                        </Box>
                    </Box>
                </Box>
                <Button
                    variant="contained"
                    size="large"
                    startIcon={<BookIcon />}
                    onClick={() => navigate(`/bookings/new?screenId=${id}`)}
                    disabled={screen.status !== 'Active'}
                >
                    Book This Screen
                </Button>
            </Box>

            <Grid container spacing={3}>
                {/* Main Content */}
                <Grid item xs={12} md={8}>
                    {/* Screen Image/Preview */}
                    <Paper sx={{ mb: 3, p: 0, overflow: 'hidden' }}>
                        <Box
                            sx={{
                                height: 400,
                                bgcolor: 'grey.200',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                            }}
                        >
                            <TvIcon sx={{ fontSize: 120, color: 'grey.400' }} />
                        </Box>
                    </Paper>

                    {/* Description */}
                    <Paper sx={{ p: 3, mb: 3 }}>
                        <Typography variant="h6" gutterBottom>
                            Description
                        </Typography>
                        <Typography color="textSecondary">{screen.description}</Typography>
                    </Paper>

                    {/* Specifications */}
                    <Paper sx={{ p: 3 }}>
                        <Typography variant="h6" gutterBottom>
                            Technical Specifications
                        </Typography>
                        <Divider sx={{ my: 2 }} />
                        <Grid container spacing={2}>
                            <Grid item xs={6}>
                                <Typography variant="body2" color="textSecondary">
                                    Resolution
                                </Typography>
                                <Typography variant="body1">
                                    {screen.resolutionWidth} x {screen.resolutionHeight}
                                </Typography>
                            </Grid>
                            <Grid item xs={6}>
                                <Typography variant="body2" color="textSecondary">
                                    Slots Per Frame
                                </Typography>
                                <Typography variant="body1">{screen.slotsPerFrame}</Typography>
                            </Grid>
                            <Grid item xs={6}>
                                <Typography variant="body2" color="textSecondary">
                                    Time Frame
                                </Typography>
                                <Typography variant="body1">{screen.timeFrameMinutes} minutes</Typography>
                            </Grid>
                            <Grid item xs={6}>
                                <Typography variant="body2" color="textSecondary">
                                    Status
                                </Typography>
                                <Typography variant="body1">{screen.status}</Typography>
                            </Grid>
                        </Grid>
                    </Paper>
                </Grid>

                {/* Sidebar */}
                <Grid item xs={12} md={4}>
                    {/* Pricing Info */}
                    <Card sx={{ mb: 3 }}>
                        <CardContent>
                            <Box display="flex" alignItems="center" gap={1} mb={2}>
                                <MoneyIcon color="primary" />
                                <Typography variant="h6">Pricing</Typography>
                            </Box>
                            <Typography variant="h4" color="primary" gutterBottom>
                                {screen.currency} {screen.pricePerSlot.toLocaleString()}
                            </Typography>
                            <Typography variant="body2" color="textSecondary">
                                per slot
                            </Typography>
                            <Divider sx={{ my: 2 }} />
                            <Box display="flex" alignItems="center" gap={1}>
                                <ScheduleIcon fontSize="small" color="action" />
                                <Typography variant="body2">
                                    {screen.slotsPerFrame} slots per {screen.timeFrameMinutes} minutes
                                </Typography>
                            </Box>
                        </CardContent>
                    </Card>

                    {/* Location */}
                    <Card>
                        <CardContent>
                            <Box display="flex" alignItems="center" gap={1} mb={2}>
                                <LocationIcon color="primary" />
                                <Typography variant="h6">Location</Typography>
                            </Box>
                            <List disablePadding>
                                <ListItem disablePadding>
                                    <ListItemText
                                        primary="Address"
                                        secondary={screen.location.address}
                                        primaryTypographyProps={{ variant: 'body2', color: 'textSecondary' }}
                                        secondaryTypographyProps={{ variant: 'body1' }}
                                    />
                                </ListItem>
                                <ListItem disablePadding>
                                    <ListItemText
                                        primary="City"
                                        secondary={screen.location.city}
                                        primaryTypographyProps={{ variant: 'body2', color: 'textSecondary' }}
                                        secondaryTypographyProps={{ variant: 'body1' }}
                                    />
                                </ListItem>
                                <ListItem disablePadding>
                                    <ListItemText
                                        primary="State/Province"
                                        secondary={screen.location.state}
                                        primaryTypographyProps={{ variant: 'body2', color: 'textSecondary' }}
                                        secondaryTypographyProps={{ variant: 'body1' }}
                                    />
                                </ListItem>
                                <ListItem disablePadding>
                                    <ListItemText
                                        primary="Country"
                                        secondary={screen.location.country}
                                        primaryTypographyProps={{ variant: 'body2', color: 'textSecondary' }}
                                        secondaryTypographyProps={{ variant: 'body1' }}
                                    />
                                </ListItem>
                                <ListItem disablePadding>
                                    <ListItemText
                                        primary="ZIP Code"
                                        secondary={screen.location.zipCode}
                                        primaryTypographyProps={{ variant: 'body2', color: 'textSecondary' }}
                                        secondaryTypographyProps={{ variant: 'body1' }}
                                    />
                                </ListItem>
                            </List>
                        </CardContent>
                    </Card>
                </Grid>
            </Grid>
        </Container>
    );
}
