// ScreenCard Component (MUI Version)

import React, { useEffect } from 'react';
import { Box, Typography, Paper, Chip, Alert, Divider } from '@mui/material';
import type { Screen, Booking, SlotState, ScreenOwnerStats } from '../types';
import { RotatingSlotVideo } from './RotatingSlotVideo';
import { BookingItem } from './BookingItem';
import { SlotGrid } from './SlotGrid';
import { RevenueEstimator } from './RevenueEstimator';
import { BookingCounter } from './BookingCounter';
import { BookedSlotsPreview } from './BookedSlotsPreview';
import { CampaignRevenueBreakdown } from './CampaignRevenueBreakdown';
import { DebugSlots } from './DebugSlots';

interface ScreenCardProps {
    screen: Screen;
    bookings: Booking[];
    campaignName: string;
    videoUrl: string | null;
    slots: SlotState[];
    pricePerSlot: number;
    screenOwnerStats: ScreenOwnerStats;
    onApprove: (bookingId: string) => void;
    onReject: (bookingId: string) => void;
    onAdStart: (screenId: string) => void;
    onIncrementPlayCount: (screenId: string, slotNumber: number) => void;
}

export const ScreenCard: React.FC<ScreenCardProps> = ({
    screen,
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
    const pendingBookings = bookings.filter(b => b.screenId === screen.id && b.status === 'pending');

    useEffect(() => {
        if (screen.streamActive && screen.streamStartedAt) {
            onAdStart(screen.id);
        }
    }, [screen.streamActive, screen.streamStartedAt, screen.id, onAdStart]);

    const getStatusChip = () => {
        if (screen.streamActive) {
            return <Chip label="🔴 Playing" color="success" />;
        }
        if (pendingBookings.length > 0) {
            return <Chip label="⏳ Pending" color="warning" />;
        }
        return <Chip label="💤 Idle" color="default" />;
    };

    return (
        <Paper variant="outlined" sx={{ p: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                <Box>
                    <Typography variant="h6" fontWeight="bold">
                        📺 {screen.name}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                        {screen.location}
                    </Typography>
                </Box>
                {getStatusChip()}
            </Box>

            <Box sx={{ mb: 2 }}>
                <RotatingSlotVideo
                    slots={slots}
                    isPlaying={true}
                    syncKey={screen.id}
                    onPlayComplete={(slotNumber) => onIncrementPlayCount(screen.id, slotNumber)}
                />
            </Box>

            <Box sx={{ mb: 2 }}>
                <SlotGrid slots={slots} />
            </Box>

            <Box sx={{ mb: 2 }}>
                <CampaignRevenueBreakdown
                    screenName={screen.name}
                    slots={slots}
                    pricePerPlay={10}
                />
            </Box>

            <Box sx={{ mb: 2 }}>
                <BookedSlotsPreview slots={slots} screenName={screen.name} />
            </Box>

            <Box sx={{ mb: 2 }}>
                <RevenueEstimator
                    screenName={screen.name}
                    slots={slots}
                    pricePerSlot={pricePerSlot}
                />
            </Box>

            <Box>
                <Typography variant="subtitle2" fontWeight="bold" gutterBottom>
                    Booking Queue ({pendingBookings.length})
                </Typography>

                {pendingBookings.length === 0 ? (
                    <Paper variant="outlined" sx={{ p: 2, textAlign: 'center', bgcolor: 'grey.50' }}>
                        <Typography variant="body2" color="text.secondary">
                            No pending bookings
                        </Typography>
                    </Paper>
                ) : (
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                        {pendingBookings.map((booking) => (
                            <BookingItem
                                key={booking.id}
                                booking={booking}
                                campaignName={campaignName}
                                onApprove={onApprove}
                                onReject={onReject}
                            />
                        ))}
                    </Box>
                )}
            </Box>

            {screen.streamActive && (
                <Alert severity="info" sx={{ mt: 2 }}>
                    ⏱️ Stream will stop automatically after 1 minute
                </Alert>
            )}
        </Paper>
    );
};
