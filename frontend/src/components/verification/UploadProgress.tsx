import { Box, LinearProgress, Typography, Stack } from '@mui/material';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';

interface UploadProgressProps {
  progress: number;
  uploading: boolean;
}

export default function UploadProgress({ progress, uploading }: UploadProgressProps) {
  const done = progress >= 100;

  return (
    <Box sx={{ textAlign: 'center', py: 3 }}>
      <Stack spacing={2} alignItems="center">
        {done ? (
          <CheckCircleIcon sx={{ fontSize: 48, color: 'success.main' }} />
        ) : (
          <CloudUploadIcon sx={{ fontSize: 48, color: 'primary.main' }} />
        )}

        <Typography variant="body1" fontWeight={600}>
          {done ? 'Upload complete' : uploading ? 'Uploading video…' : 'Preparing upload…'}
        </Typography>

        <Box sx={{ width: '100%', maxWidth: 360 }}>
          <LinearProgress
            variant="determinate"
            value={progress}
            sx={{ height: 8, borderRadius: 4 }}
          />
        </Box>

        <Typography variant="body2" color="text.secondary">
          {progress}%
        </Typography>
      </Stack>
    </Box>
  );
}
