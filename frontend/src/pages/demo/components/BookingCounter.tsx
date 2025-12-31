// BookingCounter Component - Stats display for advertisers and screen owners

import React from 'react';
import { Box, Typography, Paper } from '@mui/material';
import type { AdvertiserStats, ScreenOwnerStats } from '../types';
import { formatCurrency } from '../utils/pricingUtils';

interface BookingCounterProps {
    stats: AdvertiserStats | ScreenOwnerStats;
    type: 'advertiser' | 'screenOwner';
}

export const BookingCounter: React.FC<BookingCounterProps> = ({ stats, type }) => {
    if (type === 'advertiser') {
        const advStats = stats as AdvertiserStats;
        return (
            <Paper variant="outlined" sx={{ p: 2, bgcolor: 'action.hover' }}>
                <Typography variant="subtitle2" fontWeight="bold" gutterBottom>
                    📊 Your Stats
                </Typography>
                <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', mt: 1 }}>
                    <Box>
                        <Typography variant="caption" color="text.secondary" display="block">
                            Bookings
                        </Typography>
                        <Typography variant="h6" fontWeight="bold">
                            {advStats.bookingsCreated}
                        </Typography>
                    </Box>
                    <Box>
                        <Typography variant="caption" color="text.secondary" display="block">
                            Approved
                        </Typography>
                        <Typography variant="h6" fontWeight="bold" color="success.main">
                            {advStats.bookingsApproved}
                        </Typography>
                    </Box>
                    <Box>
                        <Typography variant="caption" color="text.secondary" display="block">
                            Total Spent
                        </Typography>
                        <Typography variant="h6" fontWeight="bold" color="primary.main">
                            {formatCurrency(advStats.totalSpent)}
                        </Typography>
                    </Box>
                </Box>
            </Paper>
        );
    }

    const ownerStats = stats as ScreenOwnerStats;
    return (
        <Paper variant="outlined" sx={{ p: 2, bgcolor: 'action.hover' }}>
            <Typography variant="subtitle2" fontWeight="bold" gutterBottom>
                📊 Your Stats
            </Typography>
            <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', mt: 1 }}>
                <Box>
                    <Typography variant="caption" color="text.secondary" display="block">
                        Received
                    </Typography>
                    <Typography variant="h6" fontWeight="bold">
                        {ownerStats.bookingsReceived}
                    </Typography>
                </Box>
                <Box>
                    <Typography variant="caption" color="text.secondary" display="block">
                        Approved
                    </Typography>
                    <Typography variant="h6" fontWeight="bold" color="success.main">
                        {ownerStats.bookingsApproved}
                    </Typography>
                </Box>
                <Box>
                    <Typography variant="caption" color="text.secondary" display="block">
                        Revenue
                    </Typography>
                    <Typography variant="h6" fontWeight="bold" color="primary.main">
                        {formatCurrency(ownerStats.totalRevenue)}
                    </Typography>
                </Box>
            </Box>
        </Paper>
    );
};
