using CCMS.Domain.Enums;
using CCMS.Infrastructure.Data;
using Microsoft.Azure.Functions.Worker;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace CCMS.Functions;

/// <summary>
/// Generates smart screen proposals for advertisers who have active campaigns
/// but no recent bookings. Anti-fatigue: skip advertiser if a proposal was
/// already sent within the last 48 hours.
/// Runs every 4 hours.
/// </summary>
public class SmartProposalsJob
{
    private readonly ApplicationDbContext _db;
    private readonly ILogger<SmartProposalsJob> _logger;

    public SmartProposalsJob(ApplicationDbContext db, ILogger<SmartProposalsJob> logger)
    {
        _db = db;
        _logger = logger;
    }

    [Function("SmartProposalsJob")]
    public async Task Run([TimerTrigger("0 0 */4 * * *")] TimerInfo timer)
    {
        var antiFatigueCutoff = DateTime.UtcNow.AddHours(-48);
        var sevenDaysAgo = DateTime.UtcNow.AddDays(-7);

        var candidateAdvertiserIds = await _db.Campaigns
            .Where(c => c.Status == CampaignStatus.Active)
            .Select(c => c.AdvertiserId)
            .Distinct()
            .ToListAsync();

        var advertisersWithRecentBookings = await _db.Bookings
            .Include(b => b.Campaign)
            .Where(b => b.CreatedAt >= sevenDaysAgo
                && b.Campaign != null
                && candidateAdvertiserIds.Contains(b.Campaign.AdvertiserId))
            .Select(b => b.Campaign!.AdvertiserId)
            .Distinct()
            .ToListAsync();

        var targetAdvertisers = candidateAdvertiserIds
            .Except(advertisersWithRecentBookings)
            .ToList();

        if (targetAdvertisers.Count == 0)
        {
            _logger.LogDebug("SmartProposalsJob: no advertisers need proposals");
            return;
        }

        var recentlyNotified = await _db.Notifications
            .Where(n => n.CreatedAt >= antiFatigueCutoff
                && n.Type == NotificationType.SystemAlert
                && n.ReferenceType == "SmartProposal"
                && targetAdvertisers.Contains(n.UserId))
            .Select(n => n.UserId)
            .Distinct()
            .ToListAsync();

        var finalTargets = targetAdvertisers.Except(recentlyNotified).ToList();
        if (finalTargets.Count == 0) return;

        var topScreens = await _db.Screens
            .Where(s => s.Status == ScreenStatus.Active)
            .OrderByDescending(s => s.AudienceQualityScore)
            .Take(5)
            .Select(s => new { s.Id, s.Name })
            .ToListAsync();

        if (topScreens.Count == 0) return;

        var screenList = string.Join(", ", topScreens.Select(s => s.Name));
        var now = DateTime.UtcNow;

        foreach (var advertiserId in finalTargets)
        {
            _db.Notifications.Add(new CCMS.Domain.Entities.Notification
            {
                UserId = advertiserId,
                Title = "Screens recommended for you",
                Message = $"Based on your campaigns, these screens may be a great fit: {screenList}.",
                Type = NotificationType.SystemAlert,
                ReferenceType = "SmartProposal",
                CreatedAt = now,
                IsRead = false,
            });
        }

        await _db.SaveChangesAsync();
        _logger.LogInformation("SmartProposalsJob: sent proposals to {Count} advertiser(s)", finalTargets.Count);
    }
}
