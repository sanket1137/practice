import { useState } from 'react';

import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  Chip,
  Grid,
  Divider,
  TextField,
  Alert,
  Skeleton,
  Stack,
  CircularProgress,
} from '@mui/material';
import VerifiedIcon from '@mui/icons-material/Verified';
import CloseIcon from '@mui/icons-material/Close';
import LocationOnIcon from '@mui/icons-material/LocationOn';
import VideocamIcon from '@mui/icons-material/Videocam';
import { format, parseISO } from 'date-fns';

import { useAdminVerificationDetail, useApproveVerification, useRejectVerification } from '../../hooks/useAdminVerifications';

interface VerificationDetailDialogProps {
  verificationId: string | null;
  open: boolean;
  onClose: () => void;
}

const STATUS_COLOR: Record<string, 'success' | 'warning' | 'error' | 'info' | 'default'> = {
  PendingReview: 'warning',
  Verified: 'success',
  Rejected: 'error',
  Unverified: 'default',
  QrDisplayed: 'info',
  ReVerificationRequired: 'warning',
};

export default function VerificationDetailDialog({
  verificationId,
  open,
  onClose,
}: VerificationDetailDialogProps) {
  const { data: detail, isLoading } = useAdminVerificationDetail(verificationId ?? '', open && !!verificationId);
  const approveMutation = useApproveVerification();
  const rejectMutation = useRejectVerification();

  const [rejectReason, setRejectReason] = useState('');
  const [showRejectForm, setShowRejectForm] = useState(false);

  const handleApprove = async () => {
    if (!verificationId) return;
    await approveMutation.mutateAsync(verificationId);
    onClose();
  };

  const handleReject = async () => {
    if (!verificationId || !rejectReason.trim()) return;
    await rejectMutation.mutateAsync({ id: verificationId, reason: rejectReason.trim() });
    setRejectReason('');
    setShowRejectForm(false);
    onClose();
  };

  const handleClose = () => {
    setShowRejectForm(false);
    setRejectReason('');
    onClose();
  };

  const isPending = detail?.status === 'PendingReview';
  const gpsDistance = detail?.gpsDistanceMeters;

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="md" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Typography variant="h6">Verification Detail</Typography>
        {detail && (
          <Chip
            label={detail.status}
            color={STATUS_COLOR[detail.status] ?? 'default'}
            size="small"
          />
        )}
      </DialogTitle>

      <DialogContent dividers>
        {isLoading ? (
          <Box>
            <Skeleton variant="rounded" height={200} sx={{ mb: 2 }} />
            <Skeleton variant="rounded" height={100} />
          </Box>
        ) : !detail ? (
          <Typography color="text.secondary">Verification not found</Typography>
        ) : (
          <Box>
            {/* Screen & owner info */}
            <Grid container spacing={2} sx={{ mb: 3 }}>
              <Grid size={{ xs: 12, sm: 6 }}>
                <Typography variant="caption" color="text.secondary">Screen</Typography>
                <Typography variant="body1" fontWeight={600}>{detail.screenName}</Typography>
                <Typography variant="body2" color="text.secondary">{detail.screenAddress}</Typography>
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <Typography variant="caption" color="text.secondary">Owner</Typography>
                <Typography variant="body1" fontWeight={600}>{detail.ownerName}</Typography>
                <Typography variant="body2" color="text.secondary">{detail.ownerEmail}</Typography>
              </Grid>
            </Grid>

            <Divider sx={{ mb: 2 }} />

            {/* Device & timestamps */}
            <Grid container spacing={2} sx={{ mb: 3 }}>
              <Grid size={{ xs: 6, sm: 3 }}>
                <Typography variant="caption" color="text.secondary">Device type</Typography>
                <Typography variant="body2">{detail.deviceType ?? '—'}</Typography>
              </Grid>
              <Grid size={{ xs: 6, sm: 3 }}>
                <Typography variant="caption" color="text.secondary">Player IP</Typography>
                <Typography variant="body2">{detail.playerIpAddress ?? '—'}</Typography>
              </Grid>
              <Grid size={{ xs: 6, sm: 3 }}>
                <Typography variant="caption" color="text.secondary">Submitted</Typography>
                <Typography variant="body2">
                  {format(parseISO(detail.createdAt), 'dd MMM yyyy, HH:mm')}
                </Typography>
              </Grid>
              <Grid size={{ xs: 6, sm: 3 }}>
                <Typography variant="caption" color="text.secondary">Reviewed</Typography>
                <Typography variant="body2">
                  {detail.adminReviewedAt
                    ? `${format(parseISO(detail.adminReviewedAt), 'dd MMM yyyy, HH:mm')} by ${detail.adminReviewedByName}`
                    : '—'}
                </Typography>
              </Grid>
            </Grid>

            <Divider sx={{ mb: 2 }} />

            {/* GPS Distance */}
            <Box sx={{ mb: 3 }}>
              <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
                <LocationOnIcon color="primary" fontSize="small" />
                <Typography variant="subtitle2">GPS Proximity Check</Typography>
              </Stack>

              {gpsDistance != null ? (
                <Alert severity={gpsDistance <= 500 ? 'success' : 'warning'} sx={{ mb: 1 }}>
                  Scan location is <strong>{Math.round(gpsDistance)}m</strong> from the registered screen location.
                  {gpsDistance <= 500 ? ' Within acceptable range (≤500m).' : ' Exceeds maximum range (500m) — investigate.'}
                </Alert>
              ) : (
                <Typography variant="body2" color="text.secondary">
                  GPS data not available for this verification.
                </Typography>
              )}

              {detail.scanGpsLatitude != null && detail.scanGpsLongitude != null && (
                <Stack direction="row" spacing={3}>
                  <Typography variant="caption" color="text.secondary">
                    Scan: {detail.scanGpsLatitude.toFixed(6)}, {detail.scanGpsLongitude.toFixed(6)}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Screen: {detail.screenLatitude.toFixed(6)}, {detail.screenLongitude.toFixed(6)}
                  </Typography>
                </Stack>
              )}
            </Box>

            <Divider sx={{ mb: 2 }} />

            {/* Video */}
            <Box sx={{ mb: 2 }}>
              <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
                <VideocamIcon color="primary" fontSize="small" />
                <Typography variant="subtitle2">Verification Video</Typography>
              </Stack>

              {detail.videoUrl ? (
                <Box
                  sx={{
                    width: '100%',
                    maxWidth: 560,
                    aspectRatio: '16/9',
                    bgcolor: 'background.default',
                    borderRadius: 2,
                    overflow: 'hidden',
                  }}
                >
                  <video
                    src={detail.videoUrl}
                    controls
                    style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                  />
                </Box>
              ) : (
                <Typography variant="body2" color="text.secondary">
                  No video uploaded for this verification.
                </Typography>
              )}
            </Box>

            {/* Rejection reason (if already rejected) */}
            {detail.rejectionReason && (
              <Alert severity="error" sx={{ mt: 2 }}>
                <strong>Rejection reason:</strong> {detail.rejectionReason}
              </Alert>
            )}

            {/* Reject form */}
            {showRejectForm && (
              <Box sx={{ mt: 2 }}>
                <TextField
                  fullWidth
                  multiline
                  rows={3}
                  label="Rejection reason"
                  placeholder="Explain why this verification is being rejected…"
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  sx={{ mb: 1 }}
                />
              </Box>
            )}
          </Box>
        )}
      </DialogContent>

      <DialogActions>
        {isPending && !showRejectForm && (
          <>
            <Button
              variant="contained"
              color="success"
              startIcon={approveMutation.isPending ? <CircularProgress size={18} /> : <VerifiedIcon />}
              onClick={handleApprove}
              disabled={approveMutation.isPending || rejectMutation.isPending}
            >
              Approve
            </Button>
            <Button
              variant="contained"
              color="error"
              startIcon={<CloseIcon />}
              onClick={() => setShowRejectForm(true)}
              disabled={approveMutation.isPending || rejectMutation.isPending}
            >
              Reject
            </Button>
          </>
        )}

        {showRejectForm && (
          <>
            <Button onClick={() => setShowRejectForm(false)} disabled={rejectMutation.isPending}>
              Cancel
            </Button>
            <Button
              variant="contained"
              color="error"
              onClick={handleReject}
              disabled={!rejectReason.trim() || rejectMutation.isPending}
              startIcon={rejectMutation.isPending ? <CircularProgress size={18} /> : undefined}
            >
              Confirm rejection
            </Button>
          </>
        )}

        {!isPending && (
          <Button onClick={handleClose}>Close</Button>
        )}
      </DialogActions>
    </Dialog>
  );
}
