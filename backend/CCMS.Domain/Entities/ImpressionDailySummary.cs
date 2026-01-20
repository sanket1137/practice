namespace CCMS.Domain.Entities;

/// <summary>
/// Aggregated daily impression summary for historical data (beyond 30 days).
/// This reduces storage while maintaining advertiser reporting capability.
/// </summary>
public class ImpressionDailySummary : BaseEntity
{
    public Guid? BookingId { get; set; }
    public Guid? CampaignId { get; set; }
    public Guid ScreenId { get; set; }
    public Guid? CreativeId { get; set; }
    public Guid? OwnerContentId { get; set; }
    
    // Aggregation date
    public DateTime Date { get; set; } // Date only (no time)
    
    // Aggregated metrics
    public int TotalPlays { get; set; }
    public int FullPlays { get; set; } // Count where WasFullPlay = true
    public int PartialPlays { get; set; } // Count where WasFullPlay = false
    public int TotalDurationSeconds { get; set; } // Sum of all DurationSeconds
    public int TotalExpectedDurationSeconds { get; set; } // Sum of expected durations
    
    // Time range
    public DateTime FirstPlayAt { get; set; }
    public DateTime LastPlayAt { get; set; }
    
    // Hourly breakdown (JSON stored as 24-element array)
    public List<int> HourlyPlays { get; set; } = new List<int>(new int[24]);
    
    // Verification metrics
    public int VerifiedPlays { get; set; }
    public int UnverifiedPlays { get; set; }
    
    // Completion rate (percentage of full plays)
    public decimal CompletionRate => TotalPlays > 0 
        ? Math.Round((decimal)FullPlays / TotalPlays * 100, 2) 
        : 0;
    
    // Navigation properties
    public virtual Booking? Booking { get; set; }
    public virtual Campaign? Campaign { get; set; }
    public virtual Screen Screen { get; set; } = null!;
    public virtual Creative? Creative { get; set; }
    public virtual OwnerContent? OwnerContent { get; set; }
}
