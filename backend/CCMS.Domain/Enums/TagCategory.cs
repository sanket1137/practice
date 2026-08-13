namespace CCMS.Domain.Enums;

/// <summary>
/// Categories for screen tags based on POI types and screen characteristics
/// </summary>
public enum TagCategory
{
    // Location-based categories (from Google Places POIs)
    Transportation = 1,
    FoodAndBeverage = 2,
    Retail = 3,
    Education = 4,
    Healthcare = 5,
    Hospitality = 6,
    Entertainment = 7,
    Religious = 8,
    Financial = 9,
    Government = 10,
    Residential = 11,
    Corporate = 12,
    Industrial = 13,
    
    // Derived/Composite categories
    AudienceProfile = 50,
    TimeBased = 51,
    Economic = 52,
    Lifestyle = 53,
    
    // Manual/Custom categories
    Custom = 100
}
