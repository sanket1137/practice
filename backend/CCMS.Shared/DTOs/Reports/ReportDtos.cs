namespace CCMS.Shared.DTOs.Reports;

/// <summary>
/// Detailed impression report for a specific booking (advertiser view)
/// </summary>
public class BookingImpressionReport
{
    public Guid BookingId { get; set; }
    public Guid CampaignId { get; set; }
    public string CampaignName { get; set; } = string.Empty;
    public Guid ScreenId { get; set; }
    public string ScreenName { get; set; } = string.Empty;
    public string ScreenLocation { get; set; } = string.Empty;
    public Guid? CreativeId { get; set; }
    public string CreativeName { get; set; } = string.Empty;
    
    public DateRange BookingPeriod { get; set; } = new();
    public DateRange ReportPeriod { get; set; } = new();
    public DateTime GeneratedAt { get; set; }
    
    // Summary metrics
    public int TotalPlays { get; set; }
    public int FullPlays { get; set; }
    public int PartialPlays { get; set; }
    public int TotalDurationSeconds { get; set; }
    public int TotalExpectedDurationSeconds { get; set; }
    public decimal CompletionRate { get; set; } // Percentage of full plays
    public decimal AveragePlayDurationSeconds { get; set; }
    
    // Daily breakdown
    public List<DailyBreakdown> DailyBreakdown { get; set; } = new();
}

/// <summary>
/// Campaign-level summary report across all screens/bookings
/// </summary>
public class CampaignSummaryReport
{
    public Guid CampaignId { get; set; }
    public string CampaignName { get; set; } = string.Empty;
    public Guid AdvertiserId { get; set; }
    
    public DateRange CampaignPeriod { get; set; } = new();
    public DateRange ReportPeriod { get; set; } = new();
    public DateTime GeneratedAt { get; set; }
    
    // Summary metrics
    public int TotalScreens { get; set; }
    public int TotalPlays { get; set; }
    public int FullPlays { get; set; }
    public int PartialPlays { get; set; }
    public int TotalDurationSeconds { get; set; }
    public decimal CompletionRate { get; set; }
    public decimal AveragePlayDurationSeconds { get; set; }
    
    // Per-screen stats
    public List<ScreenSummary> ScreenStats { get; set; } = new();
}

/// <summary>
/// Campaign daily breakdown report
/// </summary>
public class CampaignDailyReport
{
    public Guid CampaignId { get; set; }
    public string CampaignName { get; set; } = string.Empty;
    public DateRange ReportPeriod { get; set; } = new();
    public DateTime GeneratedAt { get; set; }
    
    public int TotalPlays { get; set; }
    public int TotalFullPlays { get; set; }
    
    public List<DailyBreakdown> DailyBreakdown { get; set; } = new();
}

/// <summary>
/// Hourly breakdown for a specific day
/// </summary>
public class HourlyBreakdownReport
{
    public Guid BookingId { get; set; }
    public DateTime Date { get; set; }
    
    // 24-element arrays (one per hour, 0-23)
    public List<int> HourlyPlays { get; set; } = new();
    public List<int> HourlyFullPlays { get; set; } = new();
    public List<int> HourlyDurationSeconds { get; set; } = new();
    
    public int TotalPlays { get; set; }
    public int TotalFullPlays { get; set; }
    public int TotalDurationSeconds { get; set; }
}

/// <summary>
/// Paginated impression logs response
/// </summary>
public class ImpressionLogsResponse
{
    public Guid BookingId { get; set; }
    public DateTime StartDate { get; set; }
    public DateTime EndDate { get; set; }
    
    public int TotalCount { get; set; }
    public int Page { get; set; }
    public int PageSize { get; set; }
    public int TotalPages { get; set; }
    
    public List<ImpressionLogEntry> Logs { get; set; } = new();
}

/// <summary>
/// Individual impression log entry (for transparency/audit)
/// </summary>
public class ImpressionLogEntry
{
    public string ImpressionId { get; set; } = string.Empty;
    public DateTime PlayedAt { get; set; }
    public int DurationSeconds { get; set; }
    public int ExpectedDurationSeconds { get; set; }
    public bool WasFullPlay { get; set; }
    public int SlotPosition { get; set; }
    public bool IsVerified { get; set; }
    public string DeviceId { get; set; } = string.Empty;
}

/// <summary>
/// Daily breakdown entry
/// </summary>
public class DailyBreakdown
{
    public DateTime Date { get; set; }
    public int TotalPlays { get; set; }
    public int FullPlays { get; set; }
    public int PartialPlays { get; set; }
    public int TotalDurationSeconds { get; set; }
    public DateTime? FirstPlayAt { get; set; }
    public DateTime? LastPlayAt { get; set; }
    public decimal CompletionRate { get; set; }
}

/// <summary>
/// Per-screen summary in campaign report
/// </summary>
public class ScreenSummary
{
    public Guid BookingId { get; set; }
    public Guid ScreenId { get; set; }
    public string ScreenName { get; set; } = string.Empty;
    public string ScreenLocation { get; set; } = string.Empty;
    public int TotalPlays { get; set; }
    public int FullPlays { get; set; }
    public decimal CompletionRate { get; set; }
}

/// <summary>
/// Date range helper
/// </summary>
public class DateRange
{
    public DateTime StartDate { get; set; }
    public DateTime EndDate { get; set; }
}

/// <summary>
/// Export request options
/// </summary>
public class ExportRequest
{
    public string Format { get; set; } = "csv"; // csv or pdf
    public DateTime? StartDate { get; set; }
    public DateTime? EndDate { get; set; }
    public bool IncludeDetailedLogs { get; set; } = false;
}
