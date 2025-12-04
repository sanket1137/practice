using CCMS.Domain.Enums;
using CCMS.Domain.ValueObjects;

namespace CCMS.Domain.Entities;

public class Screen : BaseEntity
{
    public Guid OwnerId { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    
    // Physical dimensions
    public decimal PhysicalWidth { get; set; }  // in feet or meters
    public decimal PhysicalHeight { get; set; }
    public string DimensionUnit { get; set; } = "feet"; // "feet" or "meters"
    
    // Screen resolution
    public int ResolutionWidth { get; set; }  // e.g., 1920
    public int ResolutionHeight { get; set; } // e.g., 1080
    
    // Location
    public Address Location { get; set; } = new();
    public decimal Latitude { get; set; }
    public decimal Longitude { get; set; }
    
    // Operating schedule (stored as JSON)
    public OperatingSchedule Schedule { get; set; } = new();
    
    // Slot configuration
    public int TimeFrameMinutes { get; set; } // e.g., 1 minute
    public int SlotsPerFrame { get; set; }    // e.g., 6 ads per frame
    
    // Device information
    public string DeviceId { get; set; } = string.Empty;
    public DateTime? LastSyncAt { get; set; }
    public ScreenStatus Status { get; set; } = ScreenStatus.Active;
    
    // Pricing
    public decimal PricePerSlot { get; set; }
    public string Currency { get; set; } = "USD";
    
    // Calculated fields (can be computed properties)
    public int ImpressionsPerSlot => CalculateImpressionsPerSlot();
    public int DailyTotalImpressions => ImpressionsPerSlot * SlotsPerFrame;
    
    // Navigation properties
    public virtual User Owner { get; set; } = null!;
    public virtual ICollection<Booking> Bookings { get; set; } = new List<Booking>();
    public virtual ICollection<Impression> Impressions { get; set; } = new List<Impression>();
    
    private int CalculateImpressionsPerSlot()
    {
        if (TimeFrameMinutes <= 0) return 0;
        
        // Calculate average operating hours per day
        var avgHoursPerDay = Schedule.GetAverageOperatingHoursPerDay();
        return (int)((avgHoursPerDay * 60) / TimeFrameMinutes);
    }
}
