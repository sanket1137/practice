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

// ============================================
// DATE-RANGE ANALYTICS API (Phase 3)
// ============================================

export interface SpendOverTimePoint { date: string; amount: number; }
export interface CampaignBreakdownItem { campaignId: string; name: string; plays: number; spend: number; }

export interface AdvertiserDateRangeAnalytics {
    totalSpend: number;
    totalPlays: number;
    avgCpp: number;
    activeCampaigns: number;
    spendOverTime: SpendOverTimePoint[];
    campaignBreakdown: CampaignBreakdownItem[];
}

export interface RevenueOverTimePoint { date: string; amount: number; }
export interface FillRateByScreen { screenId: string; screenName: string; fillRate: number; }
export interface TopAdvertiser { advertiserId: string; advertiserName: string; spend: number; bookings: number; }

export interface MediaOwnerDateRangeAnalytics {
    totalRevenue: number;
    fillRate: number;
    totalBookings: number;
    pendingBookings: number;
    revenueOverTime: RevenueOverTimePoint[];
    fillRateByScreen: FillRateByScreen[];
    topAdvertisers: TopAdvertiser[];
}

export const getAdvertiserDateRangeAnalytics = async (
    dateFrom: string,
    dateTo: string
): Promise<AdvertiserDateRangeAnalytics> => {
    const response = await api.get(`/analytics/advertiser/daterange?dateFrom=${dateFrom}&dateTo=${dateTo}`);
    return response.data;
};

export const getMediaOwnerDateRangeAnalytics = async (
    dateFrom: string,
    dateTo: string,
    screenId?: string
): Promise<MediaOwnerDateRangeAnalytics> => {
    const params = new URLSearchParams({ dateFrom, dateTo });
    if (screenId) params.append('screenId', screenId);
    const response = await api.get(`/analytics/mediaowner/daterange?${params}`);
    return response.data;
};

export const exportAnalyticsCsv = async (
    role: 'advertiser' | 'mediaowner',
    dateFrom: string,
    dateTo: string
): Promise<void> => {
    const response = await api.get(`/analytics/export?role=${role}&dateFrom=${dateFrom}&dateTo=${dateTo}`, {
        responseType: 'blob',
    });
    const url = URL.createObjectURL(response.data as Blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `analytics_${role}_${dateFrom}_${dateTo}.csv`;
    a.click();
    URL.revokeObjectURL(url);
};

export const exportAnalyticsPdf = async (
    role: 'advertiser' | 'mediaowner',
    dateFrom: string,
    dateTo: string
): Promise<void> => {
    const response = await api.get(
        `/analytics/export?role=${role}&dateFrom=${dateFrom}&dateTo=${dateTo}&format=pdf`,
        { responseType: 'blob' }
    );
    const url = URL.createObjectURL(response.data as Blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `analytics_${role}_${dateFrom}_${dateTo}.pdf`;
    a.click();
    URL.revokeObjectURL(url);
};
