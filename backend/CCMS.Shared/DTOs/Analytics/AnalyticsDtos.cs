namespace CCMS.Shared.DTOs.Analytics;

// ============================================
// SCREEN OWNER ANALYTICS DTOs
// ============================================

public class OwnerAnalyticsSummaryDto
{
    public decimal TotalRevenueMonth { get; set; }
    public decimal TotalRevenueLastMonth { get; set; }
    public decimal RevenueChangePercent { get; set; }
    public decimal AvgDailyRevenue { get; set; }
    public int ActiveBookings { get; set; }
    public int TotalBookings { get; set; }
    public decimal ScreenUptimePercent { get; set; }
    public int TotalScreens { get; set; }
    public int OnlineScreens { get; set; }
    public int TotalImpressions { get; set; }
    public int TodayImpressions { get; set; }
}

public class ScreenRevenueDto
{
    public Guid ScreenId { get; set; }
    public string ScreenName { get; set; } = string.Empty;
    public decimal Revenue { get; set; }
    public int Impressions { get; set; }
    public int ActiveBookings { get; set; }
    public decimal UptimePercent { get; set; }
    public bool IsOnline { get; set; }
}

public class DailyRevenueDto
{
    public DateTime Date { get; set; }
    public string DayName { get; set; } = string.Empty;
    public decimal Revenue { get; set; }
    public int Impressions { get; set; }
    public int Bookings { get; set; }
}

// ============================================
// ADVERTISER ANALYTICS DTOs
// ============================================

public class AdvertiserAnalyticsSummaryDto
{
    public int TotalImpressions { get; set; }
    public int ImpressionsThisWeek { get; set; }
    public int ImpressionsLastWeek { get; set; }
    public decimal ImpressionChangePercent { get; set; }
    public decimal TotalSpendMonth { get; set; }
    public decimal TotalSpendLastMonth { get; set; }
    public decimal SpendChangePercent { get; set; }
    public decimal AvgCpm { get; set; } // Cost per 1000 impressions
    public decimal CpmLastMonth { get; set; }
    public decimal CpmChangePercent { get; set; }
    public int ActiveCampaigns { get; set; }
    public int TotalCampaigns { get; set; }
    public int ActiveBookings { get; set; }
    public int TotalBookings { get; set; }
    public int TotalScreensBooked { get; set; }
}

public class CampaignPerformanceSummaryDto
{
    public Guid CampaignId { get; set; }
    public string CampaignName { get; set; } = string.Empty;
    public string Status { get; set; } = string.Empty;
    public int DeliveredImpressions { get; set; }
    public int ExpectedImpressions { get; set; }
    public decimal DeliveryPercent { get; set; }
    public decimal Spent { get; set; }
    public int TotalBookings { get; set; }
    public int ApprovedBookings { get; set; }
    public DateTime StartDate { get; set; }
    public DateTime? EndDate { get; set; }
}

public class DailyImpressionsDto
{
    public DateTime Date { get; set; }
    public string DayName { get; set; } = string.Empty;
    public int Impressions { get; set; }
    public int Bookings { get; set; }
}

// ============================================
// ADMIN/PLATFORM ANALYTICS DTOs
// ============================================

public class PlatformAnalyticsSummaryDto
{
    public int TotalImpressions { get; set; }
    public int ImpressionsThisMonth { get; set; }
    public int ImpressionsLastMonth { get; set; }
    public decimal ImpressionChangePercent { get; set; }
    public decimal TotalRevenue { get; set; }
    public decimal RevenueThisMonth { get; set; }
    public decimal RevenueLastMonth { get; set; }
    public decimal RevenueChangePercent { get; set; }
    public int ActiveScreens { get; set; }
    public int TotalScreens { get; set; }
    public int OnlineScreens { get; set; }
    public decimal AvgScreenUptime { get; set; }
    public int ActiveCampaigns { get; set; }
    public int TotalCampaigns { get; set; }
    public int PendingApprovals { get; set; }
    public int TotalBookings { get; set; }
    public int ApprovedBookings { get; set; }
    public int TotalUsers { get; set; }
    public int TotalScreenOwners { get; set; }
    public int TotalAdvertisers { get; set; }
    public int NewUsersThisMonth { get; set; }
}

public class PlatformDailyStatsDto
{
    public DateTime Date { get; set; }
    public string DayName { get; set; } = string.Empty;
    public int Impressions { get; set; }
    public decimal Revenue { get; set; }
    public int NewBookings { get; set; }
    public int NewUsers { get; set; }
}

// ============================================
// EXISTING DTOs (kept for compatibility)
// ============================================

public class ScreenAnalyticsDto
{
    public Guid ScreenId { get; set; }
    public string ScreenName { get; set; } = string.Empty;
    public int TotalBookings { get; set; }
    public int ActiveBookings { get; set; }
    public int TotalImpressions { get; set; }
    public int TodayImpressions { get; set; }
    public decimal TotalRevenue { get; set; }
    public decimal OccupancyRate { get; set; } // percentage
    public DateTime? LastPlaybackAt { get; set; }
    public List<DailyImpressionDto> DailyImpressions { get; set; } = new();
}

public class CampaignAnalyticsDto
{
    public Guid CampaignId { get; set; }
    public string CampaignName { get; set; } = string.Empty;
    public int TotalBookings { get; set; }
    public int ApprovedBookings { get; set; }
    public int TotalScreens { get; set; }
    public int TotalImpressions { get; set; }
    public int ExpectedImpressions { get; set; }
    public decimal DeliveryRate { get; set; } // percentage
    public decimal TotalSpent { get; set; }
    public List<BookingPerformanceDto> BookingPerformances { get; set; } = new();
}

public class DailyImpressionDto
{
    public DateTime Date { get; set; }
    public int Impressions { get; set; }
}

public class BookingPerformanceDto
{
    public Guid BookingId { get; set; }
    public string ScreenName { get; set; } = string.Empty;
    public int DeliveredImpressions { get; set; }
    public int ExpectedImpressions { get; set; }
    public decimal DeliveryRate { get; set; }
    public DateTime? LastPlaybackAt { get; set; }
}

// ── Phase 5: Proof-of-Play Analytics DTOs ─────────────────────────────────

public class PopDailyDto
{
    public DateTime Date { get; set; }
    public int ImpressionCount { get; set; }
    public int FullPlayCount { get; set; }
    public double AvgDurationSeconds { get; set; }
}

public class PopAnalyticsDto
{
    public int TotalImpressions { get; set; }
    public int FullPlayCount { get; set; }
    public double FullPlayRate { get; set; }
    public List<PopDailyDto> DailyBreakdown { get; set; } = new();
}

public class PopSummaryDto
{
    public int TotalImpressions { get; set; }
    public int FullPlayCount { get; set; }
    public double FullPlayRate { get; set; }
    public double AvgDurationSeconds { get; set; }
    public string Preset { get; set; } = "30d";
}
