// CampaignRevenueBreakdown Component - Shows revenue per campaign for screen owners

import React from 'react';
import { Box, Typography, Paper, LinearProgress } from '@mui/material';
import type { SlotState } from '../types';

interface CampaignRevenueBreakdownProps {
    screenName: string;
    slots: SlotState[];
    pricePerPlay: number;
}

export const CampaignRevenueBreakdown: React.FC<CampaignRevenueBreakdownProps> = ({
    slots,
    pricePerPlay = 10,
}) => {
    const bookedSlots = slots.filter(s => s.isBooked);

    if (bookedSlots.length === 0) {
        return null;
    }

    const totalPlays = bookedSlots.reduce((sum, slot) => sum + (slot.playCount || 0), 0);
    const totalRevenue = bookedSlots.reduce((sum, slot) => sum + (slot.playCount || 0) * pricePerPlay, 0);

    return (
        <Box sx={{ mb: 2 }}>
            <Typography variant="subtitle2" fontWeight="bold" gutterBottom>
                💰 Revenue by Campaign
            </Typography>

            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                {bookedSlots.map((slot) => {
                    const playCount = slot.playCount || 0;
                    const revenue = playCount * pricePerPlay;
                    const estimatedPlays = 100; // Assume 100 plays as estimate
                    const progress = Math.min((playCount / estimatedPlays) * 100, 100);

                    return (
                        <Paper key={slot.slotNumber} variant="outlined" sx={{ p: 1.5 }}>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.5 }}>
                                <Typography variant="body2" fontWeight="bold">
                                    {slot.campaignName} (Slot {slot.slotNumber})
                                </Typography>
                                <Typography variant="body2" color="success.main" fontWeight="bold">
                                    ₹{revenue}
                                </Typography>
                            </Box>

                            <Box sx={{ mb: 0.5 }}>
                                <LinearProgress
                                    variant="determinate"
                                    value={progress}
                                    sx={{
                                        height: 6,
                                        borderRadius: 1,
                                        bgcolor: 'grey.200',
                                        '& .MuiLinearProgress-bar': {
                                            bgcolor: 'success.main',
                                        },
                                    }}
                                />
                            </Box>

                            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                                <Typography variant="caption" color="text.secondary">
                                    Plays: {playCount}/{estimatedPlays}
                                </Typography>
                                <Typography variant="caption" color="text.secondary">
                                    {Math.round(progress)}%
                                </Typography>
                            </Box>
                        </Paper>
                    );
                })}
            </Box>

            <Box sx={{ mt: 2, p: 1.5, bgcolor: 'success.lighter', borderRadius: 1 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Typography variant="body2" fontWeight="bold">
                        Total Revenue:
                    </Typography>
                    <Typography variant="body2" fontWeight="bold" color="success.dark">
                        ₹{totalRevenue}
                    </Typography>
                </Box>
                <Typography variant="caption" color="text.secondary">
                    From {totalPlays} total plays
                </Typography>
            </Box>
        </Box>
    );
};
