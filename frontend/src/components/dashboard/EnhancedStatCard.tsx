import { Box, Card, CardContent, Typography, LinearProgress, Tooltip } from '@mui/material';
import { TrendingUp, TrendingDown } from '@mui/icons-material';

interface StatCardProps {
    title: string;
    value: string | number;
    subtitle?: string;
    trend?: {
        value: number;
        isPositive: boolean;
    };
    progress?: {
        value: number;
        max: number;
        color?: 'primary' | 'secondary' | 'error' | 'warning' | 'info' | 'success';
    };
    icon?: React.ReactNode;
    color?: string;
}

export default function EnhancedStatCard({
    title,
    value,
    subtitle,
    trend,
    progress,
    icon,
    color = 'primary.main',
}: StatCardProps) {
    return (
        <Card sx={{ height: '100%', position: 'relative', overflow: 'visible' }}>
            <CardContent>
                <Box display="flex" alignItems="center" justifyContent="space-between" mb={1}>
                    <Typography color="text.secondary" variant="body2" gutterBottom>
                        {title}
                    </Typography>
                    {icon && (
                        <Box
                            sx={{
                                bgcolor: `${color}15`,
                                color: color,
                                p: 1,
                                borderRadius: 1,
                                display: 'flex',
                            }}
                        >
                            {icon}
                        </Box>
                    )}
                </Box>

                <Typography variant="h4" component="div" fontWeight="bold" mb={1}>
                    {value}
                </Typography>

                {subtitle && (
                    <Typography variant="body2" color="text.secondary">
                        {subtitle}
                    </Typography>
                )}

                {trend && (
                    <Box display="flex" alignItems="center" mt={1}>
                        {trend.isPositive ? (
                            <TrendingUp fontSize="small" color="success" />
                        ) : (
                            <TrendingDown fontSize="small" color="error" />
                        )}
                        <Typography
                            variant="body2"
                            color={trend.isPositive ? 'success.main' : 'error.main'}
                            ml={0.5}
                        >
                            {Math.abs(trend.value)}% vs last period
                        </Typography>
                    </Box>
                )}

                {progress && (
                    <Box mt={2}>
                        <Box display="flex" justifyContent="space-between" mb={0.5}>
                            <Typography variant="caption" color="text.secondary">
                                {progress.value} / {progress.max}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                                {Math.round((progress.value / progress.max) * 100)}%
                            </Typography>
                        </Box>
                        <Tooltip title={`${progress.value} of ${progress.max}`}>
                            <LinearProgress
                                variant="determinate"
                                value={(progress.value / progress.max) * 100}
                                color={progress.color || 'primary'}
                                sx={{ height: 6, borderRadius: 3 }}
                            />
                        </Tooltip>
                    </Box>
                )}
            </CardContent>
        </Card>
    );
}
