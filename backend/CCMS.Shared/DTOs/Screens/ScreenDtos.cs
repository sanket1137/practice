namespace CCMS.Shared.DTOs.Screens;

public class ScreenDto
{
    public Guid Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public decimal PhysicalWidth { get; set; }
    public decimal PhysicalHeight { get; set; }
    public string DimensionUnit { get; set; } = "feet";
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
}

public class CreateScreenRequest
{
    public string Name { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public decimal PhysicalWidth { get; set; }
    public decimal PhysicalHeight { get; set; }
    public string DimensionUnit { get; set; } = "feet";
    public int ResolutionWidth { get; set; }
    public int ResolutionHeight { get; set; }
    public AddressDto Location { get; set; } = new();
    public decimal Latitude { get; set; }
    public decimal Longitude { get; set; }
    public OperatingScheduleDto Schedule { get; set; } = new();
    public int TimeFrameMinutes { get; set; }
    public int SlotsPerFrame { get; set; }
    public string DeviceId { get; set; } = string.Empty;
    public decimal PricePerSlot { get; set; }
    public string Currency { get; set; } = "USD";
    public string Timezone { get; set; } = "UTC"; // IANA timezone identifier (e.g., "Asia/Kolkata", "America/New_York")
    
    // Manual tags to add during creation
    public List<Guid>? ManualTagIds { get; set; }
}

public class UpdateScreenRequest
{
    public string? Name { get; set; }
    public string? Description { get; set; }
    public decimal? PhysicalWidth { get; set; }
    public decimal? PhysicalHeight { get; set; }
    public int? ResolutionWidth { get; set; }
    public int? ResolutionHeight { get; set; }
    public AddressDto? Location { get; set; }
    public decimal? Latitude { get; set; }
    public decimal? Longitude { get; set; }
    public OperatingScheduleDto? Schedule { get; set; }
    public int? TimeFrameMinutes { get; set; }
    public int? SlotsPerFrame { get; set; }
    public decimal? PricePerSlot { get; set; }
    public string? Status { get; set; }
    public string? Timezone { get; set; } // IANA timezone identifier (e.g., "Asia/Kolkata", "America/New_York")
    
    // Tags to add/remove during update
    public List<Guid>? AddTagIds { get; set; }
    public List<Guid>? RemoveTagIds { get; set; }
}

public class AddressDto
{
    public string Street { get; set; } = string.Empty;
    public string City { get; set; } = string.Empty;
    public string State { get; set; } = string.Empty;
    public string Country { get; set; } = string.Empty;
    public string PostalCode { get; set; } = string.Empty;
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
    /// Sort by field: "name", "price", "distance", "created"
    /// </summary>
    public string? SortBy { get; set; }
    
    /// <summary>
    /// Sort direction: "asc" or "desc"
    /// </summary>
    public string? SortDirection { get; set; }
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
