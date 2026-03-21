-- Update Screen Tag Radii to DOOH-Optimized Standards
-- Run this script against your PostgreSQL database to update existing tags

BEGIN;

-- ==========================================
-- TRANSPORTATION TAGS
-- ==========================================
UPDATE "ScreenTags" SET "MaxDistanceMeters" = 250 WHERE "Slug" = 'metro_station_proximity';
UPDATE "ScreenTags" SET "MaxDistanceMeters" = 500 WHERE "Slug" = 'railway_station_proximity';
UPDATE "ScreenTags" SET "MaxDistanceMeters" = 250 WHERE "Slug" = 'bus_terminal_proximity';
UPDATE "ScreenTags" SET "MaxDistanceMeters" = 500 WHERE "Slug" = 'airport_proximity';
UPDATE "ScreenTags" SET "MaxDistanceMeters" = 250 WHERE "Slug" = 'transit_hub';
UPDATE "ScreenTags" SET "MaxDistanceMeters" = 50 WHERE "Slug" = 'high_traffic_corridor';
UPDATE "ScreenTags" SET "MaxDistanceMeters" = 100 WHERE "Slug" = 'gas_station_nearby';
UPDATE "ScreenTags" SET "MaxDistanceMeters" = 100 WHERE "Slug" = 'ev_charging_zone';
UPDATE "ScreenTags" SET "MaxDistanceMeters" = 100 WHERE "Slug" = 'parking_facility_nearby';

-- ==========================================
-- RETAIL TAGS
-- ==========================================
UPDATE "ScreenTags" SET "MaxDistanceMeters" = 250 WHERE "Slug" = 'mall_proximity';
UPDATE "ScreenTags" SET "MaxDistanceMeters" = 250 WHERE "Slug" = 'shopping_district';
UPDATE "ScreenTags" SET "MaxDistanceMeters" = 250 WHERE "Slug" = 'luxury_retail_zone';
UPDATE "ScreenTags" SET "MaxDistanceMeters" = 100 WHERE "Slug" = 'supermarket_nearby';
UPDATE "ScreenTags" SET "MaxDistanceMeters" = 100 WHERE "Slug" = 'convenience_store_cluster';
UPDATE "ScreenTags" SET "MaxDistanceMeters" = 250 WHERE "Slug" = 'electronics_retail_zone';
UPDATE "ScreenTags" SET "MaxDistanceMeters" = 250 WHERE "Slug" = 'pharmacy_cluster';
UPDATE "ScreenTags" SET "MaxDistanceMeters" = 250 WHERE "Slug" = 'bookstore_nearby';

-- ==========================================
-- FOOD & BEVERAGE TAGS
-- ==========================================
UPDATE "ScreenTags" SET "MaxDistanceMeters" = 250 WHERE "Slug" = 'foodie_zone';
UPDATE "ScreenTags" SET "MaxDistanceMeters" = 250 WHERE "Slug" = 'restaurant_cluster';
UPDATE "ScreenTags" SET "MaxDistanceMeters" = 100 WHERE "Slug" = 'cafe_culture';
UPDATE "ScreenTags" SET "MaxDistanceMeters" = 100 WHERE "Slug" = 'fast_food_zone';
UPDATE "ScreenTags" SET "MaxDistanceMeters" = 250 WHERE "Slug" = 'fine_dining_nearby';
UPDATE "ScreenTags" SET "MaxDistanceMeters" = 250 WHERE "Slug" = 'nightlife_zone';
UPDATE "ScreenTags" SET "MaxDistanceMeters" = 250 WHERE "Slug" = 'bar_district';
UPDATE "ScreenTags" SET "MaxDistanceMeters" = 100 WHERE "Slug" = 'bakery_nearby';
UPDATE "ScreenTags" SET "MaxDistanceMeters" = 250 WHERE "Slug" = 'late_night_dining';

-- ==========================================
-- EDUCATION TAGS
-- ==========================================
UPDATE "ScreenTags" SET "MaxDistanceMeters" = 250 WHERE "Slug" = 'school_zone';
UPDATE "ScreenTags" SET "MaxDistanceMeters" = 500 WHERE "Slug" = 'university_nearby';
UPDATE "ScreenTags" SET "MaxDistanceMeters" = 100 WHERE "Slug" = 'university_campus';
UPDATE "ScreenTags" SET "MaxDistanceMeters" = 500 WHERE "Slug" = 'educational_hub';
UPDATE "ScreenTags" SET "MaxDistanceMeters" = 250 WHERE "Slug" = 'coaching_center_zone';
UPDATE "ScreenTags" SET "MaxDistanceMeters" = 250 WHERE "Slug" = 'library_nearby';
UPDATE "ScreenTags" SET "MaxDistanceMeters" = 250 WHERE "Slug" = 'student_hangout_zone';

-- ==========================================
-- HEALTHCARE TAGS
-- ==========================================
UPDATE "ScreenTags" SET "MaxDistanceMeters" = 500 WHERE "Slug" = 'hospital_proximity';
UPDATE "ScreenTags" SET "MaxDistanceMeters" = 500 WHERE "Slug" = 'medical_district';
UPDATE "ScreenTags" SET "MaxDistanceMeters" = 250 WHERE "Slug" = 'clinic_nearby';
UPDATE "ScreenTags" SET "MaxDistanceMeters" = 100 WHERE "Slug" = 'gym_nearby';
UPDATE "ScreenTags" SET "MaxDistanceMeters" = 250 WHERE "Slug" = 'fitness_zone';
UPDATE "ScreenTags" SET "MaxDistanceMeters" = 250 WHERE "Slug" = 'yoga_studio_nearby';
UPDATE "ScreenTags" SET "MaxDistanceMeters" = 250 WHERE "Slug" = 'spa_wellness_nearby';
UPDATE "ScreenTags" SET "MaxDistanceMeters" = 250 WHERE "Slug" = 'wellness_hub';
UPDATE "ScreenTags" SET "MaxDistanceMeters" = 250 WHERE "Slug" = 'veterinary_nearby';

-- ==========================================
-- HOSPITALITY TAGS
-- ==========================================
UPDATE "ScreenTags" SET "MaxDistanceMeters" = 250 WHERE "Slug" = 'hotel_nearby';
UPDATE "ScreenTags" SET "MaxDistanceMeters" = 500 WHERE "Slug" = 'hotel_cluster';
UPDATE "ScreenTags" SET "MaxDistanceMeters" = 250 WHERE "Slug" = 'luxury_hotel_nearby';
UPDATE "ScreenTags" SET "MaxDistanceMeters" = 500 WHERE "Slug" = 'tourist_attraction_nearby';
UPDATE "ScreenTags" SET "MaxDistanceMeters" = 500 WHERE "Slug" = 'tourist_zone';
UPDATE "ScreenTags" SET "MaxDistanceMeters" = 500 WHERE "Slug" = 'heritage_site_nearby';
UPDATE "ScreenTags" SET "MaxDistanceMeters" = 500 WHERE "Slug" = 'amusement_park_nearby';

-- ==========================================
-- ENTERTAINMENT TAGS
-- ==========================================
UPDATE "ScreenTags" SET "MaxDistanceMeters" = 250 WHERE "Slug" = 'movie_theater_nearby';
UPDATE "ScreenTags" SET "MaxDistanceMeters" = 500 WHERE "Slug" = 'entertainment_district';
UPDATE "ScreenTags" SET "MaxDistanceMeters" = 500 WHERE "Slug" = 'museum_nearby';
UPDATE "ScreenTags" SET "MaxDistanceMeters" = 250 WHERE "Slug" = 'art_gallery_nearby';
UPDATE "ScreenTags" SET "MaxDistanceMeters" = 500 WHERE "Slug" = 'stadium_nearby';
UPDATE "ScreenTags" SET "MaxDistanceMeters" = 100 WHERE "Slug" = 'park_nearby';
UPDATE "ScreenTags" SET "MaxDistanceMeters" = 100 WHERE "Slug" = 'playground_nearby';

-- ==========================================
-- RELIGIOUS TAGS
-- ==========================================
UPDATE "ScreenTags" SET "MaxDistanceMeters" = 250 WHERE "Slug" = 'temple_nearby';
UPDATE "ScreenTags" SET "MaxDistanceMeters" = 250 WHERE "Slug" = 'mosque_nearby';
UPDATE "ScreenTags" SET "MaxDistanceMeters" = 250 WHERE "Slug" = 'church_nearby';
UPDATE "ScreenTags" SET "MaxDistanceMeters" = 250 WHERE "Slug" = 'gurudwara_nearby';
UPDATE "ScreenTags" SET "MaxDistanceMeters" = 500 WHERE "Slug" = 'religious_zone';

-- ==========================================
-- FINANCIAL TAGS
-- ==========================================
UPDATE "ScreenTags" SET "MaxDistanceMeters" = 100 WHERE "Slug" = 'bank_nearby';
UPDATE "ScreenTags" SET "MaxDistanceMeters" = 250 WHERE "Slug" = 'banking_cluster';
UPDATE "ScreenTags" SET "MaxDistanceMeters" = 100 WHERE "Slug" = 'atm_cluster';

-- ==========================================
-- CORPORATE TAGS
-- ==========================================
UPDATE "ScreenTags" SET "MaxDistanceMeters" = 250 WHERE "Slug" = 'corporate_zone';
UPDATE "ScreenTags" SET "MaxDistanceMeters" = 500 WHERE "Slug" = 'business_park';
UPDATE "ScreenTags" SET "MaxDistanceMeters" = 500 WHERE "Slug" = 'it_tech_hub';
UPDATE "ScreenTags" SET "MaxDistanceMeters" = 100 WHERE "Slug" = 'coworking_nearby';
UPDATE "ScreenTags" SET "MaxDistanceMeters" = 500 WHERE "Slug" = 'startup_ecosystem';

-- ==========================================
-- GOVERNMENT TAGS
-- ==========================================
UPDATE "ScreenTags" SET "MaxDistanceMeters" = 250 WHERE "Slug" = 'government_office_nearby';
UPDATE "ScreenTags" SET "MaxDistanceMeters" = 500 WHERE "Slug" = 'courthouse_nearby';
UPDATE "ScreenTags" SET "MaxDistanceMeters" = 100 WHERE "Slug" = 'post_office_nearby';
UPDATE "ScreenTags" SET "MaxDistanceMeters" = 250 WHERE "Slug" = 'police_station_nearby';

-- ==========================================
-- RESIDENTIAL TAGS
-- ==========================================
UPDATE "ScreenTags" SET "MaxDistanceMeters" = 250 WHERE "Slug" = 'residential_area';
UPDATE "ScreenTags" SET "MaxDistanceMeters" = 500 WHERE "Slug" = 'gated_community_nearby';
UPDATE "ScreenTags" SET "MaxDistanceMeters" = 500 WHERE "Slug" = 'luxury_residential';
UPDATE "ScreenTags" SET "MaxDistanceMeters" = 500 WHERE "Slug" = 'family_neighborhood';

-- Verify updates
SELECT "Slug", "DisplayName", "MaxDistanceMeters" 
FROM "ScreenTags" 
WHERE "MaxDistanceMeters" IS NOT NULL 
ORDER BY "Category", "Priority";

COMMIT;
