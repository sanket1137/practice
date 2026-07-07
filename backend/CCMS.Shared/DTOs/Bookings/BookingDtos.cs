namespace CCMS.Shared.DTOs.Bookings;

public class BookingDto
{
    public Guid Id { get; set; }
    public Guid ScreenId { get; set; }
    public string ScreenName { get; set; } = string.Empty;
    public Guid? CampaignId { get; set; }
    public string CampaignName { get; set; } = string.Empty;
    public Guid? AdvertiserId { get; set; }
    public Guid CreativeId { get; set; }
    public string CreativeName { get; set; } = string.Empty;
    public string? CreativeFileUrl { get; set; }
    public string? CreativeMimeType { get; set; }
    public string StartDate { get; set; } = string.Empty; // YYYY-MM-DD format
    public string EndDate { get; set; } = string.Empty;   // YYYY-MM-DD format
    public List<int> SlotNumbers { get; set; } = new();
    public string Status { get; set; } = string.Empty;
    public string? RejectionReason { get; set; }
    public int ExpectedImpressions { get; set; }
    public int DeliveredImpressions { get; set; }
    public decimal TotalPrice { get; set; }
    public string Currency { get; set; } = "INR";

    /// <summary>Fit mode the player applies if creative ≠ screen dimensions.</summary>
    public string FitMode { get; set; } = "SmartAdaptive";

    public DateTime CreatedAt { get; set; }
    public DateTime? ApprovedAt { get; set; }
    public Guid? CancelledBy { get; set; }
    public DateTime? CancelledAt { get; set; }
    public string? CancellationReason { get; set; }
    
    // Actual booked dates (for partial bookings)
    public List<string>? BookedDates { get; set; } // YYYY-MM-DD format
    public BookingDateBreakdown? DateBreakdown { get; set; }
    
    // Real-time analytics
    public int PlaysToday { get; set; }
    public int PlaysTotal { get; set; }
    public bool IsLive { get; set; }
    public DateTime? LastPlayed { get; set; }
    
    // Self-reserve fields
    public string Source { get; set; } = "Platform";
    public string? ClientName { get; set; }
    public string? ClientContact { get; set; }
    public string? InternalNotes { get; set; }
    public bool IsInternalPayment { get; set; }
}

public class BookingDateBreakdown
{
    public List<string> RequestedDates { get; set; } = new(); // YYYY-MM-DD format
    public List<string> AvailableDates { get; set; } = new();
    public List<string> UnavailableDates { get; set; } = new();
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
    public string StartDate { get; set; } = string.Empty; // YYYY-MM-DD format (date-only, no timezone issues)
    public string EndDate { get; set; } = string.Empty;   // YYYY-MM-DD format
    public int? SlotNumber { get; set; } // null = auto-assign, 1-6 = specific slot

    /// <summary>
    /// Optional fit mode the player should apply if the creative does not
    /// natively match the screen dimensions. Defaults to SmartAdaptive
    /// server-side when omitted. See CreativeFitMode.
    /// </summary>
    public Domain.Enums.CreativeFitMode? FitMode { get; set; }
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

public class CancelBookingRequest
{
    public string? Reason { get; set; }
}

public class UpdateBookingDatesRequest
{
    public string NewStartDate { get; set; } = string.Empty; // YYYY-MM-DD format
    public string NewEndDate { get; set; } = string.Empty;   // YYYY-MM-DD format
}
