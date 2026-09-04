import { useState } from 'react';
import { Box, Typography, Paper, IconButton, CircularProgress, Tooltip, useTheme } from '@mui/material';
import { alpha } from '@mui/material/styles';
import { ChevronLeft, ChevronRight } from '@mui/icons-material';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../services/api';
import { startOfMonth, endOfMonth, addMonths, format, startOfWeek, endOfWeek, addDays, isSameMonth, isToday } from 'date-fns';

interface SlotCalendarViewProps {
    screenId: string;
    /**
     * Who is looking. Owners see occupancy ("2/6" booked — fleet-ops framing);
     * advertisers see buyability ("4 left" / "Sold out") — the raw booked/total
     * fraction read backwards to buyers ("0/6" looked like nothing available).
     */
    audience?: 'owner' | 'advertiser';
}

interface SlotCalendarSlot {
    slotNumber: number;
    status: string;
    isMine?: boolean;
    campaignName?: string | null;
}

interface SlotCalendarDay {
    date: string;
    isOperating: boolean;
    slots: SlotCalendarSlot[];
}

interface SlotCalendarResponse {
    slotsPerFrame: number;
    days: SlotCalendarDay[];
}

type DayKind = 'available' | 'partial' | 'full' | 'off';

/**
 * Month view of slot occupancy. Soft-tinted status cells (readable in both
 * themes — the old design painted saturated fills that swallowed the text),
 * a today ring, per-day tooltips, and a legend that matches the cells.
 */
export default function SlotCalendarView({ screenId, audience = 'advertiser' }: SlotCalendarViewProps) {
    const theme = useTheme();
    const forBuyer = audience === 'advertiser';
    const [currentMonth, setCurrentMonth] = useState(new Date());

    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    const startDate = startOfWeek(monthStart);
    const endDate = endOfWeek(monthEnd);

    const { data: calendar, isLoading } = useQuery<SlotCalendarResponse>({
        queryKey: ['slot-calendar', screenId, format(startDate, 'yyyy-MM-dd')],
        queryFn: async () => {
            const response = await api.get(`/screens/${screenId}/calendar`, {
                params: {
                    startDate: format(startDate, 'yyyy-MM-dd'),
                    endDate: format(endDate, 'yyyy-MM-dd'),
                },
            });
            return response.data.data;
        },
    });

    const prevMonth = () => setCurrentMonth(addMonths(currentMonth, -1));
    const nextMonth = () => setCurrentMonth(addMonths(currentMonth, 1));

    const kindOf = (day: SlotCalendarDay | undefined): DayKind => {
        if (!day?.isOperating || !day?.slots?.length) return 'off';
        const booked = day.slots.filter((s) => s.status === 'booked').length;
        if (booked === 0) return 'available';
        if (booked === day.slots.length) return 'full';
        return 'partial';
    };

    const kindColor: Record<DayKind, string> = {
        available: theme.palette.success.main,
        partial: theme.palette.warning.main,
        full: theme.palette.error.main,
        off: theme.palette.text.disabled,
    };

    const cellSx = (kind: DayKind, inMonth: boolean, today: boolean) => {
        const c = kindColor[kind];
        return {
            borderRadius: '10px',
            p: 0.75,
            minHeight: 56,
            display: 'flex',
            flexDirection: 'column' as const,
            alignItems: 'center',
            justifyContent: 'center',
            gap: 0.25,
            bgcolor: kind === 'off' ? alpha(c, 0.08) : alpha(c, theme.palette.mode === 'dark' ? 0.16 : 0.12),
            border: '1px solid',
            borderColor: today ? theme.palette.primary.main : alpha(c, kind === 'off' ? 0.15 : 0.45),
            boxShadow: today ? `0 0 0 1px ${theme.palette.primary.main}` : 'none',
            opacity: inMonth ? 1 : 0.35,
            transition: 'transform 120ms ease, box-shadow 120ms ease',
            '&:hover': { transform: 'translateY(-1px)', boxShadow: theme.shadows[2] },
        };
    };

    const kindLabel: Record<DayKind, string> = {
        available: 'All slots open',
        partial: forBuyer ? 'Limited availability' : 'Partially booked',
        full: forBuyer ? 'Sold out' : 'Fully booked',
        off: 'Not operating',
    };

    const renderCells = () => {
        const cells = [];
        let day = startDate;
        while (day <= endDate) {
            const key = format(day, 'yyyy-MM-dd');
            const calendarDay = calendar?.days?.find((d) => format(new Date(d.date), 'yyyy-MM-dd') === key);
            const kind = kindOf(calendarDay);
            const booked = calendarDay?.slots?.filter((s) => s.status === 'booked').length ?? 0;
            const mine = calendarDay?.slots?.filter((s) => s.isMine).length ?? 0;
            const total = calendarDay?.slots?.length || calendar?.slotsPerFrame || 0;
            const inMonth = isSameMonth(day, currentMonth);

            const left = total - booked;
            const cellCaption = forBuyer
                ? (kind === 'full' ? 'Sold out' : kind === 'partial' ? `${left} left` : null)
                : (kind !== 'off' ? `${booked}/${total}` : null);
            const tooltipDetail = forBuyer
                ? (kind === 'full' ? 'Sold out' : `${left} of ${total} slots open`)
                : `${booked}/${total} slots booked`;

            cells.push(
                <Tooltip
                    key={key}
                    arrow
                    title={calendarDay
                        ? `${format(day, 'EEE d MMM')} — ${kindLabel[kind]}` +
                          (kind !== 'off' ? ` · ${tooltipDetail}` : '') +
                          (mine > 0 ? ` · ${mine} slot${mine === 1 ? '' : 's'} yours` : '')
                        : format(day, 'EEE d MMM')}
                >
                    <Box sx={{
                        ...cellSx(kind, inMonth, isToday(day)),
                        ...(mine > 0 && {
                            outline: `2px solid ${theme.palette.secondary.main}`,
                            outlineOffset: '-2px',
                        }),
                    }}>
                        <Typography variant="body2" sx={{ fontWeight: 700, lineHeight: 1, color: 'text.primary' }}>
                            {format(day, 'd')}
                        </Typography>
                        {calendarDay && cellCaption && (
                            <Typography variant="caption" sx={{
                                lineHeight: 1, fontWeight: 700, fontVariantNumeric: 'tabular-nums',
                                color: kindColor[kind], fontSize: 10,
                            }}>
                                {cellCaption}
                            </Typography>
                        )}
                        {mine > 0 && (
                            <Box sx={{
                                width: 6, height: 6, borderRadius: '50%',
                                bgcolor: 'secondary.main', mt: 0.25,
                            }} />
                        )}
                    </Box>
                </Tooltip>
            );
            day = addDays(day, 1);
        }
        return cells;
    };

    if (isLoading) {
        return (
            <Box display="flex" justifyContent="center" p={4}>
                <CircularProgress />
            </Box>
        );
    }

    return (
        <Paper sx={{ p: 3 }}>
            <Box display="flex" justifyContent="space-between" alignItems="center" mb={2.5}>
                <IconButton onClick={prevMonth} size="small"><ChevronLeft /></IconButton>
                <Typography variant="h4">{format(currentMonth, 'MMMM yyyy')}</Typography>
                <IconButton onClick={nextMonth} size="small"><ChevronRight /></IconButton>
            </Box>

            {/* Weekday header + cells share the same 7-column grid */}
            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '6px', mb: '6px' }}>
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
                    <Typography key={d} variant="caption" sx={{
                        textAlign: 'center', fontWeight: 700, color: 'text.disabled',
                        textTransform: 'uppercase', letterSpacing: '1px', fontSize: 10,
                    }}>
                        {d}
                    </Typography>
                ))}
            </Box>
            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '6px' }}>
                {renderCells()}
            </Box>

            {/* Legend — same tints as the cells */}
            <Box display="flex" gap={1.5} mt={2.5} justifyContent="center" flexWrap="wrap">
                {(['available', 'partial', 'full', 'off'] as DayKind[]).map((kind) => (
                    <Box key={kind} sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        <Box sx={{
                            width: 12, height: 12, borderRadius: '4px',
                            bgcolor: alpha(kindColor[kind], theme.palette.mode === 'dark' ? 0.16 : 0.12),
                            border: `1px solid ${alpha(kindColor[kind], 0.45)}`,
                        }} />
                        <Typography variant="caption" color="text.secondary">
                            {kind === 'available' ? 'Available'
                                : kind === 'partial' ? (forBuyer ? 'Limited' : 'Partial')
                                : kind === 'full' ? 'Sold out' : 'Not operating'}
                        </Typography>
                    </Box>
                ))}
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <Box sx={{
                        width: 12, height: 12, borderRadius: '4px',
                        border: `2px solid ${theme.palette.secondary.main}`,
                    }} />
                    <Typography variant="caption" color="text.secondary">Your booking</Typography>
                </Box>
            </Box>
        </Paper>
    );
}
