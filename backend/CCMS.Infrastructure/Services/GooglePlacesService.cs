using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using CCMS.Application.Interfaces;

namespace CCMS.Infrastructure.Services;

/// <summary>
/// Google Places API service for fetching nearby POIs.
/// Uses the new Places API (v1) with nearbySearch endpoint.
/// Implements 48-hour caching for API cost optimization.
/// </summary>
public class GooglePlacesService : IGooglePlacesService
{
    private readonly HttpClient _httpClient;
    private readonly IMemoryCache _cache;
    private readonly ILogger<GooglePlacesService> _logger;
    private readonly string _apiKey;
    private readonly bool _isEnabled;
    
    // Search radii in meters (from BRD spec)
    private static readonly int[] SearchRadii = { 250, 500, 750, 1000, 2000 };
    
    // Cache duration: 48 hours as per recommended option
    private static readonly TimeSpan CacheDuration = TimeSpan.FromHours(48);
    
    // All place types to search for (comprehensive list for DOOH advertising)
    // Updated to use Google Places API (New) valid types from Table A and B
    private static readonly string[] PlaceTypes = new[]
    {
        // Transportation (Table A)
        "subway_station", "light_rail_station", "transit_station", "train_station",
        "bus_station", "bus_stop", "airport", "international_airport",
        "gas_station", "electric_vehicle_charging_station", "parking",
        "taxi_stand", "park_and_ride",
        
        // Retail & Shopping (Table A)
        "shopping_mall", "department_store", "store", "clothing_store", "shoe_store",
        "jewelry_store", "supermarket", "grocery_store", "convenience_store",
        "electronics_store", "cell_phone_store", "pharmacy", "drugstore", "book_store",
        "furniture_store", "home_goods_store", "home_improvement_store", "hardware_store",
        "market", "liquor_store", "pet_store", "sporting_goods_store",
        
        // Food & Beverage (Table A) - comprehensive list
        "restaurant", "cafe", "coffee_shop", "fast_food_restaurant", "meal_takeaway",
        "meal_delivery", "bakery", "bar", "pub", "night_club",
        "fine_dining_restaurant", "indian_restaurant", "chinese_restaurant",
        "italian_restaurant", "mexican_restaurant", "japanese_restaurant",
        "thai_restaurant", "korean_restaurant", "seafood_restaurant",
        "pizza_restaurant", "hamburger_restaurant", "steak_house",
        "ice_cream_shop", "dessert_shop", "juice_shop", "tea_house",
        
        // Education (Table A)
        "school", "primary_school", "secondary_school", "university", 
        "library", "preschool",
        
        // Healthcare & Wellness (Table A)
        "hospital", "doctor", "dentist", "dental_clinic", "pharmacy", "drugstore",
        "veterinary_care", "gym", "fitness_center", "spa", "yoga_studio",
        "wellness_center", "physiotherapist",
        
        // Hospitality & Tourism (Table A)
        "lodging", "hotel", "motel", "resort_hotel", "hostel", "bed_and_breakfast",
        "guest_house", "tourist_attraction", "museum", "amusement_park",
        "visitor_center", "travel_agency",
        
        // Entertainment & Recreation (Table A)
        "movie_theater", "bowling_alley", "amusement_center", "park", "playground",
        "stadium", "art_gallery", "casino", "karaoke", "video_arcade",
        "water_park", "zoo", "aquarium", "concert_hall", "performing_arts_theater",
        "comedy_club", "event_venue", "wedding_venue", "banquet_hall",
        
        // Business & Work (Table A)
        "corporate_office",
        
        // Religious (Table A)
        "hindu_temple", "mosque", "church", "synagogue",
        
        // Financial (Table A)
        "bank", "atm", "accounting",
        
        // Government (Table A)
        "local_government_office", "government_office", "city_hall", "courthouse", 
        "post_office", "police", "fire_station", "embassy"
    };

    public GooglePlacesService(
        IConfiguration configuration,
        IMemoryCache cache,
        ILogger<GooglePlacesService> logger,
        IHttpClientFactory httpClientFactory)
    {
        _cache = cache;
        _logger = logger;
        _httpClient = httpClientFactory.CreateClient("GooglePlaces");
        
        _apiKey = configuration["GooglePlaces:ApiKey"] ?? string.Empty;
        _isEnabled = !string.IsNullOrEmpty(_apiKey);
        
        if (!_isEnabled)
        {
            _logger.LogWarning("[GooglePlaces] API key not configured. Service will return mock data.");
        }
        else
        {
            _logger.LogInformation("[GooglePlaces] Service initialized with API key");
        }
    }

    public async Task<NearbyPlacesResult> GetNearbyPlacesAsync(
        decimal latitude,
        decimal longitude,
        bool forceRefresh = false,
        CancellationToken cancellationToken = default)
    {
        // Generate cache key based on location (rounded to 4 decimal places ~11m precision)
        var cacheKey = $"places_{Math.Round(latitude, 4)}_{Math.Round(longitude, 4)}";
        
        // Try to get from cache unless force refresh
        if (!forceRefresh && _cache.TryGetValue(cacheKey, out NearbyPlacesResult? cachedResult))
        {
            _logger.LogDebug("[GooglePlaces] Cache hit for {CacheKey}", cacheKey);
            cachedResult!.FromCache = true;
            return cachedResult;
        }
        
        _logger.LogInformation("[GooglePlaces] Fetching places for location: {Lat}, {Lng}", latitude, longitude);
        
        var result = new NearbyPlacesResult
        {
            FromCache = false,
            FetchedAt = DateTime.UtcNow
        };
        
        // If API not configured, return mock data for development
        if (!_isEnabled)
        {
            return GenerateMockData(latitude, longitude);
        }
        
        var allPlaces = new Dictionary<string, PlaceResult>(); // Deduplicate by PlaceId
        
        // Search at each radius
        foreach (var radius in SearchRadii)
        {
            var placesAtRadius = await SearchNearbyAsync(latitude, longitude, radius, cancellationToken);
            result.PlacesByRadius[radius] = placesAtRadius;
            
            // Add to all places with closest distance
            foreach (var place in placesAtRadius)
            {
                if (!allPlaces.ContainsKey(place.PlaceId) || 
                    allPlaces[place.PlaceId].DistanceMeters > place.DistanceMeters)
                {
                    allPlaces[place.PlaceId] = place;
                }
            }
        }
        
        result.AllPlaces = allPlaces.Values.OrderBy(p => p.DistanceMeters).ToList();
        result.TotalPlacesFound = result.AllPlaces.Count;
        
        _logger.LogInformation("[GooglePlaces] Found {Count} unique places", result.TotalPlacesFound);
        
        // Cache the result
        _cache.Set(cacheKey, result, CacheDuration);
        
        return result;
    }

    private async Task<List<PlaceResult>> SearchNearbyAsync(
        decimal latitude,
        decimal longitude,
        int radiusMeters,
        CancellationToken cancellationToken)
    {
        var results = new List<PlaceResult>();
        
        try
        {
            // Use the new Places API (Nearby Search v1)
            // Note: Don't use includedTypes - it has a 50 type limit
            // Instead, fetch all nearby places and filter on our side
            var requestBody = new
            {
                locationRestriction = new
                {
                    circle = new
                    {
                        center = new
                        {
                            latitude = (double)latitude,
                            longitude = (double)longitude
                        },
                        radius = (double)radiusMeters
                    }
                },
                maxResultCount = 20 // API limit per request
            };
            
            var request = new HttpRequestMessage(HttpMethod.Post, 
                "https://places.googleapis.com/v1/places:searchNearby");
            request.Headers.Add("X-Goog-Api-Key", _apiKey);
            request.Headers.Add("X-Goog-FieldMask", 
                "places.id,places.displayName,places.types,places.location," +
                "places.rating,places.userRatingCount,places.priceLevel," +
                "places.businessStatus,places.formattedAddress,places.primaryType");
            request.Content = JsonContent.Create(requestBody);
            
            var response = await _httpClient.SendAsync(request, cancellationToken);
            
            var responseContent = await response.Content.ReadAsStringAsync(cancellationToken);
            
            if (!response.IsSuccessStatusCode)
            {
                _logger.LogError("[GooglePlaces] API error at radius {Radius}m. Status: {Status}, Error: {Error}", 
                    radiusMeters, response.StatusCode, responseContent);
                return results;
            }
            
            _logger.LogInformation("[GooglePlaces] API response at {Radius}m: {Response}", 
                radiusMeters, responseContent.Length > 500 ? responseContent.Substring(0, 500) + "..." : responseContent);
            
            var jsonResponse = System.Text.Json.JsonSerializer.Deserialize<GooglePlacesResponse>(responseContent);
            
            if (jsonResponse?.Places != null)
            {
                foreach (var place in jsonResponse.Places)
                {
                    var distance = CalculateDistanceMeters(
                        latitude, longitude,
                        (decimal)place.Location.Latitude,
                        (decimal)place.Location.Longitude);
                    
                    results.Add(new PlaceResult
                    {
                        PlaceId = place.Id,
                        Name = place.DisplayName?.Text ?? string.Empty,
                        Types = place.Types ?? new List<string>(),
                        PrimaryType = place.PrimaryType,
                        Latitude = (decimal)place.Location.Latitude,
                        Longitude = (decimal)place.Location.Longitude,
                        DistanceMeters = distance,
                        Rating = place.Rating,
                        UserRatingsTotal = place.UserRatingCount,
                        PriceLevel = ParsePriceLevel(place.PriceLevel),
                        BusinessStatus = place.BusinessStatus,
                        FormattedAddress = place.FormattedAddress
                    });
                }
            }
            
            _logger.LogDebug("[GooglePlaces] Found {Count} places at {Radius}m", results.Count, radiusMeters);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "[GooglePlaces] Error searching at radius {Radius}m", radiusMeters);
        }
        
        return results;
    }

    /// <summary>
    /// Calculate distance between two coordinates using Haversine formula
    /// </summary>
    private static int CalculateDistanceMeters(decimal lat1, decimal lon1, decimal lat2, decimal lon2)
    {
        const double EarthRadiusMeters = 6371000;
        
        var dLat = ToRadians((double)(lat2 - lat1));
        var dLon = ToRadians((double)(lon2 - lon1));
        
        var a = Math.Sin(dLat / 2) * Math.Sin(dLat / 2) +
                Math.Cos(ToRadians((double)lat1)) * Math.Cos(ToRadians((double)lat2)) *
                Math.Sin(dLon / 2) * Math.Sin(dLon / 2);
        
        var c = 2 * Math.Atan2(Math.Sqrt(a), Math.Sqrt(1 - a));
        
        return (int)(EarthRadiusMeters * c);
    }

    private static double ToRadians(double degrees) => degrees * Math.PI / 180;

    private static int? ParsePriceLevel(string? priceLevel)
    {
        return priceLevel switch
        {
            "PRICE_LEVEL_FREE" => 0,
            "PRICE_LEVEL_INEXPENSIVE" => 1,
            "PRICE_LEVEL_MODERATE" => 2,
            "PRICE_LEVEL_EXPENSIVE" => 3,
            "PRICE_LEVEL_VERY_EXPENSIVE" => 4,
            _ => null
        };
    }

    /// <summary>
    /// Generate mock data for development when API key is not configured
    /// </summary>
    private NearbyPlacesResult GenerateMockData(decimal latitude, decimal longitude)
    {
        _logger.LogWarning("[GooglePlaces] Generating mock data - API key not configured");
        
        var mockPlaces = new List<PlaceResult>
        {
            // Transportation
            new() { PlaceId = "mock_metro_1", Name = "Central Metro Station", Types = new() { "subway_station", "transit_station" }, PrimaryType = "subway_station", Latitude = latitude + 0.002m, Longitude = longitude + 0.001m, DistanceMeters = 180, Rating = 4.2 },
            new() { PlaceId = "mock_bus_1", Name = "Main Bus Terminal", Types = new() { "bus_station" }, PrimaryType = "bus_station", Latitude = latitude - 0.003m, Longitude = longitude + 0.002m, DistanceMeters = 350, Rating = 3.8 },
            
            // Food & Beverage (creating foodie zone)
            new() { PlaceId = "mock_rest_1", Name = "Spice Garden Restaurant", Types = new() { "restaurant" }, PrimaryType = "restaurant", Latitude = latitude + 0.001m, Longitude = longitude + 0.001m, DistanceMeters = 120, Rating = 4.5 },
            new() { PlaceId = "mock_rest_2", Name = "Golden Dragon", Types = new() { "restaurant" }, PrimaryType = "restaurant", Latitude = latitude + 0.0015m, Longitude = longitude - 0.001m, DistanceMeters = 150, Rating = 4.3 },
            new() { PlaceId = "mock_rest_3", Name = "Bella Italia", Types = new() { "restaurant" }, PrimaryType = "restaurant", Latitude = latitude - 0.001m, Longitude = longitude + 0.0015m, DistanceMeters = 180, Rating = 4.4 },
            new() { PlaceId = "mock_rest_4", Name = "Sushi Supreme", Types = new() { "restaurant" }, PrimaryType = "restaurant", Latitude = latitude + 0.002m, Longitude = longitude + 0.002m, DistanceMeters = 280, Rating = 4.6 },
            new() { PlaceId = "mock_rest_5", Name = "Burger Palace", Types = new() { "restaurant", "fast_food_restaurant" }, PrimaryType = "restaurant", Latitude = latitude - 0.002m, Longitude = longitude - 0.001m, DistanceMeters = 220, Rating = 4.1 },
            new() { PlaceId = "mock_rest_6", Name = "Thai Delight", Types = new() { "restaurant" }, PrimaryType = "restaurant", Latitude = latitude + 0.003m, Longitude = longitude, DistanceMeters = 330, Rating = 4.2 },
            
            // Cafes
            new() { PlaceId = "mock_cafe_1", Name = "Starbucks", Types = new() { "cafe", "coffee_shop" }, PrimaryType = "cafe", Latitude = latitude + 0.0008m, Longitude = longitude + 0.0005m, DistanceMeters = 95, Rating = 4.0 },
            new() { PlaceId = "mock_cafe_2", Name = "The Coffee House", Types = new() { "cafe" }, PrimaryType = "cafe", Latitude = latitude - 0.001m, Longitude = longitude - 0.0008m, DistanceMeters = 130, Rating = 4.4 },
            new() { PlaceId = "mock_cafe_3", Name = "Brew & Bean", Types = new() { "cafe" }, PrimaryType = "cafe", Latitude = latitude + 0.002m, Longitude = longitude - 0.002m, DistanceMeters = 280, Rating = 4.3 },
            
            // Bars/Nightlife
            new() { PlaceId = "mock_bar_1", Name = "The Lounge", Types = new() { "bar" }, PrimaryType = "bar", Latitude = latitude + 0.003m, Longitude = longitude + 0.003m, DistanceMeters = 420, Rating = 4.2 },
            new() { PlaceId = "mock_bar_2", Name = "Night Owl Pub", Types = new() { "bar", "night_club" }, PrimaryType = "bar", Latitude = latitude + 0.004m, Longitude = longitude + 0.002m, DistanceMeters = 450, Rating = 4.1 },
            
            // Retail
            new() { PlaceId = "mock_mall_1", Name = "City Center Mall", Types = new() { "shopping_mall" }, PrimaryType = "shopping_mall", Latitude = latitude + 0.004m, Longitude = longitude - 0.001m, DistanceMeters = 420, Rating = 4.3 },
            new() { PlaceId = "mock_super_1", Name = "Fresh Mart Supermarket", Types = new() { "supermarket" }, PrimaryType = "supermarket", Latitude = latitude - 0.002m, Longitude = longitude + 0.003m, DistanceMeters = 360, Rating = 4.1 },
            
            // Healthcare
            new() { PlaceId = "mock_gym_1", Name = "FitLife Gym", Types = new() { "gym" }, PrimaryType = "gym", Latitude = latitude + 0.0025m, Longitude = longitude + 0.0025m, DistanceMeters = 350, Rating = 4.5 },
            new() { PlaceId = "mock_gym_2", Name = "Power House Fitness", Types = new() { "gym" }, PrimaryType = "gym", Latitude = latitude - 0.004m, Longitude = longitude - 0.003m, DistanceMeters = 500, Rating = 4.3 },
            new() { PlaceId = "mock_hosp_1", Name = "City General Hospital", Types = new() { "hospital" }, PrimaryType = "hospital", Latitude = latitude - 0.008m, Longitude = longitude + 0.005m, DistanceMeters = 940, Rating = 4.0 },
            
            // Education
            new() { PlaceId = "mock_univ_1", Name = "State University", Types = new() { "university" }, PrimaryType = "university", Latitude = latitude + 0.007m, Longitude = longitude - 0.004m, DistanceMeters = 800, Rating = 4.4 },
            new() { PlaceId = "mock_school_1", Name = "Central High School", Types = new() { "school", "secondary_school" }, PrimaryType = "school", Latitude = latitude - 0.003m, Longitude = longitude - 0.002m, DistanceMeters = 360, Rating = 4.2 },
            
            // Hotels
            new() { PlaceId = "mock_hotel_1", Name = "Grand Plaza Hotel", Types = new() { "lodging", "hotel" }, PrimaryType = "lodging", Latitude = latitude + 0.005m, Longitude = longitude + 0.004m, DistanceMeters = 640, Rating = 4.5, PriceLevel = 3 },
            new() { PlaceId = "mock_hotel_2", Name = "Budget Inn", Types = new() { "lodging" }, PrimaryType = "lodging", Latitude = latitude - 0.005m, Longitude = longitude + 0.004m, DistanceMeters = 640, Rating = 3.8, PriceLevel = 1 },
            
            // Financial
            new() { PlaceId = "mock_bank_1", Name = "National Bank", Types = new() { "bank" }, PrimaryType = "bank", Latitude = latitude + 0.001m, Longitude = longitude - 0.0005m, DistanceMeters = 110, Rating = 3.9 },
            new() { PlaceId = "mock_bank_2", Name = "City Credit Union", Types = new() { "bank" }, PrimaryType = "bank", Latitude = latitude - 0.0015m, Longitude = longitude + 0.001m, DistanceMeters = 180, Rating = 4.1 },
            new() { PlaceId = "mock_atm_1", Name = "ATM - Main Street", Types = new() { "atm" }, PrimaryType = "atm", Latitude = latitude + 0.0003m, Longitude = longitude + 0.0002m, DistanceMeters = 35 },
            
            // Entertainment
            new() { PlaceId = "mock_movie_1", Name = "Cineplex 10", Types = new() { "movie_theater" }, PrimaryType = "movie_theater", Latitude = latitude + 0.006m, Longitude = longitude + 0.002m, DistanceMeters = 630, Rating = 4.2 },
            new() { PlaceId = "mock_park_1", Name = "Central Park", Types = new() { "park" }, PrimaryType = "park", Latitude = latitude - 0.002m, Longitude = longitude - 0.003m, DistanceMeters = 360, Rating = 4.6 },
            
            // Religious
            new() { PlaceId = "mock_temple_1", Name = "Lakshmi Temple", Types = new() { "hindu_temple", "place_of_worship" }, PrimaryType = "hindu_temple", Latitude = latitude + 0.003m, Longitude = longitude - 0.004m, DistanceMeters = 500, Rating = 4.7 },
        };
        
        // Calculate actual distances and organize by radius
        var result = new NearbyPlacesResult
        {
            FromCache = false,
            FetchedAt = DateTime.UtcNow
        };
        
        foreach (var radius in SearchRadii)
        {
            result.PlacesByRadius[radius] = mockPlaces
                .Where(p => p.DistanceMeters <= radius)
                .ToList();
        }
        
        result.AllPlaces = mockPlaces.OrderBy(p => p.DistanceMeters).ToList();
        result.TotalPlacesFound = mockPlaces.Count;
        
        return result;
    }
}

#region Google Places API Response Models

internal class GooglePlacesResponse
{
    [JsonPropertyName("places")]
    public List<GooglePlace>? Places { get; set; }
}

internal class GooglePlace
{
    [JsonPropertyName("id")]
    public string Id { get; set; } = string.Empty;
    
    [JsonPropertyName("displayName")]
    public GoogleDisplayName? DisplayName { get; set; }
    
    [JsonPropertyName("types")]
    public List<string>? Types { get; set; }
    
    [JsonPropertyName("primaryType")]
    public string? PrimaryType { get; set; }
    
    [JsonPropertyName("location")]
    public GoogleLocation Location { get; set; } = new();
    
    [JsonPropertyName("rating")]
    public double? Rating { get; set; }
    
    [JsonPropertyName("userRatingCount")]
    public int? UserRatingCount { get; set; }
    
    [JsonPropertyName("priceLevel")]
    public string? PriceLevel { get; set; }
    
    [JsonPropertyName("businessStatus")]
    public string? BusinessStatus { get; set; }
    
    [JsonPropertyName("formattedAddress")]
    public string? FormattedAddress { get; set; }
}

internal class GoogleDisplayName
{
    [JsonPropertyName("text")]
    public string Text { get; set; } = string.Empty;
}

internal class GoogleLocation
{
    [JsonPropertyName("latitude")]
    public double Latitude { get; set; }
    
    [JsonPropertyName("longitude")]
    public double Longitude { get; set; }
}

#endregion
