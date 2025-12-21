using Microsoft.Extensions.Configuration;

namespace CCMS.Application.Services;

/// <summary>
/// Service for handling timezone conversions based on configuration
/// </summary>
public class TimeZoneService : ITimeZoneService
{
    private readonly TimeZoneInfo _timeZone;
    
    public TimeZoneService(IConfiguration configuration)
    {
        var timeZoneId = configuration["TimeZone:Id"] ?? "Asia/Kolkata";
        
        try
        {
            _timeZone = TimeZoneInfo.FindSystemTimeZoneById(timeZoneId);
        }
        catch (TimeZoneNotFoundException)
        {
            // Fallback to IST if configured timezone not found
            _timeZone = TimeZoneInfo.FindSystemTimeZoneById("Asia/Kolkata");
            Console.WriteLine($"Warning: TimeZone '{timeZoneId}' not found. Using Asia/Kolkata as fallback.");
        }
    }
    
    public DateTime GetCurrentDate()
    {
        return TimeZoneInfo.ConvertTimeFromUtc(DateTime.UtcNow, _timeZone).Date;
    }
    
    public DateTime ConvertUtcToLocal(DateTime utcDateTime)
    {
        return TimeZoneInfo.ConvertTimeFromUtc(utcDateTime, _timeZone);
    }
    
    public TimeZoneInfo TimeZone => _timeZone;
}
