import { useState, useEffect } from 'react';
import {
    Card,
    CardContent,
    Typography,
    Box,
    Button,
    Chip,
    Grid,
    LinearProgress,
    Avatar
} from '@mui/material';
import {
    Monitor as ScreenIcon,
    TrendingUp as TrendingIcon,
    SignalCellularAlt as SignalIcon,
    Videocam as VideocamIcon
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { websocketService } from '../../services/websocket';
import { formatDistanceToNow } from 'date-fns';
import { api } from '../../services/api';

interface ScreenStats {
    screenId: string;
    screenName: string;
    status: string;
    playsToday: number;
    lastPlayTimestamp?: string;
    currentCreative?: {
        id: string;
        name: string;
    };
}

interface CampaignScreenStatsProps {
    campaignId: string;
}

// SignalR serializes camelCase on the wire — handlers must read camelCase.
// (These used to read PascalCase, so even delivered events were ignored.)
interface CampaignScreenUpdateEvent {
    campaignId: string;
    screenId: string;
    playCount: number;
    timestamp: string;
}

interface AdPlaybackEventPayload {
    screenId: string;
    campaignId?: string | null;
    creativeId?: string | null;
    slotNumber?: number;
    timestamp: string;
}

interface ScreenStatusChangedEvent {
    screenId: string;
    isOnline: boolean;
    lastSeen?: string;
}

export default function CampaignScreenStats({ campaignId }: CampaignScreenStatsProps) {
    const navigate = useNavigate();
    const [screens, setScreens] = useState<ScreenStats[]>([]);
    const [totalPlays, setTotalPlays] = useState(0);
    const [activeScreens, setActiveScreens] = useState(0);
    const [loading, setLoading] = useState(true);

    // Load initial stats
    useEffect(() => {
        const loadStats = async () => {
            try {
                setLoading(true);
                const response = await api.get(`/campaigns/${campaignId}/screens/stats`);
                const result = response.data;
                if (result?.success && result?.data) {
                    setScreens(result.data.screens || []);
                    setTotalPlays(result.data.totalPlays || 0);
                    setActiveScreens(result.data.activeScreens || 0);
                }
            } catch (error) {
                console.error('[CampaignScreenStats] Failed to load:', error);
            } finally {
                setLoading(false);
            }
        };

        loadStats();
    }, [campaignId]);

    // Real-time updates. Joining the campaign_{id} SignalR group is what makes
    // events arrive at all — registering listeners without SubscribeToCampaign
    // (the old behaviour) left this tab permanently static.
    useEffect(() => {
        let cancelled = false;

        const handleScreenUpdate = (data: CampaignScreenUpdateEvent) => {
            if (data.campaignId?.toLowerCase() !== campaignId.toLowerCase()) return;

            setScreens(prev => prev.map(screen =>
                screen.screenId === data.screenId
                    ? {
                        ...screen,
                        // playCount is the synced (database) floor and can trail
                        // the live event by one sync interval — never let it move
                        // the displayed number backwards.
                        playsToday: Math.max(screen.playsToday + 1, data.playCount),
                        lastPlayTimestamp: data.timestamp,
                      }
                    : screen
            ));

            setTotalPlays(prev => prev + 1);
        };

        const handleAdStarted = (data: AdPlaybackEventPayload) => {
            if (data.campaignId?.toLowerCase() !== campaignId.toLowerCase()) return;

            setScreens(prev => prev.map(screen =>
                screen.screenId === data.screenId
                    ? {
                        ...screen,
                        status: 'online',
                        currentCreative: data.creativeId
                            ? { id: data.creativeId, name: 'Your creative' }
                            : screen.currentCreative,
                      }
                    : screen
            ));
        };

        const handleScreenStatus = (data: ScreenStatusChangedEvent) => {
            setScreens(prev => {
                if (!prev.some(s => s.screenId === data.screenId)) return prev;
                const next = prev.map(screen =>
                    screen.screenId === data.screenId
                        ? { ...screen, status: data.isOnline ? 'online' : 'offline' }
                        : screen
                );
                setActiveScreens(next.filter(s => s.status === 'online').length);
                return next;
            });
        };

        websocketService.on('CampaignScreenUpdate', handleScreenUpdate);
        websocketService.on('AdStarted', handleAdStarted);
        websocketService.on('ScreenStatusChanged', handleScreenStatus);

        (async () => {
            try {
                await websocketService.connect();
                if (!cancelled) {
                    await websocketService.subscribeToCampaign(campaignId);
                }
            } catch (error) {
                console.warn('[CampaignScreenStats] Real-time subscription failed:', error);
            }
        })();

        return () => {
            cancelled = true;
            websocketService.off('CampaignScreenUpdate', handleScreenUpdate);
            websocketService.off('AdStarted', handleAdStarted);
            websocketService.off('ScreenStatusChanged', handleScreenStatus);
            websocketService.unsubscribeFromCampaign(campaignId);
        };
    }, [campaignId]);

    if (loading) {
        return (
            <Card>
                <CardContent>
                    <LinearProgress />
                    <Typography>Loading screen stats...</Typography>
                </CardContent>
            </Card>
        );
    }

    return (
        <Box>
            {/* Overview Stats */}
            <Grid container spacing={2} sx={{ mb: 3 }}>
                <Grid
                    size={{
                        xs: 12,
                        md: 4
                    }}>
                    <Card>
                        <CardContent>
                            <Typography variant="subtitle2" color="textSecondary">
                                Total Plays Today
                            </Typography>
                            <Typography variant="h4" color="primary">
                                {totalPlays.toLocaleString()}
                            </Typography>
                        </CardContent>
                    </Card>
                </Grid>
                <Grid
                    size={{
                        xs: 12,
                        md: 4
                    }}>
                    <Card>
                        <CardContent>
                            <Typography variant="subtitle2" color="textSecondary">
                                Active Screens
                            </Typography>
                            <Typography variant="h4">
                                {activeScreens}/{screens.length}
                            </Typography>
                        </CardContent>
                    </Card>
                </Grid>
                <Grid
                    size={{
                        xs: 12,
                        md: 4
                    }}>
                    <Card>
                        <CardContent>
                            <Typography variant="subtitle2" color="textSecondary">
                                Average per Screen
                            </Typography>
                            <Typography variant="h4">
                                {screens.length > 0 ? Math.round(totalPlays / screens.length) : 0}
                            </Typography>
                        </CardContent>
                    </Card>
                </Grid>
            </Grid>
            {/* Screen Cards */}
            <Typography variant="h6" gutterBottom>
                Active Screens
            </Typography>
            <Grid container spacing={2}>
                {screens.map(screen => (
                    <Grid
                        key={screen.screenId}
                        size={{
                            xs: 12,
                            md: 6,
                            lg: 4
                        }}>
                        <Card>
                            <CardContent>
                                <Box display="flex" justifyContent="space-between" alignItems="start" mb={2}>
                                    <Box display="flex" alignItems="center" gap={1}>
                                        <Avatar sx={{ bgcolor: screen.status === 'online' ? 'success.main' : 'grey.500' }}>
                                            <ScreenIcon />
                                        </Avatar>
                                        <Box>
                                            <Typography variant="subtitle1" fontWeight="bold">
                                                {screen.screenName}
                                            </Typography>
                                            <Chip
                                                label={screen.status === 'online' ? 'LIVE' : 'OFFLINE'}
                                                color={screen.status === 'online' ? 'success' : 'default'}
                                                size="small"
                                                icon={screen.status === 'online' ? <SignalIcon /> : undefined}
                                            />
                                        </Box>
                                    </Box>
                                </Box>

                                <Box display="flex" alignItems="center" gap={1} mb={1}>
                                    <TrendingIcon color="primary" />
                                    <Typography variant="h5" color="primary">
                                        {screen.playsToday.toLocaleString()}
                                    </Typography>
                                    <Typography variant="body2" color="textSecondary">
                                        plays today
                                    </Typography>
                                </Box>

                                {screen.currentCreative && (
                                    <Box bgcolor="action.hover" p={1} borderRadius={1} mb={1}>
                                        <Typography variant="caption" color="textSecondary">
                                            Now Playing
                                        </Typography>
                                        <Typography variant="body2">
                                            {screen.currentCreative.name}
                                        </Typography>
                                    </Box>
                                )}

                                {screen.lastPlayTimestamp && (
                                    <Typography variant="caption" color="textSecondary">
                                        Last played {formatDistanceToNow(new Date(screen.lastPlayTimestamp), { addSuffix: true })}
                                    </Typography>
                                )}

                                {/* Advertisers with an active booking get live-stream
                                    access on the screen page (server-verified). */}
                                <Box mt={1.5}>
                                    <Button
                                        size="small"
                                        variant="outlined"
                                        startIcon={<VideocamIcon />}
                                        disabled={screen.status !== 'online'}
                                        onClick={() => navigate(`/screens/${screen.screenId}?tab=live-stream`)}
                                    >
                                        {screen.status === 'online' ? 'Watch live' : 'Screen offline'}
                                    </Button>
                                </Box>
                            </CardContent>
                        </Card>
                    </Grid>
                ))}
            </Grid>
            {screens.length === 0 && !loading && (
                <Box textAlign="center" py={4}>
                    <Typography color="textSecondary">
                        No screens found for this campaign
                    </Typography>
                </Box>
            )}
        </Box>
    );
}
