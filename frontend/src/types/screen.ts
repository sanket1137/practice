// Screen-related types for the frontend

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
}

export interface GenerateTagsResult {
    success: boolean;
    message?: string;
    tagsGenerated: number;
    primaryTags: string[];
    fromCache: boolean;
    totalPoisFound: number;
}

export interface SearchScreensRequest {
    searchText?: string;
    city?: string;
    state?: string;
    country?: string;
    latitude?: number;
    longitude?: number;
    radiusKm?: number;
    requiredTagIds?: string[];
    anyTagIds?: string[];
    tagCategory?: string;
    minPrice?: number;
    maxPrice?: number;
    status?: string;
    page: number;
    pageSize: number;
    sortBy?: string;
    sortDirection?: 'asc' | 'desc';
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
    createdAt: string;
    lastTaggedAt?: string;
    tags?: ScreenTagSummary[];
    primaryTags?: ScreenTagSummary[];
}

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
