using System.ComponentModel.DataAnnotations.Schema;

namespace CCMS.Domain.Entities;

public class SlotAvailability : BaseEntity
{
    public Guid ScreenId { get; set; }
    public DateTime Date { get; set; }
    public int TotalSlots { get; set; }
    public int BookedSlots { get; set; }
    
    [NotMapped]
    public int AvailableSlots => TotalSlots - BookedSlots;
    
    // JSON column: {"1": "booking-id-1", "3": "booking-id-2"}
    // Stores which slot numbers are booked and their booking IDs
    public Dictionary<int, Guid?> SlotBookings { get; set; } = new();
    
    // Navigation properties
    public Screen Screen { get; set; } = null!;
}
