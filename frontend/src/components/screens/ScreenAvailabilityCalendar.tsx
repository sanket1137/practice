import { useState } from 'react';
import {
  Box,
  CircularProgress,
  Grid,
  IconButton,
  Paper,
  Tooltip,
  Typography,
} from '@mui/material';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import { useQuery } from '@tanstack/react-query';
import {
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  format,
  getDay,
  addMonths,
  subMonths,
  parseISO,
  isToday,
} from 'date-fns';
import api from '../../services/api';

interface DailyAvailability {
  date: string; // ISO datetime e.g. "2026-06-01T00:00:00"
  totalSlots: number;
  availableSlots: number;
  status: string; // "AVAILABLE" | "LIMITED" | "SOLD_OUT"
}

interface ScreenAvailabilityCalendarProps {
  screenId: string;
}

const fetchAvailability = async (
  screenId: string,
  startDate: string,
  endDate: string
): Promise<DailyAvailability[]> => {
  const res = await api.get(`/screens/${screenId}/availability`, {
    params: { startDate, endDate },
  });
  // Backend returns ApiResponse<ScreenAvailabilityDto> where data = { availability: [], summary: {} }
  return res.data.data?.availability ?? [];
};

function getDayStatus(slot: DailyAvailability | undefined): 'available' | 'partial' | 'booked' | 'unknown' {
  if (!slot) return 'unknown';
  const s = slot.status?.toUpperCase();
  if (s === 'AVAILABLE') return 'available';
  if (s === 'SOLD_OUT') return 'booked';
  if (s === 'LIMITED') return 'partial';
  // Fallback to slot counts
  if (slot.availableSlots === slot.totalSlots) return 'available';
  if (slot.availableSlots === 0) return 'booked';
  return 'partial';
}

const STATUS_COLORS = {
  available: 'success.main',
  partial: 'warning.main',
  booked: 'error.main',
  unknown: 'text.disabled',
};

const STATUS_LABELS = {
  available: 'All slots free',
  partial: 'Partially booked',
  booked: 'Fully booked',
  unknown: 'No data',
};

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function ScreenAvailabilityCalendar({ screenId }: ScreenAvailabilityCalendarProps) {
  const [month, setMonth] = useState(new Date());

  const startDate = format(startOfMonth(month), 'yyyy-MM-dd');
  const endDate = format(endOfMonth(month), 'yyyy-MM-dd');

  const { data: availability = [], isLoading, error } = useQuery({
    queryKey: ['screen-availability', screenId, startDate],
    queryFn: () => fetchAvailability(screenId, startDate, endDate),
    staleTime: 5 * 60 * 1000,
  });

  // Backend returns ISO datetime strings — normalise to "yyyy-MM-dd" for map lookup
  const slotMap = new Map<string, DailyAvailability>(
    availability.map((s) => [format(parseISO(s.date), 'yyyy-MM-dd'), s])
  );

  const days = eachDayOfInterval({ start: startOfMonth(month), end: endOfMonth(month) });
  const firstDayOfWeek = getDay(startOfMonth(month));

  return (
    <Box
      sx={{
        border: '1px solid rgba(16, 24, 40, 0.08)',
        borderRadius: 3,
        p: 2,
        background:
          'radial-gradient(900px 320px at 100% -10%, rgba(10, 102, 216, 0.07), transparent 58%), #ffffff',
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
        <Typography variant="subtitle1" fontWeight={700}>
          Slot availability
        </Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <IconButton size="small" onClick={() => setMonth(subMonths(month, 1))}>
            <ChevronLeftIcon />
          </IconButton>
          <Typography variant="body2" sx={{ minWidth: 120, textAlign: 'center' }}>
            {format(month, 'MMMM yyyy')}
          </Typography>
          <IconButton size="small" onClick={() => setMonth(addMonths(month, 1))}>
            <ChevronRightIcon />
          </IconButton>
        </Box>
      </Box>

      {isLoading && (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
          <CircularProgress size={24} />
        </Box>
      )}

      {!isLoading && !error && (
        <>
          <Grid container columns={7} sx={{ mb: 0.5 }}>
            {WEEKDAYS.map((d) => (
              <Grid size={1} key={d}>
                <Typography
                  variant="caption"
                  sx={{
                    color: 'text.secondary',
                    display: 'block',
                    textAlign: 'center',
                    py: 0.8,
                    borderRadius: 2,
                    bgcolor: 'rgba(10, 102, 216, 0.06)',
                  }}
                >
                  {d}
                </Typography>
              </Grid>
            ))}
          </Grid>

          <Grid container columns={7}>
            {/* Blank cells before first day */}
            {Array.from({ length: firstDayOfWeek }).map((_, i) => (
              <Grid size={1} key={`blank-${i}`} />
            ))}

            {days.map((day) => {
              const key = format(day, 'yyyy-MM-dd');
              const slot = slotMap.get(key);
              const status = getDayStatus(slot);
              const todayBorder = isToday(day);

              return (
                <Grid size={1} key={key}>
                  <Tooltip
                    title={
                      slot
                        ? `${STATUS_LABELS[status]} — ${slot.availableSlots}/${slot.totalSlots} slots free`
                        : STATUS_LABELS.unknown
                    }
                    placement="top"
                  >
                    <Paper
                      variant="outlined"
                      sx={{
                        m: 0.25,
                        p: 0.65,
                        minHeight: 58,
                        cursor: 'default',
                        borderColor: todayBorder ? 'primary.main' : 'rgba(16, 24, 40, 0.12)',
                        borderWidth: todayBorder ? 2 : 1,
                        bgcolor: todayBorder ? 'rgba(10, 102, 216, 0.06)' : 'background.paper',
                        transition: 'opacity 0.2s',
                        '&:hover': { opacity: 0.85 },
                      }}
                    >
                      <Typography
                        variant="caption"
                        sx={{ display: 'block', textAlign: 'center', color: 'text.secondary' }}
                      >
                        {format(day, 'd')}
                      </Typography>
                      <Box
                        sx={{
                          width: 8,
                          height: 8,
                          borderRadius: '50%',
                          bgcolor: STATUS_COLORS[status],
                          mx: 'auto',
                          mt: 0.5,
                        }}
                      />
                    </Paper>
                  </Tooltip>
                </Grid>
              );
            })}
          </Grid>

          <Box sx={{ display: 'flex', gap: 2, mt: 2, flexWrap: 'wrap' }}>
            {(['available', 'partial', 'booked'] as const).map((s) => (
              <Box key={s} sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: STATUS_COLORS[s] }} />
                <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                  {STATUS_LABELS[s]}
                </Typography>
              </Box>
            ))}
          </Box>
        </>
      )}

      {error && (
        <Typography variant="body2" color="error">
          Could not load availability data.
        </Typography>
      )}
    </Box>
  );
}
