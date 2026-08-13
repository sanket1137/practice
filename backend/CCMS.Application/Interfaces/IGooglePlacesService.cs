namespace CCMS.Application.Interfaces;

/// <summary>
/// Interface for Google Places API integration to fetch nearby POIs
/// </summary>
public interface IGooglePlacesService
{
    /// <summary>
    /// Search for nearby places around a location at multiple radii
    /// </summary>
    /// <param name="latitude">Latitude of the center point</param>
    /// <param name="longitude">Longitude of the center point</param>
    /// <param name="forceRefresh">Skip cache and fetch fresh data</param>
    /// <param name="cancellationToken">Cancellation token</param>
    /// <returns>Collection of places organized by radius zone</returns>
    Task<NearbyPlacesResult> GetNearbyPlacesAsync(
        decimal latitude, 
        decimal longitude,
        bool forceRefresh = false,
        CancellationToken cancellationToken = default);
}

/// <summary>
/// Result of nearby places search containing places at different radius zones
/// </summary>
public class NearbyPlacesResult
{
    /// <summary>
    /// Whether this result was served from cache
    /// </summary>
    public bool FromCache { get; set; }
    
    /// <summary>
    /// Timestamp when the data was fetched
    /// </summary>
    public DateTime FetchedAt { get; set; }
    
    /// <summary>
    /// Total places found across all zones
    /// </summary>
    public int TotalPlacesFound { get; set; }
    
    /// <summary>
    /// Places grouped by radius zone (in meters)
    /// Key: radius in meters (250, 500, 750, 1000, 2000)
    /// </summary>
    public Dictionary<int, List<PlaceResult>> PlacesByRadius { get; set; } = new();
    
    /// <summary>
    /// All unique places with their closest distance
    /// </summary>
    public List<PlaceResult> AllPlaces { get; set; } = new();
}

/// <summary>
/// Represents a single place/POI from Google Places API
/// </summary>
public class PlaceResult
{
    /// <summary>
    /// Google Place ID
    /// </summary>
    public string PlaceId { get; set; } = string.Empty;
    
    /// <summary>
    /// Name of the place
    /// </summary>
    public string Name { get; set; } = string.Empty;
    
    /// <summary>
    /// Google Places types (e.g., "restaurant", "cafe", "school")
    /// </summary>
    public List<string> Types { get; set; } = new();
    
    /// <summary>
    /// Primary type (first in the types array)
    /// </summary>
    public string? PrimaryType { get; set; }
    
    /// <summary>
    /// Place latitude
    /// </summary>
    public decimal Latitude { get; set; }
    
    /// <summary>
    /// Place longitude
    /// </summary>
    public decimal Longitude { get; set; }
    
    /// <summary>
    /// Distance from the search center in meters
    /// </summary>
    public int DistanceMeters { get; set; }
    
    /// <summary>
    /// Google rating (0-5)
    /// </summary>
    public double? Rating { get; set; }
    
    /// <summary>
    /// Number of user ratings
    /// </summary>
    public int? UserRatingsTotal { get; set; }
    
    /// <summary>
    /// Price level (0-4): INEXPENSIVE to VERY_EXPENSIVE
    /// </summary>
    public int? PriceLevel { get; set; }
    
    /// <summary>
    /// Whether the place is currently operational
    /// </summary>
    public string? BusinessStatus { get; set; }
    
    /// <summary>
    /// Formatted address
    /// </summary>
    public string? FormattedAddress { get; set; }
    
    /// <summary>
    /// Whether place is currently open (if available)
    /// </summary>
    public bool? IsOpen { get; set; }
}
