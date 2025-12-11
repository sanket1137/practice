import { Box, Paper, Typography, Tooltip, Grid, Chip } from '@mui/material';
import { format, eachDayOfInterval } from 'date-fns';
import {
    CheckCircle as AvailableIcon,
    Cancel as UnavailableIcon,
    RemoveCircle as PartialIcon,
} from '@mui/icons-material';

interface DayAvailability {
    date: Date;
    availableSlots: number;
    totalSlots: number;
    status: 'available' | 'partial' | 'unavailable';
}

interface AvailabilityHeatmapProps {
    startDate: Date;
    endDate: Date;
    availability: DayAvailability[];
    onDateClick?: (date: Date, availability: DayAvailability | undefined) => void;
}

const STATUS_COLORS = {
    available: '#4caf50',
    partial: '#ff9800',
    unavailable: '#f44336',
};

const STATUS_LABELS = {
    available: 'Available',
    partial: 'Partially Available',
    unavailable: 'Fully Booked',
};

export default function AvailabilityHeatmap({
    startDate,
    endDate,
    availability,
    onDateClick,
}: AvailabilityHeatmapProps) {
    const dateRange = eachDayOfInterval({ start: startDate, end: endDate });

    const getAvailabilityForDate = (date: Date): DayAvailability | undefined => {
        return availability.find(
            (a) => format(a.date, 'yyyy-MM-dd') === format(date, 'yyyy-MM-dd')
        );
    };

    const getStatusColor = (status?: string) => {
        if (!status) return '#e0e0e0';
        return STATUS_COLORS[status as keyof typeof STATUS_COLORS];
    };

    return (
        <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
                Availability Calendar
            </Typography>

            <Typography variant="body2" color="text.secondary" mb={3}>
                {format(startDate, 'MMM dd, yyyy')} - {format(endDate, 'MMM dd, yyyy')}
            </Typography>

            {/* Calendar Grid */}
            <Grid container spacing={1} mb={3}>
                {dateRange.map((date) => {
                    const dayAvailability = getAvailabilityForDate(date);
                    const status = dayAvailability?.status;
                    const isClickable = !!onDateClick;

                    return (
                        <Grid item xs={12 / 7} sm={12 / 7} md={12 / 14} key={date.toISOString()}>
                            <Tooltip
                                title={
                                    dayAvailability
                                        ? `${format(date, 'MMM dd')}: ${dayAvailability.availableSlots}/${dayAvailability.totalSlots
                                        } slots available - ${STATUS_LABELS[status!]}`
                                        : `${format(date, 'MMM dd')}: No data`
                                }
                                arrow
                            >
                                <Paper
                                    variant="outlined"
                                    sx={{
                                        p: 1,
                                        textAlign: 'center',
                                        cursor: isClickable ? 'pointer' : 'default',
                                        bgcolor: getStatusColor(status),
                                        borderColor: getStatusColor(status),
                                        transition: 'all 0.2s',
                                        '&:hover': isClickable
                                            ? {
                                                transform: 'scale(1.05)',
                                                boxShadow: 2,
                                            }
                                            : {},
                                    }}
                                    onClick={() => onDateClick?.(date, dayAvailability)}
                                >
                                    <Typography
                                        variant="caption"
                                        fontWeight="bold"
                                        color={status ? 'white' : 'text.secondary'}
                                    >
                                        {format(date, 'd')}
                                    </Typography>
                                    <Typography
                                        variant="caption"
                                        display="block"
                                        fontSize="0.6rem"
                                        color={status ? 'rgba(255,255,255,0.8)' : 'text.secondary'}
                                    >
                                        {format(date, 'EEE')}
                                    </Typography>
                                    {dayAvailability && (
                                        <Typography
                                            variant="caption"
                                            display="block"
                                            fontSize="0.65rem"
                                            fontWeight="medium"
                                            color="white"
                                        >
                                            {dayAvailability.availableSlots}/{dayAvailability.totalSlots}
                                        </Typography>
                                    )}
                                </Paper>
                            </Tooltip>
                        </Grid>
                    );
                })}
            </Grid>

            {/* Legend */}
            <Box display="flex" gap={2} flexWrap="wrap" justifyContent="center">
                {Object.entries(STATUS_LABELS).map(([key, label]) => (
                    <Chip
                        key={key}
                        icon={
                            key === 'available' ? (
                                <AvailableIcon />
                            ) : key === 'partial' ? (
                                <PartialIcon />
                            ) : (
                                <UnavailableIcon />
                            )
                        }
                        label={label}
                        size="small"
                        sx={{
                            bgcolor: STATUS_COLORS[key as keyof typeof STATUS_COLORS],
                            color: 'white',
                        }}
                    />
                ))}
            </Box>
        </Paper>
    );
}
