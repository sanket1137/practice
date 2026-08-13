import { useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  Checkbox,
  Chip,
  Container,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  MenuItem,
  Stack,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Tabs,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import CheckIcon from '@mui/icons-material/Check';
import CloseIcon from '@mui/icons-material/Close';
import PlayCircleIcon from '@mui/icons-material/PlayCircle';
import ImageIcon from '@mui/icons-material/Image';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSnackbar } from 'notistack';
import { format, parseISO } from 'date-fns';
import api from '../../services/api';

interface AdminCreativeDto {
  id: string;
  name: string;
  fileName: string;
  fileUrl: string;
  thumbnailUrl?: string;
  mimeType: string;
  fileSize: number;
  width?: number;
  height?: number;
  duration?: number;
  status: string;
  reviewNotes?: string;
  reviewedAt?: string;
  uploaderName?: string;
  uploaderEmail?: string;
  createdAt: string;
}

const STATUS_TABS = ['PendingReview', 'Approved', 'Rejected'] as const;
type StatusTab = typeof STATUS_TABS[number];

const PRESET_REASONS = [
  'Creative exceeds slot duration',
  'Low resolution / quality',
  'Content policy violation',
  'Wrong file format',
  'Inappropriate content',
] as const;

const STATUS_COLORS: Record<StatusTab, 'warning' | 'success' | 'error'> = {
  PendingReview: 'warning',
  Approved: 'success',
  Rejected: 'error',
};

const fetchCreatives = async (status: string): Promise<AdminCreativeDto[]> => {
  const res = await api.get('/creatives/admin/queue', { params: { status, page: 1, pageSize: 50 } });
  return res.data.data ?? [];
};

export default function AdminCreativeReviewPage() {
  const { enqueueSnackbar } = useSnackbar();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<StatusTab>('PendingReview');
  const [selected, setSelected] = useState<string[]>([]);
  const [rejectTarget, setRejectTarget] = useState<string | null>(null);
  const [rejectNotes, setRejectNotes] = useState('');
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewMime, setPreviewMime] = useState('');

  const { data: creatives = [], isLoading, error } = useQuery({
    queryKey: ['admin-creatives', tab],
    queryFn: () => fetchCreatives(tab),
    staleTime: 0,
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['admin-creatives'] });

  const reviewMutation = useMutation({
    mutationFn: ({ id, action, notes }: { id: string; action: string; notes?: string }) =>
      api.put(`/creatives/${id}/review`, { action, reviewNotes: notes }),
    onSuccess: () => { invalidate(); enqueueSnackbar('Creative reviewed', { variant: 'success' }); setRejectTarget(null); setRejectNotes(''); },
    onError: () => enqueueSnackbar('Review failed', { variant: 'error' }),
  });

  const bulkApproveMutation = useMutation({
    mutationFn: (ids: string[]) => api.post('/creatives/admin/bulk-approve', { creativeIds: ids }),
    onSuccess: () => { invalidate(); setSelected([]); enqueueSnackbar(`${selected.length} creatives approved`, { variant: 'success' }); },
    onError: () => enqueueSnackbar('Bulk approve failed', { variant: 'error' }),
  });

  const toggleSelect = (id: string) => {
    setSelected(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const toggleAll = () => {
    if (selected.length === creatives.length) setSelected([]);
    else setSelected(creatives.map(c => c.id));
  };

  return (
    <Container maxWidth="xl" sx={{ py: 4 }}>
      <Box
        sx={{
          p: { xs: 2.5, md: 3.5 },
          mb: 3,
          borderRadius: 3,
          background:
            'radial-gradient(900px 340px at 100% -8%, rgba(10,102,216,0.12), transparent 60%), #ffffff',
          border: '1px solid rgba(16, 24, 40, 0.08)',
          boxShadow: '0 8px 24px rgba(16, 24, 40, 0.06)',
        }}
      >
        <Typography variant="h4" gutterBottom sx={{ mb: 0.5 }}>Creative review queue</Typography>
        <Typography variant="body1" color="text.secondary">
          Approve, reject, or request changes on uploaded creatives.
        </Typography>
      </Box>

      <Tabs value={tab} onChange={(_, v) => { setTab(v); setSelected([]); }} sx={{ mb: 3 }}>
        {STATUS_TABS.map((s) => (
          <Tab key={s} value={s} label={s === 'PendingReview' ? 'Pending review' : s} />
        ))}
      </Tabs>

      {tab === 'PendingReview' && selected.length > 0 && (
        <Box sx={{ mb: 2, display: 'flex', gap: 1, alignItems: 'center' }}>
          <Typography variant="body2">{selected.length} selected</Typography>
          <Button
            variant="contained"
            color="success"
            size="small"
            startIcon={<CheckIcon />}
            onClick={() => bulkApproveMutation.mutate(selected)}
            disabled={bulkApproveMutation.isPending}
          >
            Bulk approve
          </Button>
        </Box>
      )}

      {isLoading && <Typography>Loading�</Typography>}

      {error && <Alert severity="error">Failed to load creatives</Alert>}

      {!isLoading && creatives.length === 0 && (
        <Box sx={{ textAlign: 'center', py: 6 }}>
          <Typography variant="h6">No creatives in this queue</Typography>
        </Box>
      )}

      {creatives.length > 0 && (
        <Card variant="outlined" sx={{ bgcolor: 'background.paper' }}>
          <Table stickyHeader>
            <TableHead>
              <TableRow>
                {tab === 'PendingReview' && (
                  <TableCell padding="checkbox">
                    <Checkbox
                      indeterminate={selected.length > 0 && selected.length < creatives.length}
                      checked={selected.length === creatives.length}
                      onChange={toggleAll}
                    />
                  </TableCell>
                )}
                <TableCell>Preview</TableCell>
                <TableCell>Name</TableCell>
                <TableCell>Uploader</TableCell>
                <TableCell>Resolution</TableCell>
                <TableCell>Size</TableCell>
                <TableCell>Uploaded</TableCell>
                {tab !== 'PendingReview' && <TableCell>Review notes</TableCell>}
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {creatives.map((c) => (
                <TableRow key={c.id} sx={{ '&:hover': { bgcolor: 'rgba(255,255,255,0.04)' } }}>
                  {tab === 'PendingReview' && (
                    <TableCell padding="checkbox">
                      <Checkbox checked={selected.includes(c.id)} onChange={() => toggleSelect(c.id)} />
                    </TableCell>
                  )}
                  <TableCell>
                    <IconButton
                      size="small"
                      onClick={() => { setPreviewUrl(c.fileUrl); setPreviewMime(c.mimeType); }}
                    >
                      {c.mimeType.startsWith('video') ? <PlayCircleIcon /> : <ImageIcon />}
                    </IconButton>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" fontWeight={600}>{c.name}</Typography>
                    <Typography variant="caption" sx={{ color: 'text.secondary' }}>{c.fileName}</Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">{c.uploaderName ?? '�'}</Typography>
                    <Typography variant="caption" sx={{ color: 'text.secondary' }}>{c.uploaderEmail ?? ''}</Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">{c.width && c.height ? `${c.width}�${c.height}` : '�'}</Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">{(c.fileSize / 1024).toFixed(0)} KB</Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">{format(parseISO(c.createdAt), 'dd MMM yyyy')}</Typography>
                  </TableCell>
                  {tab !== 'PendingReview' && (
                    <TableCell>
                      <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                        {c.reviewNotes ?? '�'}
                      </Typography>
                    </TableCell>
                  )}
                  <TableCell align="right">
                    {tab === 'PendingReview' && (
                      <Stack direction="row" justifyContent="flex-end" gap={0.5}>
                        <Tooltip title="Approve">
                          <IconButton
                            size="small"
                            color="success"
                            onClick={() => reviewMutation.mutate({ id: c.id, action: 'approve' })}
                          >
                            <CheckIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Reject">
                          <IconButton
                            size="small"
                            color="error"
                            onClick={() => { setRejectTarget(c.id); setRejectNotes(''); }}
                          >
                            <CloseIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </Stack>
                    )}
                    {tab !== 'PendingReview' && (
                      <Chip
                        label={c.status}
                        size="small"
                        color={STATUS_COLORS[c.status as StatusTab] ?? 'default'}
                        variant="outlined"
                      />
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      {/* Reject dialog */}
      <Dialog open={!!rejectTarget} onClose={() => setRejectTarget(null)} maxWidth="sm" fullWidth>
        <DialogTitle>Reject creative</DialogTitle>
        <DialogContent dividers>
          <TextField
            label="Reason"
            select
            fullWidth
            sx={{ mb: 2 }}
            value={(PRESET_REASONS as readonly string[]).includes(rejectNotes) ? rejectNotes : rejectNotes ? 'custom' : ''}
            onChange={(e) => {
              if (e.target.value === 'custom') setRejectNotes('');
              else setRejectNotes(e.target.value);
            }}
          >
            {PRESET_REASONS.map((r) => (
              <MenuItem key={r} value={r}>{r}</MenuItem>
            ))}
            <MenuItem value="custom">Custom reason…</MenuItem>
          </TextField>
          {(!(PRESET_REASONS as readonly string[]).includes(rejectNotes)) && (
            <TextField
              label="Custom reason (shown to advertiser)"
              multiline
              rows={3}
              fullWidth
              value={rejectNotes}
              onChange={(e) => setRejectNotes(e.target.value)}
              placeholder="Describe the issue clearly so the advertiser can fix it…"
            />
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRejectTarget(null)}>Cancel</Button>
          <Button
            variant="contained"
            color="error"
            onClick={() => rejectTarget && reviewMutation.mutate({ id: rejectTarget, action: 'reject', notes: rejectNotes })}
            disabled={reviewMutation.isPending || !rejectNotes.trim()}
          >
            Reject
          </Button>
        </DialogActions>
      </Dialog>

      {/* Preview dialog */}
      <Dialog open={!!previewUrl} onClose={() => setPreviewUrl(null)} maxWidth="md">
        <DialogTitle>Preview</DialogTitle>
        <DialogContent>
          {previewMime.startsWith('video') ? (
            <video
              src={previewUrl ?? ''}
              controls
              style={{ width: '100%', maxHeight: 480, borderRadius: 4 }}
            />
          ) : (
            <Box
              component="img"
              src={previewUrl ?? ''}
              alt="Preview"
              sx={{ width: '100%', maxHeight: 480, objectFit: 'contain', borderRadius: 1 }}
            />
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPreviewUrl(null)}>Close</Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
}
