namespace CCMS.Shared.DTOs.Payouts;

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
    public string? AdminNotes { get; set; }
}

public class ReleasePayoutRequest
{
    public decimal? AdjustedNetAmount { get; set; }
    public string? AdminNotes { get; set; }
}

public class FailPayoutRequest
{
    public string Reason { get; set; } = string.Empty;
}
