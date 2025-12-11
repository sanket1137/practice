namespace CCMS.Shared.DTOs.Bookings;

public class BookingDto
{
    public Guid Id { get; set; }
    public Guid ScreenId { get; set; }
    public string ScreenName { get; set; } = string.Empty;
    public Guid CampaignId { get; set; }
    public string CampaignName { get; set; } = string.Empty;
    public Guid CreativeId { get; set; }
    public string CreativeName { get; set; } = string.Empty;
    public string? CreativeFileUrl { get; set; }
    public string? CreativeMimeType { get; set; }
    public DateTime StartDate { get; set; }
    public DateTime EndDate { get; set; }
    public List<int> SlotNumbers { get; set; } = new();
    public string Status { get; set; } = string.Empty;
    public string? RejectionReason { get; set; }
    public int ExpectedImpressions { get; set; }
    public int DeliveredImpressions { get; set; }
    public decimal TotalPrice { get; set; }
    public string Currency { get; set; } = "USD";
    public DateTime CreatedAt { get; set; }
    public DateTime? ApprovedAt { get; set; }
    
    // NEW: Actual booked dates (for partial bookings)
    public List<DateTime>? BookedDates { get; set; }
    public BookingDateBreakdown? DateBreakdown { get; set; }
}

public class BookingDateBreakdown
{
    public List<DateTime> RequestedDates { get; set; } = new();
    public List<DateTime> AvailableDates { get; set; } = new();
    public List<DateTime> UnavailableDates { get; set; } = new();
    public int TotalRequested { get; set; }
    public int TotalAvailable { get; set; }
    public int TotalUnavailable { get; set; }
    public bool IsPartialBooking { get; set; }
}

public class CreateBookingRequest
{
    public Guid ScreenId { get; set; }
    public Guid CampaignId { get; set; }
    public Guid CreativeId { get; set; }
    public DateTime StartDate { get; set; }
    public DateTime EndDate { get; set; }
    public int? SlotNumber { get; set; } // null = auto-assign, 1-6 = specific slot
}

public class ApproveBookingRequest
{
    public Guid BookingId { get; set; }
}

public class RejectBookingRequest
{
    public Guid BookingId { get; set; }
    public string Reason { get; set; } = string.Empty;
}
