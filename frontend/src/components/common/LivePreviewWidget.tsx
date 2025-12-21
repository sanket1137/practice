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
} from '@mui/material';
import {
    PlayArrow as PlayIcon,
    Visibility as ViewIcon,
    SignalCellularAlt as SignalIcon,
} from '@mui/icons-material';
import { formatDistanceToNow } from 'date-fns';
import { websocketService } from '../../services/websocket';

interface LivePreviewWidgetProps {
    screenId?: string;
    campaignId?: string;
    mode: 'screen' | 'campaign';
}

interface PlayEvent {
    creativeId: string;
    bookingId: string;
    screenId: string;
    campaignId: string;
    campaignName?: string;
    screenName?: string;
    creativeName?: string;
    timestamp: string;
}

interface ConnectionStatus {
    isConnected: boolean;
    lastUpdate?: Date;
}

export default function LivePreviewWidget({ screenId, campaignId, mode }: LivePreviewWidgetProps) {
    const [nowPlaying, setNowPlaying] = useState<PlayEvent | null>(null);
    const [playCount, setPlayCount] = useState(0);
    const [recentPlays, setRecentPlays] = useState<PlayEvent[]>([]);
    const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>({
        isConnected: false
    });

    useEffect(() => {
        let isSubscribed = true;

        const connectAndSubscribe = async () => {
            try {
                console.log('[LivePreview] Connecting to WebSocket...');
                // Connect to websocket
                await websocketService.connect();

                if (!isSubscribed) return;

                // Wait a brief moment to ensure connection is fully established
                await new Promise(resolve => setTimeout(resolve, 100));

                // Verify connection is actually ready
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
                    console.log(`[LivePreview] Subscribed to screen: ${screenId}`);
                } else if (mode === 'campaign' && campaignId) {
                    await websocketService.subscribeToCampaign(campaignId, () => { });
                    console.log(`[LivePreview] Subscribed to campaign: ${campaignId}`);
                }

                // Listen for AdStarted events
                const handleAdStarted = (eventData: PlayEvent) => {
                    console.log('[LivePreview] AdStarted event:', eventData);

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

                // Listen for AdCompleted events
                const handleAdCompleted = (eventData: PlayEvent) => {
                    console.log('[LivePreview] AdCompleted event:', eventData);

                    if (!isSubscribed) return;

                    if (mode === 'screen' && eventData.screenId === screenId) {
                        setPlayCount(prev => prev + 1);
                        setConnectionStatus({ isConnected: true, lastUpdate: new Date() });
                    } else if (mode === 'campaign' && eventData.campaignId === campaignId) {
                        setPlayCount(prev => prev + 1);
                        setConnectionStatus({ isConnected: true, lastUpdate: new Date() });
                    }
                };

                // Listen for ImpressionUpdate events
                const handleImpressionUpdate = (eventData: any) => {
                    console.log('[LivePreview] ImpressionUpdate event:', eventData);

                    if (!isSubscribed) return;

                    if (mode === 'screen' && eventData.screenId === screenId) {
                        setPlayCount(prev => prev + eventData.playCount);
                        setConnectionStatus({ isConnected: true, lastUpdate: new Date() });
                    } else if (mode === 'campaign' && eventData.campaignId === campaignId) {
                        setPlayCount(prev => prev + eventData.playCount);
                        setConnectionStatus({ isConnected: true, lastUpdate: new Date() });
                    }
                };

                websocketService.on('AdStarted', handleAdStarted);
                websocketService.on('AdCompleted', handleAdCompleted);
                websocketService.on('ImpressionUpdate', handleImpressionUpdate);

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
            if (mode === 'screen' && screenId) {
                websocketService.unsubscribeFromScreen(screenId);
            } else if (mode === 'campaign' && campaignId) {
                websocketService.unsubscribeFromCampaign(campaignId);
            }
        };
    }, [screenId, campaignId, mode]);

    const getConnectionChip = () => {
        if (!connectionStatus.isConnected) {
            return <Chip label="Disconnected" color="error" size="small" />;
        }
        return <Chip label="Live" color="success" size="small" icon={<SignalIcon />} />;
    };

    return (
        <Card>
            <CardContent>
                <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                    <Typography variant="h6">Live Activity</Typography>
                    {getConnectionChip()}
                </Box>

                {nowPlaying && (
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
                        <Typography variant="caption" color="textSecondary">
                            {connectionStatus.lastUpdate
                                ? formatDistanceToNow(connectionStatus.lastUpdate, { addSuffix: true })
                                : 'Just now'
                            }
                        </Typography>
                    </Box>
                )}

                <Box display="flex" justifyContent="space-between" py={1}>
                    <Box display="flex" alignItems="center" gap={1}>
                        <ViewIcon fontSize="small" color="action" />
                        <Typography variant="body2" color="textSecondary">
                            Total Plays Today
                        </Typography>
                    </Box>
                    <Typography variant="h6" color="primary">
                        {playCount}
                    </Typography>
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

                {!nowPlaying && playCount === 0 && (
                    <Box textAlign="center" py={3}>
                        <Typography variant="body2" color="textSecondary">
                            No activity yet
                        </Typography>
                        <Typography variant="caption" color="textSecondary">
                            {connectionStatus.isConnected
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
