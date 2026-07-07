import { useState } from 'react';
import {
    Box,
    Paper,
    Typography,
    IconButton,
    Grid,
    Chip,
    Tooltip,
    Stack,
} from '@mui/material';
import {
    ChevronLeft,
    ChevronRight,
} from '@mui/icons-material';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, isToday } from 'date-fns';

interface BookingCalendarEvent {
    id: string;
    date: Date;
    title: string;
    screenName: string;
    status: 'Pending' | 'Approved' | 'Active' | 'Completed';
}

interface BookingCalendarViewProps {
    events: BookingCalendarEvent[];
    onDateClick?: (date: Date) => void;
    onEventClick?: (event: BookingCalendarEvent) => void;
}

const STATUS_COLORS = {
    Pending: '#d97706',
    Approved: '#0a66d8',
    Active: '#16a34a',
    Completed: '#64748b',
};

export default function BookingCalendarView({
    events,
    onDateClick,
    onEventClick,
}: BookingCalendarViewProps) {
    const [currentDate, setCurrentDate] = useState(new Date());

    const monthStart = startOfMonth(currentDate);
    const monthEnd = endOfMonth(currentDate);
    const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });

    const handlePrevMonth = () => {
        setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
    };

    const handleNextMonth = () => {
        setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
    };

    const getEventsForDate = (date: Date) => {
        return events.filter((event) => isSameDay(event.date, date));
    };

    return (
        <Paper
            sx={{
                p: { xs: 2, sm: 3 },
                borderRadius: 3,
                border: '1px solid rgba(16, 24, 40, 0.08)',
                boxShadow: '0 10px 28px rgba(16, 24, 40, 0.08)',
                background:
                    'radial-gradient(1000px 300px at 100% -10%, rgba(10, 102, 216, 0.09), transparent 58%), #ffffff',
            }}
        >
            {/* Header */}
            <Box display="flex" alignItems="center" justifyContent="space-between" mb={3}>
                <Typography variant="h6" fontWeight={700}>
                    {format(currentDate, 'MMMM yyyy')}
                </Typography>
                <Box>
                    <IconButton onClick={handlePrevMonth} size="small">
                        <ChevronLeft />
                    </IconButton>
                    <IconButton onClick={handleNextMonth} size="small">
                        <ChevronRight />
                    </IconButton>
                </Box>
            </Box>
            {/* Weekday headers */}
            <Grid container spacing={1} mb={1.5}>
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
                    <Grid key={day} size={12 / 7}>
                        <Typography
                            variant="caption"
                            color="text.secondary"
                            fontWeight={700}
                            textAlign="center"
                            display="block"
                            sx={{
                                py: 0.8,
                                borderRadius: 2,
                                bgcolor: 'rgba(10, 102, 216, 0.06)',
                            }}
                        >
                            {day}
                        </Typography>
                    </Grid>
                ))}
            </Grid>
            {/* Calendar Grid */}
            <Grid container spacing={1}>
                {/* Empty cells for days before month starts */}
                {Array.from({ length: monthStart.getDay() }).map((_, idx) => (
                    <Grid key={`empty-${idx}`} size={12 / 7}>
                        <Box sx={{ height: 100 }} />
                    </Grid>
                ))}

                {/* Days of the month */}
                {daysInMonth.map((date) => {
                    const dayEvents = getEventsForDate(date);
                    const isCurrentDay = isToday(date);

                    return (
                        <Grid key={date.toISOString()} size={12 / 7}>
                            <Paper
                                variant="outlined"
                                sx={{
                                    height: 112,
                                    p: 1,
                                    cursor: onDateClick ? 'pointer' : 'default',
                                    bgcolor: isCurrentDay ? 'rgba(10, 102, 216, 0.06)' : 'background.paper',
                                    borderColor: isCurrentDay ? 'primary.main' : 'rgba(16, 24, 40, 0.12)',
                                    borderWidth: isCurrentDay ? 2 : 1,
                                    '&:hover': onDateClick
                                        ? {
                                            bgcolor: 'rgba(10, 102, 216, 0.04)',
                                            borderColor: 'primary.main',
                                        }
                                        : {},
                                    overflow: 'hidden',
                                }}
                                onClick={() => onDateClick?.(date)}
                            >
                                <Typography
                                    variant="caption"
                                    fontWeight={isCurrentDay ? 700 : 500}
                                    color={isCurrentDay ? 'primary.main' : 'text.secondary'}
                                >
                                    {format(date, 'd')}
                                </Typography>

                                <Stack spacing={0.5} mt={0.5}>
                                    {dayEvents.slice(0, 2).map((event) => (
                                        <Tooltip key={event.id} title={event.title} arrow>
                                            <Chip
                                                label={event.screenName}
                                                size="small"
                                                sx={{
                                                    height: 20,
                                                    fontSize: '0.65rem',
                                                    bgcolor: STATUS_COLORS[event.status],
                                                    color: 'white',
                                                    borderRadius: 1,
                                                    '& .MuiChip-label': {
                                                        px: 1,
                                                        overflow: 'hidden',
                                                        textOverflow: 'ellipsis',
                                                    },
                                                }}
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    onEventClick?.(event);
                                                }}
                                            />
                                        </Tooltip>
                                    ))}
                                    {dayEvents.length > 2 && (
                                        <Typography variant="caption" color="text.secondary" textAlign="center">
                                            +{dayEvents.length - 2} more
                                        </Typography>
                                    )}
                                </Stack>
                            </Paper>
                        </Grid>
                    );
                })}
            </Grid>
            {/* Legend */}
            <Box mt={3} display="flex" gap={2} flexWrap="wrap" sx={{ pt: 1, borderTop: '1px solid rgba(16, 24, 40, 0.08)' }}>
                {Object.entries(STATUS_COLORS).map(([status, color]) => (
                    <Box key={status} display="flex" alignItems="center" gap={0.5}>
                        <Box
                            sx={{
                                width: 12,
                                height: 12,
                                bgcolor: color,
                                borderRadius: '50%',
                            }}
                        />
                        <Typography variant="caption" color="text.secondary">
                            {status}
                        </Typography>
                    </Box>
                ))}
            </Box>
        </Paper>
    );
}
