using CCMS.Domain.Entities;
using CCMS.Domain.Enums;
using CCMS.Infrastructure.Data;
using Microsoft.Azure.Functions.Worker;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace CCMS.Functions;

/// <summary>
/// Releases escrowed wallet funds back to advertisers for
/// Rejected/Cancelled bookings where the refund has not yet been processed.
/// Runs every minute.
/// </summary>
public class WalletEscrowReleaseJob
{
    private readonly ApplicationDbContext _db;
    private readonly ILogger<WalletEscrowReleaseJob> _logger;

    public WalletEscrowReleaseJob(ApplicationDbContext db, ILogger<WalletEscrowReleaseJob> logger)
    {
        _db = db;
        _logger = logger;
    }

    [Function("WalletEscrowReleaseJob")]
    public async Task Run([TimerTrigger("0 */1 * * * *")] TimerInfo timer)
    {
        var cutoff = DateTime.UtcNow.AddHours(-48);

        // Find Completed bookings whose escrow hasn't been released yet
        // (no Refund transaction with matching BookingId)
        var completedBookingIds = await _db.Bookings
            .Where(b => b.Status == BookingStatus.Completed && b.UpdatedAt < cutoff)
            .Select(b => b.Id)
            .ToListAsync();

        if (completedBookingIds.Count == 0) return;

        var alreadyReleased = await _db.WalletTransactions
            .Where(t => t.ReferenceType == "BookingEscrowRelease" && completedBookingIds.Contains(t.ReferenceId!.Value))
            .Select(t => t.ReferenceId!.Value)
            .ToListAsync();

        var toRelease = completedBookingIds.Except(alreadyReleased).ToList();

        if (toRelease.Count == 0) return;

        var bookings = await _db.Bookings
            .Include(b => b.Screen)
            .Where(b => toRelease.Contains(b.Id))
            .ToListAsync();

        foreach (var booking in bookings)
        {
            var screenOwnerWallet = await _db.Wallets
                .FirstOrDefaultAsync(w => w.UserId == booking.Screen.OwnerId);

            if (screenOwnerWallet == null) continue;

            var amount = booking.TotalPrice;
            var before = screenOwnerWallet.Balance;
            screenOwnerWallet.Balance += amount;

            _db.WalletTransactions.Add(new WalletTransaction
            {
                WalletId = screenOwnerWallet.Id,
                Type = WalletTransactionType.TopUp,
                Amount = amount,
                Description = $"Escrow release for booking {booking.Id}",
                ReferenceId = booking.Id,
                ReferenceType = "BookingEscrowRelease",
                BalanceBefore = before,
                BalanceAfter = screenOwnerWallet.Balance,
            });
        }

        await _db.SaveChangesAsync();
        _logger.LogInformation("WalletEscrowReleaseJob: released escrow for {Count} booking(s)", toRelease.Count);
    }
}
