using CCMS.Domain.Enums;

namespace CCMS.Domain.Entities;

public class Payout : BaseEntity
{
    public Guid ScreenOwnerId { get; set; }
    public Guid? BookingId { get; set; }

    // Payout type (advance/final/full)
    public PayoutType Type { get; set; } = PayoutType.Full;
    public decimal AdvancePercentage { get; set; }

    // Amounts
    public decimal GrossAmount { get; set; }
    public decimal CommissionPercentage { get; set; }
    public decimal CommissionAmount { get; set; }
    public decimal NetAmount { get; set; }
    public string Currency { get; set; } = "INR";

    // Status
    public PayoutStatus Status { get; set; } = PayoutStatus.Pending;

    // Razorpay payout
    public string? RazorpayPayoutId { get; set; }

    // Bank details (JSON snapshot at creation time)
    public string? BankAccountDetails { get; set; }

    // Period (nullable — not used for per-booking payouts)
    public DateOnly? PeriodStart { get; set; }
    public DateOnly? PeriodEnd { get; set; }

    // Processing
    public DateTime? ProcessedAt { get; set; }
    public string? AdminNotes { get; set; }

    // Navigation properties
    public virtual User ScreenOwner { get; set; } = null!;
    public virtual Booking? Booking { get; set; }
}
