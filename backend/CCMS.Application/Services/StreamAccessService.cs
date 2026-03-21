using CCMS.Application.Interfaces;
using CCMS.Domain.Entities;
using CCMS.Domain.Enums;
using CCMS.Domain.Interfaces;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace CCMS.Application.Services;

public class StreamAccessResult
{
    public bool HasAccess { get; set; }
    public string Reason { get; set; } = string.Empty;
    public DateOnly? AccessValidUntil { get; set; }
    public bool IsPreviewAccess { get; set; }
    public Guid? BookingId { get; set; }
}

public interface IStreamAccessService
{
    Task<StreamAccessResult> CheckAdvertiserAccessAsync(Guid userId, Guid screenId);
}

public class StreamAccessService : IStreamAccessService
{
    private readonly IRepository<Booking> _bookingRepository;
    private readonly IRepository<Campaign> _campaignRepository;
    private readonly ILogger<StreamAccessService> _logger;
    
    /// <summary>
    /// Hours before booking start date that advertiser gets preview access
    /// </summary>
    private const int PREVIEW_ACCESS_HOURS = 24;

    public StreamAccessService(
        IRepository<Booking> bookingRepository,
        IRepository<Campaign> campaignRepository,
        ILogger<StreamAccessService> logger)
    {
        _bookingRepository = bookingRepository;
        _campaignRepository = campaignRepository;
        _logger = logger;
    }

    public async Task<StreamAccessResult> CheckAdvertiserAccessAsync(Guid userId, Guid screenId)
    {
        _logger.LogInformation(
            "Checking stream access for advertiser {UserId} on screen {ScreenId}",
            userId, screenId);

        var now = DateTime.UtcNow;
        var previewThreshold = now.AddHours(PREVIEW_ACCESS_HOURS);

        // Get all campaigns for this advertiser
        var advertiserCampaigns = await _campaignRepository.FindAsync(c => c.AdvertiserId == userId);
        var campaignIds = advertiserCampaigns.Select(c => c.Id).ToList();

        if (!campaignIds.Any())
        {
            _logger.LogDebug(
                "Advertiser {UserId} has no campaigns - denying stream access to screen {ScreenId}",
                userId, screenId);

            return new StreamAccessResult
            {
                HasAccess = false,
                Reason = "No campaigns found"
            };
        }

        // Find bookings that grant access:
        // 1. Active booking on the screen
        // 2. Approved booking starting within 24 hours (preview access)
        var previewThresholdDate = DateOnly.FromDateTime(previewThreshold);
        var nowDate = DateOnly.FromDateTime(now);
        var accessGrantingBookings = await _bookingRepository.FindAsync(b =>
            b.CampaignId.HasValue && campaignIds.Contains(b.CampaignId.Value) &&
            b.ScreenId == screenId &&
            !b.IsDeleted &&
            (
                // Active booking (currently running)
                b.Status == BookingStatus.Active ||
                // Approved booking starting within preview window
                (b.Status == BookingStatus.Approved && b.StartDate <= previewThresholdDate && b.EndDate >= nowDate)
            ));

        var accessGrantingBooking = accessGrantingBookings.OrderBy(b => b.StartDate).FirstOrDefault();

        if (accessGrantingBooking == null)
        {
            _logger.LogDebug(
                "Advertiser {UserId} denied stream access to screen {ScreenId} - no active or upcoming booking",
                userId, screenId);

            return new StreamAccessResult
            {
                HasAccess = false,
                Reason = "No active or upcoming booking on this screen"
            };
        }

        var isPreviewAccess = accessGrantingBooking.Status == BookingStatus.Approved 
                              && accessGrantingBooking.StartDate > nowDate;

        _logger.LogInformation(
            "Advertiser {UserId} granted {AccessType} stream access to screen {ScreenId} via booking {BookingId}",
            userId, isPreviewAccess ? "PREVIEW" : "ACTIVE", screenId, accessGrantingBooking.Id);

        return new StreamAccessResult
        {
            HasAccess = true,
            BookingId = accessGrantingBooking.Id,
            IsPreviewAccess = isPreviewAccess,
            AccessValidUntil = accessGrantingBooking.EndDate,
            Reason = isPreviewAccess 
                ? $"Preview access - booking starts {accessGrantingBooking.StartDate:g}" 
                : "Active booking access"
        };
    }
}
