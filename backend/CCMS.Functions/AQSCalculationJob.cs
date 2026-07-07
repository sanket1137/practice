using CCMS.Domain.Enums;
using CCMS.Infrastructure.Data;
using Microsoft.Azure.Functions.Worker;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace CCMS.Functions;

/// <summary>
/// Calculates Audience Quality Score for all screens.
/// AQS = (uptime * 0.25) + (fillRate * 0.25) + (avgRating/5 * 0.25) + (normalizedFootfall * 0.25)
/// Runs nightly at 8:30 PM UTC (2:00 AM IST).
/// </summary>
public class AQSCalculationJob
{
    private readonly ApplicationDbContext _db;
    private readonly ILogger<AQSCalculationJob> _logger;

    public AQSCalculationJob(ApplicationDbContext db, ILogger<AQSCalculationJob> logger)
    {
        _db = db;
        _logger = logger;
    }

    [Function("AQSCalculationJob")]
    public async Task Run([TimerTrigger("0 30 20 * * *")] TimerInfo timer)
    {
        var screens = await _db.Screens
            .Where(s => s.Status == ScreenStatus.Active)
            .ToListAsync();

        var thirtyDaysAgo = DateTime.UtcNow.AddDays(-30);
        var totalSlotsPossible = 6 * 24 * 30; // 6 slots/hr × 24hr × 30 days

        foreach (var screen in screens)
        {
            // Fill rate: approved + active + completed bookings in last 30 days
            var bookedSlots = await _db.Bookings
                .Where(b => b.ScreenId == screen.Id
                    && b.CreatedAt >= thirtyDaysAgo
                    && (b.Status == BookingStatus.Approved || b.Status == BookingStatus.Active || b.Status == BookingStatus.Completed))
                .CountAsync();

            var fillRate = Math.Min(1.0m, (decimal)bookedSlots / Math.Max(1, totalSlotsPossible));

            // Simple uptime proxy: fraction of days in last 30 with at least one heartbeat
            // (If no heartbeat tracking, default to 0.8 as a reasonable placeholder)
            var uptime = 0.8m;

            // Review score placeholder: 0.5 until a review system exists
            var avgRating = 0.5m;

            screen.AudienceQualityScore = Math.Round(
                (uptime * 0.34m) + (fillRate * 0.33m) + (avgRating * 0.33m),
                4);
        }

        await _db.SaveChangesAsync();
        _logger.LogInformation("AQSCalculationJob: updated AQS for {Count} screen(s)", screens.Count);
    }
}
