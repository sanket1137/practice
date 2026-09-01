namespace CCMS.Domain.ValueObjects;

/// <summary>
/// The one place unit math is allowed to live. Owners enter physical size in
/// whatever unit they think in; everything downstream (search filters, sorting,
/// comparisons) uses the canonical millimetre columns computed through here.
/// </summary>
public static class DimensionUnits
{
    public static readonly string[] Supported = { "feet", "inches", "meters", "centimeters" };

    /// <summary>Maps common aliases ("ft", "in", "m", "cm") onto the canonical names.</summary>
    public static string? Normalize(string? unit)
    {
        return unit?.Trim().ToLowerInvariant() switch
        {
            "feet" or "ft" or "foot" => "feet",
            "inches" or "in" or "inch" => "inches",
            "meters" or "m" or "metre" or "metres" or "meter" => "meters",
            "centimeters" or "cm" or "centimetre" or "centimetres" or "centimeter" => "centimeters",
            _ => null,
        };
    }

    /// <summary>Converts a physical dimension to millimetres; null when the unit is unknown or the value non-positive.</summary>
    public static int? ToMillimeters(decimal value, string? unit)
    {
        if (value <= 0) return null;
        var factor = Normalize(unit) switch
        {
            "feet" => 304.8m,
            "inches" => 25.4m,
            "meters" => 1000m,
            "centimeters" => 10m,
            _ => 0m,
        };
        if (factor == 0m) return null;
        return (int)Math.Round(value * factor);
    }
}
