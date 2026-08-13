import { useState, useEffect } from 'react';
import {
    Card,
    CardContent,
    Typography,
    Box,
    Chip,
    Grid,
    LinearProgress,
    Avatar
} from '@mui/material';
import {
    Monitor as ScreenIcon,
    TrendingUp as TrendingIcon,
    SignalCellularAlt as SignalIcon
} from '@mui/icons-material';
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

interface CampaignScreenUpdateEvent {
    CampaignId: string;
    ScreenId: string;
    PlayCount: number;
    Timestamp: string;
}

export default function CampaignScreenStats({ campaignId }: CampaignScreenStatsProps) {
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

    // Subscribe to real-time updates
    useEffect(() => {
        const handleScreenUpdate = (data: CampaignScreenUpdateEvent) => {
            if (data.CampaignId !== campaignId) return;

            setScreens(prev => prev.map(screen =>
                screen.screenId === data.ScreenId
                    ? { ...screen, playsToday: data.PlayCount, lastPlayTimestamp: data.Timestamp }
                    : screen
            ));

            setTotalPlays(prev => prev + 1);
        };

        websocketService.on('CampaignScreenUpdate', handleScreenUpdate);

        return () => {
            websocketService.off('CampaignScreenUpdate', handleScreenUpdate);
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
