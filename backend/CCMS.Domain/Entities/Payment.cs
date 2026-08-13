using CCMS.Domain.Enums;

namespace CCMS.Domain.Entities;

public class Payment : BaseEntity
{
    public Guid BookingId { get; set; }
    public Guid UserId { get; set; }

    // Razorpay identifiers
    public string RazorpayOrderId { get; set; } = string.Empty;
    public string? RazorpayPaymentId { get; set; }
    public string? RazorpaySignature { get; set; }

    // Amount
    public decimal Amount { get; set; }
    public string Currency { get; set; } = "INR";

    // Status
    public PaymentStatus Status { get; set; } = PaymentStatus.None;

    // Gateway response (raw JSON from Razorpay)
    public string? GatewayResponse { get; set; }

    // Refund
    public DateTime? RefundedAt { get; set; }
    public decimal? RefundAmount { get; set; }

    // Navigation properties
    public virtual Booking Booking { get; set; } = null!;
    public virtual User User { get; set; } = null!;
}
