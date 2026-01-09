using System;

namespace CCMS.Infrastructure.Utilities;

/// <summary>
/// Utility class for consistent UTC datetime handling across the application
/// </summary>
public static class DateTimeUtility
{
    /// <summary>
    /// Gets current UTC time. Use this instead of DateTime.Now
    /// </summary>
    public static DateTime UtcNow => DateTime.UtcNow;
    
    /// <summary>
    /// Ensures a DateTime is in UTC format
    /// </summary>
    public static DateTime ToUtc(this DateTime dateTime)
    {
        return dateTime.Kind switch
        {
            DateTimeKind.Utc => dateTime,
            DateTimeKind.Local => dateTime.ToUniversalTime(),
            _ => DateTime.SpecifyKind(dateTime, DateTimeKind.Utc)
        };
    }
    
    /// <summary>
    /// Parse string to UTC DateTime
    /// </summary>
    public static DateTime ParseUtc(string dateTimeString)
    {
        return DateTime.Parse(dateTimeString).ToUtc();
    }
    
    /// <summary>
    /// Get start of day in UTC
    /// </summary>
    public static DateTime StartOfDayUtc(DateTime date)
    {
        return date.ToUtc().Date;
    }
    
    /// <summary>
    /// Get end of day in UTC
    /// </summary>
    public static DateTime EndOfDayUtc(DateTime date)
    {
        return date.ToUtc().Date.AddDays(1).AddTicks(-1);
    }
}
