import { api } from './api';

// Standard API response wrapper
interface ApiResponse<T> {
    data: T;
    success: boolean;
    message?: string;
}

// Public screen data (limited info for non-authenticated users)
export interface PublicScreen {
    id: string;
    name: string;
    city?: string;
    state?: string;
    country?: string;
    latitude?: number;
    longitude?: number;
    priceRange?: string;
    startingPrice?: number;
    currency?: string;
    isOnline: boolean;
    primaryTagCategory?: string;
    primaryTagName?: string;
}

export interface BoundingBox {
    north: number;
    south: number;
    east: number;
    west: number;
}

export interface PublicSearchRequest {
    searchText?: string;
    city?: string;
    state?: string;
    country?: string;
    boundingBox?: BoundingBox;
    latitude?: number;
    longitude?: number;
    radiusKm?: number;
    tagCategory?: string;
    minPrice?: number;
    maxPrice?: number;
    page?: number;
    pageSize?: number;
    sortBy?: string;
    sortDirection?: 'asc' | 'desc';
}

export interface PublicSearchResult {
    screens: PublicScreen[];
    totalCount: number;
    page: number;
    pageSize: number;
    totalPages: number;
}

/**
 * Public endpoint to explore screens (no auth required)
 */
export async function exploreScreens(request: PublicSearchRequest): Promise<PublicSearchResult> {
    const response = await api.post<ApiResponse<PublicSearchResult>>('/screens/explore', {
        ...request,
        page: request.page || 1,
        pageSize: request.pageSize || 100,
    });
    return response.data.data;
}

/**
 * Get unique cities from visible screens
 */
export function getUniqueCities(screens: PublicScreen[]): string[] {
    return [...new Set(screens.map(s => s.city).filter((c): c is string => !!c))].sort();
}

/**
 * Get unique states from visible screens
 */
export function getUniqueStates(screens: PublicScreen[]): string[] {
    return [...new Set(screens.map(s => s.state).filter((s): s is string => !!s))].sort();
}

/**
 * Get unique countries from visible screens
 */
export function getUniqueCountries(screens: PublicScreen[]): string[] {
    return [...new Set(screens.map(s => s.country).filter((c): c is string => !!c))].sort();
}
