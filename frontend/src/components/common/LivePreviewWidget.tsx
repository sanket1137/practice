import { useEffect, useState } from 'react';
import {
    Card,
    CardContent,
    Typography,
    Box,
    Chip,
    List,
    ListItem,
    ListItemText,
    Avatar,
    ListItemAvatar,
    CircularProgress,
} from '@mui/material';
import {
    PlayArrow as PlayIcon,
    Visibility as ViewIcon,
    SignalCellularAlt as SignalIcon,
    Schedule as ClockIcon,
} from '@mui/icons-material';
import { formatDistanceToNow } from 'date-fns';
import { websocketService } from '../../services/websocket';
import { api } from '../../services/api';

interface LivePreviewWidgetProps {
    screenId?: string;
    campaignId?: string;
    mode: 'screen' | 'campaign';
    isScreenOnline?: boolean;
}

interface PlayEvent {
    creativeId: string;
    bookingId: string;
    screenId: string;
    campaignId: string;
    campaignName?: string;
    screenName?: string;
    creativeName?: string;
    thumbnailUrl?: string;  // ADD: For visual preview
    timestamp: string;
}

interface ConnectionStatus {
    isConnected: boolean;
    lastUpdate?: Date;
}

interface Stats {
    totalPlaysToday: number;
    savedPlays: number;
    pendingPlays: number;
    lastUpdated: string;
}

interface ImpressionUpdateEvent {
    screenId?: string;
    campaignId?: string;
    playCount: number;
}

export default function LivePreviewWidget({ screenId, campaignId, mode, isScreenOnline }: LivePreviewWidgetProps) {
    const [nowPlaying, setNowPlaying] = useState<PlayEvent | null>(null);
    const [realtimeCount, setRealtimeCount] = useState(0);
    const [stats, setStats] = useState<Stats>({
        totalPlaysToday: 0,
        savedPlays: 0,
        pendingPlays: 0,
        lastUpdated: new Date().toISOString()
    });
    const [loading, setLoading] = useState(true);
    const [recentPlays, setRecentPlays] = useState<PlayEvent[]>([]);
    const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>({
        isConnected: false
    });

    // Load initial stats from API
    useEffect(() => {
        const loadInitialStats = async () => {
            try {
                setLoading(true);
                let endpoint = '';

                if (mode === 'screen' && screenId) {
                    endpoint = `/stats/screen/${screenId}/today`;
                } else if (mode === 'campaign' && campaignId) {
                    endpoint = `/stats/campaign/${campaignId}/today`;
                } else {
                    setLoading(false);
                    return;
                }

                console.log('[LivePreview] Loading initial stats from:', endpoint);
                const response = await api.get(endpoint);

                if (response.data?.success && response.data?.data) {
                    setStats({
                        totalPlaysToday: response.data.data.totalPlaysToday,
                        savedPlays: response.data.data.savedPlays,
                        pendingPlays: response.data.data.pendingPlays,
                        lastUpdated: response.data.data.lastUpdated
                    });

                    // Reset realtime counter
                    setRealtimeCount(0);

                    console.log('[LivePreview] Loaded initial stats:', response.data.data);
                }
            } catch (error) {
                console.error('[LivePreview] Failed to load stats:', error);
            } finally {
                setLoading(false);
            }
        };

        loadInitialStats();
    }, [screenId, campaignId, mode]);

    useEffect(() => {
        let isSubscribed = true;
        let handlersRegistered = false;

        // Define handlers outside to properly remove them later
        const handleAdStarted = (eventData: PlayEvent) => {
            if (!isSubscribed) return;

            if (mode === 'screen' && eventData.screenId === screenId) {
                setNowPlaying(eventData);
                setConnectionStatus({ isConnected: true, lastUpdate: new Date() });
            } else if (mode === 'campaign' && eventData.campaignId === campaignId) {
                setNowPlaying(eventData);
                setRecentPlays(prev => [eventData, ...prev.slice(0, 4)]);
                setConnectionStatus({ isConnected: true, lastUpdate: new Date() });
            }
        };

        const handleAdCompleted = (eventData: PlayEvent) => {
            if (!isSubscribed) return;

            if (mode === 'screen' && eventData.screenId === screenId) {
                setRealtimeCount(prev => prev + 1);
                setConnectionStatus({ isConnected: true, lastUpdate: new Date() });
            } else if (mode === 'campaign' && eventData.campaignId === campaignId) {
                setRealtimeCount(prev => prev + 1);
                setConnectionStatus({ isConnected: true, lastUpdate: new Date() });
            }
        };

        const handleImpressionUpdate = (eventData: ImpressionUpdateEvent) => {
            if (!isSubscribed) return;

            if (mode === 'screen' && eventData.screenId === screenId) {
                setRealtimeCount(prev => prev + eventData.playCount);
                setConnectionStatus({ isConnected: true, lastUpdate: new Date() });
            } else if (mode === 'campaign' && eventData.campaignId === campaignId) {
                setRealtimeCount(prev => prev + eventData.playCount);
                setConnectionStatus({ isConnected: true, lastUpdate: new Date() });
            }
        };

        // NEW: Handle individual impression recorded events from PlayerController
        const handleImpressionRecorded = (eventData: { screenId: string; slotNumber: number; ownerContentId: string; timestamp: string }) => {
            if (!isSubscribed) return;

            console.log('📊 ImpressionRecorded event:', eventData);

            if (mode === 'screen' && eventData.screenId === screenId) {
                setRealtimeCount(prev => prev + 1);  // Increment by 1 for each impression
                setConnectionStatus({ isConnected: true, lastUpdate: new Date() });
            }
        };

        const connectAndSubscribe = async () => {
            try {
                console.log('[LivePreview] Connecting to WebSocket...');
                await websocketService.connect();

                if (!isSubscribed) return;

                await new Promise(resolve => setTimeout(resolve, 100));

                if (!websocketService.isConnected()) {
                    console.error('[LivePreview] Connection not ready, waiting...');
                    await new Promise(resolve => setTimeout(resolve, 500));

                    if (!websocketService.isConnected()) {
                        throw new Error('Connection timeout - not ready after 600ms');
                    }
                }

                setConnectionStatus({ isConnected: true, lastUpdate: new Date() });
                console.log('[LivePreview] WebSocket connected and ready');

                // Subscribe based on mode
                if (mode === 'screen' && screenId) {
                    await websocketService.subscribeToScreen(screenId, () => { });
                    // Request fast sync (1 min) while user is viewing
                    await websocketService.requestFastSync(screenId);
                    console.log(`[LivePreview] Subscribed to screen: ${screenId} (fast sync enabled)`);
                } else if (mode === 'campaign' && campaignId) {
                    await websocketService.subscribeToCampaign(campaignId, () => { });
                    console.log(`[LivePreview] Subscribed to campaign: ${campaignId}`);
                }

                // Register event handlers ONLY ONCE
                if (!handlersRegistered) {
                    websocketService.on('AdStarted', handleAdStarted);
                    websocketService.on('AdCompleted', handleAdCompleted);
                    websocketService.on('ImpressionUpdate', handleImpressionUpdate);
                    websocketService.on('ImpressionRecorded', handleImpressionRecorded);  // NEW: Owner content impressions
                    handlersRegistered = true;
                    console.log('[LivePreview] Event handlers registered');
                }

            } catch (err) {
                console.error('[LivePreview] Failed to connect to websocket:', err);
                if (isSubscribed) {
                    setConnectionStatus({ isConnected: false });
                }
            }
        };

        connectAndSubscribe();

        // Cleanup
        return () => {
            isSubscribed = false;

            // Remove event handlers
            if (handlersRegistered) {
                websocketService.off('AdStarted', handleAdStarted);
                websocketService.off('AdCompleted', handleAdCompleted);
                websocketService.off('ImpressionUpdate', handleImpressionUpdate);
                websocketService.off('ImpressionRecorded', handleImpressionRecorded);  // NEW
                console.log('[LivePreview] Event handlers removed');
            }

            // Unsubscribe from updates
            if (mode === 'screen' && screenId) {
                // Request normal sync (10 min) when user leaves
                websocketService.requestNormalSync(screenId);
                websocketService.unsubscribeFromScreen(screenId);
            } else if (mode === 'campaign' && campaignId) {
                websocketService.unsubscribeFromCampaign(campaignId);
            }
        };
    }, [screenId, campaignId, mode]);

    const getConnectionChip = () => {
        // For screen mode, use actual screen online status if provided
        if (mode === 'screen' && isScreenOnline !== undefined) {
            if (!isScreenOnline) {
                return <Chip label="Offline" color="default" size="small" />;
            }
            if (!connectionStatus.isConnected) {
                return <Chip label="Connecting" color="warning" size="small" />;
            }
            return <Chip label="Live" color="success" size="small" icon={<SignalIcon />} />;
        }
        // Fallback for campaign mode or when isScreenOnline not provided
        if (!connectionStatus.isConnected) {
            return <Chip label="Disconnected" color="error" size="small" />;
        }
        return <Chip label="Live" color="success" size="small" icon={<SignalIcon />} />;
    };

    // Calculate display count: DB total + realtime increments
    const displayCount = stats.totalPlaysToday + realtimeCount;

    return (
        <Card>
            <CardContent>
                <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                    <Typography variant="h6">Live Activity</Typography>
                    {getConnectionChip()}
                </Box>

                {nowPlaying && (
                    <Box>
                        {/* Visual Preview - Thumbnail */}
                        {nowPlaying.thumbnailUrl && (
                            <Box
                                mb={2}
                                sx={{
                                    position: 'relative',
                                    width: '100%',
                                    paddingTop: '56.25%', // 16:9 aspect ratio
                                    backgroundColor: 'action.hover',
                                    borderRadius: 1,
                                    overflow: 'hidden'
                                }}
                            >
                                <Box
                                    component="img"
                                    src={nowPlaying.thumbnailUrl}
                                    alt={nowPlaying.creativeName || 'Now Playing'}
                                    sx={{
                                        position: 'absolute',
                                        top: 0,
                                        left: 0,
                                        width: '100%',
                                        height: '100%',
                                        objectFit: 'cover'
                                    }}
                                    onError={(e: React.SyntheticEvent<HTMLImageElement>) => {
                                        e.currentTarget.style.display = 'none';
                                    }}
                                />
                                {/* Live indicator overlay */}
                                <Box
                                    sx={{
                                        position: 'absolute',
                                        top: 8,
                                        left: 8,
                                        backgroundColor: 'error.main',
                                        color: 'white',
                                        px: 1,
                                        py: 0.5,
                                        borderRadius: 1,
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 0.5
                                    }}
                                >
                                    <Box
                                        sx={{
                                            width: 8,
                                            height: 8,
                                            backgroundColor: 'white',
                                            borderRadius: '50%',
                                            animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
                                            '@keyframes pulse': {
                                                '0%, 100%': { opacity: 1 },
                                                '50%': { opacity: 0.5 }
                                            }
                                        }}
                                    />
                                    <Typography variant="caption" fontWeight="bold">
                                        LIVE
                                    </Typography>
                                </Box>
                            </Box>
                        )}

                        {/* Now Playing Info */}
                        <Box mb={2} p={2} bgcolor="action.hover" borderRadius={1}>
                            <Box display="flex" alignItems="center" gap={1} mb={1}>
                                <PlayIcon color="primary" />
                                <Typography variant="subtitle2" color="primary">
                                    Now Playing
                                </Typography>
                            </Box>
                            <Typography variant="body2">
                                {mode === 'screen'
                                    ? nowPlaying.campaignName || `Campaign ${nowPlaying.campaignId.substring(0, 8)}`
                                    : nowPlaying.screenName || `Screen ${nowPlaying.screenId.substring(0, 8)}`
                                }
                            </Typography>
                            {nowPlaying.creativeName && (
                                <Typography variant="caption" color="textSecondary" display="block">
                                    {nowPlaying.creativeName}
                                </Typography>
                            )}
                            <Typography variant="caption" color="textSecondary">
                                {connectionStatus.lastUpdate
                                    ? formatDistanceToNow(connectionStatus.lastUpdate, { addSuffix: true })
                                    : 'Just now'
                                }
                            </Typography>
                        </Box>
                    </Box>
                )}

                <Box py={1}>
                    <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
                        <Box display="flex" alignItems="center" gap={1}>
                            <ViewIcon fontSize="small" color="action" />
                            <Typography variant="body2" color="textSecondary">
                                Total Plays Today
                            </Typography>
                        </Box>
                        {loading ? (
                            <CircularProgress size={20} />
                        ) : (
                            <Typography variant="h6" color="primary">
                                {displayCount}
                            </Typography>
                        )}
                    </Box>

                    {/* Show pending indicator if there are buffered impressions */}
                    {stats.pendingPlays > 0 && (
                        <Box display="flex" alignItems="center" justifyContent="center" mt={1}>
                            <Chip
                                size="small"
                                icon={<ClockIcon />}
                                label={`${stats.pendingPlays} pending save`}
                                color="info"
                                variant="outlined"
                            />
                        </Box>
                    )}

                    {/* Show breakdown */}
                    {!loading && displayCount > 0 && (
                        <Typography variant="caption" color="textSecondary" display="block" textAlign="center" mt={1}>
                            {stats.savedPlays} saved
                            {stats.pendingPlays > 0 && ` • ${stats.pendingPlays} buffered`}
                            {realtimeCount > 0 && ` • ${realtimeCount} live`}
                        </Typography>
                    )}
                </Box>

                {mode === 'campaign' && recentPlays.length > 0 && (
                    <>
                        <Typography variant="subtitle2" sx={{ mt: 2, mb: 1 }}>
                            Recent Activity
                        </Typography>
                        <List dense disablePadding>
                            {recentPlays.map((play, index) => (
                                <ListItem key={index} disablePadding sx={{ mb: 1 }}>
                                    <ListItemAvatar>
                                        <Avatar sx={{ width: 32, height: 32 }}>
                                            <PlayIcon fontSize="small" />
                                        </Avatar>
                                    </ListItemAvatar>
                                    <ListItemText
                                        primary={play.screenName || `Screen ${play.screenId.substring(0, 8)}`}
                                        secondary={formatDistanceToNow(new Date(play.timestamp), { addSuffix: true })}
                                        primaryTypographyProps={{ variant: 'body2' }}
                                        secondaryTypographyProps={{ variant: 'caption' }}
                                    />
                                </ListItem>
                            ))}
                        </List>
                    </>
                )}

                {!loading && !nowPlaying && displayCount === 0 && (
                    <Box textAlign="center" py={3}>
                        <Typography variant="body2" color="textSecondary">
                            No activity yet
                        </Typography>
                        <Typography variant="caption" color="textSecondary">
                            {mode === 'screen' && isScreenOnline === false
                                ? 'Screen is offline'
                                : connectionStatus.isConnected
                                    ? 'Waiting for playback events...'
                                    : 'Connecting to live feed...'
                            }
                        </Typography>
                    </Box>
                )}
            </CardContent>
        </Card>
    );
}
