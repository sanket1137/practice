import { useEffect } from 'react';
import { Box, Card, CardActionArea, Typography, Tooltip } from '@mui/material';
import { useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import ScreenStatusChip from '../screens/ScreenStatusChip';
import { websocketService } from '../../services/websocket';

/** The minimal shape the strip renders — callers with richer Screen types satisfy it structurally. */
export interface FleetScreen {
    id: string;
    name: string;
    status: string;
    isOnline: boolean;
    location?: { city?: string };
}

/**
 * The owner's morning glance: one compact card per screen — live dot,
 * lifecycle state, where to click. Live: patches the shared ['screens'] cache
 * from the same SignalR events the screens page uses, so the dots flip without
 * a refresh even when only the dashboard is open.
 */
export default function FleetStrip({ screens }: { screens: FleetScreen[] }) {
    const queryClient = useQueryClient();
    const navigate = useNavigate();

    useEffect(() => {
        const patch = (screenId: string, changes: Partial<FleetScreen>) => {
            queryClient.setQueryData<FleetScreen[]>(['screens'], prev =>
                prev?.map(s => (s.id === screenId ? { ...s, ...changes } : s))
            );
        };
        const onStatus = (data: { screenId: string; isOnline: boolean }) =>
            patch(data.screenId, { isOnline: data.isOnline });
        const onLifecycle = (data: { screenId: string; status: string }) =>
            patch(data.screenId, { status: data.status });

        websocketService.on('ScreenStatusChanged', onStatus);
        websocketService.on('ScreenLifecycleChanged', onLifecycle);
        websocketService.connect().catch(() => { /* strip still renders from REST */ });
        return () => {
            websocketService.off('ScreenStatusChanged', onStatus);
            websocketService.off('ScreenLifecycleChanged', onLifecycle);
        };
    }, [queryClient]);

    if (!screens.length) return null;

    return (
        <Box sx={{ mb: 4 }}>
            <Typography variant="h6" sx={{ mb: 1.5 }}>Your screens right now</Typography>
            <Box
                sx={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
                    gap: 1.5,
                }}
            >
                {screens.map((screen) => {
                    const online = screen.isOnline;
                    return (
                        <Card key={screen.id} variant="outlined">
                            <CardActionArea
                                onClick={() => navigate(`/screens/${screen.id}`)}
                                sx={{ p: 1.5, display: 'flex', alignItems: 'center', gap: 1.25, justifyContent: 'flex-start' }}
                            >
                                <Tooltip title={online ? 'Player connected' : 'Player not connected'} arrow>
                                    <Box
                                        sx={{
                                            width: 10,
                                            height: 10,
                                            flexShrink: 0,
                                            borderRadius: '50%',
                                            bgcolor: online ? 'success.main' : 'text.disabled',
                                            boxShadow: online ? '0 0 0 3px rgba(46,125,50,0.2)' : 'none',
                                        }}
                                    />
                                </Tooltip>
                                <Box sx={{ minWidth: 0, flex: 1 }}>
                                    <Typography variant="body2" fontWeight={600} noWrap>
                                        {screen.name}
                                    </Typography>
                                    <Typography variant="caption" color="text.secondary" noWrap display="block">
                                        {screen.location?.city ?? ''}
                                    </Typography>
                                </Box>
                                <ScreenStatusChip status={screen.status} />
                            </CardActionArea>
                        </Card>
                    );
                })}
            </Box>
        </Box>
    );
}
