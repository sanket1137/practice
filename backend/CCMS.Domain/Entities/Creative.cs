namespace CCMS.Domain.Entities;

public class Creative : BaseEntity
{
    public Guid CampaignId { get; set; }
    public string Name { get; set; } = string.Empty;
    public string FileUrl { get; set; } = string.Empty;
    public string FileName { get; set; } = string.Empty;
    public string MimeType { get; set; } = string.Empty;
    
    // File information
    public long FileSize { get; set; } // in bytes
    public string FileHash { get; set; } = string.Empty; // for integrity verification
    
    // Dimensions
    public int Width { get; set; }
    public int Height { get; set; }
    
    // Duration for video creatives (in seconds)
    public int Duration { get; set; }
    
    // Thumbnail for preview
    public string? ThumbnailUrl { get; set; }
    
    // Locking for approved bookings
    public bool IsLocked { get; set; }
    public string? LockedReason { get; set; }
    
    // Navigation properties
    public virtual Campaign Campaign { get; set; } = null!;
    public virtual ICollection<Booking> Bookings { get; set; } = new List<Booking>();
}
