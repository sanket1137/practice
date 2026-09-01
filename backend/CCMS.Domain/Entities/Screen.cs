using CCMS.Domain.Enums;
using CCMS.Domain.ValueObjects;

namespace CCMS.Domain.Entities;

public class Screen : BaseEntity
{
    public Guid OwnerId { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    
    // What the physical asset is (billboard, video wall, TV, ...). Orthogonal
    // to DisplayType, which describes the environment (indoor/outdoor).
    public ScreenType ScreenType { get; set; } = ScreenType.Unclassified;

    // Physical dimensions. PhysicalWidth/Height + DimensionUnit are what the
    // owner typed ("feet" | "inches" | "meters" | "centimeters"); the *Mm
    // columns are the canonical millimetre values every search filter, sort
    // and comparison must use so unit math never leaks into queries.
    public decimal PhysicalWidth { get; set; }
    public decimal PhysicalHeight { get; set; }
    public string DimensionUnit { get; set; } = "feet";
    public int? PhysicalWidthMm { get; set; }
    public int? PhysicalHeightMm { get; set; }

    // LED pixel pitch in millimetres (P2.5 = 2.5) — the first spec an
    // experienced buyer asks about an LED asset. Only meaningful for
    // Billboard / LedWall / VideoWall types.
    public decimal? PixelPitchMm { get; set; }

    // Screen resolution
    public int ResolutionWidth { get; set; }  // e.g., 1920
    public int ResolutionHeight { get; set; } // e.g., 1080
    
    // Location
    public Address Location { get; set; } = new();
    public decimal Latitude { get; set; }
    public decimal Longitude { get; set; }
    
    // Timezone for operating hours (IANA timezone identifier)
    // Examples: "Asia/Kolkata", "America/Los_Angeles", "Europe/London"
    public string Timezone { get; set; } = "Asia/Kolkata";
    
    // Operating schedule (stored as JSON)
    public OperatingSchedule Schedule { get; set; } = new();
    
    // Slot configuration
    public int TimeFrameMinutes { get; set; } // e.g., 1 minute
    public int SlotsPerFrame { get; set; }    // e.g., 6 ads per frame
    
    // Device information
    public string DeviceId { get; set; } = string.Empty;
    public DateTime? LastSyncAt { get; set; }

    // Lifecycle state. Screens are born Draft and only reach Active through
    // ScreenLifecycleService's guarded transitions (verification, device
    // pairing). The old default of Active let unverified, deviceless screens
    // straight into the marketplace — never restore it.
    public ScreenStatus Status { get; set; } = ScreenStatus.Draft;
    
    // Online status tracking
    public bool IsOnline { get; set; } = false;
    public DateTime? LastSeenAt { get; set; }
    public string? ConnectedDeviceId { get; set; }
    public string? ApiKeyHash { get; set; } // Hashed API key for player authentication

    // Zero-downtime key rotation: on rotate, the outgoing hash moves here and
    // stays valid for a 24h grace window (see ScreenApiKeys.Verify), so the
    // player can be reconfigured without the screen ever going offline.
    public string? ApiKeyHashPrevious { get; set; }
    public DateTime? ApiKeyRotatedAt { get; set; }

    // Sync health: how many impressions the player is still holding locally,
    // self-reported with each heartbeat. Lets the owner see "all plays
    // reported" (or a growing backlog) without SSHing into the device.
    public int? PendingImpressionsCount { get; set; }
    public DateTime? PendingImpressionsAt { get; set; }
    
    // Device binding for security
    public string? DeviceFingerprintHash { get; set; } // SHA256 hash of device fingerprint
    public DateTime? DeviceBoundAt { get; set; }
    public DateTime? LastDeviceVerification { get; set; }
    public string? PreviousDeviceFingerprintHash { get; set; } // For audit trail
    public string? DeviceOverrideReason { get; set; }
    public DateTime? DeviceOverrideAt { get; set; }
    public Guid? DeviceOverrideByUserId { get; set; }
    
    // Live streaming (WebRTC)
    public bool LiveStreamingEnabled { get; set; } = false;
    public DateTime? LastStreamedAt { get; set; }
    public int CurrentViewerCount { get; set; } = 0;
    public int MaxViewers { get; set; } = 5; // Maximum concurrent live stream viewers
    
    // Default video for empty ad slots
    public string? DefaultVideoUrl { get; set; }  // URL to custom uploaded video
    public bool HasCustomDefaultVideo { get; set; } = false;
    public DateTime? DefaultVideoUploadedAt { get; set; }
    public long? DefaultVideoSizeBytes { get; set; }
    
    // Pricing
    public decimal PricePerSlot { get; set; }
    public string Currency { get; set; } = "INR";
    public decimal CommissionPercentage { get; set; } = 15m; // Platform commission %
    
    // Calculated fields (can be computed properties)
    public int ImpressionsPerSlot => CalculateImpressionsPerSlot();
    public int DailyTotalImpressions => ImpressionsPerSlot * SlotsPerFrame;
    
    // Screen verification (QR-based physical verification)
    public ScreenVerificationStatus VerificationStatus { get; set; } = ScreenVerificationStatus.Unverified;
    public DateTime? VerifiedAt { get; set; }
    public Guid? VerifiedByAdminUserId { get; set; }
    public string? ActiveQrChallengeCode { get; set; }
    public DateTime? QrChallengeExpiresAt { get; set; }
    public Guid? LastVerificationId { get; set; }
    
    // Tagging system - Last auto-tag generation timestamp
    public DateTime? LastTaggedAt { get; set; }
    public decimal? LastTaggedLatitude { get; set; }
    public decimal? LastTaggedLongitude { get; set; }

    // ── CMS mode additions ────────────────────────────────────────────────
    /// <summary>
    /// Currently-assigned default playlist. Plays whenever no schedule is active.
    /// Only relevant for CMS-mode screens. Nullable until the owner creates one.
    /// </summary>
    public Guid? DefaultPlaylistId { get; set; }

    /// <summary>Free-text location tag, e.g. "Floor 1 - Main Entrance".</summary>
    public string? LocationTag { get; set; }

    public ScreenDisplayType DisplayType { get; set; } = ScreenDisplayType.Indoor;

    /// <summary>Physical orientation of the screen panel.</summary>
    public ScreenOrientation Orientation { get; set; } = ScreenOrientation.Landscape;

    /// <summary>
    /// When true, new bookings on this screen are automatically approved without manual review.
    /// A 2-hour grace-cancel window applies.
    /// </summary>
    public bool AutoApprovalEnabled { get; set; } = false;

    /// <summary>
    /// Audience Quality Score (0–100). Computed nightly by AQSCalculationJob.
    /// Formula: (footfall × 0.40) + (uptime × 0.25) + (fillRate × 0.25) + (review × 0.10)
    /// </summary>
    public decimal AudienceQualityScore { get; set; } = 0m;

    // Navigation properties
    public virtual User Owner { get; set; } = null!;
    public virtual ICollection<Booking> Bookings { get; set; } = new List<Booking>();
    public virtual ICollection<Impression> Impressions { get; set; } = new List<Impression>();
    public virtual ICollection<ScreenTagAssignment> TagAssignments { get; set; } = new List<ScreenTagAssignment>();
    public virtual ICollection<ScreenImage> Images { get; set; } = new List<ScreenImage>();
    public virtual ICollection<ScreenVerification> Verifications { get; set; } = new List<ScreenVerification>();
    public virtual ScreenVerification? LastVerification { get; set; }
    public virtual Playlist? DefaultPlaylist { get; set; }
    public virtual ICollection<Playlist> Playlists { get; set; } = new List<Playlist>();
    public virtual ICollection<RemoteCommand> RemoteCommands { get; set; } = new List<RemoteCommand>();

    /// <summary>
    /// Operating mode derived from the owner's <see cref="AccountType"/>.
    /// Not a stored column — always resolved via the Owner relationship.
    /// </summary>
    public ScreenMode Mode => Owner?.AccountType == AccountType.CmsOwner
        ? ScreenMode.Cms
        : ScreenMode.Dooh;

    private int CalculateImpressionsPerSlot()
    {
        if (TimeFrameMinutes <= 0) return 0;
        
        // Calculate average operating hours per day
        var avgHoursPerDay = Schedule.GetAverageOperatingHoursPerDay();
        return (int)((avgHoursPerDay * 60) / TimeFrameMinutes);
    }
}
