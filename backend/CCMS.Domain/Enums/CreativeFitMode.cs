namespace CCMS.Domain.Enums;

/// <summary>
/// How a creative should be rendered on a screen when its native dimensions
/// do not match the screen's resolution / aspect ratio. The player applies
/// this at playback time — the server stores the choice on the Booking.
/// </summary>
public enum CreativeFitMode
{
    /// <summary>Letterbox / pillarbox — preserve aspect, show full creative with bars.</summary>
    Fit = 0,

    /// <summary>Cover — preserve aspect, crop overflow so the screen is fully filled.</summary>
    Fill = 1,

    /// <summary>Stretch — ignore aspect, distort to fully cover the screen.</summary>
    Stretch = 2,

    /// <summary>Cover-center — same as Fill but always centered.</summary>
    CenterCrop = 3,

    /// <summary>
    /// Player chooses the best mode automatically based on heuristics
    /// (aspect-ratio delta, presence of a focal-point hint, content type).
    /// Default for new bookings.
    /// </summary>
    SmartAdaptive = 4
}
