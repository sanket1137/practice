using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using CCMS.Application.Interfaces;
using CCMS.Domain.Entities;
using CCMS.Domain.Enums;
using CCMS.Infrastructure.Data;

namespace CCMS.Infrastructure.Services;

/// <summary>
/// Service for generating and managing screen tags based on nearby POI data.
/// Implements the tag generation rules from the BRD specification.
/// </summary>
public class ScreenTaggingService
{
    private readonly ApplicationDbContext _context;
    private readonly IGooglePlacesService _placesService;
    private readonly ILogger<ScreenTaggingService> _logger;
    
    // Distance weight factors for scoring (from BRD)
    private static readonly Dictionary<int, double> DistanceWeights = new()
    {
        { 250, 1.0 },
        { 500, 0.7 },
        { 750, 0.5 },
        { 1000, 0.3 },
        { 2000, 0.15 }
    };
    
    // Quality multiplier based on Google rating
    private static double GetQualityMultiplier(double? rating) => rating switch
    {
        >= 4.5 => 1.2,
        >= 4.0 => 1.0,
        >= 3.5 => 0.8,
        < 3.5 => 0.6,
        _ => 1.0 // handles null and NaN
    };

    public ScreenTaggingService(
        ApplicationDbContext context,
        IGooglePlacesService placesService,
        ILogger<ScreenTaggingService> logger)
    {
        _context = context;
        _placesService = placesService;
        _logger = logger;
    }

    /// <summary>
    /// Generate tags for a screen based on its location.
    /// Removes existing auto-generated tags and creates new ones.
    /// </summary>
    public async Task<ScreenTaggingResult> GenerateTagsAsync(
        Guid screenId,
        bool forceRefresh = false,
        CancellationToken cancellationToken = default)
    {
        var screen = await _context.Screens
            .Include(s => s.TagAssignments)
            .ThenInclude(ta => ta.Tag)
            .FirstOrDefaultAsync(s => s.Id == screenId, cancellationToken);
        
        if (screen == null)
        {
            return new ScreenTaggingResult { Success = false, Error = "Screen not found" };
        }
        
        _logger.LogInformation("[Tagging] Generating tags for screen {ScreenId} at {Lat}, {Lng}",
            screenId, screen.Latitude, screen.Longitude);
        
        // Check if coordinates changed since last tagging
        var coordinatesChanged = screen.LastTaggedLatitude != screen.Latitude ||
                                  screen.LastTaggedLongitude != screen.Longitude;
        
        if (!forceRefresh && !coordinatesChanged && screen.LastTaggedAt.HasValue)
        {
            var daysSinceLastTag = (DateTime.UtcNow - screen.LastTaggedAt.Value).TotalDays;
            if (daysSinceLastTag < 90) // Re-tag every 90 days
            {
                return new ScreenTaggingResult
                {
                    Success = true,
                    Message = "Tags are current. Use forceRefresh=true to regenerate.",
                    TagsGenerated = screen.TagAssignments.Count(ta => ta.Source == TagSource.Auto)
                };
            }
        }
        
        // Fetch nearby places
        var placesResult = await _placesService.GetNearbyPlacesAsync(
            screen.Latitude,
            screen.Longitude,
            forceRefresh,
            cancellationToken);
        
        // Log places found for debugging
        _logger.LogInformation("[Tagging] Fetched {Count} places (fromCache: {FromCache})", 
            placesResult.TotalPlacesFound, placesResult.FromCache);
        
        // Log summary of place types found
        var placeTypeSummary = placesResult.AllPlaces
            .SelectMany(p => p.Types)
            .GroupBy(t => t)
            .OrderByDescending(g => g.Count())
            .Take(15)
            .Select(g => $"{g.Key}:{g.Count()}");
        _logger.LogInformation("[Tagging] Place types found: {Types}", string.Join(", ", placeTypeSummary));
        
        // Load all master tags
        var masterTags = await _context.ScreenTags
            .Where(t => !t.IsDeleted)
            .ToListAsync(cancellationToken);
        
        // Remove existing auto-generated tags (keep manual ones)
        var autoTagAssignments = screen.TagAssignments
            .Where(ta => ta.Source == TagSource.Auto)
            .ToList();
        _context.ScreenTagAssignments.RemoveRange(autoTagAssignments);
        
        // Generate new tags
        var generatedAssignments = new List<ScreenTagAssignment>();
        
        // 1. Generate proximity-based tags
        var proximityAssignments = GenerateProximityTags(screen, placesResult, masterTags);
        generatedAssignments.AddRange(proximityAssignments);
        
        // 2. Generate density-based tags
        var densityAssignments = GenerateDensityTags(screen, placesResult, masterTags);
        generatedAssignments.AddRange(densityAssignments);
        
        // 3. Generate composite/lifestyle tags
        var compositeAssignments = GenerateCompositeTags(screen, placesResult, masterTags, generatedAssignments);
        generatedAssignments.AddRange(compositeAssignments);
        
        // 4. Generate audience profile tags
        var audienceAssignments = GenerateAudienceTags(screen, masterTags, generatedAssignments);
        generatedAssignments.AddRange(audienceAssignments);
        
        // 5. Generate time-based tags
        var timeAssignments = GenerateTimeTags(screen, placesResult, masterTags, generatedAssignments);
        generatedAssignments.AddRange(timeAssignments);
        
        // 6. Generate economic zone tags
        var economicAssignments = GenerateEconomicTags(screen, placesResult, masterTags, generatedAssignments);
        generatedAssignments.AddRange(economicAssignments);
        
        // Deduplicate and rank
        var finalAssignments = DeduplicateAndRank(generatedAssignments);
        
        // Add to context
        await _context.ScreenTagAssignments.AddRangeAsync(finalAssignments, cancellationToken);
        
        // Update screen tagging metadata
        screen.LastTaggedAt = DateTime.UtcNow;
        screen.LastTaggedLatitude = screen.Latitude;
        screen.LastTaggedLongitude = screen.Longitude;
        
        await _context.SaveChangesAsync(cancellationToken);
        
        _logger.LogInformation("[Tagging] Generated {Count} tags for screen {ScreenId}",
            finalAssignments.Count, screenId);
        
        return new ScreenTaggingResult
        {
            Success = true,
            TagsGenerated = finalAssignments.Count,
            PrimaryTags = finalAssignments.Where(a => a.IsPrimary).Select(a => a.Tag.Slug).ToList(),
            FromCache = placesResult.FromCache,
            TotalPoisFound = placesResult.TotalPlacesFound
        };
    }

    /// <summary>
    /// Generate proximity-based tags for single POIs within threshold distance
    /// </summary>
    private List<ScreenTagAssignment> GenerateProximityTags(
        Screen screen,
        NearbyPlacesResult placesResult,
        List<ScreenTag> masterTags)
    {
        var assignments = new List<ScreenTagAssignment>();
        
        // Get proximity tags (have MaxDistance but NO MinPoiCount - single POI detection)
        var proximityTags = masterTags
            .Where(t => t.MaxDistanceMeters.HasValue && 
                        !t.MinPoiCount.HasValue && 
                        !string.IsNullOrEmpty(t.GooglePlaceTypes))
            .ToList();
        
        _logger.LogDebug("[Tagging] Processing {Count} proximity tags", proximityTags.Count);
        
        foreach (var tag in proximityTags)
        {
            var placeTypes = ParseJsonArray(tag.GooglePlaceTypes!);
            
            // Find closest place matching any of the tag's place types
            var matchingPlace = placesResult.AllPlaces
                .Where(p => p.Types.Any(pt => placeTypes.Contains(pt)))
                .Where(p => p.DistanceMeters <= tag.MaxDistanceMeters!.Value)
                .OrderBy(p => p.DistanceMeters)
                .FirstOrDefault();
            
            if (matchingPlace != null)
            {
                var distanceWeight = GetDistanceWeight(matchingPlace.DistanceMeters);
                var qualityMultiplier = GetQualityMultiplier(matchingPlace.Rating);
                var score = (int)(1000 * distanceWeight * qualityMultiplier);
                
                _logger.LogDebug("[Tagging] Proximity match: {Tag} - found {Place} at {Distance}m", 
                    tag.Slug, matchingPlace.Name, matchingPlace.DistanceMeters);
                
                assignments.Add(new ScreenTagAssignment
                {
                    ScreenId = screen.Id,
                    TagId = tag.Id,
                    Source = TagSource.Auto,
                    Score = score,
                    DistanceMeters = matchingPlace.DistanceMeters,
                    PoiCount = 1,
                    AssignedAt = DateTime.UtcNow
                });
            }
        }
        
        _logger.LogInformation("[Tagging] Generated {Count} proximity tags", assignments.Count);
        return assignments;
    }

    /// <summary>
    /// Generate density-based tags based on POI count thresholds
    /// </summary>
    private List<ScreenTagAssignment> GenerateDensityTags(
        Screen screen,
        NearbyPlacesResult placesResult,
        List<ScreenTag> masterTags)
    {
        var assignments = new List<ScreenTagAssignment>();
        
        // Get density tags (have MinPoiCount - requires multiple POIs)
        var densityTags = masterTags
            .Where(t => t.MinPoiCount.HasValue && !string.IsNullOrEmpty(t.GooglePlaceTypes))
            .ToList();
        
        _logger.LogDebug("[Tagging] Processing {Count} density tags", densityTags.Count);
        
        foreach (var tag in densityTags)
        {
            var placeTypes = ParseJsonArray(tag.GooglePlaceTypes!);
            var maxDistance = tag.MaxDistanceMeters ?? 500; // Default 500m for density tags
            
            // Count matching places within radius
            var matchingPlaces = placesResult.AllPlaces
                .Where(p => p.DistanceMeters <= maxDistance)
                .Where(p => p.Types.Any(pt => placeTypes.Contains(pt)))
                .ToList();
            
            _logger.LogDebug("[Tagging] Density check: {Tag} - found {Count}/{Required} POIs within {Distance}m (types: {Types})",
                tag.Slug, matchingPlaces.Count, tag.MinPoiCount, maxDistance, string.Join(",", placeTypes.Take(3)));
            
            if (matchingPlaces.Count >= tag.MinPoiCount!.Value)
            {
                // Calculate score based on count and quality
                var avgRating = matchingPlaces.Average(p => p.Rating ?? 4.0);
                var avgDistance = matchingPlaces.Average(p => p.DistanceMeters);
                var distanceWeight = GetDistanceWeight((int)avgDistance);
                var qualityMultiplier = GetQualityMultiplier(avgRating);
                var countBonus = Math.Min(matchingPlaces.Count / (double)tag.MinPoiCount.Value, 2.0);
                
                var score = (int)(800 * distanceWeight * qualityMultiplier * countBonus);
                
                _logger.LogDebug("[Tagging] Density match: {Tag} with {Count} POIs, score {Score}", 
                    tag.Slug, matchingPlaces.Count, score);
                
                assignments.Add(new ScreenTagAssignment
                {
                    ScreenId = screen.Id,
                    TagId = tag.Id,
                    Source = TagSource.Auto,
                    Score = score,
                    DistanceMeters = (int)avgDistance,
                    PoiCount = matchingPlaces.Count,
                    AssignedAt = DateTime.UtcNow
                });
            }
        }
        
        _logger.LogInformation("[Tagging] Generated {Count} density tags", assignments.Count);
        return assignments;
    }

    /// <summary>
    /// Generate composite/lifestyle tags that require multiple conditions
    /// </summary>
    private List<ScreenTagAssignment> GenerateCompositeTags(
        Screen screen,
        NearbyPlacesResult placesResult,
        List<ScreenTag> masterTags,
        List<ScreenTagAssignment> existingAssignments)
    {
        var assignments = new List<ScreenTagAssignment>();
        var existingTagSlugs = GetTagSlugsFromAssignments(existingAssignments, masterTags);
        
        // Tech Startup Ecosystem
        if (CheckCompositeConditions(existingTagSlugs, placesResult,
            required: new[] { "it_tech_hub", "coworking_nearby", "cafe_culture" },
            anyOf: new[] { "university_nearby", "university_campus" }))
        {
            AddCompositeTag(assignments, masterTags, screen.Id, "tech_startup_ecosystem", 850);
        }
        
        // Foodie Paradise
        if (existingTagSlugs.Contains("foodie_zone") &&
            CountPlaceTypes(placesResult, 500, "restaurant") >= 10)
        {
            AddCompositeTag(assignments, masterTags, screen.Id, "foodie_paradise", 900);
        }
        
        // Fitness & Wellness Hub
        if (CheckCompositeConditions(existingTagSlugs, placesResult,
            required: new[] { "gym_nearby" },
            anyOf: new[] { "yoga_studio_nearby", "spa_wellness_nearby" }))
        {
            AddCompositeTag(assignments, masterTags, screen.Id, "fitness_wellness_hub", 750);
        }
        
        // Family-Friendly Zone
        if (CheckCompositeConditions(existingTagSlugs, placesResult,
            required: new[] { "park_nearby" },
            anyOf: new[] { "school_zone", "playground_nearby", "supermarket_nearby" }))
        {
            AddCompositeTag(assignments, masterTags, screen.Id, "family_friendly_zone", 800);
        }
        
        // Cultural Heritage Zone
        if (CountFromAny(existingTagSlugs, "museum_nearby", "art_gallery_nearby", "heritage_site_nearby") >= 2)
        {
            AddCompositeTag(assignments, masterTags, screen.Id, "cultural_heritage_zone", 750);
        }
        
        // Nightlife & Entertainment Hub
        if (existingTagSlugs.Contains("nightlife_zone") &&
            CountFromAny(existingTagSlugs, "bar_district", "movie_theater_nearby", "entertainment_district") >= 1)
        {
            AddCompositeTag(assignments, masterTags, screen.Id, "nightlife_entertainment_hub", 850);
        }
        
        // Corporate Business Hub
        if (existingTagSlugs.Contains("corporate_zone") &&
            CountFromAny(existingTagSlugs, "banking_cluster", "hotel_nearby") >= 1)
        {
            AddCompositeTag(assignments, masterTags, screen.Id, "corporate_business_hub", 800);
        }
        
        // Student Ecosystem
        if (existingTagSlugs.Contains("university_nearby") &&
            CountFromAny(existingTagSlugs, "cafe_culture", "fast_food_zone", "library_nearby") >= 2)
        {
            AddCompositeTag(assignments, masterTags, screen.Id, "student_ecosystem", 850);
        }
        
        return assignments;
    }

    /// <summary>
    /// Generate audience profile tags based on location characteristics
    /// </summary>
    private List<ScreenTagAssignment> GenerateAudienceTags(
        Screen screen,
        List<ScreenTag> masterTags,
        List<ScreenTagAssignment> existingAssignments)
    {
        var assignments = new List<ScreenTagAssignment>();
        var existingTagSlugs = GetTagSlugsFromAssignments(existingAssignments, masterTags);
        
        // Young Professionals
        if (CountFromAny(existingTagSlugs, "corporate_zone", "coworking_nearby", "cafe_culture", "gym_nearby") >= 3)
        {
            AddAudienceTag(assignments, masterTags, screen.Id, "young_professionals", 900);
        }
        
        // Student Audience
        if (CountFromAny(existingTagSlugs, "university_nearby", "university_campus", "coaching_center_zone", "library_nearby") >= 2)
        {
            AddAudienceTag(assignments, masterTags, screen.Id, "student_audience", 850);
        }
        
        // Family Audience
        if (CountFromAny(existingTagSlugs, "school_zone", "park_nearby", "supermarket_nearby", "playground_nearby") >= 3)
        {
            AddAudienceTag(assignments, masterTags, screen.Id, "family_audience", 800);
        }
        
        // Tourist Audience
        if (CountFromAny(existingTagSlugs, "hotel_nearby", "hotel_cluster", "tourist_attraction_nearby", "tourist_zone") >= 2)
        {
            AddAudienceTag(assignments, masterTags, screen.Id, "tourist_audience", 850);
        }
        
        // Daily Commuters
        if (CountFromAny(existingTagSlugs, "metro_station_proximity", "railway_station_proximity", "bus_terminal_proximity", "transit_hub") >= 1)
        {
            AddAudienceTag(assignments, masterTags, screen.Id, "daily_commuters", 900);
        }
        
        // Health Enthusiasts
        if (CountFromAny(existingTagSlugs, "gym_nearby", "fitness_zone", "yoga_studio_nearby", "wellness_hub") >= 2)
        {
            AddAudienceTag(assignments, masterTags, screen.Id, "health_enthusiasts", 800);
        }
        
        // Foodies
        if (CountFromAny(existingTagSlugs, "foodie_zone", "restaurant_cluster", "cafe_culture", "fine_dining_nearby") >= 2)
        {
            AddAudienceTag(assignments, masterTags, screen.Id, "foodies", 850);
        }
        
        // Tech-Savvy
        if (CountFromAny(existingTagSlugs, "it_tech_hub", "coworking_nearby", "electronics_retail_zone") >= 2)
        {
            AddAudienceTag(assignments, masterTags, screen.Id, "tech_savvy", 750);
        }
        
        // Luxury Seekers
        if (CountFromAny(existingTagSlugs, "luxury_retail_zone", "luxury_hotel_nearby", "fine_dining_nearby") >= 2)
        {
            AddAudienceTag(assignments, masterTags, screen.Id, "luxury_seekers", 800);
        }
        
        // Nightlife Lovers
        if (CountFromAny(existingTagSlugs, "nightlife_zone", "bar_district", "late_night_dining") >= 2)
        {
            AddAudienceTag(assignments, masterTags, screen.Id, "nightlife_lovers", 850);
        }
        
        // Shopping Enthusiasts
        if (CountFromAny(existingTagSlugs, "mall_proximity", "shopping_district", "luxury_retail_zone") >= 2)
        {
            AddAudienceTag(assignments, masterTags, screen.Id, "shopping_enthusiasts", 800);
        }
        
        return assignments;
    }

    /// <summary>
    /// Generate time-based tags based on location type
    /// </summary>
    private List<ScreenTagAssignment> GenerateTimeTags(
        Screen screen,
        NearbyPlacesResult placesResult,
        List<ScreenTag> masterTags,
        List<ScreenTagAssignment> existingAssignments)
    {
        var assignments = new List<ScreenTagAssignment>();
        var existingTagSlugs = GetTagSlugsFromAssignments(existingAssignments, masterTags);
        
        // Morning Rush Zone
        if (CountFromAny(existingTagSlugs, "metro_station_proximity", "railway_station_proximity", "corporate_zone") >= 2)
        {
            AddTimeTag(assignments, masterTags, screen.Id, "morning_rush_zone", 850);
        }
        
        // Lunch Hour Zone
        if (existingTagSlugs.Contains("corporate_zone") &&
            CountFromAny(existingTagSlugs, "restaurant_cluster", "foodie_zone", "fast_food_zone") >= 1)
        {
            AddTimeTag(assignments, masterTags, screen.Id, "lunch_hour_zone", 800);
        }
        
        // Evening Rush Zone
        if (CountFromAny(existingTagSlugs, "metro_station_proximity", "railway_station_proximity") >= 1 &&
            CountFromAny(existingTagSlugs, "residential_area", "shopping_district") >= 1)
        {
            AddTimeTag(assignments, masterTags, screen.Id, "evening_rush_zone", 850);
        }
        
        // Night Active Zone
        if (CountFromAny(existingTagSlugs, "nightlife_zone", "bar_district", "late_night_dining") >= 1)
        {
            AddTimeTag(assignments, masterTags, screen.Id, "night_active_zone", 800);
        }
        
        // 24-Hour Zone
        if (CountPlaceTypes(placesResult, 500, "convenience_store") >= 2 ||
            CountFromAny(existingTagSlugs, "airport_proximity", "railway_station_proximity") >= 1)
        {
            AddTimeTag(assignments, masterTags, screen.Id, "24_hour_zone", 750);
        }
        
        // Weekday Zone (corporate/office areas)
        if (existingTagSlugs.Contains("corporate_zone") && !existingTagSlugs.Contains("nightlife_zone"))
        {
            AddTimeTag(assignments, masterTags, screen.Id, "weekday_zone", 700);
        }
        
        // Weekend Hotspot
        if (CountFromAny(existingTagSlugs, "mall_proximity", "entertainment_district", "park_nearby", "movie_theater_nearby") >= 2)
        {
            AddTimeTag(assignments, masterTags, screen.Id, "weekend_hotspot", 800);
        }
        
        return assignments;
    }

    /// <summary>
    /// Generate economic zone tags based on POI price levels and types
    /// </summary>
    private List<ScreenTagAssignment> GenerateEconomicTags(
        Screen screen,
        NearbyPlacesResult placesResult,
        List<ScreenTag> masterTags,
        List<ScreenTagAssignment> existingAssignments)
    {
        var assignments = new List<ScreenTagAssignment>();
        var existingTagSlugs = GetTagSlugsFromAssignments(existingAssignments, masterTags);
        
        // Calculate average price level of nearby places
        var placesWithPrice = placesResult.AllPlaces
            .Where(p => p.DistanceMeters <= 1000 && p.PriceLevel.HasValue)
            .ToList();
        
        var avgPriceLevel = placesWithPrice.Any() 
            ? placesWithPrice.Average(p => p.PriceLevel!.Value) 
            : 2.0; // Default to moderate
        
        // Luxury Lifestyle Zone
        if (avgPriceLevel >= 3.0 ||
            CountFromAny(existingTagSlugs, "luxury_retail_zone", "luxury_hotel_nearby", "fine_dining_nearby") >= 2)
        {
            AddEconomicTag(assignments, masterTags, screen.Id, "luxury_lifestyle_zone", 850);
            AddEconomicTag(assignments, masterTags, screen.Id, "premium_zone", 800);
        }
        // Premium Zone
        else if (avgPriceLevel >= 2.5 ||
            CountFromAny(existingTagSlugs, "shopping_district", "corporate_zone") >= 2)
        {
            AddEconomicTag(assignments, masterTags, screen.Id, "premium_zone", 750);
            AddEconomicTag(assignments, masterTags, screen.Id, "upper_middle_class_zone", 700);
        }
        // Middle Class Zone
        else if (avgPriceLevel >= 1.5)
        {
            AddEconomicTag(assignments, masterTags, screen.Id, "middle_class_zone", 650);
        }
        // Budget Zone
        else
        {
            AddEconomicTag(assignments, masterTags, screen.Id, "budget_zone", 600);
        }
        
        // High Commercial Activity
        if (placesResult.TotalPlacesFound >= 30)
        {
            AddEconomicTag(assignments, masterTags, screen.Id, "high_commercial_activity", 800);
        }
        
        return assignments;
    }

    /// <summary>
    /// Deduplicate assignments and mark top 5 as primary
    /// </summary>
    private List<ScreenTagAssignment> DeduplicateAndRank(List<ScreenTagAssignment> assignments)
    {
        // Remove duplicates, keeping highest score
        var deduplicated = assignments
            .GroupBy(a => a.TagId)
            .Select(g => g.OrderByDescending(a => a.Score).First())
            .OrderByDescending(a => a.Score)
            .ToList();
        
        // Mark top 5 as primary
        for (int i = 0; i < Math.Min(5, deduplicated.Count); i++)
        {
            deduplicated[i].IsPrimary = true;
        }
        
        return deduplicated;
    }

    #region Helper Methods

    private static double GetDistanceWeight(int distanceMeters)
    {
        if (distanceMeters <= 250) return 1.0;
        if (distanceMeters <= 500) return 0.7;
        if (distanceMeters <= 750) return 0.5;
        if (distanceMeters <= 1000) return 0.3;
        return 0.15;
    }

    private static List<string> ParseJsonArray(string json)
    {
        try
        {
            return JsonSerializer.Deserialize<List<string>>(json) ?? new List<string>();
        }
        catch
        {
            return new List<string>();
        }
    }

    private HashSet<string> GetTagSlugsFromAssignments(
        List<ScreenTagAssignment> assignments,
        List<ScreenTag> masterTags)
    {
        var tagIds = assignments.Select(a => a.TagId).ToHashSet();
        return masterTags
            .Where(t => tagIds.Contains(t.Id))
            .Select(t => t.Slug)
            .ToHashSet();
    }

    private static int CountFromAny(HashSet<string> existingTags, params string[] tagsToCheck)
    {
        return tagsToCheck.Count(t => existingTags.Contains(t));
    }

    private static int CountPlaceTypes(NearbyPlacesResult placesResult, int maxDistance, params string[] types)
    {
        return placesResult.AllPlaces
            .Count(p => p.DistanceMeters <= maxDistance && p.Types.Any(pt => types.Contains(pt)));
    }

    private bool CheckCompositeConditions(
        HashSet<string> existingTags,
        NearbyPlacesResult placesResult,
        string[] required,
        string[]? anyOf = null)
    {
        // Check all required tags are present
        if (!required.All(r => existingTags.Contains(r)))
            return false;
        
        // Check at least one of anyOf (if specified)
        if (anyOf != null && anyOf.Length > 0)
        {
            if (!anyOf.Any(a => existingTags.Contains(a)))
                return false;
        }
        
        return true;
    }

    private void AddCompositeTag(List<ScreenTagAssignment> assignments, List<ScreenTag> masterTags,
        Guid screenId, string slug, int score)
    {
        var tag = masterTags.FirstOrDefault(t => t.Slug == slug);
        if (tag != null)
        {
            assignments.Add(new ScreenTagAssignment
            {
                ScreenId = screenId,
                TagId = tag.Id,
                Source = TagSource.Auto,
                Score = score,
                AssignedAt = DateTime.UtcNow
            });
        }
    }

    private void AddAudienceTag(List<ScreenTagAssignment> assignments, List<ScreenTag> masterTags,
        Guid screenId, string slug, int score)
    {
        AddCompositeTag(assignments, masterTags, screenId, slug, score);
    }

    private void AddTimeTag(List<ScreenTagAssignment> assignments, List<ScreenTag> masterTags,
        Guid screenId, string slug, int score)
    {
        AddCompositeTag(assignments, masterTags, screenId, slug, score);
    }

    private void AddEconomicTag(List<ScreenTagAssignment> assignments, List<ScreenTag> masterTags,
        Guid screenId, string slug, int score)
    {
        AddCompositeTag(assignments, masterTags, screenId, slug, score);
    }

    #endregion

    /// <summary>
    /// Add a manual tag to a screen
    /// </summary>
    public async Task<bool> AddManualTagAsync(
        Guid screenId,
        Guid tagId,
        Guid userId,
        CancellationToken cancellationToken = default)
    {
        var exists = await _context.ScreenTagAssignments
            .AnyAsync(a => a.ScreenId == screenId && a.TagId == tagId, cancellationToken);
        
        if (exists)
            return false;
        
        var tag = await _context.ScreenTags.FindAsync(new object[] { tagId }, cancellationToken);
        if (tag == null)
            return false;
        
        var assignment = new ScreenTagAssignment
        {
            ScreenId = screenId,
            TagId = tagId,
            Source = TagSource.Manual,
            Score = 500, // Default score for manual tags
            AssignedAt = DateTime.UtcNow,
            AssignedByUserId = userId
        };
        
        await _context.ScreenTagAssignments.AddAsync(assignment, cancellationToken);
        await _context.SaveChangesAsync(cancellationToken);
        
        return true;
    }

    /// <summary>
    /// Remove a tag from a screen (only manual tags can be removed by owner)
    /// </summary>
    public async Task<bool> RemoveTagAsync(
        Guid screenId,
        Guid tagId,
        Guid userId,
        bool isAdmin = false,
        CancellationToken cancellationToken = default)
    {
        var assignment = await _context.ScreenTagAssignments
            .FirstOrDefaultAsync(a => a.ScreenId == screenId && a.TagId == tagId, cancellationToken);
        
        if (assignment == null)
            return false;
        
        // Non-admins can only remove manual tags
        if (!isAdmin && assignment.Source != TagSource.Manual)
            return false;
        
        _context.ScreenTagAssignments.Remove(assignment);
        await _context.SaveChangesAsync(cancellationToken);
        
        return true;
    }

    /// <summary>
    /// Get all tags for a screen
    /// </summary>
    public async Task<List<ScreenTagDto>> GetScreenTagsAsync(
        Guid screenId,
        CancellationToken cancellationToken = default)
    {
        var assignments = await _context.ScreenTagAssignments
            .Include(a => a.Tag)
            .Where(a => a.ScreenId == screenId)
            .OrderByDescending(a => a.IsPrimary)
            .ThenByDescending(a => a.Score)
            .ToListAsync(cancellationToken);
        
        return assignments.Select(a => new ScreenTagDto
        {
            TagId = a.TagId,
            Slug = a.Tag.Slug,
            DisplayName = a.Tag.DisplayName,
            Category = a.Tag.Category.ToString(),
            Description = a.Tag.Description,
            IconName = a.Tag.IconName,
            ColorCode = a.Tag.ColorCode,
            IsPrimary = a.IsPrimary,
            Score = a.Score,
            Source = a.Source.ToString(),
            DistanceMeters = a.DistanceMeters,
            PoiCount = a.PoiCount,
            AssignedAt = a.AssignedAt
        }).ToList();
    }
}

#region DTOs

public class ScreenTaggingResult
{
    public bool Success { get; set; }
    public string? Error { get; set; }
    public string? Message { get; set; }
    public int TagsGenerated { get; set; }
    public List<string> PrimaryTags { get; set; } = new();
    public bool FromCache { get; set; }
    public int TotalPoisFound { get; set; }
}

public class ScreenTagDto
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

#endregion
