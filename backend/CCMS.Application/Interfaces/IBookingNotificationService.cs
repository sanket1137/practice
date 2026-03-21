using CCMS.Shared.DTOs.Bookings;

namespace CCMS.Application.Interfaces;

/// <summary>
/// Service for sending real-time booking notifications via SignalR
/// </summary>
public interface IBookingNotificationService
{
    /// <summary>
    /// Notify screen owner when a new booking is created for their screen
    /// </summary>
    Task NotifyBookingCreatedAsync(BookingDto booking, Guid screenOwnerId);

    /// <summary>
    /// Notify advertiser when their booking is approved
    /// </summary>
    Task NotifyBookingApprovedAsync(BookingDto booking, Guid advertiserId);

    /// <summary>
    /// Notify advertiser when their booking is rejected
    /// </summary>
    Task NotifyBookingRejectedAsync(BookingDto booking, Guid advertiserId, string? reason);

    /// <summary>
    /// Notify both parties when a booking is cancelled
    /// </summary>
    Task NotifyBookingCancelledAsync(BookingDto booking, Guid screenOwnerId, Guid advertiserId, string? reason);

    /// <summary>
    /// Notify both parties when a booking is updated
    /// </summary>
    Task NotifyBookingUpdatedAsync(BookingDto booking, Guid screenOwnerId, Guid advertiserId);
}
