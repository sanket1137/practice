// AdvertiserPanel - Left Side Component (MUI Version)

import React from 'react';
import { Box, Typography } from '@mui/material';
import type { Campaign, AdvertiserStats, Booking, Screen } from '../types';
import { CampaignCard } from './CampaignCard';
import { CampaignLogs } from './CampaignLogs';
import { LiveCampaignPreview } from './LiveCampaignPreview';
import { BookingHistory } from './BookingHistory';

interface AdvertiserPanelProps {
    campaign: Campaign;
    screens: Array<{ id: string; name: string; location: string }>;
    campaignLogs: Array<any>;
    pricePerSlot: number;
    advertiserStats: AdvertiserStats;
    bookings: Booking[];
    fullScreens: Screen[];
    slots: Record<string, any[]>;
    onUploadVideo: (file: File, duration: number) => void;
    onCreateBooking: (screenId: string) => void;
}

export const AdvertiserPanel: React.FC<AdvertiserPanelProps> = ({
    campaign,
    screens,
    campaignLogs,
    pricePerSlot,
    advertiserStats,
    bookings,
    fullScreens,
    slots,
    onUploadVideo,
    onCreateBooking,
}) => {
    return (
        <Box sx={{ p: 3, height: '100%', overflow: 'auto' }}>
            <Box sx={{ mb: 3 }}>
                <Typography variant="h4" fontWeight="bold" gutterBottom>
                    👨‍💼 Advertiser View
                </Typography>
                <Typography variant="body2" color="text.secondary">
                    Upload your creative and book screens
                </Typography>
            </Box>

            <CampaignCard
                campaign={campaign}
                screens={screens}
                slots={slots}
                pricePerSlot={pricePerSlot}
                advertiserStats={advertiserStats}
                onUploadVideo={onUploadVideo}
                onCreateBooking={onCreateBooking}
            />

            <Box sx={{ mt: 3 }}>
                <LiveCampaignPreview
                    bookings={bookings}
                    screens={fullScreens}
                    slots={slots}
                    campaignName={campaign.name}
                />
            </Box>

            <Box sx={{ mt: 3 }}>
                <BookingHistory
                    bookings={bookings}
                    screens={fullScreens}
                    pricePerPlay={10}
                />
            </Box>

            <Box sx={{ mt: 3 }}>
                <CampaignLogs logs={campaignLogs} />
            </Box>
        </Box>
    );
};
