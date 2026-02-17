import api from './api';

/**
 * Pagination parameters for API requests
 */
export interface PaginationParams {
    page?: number;
    pageSize?: number;
    search?: string;
    sortBy?: string;
    sortDirection?: 'asc' | 'desc';
    status?: string;
}

/**
 * Paginated response from API
 */
export interface PagedResponse<T> {
    items: T[];
    totalCount: number;
    pageNumber: number;
    pageSize: number;
    totalPages: number;
    hasPreviousPage: boolean;
    hasNextPage: boolean;
}

/**
 * API response wrapper
 */
export interface ApiResponse<T> {
    success: boolean;
    message: string;
    data: T;
    errors: string[];
}

// ============ SCREENS ============

export interface ScreenDto {
    id: string;
    name: string;
    description: string;
    status: string;
    resolutionWidth: number;
    resolutionHeight: number;
    pricePerSlot: number;
    currency: string;
    location: {
        street: string;
        city: string;
        state: string;
        country: string;
        postalCode: string;
    };
    latitude?: number;
    longitude?: number;
    slotsPerFrame: number;
    timeFrameMinutes: number;
    isOnline: boolean;
    lastSeenAt?: string;
    totalSlots: number;
    bookedSlots?: number;
    activeBookings?: number;
    revenueEstimate?: {
        daily?: { [key: string]: number };
    };
    primaryTags?: Array<{ displayName: string }>;
}

/**
 * Fetch paginated screens
 */
export async function getScreensPaged(params: PaginationParams = {}): Promise<PagedResponse<ScreenDto>> {
    const queryParams = new URLSearchParams();
    if (params.page) queryParams.append('page', params.page.toString());
    if (params.pageSize) queryParams.append('pageSize', params.pageSize.toString());
    if (params.search) queryParams.append('search', params.search);
    if (params.sortBy) queryParams.append('sortBy', params.sortBy);
    if (params.sortDirection) queryParams.append('sortDirection', params.sortDirection);
    if (params.status) queryParams.append('status', params.status);

    const response = await api.get<ApiResponse<PagedResponse<ScreenDto>>>(`/screens/paged?${queryParams}`);
    return response.data.data;
}

// ============ BOOKINGS ============

export interface BookingDto {
    id: string;
    campaignId: string;
    campaignName: string;
    screenId: string;
    screenName: string;
    advertiserId: string;
    startDate: string;
    endDate: string;
    status: string;
    slotNumbers: number[];
    totalPrice: number;
    currency: string;
    createdAt: string;
    playsToday?: number;
    playsTotal?: number;
    lastPlayed?: string;
    isLive?: boolean;
}

export interface BookingPaginationParams extends PaginationParams {
    screenId?: string;
    campaignId?: string;
}

/**
 * Fetch paginated bookings
 */
export async function getBookingsPaged(params: BookingPaginationParams = {}): Promise<PagedResponse<BookingDto>> {
    const queryParams = new URLSearchParams();
    if (params.page) queryParams.append('page', params.page.toString());
    if (params.pageSize) queryParams.append('pageSize', params.pageSize.toString());
    if (params.search) queryParams.append('search', params.search);
    if (params.sortBy) queryParams.append('sortBy', params.sortBy);
    if (params.sortDirection) queryParams.append('sortDirection', params.sortDirection);
    if (params.status) queryParams.append('status', params.status);
    if (params.screenId) queryParams.append('screenId', params.screenId);
    if (params.campaignId) queryParams.append('campaignId', params.campaignId);

    const response = await api.get<ApiResponse<PagedResponse<BookingDto>>>(`/bookings/paged?${queryParams}`);
    return response.data.data;
}

// ============ CAMPAIGNS ============

export interface CampaignDto {
    id: string;
    name: string;
    description: string;
    status: string;
    startDate: string;
    endDate: string;
    budget: number;
    currency: string;
    advertiserId: string;
    createdAt: string;
}

/**
 * Fetch paginated campaigns
 */
export async function getCampaignsPaged(params: PaginationParams = {}): Promise<PagedResponse<CampaignDto>> {
    const queryParams = new URLSearchParams();
    if (params.page) queryParams.append('page', params.page.toString());
    if (params.pageSize) queryParams.append('pageSize', params.pageSize.toString());
    if (params.search) queryParams.append('search', params.search);
    if (params.sortBy) queryParams.append('sortBy', params.sortBy);
    if (params.sortDirection) queryParams.append('sortDirection', params.sortDirection);
    if (params.status) queryParams.append('status', params.status);

    const response = await api.get<ApiResponse<PagedResponse<CampaignDto>>>(`/campaigns/paged?${queryParams}`);
    return response.data.data;
}
