// PricingCalculator Component - Shows booking cost breakdown

import React from 'react';
import { Box, Typography, Paper, Divider } from '@mui/material';
import { calculateBookingCost, formatCurrency } from '../utils/pricingUtils';

interface PricingCalculatorProps {
    durationMinutes: number;
    pricePerSlot: number;
}

export const PricingCalculator: React.FC<PricingCalculatorProps> = ({
    durationMinutes,
    pricePerSlot,
}) => {
    const { rotations, totalSlots, totalCost } = calculateBookingCost(
        durationMinutes,
        1, // 1 slot per rotation
        pricePerSlot
    );

    return (
        <Paper variant="outlined" sx={{ p: 2, bgcolor: 'primary.lighter' }}>
            <Typography variant="subtitle2" fontWeight="bold" gutterBottom>
                💰 Pricing Breakdown
            </Typography>

            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, my: 1 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Typography variant="body2" color="text.primary">
                        Rotations:
                    </Typography>
                    <Typography variant="body2" fontWeight="medium" color="text.primary">
                        {rotations}
                    </Typography>
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Typography variant="body2" color="text.primary">
                        Slots/rotation:
                    </Typography>
                    <Typography variant="body2" fontWeight="medium" color="text.primary">
                        1
                    </Typography>
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Typography variant="body2" color="text.primary">
                        Total slots:
                    </Typography>
                    <Typography variant="body2" fontWeight="medium" color="text.primary">
                        {totalSlots}
                    </Typography>
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Typography variant="body2" color="text.primary">
                        Price/slot:
                    </Typography>
                    <Typography variant="body2" fontWeight="medium" color="text.primary">
                        {formatCurrency(pricePerSlot)}
                    </Typography>
                </Box>
            </Box>

            <Divider sx={{ my: 1 }} />

            <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 1 }}>
                <Typography variant="subtitle1" fontWeight="bold" color="primary.dark">
                    TOTAL COST:
                </Typography>
                <Typography variant="subtitle1" fontWeight="bold" color="primary.dark">
                    {formatCurrency(totalCost)}
                </Typography>
            </Box>
        </Paper>
    );
};
