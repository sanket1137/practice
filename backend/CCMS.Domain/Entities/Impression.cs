namespace CCMS.Domain.Entities;

public class Impression : BaseEntity
{
    public Guid? BookingId { get; set; } // Nullable because owner content has no booking
    public Guid? CampaignId { get; set; } // Nullable because owner content has no campaign
    public Guid ScreenId { get; set; }
    public Guid? CreativeId { get; set; } // Nullable because owner content has no creative
    public Guid? OwnerContentId { get; set; } // Link to owner custom content
    
    // Playback information
    public DateTime PlayedAt { get; set; } // When ad was actually played
    public DateTime SessionDate { get; set; } // Date only for daily grouping
    
    // Device information
    public string DeviceId { get; set; } = string.Empty;
    
    // Additional metadata
    public int? SlotPosition { get; set; }
    public bool IsVerified { get; set; } = true;
    
    // Deduplication and fraud prevention
    public string? ImpressionId { get; set; } // UUID from player for deduplication
    public DateTime? ClientTimestamp { get; set; } // Timestamp from player device
    public string? VerificationHash { get; set; } // Hash for authenticity verification
    public string? PlayerVersion { get; set; } // Player version for tracking
    
    // Navigation properties
    public virtual Booking? Booking { get; set; }
    public virtual Campaign? Campaign { get; set; }
    public virtual Screen Screen { get; set; } = null!;
    public virtual Creative? Creative { get; set; }
    public virtual OwnerContent? OwnerContent { get; set; }
}

