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
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    DialogContentText,
    Tabs,
    Tab,
    Alert,
} from '@mui/material';
import type { ChipProps } from '@mui/material';
import {
    LocationOn as LocationIcon,
    Tv as TvIcon,
    AttachMoney as MoneyIcon,
    Schedule as ScheduleIcon,
    BookOnline as BookIcon,
    Edit as EditIcon,
    Delete as DeleteIcon,
    LocalOffer as TagIcon,
    CalendarMonth as CalendarIcon,
    Visibility as VisibilityIcon,
    PhotoLibrary as ImagesIcon,
    LiveTv as LiveTvIcon,
    VideoSettings as VideoSettingsIcon,
    ShowChart as ActivityIcon,
    DevicesOther as DevicesIcon,
    Verified as VerifiedIcon,
} from '@mui/icons-material';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { isAxiosError } from 'axios';
import { api } from '../../services/api';
import { useAuthStore } from '../../store/authStore';
import { useSnackbar } from 'notistack';
import SlotCalendarView from '../../components/screens/SlotCalendarView';
import LivePreviewWidget from '../../components/common/LivePreviewWidget';
import { WebRTCPlayer } from '../../components/streaming/WebRTCPlayer';
import DefaultVideoSettings from '../../components/screens/DefaultVideoSettings';
import LiveActivityTab from '../../components/screens/LiveActivityTab';
import ScreenTagsTab from '../../components/screens/ScreenTagsTab';
import ScreenTagChip from '../../components/screens/ScreenTagChip';
import ScreenImageUpload from '../../components/screens/ScreenImageUpload';
import ScreenImageGallery from '../../components/screens/ScreenImageGallery';
import DeviceManagementTab from '../../components/screens/DeviceManagementTab';
import RevenueEstimateCard, { type RevenueEstimate } from '../../components/screens/RevenueEstimateCard';
import SelfReserveDialog from '../../components/bookings/SelfReserveDialog';
import VerificationTab from '../../components/screens/VerificationTab';
import { ScreenAvailabilityCalendar } from '../../components/screens/ScreenAvailabilityCalendar';
import { useEffect, useState, useMemo } from 'react';
import { getScreenTags } from '../../services/screenTagsService';
import type { ScreenTagDetail, ScreenImage } from '../../types/screen';

interface Screen {
    id: string;
    name: string;
    description: string;
    status: string;
    resolutionWidth: number;
    resolutionHeight: number;
    pricePerSlot: number;
    currency: string;
    timezone: string;
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
    dailyTotalImpressions?: number;
    operatingSchedule?: {
        enabled: boolean;
    };
    images?: ScreenImage[];
    primaryImage?: ScreenImage;
    isOnline?: boolean;
    hasApiKey?: boolean;
    revenueEstimate?: RevenueEstimate;
}

export default function ScreenDetailPage() {
    const { id } = useParams();
    const navigate = useNavigate();
    const user = useAuthStore((state) => state.user);
    const { enqueueSnackbar } = useSnackbar();
    const queryClient = useQueryClient();
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [selfReserveOpen, setSelfReserveOpen] = useState(false);
    const [activeTab, setActiveTab] = useState(0);

    // Fetch screen details
    const { data: screen, isLoading } = useQuery<Screen>({
        queryKey: ['screen', id],
        queryFn: async () => {
            const response = await api.get(`/screens/${id}`);
            return response.data.data; // ApiResponse wrapper
        },
    });

    // Check stream access for advertisers
    const { data: streamAccess } = useQuery({
        queryKey: ['stream-access', id],
        queryFn: async () => {
            const response = await api.get(`/screens/${id}/streaming/access`);
            console.log('[Stream Access] Response:', response.data.data);
            console.log('[User Role]:', user?.role);
            return response.data.data;
        },
        enabled: !!id && !!user, // Temporarily check for all users
    });

    // Fetch screen tags for advertisers overview
    const { data: screenTags = [] } = useQuery<ScreenTagDetail[]>({
        queryKey: ['screen-tags', id],
        queryFn: () => getScreenTags(id!),
        enabled: !!id && user?.role === 'Advertiser',
    });

    // Delete mutation
    const deleteMutation = useMutation({
        mutationFn: async () => {
            await api.delete(`/screens/${id}`);
        },
        onSuccess: () => {
            enqueueSnackbar('Screen deleted successfully', { variant: 'success' });
            queryClient.invalidateQueries({ queryKey: ['screens'] });
            navigate('/screens');
        },
        onError: (error: unknown) => {
            const message = isAxiosError(error) ? (error.response?.data as { message?: string } | undefined)?.message : undefined;
            enqueueSnackbar(message || 'Failed to delete screen', { variant: 'error' });
        },
    });

    // Determine if user is the screen owner
    const isOwner = useMemo(() => {
        if (!user) return false;
        return user.role === 'ScreenOwner' || user.role === 'Admin';
    }, [user]);

    // Define tabs based on user role
    const tabs = useMemo(() => {
        if (isOwner) {
            // Screen Owner / Admin tabs
            return [
                { id: 'overview', label: 'Overview', icon: <VisibilityIcon /> },
                { id: 'images', label: 'Images', icon: <ImagesIcon /> },
                { id: 'bookings', label: 'Bookings', icon: <CalendarIcon /> },
                { id: 'live-activity', label: 'Live Activity', icon: <ActivityIcon /> },
                { id: 'default-video', label: 'Default Video', icon: <VideoSettingsIcon /> },
                { id: 'device', label: 'Device', icon: <DevicesIcon /> },
                { id: 'verification', label: 'Verification', icon: <VerifiedIcon /> },
                { id: 'live-stream', label: 'Live Stream', icon: <LiveTvIcon /> },
            ];
        } else {
            // Advertiser tabs - focused on booking decision
            const advertiserTabs = [
                { id: 'overview', label: 'Overview', icon: <VisibilityIcon /> },
                { id: 'tags-audience', label: 'Tags & Audience', icon: <TagIcon /> },
                { id: 'bookings', label: 'Availability', icon: <CalendarIcon /> },
            ];
            
            // Add live stream tab if advertiser has access (e.g., approved booking)
            if (streamAccess?.hasAccess) {
                advertiserTabs.push({ id: 'live-stream', label: 'Live Stream', icon: <LiveTvIcon /> });
            }
            
            return advertiserTabs;
        }
    }, [isOwner, streamAccess?.hasAccess]);

    // Get primary tags for advertiser overview
    const primaryTags = useMemo(() => {
        return screenTags.filter(t => t.isPrimary).slice(0, 5);
    }, [screenTags]);

    const handleDelete = () => {
        deleteMutation.mutate();
        setDeleteDialogOpen(false);
    };

    const getStatusColor = (status: string): ChipProps['color'] => {
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

    // Get current tab id
    const currentTabId = tabs[activeTab]?.id || 'overview';

    // Deep-linking: honour ?tab=<id> (e.g. the campaign page's "Watch live"
    // button links to ?tab=live-stream). Runs whenever the tab list settles —
    // access-gated tabs (live-stream) appear only after the access check loads.
    const [searchParams] = useSearchParams();
    const requestedTab = searchParams.get('tab');
    useEffect(() => {
        if (!requestedTab) return;
        const index = tabs.findIndex(t => t.id === requestedTab);
        if (index >= 0 && index !== activeTab) {
            setActiveTab(index);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [requestedTab, tabs]);

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
                        <Chip label={screen.status} color={getStatusColor(screen.status)} />
                        <Box display="flex" alignItems="center" gap={0.5} ml={2}>
                            <LocationIcon fontSize="small" color="action" />
                            <Typography variant="body2" color="textSecondary">
                                {screen.location.city}, {screen.location.state}
                            </Typography>
                        </Box>
                    </Box>
                </Box>
                <Box display="flex" gap={1}>
                    {(user?.role === 'ScreenOwner' || user?.role === 'Admin') && (
                        <>
                            <Button
                                variant="outlined"
                                startIcon={<EditIcon />}
                                onClick={() => navigate(`/screens/${id}/edit`)}
                            >
                                Edit
                            </Button>
                            <Button
                                variant="outlined"
                                startIcon={<MoneyIcon />}
                                onClick={() => navigate(`/screens/${id}/pricing`)}
                            >
                                Pricing rules
                            </Button>
                            <Button
                                variant="outlined"
                                color="error"
                                startIcon={<DeleteIcon />}
                                onClick={() => setDeleteDialogOpen(true)}
                            >
                                Delete
                            </Button>
                        </>
                    )}
                    {/* Self-reserve button for Screen Owners */}
                    {user?.role === 'ScreenOwner' && (
                        <Button
                            variant="contained"
                            size="large"
                            startIcon={<BookIcon />}
                            onClick={() => setSelfReserveOpen(true)}
                            disabled={screen.status !== 'Active'}
                        >
                            Reserve Slot
                        </Button>
                    )}
                    {/* Only show Book button for Advertisers and Admins, not Screen Owners */}
                    {user?.role !== 'ScreenOwner' && (
                        <Button
                            variant="contained"
                            size="large"
                            startIcon={<BookIcon />}
                            onClick={() => navigate(`/bookings/new?screenId=${id}`)}
                            disabled={screen.status !== 'Active'}
                        >
                            Book This Screen
                        </Button>
                    )}
                </Box>
            </Box>
            {/* Tabs */}
            <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
                <Tabs value={activeTab} onChange={(_, value) => setActiveTab(value)}>
                    {tabs.map((tab) => (
                        <Tab key={tab.id} label={tab.label} />
                    ))}
                </Tabs>
            </Box>

            {/* Overview Tab */}
            {currentTabId === 'overview' && (
                    <Grid container spacing={3}>
                        {/* Main Content */}
                        <Grid
                            size={{
                                xs: 12,
                                md: 8
                            }}>
                            {/* Screen Image/Preview */}
                            <Paper sx={{ mb: 3, p: 0, overflow: 'hidden' }}>
                                {screen.primaryImage?.imageUrl ? (
                                    <Box
                                        component="img"
                                        src={screen.primaryImage.imageUrl}
                                        alt={screen.name}
                                        sx={{
                                            width: '100%',
                                            height: 400,
                                            objectFit: 'cover',
                                        }}
                                    />
                                ) : (
                                    <Box
                                        sx={{
                                            height: 400,
                                            bgcolor: 'grey.200',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            flexDirection: 'column',
                                        }}
                                    >
                                        <TvIcon sx={{ fontSize: 120, color: 'grey.400' }} />
                                        {isOwner && (
                                            <Typography variant="body2" color="textSecondary" sx={{ mt: 2 }}>
                                                Add images in the "Images" tab
                                            </Typography>
                                        )}
                                    </Box>
                                )}
                            </Paper>

                            {/* Image Gallery - Show all photos for both advertisers and owners */}
                            {screen.images && screen.images.length > 0 && (
                                <Paper sx={{ mb: 3, p: 3 }}>
                                    <Box display="flex" alignItems="center" gap={1} mb={2}>
                                        <ImagesIcon color="primary" />
                                        <Typography variant="h6">Screen Photos</Typography>
                                        <Chip 
                                            label={`${screen.images.length} ${screen.images.length === 1 ? 'photo' : 'photos'}`}
                                            size="small"
                                            color="primary"
                                            variant="outlined"
                                        />
                                    </Box>
                                    <Typography variant="body2" color="textSecondary" sx={{ mb: 2 }}>
                                        {isOwner 
                                            ? 'Photos help advertisers understand your screen placement and surroundings.'
                                            : 'View screen photos to evaluate placement and surroundings before booking.'}
                                    </Typography>
                                    <ScreenImageGallery 
                                        images={screen.images}
                                        screenName={screen.name}
                                        showTabs={true}
                                    />
                                </Paper>
                            )}

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
                                    <Grid size={6}>
                                        <Typography variant="body2" color="textSecondary">
                                            Resolution
                                        </Typography>
                                        <Typography variant="body1">
                                            {screen.resolutionWidth} x {screen.resolutionHeight}
                                        </Typography>
                                    </Grid>
                                    <Grid size={6}>
                                        <Typography variant="body2" color="textSecondary">
                                            Slots Per Frame
                                        </Typography>
                                        <Typography variant="body1">{screen.slotsPerFrame}</Typography>
                                    </Grid>
                                    <Grid size={6}>
                                        <Typography variant="body2" color="textSecondary">
                                            Time Frame
                                        </Typography>
                                        <Typography variant="body1">{screen.timeFrameMinutes} minutes</Typography>
                                    </Grid>
                                    <Grid size={6}>
                                        <Typography variant="body2" color="textSecondary">
                                            Status
                                        </Typography>
                                        <Typography variant="body1">{screen.status}</Typography>
                                    </Grid>
                                    <Grid size={6}>
                                        <Typography variant="body2" color="textSecondary">
                                            Timezone
                                        </Typography>
                                        <Typography variant="body1">
                                            {screen.timezone || 'UTC'}
                                        </Typography>
                                    </Grid>
                                </Grid>
                            </Paper>
                        </Grid>

                        {/* Sidebar */}
                        <Grid
                            size={{
                                xs: 12,
                                md: 4
                            }}>
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
                            <Card sx={{ mb: 3 }}>
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

                            {/* Tags Preview for Advertisers */}
                            {!isOwner && primaryTags.length > 0 && (
                                <Card sx={{ mb: 3 }}>
                                    <CardContent>
                                        <Box display="flex" alignItems="center" gap={1} mb={2}>
                                            <TagIcon color="primary" />
                                            <Typography variant="h6">Audience Tags</Typography>
                                        </Box>
                                        <Box display="flex" flexWrap="wrap" gap={1} mb={2}>
                                            {primaryTags.map((tag) => (
                                                <ScreenTagChip key={tag.tagId} tag={tag} size="small" />
                                            ))}
                                        </Box>
                                        {screenTags.length > 5 && (
                                            <Button
                                                size="small"
                                                onClick={() => setActiveTab(tabs.findIndex(t => t.id === 'tags-audience'))}
                                            >
                                                View all {screenTags.length} tags →
                                            </Button>
                                        )}
                                    </CardContent>
                                </Card>
                            )}

                            {/* Quick Info for Advertisers */}
                            {!isOwner && (
                                <Card>
                                    <CardContent>
                                        <Typography variant="h6" gutterBottom>Quick Info</Typography>
                                        <List disablePadding dense>
                                            <ListItem disablePadding sx={{ py: 0.5 }}>
                                                <ListItemText
                                                    primary={
                                                        <Box display="flex" alignItems="center" gap={1}>
                                                            <ImagesIcon fontSize="small" color="action" />
                                                            <span>Screen Photos</span>
                                                        </Box>
                                                    }
                                                    secondary={
                                                        screen.images && screen.images.length > 0
                                                            ? `${screen.images.length} photos available`
                                                            : 'No photos uploaded yet'
                                                    }
                                                />
                                            </ListItem>
                                            <ListItem disablePadding sx={{ py: 0.5 }}>
                                                <ListItemText
                                                    primary={
                                                        <Box display="flex" alignItems="center" gap={1}>
                                                            <VisibilityIcon fontSize="small" color="action" />
                                                            <span>Daily Impressions</span>
                                                        </Box>
                                                    }
                                                    secondary={screen.dailyTotalImpressions?.toLocaleString() || 'Not specified'}
                                                />
                                            </ListItem>
                                            <ListItem disablePadding sx={{ py: 0.5 }}>
                                                <ListItemText
                                                    primary={
                                                        <Box display="flex" alignItems="center" gap={1}>
                                                            <ScheduleIcon fontSize="small" color="action" />
                                                            <span>Active Hours</span>
                                                        </Box>
                                                    }
                                                    secondary={screen.operatingSchedule?.enabled 
                                                        ? 'Custom schedule' 
                                                        : '24/7 operation'}
                                                />
                                            </ListItem>
                                        </List>
                                    </CardContent>
                                </Card>
                            )}
                        </Grid>

                        {/* Availability Calendar - Full Width */}
                        <Grid size={12}>
                            <Card variant="outlined" sx={{ bgcolor: 'background.paper', p: 3 }}>
                                <ScreenAvailabilityCalendar screenId={screen.id} />
                            </Card>
                        </Grid>

                        {/* Revenue Estimate - Full Width */}
                        {screen.revenueEstimate && (
                            <Grid size={12}>
                                <RevenueEstimateCard
                                    estimate={screen.revenueEstimate}
                                    currency={screen.currency}
                                />
                            </Grid>
                        )}
                    </Grid>
                )
            }

            {/* Images Tab (Owner only) */}
            {currentTabId === 'images' && isOwner && (
                <Paper sx={{ p: 3 }}>
                    <Typography variant="h6" gutterBottom>
                        Screen Images
                    </Typography>
                    <Typography variant="body2" color="textSecondary" paragraph>
                        Upload photos of your screen and its surroundings. These images help advertisers understand
                        the screen's location and audience. A primary image will be shown on the screen card.
                    </Typography>
                    <ScreenImageUpload 
                        screenId={id!} 
                        onImagesChanged={() => queryClient.invalidateQueries({ queryKey: ['screen', id] })}
                    />
                </Paper>
            )}

            {/* Tags & Audience Tab (Advertiser only) */}
            {currentTabId === 'tags-audience' && (
                <ScreenTagsTab screenId={id!} />
            )}

            {/* Bookings/Availability Tab */}
            {currentTabId === 'bookings' && (
                <Box>
                    {!isOwner && (
                        <Alert severity="info" sx={{ mb: 3 }}>
                            <Typography variant="body2">
                                Select available time slots below to book this screen. Green slots indicate availability.
                            </Typography>
                        </Alert>
                    )}
                    <SlotCalendarView screenId={id!} />
                </Box>
            )}

            {/* Live Activity Tab (Owner only) */}
            {currentTabId === 'live-activity' && isOwner && (
                <LiveActivityTab screenId={id as string} />
            )}

            {/* Default Video Tab (Owner only) */}
            {currentTabId === 'default-video' && isOwner && (
                <DefaultVideoSettings screenId={id!} />
            )}

            {/* Device Management Tab (Owner only) */}
            {currentTabId === 'device' && isOwner && (
                <DeviceManagementTab screenId={id!} hasApiKey={screen?.hasApiKey ?? false} />
            )}

            {/* Verification Tab (Owner only) */}
            {currentTabId === 'verification' && isOwner && (
                <VerificationTab screenId={id!} />
            )}

            {/* Live Stream Tab (Owner or Advertiser with access) */}
            {currentTabId === 'live-stream' && (isOwner || streamAccess?.hasAccess) && (
                    <Box>
                        <Typography variant="h6" gutterBottom>
                            Real-Time Screen Activity
                        </Typography>
                        <Typography variant="body2" color="textSecondary" paragraph>
                            Monitor live playback on this screen in real-time
                        </Typography>

                        <Grid container spacing={3}>
                            {/* WebRTC Live Stream */}
                            <Grid
                                size={{
                                    xs: 12,
                                    md: 8
                                }}>
                                <WebRTCPlayer
                                    screenId={id!}
                                    autoStart={false}
                                />
                            </Grid>

                            {/* Live Preview Widget */}
                            <Grid
                                size={{
                                    xs: 12,
                                    md: 4
                                }}>
                                <LivePreviewWidget screenId={id!} mode="screen" isScreenOnline={screen?.isOnline} />
                            </Grid>
                        </Grid>
                    </Box>
                )
            }
            {/* Self-Reserve Dialog */}
            {screen && (
                <SelfReserveDialog
                    open={selfReserveOpen}
                    onClose={() => setSelfReserveOpen(false)}
                    screenId={screen.id}
                    screenName={screen.name}
                />
            )}
            {/* Delete Confirmation Dialog */}
            <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
                <DialogTitle>Delete Screen?</DialogTitle>
                <DialogContent>
                    <DialogContentText>
                        Are you sure you want to delete "{screen?.name}"? This action cannot be undone.
                        All bookings associated with this screen will be affected.
                    </DialogContentText>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
                    <Button onClick={handleDelete} color="error" variant="contained">
                        Delete
                    </Button>
                </DialogActions>
            </Dialog>
        </Container >
    );
}
