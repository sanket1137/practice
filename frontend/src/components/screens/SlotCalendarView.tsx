import { useState } from 'react';
import { Box, Typography, Paper, IconButton, Chip, Grid, CircularProgress } from '@mui/material';
import { ChevronLeft, ChevronRight } from '@mui/icons-material';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../services/api';
import { startOfMonth, endOfMonth, addMonths, format, startOfWeek, endOfWeek, addDays, isSameMonth } from 'date-fns';

interface SlotCalendarViewProps {
    screenId: string;
}

export default function SlotCalendarView({ screenId }: SlotCalendarViewProps) {
    const [currentMonth, setCurrentMonth] = useState(new Date());

    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    const startDate = startOfWeek(monthStart);
    const endDate = endOfWeek(monthEnd);

    const { data: calendar, isLoading } = useQuery({
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

    const getAvailabilityColor = (day: any) => {
        if (!day?.isOperating) return '#424242'; // Gray - not operating
        if (!day?.slots) return '#424242';

        const bookedCount = day.slots.filter((s: any) => s.status === 'booked').length;
        const totalSlots = day.slots.length;

        if (bookedCount === 0) return '#4caf50'; // Green - all available
        if (bookedCount === totalSlots) return '#f44336'; // Red - fully booked
        return '#ff9800'; // Orange - partial
    };

    const renderCalendar = () => {
        const days = [];
        let day = startDate;

        while (day <= endDate) {
            const calendarDay = calendar?.days?.find(
                (d: any) => format(new Date(d.date), 'yyyy-MM-dd') === format(day, 'yyyy-MM-dd')
            );

            const bookedSlots = calendarDay?.slots?.filter((s: any) => s.status === 'booked') || [];
            const totalSlots = calendarDay?.slots?.length || calendar?.slotsPerFrame || 6;

            days.push(
                <Box
                    key={day.toString()}
                    sx={{
                        textAlign: 'center',
                        p: 1,
                        border: '1px solid #e0e0e0',
                        bgcolor: getAvailabilityColor(calendarDay),
                        color: '#fff',
                        opacity: isSameMonth(day, currentMonth) ? 1 : 0.3,
                        cursor: calendarDay ? 'pointer' : 'default',
                        '&:hover': calendarDay ? { opacity: 0.8 } : {},
                    }}
                >
                    <Typography variant="body2" fontWeight="bold">
                        {format(day, 'd')}
                    </Typography>
                    {calendarDay && (
                        <Typography variant="caption" sx={{ fontSize: '0.7rem' }}>
                            {bookedSlots.length}/{totalSlots}
                        </Typography>
                    )}
                </Box>
            );
            day = addDays(day, 1);
        }

        return days;
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
            <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
                <IconButton onClick={prevMonth}>
                    <ChevronLeft />
                </IconButton>
                <Typography variant="h6">{format(currentMonth, 'MMMM yyyy')}</Typography>
                <IconButton onClick={nextMonth}>
                    <ChevronRight />
                </IconButton>
            </Box>
            {/* Day headers */}
            <Grid container spacing={0} sx={{ mb: 1 }}>
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
                    <Grid key={day} size={12 / 7}>
                        <Typography variant="caption" fontWeight="bold" textAlign="center" display="block">
                            {day}
                        </Typography>
                    </Grid>
                ))}
            </Grid>
            {/* Calendar grid */}
            <Grid container spacing={0}>
                {renderCalendar()}
            </Grid>
            {/* Legend */}
            <Box display="flex" gap={2} mt={3} justifyContent="center" flexWrap="wrap">
                <Chip label="Available" sx={{ bgcolor: '#4caf50', color: '#fff' }} size="small" />
                <Chip label="Partial" sx={{ bgcolor: '#ff9800', color: '#fff' }} size="small" />
                <Chip label="Fully Booked" sx={{ bgcolor: '#f44336', color: '#fff' }} size="small" />
                <Chip label="Not Operating" sx={{ bgcolor: '#424242', color: '#fff' }} size="small" />
            </Box>
        </Paper>
    );
}
