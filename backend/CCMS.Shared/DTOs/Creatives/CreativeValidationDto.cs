using CCMS.Domain.Enums;

namespace CCMS.Shared.DTOs.Creatives;

/// <summary>
/// Result of validating a creative against a screen. Phase 1 model:
/// - Hard errors (Errors[] non-empty + IsCompatible=false) only for things the
///   player physically cannot work around (duration overflow, unsupported
///   format, extremely low resolution, corrupted media).
/// - Soft notices (Warnings[]) for dimension/aspect-ratio mismatches that the
///   player can solve via a FitMode at playback time. These do NOT block the
///   booking.
/// - SuggestedFitMode tells the UI which fit to default to when warnings
///   are present (typically SmartAdaptive for aspect mismatches).
/// </summary>
public class CreativeValidationDto
{
    public bool IsCompatible { get; set; }
    public CreativeRequirementsDto Requirements { get; set; } = new();

    /// <summary>Blocking errors. When this list is non-empty, IsCompatible is false.</summary>
    public List<string> Errors { get; set; } = new();

    /// <summary>Non-blocking notices the UI should surface to the advertiser.</summary>
    public List<string> Warnings { get; set; } = new();

    /// <summary>
    /// Recommended fit mode when the creative does not natively match the
    /// screen. Null when the creative is a perfect fit (no warnings, no errors).
    /// </summary>
    public CreativeFitMode? SuggestedFitMode { get; set; }
}

public class CreativeRequirementsDto
{
    public List<DimensionDto> SupportedSizes { get; set; } = new();
    public int MaxDuration { get; set; } // in seconds
}

public class DimensionDto
{
    public int Width { get; set; }
    public int Height { get; set; }
}
