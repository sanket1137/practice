import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Box,
  Typography,
  Paper,
  Button,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Alert,
  Skeleton,
  Chip,
} from '@mui/material';
import type { SelectChangeEvent } from '@mui/material/Select';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import axios from 'axios';

// ── Types ────────────────────────────────────────────────────────────────────

type LedZoneContentType = 'Playlist' | 'RssTicker' | 'StaticText' | 'Clock';

interface LedZoneDto {
  id: string;
  screenId: string;
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  contentType: LedZoneContentType;
  contentConfig: string;
  isActive: boolean;
  displayOrder: number;
}

interface UpsertLedZoneRequest {
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  contentType: LedZoneContentType;
  contentConfig: string;
  isActive: boolean;
  displayOrder: number;
}

// ── API hooks ────────────────────────────────────────────────────────────────

function useLedZones(screenId: string) {
  return useQuery<LedZoneDto[]>({
    queryKey: ['led-zones', screenId],
    queryFn: () => axios.get(`/api/v1/led/screens/${screenId}/zones`).then((r) => r.data),
    staleTime: 0,
  });
}

function useUpsertLedZone(screenId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ zoneId, data }: { zoneId?: string; data: UpsertLedZoneRequest }) =>
      zoneId
        ? axios.put(`/api/v1/led/screens/${screenId}/zones/${zoneId}`, data)
        : axios.post(`/api/v1/led/screens/${screenId}/zones`, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['led-zones', screenId] }),
  });
}

function useDeleteLedZone(screenId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (zoneId: string) =>
      axios.delete(`/api/v1/led/screens/${screenId}/zones/${zoneId}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['led-zones', screenId] }),
  });
}

// ── Zone dialog ───────────────────────────────────────────────────────────────

const DEFAULT_ZONE: UpsertLedZoneRequest = {
  name: '',
  x: 0,
  y: 0,
  width: 100,
  height: 50,
  contentType: 'StaticText',
  contentConfig: '',
  isActive: true,
  displayOrder: 0,
};

interface ZoneDialogProps {
  open: boolean;
  zone: LedZoneDto | null;
  onClose: () => void;
  onSave: (zoneId: string | undefined, data: UpsertLedZoneRequest) => void;
  isPending: boolean;
}

function ZoneDialog({ open, zone, onClose, onSave, isPending }: ZoneDialogProps) {
  const [form, setForm] = useState<UpsertLedZoneRequest>(DEFAULT_ZONE);

  React.useEffect(() => {
    if (zone) {
      setForm({
        name: zone.name,
        x: zone.x,
        y: zone.y,
        width: zone.width,
        height: zone.height,
        contentType: zone.contentType,
        contentConfig: zone.contentConfig,
        isActive: zone.isActive,
        displayOrder: zone.displayOrder,
      });
    } else {
      setForm(DEFAULT_ZONE);
    }
  }, [zone, open]);

  const numField = (field: keyof UpsertLedZoneRequest) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm((prev) => ({ ...prev, [field]: Number(e.target.value) }));
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{zone ? 'Edit LED Zone' : 'Add LED Zone'}</DialogTitle>
      <DialogContent>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
          <TextField
            label="Zone Name"
            value={form.name}
            onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
            size="small"
            fullWidth
            required
          />

          <FormControl fullWidth size="small">
            <InputLabel>Content Type</InputLabel>
            <Select
              value={form.contentType}
              label="Content Type"
              onChange={(e: SelectChangeEvent<LedZoneContentType>) =>
                setForm((prev) => ({ ...prev, contentType: e.target.value as LedZoneContentType }))
              }
            >
              <MenuItem value="Playlist">Playlist</MenuItem>
              <MenuItem value="RssTicker">RSS Ticker</MenuItem>
              <MenuItem value="StaticText">Static Text</MenuItem>
              <MenuItem value="Clock">Clock</MenuItem>
            </Select>
          </FormControl>

          <TextField
            label="Content Config (JSON or text)"
            value={form.contentConfig}
            onChange={(e) => setForm((prev) => ({ ...prev, contentConfig: e.target.value }))}
            size="small"
            fullWidth
            multiline
            rows={2}
          />

          <Box sx={{ display: 'flex', gap: 2 }}>
            <TextField label="X" type="number" value={form.x} onChange={numField('x')} size="small" sx={{ flex: 1 }} />
            <TextField label="Y" type="number" value={form.y} onChange={numField('y')} size="small" sx={{ flex: 1 }} />
          </Box>
          <Box sx={{ display: 'flex', gap: 2 }}>
            <TextField label="Width" type="number" value={form.width} onChange={numField('width')} size="small" sx={{ flex: 1 }} />
            <TextField label="Height" type="number" value={form.height} onChange={numField('height')} size="small" sx={{ flex: 1 }} />
          </Box>
          <TextField
            label="Display Order"
            type="number"
            value={form.displayOrder}
            onChange={numField('displayOrder')}
            size="small"
            sx={{ width: 160 }}
          />
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button
          variant="contained"
          onClick={() => onSave(zone?.id, form)}
          disabled={isPending || !form.name.trim()}
        >
          {isPending ? 'Saving...' : 'Save Zone'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function LedZoneConfigPage() {
  const { screenId } = useParams<{ screenId: string }>();
  const navigate = useNavigate();
  const { data: zones, isLoading, error } = useLedZones(screenId!);
  const { mutate: upsert, isPending: upsertPending } = useUpsertLedZone(screenId!);
  const { mutate: deleteZone } = useDeleteLedZone(screenId!);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingZone, setEditingZone] = useState<LedZoneDto | null>(null);

  const handleSave = (zoneId: string | undefined, data: UpsertLedZoneRequest) => {
    upsert(
      { zoneId, data },
      { onSuccess: () => setDialogOpen(false) },
    );
  };

  if (isLoading) {
    return (
      <Box sx={{ p: 3 }}>
        <Skeleton variant="rectangular" height={40} sx={{ mb: 2 }} />
        <Skeleton variant="rectangular" height={200} />
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error">Failed to load LED zones.</Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
        <Button
          startIcon={<ArrowBackIcon />}
          onClick={() => navigate(-1)}
          variant="outlined"
          size="small"
        >
          Back
        </Button>
        <Typography variant="h5" sx={{ flexGrow: 1 }}>
          LED Zone Configuration
        </Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => {
            setEditingZone(null);
            setDialogOpen(true);
          }}
        >
          Add Zone
        </Button>
      </Box>

      <Paper sx={{ p: 2 }}>
        {(!zones || zones.length === 0) ? (
          <Typography sx={{ color: 'text.secondary', textAlign: 'center', py: 4 }}>
            No LED zones configured yet. Add your first zone.
          </Typography>
        ) : (
          <List disablePadding>
            {zones.map((zone) => (
              <ListItem
                key={zone.id}
                divider
                sx={{ '&:hover': { bgcolor: 'rgba(255,255,255,0.04)' } }}
              >
                <ListItemText
                  primary={
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      {zone.name}
                      <Chip
                        label={zone.contentType}
                        size="small"
                        color={zone.isActive ? 'success' : 'default'}
                      />
                    </Box>
                  }
                  secondary={`Position: (${zone.x}, ${zone.y})  Size: ${zone.width}×${zone.height}  Order: ${zone.displayOrder}`}
                />
                <ListItemSecondaryAction>
                  <IconButton
                    edge="end"
                    size="small"
                    onClick={() => {
                      setEditingZone(zone);
                      setDialogOpen(true);
                    }}
                  >
                    <EditIcon fontSize="small" />
                  </IconButton>
                  <IconButton
                    edge="end"
                    size="small"
                    sx={{ ml: 1, color: 'error.main' }}
                    onClick={() => deleteZone(zone.id)}
                  >
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                </ListItemSecondaryAction>
              </ListItem>
            ))}
          </List>
        )}
      </Paper>

      <ZoneDialog
        open={dialogOpen}
        zone={editingZone}
        onClose={() => setDialogOpen(false)}
        onSave={handleSave}
        isPending={upsertPending}
      />
    </Box>
  );
}
