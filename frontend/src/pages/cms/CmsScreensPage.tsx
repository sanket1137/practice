import { useState } from 'react';
import {
    Box, Button, Card, CardContent, Typography, Stack, IconButton, Tooltip,
    Grid, Chip, CircularProgress, Menu, MenuItem, ListItemIcon, ListItemText,
    TextField, ToggleButtonGroup, ToggleButton,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DownloadIcon from '@mui/icons-material/Download';
import SettingsRemoteIcon from '@mui/icons-material/SettingsRemote';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import PauseIcon from '@mui/icons-material/Pause';
import SkipNextIcon from '@mui/icons-material/SkipNext';
import PowerSettingsNewIcon from '@mui/icons-material/PowerSettingsNew';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import RefreshIcon from '@mui/icons-material/Refresh';
import GroupIcon from '@mui/icons-material/Group';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import WifiOffIcon from '@mui/icons-material/WifiOff';
import MonitorIcon from '@mui/icons-material/Monitor';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { useSnackbar } from 'notistack';
import { formatDistanceToNow } from 'date-fns';
import EmptyState from '../../components/common/EmptyState';
import ErrorState from '../../components/common/ErrorState';
import PairingCodeDialog from '../../components/cms/PairingCodeDialog';
import { cmsScreensApi, cmsCommandsApi } from '../../services/cmsApi';
import type { ScreenHealthDto, ScreenHealthStatus, RemoteCommandType } from '../../types/cms';

const STATUS_COLORS: Record<ScreenHealthStatus, 'success' | 'warning' | 'error'> = {
    online: 'success',
    stale: 'warning',
    offline: 'error',
};

const STATUS_ICONS: Record<ScreenHealthStatus, React.ReactElement> = {
    online: <CheckCircleIcon sx={{ fontSize: 14 }} />,
    stale: <WifiOffIcon sx={{ fontSize: 14 }} />,
    offline: <ErrorIcon sx={{ fontSize: 14 }} />,
};

type StatusFilter = 'all' | ScreenHealthStatus;

export default function CmsScreensPage() {
    const navigate = useNavigate();
    const { enqueueSnackbar } = useSnackbar();
    const [pairOpen, setPairOpen] = useState(false);
    const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
    const [search, setSearch] = useState('');
    const [menuAnchor, setMenuAnchor] = useState<null | HTMLElement>(null);
    const [menuScreenId, setMenuScreenId] = useState<string | null>(null);

    const { data: screens = [], isLoading, error, refetch } = useQuery({
        queryKey: ['cms-screens-health'],
        queryFn: cmsScreensApi.health,
        refetchInterval: 30000, // poll every 30s
    });

    const issueMutation = useMutation({
        mutationFn: cmsCommandsApi.issue,
        onSuccess: () => {
            enqueueSnackbar('Command sent', { variant: 'success' });
            setMenuAnchor(null);
        },
        onError: () => enqueueSnackbar('Failed to send command', { variant: 'error' }),
    });

    const filtered = screens.filter(s => {
        const matchesFilter = statusFilter === 'all' || s.status === statusFilter;
        const matchesSearch = s.name.toLowerCase().includes(search.toLowerCase()) ||
            (s.locationTag ?? '').toLowerCase().includes(search.toLowerCase());
        return matchesFilter && matchesSearch;
    });

    const counts = {
        online: screens.filter(s => s.status === 'online').length,
        stale: screens.filter(s => s.status === 'stale').length,
        offline: screens.filter(s => s.status === 'offline').length,
    };

    const sendCommand = (commandType: RemoteCommandType) => {
        if (!menuScreenId) return;
        issueMutation.mutate({ screenId: menuScreenId, commandType, payload: null });
    };

    const [exportingPdf, setExportingPdf] = useState(false);
    const handleExportPdf = async () => {
        setExportingPdf(true);
        try {
            const response = await cmsScreensApi.exportHealthReport();
            const url = URL.createObjectURL(response.data as Blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `screen-health-${new Date().toISOString().split('T')[0]}.pdf`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        } catch {
            enqueueSnackbar('Failed to export report', { variant: 'error' });
        } finally {
            setExportingPdf(false);
        }
    };

    const openMenu = (e: React.MouseEvent<HTMLElement>, screenId: string) => {
        setMenuAnchor(e.currentTarget);
        setMenuScreenId(screenId);
    };

    return (
        <Box>
            <Stack direction="row" justifyContent="space-between" alignItems="center" mb={3}>
                <Box>
                    <Typography variant="h5" fontWeight={700}>My Screens</Typography>
                    <Typography variant="body2" color="text.secondary">
                        Live health & control centre
                    </Typography>
                </Box>
                <Stack direction="row" spacing={1}>
                    <Tooltip title="Refresh">
                        <IconButton onClick={() => refetch()} size="small">
                            <RefreshIcon />
                        </IconButton>
                    </Tooltip>
                    <Button
                        variant="outlined"
                        startIcon={<GroupIcon />}
                        onClick={() => navigate('/cms/groups')}
                    >
                        Groups
                    </Button>
                    <Button
                        variant="outlined"
                        startIcon={exportingPdf ? <CircularProgress size={16} /> : <DownloadIcon />}
                        onClick={handleExportPdf}
                        disabled={exportingPdf}
                    >
                        Export PDF
                    </Button>
                    <Button
                        variant="contained"
                        startIcon={<AddIcon />}
                        onClick={() => setPairOpen(true)}
                    >
                        Pair screen
                    </Button>
                </Stack>
            </Stack>

            {/* Stat cards */}
            <Grid container spacing={2} mb={3}>
                {[
                    { label: 'Online', count: counts.online, color: 'success.main', icon: <CheckCircleIcon /> },
                    { label: 'Stale', count: counts.stale, color: 'warning.main', icon: <WifiOffIcon /> },
                    { label: 'Offline', count: counts.offline, color: 'error.main', icon: <ErrorIcon /> },
                    { label: 'Total', count: screens.length, color: 'primary.main', icon: <MonitorIcon /> },
                ].map(stat => (
                    <Grid key={stat.label} size={{ xs: 6, md: 3 }}>
                        <Card sx={{ bgcolor: 'background.paper', border: '1px solid', borderColor: 'rgba(255,255,255,0.1)' }}>
                            <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                                <Stack direction="row" justifyContent="space-between" alignItems="center">
                                    <Box>
                                        <Typography variant="h4" fontWeight={700}>{stat.count}</Typography>
                                        <Typography variant="caption" color="text.secondary">{stat.label}</Typography>
                                    </Box>
                                    <Box sx={{ color: stat.color }}>{stat.icon}</Box>
                                </Stack>
                            </CardContent>
                        </Card>
                    </Grid>
                ))}
            </Grid>

            {/* Filters */}
            <Stack direction="row" spacing={2} mb={3} alignItems="center">
                <TextField
                    size="small"
                    placeholder="Search screens..."
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    sx={{ width: 240 }}
                />
                <ToggleButtonGroup
                    value={statusFilter}
                    exclusive
                    onChange={(_, v) => v && setStatusFilter(v)}
                    size="small"
                >
                    <ToggleButton value="all">All</ToggleButton>
                    <ToggleButton value="online" sx={{ color: 'success.main' }}>Online</ToggleButton>
                    <ToggleButton value="stale" sx={{ color: 'warning.main' }}>Stale</ToggleButton>
                    <ToggleButton value="offline" sx={{ color: 'error.main' }}>Offline</ToggleButton>
                </ToggleButtonGroup>
            </Stack>

            {isLoading && (
                <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
                    <CircularProgress />
                </Box>
            )}

            {error && (
                <ErrorState
                    title="Failed to load screens"
                    message="We couldn't load screen health data."
                    action={{ label: 'Retry', onClick: () => refetch() }}
                />
            )}

            {!isLoading && !error && filtered.length === 0 && (
                <EmptyState
                    title="No screens found"
                    message={statusFilter !== 'all' ? 'No screens match the selected filter.' : 'Pair a screen to get started.'}
                />
            )}

            <Grid container spacing={2}>
                {filtered.map(screen => (
                    <Grid key={screen.screenId} size={{ xs: 12, sm: 6, md: 4 }}>
                        <ScreenCard
                            screen={screen}
                            onControl={() => navigate(`/cms/screens/${screen.screenId}/control`)}
                            onMenu={e => openMenu(e, screen.screenId)}
                            onSchedule={() => navigate(`/cms/schedule?screenId=${screen.screenId}`)}
                        />
                    </Grid>
                ))}
            </Grid>

            {/* Controls dropdown menu */}
            <Menu
                anchorEl={menuAnchor}
                open={Boolean(menuAnchor)}
                onClose={() => setMenuAnchor(null)}
            >
                <MenuItem onClick={() => sendCommand('Play')}>
                    <ListItemIcon><PlayArrowIcon fontSize="small" /></ListItemIcon>
                    <ListItemText>Play</ListItemText>
                </MenuItem>
                <MenuItem onClick={() => sendCommand('Pause')}>
                    <ListItemIcon><PauseIcon fontSize="small" /></ListItemIcon>
                    <ListItemText>Pause</ListItemText>
                </MenuItem>
                <MenuItem onClick={() => sendCommand('Skip')}>
                    <ListItemIcon><SkipNextIcon fontSize="small" /></ListItemIcon>
                    <ListItemText>Skip</ListItemText>
                </MenuItem>
                <MenuItem onClick={() => sendCommand('Reboot')} sx={{ color: 'warning.main' }}>
                    <ListItemIcon><PowerSettingsNewIcon fontSize="small" color="warning" /></ListItemIcon>
                    <ListItemText>Reboot</ListItemText>
                </MenuItem>
                <MenuItem
                    onClick={() => {
                        setMenuAnchor(null);
                        if (menuScreenId) navigate(`/cms/screens/${menuScreenId}/control`);
                    }}
                >
                    <ListItemIcon><SettingsRemoteIcon fontSize="small" /></ListItemIcon>
                    <ListItemText>Full Remote Control</ListItemText>
                </MenuItem>
            </Menu>

            <PairingCodeDialog open={pairOpen} onClose={() => { setPairOpen(false); refetch(); }} />
        </Box>
    );
}

interface ScreenCardProps {
    screen: ScreenHealthDto;
    onControl: () => void;
    onMenu: (e: React.MouseEvent<HTMLElement>) => void;
    onSchedule: () => void;
}

function ScreenCard({ screen, onControl, onMenu, onSchedule }: ScreenCardProps) {
    const statusColor = STATUS_COLORS[screen.status];
    const statusIcon = STATUS_ICONS[screen.status];

    return (
        <Card sx={{
            bgcolor: 'background.paper',
            border: '1px solid',
            borderColor: 'rgba(255,255,255,0.1)',
            '&:hover': { borderColor: 'primary.main' },
            transition: 'border-color 0.2s',
        }}>
            <CardContent sx={{ p: 2 }}>
                <Stack direction="row" justifyContent="space-between" alignItems="flex-start" mb={1}>
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Typography variant="subtitle1" fontWeight={600} noWrap>{screen.name}</Typography>
                        {screen.locationTag && (
                            <Typography variant="caption" color="text.secondary" noWrap display="block">
                                {screen.locationTag}
                            </Typography>
                        )}
                    </Box>
                    <Stack direction="row" spacing={0.5} alignItems="center">
                        <Chip
                            size="small"
                            color={statusColor}
                            icon={statusIcon}
                            label={screen.status}
                            sx={{ textTransform: 'capitalize' }}
                        />
                        <IconButton size="small" onClick={onMenu}>
                            <MoreVertIcon fontSize="small" />
                        </IconButton>
                    </Stack>
                </Stack>

                {screen.lastSeenAt && (
                    <Typography variant="caption" color="text.secondary" display="block" mb={1}>
                        Last seen: {formatDistanceToNow(new Date(screen.lastSeenAt), { addSuffix: true })}
                    </Typography>
                )}

                {screen.currentPlaylistName && (
                    <Typography variant="caption" color="primary.light" display="block" mb={1}>
                        Playlist: {screen.currentPlaylistName}
                    </Typography>
                )}

                <Stack direction="row" spacing={1} mt={1.5}>
                    <Button
                        size="small"
                        variant="outlined"
                        startIcon={<SettingsRemoteIcon />}
                        onClick={onControl}
                        sx={{ flex: 1 }}
                    >
                        Control
                    </Button>
                    <Button
                        size="small"
                        variant="text"
                        onClick={onSchedule}
                        sx={{ flex: 1 }}
                    >
                        Schedule
                    </Button>
                </Stack>
            </CardContent>
        </Card>
    );
}