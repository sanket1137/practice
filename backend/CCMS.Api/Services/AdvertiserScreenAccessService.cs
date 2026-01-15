using CCMS.Domain.Entities;
using CCMS.Domain.Enums;
using CCMS.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace CCMS.Api.Services;

/// <summary>
/// Manages advertiser access to screens based on active bookings.
/// Implements 24-hour preview access before campaign start for verification.
/// </summary>
public class AdvertiserScreenAccessService
{
    private readonly ApplicationDbContext _context;
    private readonly ILogger<AdvertiserScreenAccessService> _logger;
    
    /// <summary>
    /// Hours before booking start date that advertiser gets preview access
    /// </summary>
    public const int PREVIEW_ACCESS_HOURS = 24;

    public AdvertiserScreenAccessService(
        ApplicationDbContext context,
        ILogger<AdvertiserScreenAccessService> logger)
    {
        _context = context;
        _logger = logger;
    }

    /// <summary>
    /// Check if an advertiser has access to a specific screen.
    /// Access is granted when:
    /// 1. Advertiser has an Active booking on the screen
    /// 2. Advertiser has an Approved booking starting within 24 hours (preview access)
    /// </summary>
    /// <param name="advertiserId">The advertiser's user ID</param>
    /// <param name="screenId">The screen ID to check access for</param>
    /// <returns>Access result with details</returns>
    public async Task<ScreenAccessResult> CheckAdvertiserAccessAsync(Guid advertiserId, Guid screenId)
    {
        var now = DateTime.UtcNow;
        var previewThreshold = now.AddHours(PREVIEW_ACCESS_HOURS);

        // Find any booking that grants access
        var accessGrantingBooking = await _context.Bookings
            .Include(b => b.Campaign)
            .Where(b => b.Campaign.AdvertiserId == advertiserId
                     && b.ScreenId == screenId
                     && !b.IsDeleted
                     && (
                         // Active booking (currently running)
                         b.Status == BookingStatus.Active
                         ||
                         // Approved booking starting within preview window
                         (b.Status == BookingStatus.Approved && b.StartDate <= previewThreshold && b.EndDate >= now)
                     ))
            .OrderBy(b => b.StartDate)
            .FirstOrDefaultAsync();

        if (accessGrantingBooking == null)
        {
            _logger.LogDebug(
                "Advertiser {AdvertiserId} denied access to screen {ScreenId} - no active or upcoming booking",
                advertiserId, screenId);

            return new ScreenAccessResult
            {
                HasAccess = false,
                Reason = "No active booking on this screen"
            };
        }

        var isPreviewAccess = accessGrantingBooking.Status == BookingStatus.Approved 
                              && accessGrantingBooking.StartDate > now;

        _logger.LogInformation(
            "Advertiser {AdvertiserId} granted {AccessType} access to screen {ScreenId} via booking {BookingId}",
            advertiserId, isPreviewAccess ? "PREVIEW" : "ACTIVE", screenId, accessGrantingBooking.Id);

        return new ScreenAccessResult
        {
            HasAccess = true,
            BookingId = accessGrantingBooking.Id,
            CampaignId = accessGrantingBooking.CampaignId,
            IsPreviewAccess = isPreviewAccess,
            AccessExpiresAt = accessGrantingBooking.EndDate,
            Reason = isPreviewAccess 
                ? $"Preview access - campaign starts {accessGrantingBooking.StartDate:g}" 
                : "Active booking"
        };
    }

    /// <summary>
    /// Get all screens an advertiser currently has access to
    /// </summary>
    public async Task<List<ScreenAccessInfo>> GetAccessibleScreensAsync(Guid advertiserId)
    {
        var now = DateTime.UtcNow;
        var previewThreshold = now.AddHours(PREVIEW_ACCESS_HOURS);

        var accessibleBookings = await _context.Bookings
            .Include(b => b.Campaign)
            .Include(b => b.Screen)
            .Where(b => b.Campaign.AdvertiserId == advertiserId
                     && !b.IsDeleted
                     && !b.Screen.IsDeleted
                     && (
                         b.Status == BookingStatus.Active
                         ||
                         (b.Status == BookingStatus.Approved && b.StartDate <= previewThreshold && b.EndDate >= now)
                     ))
            .Select(b => new ScreenAccessInfo
            {
                ScreenId = b.ScreenId,
                ScreenName = b.Screen.Name,
                BookingId = b.Id,
                CampaignId = b.CampaignId,
                CampaignName = b.Campaign.Name,
                IsPreviewAccess = b.Status == BookingStatus.Approved && b.StartDate > now,
                AccessExpiresAt = b.EndDate,
                BookingStartDate = b.StartDate,
                BookingEndDate = b.EndDate
            })
            .ToListAsync();

        return accessibleBookings;
    }

    /// <summary>
    /// Get all advertisers with active access to a specific screen
    /// Used for viewer management and access revocation
    /// </summary>
    public async Task<List<AdvertiserAccessInfo>> GetScreenAccessorsAsync(Guid screenId)
    {
        var now = DateTime.UtcNow;
        var previewThreshold = now.AddHours(PREVIEW_ACCESS_HOURS);

        var accessors = await _context.Bookings
            .Include(b => b.Campaign)
                .ThenInclude(c => c.Advertiser)
            .Where(b => b.ScreenId == screenId
                     && !b.IsDeleted
                     && (
                         b.Status == BookingStatus.Active
                         ||
                         (b.Status == BookingStatus.Approved && b.StartDate <= previewThreshold && b.EndDate >= now)
                     ))
            .Select(b => new AdvertiserAccessInfo
            {
                AdvertiserId = b.Campaign.AdvertiserId,
                AdvertiserEmail = b.Campaign.Advertiser.Email,
                BookingId = b.Id,
                CampaignId = b.CampaignId,
                AccessExpiresAt = b.EndDate,
                IsPreviewAccess = b.Status == BookingStatus.Approved && b.StartDate > now
            })
            .ToListAsync();

        return accessors;
    }

    /// <summary>
    /// Find bookings that have just expired (for access revocation)
    /// </summary>
    public async Task<List<ExpiredAccessInfo>> GetNewlyExpiredAccessAsync(DateTime since)
    {
        var now = DateTime.UtcNow;

        // Find bookings that ended between 'since' and 'now'
        var expiredBookings = await _context.Bookings
            .Include(b => b.Campaign)
            .Where(b => (b.Status == BookingStatus.Active || b.Status == BookingStatus.Completed)
                     && b.EndDate >= since
                     && b.EndDate < now
                     && !b.IsDeleted)
            .Select(b => new ExpiredAccessInfo
            {
                BookingId = b.Id,
                ScreenId = b.ScreenId,
                AdvertiserId = b.Campaign.AdvertiserId,
                CampaignId = b.CampaignId,
                ExpiredAt = b.EndDate
            })
            .ToListAsync();

        return expiredBookings;
    }
}

#region DTOs

public class ScreenAccessResult
{
    public bool HasAccess { get; set; }
    public Guid? BookingId { get; set; }
    public Guid? CampaignId { get; set; }
    public bool IsPreviewAccess { get; set; }
    public DateTime? AccessExpiresAt { get; set; }
    public string Reason { get; set; } = string.Empty;
}

public class ScreenAccessInfo
{
    public Guid ScreenId { get; set; }
    public string ScreenName { get; set; } = string.Empty;
    public Guid BookingId { get; set; }
    public Guid CampaignId { get; set; }
    public string CampaignName { get; set; } = string.Empty;
    public bool IsPreviewAccess { get; set; }
    public DateTime AccessExpiresAt { get; set; }
    public DateTime BookingStartDate { get; set; }
    public DateTime BookingEndDate { get; set; }
}

public class AdvertiserAccessInfo
{
    public Guid AdvertiserId { get; set; }
    public string AdvertiserEmail { get; set; } = string.Empty;
    public Guid BookingId { get; set; }
    public Guid CampaignId { get; set; }
    public DateTime AccessExpiresAt { get; set; }
    public bool IsPreviewAccess { get; set; }
}

public class ExpiredAccessInfo
{
    public Guid BookingId { get; set; }
    public Guid ScreenId { get; set; }
    public Guid AdvertiserId { get; set; }
    public Guid CampaignId { get; set; }
    public DateTime ExpiredAt { get; set; }
}

#endregion
