import { useMemo, useState } from 'react';
import {
  Box,
  Button,
  Card,
  CardActionArea,
  CardContent,
  Chip,
  Container,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Grid,
  IconButton,
  InputAdornment,
  LinearProgress,
  Menu,
  MenuItem,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import {
  CloudUpload as UploadIcon,
  Search as SearchIcon,
  MoreVert as MoreIcon,
  Delete as DeleteIcon,
  Edit as EditIcon,
  Image as ImageIcon,
  Movie as MovieIcon,
  PermMedia as MediaIcon,
} from '@mui/icons-material';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSnackbar } from 'notistack';
import { isAxiosError } from 'axios';
import mediaApi, { type MediaCreative } from '../../services/mediaApi';

function getErrorMessage(err: unknown, fallback: string): string {
  if (isAxiosError(err)) {
    const message = (err.response?.data as { message?: string } | undefined)?.message;
    if (message) return message;
  }
  return fallback;
}

const STATUS_COLOR: Record<MediaCreative['status'], 'warning' | 'success' | 'error'> = {
  PendingReview: 'warning',
  Approved: 'success',
  Rejected: 'error',
};

function formatBytes(bytes: number): string {
  if (!bytes) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  let i = 0;
  let v = bytes;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v.toFixed(v < 10 && i > 0 ? 1 : 0)} ${units[i]}`;
}

export default function MediaLibraryPage() {
  const queryClient = useQueryClient();
  const { enqueueSnackbar } = useSnackbar();

  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'library' | 'attached'>('all');
  const [uploadOpen, setUploadOpen] = useState(false);
  const [menuAnchor, setMenuAnchor] = useState<{ el: HTMLElement; item: MediaCreative } | null>(null);
  const [editing, setEditing] = useState<MediaCreative | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<MediaCreative | null>(null);

  const { data: items = [], isLoading, error, refetch } = useQuery({
    queryKey: ['media-library'],
    queryFn: mediaApi.listLibrary,
    staleTime: 30_000,
  });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((it) => {
      if (filter === 'library' && it.campaignId) return false;
      if (filter === 'attached' && !it.campaignId) return false;
      if (!q) return true;
      return (
        it.name.toLowerCase().includes(q) ||
        it.fileName.toLowerCase().includes(q)
      );
    });
  }, [items, search, filter]);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['media-library'] });

  const updateMutation = useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: { name?: string; duration?: number } }) =>
      mediaApi.updateMetadata(id, patch),
    onSuccess: () => {
      invalidate();
      enqueueSnackbar('Updated', { variant: 'success' });
      setEditing(null);
    },
    onError: (err: unknown) =>
      enqueueSnackbar(getErrorMessage(err, 'Update failed'), { variant: 'error' }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => mediaApi.remove(id),
    onSuccess: () => {
      invalidate();
      enqueueSnackbar('Deleted', { variant: 'success' });
      setConfirmDelete(null);
    },
    onError: (err: unknown) =>
      enqueueSnackbar(getErrorMessage(err, 'Delete failed'), { variant: 'error' }),
  });

  return (
    <Container maxWidth="xl" sx={{ py: 3 }}>
      {/* Page header */}
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems={{ sm: 'center' }} sx={{ mb: 3 }}>
        <Box sx={{ flex: 1 }}>
          <Typography variant="h5" fontWeight={600}>
            Media Library
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Upload, organise and reuse creatives across campaigns.
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<UploadIcon />}
          onClick={() => setUploadOpen(true)}
        >
          Upload media
        </Button>
      </Stack>

      {/* Toolbar */}
      <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} sx={{ mb: 3 }}>
        <TextField
          size="small"
          placeholder="Search by name or file"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon fontSize="small" />
              </InputAdornment>
            ),
          }}
          sx={{ flex: 1, maxWidth: { md: 360 } }}
        />
        <Stack direction="row" spacing={1}>
          {(['all', 'library', 'attached'] as const).map((f) => (
            <Chip
              key={f}
              label={
                f === 'all' ? `All (${items.length})`
                : f === 'library' ? `In library (${items.filter((x) => !x.campaignId).length})`
                : `Attached (${items.filter((x) => x.campaignId).length})`
              }
              color={filter === f ? 'primary' : 'default'}
              variant={filter === f ? 'filled' : 'outlined'}
              onClick={() => setFilter(f)}
            />
          ))}
        </Stack>
      </Stack>

      {/* States */}
      {isLoading && <LinearProgress sx={{ mb: 3 }} />}
      {error && (
        <Card sx={{ p: 3, mb: 3, bgcolor: 'background.paper' }}>
          <Typography color="error" sx={{ mb: 1 }}>
            Couldn't load your media library.
          </Typography>
          <Button size="small" onClick={() => refetch()}>Retry</Button>
        </Card>
      )}
      {!isLoading && !error && filtered.length === 0 && (
        <Card sx={{ p: 6, textAlign: 'center', bgcolor: 'background.paper' }}>
          <MediaIcon sx={{ fontSize: 56, color: 'text.secondary', mb: 1 }} />
          <Typography variant="h6" sx={{ mb: 1 }}>
            {items.length === 0 ? 'Your media library is empty' : 'No matches'}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            {items.length === 0
              ? 'Upload videos and images once, then attach them to as many campaigns as you like.'
              : 'Try a different search term or filter.'}
          </Typography>
          {items.length === 0 && (
            <Button variant="contained" startIcon={<UploadIcon />} onClick={() => setUploadOpen(true)}>
              Upload your first creative
            </Button>
          )}
        </Card>
      )}

      {/* Grid */}
      <Grid container spacing={2}>
        {filtered.map((item) => {
          const isVideo = item.mimeType?.startsWith('video/');
          return (
            <Grid key={item.id} size={{ xs: 12, sm: 6, md: 4, lg: 3 }}>
              <Card
                variant="outlined"
                sx={{
                  bgcolor: 'background.paper',
                  borderColor: 'rgba(255,255,255,0.1)',
                  height: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                }}
              >
                <CardActionArea sx={{ flex: 1 }}>
                  <Box
                    sx={{
                      position: 'relative',
                      aspectRatio: '16/9',
                      bgcolor: '#0b1220',
                      overflow: 'hidden',
                    }}
                  >
                    {item.thumbnailUrl ? (
                      <Box
                        component="img"
                        src={item.thumbnailUrl}
                        alt={item.name}
                        sx={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      />
                    ) : isVideo ? (
                      <Box
                        component="video"
                        src={item.fileUrl}
                        muted
                        playsInline
                        sx={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      />
                    ) : item.mimeType?.startsWith('image/') ? (
                      <Box
                        component="img"
                        src={item.fileUrl}
                        alt={item.name}
                        sx={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      />
                    ) : (
                      <Stack
                        alignItems="center"
                        justifyContent="center"
                        sx={{ width: '100%', height: '100%' }}
                      >
                        {isVideo ? (
                          <MovieIcon sx={{ fontSize: 40, color: 'text.secondary' }} />
                        ) : (
                          <ImageIcon sx={{ fontSize: 40, color: 'text.secondary' }} />
                        )}
                      </Stack>
                    )}
                    <Chip
                      size="small"
                      label={item.status}
                      color={STATUS_COLOR[item.status] ?? 'default'}
                      sx={{ position: 'absolute', top: 8, left: 8, height: 22 }}
                    />
                    {item.campaignId && (
                      <Chip
                        size="small"
                        label="Attached"
                        color="info"
                        sx={{ position: 'absolute', top: 8, right: 8, height: 22 }}
                      />
                    )}
                  </Box>
                </CardActionArea>
                <CardContent sx={{ pb: '12px !important' }}>
                  <Stack direction="row" alignItems="flex-start" spacing={1}>
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography
                        variant="subtitle2"
                        noWrap
                        title={item.name}
                        sx={{ fontWeight: 600 }}
                      >
                        {item.name}
                      </Typography>
                      <Typography variant="caption" color="text.secondary" noWrap>
                        {item.width}×{item.height} · {item.duration}s · {formatBytes(item.fileSize)}
                      </Typography>
                    </Box>
                    <IconButton
                      size="small"
                      onClick={(e) => setMenuAnchor({ el: e.currentTarget, item })}
                    >
                      <MoreIcon fontSize="small" />
                    </IconButton>
                  </Stack>
                </CardContent>
              </Card>
            </Grid>
          );
        })}
      </Grid>

      {/* Row action menu */}
      <Menu
        anchorEl={menuAnchor?.el ?? null}
        open={Boolean(menuAnchor)}
        onClose={() => setMenuAnchor(null)}
      >
        <MenuItem
          onClick={() => {
            if (menuAnchor) setEditing(menuAnchor.item);
            setMenuAnchor(null);
          }}
        >
          <EditIcon fontSize="small" style={{ marginRight: 8 }} />
          Rename
        </MenuItem>
        <Tooltip
          title={menuAnchor?.item.campaignId ? 'Detach from campaign first or contact support.' : ''}
          placement="left"
        >
          <span>
            <MenuItem
              onClick={() => {
                if (menuAnchor) setConfirmDelete(menuAnchor.item);
                setMenuAnchor(null);
              }}
              sx={{ color: 'error.main' }}
            >
              <DeleteIcon fontSize="small" style={{ marginRight: 8 }} />
              Delete
            </MenuItem>
          </span>
        </Tooltip>
      </Menu>

      {/* Upload dialog */}
      <UploadDialog
        open={uploadOpen}
        onClose={() => setUploadOpen(false)}
        onUploaded={() => {
          invalidate();
          setUploadOpen(false);
        }}
      />

      {/* Rename dialog */}
      <Dialog open={Boolean(editing)} onClose={() => setEditing(null)} maxWidth="xs" fullWidth>
        <DialogTitle>Rename creative</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            fullWidth
            value={editing?.name ?? ''}
            onChange={(e) => setEditing((prev) => (prev ? { ...prev, name: e.target.value } : prev))}
            sx={{ mt: 1 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditing(null)}>Cancel</Button>
          <Button
            variant="contained"
            disabled={!editing?.name?.trim() || updateMutation.isPending}
            onClick={() => {
              if (editing) updateMutation.mutate({ id: editing.id, patch: { name: editing.name.trim() } });
            }}
          >
            Save
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete confirm */}
      <Dialog open={Boolean(confirmDelete)} onClose={() => setConfirmDelete(null)} maxWidth="xs" fullWidth>
        <DialogTitle>Delete creative?</DialogTitle>
        <DialogContent>
          <Typography variant="body2">
            “{confirmDelete?.name}” will be removed from your library. This can't be undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmDelete(null)}>Cancel</Button>
          <Button
            variant="contained"
            color="error"
            disabled={deleteMutation.isPending}
            onClick={() => confirmDelete && deleteMutation.mutate(confirmDelete.id)}
          >
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Upload dialog
// ────────────────────────────────────────────────────────────────────────────
interface UploadDialogProps {
  open: boolean;
  onClose: () => void;
  onUploaded: () => void;
}

function UploadDialog({ open, onClose, onUploaded }: UploadDialogProps) {
  const { enqueueSnackbar } = useSnackbar();
  const [file, setFile] = useState<File | null>(null);
  const [name, setName] = useState('');
  const [duration, setDuration] = useState(10);
  const [progress, setProgress] = useState(0);

  const mutation = useMutation({
    mutationFn: () =>
      mediaApi.upload({
        file: file!,
        name: name.trim(),
        duration,
        onProgress: setProgress,
      }),
    onSuccess: () => {
      enqueueSnackbar('Uploaded to library', { variant: 'success' });
      // Reset and close
      setFile(null);
      setName('');
      setDuration(10);
      setProgress(0);
      onUploaded();
    },
    onError: (err: unknown) =>
      enqueueSnackbar(getErrorMessage(err, 'Upload failed'), { variant: 'error' }),
  });

  const isVideo = file?.type.startsWith('video/');

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Upload to media library</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <Button
            variant="outlined"
            component="label"
            startIcon={<UploadIcon />}
            sx={{ py: 2 }}
          >
            {file ? file.name : 'Choose image or video'}
            <input
              type="file"
              hidden
              accept="image/*,video/*"
              onChange={(e) => {
                const f = e.target.files?.[0] ?? null;
                setFile(f);
                if (f && !name) setName(f.name.replace(/\.[^.]+$/, ''));
              }}
            />
          </Button>
          {file && (
            <Typography variant="caption" color="text.secondary">
              {formatBytes(file.size)} · {file.type || 'unknown type'}
            </Typography>
          )}

          <TextField
            label="Display name"
            fullWidth
            value={name}
            onChange={(e) => setName(e.target.value)}
          />

          <TextField
            label={isVideo ? 'Duration (seconds)' : 'Slot duration (seconds)'}
            type="number"
            fullWidth
            inputProps={{ min: 1, max: 600 }}
            value={duration}
            onChange={(e) => setDuration(Math.max(1, Number(e.target.value) || 1))}
            helperText={
              isVideo
                ? 'Will be auto-detected from the video file on the server.'
                : 'How long the image will display on screen per slot.'
            }
          />

          {mutation.isPending && (
            <Box>
              <LinearProgress variant="determinate" value={progress} />
              <Typography variant="caption" color="text.secondary">
                Uploading… {progress}%
              </Typography>
            </Box>
          )}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={mutation.isPending}>
          Cancel
        </Button>
        <Button
          variant="contained"
          disabled={!file || !name.trim() || mutation.isPending}
          onClick={() => mutation.mutate()}
        >
          Upload
        </Button>
      </DialogActions>
    </Dialog>
  );
}
