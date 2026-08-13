import { useState } from 'react';
import {
    Box, Button, Card, CardContent, Typography, Stack, Grid, TextField,
    Dialog, DialogTitle, DialogContent, DialogActions, FormGroup, FormControlLabel,
    Checkbox, MenuItem, Select, InputLabel, FormControl, Chip, IconButton,
    Tooltip, CircularProgress,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSnackbar } from 'notistack';
import { useSearchParams } from 'react-router-dom';
import { isAxiosError } from 'axios';
import { cmsScheduleApi } from '../../services/cmsApi';
import { api } from '../../services/api';
import EmptyState from '../../components/common/EmptyState';
import type { ScheduleWindowDto, CreateScheduleWindowRequest } from '../../types/cms';

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const DAY_BITS = [1, 2, 4, 8, 16, 32, 64];

function maskToDays(mask: number): string {
    return DAYS.filter((_, i) => mask & DAY_BITS[i]).join(', ');
}

function minutesToTime(min: number) {
    const h = Math.floor(min / 60).toString().padStart(2, '0');
    const m = (min % 60).toString().padStart(2, '0');
    return `${h}:${m}`;
}

function timeToMinutes(t: string) {
    const [h, m] = t.split(':').map(Number);
    return h * 60 + m;
}

interface ScreenOption { id: string; name: string; }
interface PlaylistOption { id: string; name: string; }

export default function CmsSchedulePage() {
    const [searchParams] = useSearchParams();
    const { enqueueSnackbar } = useSnackbar();
    const queryClient = useQueryClient();
    const [screenId, setScreenId] = useState(searchParams.get('screenId') ?? '');
    const [dialogOpen, setDialogOpen] = useState(false);
    const [editWindow, setEditWindow] = useState<ScheduleWindowDto | null>(null);

    const [form, setForm] = useState<{
        daysOfWeekMask: number;
        startTime: string;
        endTime: string;
        playlistId: string;
        label: string;
    }>({ daysOfWeekMask: 31, startTime: '09:00', endTime: '17:00', playlistId: '', label: '' });

    const { data: screens = [] } = useQuery<ScreenOption[]>({
        queryKey: ['screens-list'],
        queryFn: async () => {
            const res = await api.get('/screens');
            return (res.data?.data ?? []).map((s: { id: string; name: string }) => ({ id: s.id, name: s.name }));
        },
    });

    const { data: playlists = [] } = useQuery<PlaylistOption[]>({
        queryKey: ['playlists-list'],
        queryFn: async () => {
            const res = await api.get('/playlists');
            return (res.data?.data ?? []).map((p: { id: string; name: string }) => ({ id: p.id, name: p.name }));
        },
        staleTime: 5 * 60 * 1000,
    });

    const { data: windows = [], isLoading } = useQuery({
        queryKey: ['schedule-windows', screenId],
        queryFn: () => cmsScheduleApi.list(screenId),
        enabled: !!screenId,
    });

    const createMutation = useMutation({
        mutationFn: (req: CreateScheduleWindowRequest) => cmsScheduleApi.create(screenId, req),
        onSuccess: () => {
            enqueueSnackbar('Window added', { variant: 'success' });
            queryClient.invalidateQueries({ queryKey: ['schedule-windows', screenId] });
            setDialogOpen(false);
        },
        onError: (e: unknown) => {
            const message = isAxiosError(e) ? (e.response?.data as { message?: string } | undefined)?.message : undefined;
            enqueueSnackbar(message ?? 'Conflict or error', { variant: 'error' });
        },
    });

    const deleteMutation = useMutation({
        mutationFn: (windowId: string) => cmsScheduleApi.delete(screenId, windowId),
        onSuccess: () => {
            enqueueSnackbar('Window removed', { variant: 'success' });
            queryClient.invalidateQueries({ queryKey: ['schedule-windows', screenId] });
        },
    });

    const openAdd = () => {
        setEditWindow(null);
        setForm({ daysOfWeekMask: 31, startTime: '09:00', endTime: '17:00', playlistId: '', label: '' });
        setDialogOpen(true);
    };

    const openEdit = (w: ScheduleWindowDto) => {
        setEditWindow(w);
        setForm({
            daysOfWeekMask: w.daysOfWeekMask,
            startTime: minutesToTime(w.startMinute),
            endTime: minutesToTime(w.endMinute),
            playlistId: w.playlistId,
            label: w.label ?? '',
        });
        setDialogOpen(true);
    };

    const toggleDay = (bit: number) => {
        setForm(f => ({ ...f, daysOfWeekMask: f.daysOfWeekMask ^ bit }));
    };

    const handleSubmit = () => {
        const req: CreateScheduleWindowRequest = {
            daysOfWeekMask: form.daysOfWeekMask,
            startMinute: timeToMinutes(form.startTime),
            endMinute: timeToMinutes(form.endTime),
            playlistId: form.playlistId,
            label: form.label || undefined,
            isActive: true,
        };
        createMutation.mutate(req);
    };

    return (
        <Box>
            <Stack direction="row" justifyContent="space-between" alignItems="center" mb={3}>
                <Box>
                    <Typography variant="h5" fontWeight={700}>Schedule / Day-Parting</Typography>
                    <Typography variant="body2" color="text.secondary">
                        Control which playlists play on which days and times
                    </Typography>
                </Box>
                <Button variant="contained" startIcon={<AddIcon />} onClick={openAdd} disabled={!screenId}>
                    Add time window
                </Button>
            </Stack>

            {/* Screen selector */}
            <FormControl size="small" sx={{ mb: 3, minWidth: 300 }}>
                <InputLabel>Select screen</InputLabel>
                <Select
                    label="Select screen"
                    value={screenId}
                    onChange={e => setScreenId(e.target.value)}
                >
                    {screens.map(s => (
                        <MenuItem key={s.id} value={s.id}>{s.name}</MenuItem>
                    ))}
                </Select>
            </FormControl>

            {!screenId && (
                <EmptyState title="Select a screen" message="Choose a screen to view and manage its schedule windows." />
            )}

            {screenId && isLoading && (
                <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                    <CircularProgress />
                </Box>
            )}

            {screenId && !isLoading && windows.length === 0 && (
                <EmptyState title="No schedule windows" message="Add a time window to start day-parting your content." />
            )}

            <Grid container spacing={2}>
                {windows.map(w => (
                    <Grid key={w.id} size={{ xs: 12, sm: 6, md: 4 }}>
                        <Card sx={{ bgcolor: 'background.paper', border: '1px solid rgba(255,255,255,0.1)' }}>
                            <CardContent>
                                <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
                                    <Box>
                                        {w.label && <Typography variant="subtitle2" fontWeight={600}>{w.label}</Typography>}
                                        <Typography variant="body2" color="text.secondary">
                                            {maskToDays(w.daysOfWeekMask)}
                                        </Typography>
                                        <Typography variant="body2">
                                            {minutesToTime(w.startMinute)} – {minutesToTime(w.endMinute)}
                                        </Typography>
                                        {w.playlistName && (
                                            <Chip size="small" label={w.playlistName} sx={{ mt: 1 }} color="primary" variant="outlined" />
                                        )}
                                    </Box>
                                    <Stack direction="row" spacing={0.5}>
                                        <Tooltip title="Edit">
                                            <IconButton size="small" onClick={() => openEdit(w)}>
                                                <EditIcon fontSize="small" />
                                            </IconButton>
                                        </Tooltip>
                                        <Tooltip title="Delete">
                                            <IconButton
                                                size="small"
                                                color="error"
                                                onClick={() => deleteMutation.mutate(w.id)}
                                            >
                                                <DeleteIcon fontSize="small" />
                                            </IconButton>
                                        </Tooltip>
                                    </Stack>
                                </Stack>
                            </CardContent>
                        </Card>
                    </Grid>
                ))}
            </Grid>

            {/* Add/Edit dialog */}
            <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
                <DialogTitle>{editWindow ? 'Edit time window' : 'Add time window'}</DialogTitle>
                <DialogContent>
                    <Stack spacing={2} sx={{ mt: 1 }}>
                        <TextField
                            label="Label (optional)"
                            size="small"
                            value={form.label}
                            onChange={e => setForm(f => ({ ...f, label: e.target.value }))}
                        />
                        <Box>
                            <Typography variant="caption" color="text.secondary" mb={0.5} display="block">
                                Days of week
                            </Typography>
                            <FormGroup row>
                                {DAYS.map((d, i) => (
                                    <FormControlLabel
                                        key={d}
                                        control={
                                            <Checkbox
                                                size="small"
                                                checked={!!(form.daysOfWeekMask & DAY_BITS[i])}
                                                onChange={() => toggleDay(DAY_BITS[i])}
                                            />
                                        }
                                        label={d}
                                    />
                                ))}
                            </FormGroup>
                        </Box>
                        <Stack direction="row" spacing={2}>
                            <TextField
                                type="time"
                                size="small"
                                label="Start time"
                                value={form.startTime}
                                onChange={e => setForm(f => ({ ...f, startTime: e.target.value }))}
                                InputLabelProps={{ shrink: true }}
                                sx={{ flex: 1 }}
                            />
                            <TextField
                                type="time"
                                size="small"
                                label="End time"
                                value={form.endTime}
                                onChange={e => setForm(f => ({ ...f, endTime: e.target.value }))}
                                InputLabelProps={{ shrink: true }}
                                sx={{ flex: 1 }}
                            />
                        </Stack>
                        <FormControl size="small" fullWidth>
                            <InputLabel>Playlist</InputLabel>
                            <Select
                                label="Playlist"
                                value={form.playlistId}
                                onChange={e => setForm(f => ({ ...f, playlistId: e.target.value }))}
                            >
                                {playlists.map(p => (
                                    <MenuItem key={p.id} value={p.id}>{p.name}</MenuItem>
                                ))}
                            </Select>
                        </FormControl>
                    </Stack>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
                    <Button
                        variant="contained"
                        onClick={handleSubmit}
                        disabled={!form.playlistId || form.daysOfWeekMask === 0 || createMutation.isPending}
                    >
                        {editWindow ? 'Save' : 'Add'}
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
}