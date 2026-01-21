namespace CCMS.Domain.Enums;

/// <summary>
/// Source of how a tag was assigned to a screen
/// </summary>
public enum TagSource
{
    /// <summary>
    /// Tag was automatically generated from Google Places POI data
    /// </summary>
    Auto = 0,
    
    /// <summary>
    /// Tag was manually added by the screen owner
    /// </summary>
    Manual = 1,
    
    /// <summary>
    /// Tag was added by system admin
    /// </summary>
    Admin = 2
}
