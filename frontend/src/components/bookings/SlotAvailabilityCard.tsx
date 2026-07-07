import React from 'react';
import {
    Card,
    CardContent,
    Typography,
    Box,
    Chip,
    Grid,
    LinearProgress,
    Alert,
    CircularProgress,
    Collapse,
    IconButton,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import WarningIcon from '@mui/icons-material/Warning';
import ErrorIcon from '@mui/icons-material/Error';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../services/api';

interface SlotAvailabilityCardProps {
    screenId: string;
    startDate: Date;
    endDate: Date;
}

interface DailyAvailability {
    date: string;
    dayOfWeek: string;
    totalSlots: number;
    availableSlots: number;
    availableSlotNumbers: number[];
    status: string;
}

interface AvailabilitySummary {
    totalDays: number;
    availableDays: number;
    soldOutDays: number;
    totalAvailableSlots: number;
}

interface AvailabilityData {
    availability: DailyAvailability[];
    summary: AvailabilitySummary;
}

const SlotAvailabilityCard: React.FC<SlotAvailabilityCardProps> = ({
    screenId,
    startDate,
    endDate,
}) => {
    const [expanded, setExpanded] = React.useState(true);

    const { data: availabilityData, isLoading, error } = useQuery<AvailabilityData>({
        queryKey: ['screen-availability', screenId, startDate, endDate],
        queryFn: async () => {
            // Format dates in local timezone to avoid UTC offset issues
            const formatDate = (date: Date) => {
                const year = date.getFullYear();
                const month = String(date.getMonth() + 1).padStart(2, '0');
                const day = String(date.getDate()).padStart(2, '0');
                return `${year}-${month}-${day}`;
            };

            const response = await api.get(`/screens/${screenId}/availability`, {
                params: {
                    startDate: formatDate(startDate),
                    endDate: formatDate(endDate),
                },
            });
            return response.data.data;
        },
        enabled: !!screenId && !!startDate && !!endDate,
    });

    const getStatusColor = (status: string): 'success' | 'warning' | 'error' | 'default' => {
        switch (status) {
            case 'AVAILABLE':
                return 'success';
            case 'LIMITED':
                return 'warning';
            case 'SOLD_OUT':
                return 'error';
            default:
                return 'default';
        }
    };

    const getStatusIcon = (status: string): React.ReactElement | undefined => {
        switch (status) {
            case 'AVAILABLE':
                return <CheckCircleIcon fontSize="small" />;
            case 'LIMITED':
                return <WarningIcon fontSize="small" />;
            case 'SOLD_OUT':
                return <ErrorIcon fontSize="small" />;
            default:
                return undefined;
        }
    };

    if (isLoading) {
        return (
            <Card sx={{ borderRadius: 3 }}>
                <CardContent>
                    <Box display="flex" alignItems="center" gap={2}>
                        <CircularProgress size={20} />
                        <Typography>Loading slot availability...</Typography>
                    </Box>
                </CardContent>
            </Card>
        );
    }

    if (error) {
        return (
            <Alert severity="error">
                Failed to load slot availability. Please try again.
            </Alert>
        );
    }

    if (!availabilityData) {
        return null;
    }

    const { availability, summary } = availabilityData;
    const utilizationRate = summary.totalDays > 0
        ? ((summary.totalDays - summary.availableDays) / summary.totalDays) * 100
        : 0;

    return (
        <Card
            sx={{
                borderRadius: 3,
                border: '1px solid rgba(16, 24, 40, 0.08)',
                background:
                    'radial-gradient(900px 340px at 100% -10%, rgba(10, 102, 216, 0.08), transparent 60%), #ffffff',
            }}
        >
            <CardContent>
                <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                    <Typography variant="h6" fontWeight={700}>
                        Slot availability
                    </Typography>
                    <IconButton
                        onClick={() => setExpanded(!expanded)}
                        sx={{
                            transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)',
                            transition: '0.3s',
                        }}
                    >
                        <ExpandMoreIcon />
                    </IconButton>
                </Box>

                {/* Summary */}
                <Grid container spacing={2} mb={2}>
                    <Grid
                        size={{
                            xs: 6,
                            sm: 3
                        }}>
                        <Box textAlign="center" sx={{ p: 1.2, borderRadius: 2, bgcolor: 'rgba(10, 102, 216, 0.06)' }}>
                            <Typography variant="h4" color="primary">
                                {summary.totalAvailableSlots}
                            </Typography>
                            <Typography variant="caption" color="textSecondary">
                                Available Slots
                            </Typography>
                        </Box>
                    </Grid>
                    <Grid
                        size={{
                            xs: 6,
                            sm: 3
                        }}>
                        <Box textAlign="center" sx={{ p: 1.2, borderRadius: 2, bgcolor: 'rgba(22, 163, 74, 0.08)' }}>
                            <Typography variant="h4" color="success.main">
                                {summary.availableDays}
                            </Typography>
                            <Typography variant="caption" color="textSecondary">
                                Available Days
                            </Typography>
                        </Box>
                    </Grid>
                    <Grid
                        size={{
                            xs: 6,
                            sm: 3
                        }}>
                        <Box textAlign="center" sx={{ p: 1.2, borderRadius: 2, bgcolor: 'rgba(220, 38, 38, 0.08)' }}>
                            <Typography variant="h4" color="error.main">
                                {summary.soldOutDays}
                            </Typography>
                            <Typography variant="caption" color="textSecondary">
                                Sold Out Days
                            </Typography>
                        </Box>
                    </Grid>
                    <Grid
                        size={{
                            xs: 6,
                            sm: 3
                        }}>
                        <Box textAlign="center" sx={{ p: 1.2, borderRadius: 2, bgcolor: 'rgba(100, 116, 139, 0.10)' }}>
                            <Typography variant="h4">
                                {utilizationRate.toFixed(0)}%
                            </Typography>
                            <Typography variant="caption" color="textSecondary">
                                Utilization
                            </Typography>
                        </Box>
                    </Grid>
                </Grid>

                {/* Warnings */}
                {summary.soldOutDays > 0 && (
                    <Alert severity="warning" sx={{ mb: 2 }}>
                        {summary.soldOutDays} day(s) are fully booked. Your ad will not display on those days.
                    </Alert>
                )}

                {summary.totalAvailableSlots === 0 && (
                    <Alert severity="error" sx={{ mb: 2 }}>
                        All slots are sold out for this period. Please select different dates.
                    </Alert>
                )}

                {/* Daily Breakdown */}
                <Collapse in={expanded}>
                    <Typography variant="subtitle2" gutterBottom sx={{ mt: 2 }}>
                        Daily Breakdown
                    </Typography>
                    <Box>
                        {availability.map((day) => (
                            <Box
                                key={day.date}
                                sx={{
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    py: 1,
                                    borderBottom: '1px solid',
                                    borderColor: 'divider',
                                }}
                            >
                                <Box>
                                    <Typography variant="body2" fontWeight="medium">
                                        {new Date(day.date).toLocaleDateString('en-US', {
                                            weekday: 'short',
                                            month: 'short',
                                            day: 'numeric',
                                        })}
                                    </Typography>
                                    <Typography variant="caption" color="textSecondary">
                                        {day.availableSlots}/{day.totalSlots} slots available
                                    </Typography>
                                </Box>

                                <Box display="flex" alignItems="center" gap={1}>
                                    {/* Slot indicators */}
                                    <Box display="flex" gap={0.5}>
                                        {Array.from({ length: day.totalSlots }).map((_, idx) => {
                                            const slotNumber = idx + 1;
                                            const isAvailable = day.availableSlotNumbers.includes(slotNumber);
                                            return (
                                                <Box
                                                    key={idx}
                                                    sx={{
                                                        width: 12,
                                                        height: 12,
                                                        borderRadius: '50%',
                                                        bgcolor: isAvailable ? 'success.main' : 'error.main',
                                                        opacity: isAvailable ? 0.7 : 0.3,
                                                    }}
                                                    title={`Slot ${slotNumber}: ${isAvailable ? 'Available' : 'Booked'}`}
                                                />
                                            );
                                        })}
                                    </Box>

                                    <Chip
                                        label={day.status.replace('_', ' ')}
                                        color={getStatusColor(day.status)}
                                        size="small"
                                        icon={getStatusIcon(day.status)}
                                    />
                                </Box>
                            </Box>
                        ))}
                    </Box>
                </Collapse>

                {/* Progress Bar */}
                <Box mt={2}>
                    <Box display="flex" justifyContent="space-between" mb={0.5}>
                        <Typography variant="caption">Overall Availability</Typography>
                        <Typography variant="caption">
                            {summary.totalAvailableSlots} slots available
                        </Typography>
                    </Box>
                    <LinearProgress
                        variant="determinate"
                        value={100 - utilizationRate}
                        sx={{ height: 8, borderRadius: 1 }}
                        color={utilizationRate > 80 ? 'error' : utilizationRate > 50 ? 'warning' : 'success'}
                    />
                </Box>
            </CardContent>
        </Card>
    );
};

export default SlotAvailabilityCard;
