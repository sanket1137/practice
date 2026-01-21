using CCMS.Domain.Enums;

namespace CCMS.Domain.Entities;

/// <summary>
/// Master tag entity representing available tags for screens.
/// Pre-seeded with ~150 tags from the BRD specification.
/// </summary>
public class ScreenTag : BaseEntity
{
    /// <summary>
    /// Tag identifier/slug (e.g., "metro_station_proximity", "foodie_zone")
    /// </summary>
    public string Slug { get; set; } = string.Empty;
    
    /// <summary>
    /// Display name (e.g., "Metro Station Proximity", "Foodie Zone")
    /// </summary>
    public string DisplayName { get; set; } = string.Empty;
    
    /// <summary>
    /// Category this tag belongs to
    /// </summary>
    public TagCategory Category { get; set; }
    
    /// <summary>
    /// Description of what this tag means for advertisers
    /// </summary>
    public string? Description { get; set; }
    
    /// <summary>
    /// Google Places types that trigger this tag (JSON array)
    /// e.g., ["subway_station", "light_rail_station", "transit_station"]
    /// </summary>
    public string? GooglePlaceTypes { get; set; }
    
    /// <summary>
    /// Maximum distance in meters for this tag to apply (for proximity tags)
    /// </summary>
    public int? MaxDistanceMeters { get; set; }
    
    /// <summary>
    /// Minimum POI count required (for density tags)
    /// </summary>
    public int? MinPoiCount { get; set; }
    
    /// <summary>
    /// Priority for display ordering (1 = highest)
    /// </summary>
    public int Priority { get; set; } = 50;
    
    /// <summary>
    /// Whether this is a system tag (cannot be deleted)
    /// </summary>
    public bool IsSystemTag { get; set; } = true;
    
    /// <summary>
    /// Icon identifier for frontend display
    /// </summary>
    public string? IconName { get; set; }
    
    /// <summary>
    /// Color code for tag chip display (hex)
    /// </summary>
    public string? ColorCode { get; set; }
    
    // Navigation property
    public virtual ICollection<ScreenTagAssignment> ScreenAssignments { get; set; } = new List<ScreenTagAssignment>();
}
