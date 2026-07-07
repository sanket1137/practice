namespace CCMS.Domain.Entities;

/// <summary>
/// User-defined folder/collection grouping in the media library.
/// Each asset can belong to at most one collection (nullable).
/// </summary>
public class MediaCollection : BaseEntity
{
    public Guid OwnerId { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }

    // Navigation
    public virtual User Owner { get; set; } = null!;
    public virtual ICollection<MediaAsset> Assets { get; set; } = new List<MediaAsset>();
}
