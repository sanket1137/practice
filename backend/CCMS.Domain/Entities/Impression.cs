namespace CCMS.Domain.Entities;

public class Impression : BaseEntity
{
    public Guid BookingId { get; set; }
    public Guid CampaignId { get; set; }
    public Guid ScreenId { get; set; }
    public Guid CreativeId { get; set; }
    
    // Playback information
    public DateTime PlayTimestamp { get; set; }
    public DateTime SessionDate { get; set; } // Date only for daily grouping
    public int PlayCount { get; set; } = 1;
    
    // Device information
    public string DeviceId { get; set; } = string.Empty;
    
    // Additional metadata
    public int? SlotPosition { get; set; }
    public bool IsVerified { get; set; } = true;
    
    // Navigation properties
    public virtual Booking Booking { get; set; } = null!;
    public virtual Campaign Campaign { get; set; } = null!;
    public virtual Screen Screen { get; set; } = null!;
    public virtual Creative Creative { get; set; } = null!;
}
