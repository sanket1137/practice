// ScreenOwnerPanel - Right Side Component (MUI Version)

import React from 'react';
import { Box, Typography } from '@mui/material';
import type { Screen, Booking, SlotState, ScreenOwnerStats } from '../types';
import { ScreenCard } from './ScreenCard';
import { ScreenPlayLogs } from './ScreenPlayLogs';

interface ScreenOwnerPanelProps {
    screens: Screen[];
    bookings: Booking[];
    campaignName: string;
    videoUrl: string | null;
    slots: Record<string, SlotState[]>;
    pricePerSlot: number;
    screenOwnerStats: ScreenOwnerStats;
    onApprove: (bookingId: string) => void;
    onReject: (bookingId: string) => void;
    onAdStart: (screenId: string) => void;
    onIncrementPlayCount: (screenId: string, slotNumber: number) => void;
}

export const ScreenOwnerPanel: React.FC<ScreenOwnerPanelProps> = ({
    screens,
    bookings,
    campaignName,
    videoUrl,
    slots,
    pricePerSlot,
    screenOwnerStats,
    onApprove,
    onReject,
    onAdStart,
    onIncrementPlayCount,
}) => {
    return (
        <Box sx={{ p: 3, height: '100%', overflow: 'auto' }}>
            <Box sx={{ mb: 3 }}>
                <Typography variant="h4" fontWeight="bold" gutterBottom>
                    🏢 Screen Owner View
                </Typography>
                <Typography variant="body2" color="text.secondary">
                    Manage bookings and monitor screens
                </Typography>
            </Box>

            <Box sx={{ mb: 3 }}>
                {screens.map((screen) => (
                    <Box key={screen.id} sx={{ mb: 3 }}>
                        <ScreenCard
                            screen={screen}
                            bookings={bookings}
                            campaignName={campaignName}
                            videoUrl={videoUrl}
                            slots={slots[screen.id] || []}
                            pricePerSlot={pricePerSlot}
                            screenOwnerStats={screenOwnerStats}
                            onApprove={onApprove}
                            onReject={onReject}
                            onAdStart={onAdStart}
                            onIncrementPlayCount={onIncrementPlayCount}
                        />
                    </Box>
                ))}
            </Box>

            <Box>
                <Typography variant="h6" fontWeight="bold" gutterBottom>
                    📋 Screen Play Logs
                </Typography>
                <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                    {screens.map((screen) => (
                        <Box key={screen.id} sx={{ flex: '1 1 calc(50% - 8px)', minWidth: 250 }}>
                            <ScreenPlayLogs
                                logs={screen.playLogs}
                                screenName={screen.name}
                            />
                        </Box>
                    ))}
                </Box>
            </Box>
        </Box>
    );
};
