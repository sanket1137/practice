using System.ComponentModel.DataAnnotations;

namespace CCMS.Shared.DTOs.Payments;

public class PaymentDto
{
    public Guid Id { get; set; }
    public Guid BookingId { get; set; }
    public Guid UserId { get; set; }
    public string RazorpayOrderId { get; set; } = string.Empty;
    public string? RazorpayPaymentId { get; set; }
    public decimal Amount { get; set; }
    public string Currency { get; set; } = "INR";
    public string Status { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; }
    public DateTime? RefundedAt { get; set; }
    public decimal? RefundAmount { get; set; }
}

public class CreateOrderRequest
{
    [Required]
    public Guid BookingId { get; set; }
}

public class CreateOrderResponse
{
    public string OrderId { get; set; } = string.Empty;
    public decimal Amount { get; set; }
    public string Currency { get; set; } = "INR";
    public string KeyId { get; set; } = string.Empty;
    public Guid BookingId { get; set; }
    public string? VirtualAccountNumber { get; set; }
    public string? VirtualAccountIfsc { get; set; }
    public DateTime? PaymentExpiresAt { get; set; }
}

public class VerifyPaymentRequest
{
    [Required]
    [StringLength(100)]
    public string RazorpayOrderId { get; set; } = string.Empty;

    [Required]
    [StringLength(100)]
    public string RazorpayPaymentId { get; set; } = string.Empty;

    [Required]
    [StringLength(500)]
    public string RazorpaySignature { get; set; } = string.Empty;

    [Required]
    public Guid BookingId { get; set; }
}

public class RefundRequest
{
    [Required]
    public Guid PaymentId { get; set; }

    [Range(1, double.MaxValue)]
    public decimal? Amount { get; set; }

    [StringLength(1000)]
    public string? Reason { get; set; }
}

public class BookingPaymentStatusDto
{
    public Guid BookingId { get; set; }
    public string PaymentStatus { get; set; } = string.Empty;
    public string? PaymentMethod { get; set; }
    public DateTime? PaymentExpiresAt { get; set; }
    public string? RazorpayOrderId { get; set; }
}

public class WalletDto
{
    public Guid Id { get; set; }
    public decimal Balance { get; set; }
    public string Currency { get; set; } = "INR";
    public DateTime? LastTopUpAt { get; set; }
}

public class WalletTransactionDto
{
    public Guid Id { get; set; }
    public string Type { get; set; } = string.Empty;
    public decimal Amount { get; set; }
    public string? Description { get; set; }
    public Guid? ReferenceId { get; set; }
    public string? ReferenceType { get; set; }
    public decimal BalanceBefore { get; set; }
    public decimal BalanceAfter { get; set; }
    public DateTime CreatedAt { get; set; }
}

public class TopUpWalletRequest
{
    [Range(1, double.MaxValue, ErrorMessage = "Amount must be greater than 0.")]
    public decimal Amount { get; set; }
}

public class PayoutDto
{
    public Guid Id { get; set; }
    public Guid ScreenOwnerId { get; set; }
    public decimal GrossAmount { get; set; }
    public decimal CommissionPercentage { get; set; }
    public decimal CommissionAmount { get; set; }
    public decimal NetAmount { get; set; }
    public string Currency { get; set; } = "INR";
    public string Status { get; set; } = string.Empty;
    public DateOnly? PeriodStart { get; set; }
    public DateOnly? PeriodEnd { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime? ProcessedAt { get; set; }
}

public class PayoutSummaryDto
{
    public decimal TotalGrossEarnings { get; set; }
    public decimal TotalCommission { get; set; }
    public decimal TotalNetEarnings { get; set; }
    public decimal PendingPayoutAmount { get; set; }
    public decimal CompletedPayoutAmount { get; set; }
    public string Currency { get; set; } = "INR";
}

public class RequestPayoutRequest
{
    [Required]
    public DateOnly PeriodStart { get; set; }

    [Required]
    public DateOnly PeriodEnd { get; set; }
}
