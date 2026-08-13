namespace CCMS.Shared.DTOs.Player;

public class DailySyncData
{
    public DateTime Date { get; set; }
    public string StartTime { get; set; } = string.Empty; // HH:mm:ss format
    public string EndTime { get; set; } = string.Empty;
    public string Uptime { get; set; } = string.Empty; // HH:mm:ss format
    public string Downtime { get; set; } = string.Empty;
    
    // Legacy format (backwards compatibility)
    public List<CampaignImpressionSummary> CampaignImpressions { get; set; } = new();
    public List<OwnerContentImpressionSummary> OwnerContentImpressions { get; set; } = new();
    
    // NEW: Flat impressions array with slot_play_key for UPSERT deduplication
    public List<FlatImpression>? Impressions { get; set; }
    
    public string? PlayerVersion { get; set; } // Player version for tracking
}

/// <summary>
/// Flat impression format - used for UPSERT deduplication via slot_play_key
/// This is the new preferred format that prevents duplicates at the database level
/// </summary>
public class FlatImpression
{
    public string ImpressionId { get; set; } = string.Empty;
    public string SlotPlayKey { get; set; } = string.Empty; // SHA256(screenId + date + slot + second) for UNIQUE constraint
    public Guid? BookingId { get; set; }
    public Guid? CampaignId { get; set; }
    public Guid? CreativeId { get; set; }
    public Guid? OwnerContentId { get; set; }
    public int SlotNumber { get; set; }
    public DateTime PlayedAt { get; set; }
    public string? VerificationHash { get; set; }
    public string ScreenId { get; set; } = string.Empty;
    
    // Playback duration tracking (for advertiser reporting)
    public int? DurationSeconds { get; set; } // Actual playback duration in seconds
    public int? ExpectedDurationSeconds { get; set; } // Expected duration from creative/content
    public bool WasFullPlay { get; set; } = true; // Whether the ad played completely without interruption
}

public class CampaignImpressionSummary
{
    public Guid BookingId { get; set; }
    public Guid CampaignId { get; set; }
    public Guid CreativeId { get; set; }
    public int TotalSlotsRan { get; set; }
    public List<DateTime> PlayTimestamps { get; set; } = new();
    
    // Deduplication fields
    public List<string>? ImpressionIds { get; set; } // UUID for each impression
    public List<string>? VerificationHashes { get; set; } // Hash for verification
}

public class OwnerContentImpressionSummary
{
    public Guid OwnerContentId { get; set; }
    public int SlotNumber { get; set; }
    public List<DateTime> PlayTimestamps { get; set; } = new();
    
    // Deduplication fields
    public List<string>? ImpressionIds { get; set; }
    public List<string>? VerificationHashes { get; set; }
}

public class SyncResponse
{
    public bool Success { get; set; }
    public string Message { get; set; } = string.Empty;
    public int ImpressionsSaved { get; set; }
    public int DuplicatesSkipped { get; set; } // Count of skipped duplicates
    public int DuplicatesIgnored { get; set; } // Alias for frontend compatibility
}
