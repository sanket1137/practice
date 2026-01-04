// CampaignCard Component (MUI Version)

import React, { useState } from 'react';
import { Box, Typography, Chip, Button, Divider, Paper } from '@mui/material';
import type { Campaign, AdvertiserStats, SlotState } from '../types';
import { VideoUploader } from './VideoUploader';
import { ScreenCardSelector } from './ScreenCardSelector';
import { PricingCalculator } from './PricingCalculator';
import { BookingCounter } from './BookingCounter';

interface CampaignCardProps {
    campaign: Campaign;
    screens: Array<{ id: string; name: string; location: string }>;
    slots: Record<string, SlotState[]>;
    pricePerSlot: number;
    advertiserStats: AdvertiserStats;
    onUploadVideo: (file: File, duration: number) => void;
    onCreateBooking: (screenId: string) => void;
}

export const CampaignCard: React.FC<CampaignCardProps> = ({
    campaign,
    screens,
    slots,
    pricePerSlot,
    advertiserStats,
    onUploadVideo,
    onCreateBooking,
}) => {
    const [selectedScreenId, setSelectedScreenId] = useState<string | null>(null);
    const [isBooking, setIsBooking] = useState(false);

    const handleBookClick = async () => {
        if (!selectedScreenId || !campaign.creative.video) return;

        setIsBooking(true);
        await new Promise(resolve => setTimeout(resolve, 500));
        onCreateBooking(selectedScreenId);
        setSelectedScreenId(null);
        setIsBooking(false);
    };

    const canBook = campaign.creative.video && selectedScreenId;

    return (
        <Paper variant="outlined" sx={{ p: 3 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                <Typography variant="h5" fontWeight="bold">
                    📊 {campaign.name}
                </Typography>
                <Chip label="Demo Campaign" color="secondary" size="small" />
            </Box>

            <Divider sx={{ my: 2 }} />

            <VideoUploader
                onUpload={onUploadVideo}
                currentVideo={campaign.creative.video ? {
                    name: campaign.creative.name,
                    duration: campaign.creative.duration,
                } : null}
            />

            <Divider sx={{ my: 2 }} />

            <Box className="create-booking-section">
                <Typography variant="h6" gutterBottom>
                    🎯 Book a Screen
                </Typography>

                <Box sx={{ mb: 2 }}>
                    <ScreenCardSelector
                        screens={screens.map(s => {
                            const screenSlots = slots[s.id] || [];
                            const availableSlots = screenSlots.filter(slot => !slot.isBooked).length;
                            return { ...s, availableSlots };
                        })}
                        selectedScreenId={selectedScreenId}
                        onChange={setSelectedScreenId}
                        disabled={!campaign.creative.video}
                    />
                </Box>

                {selectedScreenId && (
                    <Box className="slot-selector" sx={{ mb: 2 }}>
                        <PricingCalculator
                            durationMinutes={5}
                            pricePerSlot={pricePerSlot}
                        />
                    </Box>
                )}

                <Paper variant="outlined" sx={{ p: 2, mb: 2, bgcolor: 'action.hover' }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                        <Typography variant="body2" color="text.primary">
                            Booking Duration:
                        </Typography>
                        <Typography variant="body2" fontWeight="bold" color="text.primary">
                            5 minutes
                        </Typography>
                    </Box>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                        <Typography variant="body2" color="text.primary">
                            Stream Preview:
                        </Typography>
                        <Typography variant="body2" fontWeight="bold" color="text.primary">
                            1 minute
                        </Typography>
                    </Box>
                </Paper>

                <Button
                    variant="contained"
                    fullWidth
                    size="large"
                    disabled={!canBook || isBooking}
                    onClick={handleBookClick}
                >
                    {isBooking ? 'Booking...' : 'Book Now'}
                </Button>
            </Box>

            <Divider sx={{ my: 2 }} />

            <Box className="campaign-stats">
                <BookingCounter stats={advertiserStats} type="advertiser" />
            </Box>
        </Paper>
    );
};
