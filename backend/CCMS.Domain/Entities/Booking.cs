using CCMS.Domain.Enums;
using System.ComponentModel.DataAnnotations.Schema;
using System.Text.Json;

namespace CCMS.Domain.Entities;

public class Booking : BaseEntity
{
    public Guid ScreenId { get; set; }
    public Guid CampaignId { get; set; }
    public Guid CreativeId { get; set; }
    
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
    
    // Metrics
    public int ExpectedImpressions { get; set; }
    public int DeliveredImpressions { get; set; }
    
    // Pricing
    public decimal TotalPrice { get; set; }
    public string Currency { get; set; } = "INR";
    
    // Navigation properties
    public virtual Screen Screen { get; set; } = null!;
    public virtual Campaign Campaign { get; set; } = null!;
    public virtual Creative Creative { get; set; } = null!;
    public virtual ICollection<Impression> Impressions { get; set; } = new List<Impression>();
}
