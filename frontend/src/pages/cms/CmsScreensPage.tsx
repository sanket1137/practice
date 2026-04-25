import { useState } from 'react';
import {
    Box, Button, Card, CardContent, Typography, Stack, IconButton, Tooltip,
    Grid, Chip, Skeleton,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import MonitorIcon from '@mui/icons-material/Monitor';
import PlaylistPlayIcon from '@mui/icons-material/PlaylistPlay';
import SettingsRemoteIcon from '@mui/icons-material/SettingsRemote';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { api } from '../../services/api';
import EmptyState from '../../components/common/EmptyState';
import ErrorState from '../../components/common/ErrorState';
import PairingCodeDialog from '../../components/cms/PairingCodeDialog';

interface CmsScreenDto {
    id: string;
    name: string;
    location?: { city?: string; address?: string };
    resolution?: string;
    status?: string;
    locationTag?: string;
    defaultPlaylistId?: string;
    createdAt?: string;
}

export default function CmsScreensPage() {
    const navigate = useNavigate();
    const [pairOpen, setPairOpen] = useState(false);

    const { data, isLoading, error, refetch } = useQuery({
        queryKey: ['cms-screens'],
        queryFn: async () => {
            const res = await api.get('/screens');
            const list = res.data?.data;
            return Array.isArray(list) ? (list as CmsScreenDto[]) : [];
        },
    });

    return (
        <Box>
            <Stack direction="row" justifyContent="space-between" alignItems="center" mb={3}>
                <Box>
                    <Typography variant="h5" fontWeight={700}>My Screens</Typography>
                    <Typography variant="body2" color="text.secondary">
                        Private CMS-mode screens under your control
                    </Typography>
                </Box>
                <Button
                    variant="contained"
                    startIcon={<AddIcon />}
                    onClick={() => setPairOpen(true)}
                >
                    Pair a new screen
                </Button>
            </Stack>

            {isLoading && (
                <Grid container spacing={2}>
                    {Array.from({ length: 6 }).map((_, i) => (
                        <Grid key={i} size={{ xs: 12, sm: 6, md: 4 }}>
                            <Card>
                                <CardContent>
                                    <Skeleton variant="text" width="60%" height={32} />
                                    <Stack direction="row" spacing={1} sx={{ my: 1 }}>
                                        <Skeleton variant="rounded" width={60} height={24} />
                                        <Skeleton variant="rounded" width={80} height={24} />
                                    </Stack>
                                    <Skeleton variant="text" width="40%" />
                                </CardContent>
                            </Card>
                        </Grid>
                    ))}
                </Grid>
            )}
            {error && (
                <ErrorState
                    title="Failed to load screens"
                    message="We couldn't reach the screens service. Please try again."
                    action={{ label: 'Retry', onClick: () => refetch() }}
                />
            )}

            {!isLoading && !error && (data?.length ?? 0) === 0 && (
                <EmptyState
                    title="No screens yet"
                    message="Pair your first device to start managing playlists."
                    icon={<MonitorIcon sx={{ fontSize: 64, color: 'text.disabled' }} />}
                    action={{ label: 'Pair a device', onClick: () => setPairOpen(true) }}
                />
            )}

            {!isLoading && !error && (data?.length ?? 0) > 0 && (
                <Grid container spacing={2}>
                    {data!.map((s) => (
                        <Grid key={s.id} size={{ xs: 12, sm: 6, md: 4 }}>
                            <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                                <CardContent sx={{ flex: 1 }}>
                                    <Stack direction="row" spacing={1} alignItems="center" mb={1}>
                                        <MonitorIcon color="primary" />
                                        <Typography variant="h6" noWrap>{s.name}</Typography>
                                    </Stack>
                                    <Stack direction="row" spacing={1} flexWrap="wrap" sx={{ mb: 1 }}>
                                        {s.status && (
                                            <Chip
                                                size="small"
                                                label={s.status}
                                                color={s.status === 'Active' ? 'success' : 'default'}
                                            />
                                        )}
                                        {s.locationTag && <Chip size="small" label={s.locationTag} />}
                                        {s.resolution && (
                                            <Chip size="small" variant="outlined" label={s.resolution} />
                                        )}
                                    </Stack>
                                    {s.location?.city && (
                                        <Typography variant="caption" color="text.secondary">
                                            {s.location.address ? `${s.location.address}, ` : ''}{s.location.city}
                                        </Typography>
                                    )}
                                </CardContent>
                                <Box sx={{ p: 1, borderTop: '1px solid', borderColor: 'divider', display: 'flex', gap: 1 }}>
                                    <Tooltip title="Manage playlists">
                                        <IconButton onClick={() => navigate(`/cms/playlists?screenId=${s.id}`)}>
                                            <PlaylistPlayIcon />
                                        </IconButton>
                                    </Tooltip>
                                    <Tooltip title="Remote control">
                                        <IconButton onClick={() => navigate(`/cms/screens/${s.id}/control`)}>
                                            <SettingsRemoteIcon />
                                        </IconButton>
                                    </Tooltip>
                                </Box>
                            </Card>
                        </Grid>
                    ))}
                </Grid>
            )}

            <PairingCodeDialog open={pairOpen} onClose={() => setPairOpen(false)} />
        </Box>
    );
}
