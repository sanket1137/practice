import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Box,
  Typography,
  Paper,
  Grid,
  Button,
  Slider,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Chip,
  Alert,
  Skeleton,
  Tooltip,
} from '@mui/material';
import type { SelectChangeEvent } from '@mui/material/Select';
import SaveIcon from '@mui/icons-material/Save';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import api from '../../services/api';

// ── Types ────────────────────────────────────────────────────────────────────

interface MosaicAssignment {
  row: number;
  col: number;
  screenId: string;
  screenName: string;
}

interface MosaicConfig {
  groupId: string;
  groupName: string;
  rows: number;
  cols: number;
  bezelHorizontalMm: number;
  bezelVerticalMm: number;
  contentMode: 'Individual' | 'Mosaic';
  masterVideoR2Key: string | null;
  assignments: MosaicAssignment[];
  availableScreens: Array<{ id: string; name: string }>;
}

interface SaveMosaicConfigRequest {
  rows: number;
  cols: number;
  bezelHorizontalMm: number;
  bezelVerticalMm: number;
  contentMode: 'Individual' | 'Mosaic';
  masterVideoR2Key: string | null;
  assignments: Array<{ row: number; col: number; screenId: string }>;
}

// ── API ───────────────────────────────────────────────────────────────────────

function useMosaicConfig(groupId: string) {
  return useQuery<MosaicConfig>({
    queryKey: ['mosaic-config', groupId],
    queryFn: () =>
      api.get(`/cms/screen-groups/${groupId}/mosaic`).then((r) => r.data),
    staleTime: 0,
  });
}

function useSaveMosaicConfig(groupId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: SaveMosaicConfigRequest) =>
      api.put(`/cms/screen-groups/${groupId}/mosaic`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mosaic-config', groupId] });
    },
  });
}

// ── Component ─────────────────────────────────────────────────────────────────

const CELL_SIZE = 120;
const CELL_GAP = 4;

export default function CmsMosaicEditorPage() {
  const { groupId } = useParams<{ groupId: string }>();
  const navigate = useNavigate();
  const { data, isLoading, error } = useMosaicConfig(groupId!);
  const { mutate: save, isPending } = useSaveMosaicConfig(groupId!);

  const [assignments, setAssignments] = useState<Map<string, string>>(new Map());
  const [bezelH, setBezelH] = useState(2);
  const [bezelV, setBezelV] = useState(2);
  const [contentMode, setContentMode] = useState<'Individual' | 'Mosaic'>('Individual');
  const [rows, setRows] = useState(2);
  const [cols, setCols] = useState(2);
  const [initialized, setInitialized] = useState(false);

  React.useEffect(() => {
    if (data && !initialized) {
      setRows(data.rows);
      setCols(data.cols);
      setBezelH(data.bezelHorizontalMm);
      setBezelV(data.bezelVerticalMm);
      setContentMode(data.contentMode);
      const map = new Map<string, string>();
      data.assignments.forEach((a) => {
        map.set(`${a.row}_${a.col}`, a.screenId);
      });
      setAssignments(map);
      setInitialized(true);
    }
  }, [data, initialized]);

  const cellKey = (r: number, c: number) => `${r}_${c}`;

  const handleCellAssign = (row: number, col: number, screenId: string) => {
    setAssignments((prev) => {
      const next = new Map(prev);
      if (screenId === '') {
        next.delete(cellKey(row, col));
      } else {
        next.set(cellKey(row, col), screenId);
      }
      return next;
    });
  };

  const handleSave = () => {
    const assignArray: Array<{ row: number; col: number; screenId: string }> = [];
    assignments.forEach((screenId, key) => {
      const [r, c] = key.split('_').map(Number);
      assignArray.push({ row: r, col: c, screenId });
    });
    save({
      rows,
      cols,
      bezelHorizontalMm: bezelH,
      bezelVerticalMm: bezelV,
      contentMode,
      masterVideoR2Key: null,
      assignments: assignArray,
    });
  };

  if (isLoading) {
    return (
      <Box sx={{ p: 3 }}>
        <Skeleton variant="rectangular" height={40} sx={{ mb: 2 }} />
        <Skeleton variant="rectangular" height={300} />
      </Box>
    );
  }

  if (error || !data) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error">Failed to load mosaic configuration.</Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
        <Button
          startIcon={<ArrowBackIcon />}
          onClick={() => navigate('/cms/groups')}
          variant="outlined"
          size="small"
        >
          Back
        </Button>
        <Typography variant="h5" sx={{ flexGrow: 1 }}>
          Mosaic Editor — {data.groupName}
        </Typography>
        <Button
          variant="contained"
          startIcon={<SaveIcon />}
          onClick={handleSave}
          disabled={isPending}
        >
          {isPending ? 'Saving...' : 'Save Layout'}
        </Button>
      </Box>

      <Grid container spacing={3}>
        {/* Configuration panel */}
        <Grid size={{ xs: 12, md: 4 }}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="subtitle1" sx={{ mb: 2, fontWeight: 600 }}>
              Grid Configuration
            </Typography>

            <FormControl fullWidth sx={{ mb: 2 }}>
              <InputLabel>Content Mode</InputLabel>
              <Select
                value={contentMode}
                label="Content Mode"
                onChange={(e: SelectChangeEvent<'Individual' | 'Mosaic'>) =>
                  setContentMode(e.target.value as 'Individual' | 'Mosaic')
                }
              >
                <MenuItem value="Individual">Individual</MenuItem>
                <MenuItem value="Mosaic">Mosaic (split master video)</MenuItem>
              </Select>
            </FormControl>

            <Typography variant="body2" sx={{ color: 'text.secondary', mb: 1 }}>
              Rows: {rows}
            </Typography>
            <Slider
              value={rows}
              min={1}
              max={6}
              step={1}
              onChange={(_, v) => { setRows(v as number); setInitialized(false); }}
              marks
              sx={{ mb: 2 }}
            />

            <Typography variant="body2" sx={{ color: 'text.secondary', mb: 1 }}>
              Columns: {cols}
            </Typography>
            <Slider
              value={cols}
              min={1}
              max={6}
              step={1}
              onChange={(_, v) => { setCols(v as number); setInitialized(false); }}
              marks
              sx={{ mb: 2 }}
            />

            <Typography variant="body2" sx={{ color: 'text.secondary', mb: 1 }}>
              Horizontal Bezel: {bezelH} mm
            </Typography>
            <Slider value={bezelH} min={0} max={20} onChange={(_, v) => setBezelH(v as number)} sx={{ mb: 2 }} />

            <Typography variant="body2" sx={{ color: 'text.secondary', mb: 1 }}>
              Vertical Bezel: {bezelV} mm
            </Typography>
            <Slider value={bezelV} min={0} max={20} onChange={(_, v) => setBezelV(v as number)} sx={{ mb: 2 }} />

            <Typography variant="subtitle2" sx={{ mt: 2, mb: 1 }}>
              Available Screens
            </Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
              {data.availableScreens.map((s) => (
                <Chip key={s.id} label={s.name} size="small" variant="outlined" />
              ))}
            </Box>
          </Paper>
        </Grid>

        {/* Grid canvas */}
        <Grid size={{ xs: 12, md: 8 }}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="subtitle1" sx={{ mb: 2, fontWeight: 600 }}>
              Screen Grid ({rows} × {cols})
            </Typography>
            <Box
              sx={{
                display: 'grid',
                gridTemplateRows: `repeat(${rows}, ${CELL_SIZE}px)`,
                gridTemplateColumns: `repeat(${cols}, ${CELL_SIZE}px)`,
                gap: `${CELL_GAP}px`,
              }}
            >
              {Array.from({ length: rows }, (_, r) =>
                Array.from({ length: cols }, (_, c) => {
                  const key = cellKey(r, c);
                  const screenId = assignments.get(key) ?? '';
                  const screen = data.availableScreens.find((s) => s.id === screenId);
                  return (
                    <Tooltip key={key} title={`Row ${r + 1}, Col ${c + 1}`}>
                      <Box
                        sx={{
                          width: CELL_SIZE,
                          height: CELL_SIZE,
                          border: '2px solid',
                          borderColor: screen ? 'primary.main' : 'rgba(255,255,255,0.15)',
                          borderRadius: 1,
                          bgcolor: screen ? 'primary.dark' : 'background.paper',
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          justifyContent: 'center',
                          cursor: 'pointer',
                          overflow: 'hidden',
                        }}
                      >
                        <Select
                          value={screenId}
                          onChange={(e: SelectChangeEvent<string>) =>
                            handleCellAssign(r, c, e.target.value)
                          }
                          displayEmpty
                          size="small"
                          variant="standard"
                          sx={{
                            width: '100%',
                            fontSize: '0.7rem',
                            '& .MuiSelect-select': { py: 0, px: 1 },
                          }}
                        >
                          <MenuItem value="">
                            <em>Unassigned</em>
                          </MenuItem>
                          {data.availableScreens.map((s) => (
                            <MenuItem key={s.id} value={s.id}>
                              {s.name}
                            </MenuItem>
                          ))}
                        </Select>
                        {screen && (
                          <Typography
                            variant="caption"
                            sx={{ mt: 0.5, color: 'text.secondary', textAlign: 'center', px: 0.5 }}
                          >
                            {screen.name}
                          </Typography>
                        )}
                      </Box>
                    </Tooltip>
                  );
                }),
              )}
            </Box>
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
}
