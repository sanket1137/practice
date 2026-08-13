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

// Random advertiser names for demo pre-booked slots
const advertiserNames = [
    'Nike Sports',
    'Coca-Cola',
    'Samsung Electronics',
    'Amazon Prime',
    'McDonald\'s',
    'Adidas Originals',
    'Apple Store',
    'Pepsi Max',
];

// Get consistent advertiser name based on slot number (deterministic)
const getAdvertiserName = (slotNumber: number): string => {
    return advertiserNames[(slotNumber - 1) % advertiserNames.length];
};

// Get specific video URL for each slot based on screen
const getVideoForSlot = (screenId: string, slotNumber: number): string => {
    const baseUrl = '/demo-videos';

    if (screenId === 'screen-1') {
        // Bandra-Worli: video1, video2, video3, then Default_Vid
        switch (slotNumber) {
            case 1: return `${baseUrl}/video1.mp4`;
            case 2: return `${baseUrl}/video2.mp4`;
            case 3: return `${baseUrl}/video3.mp4`;
            default: return `${baseUrl}/Default_Vid.mp4`;
        }
    } else if (screenId === 'screen-2') {
        // MG Road: video7, video6, video5, video4, video3, then Default_Vid
        switch (slotNumber) {
            case 1: return `${baseUrl}/video7.mp4`;
            case 2: return `${baseUrl}/video6.mp4`;
            case 3: return `${baseUrl}/video5.mp4`;
            case 4: return `${baseUrl}/video4.mp4`;
            case 5: return `${baseUrl}/video3.mp4`;
            default: return `${baseUrl}/Default_Vid.mp4`;
        }
    }

    return `${baseUrl}/Default_Vid.mp4`;
};

export const DEFAULT_PRICING_CONFIG: PricingConfig = {
    pricePerSlot: 100,
    slotDuration: 10,
    totalSlots: 6,
    rotationDuration: 60,
};

export const createInitialSlots = (screenId: string, totalSlots: number = 6): SlotState[] => {
    const slots: SlotState[] = [];

    // Pre-booked slots - SEQUENTIAL for clear availability
    // Screen-1: First 3 slots booked → Last 3 available (4, 5, 6)
    // Screen-2: First 5 slots booked → Last 1 available (6)
    const preBookedSlots = screenId === 'screen-1' ? [1, 2, 3] : [1, 2, 3, 4, 5];

    // Play counts start from 0
    const playCounts = Array(preBookedSlots.length).fill(0);

    for (let i = 1; i <= totalSlots; i++) {
        const isBooked = preBookedSlots.includes(i);
        const playCountIndex = preBookedSlots.indexOf(i);
        const videoUrl = getVideoForSlot(screenId, i);

        slots.push({
            slotNumber: i,
            isBooked,
            bookingId: isBooked ? `pre-${screenId}-${i}` : null,
            campaignName: isBooked ? getAdvertiserName(i) : 'Default Content',
            price: isBooked ? 100 : 0,
            videoUrl: videoUrl,
            playCount: isBooked && playCountIndex >= 0 ? playCounts[playCountIndex] : 0,
        });
    }

    return slots;
};
