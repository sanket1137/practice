import { api } from './api';

// ============================================
// TYPE DEFINITIONS
// ============================================

export interface OwnerAnalyticsSummary {
    totalRevenueMonth: number;
    totalRevenueLastMonth: number;
    revenueChangePercent: number;
    avgDailyRevenue: number;
    activeBookings: number;
    totalBookings: number;
    screenUptimePercent: number;
    totalScreens: number;
    onlineScreens: number;
    totalImpressions: number;
    todayImpressions: number;
}

export interface ScreenRevenue {
    screenId: string;
    screenName: string;
    revenue: number;
    impressions: number;
    activeBookings: number;
    uptimePercent: number;
    isOnline: boolean;
}

export interface DailyRevenue {
    date: string;
    dayName: string;
    revenue: number;
    impressions: number;
    bookings: number;
}

export interface AdvertiserAnalyticsSummary {
    totalImpressions: number;
    impressionsThisWeek: number;
    impressionsLastWeek: number;
    impressionChangePercent: number;
    totalSpendMonth: number;
    totalSpendLastMonth: number;
    spendChangePercent: number;
    avgCpm: number;
    cpmLastMonth: number;
    cpmChangePercent: number;
    activeCampaigns: number;
    totalCampaigns: number;
    activeBookings: number;
    totalBookings: number;
    totalScreensBooked: number;
}

export interface CampaignPerformanceSummary {
    campaignId: string;
    campaignName: string;
    status: string;
    deliveredImpressions: number;
    expectedImpressions: number;
    deliveryPercent: number;
    spent: number;
    totalBookings: number;
    approvedBookings: number;
    startDate: string;
    endDate: string | null;
}

export interface DailyImpressions {
    date: string;
    dayName: string;
    impressions: number;
    bookings: number;
}

export interface PlatformAnalyticsSummary {
    totalImpressions: number;
    impressionsThisMonth: number;
    impressionsLastMonth: number;
    impressionChangePercent: number;
    totalRevenue: number;
    revenueThisMonth: number;
    revenueLastMonth: number;
    revenueChangePercent: number;
    activeScreens: number;
    totalScreens: number;
    onlineScreens: number;
    avgScreenUptime: number;
    activeCampaigns: number;
    totalCampaigns: number;
    pendingApprovals: number;
    totalBookings: number;
    approvedBookings: number;
    totalUsers: number;
    totalScreenOwners: number;
    totalAdvertisers: number;
    newUsersThisMonth: number;
}

export interface PlatformDailyStats {
    date: string;
    dayName: string;
    impressions: number;
    revenue: number;
    newBookings: number;
    newUsers: number;
}

// ============================================
// SCREEN OWNER ANALYTICS API
// ============================================

export const getOwnerAnalyticsSummary = async (): Promise<OwnerAnalyticsSummary> => {
    const response = await api.get('/analytics/owner/summary');
    return response.data.data;
};

export const getOwnerScreenBreakdown = async (): Promise<ScreenRevenue[]> => {
    const response = await api.get('/analytics/owner/screens');
    return response.data.data;
};

export const getOwnerDailyRevenue = async (days: number = 7): Promise<DailyRevenue[]> => {
    const response = await api.get(`/analytics/owner/revenue/daily?days=${days}`);
    return response.data.data;
};

// ============================================
// ADVERTISER ANALYTICS API
// ============================================

export const getAdvertiserAnalyticsSummary = async (): Promise<AdvertiserAnalyticsSummary> => {
    const response = await api.get('/analytics/advertiser/summary');
    return response.data.data;
};

export const getAdvertiserCampaigns = async (): Promise<CampaignPerformanceSummary[]> => {
    const response = await api.get('/analytics/advertiser/campaigns');
    return response.data.data;
};

export const getAdvertiserDailyImpressions = async (days: number = 7): Promise<DailyImpressions[]> => {
    const response = await api.get(`/analytics/advertiser/impressions/daily?days=${days}`);
    return response.data.data;
};

// ============================================
// ADMIN/PLATFORM ANALYTICS API
// ============================================

export const getPlatformAnalyticsSummary = async (): Promise<PlatformAnalyticsSummary> => {
    const response = await api.get('/analytics/admin/platform');
    return response.data.data;
};

export const getPlatformDailyStats = async (days: number = 7): Promise<PlatformDailyStats[]> => {
    const response = await api.get(`/analytics/admin/daily?days=${days}`);
    return response.data.data;
};
