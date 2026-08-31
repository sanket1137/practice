import { useState } from 'react';
import {
  Box,
  Chip,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  LinearProgress,
  Typography,
  IconButton,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import StarIcon from '@mui/icons-material/Star';
import { useQuery } from '@tanstack/react-query';
import api from '../../services/api';

export interface AqsBadgeProps {
  score: number;
  screenId?: string;
  size?: 'small' | 'medium';
}

interface AqsDetails {
  screenId: string;
  score: number;
  components: {
    footfall: number | null;
    uptime: number;
    fillRate: number;
    review: number | null;
  };
  calculatedAt: string | null;
}

function getAqsColor(score: number): 'success' | 'warning' | 'error' {
  if (score >= 70) return 'success';
  if (score >= 40) return 'warning';
  return 'error';
}

function AqsBreakdownModal({ open, onClose, screenId }: { open: boolean; onClose: () => void; screenId?: string }) {
  const { data, isLoading } = useQuery<{ data: AqsDetails }>({
    queryKey: ['aqs-details', screenId],
    queryFn: () => api.get(`/screens/${screenId}/aqs-details`).then(r => r.data),
    enabled: open && !!screenId,
    staleTime: 5 * 60 * 1000,
  });

  const details = data?.data;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <StarIcon sx={{ color: 'primary.main' }} />
          <Typography variant="h6">Audience Quality Score</Typography>
        </Box>
        <IconButton onClick={onClose} size="small">
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          AQS measures footfall density, screen uptime, and booking fill rate. Updated nightly.
        </Typography>
        {isLoading && <LinearProgress />}
        {details && (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <ScoreBar label="Overall Score" value={details.score} />
            <ScoreBar label="Footfall" value={details.components.footfall ?? 0} />
            <ScoreBar label="Uptime" value={details.components.uptime} />
            <ScoreBar label="Fill Rate" value={details.components.fillRate} />
            {details.components.review != null && (
              <ScoreBar label="Avg. Review" value={details.components.review} />
            )}
          </Box>
        )}
      </DialogContent>
    </Dialog>
  );
}

function ScoreBar({ label, value }: { label: string; value: number }) {
  const color = value >= 70 ? 'success' : value >= 40 ? 'warning' : 'error';
  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
        <Typography variant="body2">{label}</Typography>
        <Typography variant="body2" fontWeight={600}>{Math.round(value)}</Typography>
      </Box>
      <LinearProgress
        variant="determinate"
        value={Math.min(value, 100)}
        color={color}
        sx={{ borderRadius: 1, height: 6 }}
      />
    </Box>
  );
}

export function AqsBadge({ score, screenId, size = 'medium' }: AqsBadgeProps) {
  const [modalOpen, setModalOpen] = useState(false);
  const color = getAqsColor(score);
  const rounded = Math.round(score);

  return (
    <>
      <Tooltip
        title="Audience Quality Score — measures footfall, uptime, and fill rate. Click for details."
        arrow
      >
        <Chip
          icon={<StarIcon fontSize="small" />}
          label={`AQS ${rounded}`}
          color={color}
          size={size}
          onClick={screenId ? () => setModalOpen(true) : undefined}
          sx={{ cursor: screenId ? 'pointer' : 'default', fontWeight: 600 }}
        />
      </Tooltip>
      {screenId && (
        <AqsBreakdownModal open={modalOpen} onClose={() => setModalOpen(false)} screenId={screenId} />
      )}
    </>
  );
}
