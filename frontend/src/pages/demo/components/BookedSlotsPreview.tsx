// BookedSlotsPreview Component - Shows video preview for booked slots

import React from 'react';
import { Box, Typography, Paper } from '@mui/material';
import type { SlotState } from '../types';

interface BookedSlotsPreviewProps {
    slots: SlotState[];
    screenName: string;
}

export const BookedSlotsPreview: React.FC<BookedSlotsPreviewProps> = ({ slots }) => {
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
                            // minWidth: 80, // Removed as per instruction's implied structure
                            // flexShrink: 0, // Removed as per instruction's implied structure
                            overflow: 'hidden',
                            p: 0, // Add padding 0 to Paper to ensure inner Box controls spacing
                        }}
                    >
                        <Box
                            sx={{
                                position: 'relative',
                                width: '80px',
                                flexShrink: 0,
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
                                    height: '60px',
                                    objectFit: 'cover',
                                    borderRadius: '4px',
                                }}
                            />
                            <Box
                                sx={{
                                    position: 'absolute',
                                    bottom: 2,
                                    right: 2,
                                    bgcolor: 'success.main',
                                    color: 'white',
                                    px: 0.5,
                                    py: 0.25,
                                    borderRadius: 0.5,
                                    fontSize: '0.625rem',
                                    fontWeight: 'bold',
                                }}
                            >
                                {slot.slotNumber}
                            </Box>
                        </Box>
                    </Paper>
                ))}
            </Box>
        </Box>
    );
};
