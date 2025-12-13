namespace CCMS.Domain.Enums;

public enum BookingStatus
{
    Pending = 0,
    Approved = 1,
    Rejected = 2,
    Cancelled = 3,
    Active = 4,      // Booking is currently running
    Completed = 5    // Booking has finished
}
