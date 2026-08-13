import { useState } from 'react';
import {
    Box, Button, Typography, Stack, TextField,
    Dialog, DialogTitle, DialogContent, DialogActions, CircularProgress,
    IconButton, Tooltip, Chip, List, ListItem, ListItemText, Accordion,
    AccordionSummary, AccordionDetails, Checkbox, ListItemIcon, ListItemButton,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import GroupIcon from '@mui/icons-material/Group';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSnackbar } from 'notistack';
import { cmsScreenGroupsApi, cmsCommandsApi } from '../../services/cmsApi';
import { api } from '../../services/api';
import EmptyState from '../../components/common/EmptyState';
import type { CreateScreenGroupRequest, RemoteCommandType } from '../../types/cms';

interface ScreenOption { id: string; name: string; }

export default function CmsScreenGroupsPage() {
    const { enqueueSnackbar } = useSnackbar();
    const queryClient = useQueryClient();
    const [dialogOpen, setDialogOpen] = useState(false);
    const [form, setForm] = useState<{ name: string; description: string; screenIds: string[] }>({
        name: '', description: '', screenIds: [],
    });

    const { data: groups = [], isLoading } = useQuery({
        queryKey: ['screen-groups'],
        queryFn: cmsScreenGroupsApi.list,
    });

    const { data: screens = [] } = useQuery<ScreenOption[]>({
        queryKey: ['screens-list'],
        queryFn: async () => {
            const res = await api.get('/screens');
            return (res.data?.data ?? []).map((s: { id: string; name: string }) => ({ id: s.id, name: s.name }));
        },
        staleTime: 5 * 60 * 1000,
    });

    const createMutation = useMutation({
        mutationFn: (req: CreateScreenGroupRequest) => cmsScreenGroupsApi.create(req),
        onSuccess: () => {
            enqueueSnackbar('Group created', { variant: 'success' });
            queryClient.invalidateQueries({ queryKey: ['screen-groups'] });
            setDialogOpen(false);
        },
        onError: () => enqueueSnackbar('Failed to create group', { variant: 'error' }),
    });

    const deleteMutation = useMutation({
        mutationFn: (id: string) => cmsScreenGroupsApi.delete(id),
        onSuccess: () => {
            enqueueSnackbar('Group deleted', { variant: 'success' });
            queryClient.invalidateQueries({ queryKey: ['screen-groups'] });
        },
    });

    const bulkMutation = useMutation({
        mutationFn: ({ screenIds, commandType }: { screenIds: string[]; commandType: RemoteCommandType }) =>
            cmsCommandsApi.bulkIssue({ screenIds, commandType, payload: null }),
        onSuccess: () => enqueueSnackbar('Bulk command sent', { variant: 'success' }),
        onError: () => enqueueSnackbar('Bulk command failed', { variant: 'error' }),
    });

    const openAdd = () => {
        setForm({ name: '', description: '', screenIds: [] });
        setDialogOpen(true);
    };

    const handleSubmit = () => {
        createMutation.mutate({ name: form.name, description: form.description || undefined, screenIds: form.screenIds });
    };

    const toggleScreen = (id: string) => {
        setForm(f => ({
            ...f,
            screenIds: f.screenIds.includes(id) ? f.screenIds.filter(x => x !== id) : [...f.screenIds, id],
        }));
    };

    return (
        <Box>
            <Stack direction="row" justifyContent="space-between" alignItems="center" mb={3}>
                <Box>
                    <Typography variant="h5" fontWeight={700}>Screen Groups</Typography>
                    <Typography variant="body2" color="text.secondary">Manage grouped screens for bulk operations</Typography>
                </Box>
                <Button variant="contained" startIcon={<AddIcon />} onClick={openAdd}>New group</Button>
            </Stack>

            {isLoading && (
                <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}><CircularProgress /></Box>
            )}

            {!isLoading && groups.length === 0 && (
                <EmptyState title="No groups" message="Create a screen group to manage multiple screens at once." />
            )}

            <Stack spacing={2}>
                {groups.map(group => (
                    <Accordion
                        key={group.id}
                        sx={{
                            bgcolor: 'background.paper',
                            border: '1px solid rgba(255,255,255,0.1)',
                            '&:before': { display: 'none' },
                        }}
                    >
                        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                            <Stack direction="row" alignItems="center" spacing={2} sx={{ flex: 1, pr: 2 }}>
                                <GroupIcon color="primary" />
                                <Box sx={{ flex: 1 }}>
                                    <Typography fontWeight={600}>{group.name}</Typography>
                                    {group.description && (
                                        <Typography variant="caption" color="text.secondary">{group.description}</Typography>
                                    )}
                                </Box>
                                <Chip size="small" label={`${group.memberCount} screens`} />
                                <Stack direction="row" spacing={0.5} onClick={e => e.stopPropagation()}>
                                    <Tooltip title="Delete group">
                                        <IconButton size="small" color="error" onClick={() => deleteMutation.mutate(group.id)}>
                                            <DeleteIcon fontSize="small" />
                                        </IconButton>
                                    </Tooltip>
                                </Stack>
                            </Stack>
                        </AccordionSummary>
                        <AccordionDetails>
                            <Stack direction="row" spacing={1} mb={2} flexWrap="wrap" useFlexGap>
                                {['Play', 'Pause', 'Skip', 'Reboot'].map(cmd => (
                                    <Button
                                        key={cmd}
                                        size="small"
                                        variant="outlined"
                                        onClick={() => bulkMutation.mutate({ screenIds: group.screenIds, commandType: cmd as RemoteCommandType })}
                                        disabled={group.screenIds.length === 0}
                                    >
                                        {cmd} all
                                    </Button>
                                ))}
                            </Stack>
                            <List dense>
                                {group.screenIds.length === 0 && (
                                    <ListItem>
                                        <ListItemText secondary="No screens in this group" />
                                    </ListItem>
                                )}
                                {group.screenIds.map(sid => {
                                    const screen = screens.find(s => s.id === sid);
                                    return (
                                        <ListItem key={sid}>
                                            <ListItemText primary={screen?.name ?? sid} />
                                        </ListItem>
                                    );
                                })}
                            </List>
                        </AccordionDetails>
                    </Accordion>
                ))}
            </Stack>

            {/* Create dialog */}
            <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
                <DialogTitle>New screen group</DialogTitle>
                <DialogContent>
                    <Stack spacing={2} sx={{ mt: 1 }}>
                        <TextField
                            label="Group name"
                            size="small"
                            value={form.name}
                            onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                        />
                        <TextField
                            label="Description (optional)"
                            size="small"
                            value={form.description}
                            onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                        />
                        <Box>
                            <Typography variant="caption" color="text.secondary" mb={0.5} display="block">
                                Select screens ({form.screenIds.length} selected)
                            </Typography>
                            <List dense sx={{ maxHeight: 220, overflow: 'auto', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 1 }}>
                                {screens.map(s => (
                                    <ListItemButton key={s.id} onClick={() => toggleScreen(s.id)}>
                                        <ListItemIcon>
                                            <Checkbox edge="start" checked={form.screenIds.includes(s.id)} size="small" />
                                        </ListItemIcon>
                                        <ListItemText primary={s.name} />
                                    </ListItemButton>
                                ))}
                            </List>
                        </Box>
                    </Stack>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
                    <Button
                        variant="contained"
                        onClick={handleSubmit}
                        disabled={!form.name || createMutation.isPending}
                    >
                        Create
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
}