// RevenueEstimator Component - Revenue calculations for screen owners

import React from 'react';
import { Box, Typography, Paper, LinearProgress } from '@mui/material';
import type { SlotState } from '../types';
import { calculateRevenue, formatCurrency, formatPercentage } from '../utils/pricingUtils';

interface RevenueEstimatorProps {
    screenName: string;
    slots: SlotState[];
    pricePerSlot: number;
}

export const RevenueEstimator: React.FC<RevenueEstimatorProps> = ({
    screenName,
    slots,
    pricePerSlot,
}) => {
    const { bookedSlots, currentRevenue, potentialRevenue, occupancyRate } = calculateRevenue(
        slots,
        pricePerSlot
    );

    return (
        <Paper variant="outlined" sx={{ p: 2, bgcolor: 'success.lighter' }}>
            <Typography variant="subtitle2" fontWeight="bold" gutterBottom>
                💰 Revenue
            </Typography>

            <Box sx={{ mb: 2 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                    <Typography variant="caption" color="text.secondary">
                        Booked Slots:
                    </Typography>
                    <Typography variant="caption" fontWeight="bold">
                        {bookedSlots}/{slots.length}
                    </Typography>
                </Box>
                <LinearProgress
                    variant="determinate"
                    value={occupancyRate}
                    sx={{
                        height: 8,
                        borderRadius: 1,
                        bgcolor: 'grey.300',
                        '& .MuiLinearProgress-bar': {
                            bgcolor: 'success.main',
                        },
                    }}
                />
                <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                    Occupancy: {formatPercentage(occupancyRate)}
                </Typography>
            </Box>

            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Typography variant="body2" color="text.primary">
                        Current:
                    </Typography>
                    <Typography variant="body2" fontWeight="bold" color="success.dark">
                        {formatCurrency(currentRevenue)}
                    </Typography>
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Typography variant="body2" color="text.primary">
                        Potential:
                    </Typography>
                    <Typography variant="body2" fontWeight="bold" color="text.secondary">
                        {formatCurrency(potentialRevenue)}
                    </Typography>
                </Box>
            </Box>
        </Paper>
    );
};
