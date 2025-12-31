// LiveCampaignPreview - Shows advertiser's video playing on screens

import React from 'react';
import { Box, Typography, Paper, Chip } from '@mui/material';
import PlayCircleOutlineIcon from '@mui/icons-material/PlayCircleOutline';
import type { Booking, Screen, SlotState } from '../types';
import { RotatingSlotVideo } from './RotatingSlotVideo';

interface LiveCampaignPreviewProps {
    bookings: Booking[];
    screens: Screen[];
    slots: Record<string, SlotState[]>;
    campaignName: string;
}

export const LiveCampaignPreview: React.FC<LiveCampaignPreviewProps> = ({
    bookings,
    screens,
    slots,
    campaignName,
}) => {
    // Find screens where this campaign is approved and potentially playing
    const approvedBookings = bookings.filter(b => b.status === 'approved');
    const activeScreens = screens.filter(s =>
        approvedBookings.some(b => b.screenId === s.id && s.streamActive)
    );

    if (activeScreens.length === 0) {
        return null;
    }

    return (
        <Box sx={{ mb: 3 }}>
            <Typography variant="h6" fontWeight="bold" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <PlayCircleOutlineIcon color="success" />
                Your Campaign is Live!
            </Typography>

            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {activeScreens.map((screen) => {
                    const screenSlots = slots[screen.id] || [];
                    const campaignSlot = screenSlots.find(slot =>
                        slot.campaignName === campaignName && slot.isBooked
                    );

                    return (
                        <Paper key={screen.id} variant="outlined" sx={{ p: 2 }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                                <Typography variant="subtitle2" fontWeight="bold">
                                    📺 {screen.name}
                                </Typography>
                                <Chip
                                    label="LIVE"
                                    color="success"
                                    size="small"
                                    icon={
                                        <Box
                                            sx={{
                                                width: 8,
                                                height: 8,
                                                borderRadius: '50%',
                                                bgcolor: 'white',
                                                animation: 'pulse 1.5s ease-in-out infinite',
                                                '@keyframes pulse': {
                                                    '0%, 100%': { opacity: 1 },
                                                    '50%': { opacity: 0.5 },
                                                },
                                            }}
                                        />
                                    }
                                />
                            </Box>

                            <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1 }}>
                                {screen.location}
                            </Typography>

                            {/* Show same rotating videos as screen owner */}
                            <RotatingSlotVideo slots={screenSlots} isPlaying={true} syncKey={`${screen.id}-live`} />

                            {campaignSlot && (
                                <Typography variant="caption" color="success.main" sx={{ mt: 1, display: 'block' }}>
                                    ✓ Your ad is in slot {campaignSlot.slotNumber} - playing in rotation
                                </Typography>
                            )}
                        </Paper>
                    );
                })}
            </Box>
        </Box>
    );
};
