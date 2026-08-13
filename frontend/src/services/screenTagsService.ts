import { api } from './api';
import type {
    MasterTag,
    ScreenTagDetail,
    GenerateTagsResult,
    SearchScreensRequest,
    SearchScreensResult,
} from '../types/screen';

export interface ApiResponse<T> {
    success: boolean;
    data: T;
    message?: string;
}

/**
 * Get all available master tags
 */
export async function getAllTags(category?: string): Promise<MasterTag[]> {
    const params = category ? { category } : {};
    const response = await api.get<ApiResponse<MasterTag[]>>('/screens/tags', { params });
    return response.data.data;
}

/**
 * Get tags for a specific screen
 */
export async function getScreenTags(screenId: string): Promise<ScreenTagDetail[]> {
    const response = await api.get<ApiResponse<ScreenTagDetail[]>>(`/screens/${screenId}/tags`);
    return response.data.data;
}

/**
 * Generate/regenerate tags for a screen based on location
 */
export async function generateScreenTags(
    screenId: string, 
    forceRefresh = false
): Promise<GenerateTagsResult> {
    const response = await api.post<ApiResponse<GenerateTagsResult>>(
        `/screens/${screenId}/generate-tags`,
        null,
        { params: { forceRefresh } }
    );
    return response.data.data;
}

/**
 * Add a manual tag to a screen
 */
export async function addScreenTag(screenId: string, tagId: string): Promise<boolean> {
    const response = await api.post<ApiResponse<boolean>>(
        `/screens/${screenId}/tags`,
        { tagId }
    );
    return response.data.data;
}

/**
 * Remove a tag from a screen
 */
export async function removeScreenTag(screenId: string, tagId: string): Promise<boolean> {
    const response = await api.delete<ApiResponse<boolean>>(
        `/screens/${screenId}/tags/${tagId}`
    );
    return response.data.data;
}

/**
 * Search screens with filters (for advertisers)
 */
export async function searchScreens(request: SearchScreensRequest): Promise<SearchScreensResult> {
    const response = await api.post<ApiResponse<SearchScreensResult>>(
        '/screens/search',
        request
    );
    return response.data.data;
}

/**
 * Get unique cities from screens (for filter dropdowns)
 */
export async function getScreenCities(): Promise<string[]> {
    // This could be a dedicated endpoint, but we can derive from search for now
    const response = await searchScreens({ page: 1, pageSize: 1000 });
    const cities = [...new Set(
        response.screens
            .map(s => s.location?.city)
            .filter((c): c is string => !!c)
    )].sort();
    return cities;
}

/**
 * Get unique states from screens (for filter dropdowns)
 */
export async function getScreenStates(): Promise<string[]> {
    const response = await searchScreens({ page: 1, pageSize: 1000 });
    const states = [...new Set(
        response.screens
            .map(s => s.location?.state)
            .filter((s): s is string => !!s)
    )].sort();
    return states;
}
