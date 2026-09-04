using System.ComponentModel.DataAnnotations;

namespace CCMS.Shared.DTOs.Screens;

public class ScreenDto
{
    public Guid Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    /// <summary>Billboard | LedWall | VideoWall | TvDisplay | Kiosk | Projection | TransitDisplay | Standee | Unclassified</summary>
    public string ScreenType { get; set; } = "Unclassified";
    public string VenueType { get; set; } = "Unclassified";
    public decimal PhysicalWidth { get; set; }
    public decimal PhysicalHeight { get; set; }
    /// <summary>feet | inches | meters | centimeters</summary>
    public string DimensionUnit { get; set; } = "feet";
    /// <summary>LED pixel pitch in millimetres (P2.5 = 2.5). Only meaningful for LED asset types.</summary>
    public decimal? PixelPitchMm { get; set; }
    public int ResolutionWidth { get; set; }
    public int ResolutionHeight { get; set; }
    public AddressDto Location { get; set; } = new();
    public decimal Latitude { get; set; }
    public decimal Longitude { get; set; }
    public OperatingScheduleDto Schedule { get; set; } = new();
    public int TimeFrameMinutes { get; set; }
    public int SlotsPerFrame { get; set; }
    public string DeviceId { get; set; } = string.Empty;
    public string Status { get; set; } = string.Empty;
    public decimal PricePerSlot { get; set; }
    public string Currency { get; set; } = "USD";
    public string Timezone { get; set; } = "UTC"; // IANA timezone identifier (e.g., "Asia/Kolkata", "America/New_York")
    public int ImpressionsPerSlot { get; set; }
    public int DailyTotalImpressions { get; set; }
    public RevenueEstimateDto? RevenueEstimate { get; set; }
    public bool HasApiKey { get; set; }
    public int BookedSlots { get; set; } // Number of booked slots for today
    public int ActiveBookings { get; set; } // Number of active bookings for today
    public DateTime? LastSyncAt { get; set; }
    public bool IsOnline { get; set; }
    public DateTime? LastSeenAt { get; set; }
    public DateTime CreatedAt { get; set; }
    
    // Tagging system
    public List<ScreenTagSummaryDto> Tags { get; set; } = new();
    public List<ScreenTagSummaryDto> PrimaryTags { get; set; } = new();
    public DateTime? LastTaggedAt { get; set; }
    
    // Images
    public List<ScreenImageDto> Images { get; set; } = new();
    public ScreenImageDto? PrimaryImage { get; set; }

    // Display characteristics (Phase 2)
    /// <summary>Indoor | Outdoor | SemiIndoor</summary>
    public string DisplayType { get; set; } = "Indoor";
    /// <summary>Landscape | Portrait</summary>
    public string Orientation { get; set; } = "Landscape";
    /// <summary>Verified | Pending | Rejected</summary>
    public string? VerificationStatus { get; set; }
    /// <summary>Distance from a reference lat/lng when supplied in the search request. Null when no reference given.</summary>
    public double? DistanceKm { get; set; }
    /// <summary>Cost per 1000 impressions (PricePerSlot / ImpressionsPerSlot * 1000). Null when ImpressionsPerSlot is 0.</summary>
    public decimal? Cpm { get; set; }
    /// <summary>Average operating hours per day across the weekly schedule.</summary>
    public double? AverageOperatingHoursPerDay { get; set; }
    /// <summary>Display screen owner name (organization / individual). Limited fields, never email/phone.</summary>
    public string? OwnerDisplayName { get; set; }
    /// <summary>Whether the screen owner is verified on the platform.</summary>
    public bool OwnerIsVerified { get; set; }
}

public class CreateScreenRequest
{
    [Required]
    [StringLength(200)]
    public string Name { get; set; } = string.Empty;

    [StringLength(2000)]
    public string Description { get; set; } = string.Empty;

    /// <summary>Billboard | LedWall | VideoWall | TvDisplay | Kiosk | Projection | TransitDisplay | Standee</summary>
    [StringLength(30)]
    public string? ScreenType { get; set; }

    /// <summary>Venue the screen lives in: Cafe | Restaurant | Mall | Gym | Airport | ... (see VenueType enum).</summary>
    [StringLength(30)]
    public string? VenueType { get; set; }

    [Range(0.01, double.MaxValue)]
    public decimal PhysicalWidth { get; set; }

    [Range(0.01, double.MaxValue)]
    public decimal PhysicalHeight { get; set; }

    /// <summary>feet | inches | meters | centimeters (short aliases accepted)</summary>
    [StringLength(20)]
    public string DimensionUnit { get; set; } = "feet";

    /// <summary>LED pixel pitch in millimetres, e.g. 2.5 for P2.5.</summary>
    [Range(0.1, 100)]
    public decimal? PixelPitchMm { get; set; }

    [Range(1, int.MaxValue)]
    public int ResolutionWidth { get; set; }

    [Range(1, int.MaxValue)]
    public int ResolutionHeight { get; set; }

    [Required]
    public AddressDto Location { get; set; } = new();
    public decimal Latitude { get; set; }
    public decimal Longitude { get; set; }
    public OperatingScheduleDto Schedule { get; set; } = new();

    [Range(1, int.MaxValue)]
    public int TimeFrameMinutes { get; set; }

    [Range(1, int.MaxValue)]
    public int SlotsPerFrame { get; set; }

    [StringLength(200)]
    public string DeviceId { get; set; } = string.Empty;

    [Range(0, double.MaxValue)]
    public decimal PricePerSlot { get; set; }

    [Required]
    [StringLength(10)]
    public string Currency { get; set; } = "USD";

    [Required]
    [StringLength(100)]
    public string Timezone { get; set; } = "UTC"; // IANA timezone identifier (e.g., "Asia/Kolkata", "America/New_York")

    // Manual tags to add during creation
    public List<Guid>? ManualTagIds { get; set; }
}

public class UpdateScreenRequest
{
    [StringLength(200)]
    public string? Name { get; set; }

    [StringLength(2000)]
    public string? Description { get; set; }

    [StringLength(30)]
    public string? ScreenType { get; set; }

    /// <summary>Cafe | Restaurant | Mall | Gym | Airport | ... (see VenueType enum).</summary>
    [StringLength(30)]
    public string? VenueType { get; set; }

    [Range(0.01, double.MaxValue)]
    public decimal? PhysicalWidth { get; set; }

    [Range(0.01, double.MaxValue)]
    public decimal? PhysicalHeight { get; set; }

    [StringLength(20)]
    public string? DimensionUnit { get; set; }

    [Range(0.1, 100)]
    public decimal? PixelPitchMm { get; set; }

    [Range(1, int.MaxValue)]
    public int? ResolutionWidth { get; set; }

    [Range(1, int.MaxValue)]
    public int? ResolutionHeight { get; set; }
    public AddressDto? Location { get; set; }
    public decimal? Latitude { get; set; }
    public decimal? Longitude { get; set; }
    public OperatingScheduleDto? Schedule { get; set; }

    [Range(1, int.MaxValue)]
    public int? TimeFrameMinutes { get; set; }

    [Range(1, int.MaxValue)]
    public int? SlotsPerFrame { get; set; }

    [Range(0, double.MaxValue)]
    public decimal? PricePerSlot { get; set; }

    /// <summary>DEPRECATED and ignored: screen status is managed exclusively by the
    /// lifecycle endpoints (/screens/{id}/lifecycle/*). Kept so older clients that
    /// still send it keep deserializing.</summary>
    [StringLength(50)]
    public string? Status { get; set; }

    [StringLength(100)]
    public string? Timezone { get; set; } // IANA timezone identifier (e.g., "Asia/Kolkata", "America/New_York")

    // Tags to add/remove during update
    public List<Guid>? AddTagIds { get; set; }
    public List<Guid>? RemoveTagIds { get; set; }
}

public class AddressDto
{
    [StringLength(300)]
    public string Street { get; set; } = string.Empty;

    [Required]
    [StringLength(100)]
    public string City { get; set; } = string.Empty;

    [StringLength(100)]
    public string State { get; set; } = string.Empty;

    [Required]
    [StringLength(100)]
    public string Country { get; set; } = string.Empty;

    [StringLength(20)]
    public string PostalCode { get; set; } = string.Empty;
}

/// <summary>
/// Payload sent when upgrading a CMS screen to CCMS (MediaOwner marketplace) mode.
/// Provides the marketplace-required fields that CMS registration skips.
/// </summary>
public class UpgradeScreenToMarketplaceRequest
{
    public decimal PricePerSlot { get; set; }
    public AddressDto Location { get; set; } = new();
    public decimal Latitude { get; set; }
    public decimal Longitude { get; set; }
    public string Timezone { get; set; } = "Asia/Kolkata";
    public OperatingScheduleDto Schedule { get; set; } = new();
    public int TimeFrameMinutes { get; set; } = 10;
    public int SlotsPerFrame { get; set; } = 6;
}

public class UpdateScreenSettingsRequest
{
    public bool AutoApprovalEnabled { get; set; }
}

public class DayScheduleDto
{
    public string StartTime { get; set; } = "09:00"; // HH:mm format
    public string EndTime { get; set; } = "22:00";
    public bool IsOperating { get; set; }
}

public class OperatingScheduleDto
{
    public DayScheduleDto Monday { get; set; } = new();
    public DayScheduleDto Tuesday { get; set; } = new();
    public DayScheduleDto Wednesday { get; set; } = new();
    public DayScheduleDto Thursday { get; set; } = new();
    public DayScheduleDto Friday { get; set; } = new();
    public DayScheduleDto Saturday { get; set; } = new();
    public DayScheduleDto Sunday { get; set; } = new();
}

// ==========================================
// TAG DTOs
// ==========================================

/// <summary>
/// Summary DTO for displaying tags on screen cards
/// </summary>
public class ScreenTagSummaryDto
{
    public Guid TagId { get; set; }
    public string Slug { get; set; } = string.Empty;
    public string DisplayName { get; set; } = string.Empty;
    public string Category { get; set; } = string.Empty;
    public string? IconName { get; set; }
    public string? ColorCode { get; set; }
    public bool IsPrimary { get; set; }
    public string Source { get; set; } = string.Empty;
}

/// <summary>
/// Detailed tag information for tag management
/// </summary>
public class ScreenTagDetailDto
{
    public Guid TagId { get; set; }
    public string Slug { get; set; } = string.Empty;
    public string DisplayName { get; set; } = string.Empty;
    public string Category { get; set; } = string.Empty;
    public string? Description { get; set; }
    public string? IconName { get; set; }
    public string? ColorCode { get; set; }
    public bool IsPrimary { get; set; }
    public int Score { get; set; }
    public string Source { get; set; } = string.Empty;
    public int? DistanceMeters { get; set; }
    public int? PoiCount { get; set; }
    public DateTime AssignedAt { get; set; }
}

/// <summary>
/// Master tag for selection/autocomplete
/// </summary>
public class MasterTagDto
{
    public Guid Id { get; set; }
    public string Slug { get; set; } = string.Empty;
    public string DisplayName { get; set; } = string.Empty;
    public string Category { get; set; } = string.Empty;
    public string? Description { get; set; }
    public string? IconName { get; set; }
    public string? ColorCode { get; set; }
    public int Priority { get; set; }

    /// <summary>
    /// Number of currently active (verified, public, not-deleted) screens carrying this tag.
    /// Populated only when the catalog endpoint is called with includeScreenCounts=true.
    /// </summary>
    public int? ScreenCount { get; set; }
}

/// <summary>
/// Location autocomplete suggestion sourced from active marketplace screens.
/// </summary>
public class LocationSuggestionDto
{
    /// <summary>Human-readable label (e.g. "Mumbai, Maharashtra").</summary>
    public string Label { get; set; } = string.Empty;
    /// <summary>"city" or "state".</summary>
    public string Kind { get; set; } = "city";
    public string? City { get; set; }
    public string? State { get; set; }
    public int ScreenCount { get; set; }
    /// <summary>Geographic centroid (average lat) of screens in this city/state. Used by frontend to auto-anchor the map.</summary>
    public decimal? CenterLatitude { get; set; }
    /// <summary>Geographic centroid (average lng) of screens in this city/state.</summary>
    public decimal? CenterLongitude { get; set; }
}

/// <summary>
/// Request to add a manual tag
/// </summary>
public class AddTagRequest
{
    public Guid TagId { get; set; }
}

/// <summary>
/// Result of tag generation
/// </summary>
public class GenerateTagsResult
{
    public bool Success { get; set; }
    public string? Error { get; set; }
    public string? Message { get; set; }
    public int TagsGenerated { get; set; }
    public List<string> PrimaryTags { get; set; } = new();
    public bool FromCache { get; set; }
    public int TotalPoisFound { get; set; }
}

// ==========================================
// SEARCH DTOs
// ==========================================

/// <summary>
/// Request for searching/filtering screens (advertisers)
/// </summary>
public class SearchScreensRequest
{
    /// <summary>
    /// Text search on name, description, city
    /// </summary>
    public string? SearchText { get; set; }
    
    /// <summary>
    /// Filter by city
    /// </summary>
    public string? City { get; set; }
    
    /// <summary>
    /// Filter by state
    /// </summary>
    public string? State { get; set; }
    
    /// <summary>
    /// Filter by country
    /// </summary>
    public string? Country { get; set; }
    
    /// <summary>
    /// Center latitude for radius search
    /// </summary>
    public decimal? Latitude { get; set; }
    
    /// <summary>
    /// Center longitude for radius search
    /// </summary>
    public decimal? Longitude { get; set; }
    
    /// <summary>
    /// Radius in km for location search (default: 10)
    /// </summary>
    public int? RadiusKm { get; set; }
    
    /// <summary>
    /// Filter by tag IDs (AND logic - screen must have ALL tags)
    /// </summary>
    public List<Guid>? RequiredTagIds { get; set; }
    
    /// <summary>
    /// Filter by tag IDs (OR logic - screen must have ANY of these tags)
    /// </summary>
    public List<Guid>? AnyTagIds { get; set; }
    
    /// <summary>
    /// Filter by tag category
    /// </summary>
    public string? TagCategory { get; set; }
    
    /// <summary>
    /// Minimum price per slot
    /// </summary>
    public decimal? MinPrice { get; set; }
    
    /// <summary>
    /// Maximum price per slot
    /// </summary>
    public decimal? MaxPrice { get; set; }
    
    /// <summary>
    /// Filter by screen status
    /// </summary>
    public string? Status { get; set; }
    
    /// <summary>
    /// Page number (1-based)
    /// </summary>
    public int Page { get; set; } = 1;
    
    /// <summary>
    /// Page size (default: 20, max: 100)
    /// </summary>
    public int PageSize { get; set; } = 20;
    
    /// <summary>
    /// Sort by field: "name", "price", "distance", "impressions", "cpm", "created"
    /// </summary>
    public string? SortBy { get; set; }
    
    /// <summary>
    /// Sort direction: "asc" or "desc"
    /// </summary>
    public string? SortDirection { get; set; }

    // ---------- Phase 2 advertiser-discovery filters ----------

    /// <summary>Map viewport bounding box. When supplied, screens must fall inside the box. Combine with radius for a tighter filter.</summary>
    public BoundingBox? BoundingBox { get; set; }

    /// <summary>Indoor | Outdoor | SemiIndoor (case-insensitive). Null = any.</summary>
    public string? DisplayType { get; set; }
    /// <summary>Billboard | LedWall | VideoWall | TvDisplay | Kiosk | Projection | TransitDisplay | Standee</summary>
    public string? ScreenType { get; set; }
    /// <summary>Venue filter: Cafe | Restaurant | Mall | Gym | Airport | ...</summary>
    public string? VenueType { get; set; }

    /// <summary>Landscape | Portrait (case-insensitive). Null = any.</summary>
    public string? Orientation { get; set; }

    /// <summary>Minimum resolution width in pixels.</summary>
    public int? MinResolutionWidth { get; set; }

    /// <summary>Minimum resolution height in pixels.</summary>
    public int? MinResolutionHeight { get; set; }

    /// <summary>Minimum daily total impressions.</summary>
    public int? MinDailyImpressions { get; set; }

    /// <summary>Maximum daily total impressions.</summary>
    public int? MaxDailyImpressions { get; set; }

    /// <summary>Minimum CPM (price per 1000 impressions).</summary>
    public decimal? MinCpm { get; set; }

    /// <summary>Maximum CPM (price per 1000 impressions).</summary>
    public decimal? MaxCpm { get; set; }

    /// <summary>Screen must have at least one free slot on every day inside [AvailableFrom, AvailableTo]. Inclusive.</summary>
    public DateOnly? AvailableFrom { get; set; }

    /// <summary>See AvailableFrom.</summary>
    public DateOnly? AvailableTo { get; set; }

    /// <summary>If true, only screens currently reporting IsOnline=true are returned.</summary>
    public bool? OnlineOnly { get; set; }

    /// <summary>Hour-of-day (0-23, local-to-screen timezone). Screen must be operating at that hour on at least one day of the week.</summary>
    public int? OperatingAtHour { get; set; }
}

/// <summary>
/// Paginated search results
/// </summary>
public class SearchScreensResult
{
    public List<ScreenDto> Screens { get; set; } = new();
    public int TotalCount { get; set; }
    public int Page { get; set; }
    public int PageSize { get; set; }
    public int TotalPages { get; set; }
}

// ==========================================
// PUBLIC EXPLORE DTOs (No Auth Required)
// ==========================================

/// <summary>
/// Bounding box for map viewport search
/// </summary>
public class BoundingBox
{
    public decimal North { get; set; }
    public decimal South { get; set; }
    public decimal East { get; set; }
    public decimal West { get; set; }
}

/// <summary>
/// Request for public screen exploration (no auth required)
/// </summary>
public class PublicSearchScreensRequest
{
    /// <summary>
    /// Text search on name, city
    /// </summary>
    public string? SearchText { get; set; }
    
    /// <summary>
    /// Filter by city
    /// </summary>
    public string? City { get; set; }
    
    /// <summary>
    /// Filter by state
    /// </summary>
    public string? State { get; set; }
    
    /// <summary>
    /// Filter by country
    /// </summary>
    public string? Country { get; set; }
    
    /// <summary>
    /// Bounding box for map viewport
    /// </summary>
    public BoundingBox? BoundingBox { get; set; }
    
    /// <summary>
    /// Center latitude for radius search
    /// </summary>
    public decimal? Latitude { get; set; }
    
    /// <summary>
    /// Center longitude for radius search
    /// </summary>
    public decimal? Longitude { get; set; }
    
    /// <summary>
    /// Radius in km for location search
    /// </summary>
    public int? RadiusKm { get; set; }
    
    /// <summary>
    /// Filter by tag category
    /// </summary>
    public string? TagCategory { get; set; }
    
    /// <summary>
    /// Minimum price per slot
    /// </summary>
    public decimal? MinPrice { get; set; }
    
    /// <summary>
    /// Maximum price per slot
    /// </summary>
    public decimal? MaxPrice { get; set; }
    
    /// <summary>
    /// Page number (1-based)
    /// </summary>
    public int Page { get; set; } = 1;
    
    /// <summary>
    /// Page size (default: 100, max: 500 for map)
    /// </summary>
    public int PageSize { get; set; } = 100;
    
    /// <summary>
    /// Sort by field: "name", "price"
    /// </summary>
    public string? SortBy { get; set; }
    
    /// <summary>
    /// Sort direction: "asc" or "desc"
    /// </summary>
    public string? SortDirection { get; set; }
}

/// <summary>
/// Public screen data with limited information (no owner details, no revenue)
/// </summary>
public class PublicScreenDto
{
    public Guid Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? City { get; set; }
    public string? State { get; set; }
    public string? Country { get; set; }
    public decimal? Latitude { get; set; }
    public decimal? Longitude { get; set; }
    /// <summary>
    /// Price range indicator: "Budget", "Standard", "Premium", "Enterprise"
    /// </summary>
    public string? PriceRange { get; set; }
    /// <summary>
    /// Starting price for display
    /// </summary>
    public decimal? StartingPrice { get; set; }
    public string? Currency { get; set; }
    public bool IsOnline { get; set; }
    public string? PrimaryTagCategory { get; set; }
    public string? PrimaryTagName { get; set; }
    /// <summary>
    /// Primary image URL for display
    /// </summary>
    public string? PrimaryImageUrl { get; set; }
}

/// <summary>
/// Public search results with limited data
/// </summary>
public class PublicSearchScreensResult
{
    public List<PublicScreenDto> Screens { get; set; } = new();
    public int TotalCount { get; set; }
    public int Page { get; set; }
    public int PageSize { get; set; }
    public int TotalPages { get; set; }
}
