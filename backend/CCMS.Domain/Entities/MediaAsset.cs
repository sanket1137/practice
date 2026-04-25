namespace CCMS.Domain.Entities;

/// <summary>
/// Content-addressed media asset in the CMS library. Identified by SHA-256 of
/// the file contents — uploading the same file twice under different names
/// references the same row (dedupe).
/// </summary>
public class MediaAsset : BaseEntity
{
    public Guid OwnerId { get; set; }

    /// <summary>Hex-encoded SHA-256 of file contents. Unique per owner.</summary>
    public string Sha256 { get; set; } = string.Empty;

    public string OriginalName { get; set; } = string.Empty;
    public string MimeType { get; set; } = string.Empty;
    public long SizeBytes { get; set; }

    /// <summary>Public URL (R2) of the stored object.</summary>
    public string FileUrl { get; set; } = string.Empty;

    /// <summary>Thumbnail URL (image preview / video frame). Null until generated.</summary>
    public string? ThumbnailUrl { get; set; }

    // Media metadata (filled on finalize)
    public int? Width { get; set; }
    public int? Height { get; set; }
    public decimal? DurationSeconds { get; set; }

    /// <summary>False until client calls finalize; true once R2 confirms upload.</summary>
    public bool IsReady { get; set; }

    // Navigation
    public virtual User Owner { get; set; } = null!;
    public virtual ICollection<PlaylistItem> PlaylistItems { get; set; } = new List<PlaylistItem>();
}
