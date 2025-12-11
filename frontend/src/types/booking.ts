// Booking Date Breakdown Types
export interface BookingDateBreakdown {
    requestedDates: string[];
    availableDates: string[];
    unavailableDates: string[];
    totalRequested: number;
    totalAvailable: number;
    totalUnavailable: number;
    isPartialBooking: boolean;
}

// Updated Booking DTO with partial booking support
export interface Booking {
    id: string;
    screenId: string;
    screenName: string;
    campaignId: string;
    campaignName: string;
    creativeId: string;
    creativeName: string;
    creativeFileUrl?: string;
    creativeMimeType?: string;
    startDate: string;
    endDate: string;
    slotNumbers: number[];
    status: string;
    rejectionReason?: string;
    expectedImpressions: number;
    deliveredImpressions: number;
    totalPrice: number;
    currency: string;
    createdAt: string;
    approvedAt?: string;
    // NEW: Partial booking fields
    bookedDates?: string[];
    dateBreakdown?: BookingDateBreakdown;
}

// API Response type for availability check
export interface AvailabilityCheckResponse {
    success: boolean;
    data: BookingDateBreakdown;
    message?: string;
}
