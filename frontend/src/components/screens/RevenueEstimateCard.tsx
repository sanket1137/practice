import React from 'react';
import {
    Card,
    CardContent,
    Typography,
    Grid,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Paper,
    Box,
    Chip,
} from '@mui/material';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';

interface DayBreakdown {
    isOperating: boolean;
    operatingHours: string;    // "09:00–22:00" or "Closed"
    operatingHoursDecimal: number;
    framesPerDay: number;
    totalSlotPlays: number;
    revenue: number;
}

interface RevenueEstimate {
    perFrame: number;
    perHour: number;
    daily?: Record<string, number>;           // legacy
    dailyBreakdown?: Record<string, DayBreakdown>;
    weekly: number;
    monthly: number;
    slotDurationSeconds?: number;
    totalWeeklySlotPlays?: number;
    perMinute?: number; // Deprecated
}

interface RevenueEstimateCardProps {
    estimate: RevenueEstimate;
    currency?: string;
}

const RevenueEstimateCard: React.FC<RevenueEstimateCardProps> = ({
    estimate,
    currency = 'INR',
}) => {
    const formatCurrency = (amount: number) => {
        return `${currency} ${Math.round(amount).toLocaleString()}`;
    };

    const daysOfWeek = [
        'monday',
        'tuesday',
        'wednesday',
        'thursday',
        'friday',
        'saturday',
        'sunday',
    ];

    const hasBreakdown = estimate.dailyBreakdown && Object.keys(estimate.dailyBreakdown).length > 0;

    return (
        <Card sx={{ mt: 3 }}>
            <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                    <TrendingUpIcon sx={{ mr: 1, color: 'success.main' }} />
                    <Typography variant="h6">
                        Estimated Revenue (If All Slots Sold)
                    </Typography>
                </Box>

                {/* Revenue Summary Cards */}
                <Grid container spacing={2} sx={{ mb: 3 }}>
                    <Grid
                        size={{
                            xs: 6,
                            sm: 3
                        }}>
                        <Paper sx={{ p: 2, textAlign: 'center', bgcolor: 'info.lighter' }}>
                            <Typography variant="caption" color="textSecondary">
                                Per Cycle
                            </Typography>
                            <Typography variant="h6" fontWeight="bold">
                                {formatCurrency(estimate.perFrame)}
                            </Typography>
                        </Paper>
                    </Grid>

                    <Grid
                        size={{
                            xs: 6,
                            sm: 3
                        }}>
                        <Paper sx={{ p: 2, textAlign: 'center', bgcolor: 'info.lighter' }}>
                            <Typography variant="caption" color="textSecondary">
                                Per Hour
                            </Typography>
                            <Typography variant="h6" fontWeight="bold">
                                {formatCurrency(estimate.perHour)}
                            </Typography>
                        </Paper>
                    </Grid>

                    <Grid
                        size={{
                            xs: 6,
                            sm: 3
                        }}>
                        <Paper
                            sx={{ p: 2, textAlign: 'center', bgcolor: 'success.lighter' }}
                        >
                            <Typography variant="caption" color="textSecondary">
                                Weekly
                            </Typography>
                            <Typography variant="h6" fontWeight="bold" color="success.dark">
                                {formatCurrency(estimate.weekly)}
                            </Typography>
                        </Paper>
                    </Grid>

                    <Grid
                        size={{
                            xs: 6,
                            sm: 3
                        }}>
                        <Paper
                            sx={{ p: 2, textAlign: 'center', bgcolor: 'success.lighter' }}
                        >
                            <Typography variant="caption" color="textSecondary">
                                Monthly
                            </Typography>
                            <Typography variant="h6" fontWeight="bold" color="success.dark">
                                {formatCurrency(estimate.monthly)}
                            </Typography>
                        </Paper>
                    </Grid>
                </Grid>

                {/* Slot config summary */}
                {(estimate.slotDurationSeconds != null || estimate.totalWeeklySlotPlays != null) && (
                    <Box sx={{ mb: 2, display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                        {estimate.slotDurationSeconds != null && (
                            <Chip
                                label={`Slot duration: ${estimate.slotDurationSeconds}s`}
                                size="small"
                                variant="outlined"
                                color="primary"
                            />
                        )}
                        {estimate.totalWeeklySlotPlays != null && (
                            <Chip
                                label={`Weekly slot plays: ${estimate.totalWeeklySlotPlays.toLocaleString()}`}
                                size="small"
                                variant="outlined"
                                color="secondary"
                            />
                        )}
                    </Box>
                )}

                {/* Daily Breakdown Table */}
                <Typography variant="subtitle2" gutterBottom>
                    Daily Breakdown
                </Typography>
                <TableContainer>
                    <Table size="small">
                        <TableHead>
                            <TableRow>
                                <TableCell>Day</TableCell>
                                {hasBreakdown && <TableCell align="center">Hours</TableCell>}
                                {hasBreakdown && <TableCell align="right">Frames</TableCell>}
                                {hasBreakdown && <TableCell align="right">Slot Plays</TableCell>}
                                <TableCell align="right">Revenue</TableCell>
                                <TableCell align="center">Status</TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {daysOfWeek.map((day) => {
                                const breakdown = hasBreakdown ? estimate.dailyBreakdown![day] : null;
                                const revenue = breakdown
                                    ? breakdown.revenue
                                    : (estimate.daily?.[day] ?? 0);
                                const isOperating = breakdown ? breakdown.isOperating : revenue > 0;

                                return (
                                    <TableRow key={day}>
                                        <TableCell>
                                            <Typography
                                                variant="body2"
                                                sx={{ textTransform: 'capitalize' }}
                                            >
                                                {day}
                                            </Typography>
                                        </TableCell>
                                        {hasBreakdown && (
                                            <TableCell align="center">
                                                <Typography variant="body2">
                                                    {breakdown?.isOperating ? breakdown.operatingHours : '—'}
                                                </Typography>
                                            </TableCell>
                                        )}
                                        {hasBreakdown && (
                                            <TableCell align="right">
                                                <Typography variant="body2">
                                                    {breakdown?.isOperating ? breakdown.framesPerDay.toLocaleString() : '—'}
                                                </Typography>
                                            </TableCell>
                                        )}
                                        {hasBreakdown && (
                                            <TableCell align="right">
                                                <Typography variant="body2" fontWeight={isOperating ? 'medium' : 'regular'}>
                                                    {breakdown?.isOperating ? breakdown.totalSlotPlays.toLocaleString() : '—'}
                                                </Typography>
                                            </TableCell>
                                        )}
                                        <TableCell align="right">
                                            <Typography
                                                variant="body2"
                                                fontWeight={isOperating ? 'medium' : 'regular'}
                                            >
                                                {formatCurrency(revenue)}
                                            </Typography>
                                        </TableCell>
                                        <TableCell align="center">
                                            {isOperating ? (
                                                <Chip
                                                    label="Operating"
                                                    size="small"
                                                    color="success"
                                                    variant="outlined"
                                                />
                                            ) : (
                                                <Chip
                                                    label="Closed"
                                                    size="small"
                                                    color="default"
                                                    variant="outlined"
                                                />
                                            )}
                                        </TableCell>
                                    </TableRow>
                                );
                            })}
                        </TableBody>
                    </Table>
                </TableContainer>
            </CardContent>
        </Card>
    );
};

export default RevenueEstimateCard;
