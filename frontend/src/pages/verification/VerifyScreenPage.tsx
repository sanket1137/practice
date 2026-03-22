import { useState, useEffect, useCallback } from 'react';

import {
  Box,
  Container,
  Typography,
  Card,
  CardContent,
  Button,
  Alert,
  CircularProgress,
  Stack,
  Stepper,
  Step,
  StepLabel,
} from '@mui/material';
import QrCodeScannerIcon from '@mui/icons-material/QrCodeScanner';
import VideocamIcon from '@mui/icons-material/Videocam';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import LoginIcon from '@mui/icons-material/Login';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';

import { useAuthStore } from '../../store/authStore';
import { useScanQr, useUploadVerificationVideo } from '../../hooks/useScreenVerification';
import VideoRecorder from '../../components/verification/VideoRecorder';
import UploadProgress from '../../components/verification/UploadProgress';

const STEPS = ['Scan QR', 'Record video', 'Admin review'];

type VerifyStep = 'authenticating' | 'scanning' | 'recording' | 'uploading' | 'submitted';

export default function VerifyScreenPage() {
  const { screenId } = useParams<{ screenId: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuthStore();

  const challengeCode = searchParams.get('code') ?? '';

  const scanQrMutation = useScanQr(screenId ?? '');
  const uploadMutation = useUploadVerificationVideo(screenId ?? '');

  const [step, setStep] = useState<VerifyStep>('authenticating');
  const [verificationId, setVerificationId] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [gpsError, setGpsError] = useState<string | null>(null);

  // Check auth
  useEffect(() => {
    if (!user) {
      setStep('authenticating');
    } else if (step === 'authenticating') {
      setStep('scanning');
    }
  }, [user, step]);

  // Auto-submit QR scan when authenticated and code is present
  const submitQrScan = useCallback(async () => {
    if (!screenId || !challengeCode || !user) return;

    setError(null);
    setGpsError(null);

    // Get GPS
    let position: GeolocationPosition;
    try {
      position = await new Promise<GeolocationPosition>((resolve, reject) =>
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 15000,
        })
      );
    } catch {
      setGpsError('Could not get your location. Please enable GPS and try again.');
      return;
    }

    try {
      const result = await scanQrMutation.mutateAsync({
        challengeCode,
        gpsLatitude: position.coords.latitude,
        gpsLongitude: position.coords.longitude,
      });
      setVerificationId(result.verificationId);
      setStep('recording');
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        'QR verification failed. The code may have expired — check the screen for a new QR.';
      setError(message);
    }
  }, [screenId, challengeCode, user, scanQrMutation]);

  // Trigger scan when step becomes 'scanning'
  useEffect(() => {
    if (step === 'scanning' && challengeCode && user && !scanQrMutation.isPending && !verificationId) {
      submitQrScan();
    }
  }, [step, challengeCode, user, scanQrMutation.isPending, verificationId, submitQrScan]);

  const handleVideoComplete = useCallback(
    async (file: File) => {
      if (!verificationId) return;
      setStep('uploading');
      setUploadProgress(0);
      try {
        await uploadMutation.mutateAsync({
          verificationId,
          file,
          onUploadProgress: setUploadProgress,
        });
        setStep('submitted');
      } catch {
        setStep('recording');
      }
    },
    [verificationId, uploadMutation]
  );

  const activeStepIndex = step === 'scanning' || step === 'authenticating' ? 0 : step === 'recording' ? 1 : 2;

  const loginUrl = `/login?returnUrl=${encodeURIComponent(`/verify/${screenId}?code=${challengeCode}`)}`;

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default', py: 4 }}>
      <Container maxWidth="sm">
        <Box sx={{ textAlign: 'center', mb: 3 }}>
          <QrCodeScannerIcon sx={{ fontSize: 48, color: 'primary.main', mb: 1 }} />
          <Typography variant="h5" fontWeight={700}>
            Screen Verification
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Verify your physical screen for ad playback
          </Typography>
        </Box>

        <Stepper activeStep={activeStepIndex} alternativeLabel sx={{ mb: 3 }}>
          {STEPS.map((label) => (
            <Step key={label}>
              <StepLabel>{label}</StepLabel>
            </Step>
          ))}
        </Stepper>

        <Card>
          <CardContent sx={{ p: 3 }}>
            {/* Not authenticated */}
            {step === 'authenticating' && !user && (
              <Stack spacing={2} alignItems="center" sx={{ py: 3 }}>
                <LoginIcon sx={{ fontSize: 48, color: 'text.secondary' }} />
                <Typography variant="h6">Login required</Typography>
                <Typography variant="body2" color="text.secondary" textAlign="center">
                  You need to log in as the screen owner to complete verification.
                </Typography>
                <Button
                  variant="contained"
                  startIcon={<LoginIcon />}
                  onClick={() => navigate(loginUrl)}
                >
                  Log in to continue
                </Button>
              </Stack>
            )}

            {/* QR Scanning in progress */}
            {step === 'scanning' && !error && !gpsError && (
              <Stack spacing={2} alignItems="center" sx={{ py: 3 }}>
                <CircularProgress size={40} />
                <Typography variant="body1">Verifying QR code and location…</Typography>
                <Typography variant="body2" color="text.secondary">
                  Please allow location access when prompted
                </Typography>
              </Stack>
            )}

            {/* GPS error */}
            {gpsError && (
              <Stack spacing={2} alignItems="center" sx={{ py: 2 }}>
                <Alert severity="error">{gpsError}</Alert>
                <Button variant="contained" onClick={submitQrScan}>
                  Retry
                </Button>
              </Stack>
            )}

            {/* Scan error */}
            {error && (
              <Stack spacing={2} alignItems="center" sx={{ py: 2 }}>
                <Alert severity="error">{error}</Alert>
                <Button variant="contained" onClick={submitQrScan}>
                  Retry scan
                </Button>
              </Stack>
            )}

            {/* Video recording step */}
            {step === 'recording' && (
              <Box>
                <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 2 }}>
                  <VideocamIcon color="primary" />
                  <Typography variant="h6">Record verification video</Typography>
                </Stack>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  Record a short video of the physical screen showing the QR code to prove the screen exists at the registered location.
                </Typography>
                <VideoRecorder
                  onRecordingComplete={handleVideoComplete}
                  disabled={uploadMutation.isPending}
                />
              </Box>
            )}

            {/* Uploading */}
            {step === 'uploading' && (
              <UploadProgress progress={uploadProgress} uploading />
            )}

            {/* Submitted */}
            {step === 'submitted' && (
              <Stack spacing={2} alignItems="center" sx={{ py: 3 }}>
                <CheckCircleIcon sx={{ fontSize: 64, color: 'success.main' }} />
                <Typography variant="h6">Verification submitted!</Typography>
                <Typography variant="body2" color="text.secondary" textAlign="center">
                  Your verification is now pending admin review. You&apos;ll be notified once it&apos;s approved.
                </Typography>
                <Button variant="contained" onClick={() => navigate(`/screens/${screenId}`)}>
                  View screen details
                </Button>
              </Stack>
            )}
          </CardContent>
        </Card>
      </Container>
    </Box>
  );
}
