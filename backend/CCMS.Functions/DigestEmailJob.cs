using CCMS.Application.Interfaces;
using CCMS.Domain.Enums;
using CCMS.Infrastructure.Data;
using Microsoft.Azure.Functions.Worker;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace CCMS.Functions;

/// <summary>
/// Sends a weekly platform digest email to all screen owners and advertisers.
/// Runs every Sunday at 3:30 AM UTC (9:00 AM IST).
/// </summary>
public class DigestEmailJob
{
    private readonly ApplicationDbContext _db;
    private readonly IEmailService _emailService;
    private readonly ILogger<DigestEmailJob> _logger;

    public DigestEmailJob(
        ApplicationDbContext db,
        IEmailService emailService,
        ILogger<DigestEmailJob> logger)
    {
        _db = db;
        _emailService = emailService;
        _logger = logger;
    }

    [Function("DigestEmailJob")]
    public async Task Run([TimerTrigger("0 30 3 * * 0")] TimerInfo timer)
    {
        var weekAgo = DateTime.UtcNow.AddDays(-7);

        // Screen owner digest
        var owners = await _db.Users
            .Where(u => u.Role == UserRole.ScreenOwner && u.IsEmailVerified)
            .ToListAsync();

        foreach (var owner in owners)
        {
            var completedCount = await _db.Bookings
                .Include(b => b.Screen)
                .Where(b => b.Screen.OwnerId == owner.Id
                    && b.Status == BookingStatus.Completed
                    && b.UpdatedAt >= weekAgo)
                .CountAsync();

            var revenue = await _db.Bookings
                .Include(b => b.Screen)
                .Where(b => b.Screen.OwnerId == owner.Id
                    && b.Status == BookingStatus.Completed
                    && b.UpdatedAt >= weekAgo)
                .SumAsync(b => (decimal?)b.TotalPrice) ?? 0;

            var subject = "Your PixelSpot weekly summary";
            var body = $"Hi {owner.FirstName},\n\n" +
                       $"This week on PixelSpot:\n" +
                       $"  Completed bookings: {completedCount}\n" +
                       $"  Estimated revenue: ₹{revenue:N2}\n\n" +
                       $"Log in to view your full dashboard: https://ccms.pixelspot.in\n\n" +
                       $"— The PixelSpot Team";

            await _emailService.SendEmailAsync(owner.Email, subject, body);
        }

        // Advertiser digest
        var advertisers = await _db.Users
            .Where(u => u.Role == UserRole.Advertiser && u.IsEmailVerified)
            .ToListAsync();

        foreach (var advertiser in advertisers)
        {
            var activeCampaigns = await _db.Campaigns
                .Where(c => c.AdvertiserId == advertiser.Id && c.Status == CampaignStatus.Active)
                .CountAsync();

            var activeBookings = await _db.Bookings
                .Include(b => b.Campaign)
                .Where(b => b.Campaign != null && b.Campaign.AdvertiserId == advertiser.Id && b.Status == BookingStatus.Active)
                .CountAsync();

            var subject = "Your PixelSpot weekly summary";
            var body = $"Hi {advertiser.FirstName},\n\n" +
                       $"This week on PixelSpot:\n" +
                       $"  Active campaigns: {activeCampaigns}\n" +
                       $"  Active bookings: {activeBookings}\n\n" +
                       $"Explore available screens: https://ccms.pixelspot.in/discover\n\n" +
                       $"— The PixelSpot Team";

            await _emailService.SendEmailAsync(advertiser.Email, subject, body);
        }

        _logger.LogInformation("DigestEmailJob: sent weekly digest to {Owners} owners and {Advertisers} advertisers",
            owners.Count, advertisers.Count);
    }
}
