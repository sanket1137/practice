import {
    Card,
    CardContent,
    Typography,
    Box,
    Chip,
    LinearProgress,
    Stack,
    Tooltip,
} from '@mui/material';
import {
    Tv as ScreenIcon,
    LocationOn,
} from '@mui/icons-material';

interface Screen {
    id: string;
    name: string;
    location: string;
    city?: string;
    totalSlots: number;
    bookedSlots?: number;
    revenue?: number;
    currency?: string;
    activeBookings?: number;
}

interface EnhancedScreenCardProps {
    screen: Screen;
    onClick?: () => void;
}

export default function EnhancedScreenCard({ screen, onClick }: EnhancedScreenCardProps) {
    const utilizationPercentage = screen.bookedSlots
        ? (screen.bookedSlots / screen.totalSlots) * 100
        : 0;

    const getUtilizationColor = () => {
        if (utilizationPercentage >= 90) return 'error';
        if (utilizationPercentage >= 70) return 'warning';
        if (utilizationPercentage >= 40) return 'success';
        return 'info';
    };

    const getUtilizationLabel = () => {
        if (utilizationPercentage >= 90) return 'High Demand';
        if (utilizationPercentage >= 70) return 'Popular';
        if (utilizationPercentage >= 40) return 'Available';
        return 'Low Utilization';
    };

    return (
        <Card
            sx={{
                cursor: onClick ? 'pointer' : 'default',
                '&:hover': onClick ? { boxShadow: 4 } : {},
                transition: 'box-shadow 0.3s',
                height: '100%',
            }}
            onClick={onClick}
        >
            <CardContent>
                {/* Header */}
                <Box display="flex" alignItems="flex-start" justifyContent="space-between" mb={2}>
                    <Box display="flex" alignItems="center" gap={1} flex={1}>
                        <ScreenIcon color="primary" />
                        <Typography variant="h6" noWrap>
                            {screen.name}
                        </Typography>
                    </Box>
                    <Tooltip title={getUtilizationLabel()}>
                        <Chip
                            size="small"
                            label={`${utilizationPercentage.toFixed(0)}%`}
                            color={getUtilizationColor()}
                        />
                    </Tooltip>
                </Box>

                {/* Location */}
                <Box display="flex" alignItems="center" gap={0.5} mb={2}>
                    <LocationOn fontSize="small" color="action" />
                    <Typography variant="body2" color="text.secondary" noWrap>
                        {screen.location}
                        {screen.city && `, ${screen.city}`}
                    </Typography>
                </Box>

                {/* Utilization Progress */}
                <Box mb={2}>
                    <Box display="flex" justifyContent="space-between" alignItems="center" mb={0.5}>
                        <Typography variant="caption" color="text.secondary">
                            Slot Utilization
                        </Typography>
                        <Typography variant="caption" fontWeight="medium">
                            {screen.bookedSlots || 0} / {screen.totalSlots} slots
                        </Typography>
                    </Box>
                    <Tooltip
                        title={`${screen.bookedSlots || 0} slots booked out of ${screen.totalSlots} total`}
                    >
                        <LinearProgress
                            variant="determinate"
                            value={utilizationPercentage}
                            color={getUtilizationColor()}
                            sx={{ height: 8, borderRadius: 4 }}
                        />
                    </Tooltip>
                </Box>

                {/* Stats */}
                <Stack direction="row" spacing={2} justifyContent="space-between">
                    {screen.activeBookings !== undefined && (
                        <Box>
                            <Typography variant="caption" color="text.secondary" display="block">
                                Active Bookings
                            </Typography>
                            <Typography variant="h6" fontWeight="bold">
                                {screen.activeBookings}
                            </Typography>
                        </Box>
                    )}
                    {screen.revenue !== undefined && (
                        <Box>
                            <Typography variant="caption" color="text.secondary" display="block">
                                Revenue
                            </Typography>
                            <Typography variant="h6" fontWeight="bold" color="success.main">
                                {screen.currency || '$'}
                                {screen.revenue.toLocaleString()}
                            </Typography>
                        </Box>
                    )}
                </Stack>
            </CardContent>
        </Card>
    );
}
