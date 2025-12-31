// Demo Page Types and Interfaces

export interface Creative {
    video: File | null;
    videoUrl: string | null;
    duration: number;
    name: string;
}

export interface Campaign {
    id: string;
    name: string;
    creative: Creative;
}

export interface Booking {
    id: string;
    campaignId: string;
    screenId: string;
    status: 'pending' | 'approved' | 'rejected' | 'expired';
    createdAt: Date;
    expiresAt: Date;
    approvedAt?: Date;
    playCount?: number;  // Track number of times this ad played
}

export interface CampaignRevenue {
    campaignName: string;
    bookingId: string;
    slotNumber: number;
    playCount: number;
    pricePerPlay: number;
    totalRevenue: number;
}

export interface Screen {
    id: string;
    name: string;
    location: string;
    status: 'idle' | 'playing';
    currentBooking: Booking | null;
    playLogs: PlayLog[];
    streamActive: boolean;
    streamStartedAt?: Date;
}

export interface PlayLog {
    id: string;
    timestamp: Date;
    type: 'ad_start' | 'ad_end' | 'stream_start' | 'stream_end';
    message: string;
}

export interface CampaignLog {
    id: string;
    timestamp: Date;
    screenId: string;
    screenName: string;
    status: 'booked' | 'approved' | 'rejected' | 'playing' | 'expired';
    message: string;
}

export interface PricingConfig {
    pricePerSlot: number;        // e.g., ₹100 per 10-sec slot
    slotDuration: number;        // 10 seconds (configurable)
    totalSlots: number;          // 6 slots per minute
    rotationDuration: number;    // 60 seconds (1 minute)
}

export interface SlotState {
    slotNumber: number;          // 1-6
    isBooked: boolean;
    bookingId: string | null;
    campaignName: string | null;
    price: number;
    videoUrl?: string | null;    // Video URL for booked slots
    playCount?: number;          // Number of times this slot's video played
}

export interface AdvertiserStats {
    bookingsCreated: number;
    bookingsApproved: number;
    bookingsRejected: number;
    totalSpent: number;
}

export interface ScreenOwnerStats {
    bookingsReceived: number;
    bookingsApproved: number;
    bookingsRejected: number;
    totalRevenue: number;
}

export interface DemoState {
    campaign: Campaign;
    screens: Screen[];
    bookings: Booking[];
    campaignLogs: CampaignLog[];
    pricingConfig: PricingConfig;
    slots: Record<string, SlotState[]>; // screenId -> slots
    advertiserStats: AdvertiserStats;
    screenOwnerStats: ScreenOwnerStats;
}
