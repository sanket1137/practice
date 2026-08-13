using CCMS.Api.Hubs;
using CCMS.Application.Interfaces;
using CCMS.Domain.Entities;
using CCMS.Domain.Enums;
using CCMS.Domain.Interfaces;
using CCMS.Shared.DTOs.Bookings;
using Microsoft.AspNetCore.SignalR;
using Microsoft.Extensions.Logging;

namespace CCMS.Api.Services;

/// <summary>
/// Service for sending real-time booking notifications via SignalR PlaybackHub and email
/// </summary>
public class BookingNotificationService : IBookingNotificationService
{
    private readonly IHubContext<PlaybackHub> _hubContext;
    private readonly IEmailService _emailService;
    private readonly IRepository<User> _userRepository;
    private readonly INotificationService _notificationService;
    private readonly ILogger<BookingNotificationService> _logger;

    public BookingNotificationService(
        IHubContext<PlaybackHub> hubContext,
        IEmailService emailService,
        IRepository<User> userRepository,
        INotificationService notificationService,
        ILogger<BookingNotificationService> logger)
    {
        _hubContext = hubContext;
        _emailService = emailService;
        _userRepository = userRepository;
        _notificationService = notificationService;
        _logger = logger;
    }

    public async Task NotifyBookingCreatedAsync(BookingDto booking, Guid screenOwnerId)
    {
        _logger.LogInformation(
            "[SignalR] Broadcasting BookingCreated for booking {BookingId} to screen owner {ScreenOwnerId}",
            booking.Id.ToString()[..8], screenOwnerId.ToString()[..8]);

        // Send to screen owner's user group
        await _hubContext.Clients.Group($"user_{screenOwnerId}")
            .SendAsync("BookingCreated", new
            {
                Booking = booking,
                Timestamp = DateTime.UtcNow,
                Message = $"New booking request for {booking.ScreenName}"
            });

        // Also send to the specific screen's group (for live preview widgets)
        await _hubContext.Clients.Group($"screen_{booking.ScreenId}")
            .SendAsync("BookingCreated", new
            {
                Booking = booking,
                Timestamp = DateTime.UtcNow
            });

        // Broadcast to all connected clients (for global dashboard updates)
        await _hubContext.Clients.All.SendAsync("BookingCreated", new
        {
            Booking = booking,
            Timestamp = DateTime.UtcNow
        });

        _logger.LogInformation("[SignalR] BookingCreated broadcast complete");

        // Persist in-app notification for screen owner
        await _notificationService.CreateNotificationAsync(
            screenOwnerId,
            "New Booking Request",
            $"New booking request for {booking.ScreenName} from campaign '{booking.CampaignName}'",
            NotificationType.BookingCreated,
            $"/bookings/{booking.Id}",
            booking.Id,
            "Booking");

        // Send email notification to screen owner
        try
        {
            var screenOwner = await _userRepository.GetByIdAsync(screenOwnerId);
            var advertiser = booking.AdvertiserId.HasValue 
                ? await _userRepository.GetByIdAsync(booking.AdvertiserId.Value) 
                : null;
            var advertiserName = advertiser != null 
                ? $"{advertiser.FirstName} {advertiser.LastName}".Trim() 
                : "Advertiser";
            
            if (screenOwner != null && !string.IsNullOrEmpty(screenOwner.Email))
            {
                // Parse YYYY-MM-DD format strings to DateTime for email service
                var startDateTime = DateOnly.Parse(booking.StartDate).ToDateTime(TimeOnly.MinValue);
                var endDateTime = DateOnly.Parse(booking.EndDate).ToDateTime(TimeOnly.MinValue);
                
                await _emailService.SendNewBookingRequestEmailAsync(
                    screenOwner.Email,
                    screenOwner.FirstName ?? "Screen Owner",
                    booking.Id,
                    booking.ScreenName,
                    advertiserName,
                    booking.CampaignName,
                    startDateTime,
                    endDateTime);
                _logger.LogInformation("[Email] New booking request email sent to screen owner {Email}", screenOwner.Email);
            }
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "[Email] Failed to send new booking request email to screen owner");
        }
    }

    public async Task NotifyBookingApprovedAsync(BookingDto booking, Guid advertiserId)
    {
        _logger.LogInformation(
            "[SignalR] Broadcasting BookingApproved for booking {BookingId} to advertiser {AdvertiserId}",
            booking.Id.ToString()[..8], advertiserId.ToString()[..8]);

        // Send to advertiser's user group
        await _hubContext.Clients.Group($"user_{advertiserId}")
            .SendAsync("BookingApproved", new
            {
                Booking = booking,
                Timestamp = DateTime.UtcNow,
                Message = $"Your booking for {booking.ScreenName} has been approved!"
            });

        // Broadcast to all connected clients (for global dashboard updates)
        await _hubContext.Clients.All.SendAsync("BookingApproved", new
        {
            Booking = booking,
            Timestamp = DateTime.UtcNow
        });

        _logger.LogInformation("[SignalR] BookingApproved broadcast complete");

        // Persist in-app notification for advertiser
        await _notificationService.CreateNotificationAsync(
            advertiserId,
            "Booking Approved",
            $"Your booking for {booking.ScreenName} has been approved!",
            NotificationType.BookingApproved,
            $"/bookings/{booking.Id}",
            booking.Id,
            "Booking");

        // Send email notification to advertiser
        try
        {
            var advertiser = await _userRepository.GetByIdAsync(advertiserId);
            if (advertiser != null && !string.IsNullOrEmpty(advertiser.Email))
            {
                // Parse YYYY-MM-DD format strings to DateTime for email service
                var startDateTime = DateOnly.Parse(booking.StartDate).ToDateTime(TimeOnly.MinValue);
                var endDateTime = DateOnly.Parse(booking.EndDate).ToDateTime(TimeOnly.MinValue);
                
                await _emailService.SendBookingApprovedEmailAsync(
                    advertiser.Email,
                    advertiser.FirstName ?? "Advertiser",
                    booking.Id,
                    booking.CampaignName,
                    booking.ScreenName,
                    startDateTime,
                    endDateTime,
                    booking.TotalPrice,
                    booking.Currency);
                _logger.LogInformation("[Email] Booking approved email sent to advertiser {Email}", advertiser.Email);
            }
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "[Email] Failed to send booking approved email to advertiser");
        }
    }

    public async Task NotifyBookingRejectedAsync(BookingDto booking, Guid advertiserId, string? reason)
    {
        _logger.LogInformation(
            "[SignalR] Broadcasting BookingRejected for booking {BookingId} to advertiser {AdvertiserId}",
            booking.Id.ToString()[..8], advertiserId.ToString()[..8]);

        // Send to advertiser's user group
        await _hubContext.Clients.Group($"user_{advertiserId}")
            .SendAsync("BookingRejected", new
            {
                Booking = booking,
                Reason = reason,
                Timestamp = DateTime.UtcNow,
                Message = $"Your booking for {booking.ScreenName} was not approved"
            });

        // Broadcast to all connected clients
        await _hubContext.Clients.All.SendAsync("BookingRejected", new
        {
            Booking = booking,
            Timestamp = DateTime.UtcNow
        });

        _logger.LogInformation("[SignalR] BookingRejected broadcast complete");

        // Persist in-app notification for advertiser
        var rejectionMsg = string.IsNullOrEmpty(reason)
            ? $"Your booking for {booking.ScreenName} was not approved"
            : $"Your booking for {booking.ScreenName} was not approved: {reason}";
        await _notificationService.CreateNotificationAsync(
            advertiserId,
            "Booking Rejected",
            rejectionMsg,
            NotificationType.BookingRejected,
            $"/bookings/{booking.Id}",
            booking.Id,
            "Booking");

        // Send email notification to advertiser
        try
        {
            var advertiser = await _userRepository.GetByIdAsync(advertiserId);
            if (advertiser != null && !string.IsNullOrEmpty(advertiser.Email))
            {
                await _emailService.SendBookingRejectedEmailAsync(
                    advertiser.Email,
                    advertiser.FirstName ?? "Advertiser",
                    booking.Id,
                    booking.CampaignName,
                    booking.ScreenName,
                    reason);
                _logger.LogInformation("[Email] Booking rejected email sent to advertiser {Email}", advertiser.Email);
            }
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "[Email] Failed to send booking rejected email to advertiser");
        }
    }

    public async Task NotifyBookingUpdatedAsync(BookingDto booking, Guid screenOwnerId, Guid advertiserId)
    {
        _logger.LogInformation(
            "[SignalR] Broadcasting BookingUpdated for booking {BookingId}",
            booking.Id.ToString()[..8]);

        // Send to screen owner
        await _hubContext.Clients.Group($"user_{screenOwnerId}")
            .SendAsync("BookingUpdated", new
            {
                Booking = booking,
                Timestamp = DateTime.UtcNow
            });

        // Send to advertiser
        await _hubContext.Clients.Group($"user_{advertiserId}")
            .SendAsync("BookingUpdated", new
            {
                Booking = booking,
                Timestamp = DateTime.UtcNow
            });

        // Broadcast to all
        await _hubContext.Clients.All.SendAsync("BookingUpdated", new
        {
            Booking = booking,
            Timestamp = DateTime.UtcNow
        });

        _logger.LogInformation("[SignalR] BookingUpdated broadcast complete");
    }

    public async Task NotifyBookingCancelledAsync(BookingDto booking, Guid screenOwnerId, Guid advertiserId, string? reason)
    {
        _logger.LogInformation(
            "[SignalR] Broadcasting BookingCancelled for booking {BookingId}",
            booking.Id.ToString()[..8]);

        var payload = new
        {
            Booking = booking,
            Reason = reason,
            Timestamp = DateTime.UtcNow,
            Message = $"Booking for {booking.ScreenName} has been cancelled"
        };

        // Send to screen owner
        await _hubContext.Clients.Group($"user_{screenOwnerId}")
            .SendAsync("BookingCancelled", payload);

        // Send to advertiser
        await _hubContext.Clients.Group($"user_{advertiserId}")
            .SendAsync("BookingCancelled", payload);

        // Broadcast to all
        await _hubContext.Clients.All.SendAsync("BookingCancelled", new
        {
            Booking = booking,
            Timestamp = DateTime.UtcNow
        });

        _logger.LogInformation("[SignalR] BookingCancelled broadcast complete");

        // Persist in-app notifications for both parties
        var cancelMsg = $"Booking for {booking.ScreenName} has been cancelled" +
            (string.IsNullOrEmpty(reason) ? "" : $": {reason}");
        await _notificationService.CreateNotificationAsync(
            screenOwnerId,
            "Booking Cancelled",
            cancelMsg,
            NotificationType.BookingCancelled,
            $"/bookings/{booking.Id}",
            booking.Id,
            "Booking");
        await _notificationService.CreateNotificationAsync(
            advertiserId,
            "Booking Cancelled",
            cancelMsg,
            NotificationType.BookingCancelled,
            $"/bookings/{booking.Id}",
            booking.Id,
            "Booking");

        // Send email notifications to both parties
        try
        {
            var advertiser = await _userRepository.GetByIdAsync(advertiserId);
            if (advertiser != null && !string.IsNullOrEmpty(advertiser.Email))
            {
                await _emailService.SendBookingCancelledEmailAsync(
                    advertiser.Email,
                    advertiser.FirstName ?? "Advertiser",
                    booking.Id,
                    booking.CampaignName,
                    booking.ScreenName,
                    reason);
            }
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "[Email] Failed to send booking cancelled email to advertiser");
        }

        try
        {
            var screenOwner = await _userRepository.GetByIdAsync(screenOwnerId);
            if (screenOwner != null && !string.IsNullOrEmpty(screenOwner.Email))
            {
                await _emailService.SendBookingCancelledEmailAsync(
                    screenOwner.Email,
                    screenOwner.FirstName ?? "Screen Owner",
                    booking.Id,
                    booking.CampaignName,
                    booking.ScreenName,
                    reason);
            }
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "[Email] Failed to send booking cancelled email to screen owner");
        }
    }
}
