// Debug component to show slot configuration
import React from 'react';
import { Box, Typography, Paper } from '@mui/material';
import type { SlotState } from '../types';

interface DebugSlotsProps {
    screenId: string;
    slots: SlotState[];
}

export const DebugSlots: React.FC<DebugSlotsProps> = ({ screenId, slots }) => {
    return (
        <Paper sx={{ p: 2, mb: 2, bgcolor: 'info.lighter' }}>
            <Typography variant="subtitle2" fontWeight="bold" gutterBottom>
                🐛 Debug: {screenId} Slots
            </Typography>
            {slots.map((slot) => (
                <Box key={slot.slotNumber} sx={{ fontSize: '0.75rem', fontFamily: 'monospace' }}>
                    Slot {slot.slotNumber}:
                    {slot.isBooked ? ' ✅ BOOKED' : ' ⚪ EMPTY'} |
                    Video: {slot.videoUrl ? ' ✅ HAS URL' : ' ❌ NO URL'} |
                    {slot.videoUrl && ` ${slot.videoUrl.split('/').pop()}`}
                </Box>
            ))}
        </Paper>
    );
};
