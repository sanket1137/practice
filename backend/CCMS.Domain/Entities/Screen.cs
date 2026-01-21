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
    
    // Timezone for operating hours (IANA timezone identifier)
    // Examples: "Asia/Kolkata", "America/Los_Angeles", "Europe/London"
    public string Timezone { get; set; } = "UTC";
    
    // Operating schedule (stored as JSON)
    public OperatingSchedule Schedule { get; set; } = new();
    
    // Slot configuration
    public int TimeFrameMinutes { get; set; } // e.g., 1 minute
    public int SlotsPerFrame { get; set; }    // e.g., 6 ads per frame
    
    // Device information
    public string DeviceId { get; set; } = string.Empty;
    public DateTime? LastSyncAt { get; set; }
    public ScreenStatus Status { get; set; } = ScreenStatus.Active;
    
    // Online status tracking
    public bool IsOnline { get; set; } = false;
    public DateTime? LastSeenAt { get; set; }
    public string? ConnectedDeviceId { get; set; }
    public string? ApiKeyHash { get; set; } // Hashed API key for player authentication
    
    // Device binding for security
    public string? DeviceFingerprintHash { get; set; } // SHA256 hash of device fingerprint
    public DateTime? DeviceBoundAt { get; set; }
    public DateTime? LastDeviceVerification { get; set; }
    public string? PreviousDeviceFingerprintHash { get; set; } // For audit trail
    public string? DeviceOverrideReason { get; set; }
    public DateTime? DeviceOverrideAt { get; set; }
    public Guid? DeviceOverrideByUserId { get; set; }
    
    // Live streaming (WebRTC) - Commented out until database migration is applied
    // public bool LiveStreamingEnabled { get; set; } = false;
    // public DateTime? LastStreamedAt { get; set; }
    // public int CurrentViewerCount { get; set; } = 0;
    public int MaxViewers { get; set; } = 5; // Maximum concurrent live stream viewers
    
    // Default video for empty ad slots
    public string? DefaultVideoUrl { get; set; }  // URL to custom uploaded video
    public bool HasCustomDefaultVideo { get; set; } = false;
    public DateTime? DefaultVideoUploadedAt { get; set; }
    public long? DefaultVideoSizeBytes { get; set; }
    
    // Pricing
    public decimal PricePerSlot { get; set; }
    public string Currency { get; set; } = "USD";
    
    // Calculated fields (can be computed properties)
    public int ImpressionsPerSlot => CalculateImpressionsPerSlot();
    public int DailyTotalImpressions => ImpressionsPerSlot * SlotsPerFrame;
    
    // Tagging system - Last auto-tag generation timestamp
    public DateTime? LastTaggedAt { get; set; }
    public decimal? LastTaggedLatitude { get; set; }
    public decimal? LastTaggedLongitude { get; set; }
    
    // Navigation properties
    public virtual User Owner { get; set; } = null!;
    public virtual ICollection<Booking> Bookings { get; set; } = new List<Booking>();
    public virtual ICollection<Impression> Impressions { get; set; } = new List<Impression>();
    public virtual ICollection<ScreenTagAssignment> TagAssignments { get; set; } = new List<ScreenTagAssignment>();
    
    private int CalculateImpressionsPerSlot()
    {
        if (TimeFrameMinutes <= 0) return 0;
        
        // Calculate average operating hours per day
        var avgHoursPerDay = Schedule.GetAverageOperatingHoursPerDay();
        return (int)((avgHoursPerDay * 60) / TimeFrameMinutes);
    }
}
