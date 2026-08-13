using CCMS.Domain.Enums;

namespace CCMS.Domain.Entities;

public class PlaylistItem : BaseEntity
{
    public Guid PlaylistId { get; set; }
    public Guid MediaAssetId { get; set; }

    public PlaylistItemType ItemType { get; set; }

    /// <summary>Zero-based position within the playlist.</summary>
    public int Order { get; set; }

    /// <summary>
    /// Play duration. For images and HTML5 this is required (no natural end).
    /// For videos this is optional — null means "play the full video".
    /// </summary>
    public int? DurationSeconds { get; set; }

    // Navigation
    public virtual Playlist Playlist { get; set; } = null!;
    public virtual MediaAsset MediaAsset { get; set; } = null!;
}
