namespace CCMS.Application.Services;

/// <summary>
/// Service for handling timezone conversions and getting current date in configured timezone
/// </summary>
public interface ITimeZoneService
{
    /// <summary>
    /// Get current date in the configured timezone
    /// </summary>
    DateTime GetCurrentDate();
    
    /// <summary>
    /// Convert UTC datetime to local timezone
    /// </summary>
    DateTime ConvertUtcToLocal(DateTime utcDateTime);
    
    /// <summary>
    /// The configured timezone
    /// </summary>
    TimeZoneInfo TimeZone { get; }
}
