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

interface RevenueEstimate {
    perFrame: number;  // Revenue per complete time frame cycle
    perHour: number;
    daily: Record<string, number>;
    weekly: number;
    monthly: number;
    perMinute?: number; // Deprecated, kept for backward compatibility
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

    return (
        <Card sx={{ mt: 3 }}>
            <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                    <TrendingUpIcon sx={{ mr: 1, color: 'success.main' }} />
                    <Typography variant="h6">
                        💰 Estimated Revenue (If All Slots Sold)
                    </Typography>
                </Box>

                {/* Revenue Summary Cards */}
                <Grid container spacing={2} sx={{ mb: 3 }}>
                    <Grid item xs={6} sm={3}>
                        <Paper sx={{ p: 2, textAlign: 'center', bgcolor: 'info.lighter' }}>
                            <Typography variant="caption" color="textSecondary">
                                Per Frame
                            </Typography>
                            <Typography variant="h6" fontWeight="bold">
                                {formatCurrency(estimate.perFrame)}
                            </Typography>
                        </Paper>
                    </Grid>

                    <Grid item xs={6} sm={3}>
                        <Paper sx={{ p: 2, textAlign: 'center', bgcolor: 'info.lighter' }}>
                            <Typography variant="caption" color="textSecondary">
                                Per Hour
                            </Typography>
                            <Typography variant="h6" fontWeight="bold">
                                {formatCurrency(estimate.perHour)}
                            </Typography>
                        </Paper>
                    </Grid>

                    <Grid item xs={6} sm={3}>
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

                    <Grid item xs={6} sm={3}>
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

                {/* Daily Breakdown Table */}
                <Typography variant="subtitle2" gutterBottom>
                    Daily Breakdown
                </Typography>
                <TableContainer>
                    <Table size="small">
                        <TableHead>
                            <TableRow>
                                <TableCell>Day</TableCell>
                                <TableCell align="right">Revenue</TableCell>
                                <TableCell align="center">Status</TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {daysOfWeek.map((day) => {
                                const revenue = estimate.daily[day];
                                const isOperating = revenue > 0;

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
