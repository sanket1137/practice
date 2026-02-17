using CCMS.Domain.Entities;
using CCMS.Domain.Enums;

namespace CCMS.Domain.Helpers;

/// <summary>
/// Helper class for consistent booking status checks across the application
/// </ summary>
public static class BookingStatusHelper
{
    /// <summary>
    /// Get all "active" booking statuses (playing or scheduled to play)
    /// Use this when querying bookings for playlist generation or slot status
    /// </summary>
    public static BookingStatus[] GetActiveStatuses()
    {
        return new[]
        {
            BookingStatus.Approved,  // Scheduled to play (future or ongoing)
            BookingStatus.Active      // Currently playing (set by background service)
        };
    }
    
    /// <summary>
    /// Check if status is considered "active" for playlist generation
    /// </summary>
    public static bool IsActiveForPlaylist(this BookingStatus status)
    {
        return status == BookingStatus.Approved || status == BookingStatus.Active;
    }
    
    /// <summary>
    /// Check if booking is active for a given date (considers status AND date range)
    /// </summary>
    public static bool IsActiveOn(this Booking booking, DateTime date)
    {
        var dateOnly = DateOnly.FromDateTime(date);
        return booking.Status.IsActiveForPlaylist() &&
               booking.StartDate <= dateOnly &&
               booking.EndDate >= dateOnly;
    }
    
    /// <summary>
    /// Check if booking is currently active (right now)
    /// </summary>
    public static bool IsCurrentlyActive(this Booking booking)
    {
        var now = DateTime.UtcNow;
        return booking.IsActiveOn(now);
    }
    
    /// <summary>
    /// Get display name for status
    /// </summary>
    public static string GetDisplayName(this BookingStatus status)
    {
        return status switch
        {
            BookingStatus.Pending => "Pending Approval",
            BookingStatus.Approved => "Approved (Scheduled)",
            BookingStatus.Active => "Active (Playing Now)",
            BookingStatus.Completed => "Completed",
            BookingStatus.Cancelled => "Cancelled",
            BookingStatus.Rejected => "Rejected",
            _ => status.ToString()
        };
    }
    
    /// <summary>
    /// Check if status allows editing
    /// </summary>
    public static bool CanEdit(this BookingStatus status)
    {
        return status == BookingStatus.Pending || status == BookingStatus.Approved;
    }
    
    /// <summary>
    /// Check if status allows cancellation
    /// </summary>
    public static bool CanCancel(this BookingStatus status)
    {
        return status == BookingStatus.Pending || 
               status == BookingStatus.Approved || 
               status == BookingStatus.Active;
    }
}
