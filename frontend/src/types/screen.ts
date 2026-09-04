// Screen-related types for the frontend

export interface ScreenImage {
    id: string;
    imageUrl: string;
    imageType: 'Screen' | 'Surrounding';
    displayOrder: number;
    isPrimary: boolean;
    originalFileName?: string;
    sizeBytes?: number;
    width?: number;
    height?: number;
    uploadedAt: string;
}

export interface UploadScreenImagesResponse {
    success: boolean;
    message?: string;
    uploadedImages: ScreenImage[];
    errors: string[];
}

export interface ScreenImageValidation {
    maxScreenPhotos: number;
    maxSurroundingPhotos: number;
    minTotalImages: number;
    maxFileSizeBytes: number;
    allowedContentTypes: string[];
    allowedExtensions: string[];
}

export const SCREEN_IMAGE_VALIDATION: ScreenImageValidation = {
    maxScreenPhotos: 4,
    maxSurroundingPhotos: 5,
    minTotalImages: 1,
    maxFileSizeBytes: 10 * 1024 * 1024, // 10 MB
    allowedContentTypes: ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'],
    allowedExtensions: ['.jpg', '.jpeg', '.png', '.webp'],
};

export interface ScreenTagSummary {
    tagId: string;
    slug: string;
    displayName: string;
    category: string;
    iconName?: string;
    colorCode?: string;
    isPrimary: boolean;
    source: 'Auto' | 'Manual' | 'Admin';
}

export interface ScreenTagDetail extends ScreenTagSummary {
    description?: string;
    score: number;
    distanceMeters?: number;
    poiCount?: number;
    assignedAt: string;
}

export interface MasterTag {
    id: string;
    slug: string;
    displayName: string;
    category: string;
    description?: string;
    iconName?: string;
    colorCode?: string;
    priority: number;
    /** Active marketplace screens carrying this tag — populated only when ?includeScreenCounts=true. */
    screenCount?: number;
}

export interface GenerateTagsResult {
    success: boolean;
    message?: string;
    tagsGenerated: number;
    primaryTags: string[];
    fromCache: boolean;
    totalPoisFound: number;
}

export interface BoundingBox {
    minLat: number;
    minLng: number;
    maxLat: number;
    maxLng: number;
}

export interface SearchScreensRequest {
    searchText?: string;
    city?: string;
    state?: string;
    country?: string;
    latitude?: number;
    longitude?: number;
    radiusKm?: number;
    /** Viewport-bounded search; takes precedence over radiusKm when present. */
    boundingBox?: BoundingBox;
    requiredTagIds?: string[];
    anyTagIds?: string[];
    tagCategory?: string;
    minPrice?: number;
    maxPrice?: number;
    /** "Indoor" | "Outdoor" | "SemiIndoor" */
    displayType?: string;
    /** Billboard | LedWall | VideoWall | TvDisplay | Kiosk | Projection | TransitDisplay | Standee */
    screenType?: string;
    /** Venue the screen lives in: Cafe | Restaurant | Mall | Gym | Airport | ... */
    venueType?: string;
    /** "Landscape" | "Portrait" */
    orientation?: string;
    minResolutionWidth?: number;
    minResolutionHeight?: number;
    minDailyImpressions?: number;
    maxDailyImpressions?: number;
    minCpm?: number;
    maxCpm?: number;
    /** Returns only screens with NO confirmed booking overlapping this range. */
    availableFrom?: string; // YYYY-MM-DD
    availableTo?: string;   // YYYY-MM-DD
    /** Only currently-online screens. */
    onlineOnly?: boolean;
    /** Hour-of-day 0-23 the screen must be operating at (any weekday match). */
    operatingAtHour?: number;
    status?: string;
    page: number;
    pageSize: number;
    /** "distance" | "price" | "impressions" | "cpm" | "newest" | "name" */
    sortBy?: string;
    sortDirection?: 'asc' | 'desc';
}

export interface LocationSuggestion {
    label: string;
    kind: 'city' | 'state';
    city?: string;
    state?: string;
    screenCount: number;
    centerLatitude?: number;
    centerLongitude?: number;
}

export interface SearchScreensResult {
    screens: Screen[];
    totalCount: number;
    page: number;
    pageSize: number;
    totalPages: number;
}

export interface Screen {
    id: string;
    name: string;
    description: string;
    physicalWidth?: number;
    physicalHeight?: number;
    dimensionUnit?: string;
    resolutionWidth?: number;
    resolutionHeight?: number;
    location?: {
        street: string;
        city: string;
        state: string;
        country: string;
        postalCode: string;
    };
    latitude?: number;
    longitude?: number;
    timezone?: string;
    timeFrameMinutes?: number;
    slotsPerFrame?: number;
    deviceId?: string;
    status: string;
    pricePerSlot?: number;
    currency?: string;
    impressionsPerSlot?: number;
    dailyTotalImpressions?: number;
    isOnline?: boolean;
    lastSeenAt?: string;
    audienceQualityScore?: number;
    createdAt: string;
    lastTaggedAt?: string;
    tags?: ScreenTagSummary[];
    primaryTags?: ScreenTagSummary[];
    images?: ScreenImage[];
    primaryImage?: ScreenImage;
    /** "Indoor" | "Outdoor" | "SemiIndoor" */
    displayType?: string;
    /** Venue the screen lives in (Cafe, Mall, Gym, ...); "Unclassified" when unset. */
    venueType?: string;
    /** "Landscape" | "Portrait" */
    orientation?: string;
    /** Verification status string e.g. "Verified". */
    verificationStatus?: string;
    /** Distance from the search anchor in km (populated only when search included a coordinate anchor). */
    distanceKm?: number;
    /** Cost per mille (1 000 impressions). Null when impressions are unknown. */
    cpm?: number;
    /** Average operating hours per day across the weekly schedule. */
    averageOperatingHoursPerDay?: number;
    /** Owner display name (company name if set, else first+last). */
    ownerDisplayName?: string;
    /** Whether the owner has a verified account. */
    ownerIsVerified?: boolean;
}

// Venue types a screen can live in — mirrors the backend VenueType enum.
export const VENUE_TYPE_OPTIONS = [
    { value: 'Cafe', label: 'Café' },
    { value: 'Restaurant', label: 'Restaurant' },
    { value: 'Bar', label: 'Bar / Pub' },
    { value: 'Mall', label: 'Mall' },
    { value: 'RetailStore', label: 'Retail store' },
    { value: 'Supermarket', label: 'Supermarket' },
    { value: 'Gym', label: 'Gym / Fitness' },
    { value: 'Salon', label: 'Salon / Spa' },
    { value: 'Office', label: 'Office' },
    { value: 'CoworkingSpace', label: 'Coworking space' },
    { value: 'Airport', label: 'Airport' },
    { value: 'RailwayStation', label: 'Railway station' },
    { value: 'MetroStation', label: 'Metro station' },
    { value: 'BusStand', label: 'Bus stand' },
    { value: 'Hotel', label: 'Hotel' },
    { value: 'Hospital', label: 'Hospital' },
    { value: 'Clinic', label: 'Clinic' },
    { value: 'College', label: 'College / University' },
    { value: 'School', label: 'School' },
    { value: 'Cinema', label: 'Cinema' },
    { value: 'Bank', label: 'Bank' },
    { value: 'PetrolPump', label: 'Petrol pump' },
    { value: 'Roadside', label: 'Roadside / Street' },
    { value: 'ResidentialComplex', label: 'Residential complex' },
    { value: 'Other', label: 'Other' },
] as const;

// Tag categories for filtering
export const TAG_CATEGORIES = [
    'Transportation',
    'FoodAndBeverage',
    'Retail',
    'Education',
    'Healthcare',
    'Hospitality',
    'Entertainment',
    'Religious',
    'Financial',
    'Government',
    'Residential',
    'Corporate',
    'Industrial',
    'AudienceProfile',
    'TimeBased',
    'Economic',
    'Lifestyle',
] as const;

export type TagCategory = typeof TAG_CATEGORIES[number];

// Category display names
export const TAG_CATEGORY_LABELS: Record<TagCategory, string> = {
    Transportation: 'Transportation',
    FoodAndBeverage: 'Food & Beverage',
    Retail: 'Retail & Shopping',
    Education: 'Education',
    Healthcare: 'Healthcare',
    Hospitality: 'Hospitality',
    Entertainment: 'Entertainment',
    Religious: 'Religious',
    Financial: 'Financial',
    Government: 'Government',
    Residential: 'Residential',
    Corporate: 'Corporate',
    Industrial: 'Industrial',
    AudienceProfile: 'Audience Profile',
    TimeBased: 'Time-Based',
    Economic: 'Economic Zone',
    Lifestyle: 'Lifestyle',
};

// Category colors for UI
export const TAG_CATEGORY_COLORS: Record<string, string> = {
    Transportation: '#3498db',
    FoodAndBeverage: '#e74c3c',
    Retail: '#9b59b6',
    Education: '#2ecc71',
    Healthcare: '#1abc9c',
    Hospitality: '#f39c12',
    Entertainment: '#e91e63',
    Religious: '#795548',
    Financial: '#607d8b',
    Government: '#34495e',
    Residential: '#27ae60',
    Corporate: '#2c3e50',
    Industrial: '#7f8c8d',
    AudienceProfile: '#ff5722',
    TimeBased: '#00bcd4',
    Economic: '#4caf50',
    Lifestyle: '#ff9800',
};
