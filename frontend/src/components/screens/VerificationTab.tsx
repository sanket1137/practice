import { useState, useCallback } from 'react';

import {
  Box,
  Typography,
  Card,
  CardContent,
  Chip,
  Stack,
  Button,
  Alert,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Skeleton,
} from '@mui/material';
import QrCodeScannerIcon from '@mui/icons-material/QrCodeScanner';
import VerifiedIcon from '@mui/icons-material/Verified';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import HourglassEmptyIcon from '@mui/icons-material/HourglassEmpty';
import HistoryIcon from '@mui/icons-material/History';
import { format, parseISO } from 'date-fns';

import { useVerificationStatus, useVerificationHistory, useScanQr, useUploadVerificationVideo } from '../../hooks/useScreenVerification';
import type { ScreenVerificationStatus } from '../../types/verification';
import QrScannerDialog from '../verification/QrScannerDialog';
import VideoRecorder from '../verification/VideoRecorder';
import UploadProgress from '../verification/UploadProgress';

interface VerificationTabProps {
  screenId: string;
}

const STATUS_CONFIG: Record<ScreenVerificationStatus, { label: string; color: 'success' | 'warning' | 'error' | 'info' | 'default'; icon: React.ReactNode }> = {
  Unverified: { label: 'Unverified', color: 'warning', icon: <ErrorOutlineIcon /> },
  QrDisplayed: { label: 'QR Displayed', color: 'info', icon: <QrCodeScannerIcon /> },
  PendingReview: { label: 'Pending Review', color: 'warning', icon: <HourglassEmptyIcon /> },
  Verified: { label: 'Verified', color: 'success', icon: <VerifiedIcon /> },
  Rejected: { label: 'Rejected', color: 'error', icon: <ErrorOutlineIcon /> },
  ReVerificationRequired: { label: 'Re-verification Required', color: 'warning', icon: <ErrorOutlineIcon /> },
};

export default function VerificationTab({ screenId }: VerificationTabProps) {
  const { data: status, isLoading: statusLoading } = useVerificationStatus(screenId);
  const { data: history, isLoading: historyLoading } = useVerificationHistory(screenId);
  const scanQrMutation = useScanQr(screenId);
  const uploadMutation = useUploadVerificationVideo(screenId);

  const [scannerOpen, setScannerOpen] = useState(false);
  const [verificationId, setVerificationId] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploading, setUploading] = useState(false);

  const currentStatus = status?.status ?? 'Unverified';
  const config = STATUS_CONFIG[currentStatus as ScreenVerificationStatus] ?? STATUS_CONFIG.Unverified;
  const needsVerification = currentStatus === 'Unverified' || currentStatus === 'QrDisplayed' || currentStatus === 'Rejected' || currentStatus === 'ReVerificationRequired';

  const handleQrScanned = useCallback(
    async (qrContent: string) => {
      setScannerOpen(false);

      // QR encodes: {baseUrl}/verify/{screenId}?code={code}
      let challengeCode: string;
      try {
        const url = new URL(qrContent);
        challengeCode = url.searchParams.get('code') ?? '';
      } catch {
        challengeCode = qrContent;
      }

      if (!challengeCode) return;

      // Get GPS position
      const position = await new Promise<GeolocationPosition>((resolve, reject) =>
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 15000,
        })
      ).catch(() => null);

      if (!position) return;

      const result = await scanQrMutation.mutateAsync({
        challengeCode,
        gpsLatitude: position.coords.latitude,
        gpsLongitude: position.coords.longitude,
      });

      setVerificationId(result.verificationId);
    },
    [scanQrMutation]
  );

  const handleVideoComplete = useCallback(
    async (file: File) => {
      if (!verificationId) return;
      setUploading(true);
      setUploadProgress(0);
      try {
        await uploadMutation.mutateAsync({
          verificationId,
          file,
          onUploadProgress: setUploadProgress,
        });
      } finally {
        setUploading(false);
      }
    },
    [verificationId, uploadMutation]
  );

  if (statusLoading) {
    return (
      <Box>
        <Skeleton variant="rounded" height={120} sx={{ mb: 2 }} />
        <Skeleton variant="rounded" height={200} />
      </Box>
    );
  }

  return (
    <Box>
      {/* Current Status */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Stack direction="row" alignItems="center" justifyContent="space-between">
            <Box>
              <Typography variant="h6" gutterBottom>
                Verification Status
              </Typography>
              <Chip
                icon={config.icon as React.ReactElement}
                label={config.label}
                color={config.color}
                sx={{ fontWeight: 600 }}
              />
            </Box>

            {needsVerification && (
              <Button
                variant="contained"
                startIcon={<QrCodeScannerIcon />}
                onClick={() => setScannerOpen(true)}
                disabled={scanQrMutation.isPending}
              >
                Scan QR code
              </Button>
            )}
          </Stack>

          {currentStatus === 'PendingReview' && (
            <Alert severity="info" sx={{ mt: 2 }}>
              Your verification is under admin review. You&apos;ll be notified once it&apos;s approved.
            </Alert>
          )}

          {currentStatus === 'Rejected' && (
            <Alert severity="error" sx={{ mt: 2 }}>
              Your previous verification was rejected. Please scan the QR code again and submit a new video.
            </Alert>
          )}

          {currentStatus === 'Verified' && (
            <Alert severity="success" sx={{ mt: 2 }}>
              This screen has been verified and is approved for ad playback.
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Video Recording Step — shown after successful QR scan */}
      {verificationId && !uploading && currentStatus !== 'PendingReview' && currentStatus !== 'Verified' && (
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Step 2: Record verification video
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Record a short video showing the physical screen with the QR code displayed on it.
            </Typography>
            <VideoRecorder
              onRecordingComplete={handleVideoComplete}
              disabled={uploadMutation.isPending}
            />
          </CardContent>
        </Card>
      )}

      {/* Upload progress */}
      {uploading && (
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <UploadProgress progress={uploadProgress} uploading={uploading} />
          </CardContent>
        </Card>
      )}

      {/* Verification History */}
      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <HistoryIcon /> Verification History
          </Typography>

          {historyLoading ? (
            <Skeleton variant="rounded" height={120} />
          ) : !history?.length ? (
            <Typography variant="body2" color="text.secondary">
              No verification attempts yet.
            </Typography>
          ) : (
            <TableContainer>
              <Table size="small" stickyHeader>
                <TableHead>
                  <TableRow>
                    <TableCell>Date</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell>Device</TableCell>
                    <TableCell>Reviewed</TableCell>
                    <TableCell>Reason</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {history.map((item) => {
                    const itemConfig = STATUS_CONFIG[item.status as ScreenVerificationStatus];
                    return (
                      <TableRow key={item.id} sx={{ '&:hover': { bgcolor: 'rgba(255,255,255,0.04)' } }}>
                        <TableCell>{format(parseISO(item.createdAt), 'dd MMM yyyy, HH:mm')}</TableCell>
                        <TableCell>
                          <Chip label={itemConfig?.label ?? item.status} color={itemConfig?.color ?? 'default'} size="small" />
                        </TableCell>
                        <TableCell>{item.deviceType ?? '—'}</TableCell>
                        <TableCell>
                          {item.adminReviewedAt
                            ? format(parseISO(item.adminReviewedAt), 'dd MMM yyyy')
                            : '—'}
                        </TableCell>
                        <TableCell>{item.rejectionReason ?? '—'}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </CardContent>
      </Card>

      {/* QR Scanner Dialog */}
      <QrScannerDialog
        open={scannerOpen}
        onClose={() => setScannerOpen(false)}
        onScan={handleQrScanned}
      />
    </Box>
  );
}
