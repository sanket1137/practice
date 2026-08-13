import { useQuery, keepPreviousData } from '@tanstack/react-query';
import campaignWizardApi from '../services/campaignWizardApi';
import type { SearchScreensRequest } from '../types/screen';

/**
 * Master tag catalog with marketplace screen counts.
 * Used by Step 2 (audience) tag chooser to show "(N screens)" next to each tag.
 * Cached for 10 minutes — tag catalog rarely changes.
 */
export function useTagCatalog(includeScreenCounts = true) {
  return useQuery({
    queryKey: ['master-tags', { includeScreenCounts }],
    queryFn: () => campaignWizardApi.getTagCatalog(includeScreenCounts),
    staleTime: 10 * 60 * 1000,
  });
}

/**
 * Debounced location autocomplete. Returns up to `limit` matching cities or states
 * with active marketplace screens. Disabled when `q` is shorter than 2 chars.
 */
export function useLocationSuggestions(
  q: string,
  kind: 'city' | 'state' = 'city',
  limit = 20,
) {
  const trimmed = q.trim();
  return useQuery({
    queryKey: ['location-suggestions', kind, trimmed, limit],
    queryFn: () => campaignWizardApi.getLocationSuggestions(trimmed, kind, limit),
    enabled: trimmed.length >= 2,
    staleTime: 60 * 1000,
    placeholderData: keepPreviousData,
  });
}

/**
 * Reactive screen search. Pass a fully-formed `SearchScreensRequest` and the hook
 * keeps results in cache per filter combination. Use `enabled` to defer until the
 * user has supplied at least a location anchor / bbox.
 */
export function useScreenSearch(filters: SearchScreensRequest, enabled = true) {
  return useQuery({
    queryKey: ['screen-search', filters],
    queryFn: () => campaignWizardApi.searchScreens(filters),
    enabled,
    staleTime: 30 * 1000,
    placeholderData: keepPreviousData,
  });
}
