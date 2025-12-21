namespace CCMS.Shared.DTOs.Player;

public class DailySyncData
{
    public DateTime Date { get; set; }
    public string StartTime { get; set; } = string.Empty; // HH:mm:ss format
    public string EndTime { get; set; } = string.Empty;
    public string Uptime { get; set; } = string.Empty; // HH:mm:ss format
    public string Downtime { get; set; } = string.Empty;
    public List<CampaignImpressionSummary> CampaignImpressions { get; set; } = new();
}

public class CampaignImpressionSummary
{
    public Guid BookingId { get; set; }
    public Guid CampaignId { get; set; }
    public Guid CreativeId { get; set; }
    public int TotalSlotsRan { get; set; }
    public List<DateTime> PlayTimestamps { get; set; } = new();
}

public class SyncResponse
{
    public bool Success { get; set; }
    public string Message { get; set; } = string.Empty;
    public int ImpressionsSaved { get; set; }
}
