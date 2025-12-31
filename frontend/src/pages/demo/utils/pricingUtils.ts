// Pricing Calculation Utilities

import type { PricingConfig, SlotState } from '../types';

export const calculateBookingCost = (
    durationMinutes: number,
    slotsPerRotation: number,
    pricePerSlot: number
): {
    rotations: number;
    totalSlots: number;
    totalCost: number;
} => {
    const rotations = durationMinutes; // 1 rotation per minute
    const totalSlots = rotations * slotsPerRotation;
    const totalCost = totalSlots * pricePerSlot;

    return {
        rotations,
        totalSlots,
        totalCost,
    };
};

export const calculateRevenue = (
    slots: SlotState[],
    pricePerSlot: number
): {
    bookedSlots: number;
    emptySlots: number;
    currentRevenue: number;
    potentialRevenue: number;
    occupancyRate: number;
} => {
    const bookedSlots = slots.filter(s => s.isBooked).length;
    const emptySlots = slots.filter(s => !s.isBooked).length;
    const currentRevenue = bookedSlots * pricePerSlot;
    const potentialRevenue = slots.length * pricePerSlot;
    const occupancyRate = (bookedSlots / slots.length) * 100;

    return {
        bookedSlots,
        emptySlots,
        currentRevenue,
        potentialRevenue,
        occupancyRate,
    };
};

export const formatCurrency = (amount: number): string => {
    return `₹${amount.toLocaleString('en-IN')}`;
};

export const formatPercentage = (value: number): string => {
    return `${Math.round(value)}%`;
};

export const DEFAULT_PRICING_CONFIG: PricingConfig = {
    pricePerSlot: 100,
    slotDuration: 10,
    totalSlots: 6,
    rotationDuration: 60,
};

export const createInitialSlots = (screenId: string, totalSlots: number): SlotState[] => {
    const slots: SlotState[] = [];

    // Pre-booked slots - SEQUENTIAL for clear availability
    // Screen-1: First 3 slots booked → Last 3 available (4, 5, 6)
    // Screen-2: First 5 slots booked → Last 1 available (6)
    const preBookedSlots = screenId === 'screen-1' ? [1, 2, 3] : [1, 2, 3, 4, 5];

    // Simulated play counts for pre-booked slots
    const playCountsScreen1 = [45, 38, 52]; // For slots 1, 2, 3
    const playCountsScreen2 = [62, 58, 49, 55, 61]; // For slots 1, 2, 3, 4, 5

    const playCounts = screenId === 'screen-1' ? playCountsScreen1 : playCountsScreen2;

    // Local videos from backend - place your 5 videos (each 10 seconds) in:
    // backend/CCMS.Api/wwwroot/demo-videos/ as video1.mp4, video2.mp4, etc.
    const sampleVideos = [
        'http://localhost:5257/demo-videos/video1.mp4',
        'http://localhost:5257/demo-videos/video2.mp4',
        'http://localhost:5257/demo-videos/video3.mp4',
        'http://localhost:5257/demo-videos/video4.mp4',
        'http://localhost:5257/demo-videos/video5.mp4',
    ];

    for (let i = 1; i <= totalSlots; i++) {
        const isBooked = preBookedSlots.includes(i);
        const playCountIndex = preBookedSlots.indexOf(i);
        const videoIndex = (i - 1) % sampleVideos.length;

        // Use video3.mp4 as default for empty slots (we know it exists)
        const defaultVideo = 'http://localhost:5257/demo-videos/video3.mp4';
        const videoUrl = isBooked ? sampleVideos[videoIndex] : defaultVideo;

        slots.push({
            slotNumber: i,
            isBooked,
            bookingId: isBooked ? `pre-${screenId}-${i}` : null,
            campaignName: isBooked ? `Previous Campaign ${String.fromCharCode(64 + i)}` : 'Default Content',
            price: isBooked ? 100 : 0,
            videoUrl: videoUrl, // All slots have videos
            playCount: isBooked && playCountIndex >= 0 ? playCounts[playCountIndex] : 0,
        });
    }

    return slots;
};
