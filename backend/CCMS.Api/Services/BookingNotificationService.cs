using CCMS.Api.Hubs;
using CCMS.Application.Interfaces;
using CCMS.Shared.DTOs.Bookings;
using Microsoft.AspNetCore.SignalR;
using Microsoft.Extensions.Logging;

namespace CCMS.Api.Services;

/// <summary>
/// Service for sending real-time booking notifications via SignalR PlaybackHub
/// </summary>
public class BookingNotificationService : IBookingNotificationService
{
    private readonly IHubContext<PlaybackHub> _hubContext;
    private readonly ILogger<BookingNotificationService> _logger;

    public BookingNotificationService(
        IHubContext<PlaybackHub> hubContext,
        ILogger<BookingNotificationService> logger)
    {
        _hubContext = hubContext;
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
}
