// RotatingSlotVideo Component - Cycles through booked slot videos

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Box, Typography, Chip } from '@mui/material';
import type { SlotState } from '../types';

interface RotatingSlotVideoProps {
    slots: SlotState[];
    isPlaying?: boolean;
    syncKey?: string;  // Use same key to sync rotation across multiple instances
    onPlayComplete?: (slotNumber: number) => void;  // Called when a slot completes playing
}

export const RotatingSlotVideo: React.FC<RotatingSlotVideoProps> = ({
    slots,
    isPlaying = true,
    syncKey = 'default',
    onPlayComplete,
}) => {
    // Memoize all slots with videos (includes both booked and empty with default video)
    const bookedSlots = useMemo(() => {
        const filtered = slots.filter(s => s.videoUrl);
        console.log(`[${syncKey}] Total slots: ${slots.length}, With videos: ${filtered.length}`, filtered.map(s => ({ slot: s.slotNumber, video: s.videoUrl?.split('/').pop() })));
        return filtered;
    }, [slots, syncKey]);

    const [currentIndex, setCurrentIndex] = useState(0);
    const lastReportedIndexRef = useRef(-1);

    useEffect(() => {
        if (!isPlaying || bookedSlots.length === 0) return;

        // Add a deterministic random offset based on syncKey so screens don't rotate in perfect sync
        const hashCode = syncKey.split('').reduce((acc, char) => {
            return char.charCodeAt(0) + ((acc << 5) - acc);
        }, 0);
        const randomOffset = Math.abs(hashCode % 5000); // 0-5 second offset per screen

        const startTime = Date.now() + randomOffset;
        const rotationDuration = 10000; // 10 seconds per slot

        const updateIndex = () => {
            const elapsed = Date.now() - startTime;

            // Still in offset period
            if (elapsed < 0) {
                return;
            }

            const newIndex = Math.floor(elapsed / rotationDuration) % bookedSlots.length;

            // Only call onPlayComplete when we move to a different slot
            if (newIndex !== lastReportedIndexRef.current) {
                // Report completion of the PREVIOUS slot (not the current one)
                if (lastReportedIndexRef.current !== -1 && onPlayComplete) {
                    const completedSlot = bookedSlots[lastReportedIndexRef.current];
                    if (completedSlot) {
                        onPlayComplete(completedSlot.slotNumber);
                    }
                }
                lastReportedIndexRef.current = newIndex;
            }

            setCurrentIndex(newIndex);
        };

        // Update immediately
        updateIndex();

        // Update every 100ms to stay in sync
        const interval = setInterval(updateIndex, 100);

        return () => {
            clearInterval(interval);
        };
    }, [isPlaying, bookedSlots, syncKey, onPlayComplete]);

    if (bookedSlots.length === 0) {
        return (
            <Box
                sx={{
                    aspectRatio: '16/9',
                    bgcolor: 'grey.900',
                    borderRadius: 1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'grey.500',
                }}
            >
                <Box sx={{ textAlign: 'center' }}>
                    <Typography variant="h6">📺</Typography>
                    <Typography variant="body2">No booked content</Typography>
                </Box>
            </Box>
        );
    }

    const currentSlot = bookedSlots[currentIndex];

    return (
        <Box sx={{ position: 'relative', aspectRatio: '16/9', bgcolor: 'black', borderRadius: 1, overflow: 'hidden' }}>
            <video
                key={currentSlot.videoUrl}
                src={currentSlot.videoUrl || ''}
                autoPlay
                muted
                loop
                playsInline
                style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'contain',
                }}
            />

            <Chip
                label={`Slot ${currentSlot.slotNumber} - ${currentSlot.campaignName}`}
                size="small"
                sx={{
                    position: 'absolute',
                    top: 8,
                    left: 8,
                    bgcolor: 'rgba(0,0,0,0.7)',
                    color: 'white',
                }}
            />

            {bookedSlots.length > 1 && (
                <Chip
                    label={`${currentIndex + 1}/${bookedSlots.length}`}
                    size="small"
                    sx={{
                        position: 'absolute',
                        top: 8,
                        right: 8,
                        bgcolor: 'rgba(0,0,0,0.7)',
                        color: 'white',
                    }}
                />
            )}

            <Box
                sx={{
                    position: 'absolute',
                    bottom: 8,
                    left: 8,
                    right: 8,
                    display: 'flex',
                    gap: 0.5,
                }}
            >
                {bookedSlots.map((_, index) => (
                    <Box
                        key={index}
                        sx={{
                            flex: 1,
                            height: 3,
                            bgcolor: index === currentIndex ? 'primary.main' : 'rgba(255,255,255,0.3)',
                            borderRadius: 1,
                            transition: 'background-color 0.3s',
                        }}
                    />
                ))}
            </Box>
        </Box>
    );
};
