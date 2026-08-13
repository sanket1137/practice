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
    
    // Search radii in meters - optimized for DOOH screen audience relevance
    // 50m = immediate proximity (line of sight)
    // 100m = very close (1 min walk)
    // 250m = walking distance (2-3 min walk)
    // 500m = extended area (5-6 min walk, max for most tags)
    private static readonly int[] SearchRadii = { 50, 100, 250, 500 };
    
    // Cache duration: 48 hours as per recommended option
    private static readonly TimeSpan CacheDuration = TimeSpan.FromHours(48);
    
    // Place type groups for targeted searches - Google Places API allows up to 50 types per request
    // We group by category to ensure diverse POI coverage
    private static readonly Dictionary<string, string[]> PlaceTypeGroups = new()
    {
        ["transportation"] = new[] { 
            "subway_station", "light_rail_station", "transit_station", "train_station",
            "bus_station", "bus_stop", "airport", "gas_station", 
            "electric_vehicle_charging_station", "parking", "taxi_stand" 
        },
        ["food_dining"] = new[] { 
            "restaurant", "cafe", "coffee_shop", "fast_food_restaurant", "meal_takeaway",
            "bakery", "bar", "pub", "night_club", "indian_restaurant", 
            "chinese_restaurant", "italian_restaurant", "pizza_restaurant"
        },
        ["retail"] = new[] { 
            "shopping_mall", "department_store", "store", "clothing_store",
            "supermarket", "grocery_store", "convenience_store", "pharmacy",
            "electronics_store", "book_store", "jewelry_store"
        },
        ["education"] = new[] { 
            "school", "primary_school", "secondary_school", "university", "library", "preschool" 
        },
        ["healthcare"] = new[] { 
            "hospital", "doctor", "dentist", "gym", "fitness_center", 
            "spa", "yoga_studio", "veterinary_care", "physiotherapist"
        },
        ["hospitality"] = new[] { 
            "lodging", "hotel", "tourist_attraction", "museum", "amusement_park" 
        },
        ["entertainment"] = new[] { 
            "movie_theater", "bowling_alley", "amusement_center", "park", "playground",
            "stadium", "art_gallery", "zoo", "aquarium"
        },
        ["religious"] = new[] { 
            "hindu_temple", "mosque", "church", "synagogue" 
        },
        ["financial"] = new[] { 
            "bank", "atm" 
        },
        ["government"] = new[] { 
            "local_government_office", "government_office", "city_hall", 
            "post_office", "police", "fire_station"
        }
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
        
        // Only log warning if not enabled (avoid excessive logging as Singleton)
        if (!_isEnabled)
        {
            _logger.LogWarning("[GooglePlaces] API key not configured. Service will return mock data.");
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
        
        // Search at max radius (500m) with each place type group for comprehensive coverage
        var maxRadius = SearchRadii.Max();
        
        foreach (var (groupName, types) in PlaceTypeGroups)
        {
            _logger.LogDebug("[GooglePlaces] Searching {GroupName} types at {Radius}m", groupName, maxRadius);
            var placesForGroup = await SearchNearbyWithTypesAsync(latitude, longitude, maxRadius, types, cancellationToken);
            
            foreach (var place in placesForGroup)
            {
                if (!allPlaces.ContainsKey(place.PlaceId) || 
                    allPlaces[place.PlaceId].DistanceMeters > place.DistanceMeters)
                {
                    allPlaces[place.PlaceId] = place;
                }
            }
            
            _logger.LogDebug("[GooglePlaces] Found {Count} {GroupName} places", placesForGroup.Count, groupName);
        }
        
        // Organize results by radius buckets
        foreach (var radius in SearchRadii)
        {
            result.PlacesByRadius[radius] = allPlaces.Values
                .Where(p => p.DistanceMeters <= radius)
                .OrderBy(p => p.DistanceMeters)
                .ToList();
        }
        
        result.AllPlaces = allPlaces.Values.OrderBy(p => p.DistanceMeters).ToList();
        result.TotalPlacesFound = result.AllPlaces.Count;
        
        _logger.LogInformation("[GooglePlaces] Found {Count} unique places", result.TotalPlacesFound);
        
        // Cache the result
        _cache.Set(cacheKey, result, CacheDuration);
        
        return result;
    }

    /// <summary>
    /// Search for nearby places filtered by specific place types
    /// </summary>
    private async Task<List<PlaceResult>> SearchNearbyWithTypesAsync(
        decimal latitude,
        decimal longitude,
        int radiusMeters,
        string[] includedTypes,
        CancellationToken cancellationToken)
    {
        var results = new List<PlaceResult>();
        
        try
        {
            // Use the new Places API (Nearby Search v1) with includedTypes filter
            var requestBody = new
            {
                includedTypes = includedTypes,
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
                maxResultCount = 20 // Max per request
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
                _logger.LogWarning("[GooglePlaces] API error for types [{Types}]. Status: {Status}", 
                    string.Join(",", includedTypes.Take(3)), response.StatusCode);
                return results;
            }
            
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
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "[GooglePlaces] Error searching for types [{Types}]", 
                string.Join(",", includedTypes.Take(3)));
        }
        
        return results;
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
    /// Mock data uses tighter radii to match DOOH standards (max 500m)
    /// </summary>
    private NearbyPlacesResult GenerateMockData(decimal latitude, decimal longitude)
    {
        _logger.LogWarning("[GooglePlaces] Generating mock data - API key not configured");
        
        var mockPlaces = new List<PlaceResult>
        {
            // Transportation (within 250m for proximity tags)
            new() { PlaceId = "mock_metro_1", Name = "Central Metro Station", Types = new() { "subway_station", "transit_station" }, PrimaryType = "subway_station", Latitude = latitude + 0.0015m, Longitude = longitude + 0.001m, DistanceMeters = 180, Rating = 4.2 },
            new() { PlaceId = "mock_bus_1", Name = "Main Bus Terminal", Types = new() { "bus_station" }, PrimaryType = "bus_station", Latitude = latitude - 0.0018m, Longitude = longitude + 0.001m, DistanceMeters = 210, Rating = 3.8 },
            new() { PlaceId = "mock_parking_1", Name = "City Parking", Types = new() { "parking" }, PrimaryType = "parking", Latitude = latitude + 0.0005m, Longitude = longitude - 0.0003m, DistanceMeters = 60, Rating = 3.5 },
            new() { PlaceId = "mock_gas_1", Name = "Shell Gas Station", Types = new() { "gas_station" }, PrimaryType = "gas_station", Latitude = latitude - 0.0006m, Longitude = longitude + 0.0004m, DistanceMeters = 75, Rating = 4.0 },
            
            // Food & Beverage (dense cluster for foodie zone within 250m)
            new() { PlaceId = "mock_rest_1", Name = "Spice Garden Restaurant", Types = new() { "restaurant" }, PrimaryType = "restaurant", Latitude = latitude + 0.0008m, Longitude = longitude + 0.0006m, DistanceMeters = 100, Rating = 4.5 },
            new() { PlaceId = "mock_rest_2", Name = "Golden Dragon", Types = new() { "restaurant" }, PrimaryType = "restaurant", Latitude = latitude + 0.001m, Longitude = longitude - 0.0008m, DistanceMeters = 130, Rating = 4.3 },
            new() { PlaceId = "mock_rest_3", Name = "Bella Italia", Types = new() { "restaurant" }, PrimaryType = "restaurant", Latitude = latitude - 0.0008m, Longitude = longitude + 0.001m, DistanceMeters = 130, Rating = 4.4 },
            new() { PlaceId = "mock_rest_4", Name = "Sushi Supreme", Types = new() { "restaurant" }, PrimaryType = "restaurant", Latitude = latitude + 0.0012m, Longitude = longitude + 0.0012m, DistanceMeters = 170, Rating = 4.6 },
            new() { PlaceId = "mock_rest_5", Name = "Burger Palace", Types = new() { "restaurant", "fast_food_restaurant" }, PrimaryType = "fast_food_restaurant", Latitude = latitude - 0.0004m, Longitude = longitude - 0.0003m, DistanceMeters = 50, Rating = 4.1 },
            new() { PlaceId = "mock_rest_6", Name = "Thai Delight", Types = new() { "restaurant" }, PrimaryType = "restaurant", Latitude = latitude + 0.0015m, Longitude = longitude, DistanceMeters = 170, Rating = 4.2 },
            new() { PlaceId = "mock_rest_7", Name = "Mumbai Masala", Types = new() { "restaurant", "indian_restaurant" }, PrimaryType = "indian_restaurant", Latitude = latitude - 0.001m, Longitude = longitude - 0.001m, DistanceMeters = 140, Rating = 4.4 },
            
            // Cafes (within 100m for cafe_culture)
            new() { PlaceId = "mock_cafe_1", Name = "Starbucks", Types = new() { "cafe", "coffee_shop" }, PrimaryType = "cafe", Latitude = latitude + 0.0003m, Longitude = longitude + 0.0002m, DistanceMeters = 35, Rating = 4.0 },
            new() { PlaceId = "mock_cafe_2", Name = "The Coffee House", Types = new() { "cafe" }, PrimaryType = "cafe", Latitude = latitude - 0.0005m, Longitude = longitude - 0.0004m, DistanceMeters = 65, Rating = 4.4 },
            new() { PlaceId = "mock_cafe_3", Name = "Brew & Bean", Types = new() { "cafe" }, PrimaryType = "cafe", Latitude = latitude + 0.0006m, Longitude = longitude - 0.0005m, DistanceMeters = 80, Rating = 4.3 },
            new() { PlaceId = "mock_cafe_4", Name = "Costa Coffee", Types = new() { "cafe", "coffee_shop" }, PrimaryType = "cafe", Latitude = latitude - 0.0007m, Longitude = longitude + 0.0003m, DistanceMeters = 75, Rating = 4.1 },
            new() { PlaceId = "mock_cafe_5", Name = "Third Wave Roasters", Types = new() { "cafe" }, PrimaryType = "cafe", Latitude = latitude + 0.0004m, Longitude = longitude + 0.0005m, DistanceMeters = 65, Rating = 4.6 },
            
            // Bakery (within 100m)
            new() { PlaceId = "mock_bakery_1", Name = "Fresh Bakes", Types = new() { "bakery" }, PrimaryType = "bakery", Latitude = latitude - 0.0004m, Longitude = longitude + 0.0005m, DistanceMeters = 65, Rating = 4.5 },
            
            // Bars/Nightlife (within 250m for nightlife_zone)
            new() { PlaceId = "mock_bar_1", Name = "The Lounge", Types = new() { "bar" }, PrimaryType = "bar", Latitude = latitude + 0.0015m, Longitude = longitude + 0.0015m, DistanceMeters = 210, Rating = 4.2 },
            new() { PlaceId = "mock_bar_2", Name = "Night Owl Pub", Types = new() { "bar", "pub" }, PrimaryType = "bar", Latitude = latitude + 0.0018m, Longitude = longitude + 0.001m, DistanceMeters = 210, Rating = 4.1 },
            new() { PlaceId = "mock_bar_3", Name = "Irish Pub", Types = new() { "bar", "pub" }, PrimaryType = "pub", Latitude = latitude - 0.0012m, Longitude = longitude + 0.0015m, DistanceMeters = 190, Rating = 4.3 },
            
            // Retail (within 250m for proximity, cluster for density)
            new() { PlaceId = "mock_mall_1", Name = "City Center Mall", Types = new() { "shopping_mall" }, PrimaryType = "shopping_mall", Latitude = latitude + 0.0018m, Longitude = longitude - 0.0005m, DistanceMeters = 190, Rating = 4.3 },
            new() { PlaceId = "mock_super_1", Name = "Fresh Mart Supermarket", Types = new() { "supermarket" }, PrimaryType = "supermarket", Latitude = latitude - 0.0006m, Longitude = longitude + 0.0006m, DistanceMeters = 85, Rating = 4.1 },
            new() { PlaceId = "mock_conv_1", Name = "7-Eleven", Types = new() { "convenience_store" }, PrimaryType = "convenience_store", Latitude = latitude + 0.0003m, Longitude = longitude - 0.0004m, DistanceMeters = 50, Rating = 3.8 },
            new() { PlaceId = "mock_conv_2", Name = "Family Mart", Types = new() { "convenience_store" }, PrimaryType = "convenience_store", Latitude = latitude - 0.0005m, Longitude = longitude - 0.0003m, DistanceMeters = 60, Rating = 3.9 },
            new() { PlaceId = "mock_conv_3", Name = "Circle K", Types = new() { "convenience_store" }, PrimaryType = "convenience_store", Latitude = latitude + 0.0006m, Longitude = longitude + 0.0004m, DistanceMeters = 70, Rating = 3.7 },
            new() { PlaceId = "mock_pharm_1", Name = "Apollo Pharmacy", Types = new() { "pharmacy" }, PrimaryType = "pharmacy", Latitude = latitude - 0.0008m, Longitude = longitude + 0.001m, DistanceMeters = 130, Rating = 4.2 },
            
            // Healthcare (gym within 100m, hospital within 500m)
            new() { PlaceId = "mock_gym_1", Name = "FitLife Gym", Types = new() { "gym" }, PrimaryType = "gym", Latitude = latitude + 0.0006m, Longitude = longitude + 0.0006m, DistanceMeters = 85, Rating = 4.5 },
            new() { PlaceId = "mock_hosp_1", Name = "City General Hospital", Types = new() { "hospital" }, PrimaryType = "hospital", Latitude = latitude - 0.0035m, Longitude = longitude + 0.002m, DistanceMeters = 400, Rating = 4.0 },
            
            // Education (school within 250m, university within 500m)
            new() { PlaceId = "mock_school_1", Name = "Central High School", Types = new() { "school", "secondary_school" }, PrimaryType = "school", Latitude = latitude - 0.0015m, Longitude = longitude - 0.0012m, DistanceMeters = 190, Rating = 4.2 },
            new() { PlaceId = "mock_univ_1", Name = "State University", Types = new() { "university" }, PrimaryType = "university", Latitude = latitude + 0.003m, Longitude = longitude - 0.003m, DistanceMeters = 420, Rating = 4.4 },
            new() { PlaceId = "mock_lib_1", Name = "City Public Library", Types = new() { "library" }, PrimaryType = "library", Latitude = latitude - 0.0012m, Longitude = longitude + 0.0015m, DistanceMeters = 190, Rating = 4.5 },
            
            // Hotels (within 250-500m)
            new() { PlaceId = "mock_hotel_1", Name = "Grand Plaza Hotel", Types = new() { "lodging", "hotel" }, PrimaryType = "lodging", Latitude = latitude + 0.0015m, Longitude = longitude + 0.0012m, DistanceMeters = 190, Rating = 4.5, PriceLevel = 3 },
            new() { PlaceId = "mock_hotel_2", Name = "Budget Inn", Types = new() { "lodging" }, PrimaryType = "lodging", Latitude = latitude - 0.003m, Longitude = longitude + 0.002m, DistanceMeters = 360, Rating = 3.8, PriceLevel = 1 },
            
            // Financial (bank/atm within 100m)
            new() { PlaceId = "mock_bank_1", Name = "National Bank", Types = new() { "bank" }, PrimaryType = "bank", Latitude = latitude + 0.0005m, Longitude = longitude - 0.0003m, DistanceMeters = 60, Rating = 3.9 },
            new() { PlaceId = "mock_bank_2", Name = "City Credit Union", Types = new() { "bank" }, PrimaryType = "bank", Latitude = latitude - 0.0006m, Longitude = longitude + 0.0004m, DistanceMeters = 70, Rating = 4.1 },
            new() { PlaceId = "mock_bank_3", Name = "HDFC Bank", Types = new() { "bank" }, PrimaryType = "bank", Latitude = latitude + 0.0007m, Longitude = longitude + 0.0005m, DistanceMeters = 85, Rating = 4.0 },
            new() { PlaceId = "mock_atm_1", Name = "ATM - Main Street", Types = new() { "atm" }, PrimaryType = "atm", Latitude = latitude + 0.0002m, Longitude = longitude + 0.0001m, DistanceMeters = 25 },
            new() { PlaceId = "mock_atm_2", Name = "ATM - Station Road", Types = new() { "atm" }, PrimaryType = "atm", Latitude = latitude - 0.0003m, Longitude = longitude - 0.0002m, DistanceMeters = 35 },
            new() { PlaceId = "mock_atm_3", Name = "ATM - Mall Entrance", Types = new() { "atm" }, PrimaryType = "atm", Latitude = latitude + 0.0004m, Longitude = longitude - 0.0003m, DistanceMeters = 50 },
            new() { PlaceId = "mock_atm_4", Name = "ATM - Bank Branch", Types = new() { "atm" }, PrimaryType = "atm", Latitude = latitude - 0.0005m, Longitude = longitude + 0.0004m, DistanceMeters = 65 },
            new() { PlaceId = "mock_atm_5", Name = "ATM - Metro Station", Types = new() { "atm" }, PrimaryType = "atm", Latitude = latitude + 0.0006m, Longitude = longitude + 0.0003m, DistanceMeters = 70 },
            
            // Entertainment (park/playground within 100m, movie theater within 250m)
            new() { PlaceId = "mock_park_1", Name = "Central Park", Types = new() { "park" }, PrimaryType = "park", Latitude = latitude - 0.0005m, Longitude = longitude - 0.0006m, DistanceMeters = 80, Rating = 4.6 },
            new() { PlaceId = "mock_playground_1", Name = "Kids Play Area", Types = new() { "playground" }, PrimaryType = "playground", Latitude = latitude + 0.0004m, Longitude = longitude + 0.0006m, DistanceMeters = 70, Rating = 4.3 },
            new() { PlaceId = "mock_movie_1", Name = "Cineplex 10", Types = new() { "movie_theater" }, PrimaryType = "movie_theater", Latitude = latitude + 0.0015m, Longitude = longitude + 0.0012m, DistanceMeters = 190, Rating = 4.2 },
            
            // Religious (within 250m)
            new() { PlaceId = "mock_temple_1", Name = "Lakshmi Temple", Types = new() { "hindu_temple" }, PrimaryType = "hindu_temple", Latitude = latitude + 0.0015m, Longitude = longitude - 0.0012m, DistanceMeters = 190, Rating = 4.7 },
            new() { PlaceId = "mock_mosque_1", Name = "Jama Masjid", Types = new() { "mosque" }, PrimaryType = "mosque", Latitude = latitude - 0.0018m, Longitude = longitude + 0.0008m, DistanceMeters = 200, Rating = 4.5 },
            
            // Government (within 250m)
            new() { PlaceId = "mock_post_1", Name = "Main Post Office", Types = new() { "post_office" }, PrimaryType = "post_office", Latitude = latitude + 0.0006m, Longitude = longitude - 0.0005m, DistanceMeters = 80, Rating = 3.5 },
            new() { PlaceId = "mock_police_1", Name = "City Police Station", Types = new() { "police" }, PrimaryType = "police", Latitude = latitude - 0.0015m, Longitude = longitude - 0.001m, DistanceMeters = 180, Rating = 3.8 },
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
