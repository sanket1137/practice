using CCMS.Domain.Entities;
using CCMS.Domain.Enums;
using Microsoft.EntityFrameworkCore;

namespace CCMS.Infrastructure.Data;

/// <summary>
/// Seeds master screen tags based on the BRD specification.
/// Tags are organized by category with associated Google Places types.
/// </summary>
public static class ScreenTagSeeder
{
    public static async Task SeedTagsAsync(ApplicationDbContext context)
    {
        // Skip if tags already exist
        if (await context.ScreenTags.AnyAsync())
            return;

        var tags = new List<ScreenTag>();
        
        // ==========================================
        // TRANSPORTATION & TRANSIT TAGS
        // ==========================================
        tags.AddRange(new[]
        {
            CreateTag("metro_station_proximity", "Metro Station Proximity", TagCategory.Transportation,
                "Metro/subway station within walking distance",
                "[\"subway_station\",\"light_rail_station\",\"transit_station\"]",
                250, null, 1, "Train", "#1976D2"),
            
            CreateTag("railway_station_proximity", "Railway Station Proximity", TagCategory.Transportation,
                "Train station nearby for long-distance travelers",
                "[\"train_station\"]",
                500, null, 2, "TrainOutlined", "#1565C0"),
            
            CreateTag("bus_terminal_proximity", "Bus Terminal Proximity", TagCategory.Transportation,
                "Major bus station/depot nearby",
                "[\"bus_station\"]",
                250, null, 3, "DirectionsBus", "#0D47A1"),
            
            CreateTag("airport_proximity", "Airport Proximity", TagCategory.Transportation,
                "Airport within accessible range - travelers with high spending power",
                "[\"airport\"]",
                500, null, 4, "LocalAirport", "#00838F"),
            
            CreateTag("transit_hub", "Transit Hub", TagCategory.Transportation,
                "Multiple transit modes converge - maximum footfall",
                null, 250, 3, 5, "TransferWithinAStation", "#006064"),
            
            CreateTag("high_traffic_corridor", "High Traffic Corridor", TagCategory.Transportation,
                "Major road/highway with heavy vehicle traffic",
                null, 50, null, 10, "Traffic", "#37474F"),
            
            CreateTag("gas_station_nearby", "Gas Station Nearby", TagCategory.Transportation,
                "Fuel stations nearby - vehicle owners",
                "[\"gas_station\"]",
                100, null, 15, "LocalGasStation", "#FF6F00"),
            
            CreateTag("ev_charging_zone", "EV Charging Zone", TagCategory.Transportation,
                "Electric vehicle charging stations available",
                "[\"electric_vehicle_charging_station\"]",
                100, null, 16, "EvStation", "#43A047"),
            
            CreateTag("parking_facility_nearby", "Parking Facility Nearby", TagCategory.Transportation,
                "Parking available - drivers stopping in area",
                "[\"parking\"]",
                100, null, 17, "LocalParking", "#546E7A"),
            
            // ==========================================
            // RETAIL & SHOPPING TAGS
            // ==========================================
            CreateTag("mall_proximity", "Mall Proximity", TagCategory.Retail,
                "Shopping mall nearby - shoppers, families",
                "[\"shopping_mall\"]",
                250, null, 1, "LocalMall", "#E91E63"),
            
            CreateTag("shopping_district", "Shopping District", TagCategory.Retail,
                "High density of retail stores",
                "[\"store\",\"clothing_store\",\"shoe_store\"]",
                250, 10, 2, "Store", "#AD1457"),
            
            CreateTag("luxury_retail_zone", "Luxury Retail Zone", TagCategory.Retail,
                "Premium shopping area with high-end brands",
                "[\"jewelry_store\",\"clothing_store\"]",
                250, 3, 3, "Diamond", "#7B1FA2"),
            
            CreateTag("supermarket_nearby", "Supermarket Nearby", TagCategory.Retail,
                "Grocery stores nearby - daily shoppers",
                "[\"supermarket\",\"grocery_store\"]",
                100, null, 5, "ShoppingCart", "#558B2F"),
            
            CreateTag("convenience_store_cluster", "Convenience Store Cluster", TagCategory.Retail,
                "Multiple 24/7 convenience stores",
                "[\"convenience_store\"]",
                100, 3, 6, "LocalConvenienceStore", "#689F38"),
            
            CreateTag("electronics_retail_zone", "Electronics Retail Zone", TagCategory.Retail,
                "Electronics and tech stores nearby",
                "[\"electronics_store\",\"cell_phone_store\"]",
                250, 2, 7, "Devices", "#1976D2"),
            
            CreateTag("pharmacy_cluster", "Pharmacy Cluster", TagCategory.Retail,
                "Multiple pharmacies/drugstores",
                "[\"pharmacy\",\"drugstore\"]",
                250, 3, 10, "LocalPharmacy", "#C62828"),
            
            CreateTag("bookstore_nearby", "Bookstore Nearby", TagCategory.Retail,
                "Book retailers - educated audience",
                "[\"book_store\"]",
                250, null, 12, "MenuBook", "#5D4037"),
            
            // ==========================================
            // FOOD & BEVERAGE TAGS
            // ==========================================
            CreateTag("foodie_zone", "Foodie Zone", TagCategory.FoodAndBeverage,
                "High restaurant density - food enthusiasts",
                "[\"restaurant\"]",
                250, 15, 1, "Restaurant", "#F44336"),
            
            CreateTag("restaurant_cluster", "Restaurant Cluster", TagCategory.FoodAndBeverage,
                "Multiple restaurants in the area",
                "[\"restaurant\"]",
                250, 5, 2, "RestaurantMenu", "#D32F2F"),
            
            CreateTag("cafe_culture", "Café Culture", TagCategory.FoodAndBeverage,
                "Coffee shop culture - professionals, students",
                "[\"cafe\",\"coffee_shop\"]",
                100, 5, 3, "LocalCafe", "#6D4C41"),
            
            CreateTag("fast_food_zone", "Fast Food Zone", TagCategory.FoodAndBeverage,
                "Quick service restaurants - busy crowd",
                "[\"fast_food_restaurant\",\"meal_takeaway\"]",
                100, 5, 5, "Fastfood", "#FF5722"),
            
            CreateTag("fine_dining_nearby", "Fine Dining Nearby", TagCategory.FoodAndBeverage,
                "Upscale restaurants - affluent diners",
                "[\"restaurant\"]", // filtered by price_level
                250, null, 6, "DinnerDining", "#9C27B0"),
            
            CreateTag("nightlife_zone", "Nightlife Zone", TagCategory.FoodAndBeverage,
                "Bars, pubs, and nightclubs - evening crowd",
                "[\"bar\",\"pub\",\"night_club\"]",
                250, 3, 8, "NightlifeOutlined", "#7C4DFF"),
            
            CreateTag("bar_district", "Bar District", TagCategory.FoodAndBeverage,
                "High concentration of bars and pubs",
                "[\"bar\",\"pub\"]",
                250, 5, 9, "LocalBar", "#6200EA"),
            
            CreateTag("bakery_nearby", "Bakery Nearby", TagCategory.FoodAndBeverage,
                "Bakeries and dessert shops",
                "[\"bakery\"]",
                100, null, 12, "BakeryDining", "#E65100"),
            
            CreateTag("late_night_dining", "Late Night Dining", TagCategory.FoodAndBeverage,
                "24/7 or late-hour eateries",
                "[\"restaurant\",\"meal_takeaway\"]",
                250, 3, 15, "DarkMode", "#311B92"),
            
            // ==========================================
            // EDUCATION TAGS
            // ==========================================
            CreateTag("school_zone", "School Zone", TagCategory.Education,
                "Schools nearby - students, parents, teachers",
                "[\"school\",\"primary_school\",\"secondary_school\"]",
                250, null, 1, "School", "#FF9800"),
            
            CreateTag("university_nearby", "University Nearby", TagCategory.Education,
                "College/university - students, young adults",
                "[\"university\"]",
                500, null, 2, "AccountBalance", "#F57C00"),
            
            CreateTag("university_campus", "University Campus", TagCategory.Education,
                "Within university campus area",
                "[\"university\"]",
                100, null, 3, "CastForEducation", "#EF6C00"),
            
            CreateTag("educational_hub", "Educational Hub", TagCategory.Education,
                "Multiple educational institutions",
                "[\"school\",\"university\"]",
                500, 5, 4, "AutoStories", "#E65100"),
            
            CreateTag("coaching_center_zone", "Coaching Center Zone", TagCategory.Education,
                "Tutorial and test prep centers",
                null, 250, 3, 6, "Quiz", "#FF6F00"),
            
            CreateTag("library_nearby", "Library Nearby", TagCategory.Education,
                "Public or academic library",
                "[\"library\"]",
                250, null, 8, "LocalLibrary", "#795548"),
            
            CreateTag("student_hangout_zone", "Student Hangout Zone", TagCategory.Education,
                "Popular spots for students",
                null, 250, null, 10, "Groups", "#FB8C00"),
            
            // ==========================================
            // HEALTHCARE & WELLNESS TAGS
            // ==========================================
            CreateTag("hospital_proximity", "Hospital Proximity", TagCategory.Healthcare,
                "Hospital nearby - patients, visitors, staff",
                "[\"hospital\"]",
                500, null, 1, "LocalHospital", "#C62828"),
            
            CreateTag("medical_district", "Medical District", TagCategory.Healthcare,
                "Multiple healthcare facilities",
                "[\"hospital\",\"doctor\"]",
                500, 3, 2, "MedicalServices", "#B71C1C"),
            
            CreateTag("clinic_nearby", "Clinic Nearby", TagCategory.Healthcare,
                "Medical clinics and doctors",
                "[\"doctor\",\"dental_clinic\",\"medical_lab\"]",
                250, 2, 4, "MedicalInformation", "#D32F2F"),
            
            CreateTag("gym_nearby", "Gym Nearby", TagCategory.Healthcare,
                "Fitness centers - health-conscious audience",
                "[\"gym\",\"fitness_center\"]",
                100, null, 5, "FitnessCenter", "#4CAF50"),
            
            CreateTag("fitness_zone", "Fitness Zone", TagCategory.Healthcare,
                "Multiple gyms and fitness facilities",
                "[\"gym\",\"fitness_center\"]",
                250, 3, 6, "SportsGymnastics", "#388E3C"),
            
            CreateTag("yoga_studio_nearby", "Yoga Studio Nearby", TagCategory.Healthcare,
                "Yoga and meditation centers",
                "[\"yoga_studio\"]", 250, null, 8, "SelfImprovement", "#7CB342"),
            
            CreateTag("spa_wellness_nearby", "Spa & Wellness Nearby", TagCategory.Healthcare,
                "Spa and wellness centers",
                "[\"spa\"]",
                250, null, 9, "Spa", "#8BC34A"),
            
            CreateTag("wellness_hub", "Wellness Hub", TagCategory.Healthcare,
                "Concentration of health & wellness businesses",
                "[\"gym\",\"fitness_center\",\"spa\",\"wellness_center\",\"yoga_studio\"]",
                250, 3, 10, "Psychology", "#689F38"),
            
            CreateTag("veterinary_nearby", "Veterinary Nearby", TagCategory.Healthcare,
                "Pet healthcare - pet owners",
                "[\"veterinary_care\"]",
                250, null, 15, "Pets", "#8D6E63"),
            
            // ==========================================
            // HOSPITALITY & TOURISM TAGS
            // ==========================================
            CreateTag("hotel_nearby", "Hotel Nearby", TagCategory.Hospitality,
                "Hotels in the vicinity - travelers",
                "[\"lodging\",\"hotel\"]",
                250, null, 1, "Hotel", "#3F51B5"),
            
            CreateTag("hotel_cluster", "Hotel Cluster", TagCategory.Hospitality,
                "Multiple hotels - tourism hub",
                "[\"lodging\",\"hotel\"]",
                500, 3, 2, "Business", "#303F9F"),
            
            CreateTag("luxury_hotel_nearby", "Luxury Hotel Nearby", TagCategory.Hospitality,
                "Premium hotels - affluent travelers",
                "[\"lodging\"]", // filtered by rating
                250, null, 3, "Stars", "#1A237E"),
            
            CreateTag("tourist_attraction_nearby", "Tourist Attraction Nearby", TagCategory.Hospitality,
                "Tourist points of interest",
                "[\"tourist_attraction\"]",
                500, null, 5, "TravelExplore", "#00BCD4"),
            
            CreateTag("tourist_zone", "Tourist Zone", TagCategory.Hospitality,
                "High tourism activity area",
                "[\"tourist_attraction\",\"museum\"]",
                500, 3, 6, "Map", "#0097A7"),
            
            CreateTag("heritage_site_nearby", "Heritage Site Nearby", TagCategory.Hospitality,
                "Historical landmarks and monuments",
                "[\"museum\",\"tourist_attraction\"]",
                500, null, 8, "Museum", "#5D4037"),
            
            CreateTag("amusement_park_nearby", "Amusement Park Nearby", TagCategory.Hospitality,
                "Theme parks and amusement venues",
                "[\"amusement_park\"]",
                500, null, 12, "Attractions", "#E91E63"),
            
            // ==========================================
            // ENTERTAINMENT & LEISURE TAGS
            // ==========================================
            CreateTag("movie_theater_nearby", "Movie Theater Nearby", TagCategory.Entertainment,
                "Cinema halls - entertainment seekers",
                "[\"movie_theater\"]",
                250, null, 1, "Theaters", "#9C27B0"),
            
            CreateTag("entertainment_district", "Entertainment District", TagCategory.Entertainment,
                "Multiple entertainment venues",
                "[\"movie_theater\",\"bowling_alley\",\"amusement_center\"]",
                500, 3, 2, "Celebration", "#7B1FA2"),
            
            CreateTag("museum_nearby", "Museum Nearby", TagCategory.Entertainment,
                "Museums and cultural institutions",
                "[\"museum\"]",
                500, null, 5, "Museum", "#5D4037"),
            
            CreateTag("art_gallery_nearby", "Art Gallery Nearby", TagCategory.Entertainment,
                "Art galleries - culture enthusiasts",
                "[\"art_gallery\"]",
                250, null, 6, "Palette", "#8E24AA"),
            
            CreateTag("stadium_nearby", "Stadium Nearby", TagCategory.Entertainment,
                "Sports stadiums - event crowds",
                "[\"stadium\"]",
                500, null, 8, "Stadium", "#43A047"),
            
            CreateTag("park_nearby", "Park Nearby", TagCategory.Entertainment,
                "Public parks - families, joggers",
                "[\"park\"]",
                100, null, 10, "Park", "#66BB6A"),
            
            CreateTag("playground_nearby", "Playground Nearby", TagCategory.Entertainment,
                "Children's playgrounds - families",
                "[\"playground\"]",
                100, null, 12, "ChildCare", "#AED581"),
            
            // ==========================================
            // RELIGIOUS TAGS
            // ==========================================
            CreateTag("temple_nearby", "Temple Nearby", TagCategory.Religious,
                "Hindu temples",
                "[\"hindu_temple\"]",
                250, null, 1, "Temple", "#FF9800"),
            
            CreateTag("mosque_nearby", "Mosque Nearby", TagCategory.Religious,
                "Mosques",
                "[\"mosque\"]",
                250, null, 2, "Mosque", "#4CAF50"),
            
            CreateTag("church_nearby", "Church Nearby", TagCategory.Religious,
                "Churches",
                "[\"church\"]",
                250, null, 3, "Church", "#2196F3"),
            
            CreateTag("gurudwara_nearby", "Gurudwara Nearby", TagCategory.Religious,
                "Sikh temples",
                null, 250, null, 4, "Temple", "#FF9800"),
            
            CreateTag("religious_zone", "Religious Zone", TagCategory.Religious,
                "Multiple places of worship",
                "[\"hindu_temple\",\"mosque\",\"church\",\"synagogue\"]",
                500, 3, 5, "Place", "#607D8B"),
            
            // ==========================================
            // FINANCIAL SERVICES TAGS
            // ==========================================
            CreateTag("bank_nearby", "Bank Nearby", TagCategory.Financial,
                "Bank branches",
                "[\"bank\"]",
                100, null, 1, "AccountBalance", "#1E88E5"),
            
            CreateTag("banking_cluster", "Banking Cluster", TagCategory.Financial,
                "Multiple banks - financial hub",
                "[\"bank\"]",
                250, 3, 2, "AccountBalanceWallet", "#1565C0"),
            
            CreateTag("atm_cluster", "ATM Cluster", TagCategory.Financial,
                "Multiple ATMs available",
                "[\"atm\"]",
                100, 5, 5, "LocalAtm", "#0D47A1"),
            
            // ==========================================
            // CORPORATE & OFFICE TAGS
            // ==========================================
            CreateTag("corporate_zone", "Corporate Zone", TagCategory.Corporate,
                "Office buildings - professionals",
                null, 250, 5, 1, "Business", "#607D8B"),
            
            CreateTag("business_park", "Business Park", TagCategory.Corporate,
                "Business campus area",
                null, 500, null, 2, "CorporateFare", "#546E7A"),
            
            CreateTag("it_tech_hub", "IT/Tech Hub", TagCategory.Corporate,
                "Technology companies concentration",
                null, 500, null, 3, "Computer", "#1565C0"),
            
            CreateTag("coworking_nearby", "Coworking Nearby", TagCategory.Corporate,
                "Shared workspaces - freelancers, startups",
                "[\"corporate_office\"]", 100, null, 5, "Groups", "#42A5F5"),
            
            CreateTag("startup_ecosystem", "Startup Ecosystem", TagCategory.Corporate,
                "Startup culture hub",
                null, 500, null, 6, "RocketLaunch", "#26A69A"),
            
            // ==========================================
            // GOVERNMENT & CIVIC TAGS
            // ==========================================
            CreateTag("government_office_nearby", "Government Office Nearby", TagCategory.Government,
                "Government buildings",
                "[\"local_government_office\",\"government_office\",\"city_hall\"]",
                250, null, 1, "AccountBalance", "#455A64"),
            
            CreateTag("courthouse_nearby", "Courthouse Nearby", TagCategory.Government,
                "Courts and legal institutions",
                "[\"courthouse\"]",
                500, null, 3, "Gavel", "#37474F"),
            
            CreateTag("post_office_nearby", "Post Office Nearby", TagCategory.Government,
                "Postal services",
                "[\"post_office\"]",
                100, null, 5, "LocalPostOffice", "#78909C"),
            
            CreateTag("police_station_nearby", "Police Station Nearby", TagCategory.Government,
                "Police stations",
                "[\"police\"]",
                250, null, 8, "LocalPolice", "#263238"),
            
            // ==========================================
            // RESIDENTIAL TAGS
            // ==========================================
            CreateTag("residential_area", "Residential Area", TagCategory.Residential,
                "Housing/apartments - local residents",
                null, 250, null, 1, "Home", "#8D6E63"),
            
            CreateTag("gated_community_nearby", "Gated Community Nearby", TagCategory.Residential,
                "Gated residential societies",
                null, 500, null, 3, "Security", "#6D4C41"),
            
            CreateTag("luxury_residential", "Luxury Residential", TagCategory.Residential,
                "Premium housing area",
                null, 500, null, 4, "Villa", "#5D4037"),
            
            CreateTag("family_neighborhood", "Family Neighborhood", TagCategory.Residential,
                "Family-oriented residential area",
                null, 500, null, 5, "FamilyRestroom", "#795548"),
            
            // ==========================================
            // AUDIENCE PROFILE TAGS
            // ==========================================
            CreateTag("young_professionals", "Young Professionals", TagCategory.AudienceProfile,
                "Working millennials/Gen-Z - 25-40 age group",
                null, null, null, 1, "Person", "#3F51B5"),
            
            CreateTag("student_audience", "Student Audience", TagCategory.AudienceProfile,
                "College/school students - 18-25 age group",
                null, null, null, 2, "School", "#FF9800"),
            
            CreateTag("family_audience", "Family Audience", TagCategory.AudienceProfile,
                "Families with children",
                null, null, null, 3, "FamilyRestroom", "#4CAF50"),
            
            CreateTag("senior_citizens", "Senior Citizens", TagCategory.AudienceProfile,
                "Elderly population",
                null, null, null, 5, "Elderly", "#9E9E9E"),
            
            CreateTag("tourist_audience", "Tourist Audience", TagCategory.AudienceProfile,
                "Visitors and travelers",
                null, null, null, 6, "Luggage", "#00BCD4"),
            
            CreateTag("daily_commuters", "Daily Commuters", TagCategory.AudienceProfile,
                "Regular transit users",
                null, null, null, 7, "Commute", "#607D8B"),
            
            CreateTag("health_enthusiasts", "Health Enthusiasts", TagCategory.AudienceProfile,
                "Fitness and health-focused individuals",
                null, null, null, 10, "FitnessCenter", "#4CAF50"),
            
            CreateTag("foodies", "Foodies", TagCategory.AudienceProfile,
                "Food and dining enthusiasts",
                null, null, null, 11, "Restaurant", "#F44336"),
            
            CreateTag("tech_savvy", "Tech-Savvy Audience", TagCategory.AudienceProfile,
                "Technology users and early adopters",
                null, null, null, 12, "Computer", "#2196F3"),
            
            CreateTag("luxury_seekers", "Luxury Seekers", TagCategory.AudienceProfile,
                "Premium/luxury consumers",
                null, null, null, 13, "Diamond", "#9C27B0"),
            
            CreateTag("budget_conscious", "Budget-Conscious", TagCategory.AudienceProfile,
                "Value-seeking consumers",
                null, null, null, 14, "Savings", "#FF5722"),
            
            CreateTag("nightlife_lovers", "Nightlife Lovers", TagCategory.AudienceProfile,
                "Evening/night activity enthusiasts",
                null, null, null, 15, "NightlifeOutlined", "#7C4DFF"),
            
            CreateTag("shopping_enthusiasts", "Shopping Enthusiasts", TagCategory.AudienceProfile,
                "Retail and shopping lovers",
                null, null, null, 16, "ShoppingBag", "#E91E63"),
            
            // ==========================================
            // TIME-BASED TAGS
            // ==========================================
            CreateTag("morning_rush_zone", "Morning Rush Zone", TagCategory.TimeBased,
                "High activity 7-10 AM - commuters",
                null, null, null, 1, "WbSunny", "#FFC107"),
            
            CreateTag("lunch_hour_zone", "Lunch Hour Zone", TagCategory.TimeBased,
                "Peak activity 12-2 PM - office workers",
                null, null, null, 2, "LunchDining", "#FF9800"),
            
            CreateTag("evening_rush_zone", "Evening Rush Zone", TagCategory.TimeBased,
                "High activity 5-8 PM - returning commuters",
                null, null, null, 3, "WbTwilight", "#FF5722"),
            
            CreateTag("night_active_zone", "Night Active Zone", TagCategory.TimeBased,
                "Activity 9 PM - 2 AM - nightlife",
                null, null, null, 4, "NightsStay", "#311B92"),
            
            CreateTag("24_hour_zone", "24-Hour Zone", TagCategory.TimeBased,
                "Round-the-clock activity",
                null, null, null, 5, "Schedule", "#00BCD4"),
            
            CreateTag("weekday_zone", "Weekday Zone", TagCategory.TimeBased,
                "Active primarily Mon-Fri",
                null, null, null, 8, "WorkHistory", "#607D8B"),
            
            CreateTag("weekend_hotspot", "Weekend Hotspot", TagCategory.TimeBased,
                "Peak activity on Sat-Sun",
                null, null, null, 9, "EventAvailable", "#9C27B0"),
            
            // ==========================================
            // ECONOMIC ZONE TAGS
            // ==========================================
            CreateTag("premium_zone", "Premium Zone", TagCategory.Economic,
                "High spending power area",
                null, null, null, 1, "TrendingUp", "#9C27B0"),
            
            CreateTag("upper_middle_class_zone", "Upper Middle Class Zone", TagCategory.Economic,
                "Above-average spending power",
                null, null, null, 2, "AccountBalanceWallet", "#673AB7"),
            
            CreateTag("middle_class_zone", "Middle Class Zone", TagCategory.Economic,
                "Average spending power",
                null, null, null, 3, "People", "#3F51B5"),
            
            CreateTag("budget_zone", "Budget Zone", TagCategory.Economic,
                "Cost-conscious consumer area",
                null, null, null, 4, "Savings", "#2196F3"),
            
            CreateTag("luxury_lifestyle_zone", "Luxury Lifestyle Zone", TagCategory.Economic,
                "Ultra-premium lifestyle area",
                null, null, null, 5, "Stars", "#7B1FA2"),
            
            CreateTag("high_commercial_activity", "High Commercial Activity", TagCategory.Economic,
                "Dense business and retail activity",
                null, null, null, 8, "Storefront", "#00796B"),
            
            // ==========================================
            // LIFESTYLE/COMPOSITE TAGS
            // ==========================================
            CreateTag("tech_startup_ecosystem", "Tech Startup Ecosystem", TagCategory.Lifestyle,
                "IT hub + coworking + cafes + young professionals",
                null, null, null, 1, "RocketLaunch", "#00BCD4"),
            
            CreateTag("foodie_paradise", "Foodie Paradise", TagCategory.Lifestyle,
                "Culinary destination - diverse cuisines",
                null, null, null, 2, "DinnerDining", "#F44336"),
            
            CreateTag("fitness_wellness_hub", "Fitness & Wellness Hub", TagCategory.Lifestyle,
                "Gyms + yoga + health food + sports",
                null, null, null, 3, "FitnessCenter", "#4CAF50"),
            
            CreateTag("family_friendly_zone", "Family-Friendly Zone", TagCategory.Lifestyle,
                "Schools + parks + family dining + playgrounds",
                null, null, null, 4, "FamilyRestroom", "#8BC34A"),
            
            CreateTag("cultural_heritage_zone", "Cultural Heritage Zone", TagCategory.Lifestyle,
                "Museums + galleries + theaters + heritage sites",
                null, null, null, 5, "Museum", "#795548"),
            
            CreateTag("nightlife_entertainment_hub", "Nightlife & Entertainment Hub", TagCategory.Lifestyle,
                "Bars + clubs + late dining + theaters",
                null, null, null, 6, "NightlifeOutlined", "#7C4DFF"),
            
            CreateTag("corporate_business_hub", "Corporate Business Hub", TagCategory.Lifestyle,
                "Offices + banks + professional services + hotels",
                null, null, null, 7, "BusinessCenter", "#607D8B"),
            
            CreateTag("student_ecosystem", "Student Ecosystem", TagCategory.Lifestyle,
                "University + affordable dining + libraries + cafes",
                null, null, null, 8, "School", "#FF9800"),
            
            CreateTag("urban_millennials", "Urban Millennials", TagCategory.Lifestyle,
                "City-dwelling young adults - coworking + cafes + nightlife",
                null, null, null, 10, "Person", "#E91E63"),
        });

        context.ScreenTags.AddRange(tags);
        await context.SaveChangesAsync();
    }

    private static ScreenTag CreateTag(
        string slug,
        string displayName,
        TagCategory category,
        string description,
        string? googlePlaceTypes,
        int? maxDistanceMeters,
        int? minPoiCount,
        int priority,
        string iconName,
        string colorCode)
    {
        return new ScreenTag
        {
            Id = Guid.NewGuid(),
            Slug = slug,
            DisplayName = displayName,
            Category = category,
            Description = description,
            GooglePlaceTypes = googlePlaceTypes,
            MaxDistanceMeters = maxDistanceMeters,
            MinPoiCount = minPoiCount,
            Priority = priority,
            IsSystemTag = true,
            IconName = iconName,
            ColorCode = colorCode,
            CreatedAt = DateTime.UtcNow
        };
    }
}
