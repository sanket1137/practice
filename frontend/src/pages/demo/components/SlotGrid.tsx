// SlotGrid Component - Compact horizontal slot display

import React from 'react';
import { Box, Typography } from '@mui/material';
import type { SlotState } from '../types';

interface SlotGridProps {
    slots: SlotState[];
}

export const SlotGrid: React.FC<SlotGridProps> = ({ slots }) => {
    return (
        <Box sx={{ mb: 2 }}>
            <Typography variant="caption" fontWeight="bold" gutterBottom display="block">
                📊 Slot Availability (1 min rotation)
            </Typography>
            <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                {slots.map((slot) => (
                    <Box
                        key={slot.slotNumber}
                        sx={{
                            width: 50,
                            height: 50,
                            border: 2,
                            borderColor: slot.isBooked ? 'success.main' : 'grey.400',
                            borderRadius: 1,
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            bgcolor: slot.isBooked ? 'success.lighter' : 'background.paper',
                            position: 'relative',
                        }}
                    >
                        <Typography
                            variant="caption"
                            fontWeight="bold"
                            sx={{ color: slot.isBooked ? 'success.dark' : 'text.primary' }}
                        >
                            {slot.slotNumber}
                        </Typography>
                        <Box
                            sx={{
                                width: 8,
                                height: 8,
                                borderRadius: '50%',
                                bgcolor: slot.isBooked ? 'success.main' : 'grey.400',
                                mt: 0.5,
                            }}
                        />
                    </Box>
                ))}
            </Box>
            <Box sx={{ display: 'flex', gap: 2, mt: 0.5 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: 'success.main' }} />
                    <Typography variant="caption" color="text.secondary">
                        Booked ({slots.filter(s => s.isBooked).length})
                    </Typography>
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: 'grey.400' }} />
                    <Typography variant="caption" color="text.secondary">
                        Empty ({slots.filter(s => !s.isBooked).length})
                    </Typography>
                </Box>
            </Box>
        </Box>
    );
};
