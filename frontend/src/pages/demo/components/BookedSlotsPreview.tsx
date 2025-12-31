// BookedSlotsPreview Component - Shows video preview for booked slots

import React from 'react';
import { Box, Typography, Paper } from '@mui/material';
import type { SlotState } from '../types';

interface BookedSlotsPreviewProps {
    slots: SlotState[];
    screenName: string;
}

export const BookedSlotsPreview: React.FC<BookedSlotsPreviewProps> = ({ slots, screenName }) => {
    const bookedSlots = slots.filter(s => s.isBooked && s.videoUrl);

    if (bookedSlots.length === 0) {
        return null;
    }

    return (
        <Box sx={{ mb: 2 }}>
            <Typography variant="caption" fontWeight="bold" gutterBottom display="block">
                📹 Pre-Booked Content Preview
            </Typography>
            <Box sx={{ display: 'flex', gap: 1, overflowX: 'auto', pb: 1 }}>
                {bookedSlots.map((slot) => (
                    <Paper
                        key={slot.slotNumber}
                        variant="outlined"
                        sx={{
                            minWidth: 80,
                            flexShrink: 0,
                            overflow: 'hidden',
                        }}
                    >
                        <Box
                            sx={{
                                position: 'relative',
                                aspectRatio: '16/9',
                                bgcolor: 'black',
                            }}
                        >
                            <video
                                src={slot.videoUrl || ''}
                                muted
                                loop
                                autoPlay
                                playsInline
                                style={{
                                    width: '100%',
                                    height: '100%',
                                    objectFit: 'cover',
                                }}
                            />
                            <Box
                                sx={{
                                    position: 'absolute',
                                    top: 2,
                                    left: 2,
                                    bgcolor: 'rgba(0,0,0,0.7)',
                                    color: 'white',
                                    px: 0.5,
                                    py: 0.25,
                                    borderRadius: 0.5,
                                    fontSize: '0.625rem',
                                }}
                            >
                                #{slot.slotNumber}
                            </Box>
                        </Box>
                    </Paper>
                ))}
            </Box>
        </Box>
    );
};
