using CCMS.Domain.Enums;

namespace CCMS.Domain.Entities;

public class Creative : BaseEntity
{
    public Guid? CampaignId { get; set; }
    public Guid? UploadedById { get; set; }
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
    
    // Review workflow
    public CreativeStatus Status { get; set; } = CreativeStatus.PendingReview;
    public string? ReviewNotes { get; set; }
    public DateTime? ReviewedAt { get; set; }
    public Guid? ReviewedByUserId { get; set; }

    // Locking for approved bookings
    public bool IsLocked { get; set; }
    public string? LockedReason { get; set; }

    /// <summary>
    /// Optional link to the underlying library asset (Phase 1 media library).
    /// When set, this Creative is just a campaign-scoped pointer to a reusable
    /// MediaAsset; the file URL / dimensions / duration should be sourced from
    /// the asset. Null for legacy creatives uploaded before the library.
    /// </summary>
    public Guid? MediaAssetId { get; set; }

    // Navigation properties
    public virtual Campaign? Campaign { get; set; }
    public virtual User? UploadedBy { get; set; }
    public virtual MediaAsset? MediaAsset { get; set; }
    public virtual ICollection<Booking> Bookings { get; set; } = new List<Booking>();
}
