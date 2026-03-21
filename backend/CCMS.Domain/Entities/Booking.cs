using CCMS.Domain.Enums;
using System.ComponentModel.DataAnnotations.Schema;
using System.Text.Json;

namespace CCMS.Domain.Entities;

public class Booking : BaseEntity
{
    public Guid ScreenId { get; set; }
    public Guid? CampaignId { get; set; }
    public Guid CreativeId { get; set; }
    
    // Booking source (platform vs self-reserved)
    public BookingSource Source { get; set; } = BookingSource.Platform;
    
    // Booking period (date-only, times determined by screen operating hours)
    public DateOnly StartDate { get; set; }
    public DateOnly EndDate { get; set; }
    
    // Slot allocation (stored as JSON array, e.g., [1, 2, 3])
    // NOTE: This is kept for backward compatibility
    public List<int> SlotNumbers { get; set; } = new();
    
    // NEW: Per-day slot assignments (stored as JSON)
    // Maps each date to its assigned slot number
    public string? DailySlotAssignmentsJson { get; set; }
    
    [NotMapped]
    public Dictionary<DateTime, int>? DailySlotAssignments
    {
        get
        {
            if (string.IsNullOrEmpty(DailySlotAssignmentsJson))
                return null;
            
            try
            {
                return JsonSerializer.Deserialize<Dictionary<DateTime, int>>(DailySlotAssignmentsJson);
            }
            catch
            {
                return null;
            }
        }
        set
        {
            if (value == null || !value.Any())
            {
                DailySlotAssignmentsJson = null;
                return;
            }
            
            DailySlotAssignmentsJson = JsonSerializer.Serialize(value);
        }
    }
    
    // Status and approval
    public BookingStatus Status { get; set; } = BookingStatus.Pending;
    public string? RejectionReason { get; set; }
    public Guid? ApprovedBy { get; set; }
    public DateTime? ApprovedAt { get; set; }
    
    // Cancellation
    public Guid? CancelledBy { get; set; }
    public DateTime? CancelledAt { get; set; }
    public string? CancellationReason { get; set; }
    
    // Metrics
    public int ExpectedImpressions { get; set; }
    public int DeliveredImpressions { get; set; }
    
    // Pricing
    public decimal TotalPrice { get; set; }
    public string Currency { get; set; } = "INR";

    // Payment
    public PaymentStatus PaymentStatus { get; set; } = PaymentStatus.None;
    public string? RazorpayOrderId { get; set; }
    public string? RazorpayPaymentId { get; set; }
    public string? RazorpayRefundId { get; set; }
    public string? PaymentMethod { get; set; } // "UPI" | "BankTransfer"
    public DateTime? PaymentExpiresAt { get; set; }
    public string? VirtualAccountNumber { get; set; }
    public string? VirtualAccountIfsc { get; set; }

    // Self-reserved booking fields
    public string? ClientName { get; set; }
    public string? ClientContact { get; set; }
    public string? InternalNotes { get; set; }
    public bool IsInternalPayment { get; set; }
    
    // Navigation properties
    public virtual Screen Screen { get; set; } = null!;
    public virtual Campaign? Campaign { get; set; }
    public virtual Creative Creative { get; set; } = null!;
    public virtual ICollection<Impression> Impressions { get; set; } = new List<Impression>();
    public virtual ICollection<Payment> Payments { get; set; } = new List<Payment>();
    public virtual ICollection<Payout> Payouts { get; set; } = new List<Payout>();
}
