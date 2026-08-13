using CCMS.Application.Interfaces;
using CCMS.Domain.Entities;
using CCMS.Domain.Enums;
using CCMS.Domain.Interfaces;
using Microsoft.Extensions.Logging;

namespace CCMS.Application.Services;

/// <summary>
/// Core service for updating booking statuses based on dates and operating schedules.
/// This service can be used by both background services and serverless functions.
/// </summary>
public class BookingStatusUpdateService
{
    private readonly IRepository<Booking> _bookingRepository;
    private readonly IRepository<Screen> _screenRepository;
    private readonly IRazorpayService _razorpayService;
    private readonly IUnitOfWork _unitOfWork;
    private readonly ILogger<BookingStatusUpdateService> _logger;

    public BookingStatusUpdateService(
        IRepository<Booking> bookingRepository,
        IRepository<Screen> screenRepository,
        IRazorpayService razorpayService,
        IUnitOfWork unitOfWork,
        ILogger<BookingStatusUpdateService> logger)
    {
        _bookingRepository = bookingRepository;
        _screenRepository = screenRepository;
        _razorpayService = razorpayService;
        _unitOfWork = unitOfWork;
        _logger = logger;
    }

    /// <summary>
    /// Updates all booking statuses based on current date/time and screen operating schedules.
    /// Returns the number of bookings that were updated.
    /// </summary>
    public async Task<int> UpdateBookingStatusesAsync(CancellationToken cancellationToken = default)
    {
        // Use local time since booking dates are stored in local time
        var now = DateTime.Now;
        var today = now.Date;
        var updatedCount = 0;

        _logger.LogInformation("Starting booking status update check at {Time} (Local Time)", now);

        try
        {
            // Get all bookings that might need status updates
            var bookingsToCheck = await _bookingRepository.GetAllAsync(cancellationToken);
            var todayDate = DateOnly.FromDateTime(now);
            
            // Filter to Pending, Approved, and Active bookings
            var relevantBookings = bookingsToCheck
                .Where(b => b.Status == BookingStatus.Pending || 
                            b.Status == BookingStatus.Approved || 
                            b.Status == BookingStatus.Active)
                .ToList();

            _logger.LogInformation("Found {Count} bookings to check for status updates", relevantBookings.Count);

            foreach (var booking in relevantBookings)
            {
                try
                {
                    var oldStatus = booking.Status;

                    // Handle Pending bookings separately — auto-cancel if entire period has passed
                    if (booking.Status == BookingStatus.Pending)
                    {
                        if (todayDate > booking.EndDate)
                        {
                            booking.Status = BookingStatus.Cancelled;
                            booking.CancellationReason = "Auto-expired: booking period ended without approval or payment";
                            booking.CancelledAt = now;
                            booking.UpdatedAt = now;

                            await _bookingRepository.UpdateAsync(booking, cancellationToken);
                            updatedCount++;

                            _logger.LogInformation(
                                "Booking {BookingId} auto-expired: {OldStatus} → Cancelled " +
                                "(EndDate {EndDate} has passed)",
                                booking.Id, oldStatus, booking.EndDate);
                        }
                        // If startDate passed but endDate still future, keep Pending — user can re-request with updated dates
                        continue;
                    }

                    // For Approved/Active bookings, determine status based on schedule
                    var screen = await _screenRepository.GetByIdAsync(booking.ScreenId, cancellationToken);
                    if (screen == null)
                    {
                        _logger.LogWarning("Screen {ScreenId} not found for booking {BookingId}", 
                            booking.ScreenId, booking.Id);
                        continue;
                    }

                    var newStatus = DetermineBookingStatus(booking, screen, now);

                    if (oldStatus != newStatus)
                    {
                        booking.Status = newStatus;
                        booking.UpdatedAt = now;
                        
                        await _bookingRepository.UpdateAsync(booking, cancellationToken);
                        updatedCount++;

                        _logger.LogInformation(
                            "Booking {BookingId} status updated: {OldStatus} → {NewStatus} " +
                            "(Campaign: {CampaignId}, Screen: {ScreenName})",
                            booking.Id, oldStatus, newStatus, booking.CampaignId, screen.Name);
                    }
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Error updating booking {BookingId}", booking.Id);
                }
            }

            // --- Payment expiry check ---
            // Cancel bookings where payment window has expired (OrderCreated + PaymentExpiresAt passed)
            var expiredPaymentBookings = bookingsToCheck
                .Where(b => b.PaymentStatus == PaymentStatus.OrderCreated
                         && b.PaymentExpiresAt.HasValue
                         && DateTime.UtcNow > b.PaymentExpiresAt.Value)
                .ToList();

            foreach (var booking in expiredPaymentBookings)
            {
                try
                {
                    booking.Status = BookingStatus.Cancelled;
                    booking.PaymentStatus = PaymentStatus.Expired;
                    booking.CancellationReason = "Auto-cancelled: payment window expired";
                    booking.CancelledAt = now;
                    booking.UpdatedAt = now;

                    await _bookingRepository.UpdateAsync(booking, cancellationToken);
                    updatedCount++;

                    _logger.LogInformation(
                        "Booking {BookingId} auto-cancelled: payment expired at {ExpiresAt}",
                        booking.Id, booking.PaymentExpiresAt);
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Error expiring payment for booking {BookingId}", booking.Id);
                }
            }

            // --- Refund status polling ---
            // Check refund status for bookings with RefundInitiated > 1 hour ago
            var refundBookings = bookingsToCheck
                .Where(b => b.PaymentStatus == PaymentStatus.RefundInitiated
                         && !string.IsNullOrEmpty(b.RazorpayRefundId)
                         && !string.IsNullOrEmpty(b.RazorpayPaymentId)
                         && b.CancelledAt.HasValue
                         && DateTime.UtcNow > b.CancelledAt.Value.AddHours(1))
                .ToList();

            foreach (var booking in refundBookings)
            {
                try
                {
                    var refundStatus = await _razorpayService.GetRefundStatusAsync(
                        booking.RazorpayPaymentId!, booking.RazorpayRefundId!);

                    if (refundStatus.Status == "processed")
                    {
                        booking.PaymentStatus = PaymentStatus.Refunded;
                        booking.UpdatedAt = now;
                        await _bookingRepository.UpdateAsync(booking, cancellationToken);
                        updatedCount++;

                        _logger.LogInformation(
                            "Booking {BookingId} refund confirmed: {RefundId} status={Status}",
                            booking.Id, booking.RazorpayRefundId, refundStatus.Status);
                    }
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Error checking refund status for booking {BookingId}", booking.Id);
                }
            }

            if (updatedCount > 0)
            {
                await _unitOfWork.SaveChangesAsync(cancellationToken);
                _logger.LogInformation("Successfully updated {Count} booking(s)", updatedCount);
            }
            else
            {
                _logger.LogInformation("No bookings required status updates");
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error during booking status update process");
            throw;
        }

        return updatedCount;
    }

    /// <summary>
    /// Determines the appropriate status for a booking based on current date/time and screen schedule.
    /// </summary>
    private BookingStatus DetermineBookingStatus(Booking booking, Screen screen, DateTime now)
    {
        var today = DateOnly.FromDateTime(now);
        var currentTime = now.TimeOfDay;

        // Check if we're before the booking period
        if (today < booking.StartDate)
        {
            return booking.Status; // Keep current status (should be Approved)
        }

        // Check if we're after the booking period
        if (today > booking.EndDate)
        {
            return BookingStatus.Completed;
        }

        // We're within the booking date range
        var currentDaySchedule = screen.Schedule.GetScheduleForDay(now.DayOfWeek);

        // If screen is not operating today
        if (!currentDaySchedule.IsOperating)
        {
            // If we were Active but screen is not operating, stay Active (will complete when period ends)
            // If we were Approved and screen is not operating, stay Approved (will activate when operating)
            return booking.Status;
        }

        // Check if we're on the end date
        if (today == booking.EndDate)
        {
            // If current time is past the end of operating hours, mark as completed
            if (currentTime >= currentDaySchedule.EndTime)
            {
                return BookingStatus.Completed;
            }
        }

        // Check if we're on the start date
        if (today == booking.StartDate)
        {
            // If current time is before operating hours start, stay Approved
            if (currentTime < currentDaySchedule.StartTime)
            {
                return BookingStatus.Approved;
            }
        }

        // We're within the booking period and within operating hours
        // OR we're after start date/time but before end date/time
        if ((today > booking.StartDate || 
            (today == booking.StartDate && currentTime >= currentDaySchedule.StartTime)) &&
            (today < booking.EndDate || 
            (today == booking.EndDate && currentTime < currentDaySchedule.EndTime)))
        {
            // Check if we're currently within operating hours
            if (currentTime >= currentDaySchedule.StartTime && currentTime < currentDaySchedule.EndTime)
            {
                return BookingStatus.Active;
            }
        }

        // Default: keep current status
        return booking.Status;
    }
}
