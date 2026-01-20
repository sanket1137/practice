# Screen Tagging System - Business Requirements Document (BRD)

## Executive Summary

### Purpose
This document outlines the comprehensive tagging system for a digital outdoor advertising platform where screens are automatically tagged based on their geographical context using Google Maps Places API. The system enables advertisers to target audiences based on real-world location intelligence.

### Business Objectives
1. Automate screen profiling based on surrounding Points of Interest (POI)
2. Enable hyper-targeted advertising campaigns
3. Maximize advertiser ROI through contextual relevance
4. Increase screen booking rates through better discovery
5. Provide data-driven insights for pricing and ad placement

---

## 1. System Overview

### 1.1 Core Concept
When a screen owner registers their screen with latitude/longitude coordinates, the system:
- Queries Google Maps Places API within defined radius zones
- Identifies all nearby POIs across 100+ categories
- Calculates density, proximity, and relevance scores
- Generates primary, secondary, and contextual tags
- Creates an audience profile for the screen
- Enables search and filtering for advertisers

### 1.2 Tag Hierarchy
```
Screen Tags
├── Primary Tags (Top 3-5 dominant characteristics)
├── Secondary Tags (Supporting characteristics)
├── Proximity Tags (Specific POI distances)
├── Audience Profile Tags (Demographics & psychographics)
├── Time-based Tags (Peak hours, seasonal patterns)
├── Economic Tags (Spending power indicators)
└── Composite Tags (Multi-factor combinations)
```

---

## 2. Complete Tag Categories & Definitions

### 2.1 TRANSPORTATION & TRANSIT TAGS

#### 2.1.1 Public Transport Hubs
| Tag | Definition | Trigger Condition | Business Value |
|-----|------------|-------------------|----------------|
| `metro_station_proximity` | Metro/subway within range | Metro station ≤500m | High footfall, commuters |
| `railway_station_proximity` | Train station nearby | Railway station ≤1km | Travelers, long dwell time |
| `bus_terminal_proximity` | Bus station/depot nearby | Bus station ≤500m | Daily commuters |
| `airport_proximity` | Airport within range | Airport ≤5km | Travelers, high spending power |
| `transit_hub` | Multiple transit modes converge | 3+ transit types ≤500m | Maximum footfall |
| `metro_catchment_area` | Within metro station catchment | 250m-1km from metro | Regular commuters |
| `railway_catchment_area` | Within railway catchment | 500m-2km from station | Mixed travelers |

#### 2.1.2 Transit Behavior Tags
| Tag | Definition | Trigger Condition |
|-----|------------|-------------------|
| `morning_commuter_zone` | High morning transit activity | Transit hub + 7-10 AM peak |
| `evening_commuter_zone` | High evening transit activity | Transit hub + 5-8 PM peak |
| `weekend_traveler_zone` | Weekend transit activity | Transit hub + weekend patterns |
| `daily_commuter_path` | On regular commute routes | Between residential & office zones |

#### 2.1.3 Road & Highway Tags
| Tag | Definition | Trigger Condition |
|-----|------------|-------------------|
| `highway_visibility` | On major highway | Highway/expressway ≤100m |
| `arterial_road` | On main city road | Major road ≤50m |
| `high_traffic_corridor` | Heavy traffic zone | Traffic volume indicators |
| `toll_plaza_proximity` | Near toll collection | Toll booth ≤500m |

#### 2.1.4 Automotive Services
| Tag | Definition | Trigger Condition |
|-----|------------|-------------------|
| `gas_station_nearby` | Fuel stations nearby | 1+ gas station ≤500m |
| `gas_station_cluster` | Multiple fuel stations | 3+ gas stations ≤1km |
| `ev_charging_zone` | EV charging available | 1+ EV charger ≤500m |
| `car_service_zone` | Auto repair/wash nearby | 2+ service centers ≤1km |
| `car_dealership_zone` | Auto showrooms nearby | 1+ dealership ≤1km |
| `parking_facility_nearby` | Parking available | Parking lot ≤250m |

---

### 2.2 RETAIL & SHOPPING TAGS

#### 2.2.1 Shopping Centers
| Tag | Definition | Trigger Condition |
|-----|------------|-------------------|
| `mall_proximity` | Shopping mall nearby | Mall ≤500m |
| `mall_entrance` | At mall entry point | Mall entrance ≤100m |
| `shopping_district` | High retail density | 10+ retail stores ≤500m |
| `luxury_retail_zone` | Premium shopping area | Luxury brands ≤500m |
| `street_shopping_area` | Street market/bazaar | Traditional markets ≤250m |
| `wholesale_market` | Wholesale trade area | Wholesale markets ≤1km |

#### 2.2.2 Retail Categories
| Tag | Definition | Trigger Condition |
|-----|------------|-------------------|
| `supermarket_nearby` | Grocery stores nearby | 1+ supermarket ≤500m |
| `convenience_store_cluster` | 24/7 stores nearby | 3+ convenience stores ≤500m |
| `electronics_retail_zone` | Electronics stores | 2+ electronics stores ≤1km |
| `fashion_retail_zone` | Clothing/apparel stores | 5+ clothing stores ≤1km |
| `home_goods_zone` | Furniture/home stores | 2+ furniture stores ≤1km |
| `jewelry_zone` | Jewelry stores nearby | 2+ jewelry stores ≤500m |
| `bookstore_nearby` | Book retailers | 1+ bookstore ≤1km |
| `pharmacy_nearby` | Drugstores nearby | 1+ pharmacy ≤500m |
| `pharmacy_cluster` | Multiple pharmacies | 3+ pharmacies ≤1km |

---

### 2.3 FOOD & BEVERAGE TAGS

#### 2.3.1 Restaurant Density
| Tag | Definition | Trigger Condition |
|-----|------------|-------------------|
| `foodie_zone` | High restaurant density | 15+ restaurants ≤500m |
| `restaurant_cluster` | Restaurant concentration | 5-14 restaurants ≤500m |
| `restaurants_nearby` | Restaurants present | 1-4 restaurants ≤500m |
| `dining_destination` | Premium dining area | 5+ fine dining ≤1km |

#### 2.3.2 Dining Categories
| Tag | Definition | Trigger Condition |
|-----|------------|-------------------|
| `fast_food_zone` | Quick service restaurants | 5+ fast food ≤500m |
| `cafe_culture` | Coffee shops prevalent | 5+ cafes ≤500m |
| `cafe_nearby` | Coffee shops available | 1+ cafe ≤500m |
| `fine_dining_nearby` | Upscale restaurants | 1+ fine dining ≤500m |
| `casual_dining_zone` | Family restaurants | 5+ casual dining ≤1km |
| `ethnic_food_hub` | Diverse cuisines | 5+ different cuisines ≤500m |
| `vegetarian_zone` | Veg/vegan options | 3+ veg restaurants ≤500m |
| `bakery_nearby` | Bakeries/desserts | 1+ bakery ≤500m |
| `juice_bar_nearby` | Health drink shops | 1+ juice bar ≤500m |

#### 2.3.3 Nightlife & Bars
| Tag | Definition | Trigger Condition |
|-----|------------|-------------------|
| `nightlife_zone` | Bars/pubs/clubs | 3+ bars ≤500m |
| `bar_district` | High bar density | 5+ bars ≤1km |
| `nightclub_nearby` | Dance clubs | 1+ nightclub ≤500m |
| `brewery_nearby` | Craft breweries | 1+ brewery ≤1km |

#### 2.3.4 Dining Timing Tags
| Tag | Definition | Trigger Condition |
|-----|------------|-------------------|
| `breakfast_destination` | Morning dining options | 5+ breakfast places ≤500m |
| `lunch_hour_zone` | Lunch crowd area | Restaurant zone + 12-2 PM |
| `dinner_destination` | Evening dining | 5+ dinner restaurants ≤500m |
| `late_night_dining` | 24/7 or late hours | 3+ late night eateries ≤1km |

---

### 2.4 EDUCATION TAGS

#### 2.4.1 Schools & Academic Institutions
| Tag | Definition | Trigger Condition |
|-----|------------|-------------------|
| `school_zone` | Schools nearby | 1+ school ≤500m |
| `primary_school_nearby` | Elementary schools | 1+ primary school ≤500m |
| `secondary_school_nearby` | High schools | 1+ secondary school ≤500m |
| `school_cluster` | Multiple schools | 3+ schools ≤1km |
| `university_nearby` | College/university | 1+ university ≤1km |
| `university_campus` | Within campus area | University ≤250m |
| `educational_hub` | High education density | 5+ educational institutions ≤1km |

#### 2.4.2 Learning Centers
| Tag | Definition | Trigger Condition |
|-----|------------|-------------------|
| `coaching_center_zone` | Tutorial centers | 3+ coaching centers ≤500m |
| `library_nearby` | Public/academic library | 1+ library ≤1km |
| `skill_training_nearby` | Vocational training | 1+ training center ≤1km |
| `preschool_daycare_nearby` | Childcare centers | 1+ daycare ≤500m |

#### 2.4.3 Student Behavior Tags
| Tag | Definition | Trigger Condition |
|-----|------------|-------------------|
| `student_hangout_zone` | Student gathering spots | University + cafes + fast food |
| `exam_prep_zone` | Test prep area | Coaching centers + library |
| `campus_life_zone` | Active student life | University + entertainment + dining |

---

### 2.5 HEALTHCARE & WELLNESS TAGS

#### 2.5.1 Medical Facilities
| Tag | Definition | Trigger Condition |
|-----|------------|-------------------|
| `hospital_proximity` | Hospital nearby | 1+ hospital ≤1km |
| `major_hospital_nearby` | Large hospital | Major hospital ≤2km |
| `medical_district` | Healthcare cluster | 3+ hospitals ≤2km |
| `clinic_nearby` | Doctor clinics | 2+ clinics ≤500m |
| `dental_clinic_nearby` | Dentists nearby | 1+ dentist ≤1km |
| `veterinary_nearby` | Pet healthcare | 1+ vet clinic ≤1km |
| `medical_lab_nearby` | Diagnostic centers | 1+ lab ≤1km |

#### 2.5.2 Fitness & Wellness
| Tag | Definition | Trigger Condition |
|-----|------------|-------------------|
| `gym_nearby` | Fitness centers | 1+ gym ≤500m |
| `fitness_zone` | Multiple gyms | 3+ gyms ≤1km |
| `yoga_studio_nearby` | Yoga/meditation | 1+ yoga studio ≤1km |
| `spa_wellness_nearby` | Spa/massage centers | 1+ spa ≤1km |
| `wellness_hub` | Health & fitness focus | Gym + yoga + health store ≤1km |
| `sports_complex_nearby` | Sports facilities | 1+ sports complex ≤1km |

#### 2.5.3 Health-Conscious Tags
| Tag | Definition | Trigger Condition |
|-----|------------|-------------------|
| `health_conscious_zone` | Wellness lifestyle area | Gym + health food + yoga |
| `organic_food_nearby` | Health food stores | 1+ organic store ≤1km |
| `juice_detox_zone` | Health drinks | 2+ juice bars ≤500m |

---

### 2.6 RESIDENTIAL TAGS

#### 2.6.1 Housing Types
| Tag | Definition | Trigger Condition |
|-----|------------|-------------------|
| `residential_area` | Housing present | Residential indicators ≤500m |
| `high_rise_apartments` | Apartment complexes | Apartment buildings ≤500m |
| `gated_community_nearby` | Gated societies | Gated communities ≤1km |
| `luxury_residential` | Premium housing | Luxury apartments ≤1km |
| `suburban_area` | Suburban neighborhood | Low-density housing ≤1km |

#### 2.6.2 Residential Density
| Tag | Definition | Trigger Condition |
|-----|------------|-------------------|
| `dense_residential` | High population density | High-density indicators |
| `family_neighborhood` | Family-oriented area | Schools + parks + supermarkets |
| `senior_living_nearby` | Retirement communities | Senior housing ≤1km |
| `student_housing_zone` | Student accommodation | Near university + hostels |

---

### 2.7 OFFICE & CORPORATE TAGS

#### 2.7.1 Business Districts
| Tag | Definition | Trigger Condition |
|-----|------------|-------------------|
| `corporate_zone` | Office buildings | 5+ offices ≤500m |
| `business_park` | Business campus | Business park ≤1km |
| `it_tech_hub` | Tech companies | IT park ≤1km |
| `startup_ecosystem` | Startup area | Coworking + VCs + cafes |
| `financial_district` | Banking/finance area | 5+ banks + financial services |
| `coworking_nearby` | Shared workspaces | 1+ coworking ≤500m |

#### 2.7.2 Professional Services
| Tag | Definition | Trigger Condition |
|-----|------------|-------------------|
| `professional_services_zone` | Lawyers, accountants, etc. | 5+ professional services ≤1km |
| `office_supplies_nearby` | Business support | Office supply stores ≤1km |

#### 2.7.3 Corporate Behavior Tags
| Tag | Definition | Trigger Condition |
|-----|------------|-------------------|
| `weekday_business_zone` | Active Mon-Fri | Office area + weekday patterns |
| `lunch_rush_zone` | Lunchtime activity | Office area + 12-2 PM |
| `after_work_zone` | Post-work activity | Office area + 6-9 PM |

---

### 2.8 ENTERTAINMENT & LEISURE TAGS

#### 2.8.1 Entertainment Venues
| Tag | Definition | Trigger Condition |
|-----|------------|-------------------|
| `movie_theater_nearby` | Cinema halls | 1+ theater ≤1km |
| `multiplex_nearby` | Multi-screen cinema | Multiplex ≤1km |
| `entertainment_district` | Multiple venues | Theater + gaming + bowling ≤1km |
| `casino_gaming_nearby` | Casinos | 1+ casino ≤2km |
| `arcade_gaming_nearby` | Gaming zones | 1+ arcade ≤1km |

#### 2.8.2 Arts & Culture
| Tag | Definition | Trigger Condition |
|-----|------------|-------------------|
| `museum_nearby` | Museums | 1+ museum ≤2km |
| `art_gallery_nearby` | Art galleries | 1+ gallery ≤1km |
| `cultural_center_nearby` | Cultural venues | 1+ cultural center ≤1km |
| `theater_performing_arts` | Live performances | 1+ theater ≤1km |
| `cultural_district` | Arts & heritage area | Museum + gallery + theater |

#### 2.8.3 Sports & Recreation
| Tag | Definition | Trigger Condition |
|-----|------------|-------------------|
| `stadium_nearby` | Sports stadiums | 1+ stadium ≤2km |
| `sports_venue_proximity` | Sports facilities | Stadium/arena ≤1km |
| `bowling_alley_nearby` | Bowling centers | 1+ bowling ≤1km |
| `golf_course_nearby` | Golf clubs | 1+ golf course ≤2km |
| `swimming_pool_nearby` | Swimming facilities | 1+ pool ≤1km |
| `sports_club_nearby` | Sports clubs | 1+ sports club ≤1km |

#### 2.8.4 Outdoor Recreation
| Tag | Definition | Trigger Condition |
|-----|------------|-------------------|
| `park_nearby` | Public parks | 1+ park ≤500m |
| `botanical_garden_nearby` | Gardens | 1+ garden ≤2km |
| `beach_proximity` | Beaches | Beach ≤2km |
| `hiking_trail_nearby` | Nature trails | 1+ trail ≤2km |
| `national_park_nearby` | Protected areas | National park ≤5km |
| `playground_nearby` | Children's playgrounds | 1+ playground ≤500m |
| `dog_park_nearby` | Pet parks | 1+ dog park ≤1km |

---

### 2.9 HOSPITALITY & TOURISM TAGS

#### 2.9.1 Lodging
| Tag | Definition | Trigger Condition |
|-----|------------|-------------------|
| `hotel_nearby` | Hotels | 1+ hotel ≤500m |
| `hotel_cluster` | Multiple hotels | 3+ hotels ≤1km |
| `luxury_hotel_nearby` | Premium hotels | 1+ luxury hotel ≤1km |
| `budget_hotel_zone` | Budget lodging | 3+ budget hotels ≤1km |
| `resort_nearby` | Resort hotels | 1+ resort ≤2km |
| `hostel_backpacker_zone` | Budget travelers | 2+ hostels ≤1km |

#### 2.9.2 Tourism & Attractions
| Tag | Definition | Trigger Condition |
|-----|------------|-------------------|
| `tourist_attraction_nearby` | Tourist spots | 1+ attraction ≤1km |
| `tourist_zone` | High tourism area | 3+ attractions ≤2km |
| `heritage_site_nearby` | Historical landmarks | 1+ heritage site ≤2km |
| `monument_nearby` | Monuments | 1+ monument ≤1km |
| `religious_tourism_zone` | Pilgrimage area | Multiple religious sites ≤2km |
| `aquarium_zoo_nearby` | Animal attractions | 1+ aquarium/zoo ≤2km |
| `amusement_park_nearby` | Theme parks | 1+ amusement park ≤3km |

#### 2.9.3 Tourist Behavior Tags
| Tag | Definition | Trigger Condition |
|-----|------------|-------------------|
| `weekend_tourist_hotspot` | Weekend visitors | Tourism area + weekend patterns |
| `holiday_destination` | Vacation spot | Hotels + attractions + dining |
| `photo_opportunity_zone` | Scenic/landmark area | Tourist attractions ≤250m |

---

### 2.10 RELIGIOUS & SPIRITUAL TAGS

#### 2.10.1 Places of Worship
| Tag | Definition | Trigger Condition |
|-----|------------|-------------------|
| `temple_nearby` | Hindu temples | 1+ temple ≤500m |
| `mosque_nearby` | Mosques | 1+ mosque ≤500m |
| `church_nearby` | Churches | 1+ church ≤500m |
| `gurudwara_nearby` | Sikh temples | 1+ gurudwara ≤500m |
| `synagogue_nearby` | Synagogues | 1+ synagogue ≤1km |
| `buddhist_temple_nearby` | Buddhist temples | 1+ Buddhist temple ≤1km |

#### 2.10.2 Religious Zones
| Tag | Definition | Trigger Condition |
|-----|------------|-------------------|
| `religious_zone` | Multiple worship places | 3+ places of worship ≤1km |
| `pilgrimage_route` | Pilgrimage path | Religious sites + tourist hotels |
| `spiritual_retreat_zone` | Meditation/ashrams | Spiritual centers ≤2km |

#### 2.10.3 Religious Event Tags
| Tag | Definition | Trigger Condition |
|-----|------------|-------------------|
| `festival_celebration_zone` | Festival events area | Religious zone + event venues |
| `prayer_time_zone` | Active prayer times | Mosque/temple + time-based patterns |

---

### 2.11 FINANCIAL SERVICES TAGS

#### 2.11.1 Banking
| Tag | Definition | Trigger Condition |
|-----|------------|-------------------|
| `bank_nearby` | Bank branches | 1+ bank ≤500m |
| `banking_cluster` | Multiple banks | 3+ banks ≤500m |
| `atm_available` | ATM access | 1+ ATM ≤250m |
| `atm_cluster` | Multiple ATMs | 5+ ATMs ≤500m |

#### 2.11.2 Financial Services
| Tag | Definition | Trigger Condition |
|-----|------------|-------------------|
| `financial_services_nearby` | Investment/insurance | 2+ financial services ≤1km |
| `stock_exchange_proximity` | Near exchange | Stock exchange ≤2km |
| `accounting_services_nearby` | Accountants | 2+ accountants ≤1km |

---

### 2.12 GOVERNMENT & CIVIC TAGS

#### 2.12.1 Government Offices
| Tag | Definition | Trigger Condition |
|-----|------------|-------------------|
| `government_office_nearby` | Govt buildings | 1+ govt office ≤1km |
| `city_hall_nearby` | Municipal offices | City hall ≤2km |
| `courthouse_nearby` | Courts | 1+ court ≤2km |
| `post_office_nearby` | Postal services | 1+ post office ≤1km |

#### 2.12.2 Emergency Services
| Tag | Definition | Trigger Condition |
|-----|------------|-------------------|
| `police_station_nearby` | Police stations | 1+ police station ≤1km |
| `fire_station_nearby` | Fire stations | 1+ fire station ≤2km |

#### 2.12.3 Civic Facilities
| Tag | Definition | Trigger Condition |
|-----|------------|-------------------|
| `community_center_nearby` | Community halls | 1+ community center ≤1km |
| `public_library_nearby` | Public libraries | 1+ library ≤1km |

---

### 2.13 EVENT & VENUE TAGS

#### 2.13.1 Event Spaces
| Tag | Definition | Trigger Condition |
|-----|------------|-------------------|
| `convention_center_nearby` | Convention halls | 1+ convention center ≤2km |
| `banquet_hall_nearby` | Event halls | 1+ banquet hall ≤1km |
| `wedding_venue_nearby` | Marriage venues | 1+ wedding venue ≤1km |
| `conference_center_nearby` | Business events | 1+ conference center ≤2km |

#### 2.13.2 Event Activity Tags
| Tag | Definition | Trigger Condition |
|-----|------------|-------------------|
| `event_destination` | Frequent events | Event venues + hotels |
| `exhibition_center_nearby` | Trade shows | Exhibition center ≤2km |

---

### 2.14 SPECIALTY SERVICES TAGS

#### 2.14.1 Personal Services
| Tag | Definition | Trigger Condition |
|-----|------------|-------------------|
| `hair_salon_nearby` | Salons/barbershops | 1+ salon ≤500m |
| `beauty_salon_cluster` | Multiple salons | 3+ salons ≤500m |
| `spa_beauty_zone` | Beauty services | Salon + spa + beauty stores |
| `laundry_nearby` | Laundromats | 1+ laundry ≤500m |

#### 2.14.2 Home Services
| Tag | Definition | Trigger Condition |
|-----|------------|-------------------|
| `hardware_store_nearby` | Hardware shops | 1+ hardware store ≤1km |
| `furniture_store_nearby` | Furniture retailers | 1+ furniture store ≤1km |
| `home_improvement_zone` | DIY/renovation | Hardware + paint + furniture |

#### 2.14.3 Pet Services
| Tag | Definition | Trigger Condition |
|-----|------------|-------------------|
| `pet_store_nearby` | Pet shops | 1+ pet store ≤1km |
| `pet_services_zone` | Pet care area | Vet + pet store + grooming |

---

### 2.15 INDUSTRIAL & COMMERCIAL TAGS

#### 2.15.1 Industrial Areas
| Tag | Definition | Trigger Condition |
|-----|------------|-------------------|
| `industrial_zone` | Factories/warehouses | Industrial area ≤1km |
| `warehouse_district` | Storage facilities | Warehouses ≤1km |
| `manufacturing_zone` | Production facilities | Factories ≤2km |

#### 2.15.2 Commercial Services
| Tag | Definition | Trigger Condition |
|-----|------------|-------------------|
| `logistics_hub` | Courier/delivery | Logistics centers ≤2km |
| `storage_facility_nearby` | Self-storage | 1+ storage ≤1km |
| `printing_services_nearby` | Print shops | 1+ print shop ≤1km |

---

## 3. AUDIENCE PROFILE TAGS

### 3.1 Demographic Tags
| Tag | Definition | Derivation Logic |
|-----|------------|------------------|
| `family_audience` | Families with children | Schools + playgrounds + family dining |
| `student_audience` | College/school students | Universities + coaching + youth hangouts |
| `young_professionals` | Working millennials/Gen-Z | Offices + coworking + cafes + gyms |
| `senior_professionals` | Experienced workers | Corporate zone + fine dining + banks |
| `senior_citizens` | Elderly population | Senior living + hospitals + parks |
| `tourist_audience` | Visitors/travelers | Hotels + attractions + transport hubs |
| `daily_commuters` | Regular travelers | Metro/railway + residential + office zones |
| `local_residents` | Neighborhood locals | Residential + local shops + parks |

### 3.2 Psychographic Tags
| Tag | Definition | Derivation Logic |
|-----|------------|------------------|
| `health_enthusiasts` | Fitness-focused | Gyms + yoga + health food + sports |
| `foodies` | Food lovers | High restaurant density + diverse cuisines |
| `tech_savvy` | Technology users | IT hubs + electronics stores + coworking |
| `luxury_seekers` | Premium consumers | Luxury retail + fine dining + premium hotels |
| `budget_conscious` | Value seekers | Budget hotels + discount stores + fast food |
| `culture_enthusiasts` | Arts/heritage lovers | Museums + galleries + theaters + heritage sites |
| `outdoor_enthusiasts` | Nature/adventure lovers | Parks + hiking + beaches + sports facilities |
| `religious_community` | Faith-oriented | Religious sites + traditional markets |
| `nightlife_lovers` | Evening/night activity | Bars + nightclubs + late dining |
| `shopping_enthusiasts` | Retail lovers | Malls + shopping districts + boutiques |

### 3.3 Lifestyle Tags
| Tag | Definition | Derivation Logic |
|-----|------------|------------------|
| `urban_millennials` | City-dwelling young adults | Coworking + cafes + gyms + nightlife |
| `suburban_families` | Suburban households | Residential + schools + supermarkets + parks |
| `corporate_warriors` | Office workers | Business districts + lunch spots + metro |
| `student_life` | Academic lifestyle | University + hostels + affordable dining |
| `expat_friendly` | International residents | International schools + upscale dining + embassies |
| `fitness_lifestyle` | Active living | Gyms + sports + health food + outdoor recreation |
| `wellness_seekers` | Health-conscious | Yoga + spas + organic food + wellness centers |

---

## 4. ECONOMIC & SPENDING TAGS

### 4.1 Affluence Indicators
| Tag | Definition | Trigger Condition |
|-----|------------|-------------------|
| `premium_zone` | High spending power | Luxury retail + fine dining + premium services |
| `upper_middle_class_zone` | Above-average spending | Mid-luxury retail + casual fine dining |
| `middle_class_zone` | Average spending | Mix of retail types + chain restaurants |
| `budget_zone` | Cost-conscious area | Discount stores + budget dining + budget hotels |
| `luxury_lifestyle_zone` | Ultra-premium | Luxury hotels + designer stores + spas + fine dining |

### 4.2 Commercial Activity
| Tag | Definition | Trigger Condition |
|-----|------------|-------------------|
| `high_commercial_activity` | Dense business | High POI density across categories |
| `emerging_commercial_zone` | Developing area | Growing POI count |
| `established_commercial_hub` | Mature business area | Diverse established businesses |

---

## 5. TIME-BASED & BEHAVIORAL TAGS

### 5.1 Peak Hour Tags
| Tag | Definition | Active Hours |
|-----|------------|--------------|
| `morning_rush_zone` | Morning peak traffic | 7:00 AM - 10:00 AM |
| `lunch_hour_zone` | Lunchtime activity | 12:00 PM - 2:00 PM |
| `evening_rush_zone` | Evening peak traffic | 5:00 PM - 8:00 PM |
| `night_active_zone` | Night activity | 9:00 PM - 2:00 AM |
| `24_hour_zone` | Round-the-clock activity | 24/7 active POIs |

### 5.2 Weekly Pattern Tags
| Tag | Definition | Pattern |
|-----|------------|---------|
| `weekday_zone` | Mon-Fri activity | Office + business areas |
| `weekend_hotspot` | Sat-Sun activity | Entertainment + shopping + dining |
| `weekend_quiet_zone` | Low weekend activity | Business districts |

### 5.3 Seasonal Tags
| Tag | Definition | Season |
|-----|------------|--------|
| `summer_destination` | Summer activity | Beaches + outdoor attractions |
| `monsoon_indoor_zone` | Rainy season indoor | Malls + theaters + indoor entertainment |
| `festival_season_zone` | Festival activity | Religious sites + event venues |

---

## 6. COMPOSITE TAGS (Multi-Factor)

### 6.1 Lifestyle Ecosystems
| Tag | Definition | Component Tags |
|-----|------------|----------------|
| `tech_startup_ecosystem` | Startup culture hub | IT hub + coworking + VCs + cafes + universities |
| `foodie_paradise` | Culinary destination | Foodie zone + diverse cuisines + fine dining + cafes |
| `fitness_wellness_hub` | Health lifestyle | Gyms + yoga + health food + sports + spas |
| `student_ecosystem` | Student life hub | University + hostels + affordable dining + libraries + coaching |
| `family_friendly_zone` | Family living | Schools + parks + supermarkets + family dining + playgrounds |
| `luxury_lifestyle_district` | Premium living | Luxury retail + fine dining + spas + premium hotels + galleries |
| `cultural_heritage_zone` | Arts & heritage | Museums + galleries + theaters + heritage sites + cultural centers |
| `nightlife_entertainment_hub` | Night entertainment | Bars + clubs + late dining + theaters + casinos |

### 6.2 Business Ecosystems
| Tag | Definition | Component Tags |
|-----|------------|----------------|
| `corporate_business_hub` | Business center | Offices + banks + professional services + hotels |
| `retail_therapy_destination` | Shopping paradise