namespace CCMS.Shared.DTOs.Analytics;

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
