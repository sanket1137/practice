# Screen Tagging & Advertiser Search System
## Technical Implementation & User Experience Document

---

## Part 1: Screen Tagging System (Backend Logic)

### 1.1 System Flow Overview

```
Screen Owner Registers Screen
         ↓
    [Lat/Long Input]
         ↓
    Google Maps API
         ↓
  POI Data Collection
         ↓
   Tag Generation Engine
         ↓
   Tag Scoring & Ranking
         ↓
  Store Tags in Database
         ↓
   Screen Profile Ready
         ↓
  Advertiser Discovery
```

---

### 1.2 Screen Registration & Tagging Process

#### STEP 1: Screen Owner Input
**Data Collected:**
- Screen ID (unique identifier)
- Latitude (e.g., 12.9716° N)
- Longitude (e.g., 77.5946° E)
- Screen Type (LED billboard, digital poster, video wall)
- Screen Size (width × height in feet)
- Screen Location Description (optional: "Near MG Road Metro")
- Operating Hours (24/7, 6 AM - 11 PM, etc.)
- Screen Owner Details

**Example:**
```
Screen ID: SCR_BLR_001
Latitude: 12.9716
Longitude: 77.5946
Location: "Indiranagar, Bangalore"
Screen Type: Digital LED Billboard
Size: 20ft × 10ft
Operating Hours: 24/7
```

---

#### STEP 2: Multi-Radius POI Search

The system performs **concentric circle searches** at different radii to understand proximity and density:

**Search Zones:**

| Zone | Radius | Purpose | Weight |
|------|--------|---------|--------|
| **Immediate** | 0-250m | Critical proximity (pedestrian view) | 1.0 |
| **Near** | 250-500m | Walking distance | 0.7 |
| **Moderate** | 500-750m | Short walk/bike distance | 0.5 |
| **Extended** | 750-1000m | General vicinity | 0.3 |
| **Catchment** | 1-2km | Broader area context (for major POIs) | 0.15 |

**Google Maps API Calls:**

For each radius zone, query all POI types:

```
API Request Example:
Endpoint: https://places.googleapis.com/v1/places:searchNearby

Payload:
{
  "locationRestriction": {
    "circle": {
      "center": {
        "latitude": 12.9716,
        "longitude": 77.5946
      },
      "radius": 250
    }
  },
  "includedTypes": [
    "restaurant", "cafe", "school", "hospital", "metro_station",
    "shopping_mall", "bank", "gym", "hotel", "bar", "park",
    [... all 100+ types from BRD ...]
  ],
  "maxResultCount": 20
}
```

**Repeat for each radius:** 250m, 500m, 750m, 1000m, 2000m

---

#### STEP 3: POI Data Extraction

For each POI found, extract:

| Field | Purpose | Example |
|-------|---------|---------|
| `name` | POI name | "Cafe Coffee Day" |
| `types[]` | POI categories | ["cafe", "restaurant", "food"] |
| `location` | Lat/Long | {12.9720, 77.5950} |
| `distance` | Distance from screen | 180m |
| `rating` | Google rating | 4.2 |
| `userRatingsTotal` | Review count | 1,250 |
| `priceLevel` | Cost indicator | MODERATE |
| `businessStatus` | Operational status | OPERATIONAL |

**Calculate Distance:**
```
Distance = Haversine formula between screen and POI coordinates
```

---

#### STEP 4: Tag Generation Logic

#### 4.1 Proximity-Based Tags

**Rule: Single POI Proximity**

If a significant POI exists within threshold distance, add proximity tag:

| POI Type | Tag Generated | Distance Threshold |
|----------|---------------|-------------------|
| Metro Station | `metro_station_proximity` | ≤ 500m |
| Railway Station | `railway_station_proximity` | ≤ 1km |
| Airport | `airport_proximity` | ≤ 5km |
| Shopping Mall | `mall_proximity` | ≤ 500m |
| Hospital | `hospital_proximity` | ≤ 1km |
| University | `university_nearby` | ≤ 1km |
| School | `school_zone` | ≤ 500m |
| Hotel | `hotel_nearby` | ≤ 500m |
| Park | `park_nearby` | ≤ 500m |
| Temple/Mosque/Church | `[religion]_nearby` | ≤ 500m |

**Example Logic:**
```
IF metro_station found at 350m distance
THEN add tag: "metro_station_proximity"
     add tag: "metro_catchment_area"
     add tag: "daily_commuters"
     add tag: "morning_commuter_zone"
     add tag: "evening_commuter_zone"
```

---

#### 4.2 Density-Based Tags

**Rule: POI Clustering**

Count POIs by type within each zone and apply density tags:

**Restaurant Example:**

| Count in 500m | Tag Generated | Priority |
|---------------|---------------|----------|
| 1-4 | `restaurants_nearby` | Low |
| 5-14 | `restaurant_cluster` | Medium |
| 15+ | `foodie_zone` | High |

**Gym Example:**

| Count in 1km | Tag Generated |
|--------------|---------------|
| 1-2 | `gym_nearby` |
| 3-5 | `fitness_zone` |
| 6+ | `wellness_hub` |

**Logic:**
```
restaurant_count_500m = Count(restaurants within 500m)

IF restaurant_count_500m >= 15
    THEN add tag: "foodie_zone" (Priority: High)
ELSE IF restaurant_count_500m >= 5
    THEN add tag: "restaurant_cluster" (Priority: Medium)
ELSE IF restaurant_count_500m >= 1
    THEN add tag: "restaurants_nearby" (Priority: Low)
```

---

#### 4.3 Weighted Scoring System

Each POI contributes to tag score based on:

**Score = Base Score × Distance Weight × Quality Multiplier**

**Distance Weight:**
- 0-250m: 1.0
- 250-500m: 0.7
- 500-750m: 0.5
- 750-1000m: 0.3
- 1-2km: 0.15

**Quality Multiplier:**
- Rating 4.5+: 1.2
- Rating 4.0-4.4: 1.0
- Rating 3.5-3.9: 0.8
- Rating < 3.5: 0.6
- No rating: 1.0

**Example Calculation:**

Screen has 3 restaurants nearby:
1. Fine dining restaurant @ 200m, rating 4.6
   - Score = 100 × 1.0 × 1.2 = 120
2. Cafe @ 450m, rating 4.1
   - Score = 100 × 0.7 × 1.0 = 70
3. Fast food @ 800m, rating 3.8
   - Score = 100 × 0.3 × 0.8 = 24

**Total Restaurant Score: 214**

If total score ≥ 200 → Add `foodie_zone` tag

---

#### 4.4 Composite Tag Logic

**Composite tags require multiple conditions:**

**Example: `tech_startup_ecosystem`**

Required Components:
```
IF (IT park OR coworking ≤ 1km)
   AND (cafes ≥ 3 within 500m)
   AND (university ≤ 2km OR engineering college ≤ 2km)
   AND (modern restaurants ≥ 5 within 1km)
THEN add tag: "tech_startup_ecosystem"
```

**Example: `family_friendly_zone`**

```
IF (schools ≥ 2 within 500m)
   AND (parks ≥ 1 within 500m)
   AND (family restaurants ≥ 3 within 1km)
   AND (supermarkets ≥ 1 within 500m)
THEN add tag: "family_friendly_zone"
```

**Example: `luxury_lifestyle_zone`**

```
IF (luxury_hotels ≥ 1 within 1km)
   AND (fine_dining ≥ 3 within 1km)
   AND (designer_stores ≥ 2 within 1km)
   AND (spas ≥ 1 within 1km)
THEN add tag: "luxury_lifestyle_zone"
```

---

#### 4.5 Audience Profile Derivation

Based on generated tags, derive audience profiles:

| Generated Tags | Audience Profile Tag |
|----------------|---------------------|
| `university_nearby` + `cafe_culture` + `affordable_dining` | `student_audience` |
| `corporate_zone` + `metro_proximity` + `lunch_restaurants` | `young_professionals` |
| `schools` + `parks` + `family_restaurants` | `family_audience` |
| `hotel_cluster` + `tourist_attractions` | `tourist_audience` |
| `gyms` + `yoga_studios` + `health_food` | `health_enthusiasts` |
| `luxury_retail` + `fine_dining` + `premium_hotels` | `luxury_seekers` |

---

#### 4.6 Time-Based Tag Assignment

Based on POI types and location, assign temporal tags:

**Morning Rush (7-10 AM):**
```
IF (metro_station OR railway_station ≤ 500m)
   AND (office_buildings ≥ 5 within 1km)
THEN add tag: "morning_rush_zone"
```

**Lunch Hour (12-2 PM):**
```
IF (corporate_zone = true)
   AND (restaurants ≥ 10 within 500m)
THEN add tag: "lunch_hour_zone"
```

**Evening Rush (5-8 PM):**
```
IF (metro_station OR railway_station ≤ 500m)
   AND (residential_area within 2km)
THEN add tag: "evening_rush_zone"
```

**Night Active (9 PM - 2 AM):**
```
IF (bars ≥ 3 OR nightclubs ≥ 1 within 500m)
THEN add tag: "night_active_zone"
```

---

#### STEP 5: Tag Prioritization & Ranking

After all tags are generated, rank them by:

**Priority Levels:**
1. **Primary Tags (Top 5):** Most dominant characteristics
2. **Secondary Tags (Next 10):** Supporting characteristics
3. **Tertiary Tags (Remaining):** Additional context

**Ranking Factors:**
- Score (weighted POI count)
- Distance (closer = higher priority)
- Uniqueness (rare tags rank higher)
- Commercial value (high-value POIs rank higher)

**Example Tag Output:**

```json
{
  "screen_id": "SCR_BLR_001",
  "location": {
    "latitude": 12.9716,
    "longitude": 77.5946,
    "address": "Indiranagar 100 Feet Road, Bangalore"
  },
  "tags": {
    "primary": [
      {
        "tag": "metro_station_proximity",
        "score": 950,
        "priority": 1,
        "category": "transportation"
      },
      {
        "tag": "foodie_zone",
        "score": 880,
        "priority": 2,
        "category": "food_beverage"
      },
      {
        "tag": "nightlife_zone",
        "score": 720,
        "priority": 3,
        "category": "entertainment"
      },
      {
        "tag": "shopping_district",
        "score": 650,
        "priority": 4,
        "category": "retail"
      },
      {
        "tag": "young_professionals",
        "score": 600,
        "priority": 5,
        "category": "audience"
      }
    ],
    "secondary": [
      "cafe_culture",
      "gym_nearby",
      "hotel_cluster",
      "bar_district",
      "banking_cluster",
      "restaurant_cluster",
      "park_nearby",
      "corporate_zone",
      "cinema_nearby",
      "pharmacy_cluster"
    ],
    "time_based": [
      "morning_rush_zone",
      "lunch_hour_zone",
      "evening_rush_zone",
      "night_active_zone"
    ],
    "audience_profiles": [
      "young_professionals",
      "urban_millennials",
      "foodies",
      "nightlife_lovers",
      "fitness_enthusiasts"
    ],
    "economic": [
      "premium_zone",
      "high_spending_power"
    ]
  },
  "poi_summary": {
    "total_pois": 342,
    "restaurants": 45,
    "cafes": 18,
    "bars": 12,
    "metro_stations": 1,
    "gyms": 5,
    "hotels": 8,
    "banks": 7,
    "shopping_malls": 2
  }
}
```

---

### 1.3 Automated Re-Tagging System

**Frequency:** Re-tag screens every:
- **90 days** (quarterly) - Full re-scan
- **On-demand** - When screen owner requests update
- **Event-triggered** - When major POI changes detected (new mall opens, metro station launch)

**Change Detection:**
- Compare new POI data with previous scan
- Flag significant changes (±20% POI count change)
- Update tags automatically
- Notify advertisers of affected active campaigns

---

## Part 2: Advertiser Search & Discovery System

### 2.1 Advertiser Dashboard - Screen Discovery Interface

#### 2.1.1 Main Search Interface

**Layout Components:**

```
┌─────────────────────────────────────────────────────────┐
│  SCREEN DISCOVERY DASHBOARD                             │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  [Search by Location] [Search by Tags] [Advanced]       │
│                                                          │
│  ┌────────────────────┐  ┌──────────────────────────┐  │
│  │  MAP VIEW          │  │  TAG FILTER PANEL        │  │
│  │                    │  │                          │  │
│  │  [Interactive Map] │  │  Select Your Criteria:   │  │
│  │                    │  │                          │  │
│  │  📍 Screens shown  │  │  ☐ Audience Type         │  │
│  │                    │  │  ☐ Location Type         │  │
│  └────────────────────┘  │  ☐ Time of Day           │  │
│                          │  ☐ POI Categories        │  │
│  ┌────────────────────┐  │  ☐ Economic Zone         │  │
│  │  RESULTS LIST      │  │                          │  │
│  │  (245 screens)     │  │  [Apply Filters]         │  │
│  │                    │  └──────────────────────────┘  │
│  │  Screen Cards...   │                                │
│  └────────────────────┘                                │
└─────────────────────────────────────────────────────────┘
```

---

#### 2.1.2 Search Method 1: Location-Based Search

**Option A: City/Area Selection**
```
Select City: [Bangalore ▼]
Select Area: [Indiranagar ▼]
Radius: [1 km ▼]

[Search Screens]
```

**Option B: Draw on Map**
```
[Draw Circle] [Draw Polygon] [Select Landmarks]

User draws area on map → System shows all screens within boundary
```

**Option C: Enter Coordinates**
```
Latitude: [______]
Longitude: [______]
Search Radius: [___] km

[Find Screens]
```

---

#### 2.1.3 Search Method 2: Tag-Based Search (PRIMARY METHOD)

**Multi-Level Tag Filter Panel:**

##### **LEVEL 1: Quick Filters (Popular Tags)**

Displayed as clickable chips:

```
Popular Tags:
[🚇 Metro Stations] [🏢 Corporate Zones] [🎓 Universities]
[🍽️ Foodie Zones] [🏨 Hotels] [🛍️ Shopping Malls]
[🏋️ Gyms & Fitness] [🌃 Nightlife] [🏥 Hospitals]
[✈️ Airports] [🚂 Railway Stations] [🏛️ Tourist Areas]
```

Click any chip → Instantly filters screens with that tag

---

##### **LEVEL 2: Category-Based Filter (Expandable Sections)**

**Interface Design:**

```
┌─────────────────────────────────────────────┐
│  FILTER BY CATEGORIES                       │
├─────────────────────────────────────────────┤
│                                             │
│  ▼ TRANSPORTATION & TRANSIT                 │
│     ☐ Metro Station Proximity               │
│     ☐ Railway Station Proximity             │
│     ☐ Airport Proximity                     │
│     ☐ Bus Terminal Nearby                   │
│     ☐ High Traffic Corridor                 │
│     ☐ Transit Hub                           │
│                                             │
│  ▼ FOOD & BEVERAGE                          │
│     ☐ Foodie Zone (High Density)            │
│     ☐ Restaurant Cluster                    │
│     ☐ Cafe Culture                          │
│     ☐ Fine Dining Nearby                    │
│     ☐ Fast Food Zone                        │
│     ☐ Nightlife Zone                        │
│     ☐ Bar District                          │
│                                             │
│  ▼ RETAIL & SHOPPING                        │
│     ☐ Shopping Mall Proximity               │
│     ☐ Shopping District                     │
│     ☐ Luxury Retail Zone                    │
│     ☐ Supermarket Nearby                    │
│     ☐ Electronics Stores                    │
│                                             │
│  ▼ EDUCATION                                │
│     ☐ University Nearby                     │
│     ☐ School Zone                           │
│     ☐ Coaching Center Zone                  │
│     ☐ Library Nearby                        │
│     ☐ Student Hangout Zone                  │
│                                             │
│  ▼ OFFICE & CORPORATE                       │
│     ☐ Corporate Zone                        │
│     ☐ IT/Tech Hub                           │
│     ☐ Business Park                         │
│     ☐ Coworking Nearby                      │
│     ☐ Startup Ecosystem                     │
│                                             │
│  ▼ HEALTHCARE & WELLNESS                    │
│     ☐ Hospital Proximity                    │
│     ☐ Gym Nearby                            │
│     ☐ Fitness Zone                          │
│     ☐ Yoga/Spa Nearby                       │
│     ☐ Pharmacy Cluster                      │
│                                             │
│  ▼ HOSPITALITY & TOURISM                    │
│     ☐ Hotel Nearby                          │
│     ☐ Tourist Zone                          │
│     ☐ Tourist Attraction Nearby             │
│     ☐ Heritage Site Nearby                  │
│     ☐ Luxury Hotel Nearby                   │
│                                             │
│  ▼ ENTERTAINMENT & LEISURE                  │
│     ☐ Movie Theater Nearby                  │
│     ☐ Entertainment District                │
│     ☐ Park Nearby                           │
│     ☐ Sports Complex Nearby                 │
│     ☐ Cultural Center Nearby                │
│                                             │
│  ▼ RESIDENTIAL                              │
│     ☐ Residential Area                      │
│     ☐ Gated Community Nearby                │
│     ☐ Luxury Residential                    │
│     ☐ Family Neighborhood                   │
│                                             │
│  ▼ RELIGIOUS & SPIRITUAL                    │
│     ☐ Temple Nearby                         │
│     ☐ Mosque Nearby                         │
│     ☐ Church Nearby                         │
│     ☐ Religious Zone                        │
│     ☐ Pilgrimage Route                      │
│                                             │
│  [Clear All] [Apply Filters (15 selected)]  │
└─────────────────────────────────────────────┘
```

**Selection Behavior:**
- Multiple tags can be selected (AND/OR logic)
- Real-time counter shows matching screens
- Hover over tag shows definition tooltip

---

##### **LEVEL 3: Audience Profile Filter**

```
┌─────────────────────────────────────────────┐
│  TARGET AUDIENCE                            │
├─────────────────────────────────────────────┤
│                                             │
│  Select Your Target Audience:               │
│                                             │
│  ☐ Young Professionals (25-40)              │
│  ☐ Students (18-25)                         │
│  ☐ Families with Children                   │
│  ☐ Senior Professionals (40+)               │
│  ☐ Tourists & Travelers                     │
│  ☐ Daily Commuters                          │
│  ☐ Local Residents                          │
│  ☐ Senior Citizens                          │
│                                             │
│  Lifestyle Interests:                       │
│  ☐ Foodies                                  │
│  ☐ Health & Fitness Enthusiasts             │
│  ☐ Tech-Savvy Users                         │
│  ☐ Luxury Seekers                           │
│  ☐ Budget-Conscious                         │
│  ☐ Nightlife Lovers                         │
│  ☐ Shopping Enthusiasts                     │
│  ☐ Culture & Arts Lovers                    │
│  ☐ Outdoor Enthusiasts                      │
│                                             │
└─────────────────────────────────────────────┘
```

---

##### **LEVEL 4: Time-Based Filter**

```
┌─────────────────────────────────────────────┐
│  WHEN DO YOU WANT TO REACH THEM?            │
├─────────────────────────────────────────────┤
│                                             │
│  Peak Activity Times:                       │
│  ☐ Morning Rush (7-10 AM)                   │
│  ☐ Lunch Hour (12-2 PM)                     │
│  ☐ Evening Rush (5-8 PM)                    │
│  ☐ Night Active (9 PM - 2 AM)               │
│  ☐ 24-Hour Zones                            │
│                                             │
│  Weekly Patterns:                           │
│  ☐ Weekday Active (Mon-Fri)                 │
│  ☐ Weekend Hotspot (Sat-Sun)                │
│                                             │
└─────────────────────────────────────────────┘
```

---

##### **LEVEL 5: Economic Zone Filter**

```
┌─────────────────────────────────────────────┐
│  SPENDING POWER OF AUDIENCE                 │
├─────────────────────────────────────────────┤
│                                             │
│  Select Economic Zone:                      │
│  ☐ Premium Zone (High Spending Power)       │
│  ☐ Upper Middle Class Zone                  │
│  ☐ Middle Class Zone                        │
│  ☐ Budget Zone                              │
│  ☐ Luxury Lifestyle Zone                    │
│                                             │
└─────────────────────────────────────────────┘
```

---

#### 2.1.4 Advanced Search (Boolean Logic)

For power users who want precise control:

```
┌─────────────────────────────────────────────────────────┐
│  ADVANCED TAG SEARCH                                    │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  Build Your Query:                                      │
│                                                         │
│  ┌────────────────────────────────────────────────┐    │
│  │  (metro_station_proximity OR railway_station)  │    │
│  │  AND                                           │    │
│  │  (foodie_zone OR restaurant_cluster)           │    │
│  │  AND                                           │    │
│  │  young_professionals                           │    │
│  │  NOT                                           │    │
│  │  residential_area                              │    │
│  └────────────────────────────────────────────────┘    │
│                                                         │
│  [Add Rule] [Clear Query] [Search]                     │
│                                                         │
│  Matching Screens: 47                                  │
└─────────────────────────────────────────────────────────┘
```

---

### 2.2 Search Results Display

#### 2.2.1 Screen Card Layout

Each matching screen shows:

```
┌──────────────────────────────────────────────────────┐
│  📍 Screen ID: SCR_BLR_001                           │
│  Indiranagar 100 Feet Road, Bangalore                │
├──────────────────────────────────────────────────────┤
│  [Screen Image/Photo]                                │
├──────────────────────────────────────────────────────┤
│  PRIMARY TAGS:                                        │
│  🚇 Metro Station    🍽️ Foodie Zone   🌃 Nightlife   │
│  🛍️ Shopping         👔 Young Professionals           │
│                                                       │
│  AUDIENCE REACH: 50,000+ daily footfall              │
│  PEAK HOURS: 7-10 AM, 5-8 PM, 9 PM-12 AM             │
│  ECONOMIC ZONE: Premium                              │
│                                                       │
│  📊 Screen Stats:                                    │
│  • 20ft × 10ft Digital LED                           │
│  • 24/7 Operation                                    │
│  • Video + Static Ad Support                         │
│                                                       │
│  💰 Starting from ₹5,000/day                         │
│                                                       │
│  [View Full Profile] [Add to Campaign] [Contact]     │
└──────────────────────────────────────────────────────┘
```

---

#### 2.2.2 Detailed Screen Profile Page

When advertiser clicks "View Full Profile":

```
┌─────────────────────────────────────────────────────────────┐
│  SCREEN PROFILE: SCR_BLR_001                                 │
│  Indiranagar 100 Feet Road, Bangalore                        │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────────┐  ┌────────────────────────────────────┐  │
│  │  Screen      │  │  LOCATION INTELLIGENCE              │  │
│  │  Photo       │  │                                     │  │
│  │  Gallery     │  │  🚇 Indiranagar Metro: 350m        │  │
│  │              │  │  🏢 Corporate Offices: 15 within 1km│  │
│  │  [4 photos]  │  │  🍽️ Restaurants: 45 within 500m    │  │
│  └──────────────┘  │  ☕ Cafes: 18 within 500m           │  │
│                    │  🏨 Hotels: 8 within 1km            │  │
│  ┌──────────────┐  │  🎬 Cinema: 2 within 1km           │  │
│  │  Map View    │  │  🏋️ Gyms: 5 within 500m            │  │
│  │              │  │  🏪 Shopping Mall: 400m             │  │
│  │  [Map with   │  │                                     │  │
│  │   POIs]      │  └────────────────────────────────────┘  │
│  └──────────────┘                                           │
│                                                              │
│  ALL TAGS (32):                                             │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  PRIMARY (5):                                         │  │
│  │  • metro_station_proximity                           │  │
│  │  • foodie_zone                                       │  │
│  │  • nightlife_zone                                    │  │
│  │  • shopping_district                                 │  │
│  │  • young_professionals                               │  │
│  │                                                       │  │
│  │  SECONDARY (15):                                     │  │
│  │  • cafe_culture                                      │  │
│  │  • gym_nearby                                        │  │
│  │  • hotel_cluster                                     │  │
│  │  • bar_district                                      │  │
│  │  • banking_cluster                                   │  │
│  │  • restaurant_cluster                                │  │
│  │  • park_nearby                                       │  │
│  │  • corporate_zone                                    │  │
│  │  • cinema_nearby                                     │  │
│  │  • pharmacy_cluster                                  │  │
│  │  [+5 more]                                          │  │
│  │                                                       │  │
│  │  TIME-BASED (4):                                     │  │
│  │  • morning_rush_zone (7-10 AM)                      │  │
│  │  • lunch_hour_zone (12-2 PM)                        │  │
│  │  • evening_rush_zone (5-8 PM)                       │  │
│  │  • night_active_zone (9 PM-2 AM)                    │  │
│  │                                                       │  │
│  │  AUDIENCE PROFILES (5):                             │  │
│  │  • young_professionals (Primary)                     │  │
│  │  • urban_millennials                                 │  │
│  │  • foodies                                           │  │
│  │  • nightlife_lovers                                  │  │
│  │  • fitness_enthusiasts                               │  │
│  │                                                       │  │
│  │  ECONOMIC (2):                                       │  │
│  │  • premium_zone                                      │  │
│  │  • high_spending_power                               │  │
│  └──────────────────────────────────────────────────────┘  │
│