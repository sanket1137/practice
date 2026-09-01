using System.ComponentModel.DataAnnotations;

namespace CCMS.Shared.DTOs.Payouts;

/// <summary>
/// Owner-facing earnings breakdown for one booking: the money split,
/// delivery progress, and every payout recorded against it.
/// </summary>
public class BookingEarningsDto
{
    public Guid BookingId { get; set; }
    public string BookingStatus { get; set; } = string.Empty;
    public string Currency { get; set; } = "INR";
    public decimal GrossAmount { get; set; }
    public decimal CommissionPercentage { get; set; }
    public decimal CommissionAmount { get; set; }
    public decimal NetToOwner { get; set; }
    /// <summary>Platform advance percentage applied on activation (e.g. 50).</summary>
    public decimal AdvancePercentage { get; set; }
    /// <summary>Self-reserved internal bookings never generate payouts.</summary>
    public bool IsInternal { get; set; }
    public int DeliveredImpressions { get; set; }
    public int ExpectedImpressions { get; set; }
    /// <summary>0–100, capped at 100. 100 when nothing was expected.</summary>
    public decimal DeliveryPercentage { get; set; }
    public List<BookingPayoutEntryDto> Payouts { get; set; } = new();
}

public class BookingPayoutEntryDto
{
    public Guid Id { get; set; }
    /// <summary>Advance | Final | Full</summary>
    public string Type { get; set; } = string.Empty;
    /// <summary>Pending | Processing | Completed | Failed</summary>
    public string Status { get; set; } = string.Empty;
    public decimal GrossAmount { get; set; }
    public decimal CommissionAmount { get; set; }
    public decimal NetAmount { get; set; }
    public decimal AdvancePercentage { get; set; }
    public string? AdminNotes { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime? ProcessedAt { get; set; }
}

public class PendingPayoutDto
{
    public Guid Id { get; set; }
    public Guid? BookingId { get; set; }
    public string PayoutType { get; set; } = string.Empty;
    public string ScreenName { get; set; } = string.Empty;
    public string? CampaignName { get; set; }
    public string ScreenOwnerName { get; set; } = string.Empty;
    public string ScreenOwnerEmail { get; set; } = string.Empty;
    public decimal GrossAmount { get; set; }
    public decimal CommissionPercentage { get; set; }
    public decimal CommissionAmount { get; set; }
    public decimal NetAmount { get; set; }
    public decimal AdvancePercentage { get; set; }
    public string Currency { get; set; } = "INR";
    public string Status { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; }
    public BankAccountSnapshotDto? BankAccount { get; set; }
}

public class PayoutDetailDto
{
    public Guid Id { get; set; }
    public Guid ScreenOwnerId { get; set; }
    public Guid? BookingId { get; set; }
    public string PayoutType { get; set; } = string.Empty;
    public decimal GrossAmount { get; set; }
    public decimal CommissionPercentage { get; set; }
    public decimal CommissionAmount { get; set; }
    public decimal NetAmount { get; set; }
    public decimal AdvancePercentage { get; set; }
    public string Currency { get; set; } = "INR";
    public string Status { get; set; } = string.Empty;
    public string? AdminNotes { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime? ProcessedAt { get; set; }

    // Booking details
    public BookingSnapshotDto? Booking { get; set; }
    // Screen owner details
    public OwnerSnapshotDto? ScreenOwner { get; set; }
    // Bank details
    public BankAccountSnapshotDto? BankAccount { get; set; }
    // Previous payouts for the same booking
    public List<RelatedPayoutDto> RelatedPayouts { get; set; } = new();
}

public class BookingSnapshotDto
{
    public Guid Id { get; set; }
    public string ScreenName { get; set; } = string.Empty;
    public string? CampaignName { get; set; }
    public string? CreativeName { get; set; }
    public string StartDate { get; set; } = string.Empty;
    public string EndDate { get; set; } = string.Empty;
    public decimal TotalPrice { get; set; }
    public string Status { get; set; } = string.Empty;
    public string PaymentStatus { get; set; } = string.Empty;
    public int TotalImpressions { get; set; }
}

public class OwnerSnapshotDto
{
    public Guid Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string? Phone { get; set; }
    public string? CompanyName { get; set; }
}

public class BankAccountSnapshotDto
{
    public string BeneficiaryName { get; set; } = string.Empty;
    public string AccountNumberMasked { get; set; } = string.Empty;
    public string IfscCode { get; set; } = string.Empty;
    public string BankName { get; set; } = string.Empty;
}

public class RelatedPayoutDto
{
    public Guid Id { get; set; }
    public string Type { get; set; } = string.Empty;
    public decimal NetAmount { get; set; }
    public string Status { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; }
    public DateTime? ProcessedAt { get; set; }
}

public class ProcessPayoutRequest
{
    [StringLength(2000)]
    public string? AdminNotes { get; set; }
}

public class ReleasePayoutRequest
{
    [Range(0, double.MaxValue)]
    public decimal? AdjustedNetAmount { get; set; }

    [StringLength(2000)]
    public string? AdminNotes { get; set; }
}

public class FailPayoutRequest
{
    [Required]
    [StringLength(1000)]
    public string Reason { get; set; } = string.Empty;
}
