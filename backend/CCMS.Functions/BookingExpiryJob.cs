using CCMS.Domain.Enums;
using CCMS.Infrastructure.Data;
using Microsoft.Azure.Functions.Worker;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace CCMS.Functions;

/// <summary>
/// Cancels Pending bookings whose payment window has expired.
/// Runs every 5 minutes.
/// </summary>
public class BookingExpiryJob
{
    private readonly ApplicationDbContext _db;
    private readonly ILogger<BookingExpiryJob> _logger;

    public BookingExpiryJob(ApplicationDbContext db, ILogger<BookingExpiryJob> logger)
    {
        _db = db;
        _logger = logger;
    }

    [Function("BookingExpiryJob")]
    public async Task Run([TimerTrigger("0 */5 * * * *")] TimerInfo timer)
    {
        var now = DateTime.UtcNow;

        var expired = await _db.Bookings
            .Where(b => b.Status == BookingStatus.Pending && b.PaymentExpiresAt < now)
            .ToListAsync();

        if (expired.Count == 0)
        {
            _logger.LogDebug("BookingExpiryJob: no expired bookings found");
            return;
        }

        foreach (var booking in expired)
        {
            booking.Status = BookingStatus.Cancelled;
        }

        await _db.SaveChangesAsync();

        _logger.LogInformation("BookingExpiryJob: cancelled {Count} expired booking(s)", expired.Count);
    }
}
