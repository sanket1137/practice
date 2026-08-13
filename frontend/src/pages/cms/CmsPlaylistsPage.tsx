import { useState, useMemo } from 'react';
import {
    Box, Button, Card, CardContent, Typography, Stack, Grid, Chip, Dialog,
    DialogTitle, DialogContent, DialogActions, TextField, MenuItem, IconButton,
    Tooltip, Divider, Skeleton,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import StarIcon from '@mui/icons-material/Star';
import StarBorderIcon from '@mui/icons-material/StarBorder';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import DragIndicatorIcon from '@mui/icons-material/DragIndicator';
import PlaylistPlayIcon from '@mui/icons-material/PlaylistPlay';
import {
    DndContext, closestCenter, PointerSensor, KeyboardSensor, useSensor, useSensors,
    type DragEndEvent,
} from '@dnd-kit/core';
import {
    SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable,
    verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { useSnackbar } from 'notistack';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { api } from '../../services/api';
import { cmsMediaApi, cmsPlaylistApi } from '../../services/cmsApi';
import EmptyState from '../../components/common/EmptyState';
import type { CmsPlaylistDto, CmsPlaylistItemDto, CmsPlaylistType, PlaylistItemInput } from '../../types/cms';

interface SimpleScreen { id: string; name: string; defaultPlaylistId?: string; }

const createSchema = z.object({
    name: z.string().min(1, 'Name required').max(100),
    playlistType: z.enum(['Standard', 'Shuffle', 'Conditional']),
});
type CreateForm = z.infer<typeof createSchema>;

export default function CmsPlaylistsPage() {
    const [searchParams, setSearchParams] = useSearchParams();
    const screenId = searchParams.get('screenId');
    const { enqueueSnackbar } = useSnackbar();
    const queryClient = useQueryClient();

    const [createOpen, setCreateOpen] = useState(false);
    const [editingPlaylist, setEditingPlaylist] = useState<CmsPlaylistDto | null>(null);

    const { data: screens } = useQuery({
        queryKey: ['cms-screens-simple'],
        queryFn: async () => {
            const res = await api.get('/screens');
            const list = res.data?.data;
            return Array.isArray(list) ? (list as SimpleScreen[]) : [];
        },
    });

    const selectedScreen = useMemo(
        () => screens?.find((s) => s.id === screenId) ?? screens?.[0],
        [screens, screenId],
    );

    const effectiveScreenId = selectedScreen?.id;

    const { data: playlists, isLoading } = useQuery({
        queryKey: ['cms-playlists', effectiveScreenId],
        queryFn: () => cmsPlaylistApi.listForScreen(effectiveScreenId!),
        enabled: !!effectiveScreenId,
    });

    const createForm = useForm<CreateForm>({
        resolver: zodResolver(createSchema),
        defaultValues: { name: '', playlistType: 'Standard' },
    });

    const createMut = useMutation({
        mutationFn: (body: CreateForm) =>
            cmsPlaylistApi.create({ screenId: effectiveScreenId!, ...body }),
        onSuccess: () => {
            enqueueSnackbar('Playlist created', { variant: 'success' });
            setCreateOpen(false);
            createForm.reset();
            queryClient.invalidateQueries({ queryKey: ['cms-playlists', effectiveScreenId] });
        },
        onError: (err: { response?: { data?: { message?: string } } }) => {
            enqueueSnackbar(err.response?.data?.message ?? 'Create failed', { variant: 'error' });
        },
    });

    const setDefaultMut = useMutation({
        mutationFn: (playlistId: string) => cmsPlaylistApi.setDefault(playlistId, effectiveScreenId!),
        onSuccess: () => {
            enqueueSnackbar('Default updated', { variant: 'success' });
            queryClient.invalidateQueries({ queryKey: ['cms-screens'] });
            queryClient.invalidateQueries({ queryKey: ['cms-screens-simple'] });
        },
    });

    const deleteMut = useMutation({
        mutationFn: (id: string) => cmsPlaylistApi.delete(id),
        onSuccess: () => {
            enqueueSnackbar('Playlist deleted', { variant: 'success' });
            queryClient.invalidateQueries({ queryKey: ['cms-playlists', effectiveScreenId] });
        },
    });

    if (!screens?.length) {
        return (
            <EmptyState
                title="No screens paired yet"
                message="Pair a screen from the Screens page before you can create playlists."
                icon={<PlaylistPlayIcon sx={{ fontSize: 64, color: 'text.disabled' }} />}
            />
        );
    }

    return (
        <Box>
            <Stack direction="row" justifyContent="space-between" alignItems="center" mb={3}>
                <Box>
                    <Typography variant="h5" fontWeight={700}>Playlists</Typography>
                    <Typography variant="body2" color="text.secondary">
                        Playlist sequences delivered to your screens
                    </Typography>
                </Box>
                <Stack direction="row" spacing={2}>
                    <TextField
                        select
                        size="small"
                        label="Screen"
                        value={effectiveScreenId ?? ''}
                        onChange={(e) => setSearchParams({ screenId: e.target.value })}
                        sx={{ minWidth: 200 }}
                    >
                        {screens.map((s) => (
                            <MenuItem key={s.id} value={s.id}>{s.name}</MenuItem>
                        ))}
                    </TextField>
                    <Button variant="contained" startIcon={<AddIcon />} onClick={() => setCreateOpen(true)}>
                        New playlist
                    </Button>
                </Stack>
            </Stack>

            {isLoading && (
                <Grid container spacing={2}>
                    {Array.from({ length: 4 }).map((_, i) => (
                        <Grid key={i} size={{ xs: 12, md: 6 }}>
                            <Card>
                                <CardContent>
                                    <Skeleton variant="text" width="50%" height={32} />
                                    <Stack direction="row" spacing={1} mt={1}>
                                        <Skeleton variant="rounded" width={70} height={24} />
                                        <Skeleton variant="rounded" width={70} height={24} />
                                        <Skeleton variant="rounded" width={40} height={24} />
                                    </Stack>
                                </CardContent>
                            </Card>
                        </Grid>
                    ))}
                </Grid>
            )}
            {!isLoading && (playlists?.length ?? 0) === 0 && (
                <EmptyState
                    title="No playlists yet"
                    message="Create your first playlist and assign it as the default for this screen."
                    icon={<PlaylistPlayIcon sx={{ fontSize: 64, color: 'text.disabled' }} />}
                    action={{ label: 'New playlist', onClick: () => setCreateOpen(true) }}
                />
            )}

            <Grid container spacing={2}>
                {playlists?.map((p) => (
                    <Grid key={p.id} size={{ xs: 12, md: 6 }}>
                        <Card>
                            <CardContent>
                                <Stack direction="row" alignItems="center" justifyContent="space-between">
                                    <Stack direction="row" spacing={1} alignItems="center">
                                        <Typography variant="h6">{p.name}</Typography>
                                        {p.isDefault && <Chip size="small" color="primary" label="Default" icon={<StarIcon />} />}
                                    </Stack>
                                    <Stack direction="row" spacing={0.5}>
                                        <Tooltip title={p.isDefault ? 'Default' : 'Set as default'}>
                                            <span>
                                                <IconButton
                                                    disabled={p.isDefault}
                                                    onClick={() => setDefaultMut.mutate(p.id)}
                                                >
                                                    {p.isDefault ? <StarIcon color="primary" /> : <StarBorderIcon />}
                                                </IconButton>
                                            </span>
                                        </Tooltip>
                                        <Tooltip title="Edit items">
                                            <IconButton onClick={() => setEditingPlaylist(p)}>
                                                <EditIcon />
                                            </IconButton>
                                        </Tooltip>
                                        <Tooltip title="Delete">
                                            <IconButton onClick={() => {
                                                if (window.confirm(`Delete "${p.name}"?`)) deleteMut.mutate(p.id);
                                            }}>
                                                <DeleteIcon />
                                            </IconButton>
                                        </Tooltip>
                                    </Stack>
                                </Stack>
                                <Stack direction="row" spacing={1} mt={1}>
                                    <Chip size="small" variant="outlined" label={p.playlistType} />
                                    <Chip size="small" variant="outlined" label={`${p.items.length} items`} />
                                    <Chip size="small" variant="outlined" label={`v${p.version}`} />
                                </Stack>
                                {p.lastPublishedAt && (
                                    <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                                        Last published {new Date(p.lastPublishedAt).toLocaleString()}
                                    </Typography>
                                )}
                            </CardContent>
                        </Card>
                    </Grid>
                ))}
            </Grid>

            <Dialog open={createOpen} onClose={() => setCreateOpen(false)} maxWidth="sm" fullWidth>
                <form onSubmit={createForm.handleSubmit((v) => createMut.mutate(v))}>
                    <DialogTitle>Create playlist</DialogTitle>
                    <DialogContent>
                        <Stack spacing={2} sx={{ pt: 1 }}>
                            <Controller
                                name="name"
                                control={createForm.control}
                                render={({ field, fieldState }) => (
                                    <TextField {...field} label="Name" fullWidth required
                                        error={!!fieldState.error}
                                        helperText={fieldState.error?.message} />
                                )}
                            />
                            <Controller
                                name="playlistType"
                                control={createForm.control}
                                render={({ field }) => (
                                    <TextField {...field} select label="Type" fullWidth>
                                        <MenuItem value="Standard">Standard — sequential loop</MenuItem>
                                        <MenuItem value="Shuffle">Shuffle — randomised order</MenuItem>
                                        <MenuItem value="Conditional">Conditional — rule-based</MenuItem>
                                    </TextField>
                                )}
                            />
                        </Stack>
                    </DialogContent>
                    <DialogActions>
                        <Button onClick={() => setCreateOpen(false)}>Cancel</Button>
                        <Button type="submit" variant="contained" disabled={createMut.isPending}>Create</Button>
                    </DialogActions>
                </form>
            </Dialog>

            {editingPlaylist && (
                <PlaylistItemsEditor
                    playlist={editingPlaylist}
                    onClose={() => setEditingPlaylist(null)}
                    onSaved={() => {
                        setEditingPlaylist(null);
                        queryClient.invalidateQueries({ queryKey: ['cms-playlists', effectiveScreenId] });
                    }}
                />
            )}
        </Box>
    );
}

function PlaylistItemsEditor({
    playlist, onClose, onSaved,
}: { playlist: CmsPlaylistDto; onClose: () => void; onSaved: () => void }) {
    const { enqueueSnackbar } = useSnackbar();
    const [items, setItems] = useState<CmsPlaylistItemDto[]>(playlist.items);

    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
        useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
    );

    const { data: mediaPage } = useQuery({
        queryKey: ['cms-media-picker'],
        queryFn: () => cmsMediaApi.list(1, 100),
    });

    const addAsset = (mediaAssetId: string, itemType: 'Image' | 'Video' | 'Html5') => {
        const asset = mediaPage?.items.find((a) => a.id === mediaAssetId);
        setItems((prev) => [
            ...prev,
            {
                id: `new-${crypto.randomUUID()}`,
                mediaAssetId,
                itemType,
                order: prev.length,
                durationSeconds: itemType === 'Video' ? (asset?.durationSeconds ?? undefined) : 10,
                mediaAsset: asset,
            },
        ]);
    };

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;
        if (!over || active.id === over.id) return;
        setItems((prev) => {
            const oldIndex = prev.findIndex((it) => it.id === active.id);
            const newIndex = prev.findIndex((it) => it.id === over.id);
            if (oldIndex < 0 || newIndex < 0) return prev;
            return arrayMove(prev, oldIndex, newIndex).map((it, i) => ({ ...it, order: i }));
        });
    };

    const updateDuration = (id: string, durationSeconds: number | undefined) => {
        setItems((prev) => prev.map((p) => (p.id === id ? { ...p, durationSeconds } : p)));
    };

    const remove = (id: string) => {
        setItems((prev) => prev.filter((it) => it.id !== id).map((it, i) => ({ ...it, order: i })));
    };

    const saveMut = useMutation({
        mutationFn: () => {
            const payload: PlaylistItemInput[] = items.map((it) => ({
                mediaAssetId: it.mediaAssetId,
                itemType: it.itemType,
                durationSeconds: it.durationSeconds,
            }));
            return cmsPlaylistApi.replaceItems(playlist.id, {
                expectedVersion: playlist.version,
                items: payload,
            });
        },
        onSuccess: () => {
            enqueueSnackbar('Playlist published', { variant: 'success' });
            onSaved();
        },
        onError: (err: { response?: { data?: { message?: string } } }) => {
            enqueueSnackbar(err.response?.data?.message ?? 'Publish failed', { variant: 'error' });
        },
    });

    const inferType = (mime: string): 'Image' | 'Video' | 'Html5' => {
        if (mime.startsWith('image/')) return 'Image';
        if (mime.startsWith('video/')) return 'Video';
        return 'Html5';
    };

    return (
        <Dialog open onClose={onClose} maxWidth="lg" fullWidth>
            <DialogTitle>Edit “{playlist.name}”</DialogTitle>
            <DialogContent>
                <Grid container spacing={3}>
                    <Grid size={{ xs: 12, md: 7 }}>
                        <Typography variant="subtitle2" gutterBottom>
                            Playlist sequence {items.length > 0 && <Chip size="small" label={`${items.length} items`} sx={{ ml: 1 }} />}
                        </Typography>
                        {items.length === 0 && (
                            <Box sx={{ py: 4, textAlign: 'center', border: '1px dashed', borderColor: 'divider', borderRadius: 1 }}>
                                <Typography variant="body2" color="text.secondary">
                                    Add media from the library on the right, then drag to reorder.
                                </Typography>
                            </Box>
                        )}
                        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                            <SortableContext items={items.map((it) => it.id)} strategy={verticalListSortingStrategy}>
                                <Stack spacing={1}>
                                    {items.map((it, idx) => (
                                        <SortableItemRow
                                            key={it.id}
                                            index={idx}
                                            item={it}
                                            onChangeDuration={(v) => updateDuration(it.id, v)}
                                            onRemove={() => remove(it.id)}
                                        />
                                    ))}
                                </Stack>
                            </SortableContext>
                        </DndContext>
                    </Grid>
                    <Grid size={{ xs: 12, md: 5 }}>
                        <Typography variant="subtitle2" gutterBottom>Media library</Typography>
                        <Divider sx={{ mb: 1 }} />
                        <Box sx={{ maxHeight: 500, overflow: 'auto' }}>
                            <Stack spacing={1}>
                                {mediaPage?.items.filter((a) => a.isReady).map((a) => (
                                    <Card key={a.id} variant="outlined">
                                        <CardContent sx={{ py: 1, '&:last-child': { pb: 1 } }}>
                                            <Stack direction="row" alignItems="center" spacing={1}>
                                                <Box sx={{ flex: 1, minWidth: 0 }}>
                                                    <Typography variant="body2" noWrap>{a.originalName}</Typography>
                                                    <Typography variant="caption" color="text.secondary">
                                                        {a.mimeType}
                                                    </Typography>
                                                </Box>
                                                <Button size="small" onClick={() => addAsset(a.id, inferType(a.mimeType))}>
                                                    Add
                                                </Button>
                                            </Stack>
                                        </CardContent>
                                    </Card>
                                ))}
                            </Stack>
                        </Box>
                    </Grid>
                </Grid>
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose}>Cancel</Button>
                <Button variant="contained" disabled={saveMut.isPending} onClick={() => saveMut.mutate()}>
                    Publish (v{playlist.version + 1})
                </Button>
            </DialogActions>
        </Dialog>
    );
}
// Silence unused import warnings for the type alias
export type { CmsPlaylistType };

interface SortableItemRowProps {
    index: number;
    item: CmsPlaylistItemDto;
    onChangeDuration: (value: number | undefined) => void;
    onRemove: () => void;
}

function SortableItemRow({ index, item, onChangeDuration, onRemove }: SortableItemRowProps) {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id });
    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.6 : 1,
    };
    return (
        <Card ref={setNodeRef} style={style} variant="outlined" sx={{ cursor: isDragging ? 'grabbing' : undefined }}>
            <CardContent sx={{ py: 1, '&:last-child': { pb: 1 } }}>
                <Stack direction="row" alignItems="center" spacing={1}>
                    <Box
                        {...attributes}
                        {...listeners}
                        sx={{ cursor: 'grab', color: 'text.secondary', display: 'flex', alignItems: 'center' }}
                        aria-label="Drag to reorder"
                    >
                        <DragIndicatorIcon />
                    </Box>
                    <Typography sx={{ width: 24, color: 'text.secondary' }}>{index + 1}.</Typography>
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Typography variant="body2" noWrap>
                            {item.mediaAsset?.originalName ?? item.mediaAssetId}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                            {item.itemType}
                            {item.mediaAsset?.sizeBytes &&
                                ` \u00b7 ${(item.mediaAsset.sizeBytes / (1024 * 1024)).toFixed(1)} MB`}
                        </Typography>
                    </Box>
                    <TextField
                        type="number"
                        size="small"
                        label="Sec"
                        sx={{ width: 90 }}
                        value={item.durationSeconds ?? ''}
                        onChange={(e) => {
                            const v = e.target.value === '' ? undefined : Number(e.target.value);
                            onChangeDuration(v);
                        }}
                    />
                    <Tooltip title="Remove from playlist">
                        <IconButton size="small" onClick={onRemove}>
                            <DeleteIcon />
                        </IconButton>
                    </Tooltip>
                </Stack>
            </CardContent>
        </Card>
    );
}
