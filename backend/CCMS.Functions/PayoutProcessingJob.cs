using CCMS.Domain.Entities;
using CCMS.Domain.Enums;
using CCMS.Infrastructure.Data;
using Microsoft.Azure.Functions.Worker;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace CCMS.Functions;

/// <summary>
/// Aggregates Completed bookings that haven't been paid out yet and
/// creates a pending Payout record for each screen owner.
/// Runs every Monday at 3:30 AM UTC (9:00 AM IST).
/// </summary>
public class PayoutProcessingJob
{
    private readonly ApplicationDbContext _db;
    private readonly ILogger<PayoutProcessingJob> _logger;

    public PayoutProcessingJob(ApplicationDbContext db, ILogger<PayoutProcessingJob> logger)
    {
        _db = db;
        _logger = logger;
    }

    [Function("PayoutProcessingJob")]
    public async Task Run([TimerTrigger("0 30 3 * * 1")] TimerInfo timer)
    {
        // Completed bookings not yet associated with a payout
        var unpaidBookings = await _db.Bookings
            .Include(b => b.Screen)
            .Where(b => b.Status == BookingStatus.Completed)
            .Where(b => !_db.Payouts.Any(p => p.BookingId == b.Id))
            .ToListAsync();

        if (unpaidBookings.Count == 0)
        {
            _logger.LogDebug("PayoutProcessingJob: no unpaid completed bookings");
            return;
        }

        var grouped = unpaidBookings.GroupBy(b => b.Screen.OwnerId);
        var now = DateTime.UtcNow;
        var periodStart = DateOnly.FromDateTime(now.AddDays(-7));
        var periodEnd = DateOnly.FromDateTime(now);
        const decimal commissionPct = 15m;
        int created = 0;

        foreach (var group in grouped)
        {
            foreach (var booking in group)
            {
                var gross = booking.TotalPrice;
                var commission = Math.Round(gross * commissionPct / 100m, 2);
                var net = gross - commission;

                _db.Payouts.Add(new Payout
                {
                    ScreenOwnerId = group.Key,
                    BookingId = booking.Id,
                    Type = PayoutType.Full,
                    AdvancePercentage = 0,
                    GrossAmount = gross,
                    CommissionPercentage = commissionPct,
                    CommissionAmount = commission,
                    NetAmount = net,
                    Currency = "INR",
                    Status = PayoutStatus.Pending,
                    PeriodStart = periodStart,
                    PeriodEnd = periodEnd,
                });
                created++;
            }
        }

        await _db.SaveChangesAsync();
        _logger.LogInformation("PayoutProcessingJob: created {Count} payout record(s)", created);
    }
}
