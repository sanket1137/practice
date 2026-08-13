using CCMS.Domain.Enums;

namespace CCMS.Domain.Entities;

/// <summary>
/// Junction entity for Screen-Tag many-to-many relationship.
/// Stores assignment metadata like source, score, and distance.
/// </summary>
public class ScreenTagAssignment
{
    /// <summary>
    /// Primary key
    /// </summary>
    public Guid Id { get; set; } = Guid.NewGuid();
    
    /// <summary>
    /// Screen this tag is assigned to
    /// </summary>
    public Guid ScreenId { get; set; }
    
    /// <summary>
    /// The tag being assigned
    /// </summary>
    public Guid TagId { get; set; }
    
    /// <summary>
    /// How this tag was assigned (Auto/Manual/Admin)
    /// </summary>
    public TagSource Source { get; set; } = TagSource.Auto;
    
    /// <summary>
    /// Relevance score (0-1000) based on proximity, density, quality
    /// Higher score = more relevant tag for the screen
    /// </summary>
    public int Score { get; set; } = 500;
    
    /// <summary>
    /// Distance in meters to the nearest relevant POI (for proximity tags)
    /// </summary>
    public int? DistanceMeters { get; set; }
    
    /// <summary>
    /// Count of POIs contributing to this tag (for density tags)
    /// </summary>
    public int? PoiCount { get; set; }
    
    /// <summary>
    /// Whether this is a primary tag (top 5 most relevant)
    /// </summary>
    public bool IsPrimary { get; set; } = false;
    
    /// <summary>
    /// When the tag was assigned
    /// </summary>
    public DateTime AssignedAt { get; set; } = DateTime.UtcNow;
    
    /// <summary>
    /// When the tag was last verified/refreshed
    /// </summary>
    public DateTime? LastRefreshedAt { get; set; }
    
    /// <summary>
    /// User who manually assigned this tag (if Source = Manual/Admin)
    /// </summary>
    public Guid? AssignedByUserId { get; set; }
    
    // Navigation properties
    public virtual Screen Screen { get; set; } = null!;
    public virtual ScreenTag Tag { get; set; } = null!;
    public virtual User? AssignedByUser { get; set; }
}
