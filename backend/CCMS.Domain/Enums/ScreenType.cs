namespace CCMS.Domain.Enums;

/// <summary>
/// What the physical asset is — orthogonal to ScreenDisplayType, which describes
/// the environment (indoor/outdoor). Drives spec-form fields (e.g. LED pitch for
/// LED assets, diagonal inches for TVs), marketplace card iconography and search
/// facets. Unclassified exists only so pre-existing screens have an honest value
/// until their owner picks one; the create flow requires a real type.
/// </summary>
public enum ScreenType
{
    Unclassified = 0,
    Billboard = 1,
    LedWall = 2,
    VideoWall = 3,
    TvDisplay = 4,
    Kiosk = 5,
    Projection = 6,
    TransitDisplay = 7,
    Standee = 8,
}
