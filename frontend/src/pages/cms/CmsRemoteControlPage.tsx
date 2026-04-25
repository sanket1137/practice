import { useEffect, useRef, useState } from 'react';
import {
    Box, Button, Card, CardContent, Typography, Stack, Grid, TextField, Chip,
    Alert, IconButton, Divider, List, ListItem, ListItemText, Skeleton,
} from '@mui/material';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import PauseIcon from '@mui/icons-material/Pause';
import SkipNextIcon from '@mui/icons-material/SkipNext';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import VolumeUpIcon from '@mui/icons-material/VolumeUp';
import CameraAltIcon from '@mui/icons-material/CameraAlt';
import ReplayIcon from '@mui/icons-material/Replay';
import * as signalR from '@microsoft/signalr';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useParams } from 'react-router-dom';
import { useSnackbar } from 'notistack';
import { useAuthStore } from '../../store/authStore';
import { cmsCommandsApi } from '../../services/cmsApi';
import type { RemoteCommandDto, RemoteCommandType } from '../../types/cms';

export default function CmsRemoteControlPage() {
    const { screenId } = useParams<{ screenId: string }>();
    const { enqueueSnackbar } = useSnackbar();
    const queryClient = useQueryClient();
    const token = useAuthStore((s) => s.accessToken);
    const [hubState, setHubState] = useState<'connecting' | 'connected' | 'disconnected'>('connecting');
    const [volume, setVolume] = useState(50);
    const [message, setMessage] = useState('');
    const hubRef = useRef<signalR.HubConnection | null>(null);

    const { data: history, refetch } = useQuery({
        queryKey: ['cms-commands', screenId],
        queryFn: () => cmsCommandsApi.recent(screenId!),
        enabled: !!screenId,
    });

    useEffect(() => {
        if (!screenId || !token) return;
        const hub = new signalR.HubConnectionBuilder()
            .withUrl('/hubs/cms', { accessTokenFactory: () => token })
            .withAutomaticReconnect()
            .build();

        hub.on('command', (cmd: RemoteCommandDto) => {
            queryClient.setQueryData<RemoteCommandDto[]>(['cms-commands', screenId], (prev) =>
                prev ? [cmd, ...prev.filter((c) => c.id !== cmd.id)] : [cmd],
            );
        });

        hub.start()
            .then(() => {
                setHubState('connected');
                return hub.invoke('SubscribeScreen', screenId);
            })
            .catch(() => setHubState('disconnected'));

        hubRef.current = hub;
        return () => {
            hub.stop().catch(() => { /* ignore */ });
            hubRef.current = null;
        };
    }, [screenId, token, queryClient]);

    const issue = useMutation({
        mutationFn: (body: { commandType: RemoteCommandType; payload?: unknown }) =>
            cmsCommandsApi.issue({ screenId: screenId!, ...body }),
        onSuccess: (res) => {
            enqueueSnackbar(`Sent ${res.commandType}`, { variant: 'success' });
            refetch();
        },
        onError: (err: { response?: { data?: { message?: string } } }) => {
            enqueueSnackbar(err.response?.data?.message ?? 'Command failed', { variant: 'error' });
        },
    });

    if (!screenId) return <Alert severity="error">No screen selected</Alert>;

    return (
        <Box>
            <Stack direction="row" spacing={2} alignItems="center" mb={3}>
                <Typography variant="h5" fontWeight={700}>Remote Control</Typography>
                <Chip
                    size="small"
                    color={hubState === 'connected' ? 'success' : hubState === 'connecting' ? 'warning' : 'error'}
                    label={`Hub: ${hubState}`}
                />
            </Stack>

            <Grid container spacing={3}>
                <Grid size={{ xs: 12, md: 7 }}>
                    <Card>
                        <CardContent>
                            <Typography variant="subtitle1" gutterBottom>Playback</Typography>
                            <Stack direction="row" spacing={1}>
                                <Button startIcon={<PlayArrowIcon />} onClick={() => issue.mutate({ commandType: 'Play' })}>Play</Button>
                                <Button startIcon={<PauseIcon />} onClick={() => issue.mutate({ commandType: 'Pause' })}>Pause</Button>
                                <Button startIcon={<SkipNextIcon />} onClick={() => issue.mutate({ commandType: 'Skip' })}>Skip</Button>
                                <Button startIcon={<ReplayIcon />} onClick={() => issue.mutate({ commandType: 'RestartLoop' })}>Restart loop</Button>
                                <Button startIcon={<RestartAltIcon />} color="warning" onClick={() => issue.mutate({ commandType: 'Reboot' })}>Reboot</Button>
                            </Stack>

                            <Divider sx={{ my: 3 }} />
                            <Typography variant="subtitle1" gutterBottom>Audio</Typography>
                            <Stack direction="row" spacing={2} alignItems="center">
                                <VolumeUpIcon />
                                <TextField
                                    type="number"
                                    size="small"
                                    label="Volume (0-100)"
                                    value={volume}
                                    onChange={(e) => setVolume(Math.max(0, Math.min(100, Number(e.target.value))))}
                                    sx={{ width: 140 }}
                                />
                                <Button onClick={() => issue.mutate({ commandType: 'SetVolume', payload: { volume } })}>
                                    Set volume
                                </Button>
                                <Button onClick={() => issue.mutate({ commandType: 'Mute' })}>Mute</Button>
                                <Button onClick={() => issue.mutate({ commandType: 'Unmute' })}>Unmute</Button>
                            </Stack>

                            <Divider sx={{ my: 3 }} />
                            <Typography variant="subtitle1" gutterBottom>Content</Typography>
                            <Stack direction="row" spacing={1}>
                                <Button onClick={() => issue.mutate({ commandType: 'RefreshContent' })}>Refresh content</Button>
                                <Button onClick={() => issue.mutate({ commandType: 'ClearCache' })}>Clear cache</Button>
                                <Button startIcon={<CameraAltIcon />} onClick={() => issue.mutate({ commandType: 'TakeScreenshot' })}>
                                    Take screenshot
                                </Button>
                            </Stack>

                            <Divider sx={{ my: 3 }} />
                            <Typography variant="subtitle1" gutterBottom>Announcement</Typography>
                            <Stack direction="row" spacing={1}>
                                <TextField
                                    fullWidth size="small"
                                    label="Message to display"
                                    value={message}
                                    onChange={(e) => setMessage(e.target.value)}
                                />
                                <Button
                                    variant="contained"
                                    disabled={!message}
                                    onClick={() => {
                                        issue.mutate({ commandType: 'PushAnnouncement', payload: { text: message, durationSeconds: 15 } });
                                        setMessage('');
                                    }}
                                >
                                    Push
                                </Button>
                            </Stack>
                        </CardContent>
                    </Card>
                </Grid>

                <Grid size={{ xs: 12, md: 5 }}>
                    <Card sx={{ maxHeight: 600, overflow: 'auto' }}>
                        <CardContent>
                            <Stack direction="row" justifyContent="space-between" alignItems="center">
                                <Typography variant="subtitle1">Command history</Typography>
                                <IconButton size="small" onClick={() => refetch()}><ReplayIcon /></IconButton>
                            </Stack>
                            {!history && (
                                <Stack spacing={1} sx={{ mt: 1 }}>
                                    {Array.from({ length: 6 }).map((_, i) => (
                                        <Skeleton key={i} variant="rounded" height={56} />
                                    ))}
                                </Stack>
                            )}
                            <List dense>
                                {history?.map((c) => (
                                    <ListItem key={c.id} divider>
                                        <ListItemText
                                            primary={
                                                <Stack direction="row" spacing={1} alignItems="center">
                                                    <Typography variant="body2" fontWeight={600}>{c.commandType}</Typography>
                                                    <Chip
                                                        size="small"
                                                        color={
                                                            c.status === 'Acked' ? 'success' :
                                                                c.status === 'Failed' ? 'error' :
                                                                    c.status === 'Expired' ? 'warning' : 'default'
                                                        }
                                                        label={c.status}
                                                    />
                                                </Stack>
                                            }
                                            secondary={
                                                <>
                                                    {new Date(c.issuedAt).toLocaleString()}
                                                    {c.errorMessage && ` · ${c.errorMessage}`}
                                                </>
                                            }
                                        />
                                    </ListItem>
                                ))}
                                {history && history.length === 0 && (
                                    <ListItem><ListItemText secondary="No commands yet" /></ListItem>
                                )}
                            </List>
                        </CardContent>
                    </Card>
                </Grid>
            </Grid>
        </Box>
    );
}
