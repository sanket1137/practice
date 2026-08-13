import React, { useState, useRef, useCallback, useEffect } from 'react';

import {
  Box,
  Button,
  Typography,
  Alert,
  Stack,
  CircularProgress,
  IconButton,
} from '@mui/material';
import VideocamIcon from '@mui/icons-material/Videocam';
import StopIcon from '@mui/icons-material/Stop';
import ReplayIcon from '@mui/icons-material/Replay';
import FileUploadIcon from '@mui/icons-material/FileUpload';

const MIN_DURATION_SEC = 10;
const MAX_DURATION_SEC = 60;
const MAX_FILE_SIZE_MB = 100;

interface VideoRecorderProps {
  onRecordingComplete: (file: File) => void;
  disabled?: boolean;
}

export default function VideoRecorder({ onRecordingComplete, disabled }: VideoRecorderProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval>>(undefined);

  const [stream, setStream] = useState<MediaStream | null>(null);
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [preview, setPreview] = useState<string | null>(null);
  const [recordedFile, setRecordedFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [initializing, setInitializing] = useState(false);

  const cleanup = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (stream) {
      stream.getTracks().forEach((t) => t.stop());
      setStream(null);
    }
    if (preview) URL.revokeObjectURL(preview);
  }, [stream, preview]);

  useEffect(() => {
    return cleanup;
  }, [cleanup]);

  const startCamera = useCallback(async () => {
    setError(null);
    setInitializing(true);
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
    } catch {
      setError('Camera access denied. Please allow camera permissions or upload a video file instead.');
    } finally {
      setInitializing(false);
    }
  }, []);

  const startRecording = useCallback(() => {
    if (!stream) return;
    setError(null);
    chunksRef.current = [];
    setElapsed(0);
    setPreview(null);
    setRecordedFile(null);

    const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
      ? 'video/webm;codecs=vp9'
      : 'video/webm';

    const recorder = new MediaRecorder(stream, { mimeType });
    mediaRecorderRef.current = recorder;

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };

    recorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: mimeType });
      const file = new File([blob], `verification-${Date.now()}.webm`, { type: mimeType });
      const url = URL.createObjectURL(blob);
      setPreview(url);
      setRecordedFile(file);
      setRecording(false);
    };

    recorder.start(1000);
    setRecording(true);

    timerRef.current = setInterval(() => {
      setElapsed((prev) => {
        const next = prev + 1;
        if (next >= MAX_DURATION_SEC) {
          recorder.stop();
          if (timerRef.current) clearInterval(timerRef.current);
        }
        return next;
      });
    }, 1000);
  }, [stream]);

  const stopRecording = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
  }, []);

  const retake = useCallback(() => {
    if (preview) URL.revokeObjectURL(preview);
    setPreview(null);
    setRecordedFile(null);
    setElapsed(0);
  }, [preview]);

  const handleFileUpload = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      const validTypes = ['video/mp4', 'video/webm', 'video/quicktime'];
      if (!validTypes.includes(file.type)) {
        setError('Please upload an MP4, WebM, or MOV video file.');
        return;
      }
      if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
        setError(`Video must be under ${MAX_FILE_SIZE_MB}MB.`);
        return;
      }

      setError(null);
      const url = URL.createObjectURL(file);
      setPreview(url);
      setRecordedFile(file);
    },
    []
  );

  const handleConfirm = useCallback(() => {
    if (recordedFile) onRecordingComplete(recordedFile);
  }, [recordedFile, onRecordingComplete]);

  const formatTime = (sec: number) =>
    `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;

  const tooShort = recording && elapsed < MIN_DURATION_SEC;

  return (
    <Box>
      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {/* Camera preview / recorded preview */}
      <Box
        sx={{
          position: 'relative',
          width: '100%',
          maxWidth: 480,
          mx: 'auto',
          aspectRatio: '16/9',
          bgcolor: 'background.default',
          borderRadius: 2,
          overflow: 'hidden',
          mb: 2,
        }}
      >
        {preview ? (
          <video
            src={preview}
            controls
            style={{ width: '100%', height: '100%', objectFit: 'contain' }}
          />
        ) : (
          <video
            ref={videoRef}
            autoPlay
            muted
            playsInline
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
        )}

        {recording && (
          <Box
            sx={{
              position: 'absolute',
              top: 8,
              right: 8,
              bgcolor: 'error.main',
              color: 'white',
              px: 1.5,
              py: 0.5,
              borderRadius: 1,
              display: 'flex',
              alignItems: 'center',
              gap: 0.5,
              fontSize: '0.85rem',
              fontWeight: 600,
            }}
          >
            <Box
              sx={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                bgcolor: 'white',
                animation: 'pulse 1s infinite',
                '@keyframes pulse': {
                  '0%, 100%': { opacity: 1 },
                  '50%': { opacity: 0.3 },
                },
              }}
            />
            {formatTime(elapsed)}
          </Box>
        )}
      </Box>

      {/* Controls */}
      <Stack spacing={1.5} alignItems="center">
        {!stream && !preview && (
          <>
            <Button
              variant="contained"
              startIcon={initializing ? <CircularProgress size={18} /> : <VideocamIcon />}
              onClick={startCamera}
              disabled={disabled || initializing}
            >
              Open camera
            </Button>
            <Typography variant="caption" color="text.secondary">
              or
            </Typography>
            <Button variant="outlined" startIcon={<FileUploadIcon />} component="label" disabled={disabled}>
              Upload video file
              <input
                type="file"
                accept="video/mp4,video/webm,video/quicktime"
                hidden
                onChange={handleFileUpload}
              />
            </Button>
          </>
        )}

        {stream && !recording && !preview && (
          <Button variant="contained" color="error" startIcon={<VideocamIcon />} onClick={startRecording}>
            Start recording
          </Button>
        )}

        {recording && (
          <Stack direction="row" spacing={1} alignItems="center">
            <IconButton color="error" onClick={stopRecording} disabled={tooShort}>
              <StopIcon />
            </IconButton>
            {tooShort && (
              <Typography variant="caption" color="text.secondary">
                Min {MIN_DURATION_SEC}s — {MIN_DURATION_SEC - elapsed}s remaining
              </Typography>
            )}
          </Stack>
        )}

        {preview && (
          <Stack direction="row" spacing={1}>
            <Button variant="outlined" startIcon={<ReplayIcon />} onClick={retake} disabled={disabled}>
              Retake
            </Button>
            <Button variant="contained" onClick={handleConfirm} disabled={disabled}>
              Use this video
            </Button>
          </Stack>
        )}
      </Stack>

      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', textAlign: 'center', mt: 1 }}>
        Record a {MIN_DURATION_SEC}–{MAX_DURATION_SEC}s video of the physical screen showing the QR code. Max {MAX_FILE_SIZE_MB}MB.
      </Typography>
    </Box>
  );
}
