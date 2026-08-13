/// <reference types="google.maps" />
import { useState, useCallback, useRef, useEffect } from 'react';
import {
    TextField,
    Autocomplete,
    CircularProgress,
    Box,
    Typography,
} from '@mui/material';
import { Loader } from '@googlemaps/js-api-loader';

export interface PlaceDetails {
    formattedAddress: string;
    street: string;
    city: string;
    state: string;
    country: string;
    postalCode: string;
    latitude: number;
    longitude: number;
}

export interface PlacesAutocompleteFieldProps {
    value: string;
    onPlaceSelect: (details: PlaceDetails) => void;
    label?: string;
    required?: boolean;
    disabled?: boolean;
    error?: boolean;
    helperText?: string;
}

// @googlemaps/js-api-loader's `Loader` class ships without a typed `.load()`
// method (it's deprecated in favor of `importLibrary`), so we describe the
// legacy shape ourselves instead of reaching for `any`.
interface LegacyGoogleMapsLoader {
    load(): Promise<typeof google>;
}

let loaderInstance: Loader | null = null;
let mapsLoaded = false;

function getLoader(): Loader {
    if (!loaderInstance) {
        loaderInstance = new Loader({
            apiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY ?? '',
            version: 'weekly',
            libraries: ['places'],
        });
    }
    return loaderInstance;
}

interface PlaceSuggestion {
    placeId: string;
    description: string;
    mainText: string;
    secondaryText: string;
}

export function PlacesAutocompleteField({
    value,
    onPlaceSelect,
    label = 'Address',
    required = false,
    disabled = false,
    error = false,
    helperText,
}: PlacesAutocompleteFieldProps) {
    const [inputValue, setInputValue] = useState(value || '');
    const [options, setOptions] = useState<PlaceSuggestion[]>([]);
    const [loading, setLoading] = useState(false);
    const autocompleteService = useRef<google.maps.places.AutocompleteService | null>(null);
    const placesService = useRef<google.maps.places.PlacesService | null>(null);
    const dummyDiv = useRef<HTMLDivElement>(document.createElement('div'));
    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        const initMaps = async () => {
            try {
                await (getLoader() as unknown as LegacyGoogleMapsLoader).load();
                mapsLoaded = true;
                autocompleteService.current = new google.maps.places.AutocompleteService();
                placesService.current = new google.maps.places.PlacesService(dummyDiv.current);
            } catch {
                // Google Maps not available (no API key configured)
            }
        };
        if (!mapsLoaded) {
            initMaps();
        } else {
            if (!autocompleteService.current) {
                autocompleteService.current = new google.maps.places.AutocompleteService();
                placesService.current = new google.maps.places.PlacesService(dummyDiv.current);
            }
        }
    }, []);

    const fetchSuggestions = useCallback((input: string) => {
        if (!autocompleteService.current || input.length < 3) {
            setOptions([]);
            return;
        }
        setLoading(true);
        autocompleteService.current.getPlacePredictions(
            { input, types: ['geocode', 'establishment'] },
            (predictions, status) => {
                setLoading(false);
                if (status !== google.maps.places.PlacesServiceStatus.OK || !predictions) {
                    setOptions([]);
                    return;
                }
                setOptions(
                    predictions.map((p) => ({
                        placeId: p.place_id,
                        description: p.description,
                        mainText: p.structured_formatting.main_text,
                        secondaryText: p.structured_formatting.secondary_text || '',
                    }))
                );
            }
        );
    }, []);

    const handleInputChange = (_: React.SyntheticEvent, newInput: string) => {
        setInputValue(newInput);
        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => fetchSuggestions(newInput), 300);
    };

    const handleSelect = (_: React.SyntheticEvent, selected: PlaceSuggestion | string | null) => {
        if (!selected || typeof selected === 'string' || !placesService.current) return;
        placesService.current.getDetails(
            { placeId: selected.placeId, fields: ['address_components', 'formatted_address', 'geometry'] },
            (place, status) => {
                if (status !== google.maps.places.PlacesServiceStatus.OK || !place) return;
                const details: PlaceDetails = {
                    formattedAddress: place.formatted_address ?? selected.description,
                    street: '',
                    city: '',
                    state: '',
                    country: '',
                    postalCode: '',
                    latitude: place.geometry?.location?.lat() ?? 0,
                    longitude: place.geometry?.location?.lng() ?? 0,
                };
                for (const comp of place.address_components ?? []) {
                    const types = comp.types;
                    if (types.includes('route')) details.street = comp.long_name;
                    else if (types.includes('sublocality_level_1') || types.includes('locality')) {
                        if (!details.city) details.city = comp.long_name;
                    }
                    else if (types.includes('administrative_area_level_1')) details.state = comp.long_name;
                    else if (types.includes('country')) details.country = comp.long_name;
                    else if (types.includes('postal_code')) details.postalCode = comp.long_name;
                    else if (types.includes('street_number')) details.street = `${comp.long_name} ${details.street}`.trim();
                }
                setInputValue(details.formattedAddress);
                onPlaceSelect(details);
            }
        );
    };

    return (
        <Autocomplete<PlaceSuggestion, false, false, true>
            freeSolo
            filterOptions={(x) => x}
            options={options}
            loading={loading}
            inputValue={inputValue}
            onInputChange={handleInputChange}
            onChange={handleSelect}
            getOptionLabel={(opt) => (typeof opt === 'string' ? opt : opt.description)}
            isOptionEqualToValue={(opt, val) => opt.placeId === val.placeId}
            renderOption={(props, opt) => (
                <li {...props} key={opt.placeId}>
                    <Box>
                        <Typography variant="body2" fontWeight={500}>{opt.mainText}</Typography>
                        <Typography variant="caption" color="text.secondary">{opt.secondaryText}</Typography>
                    </Box>
                </li>
            )}
            renderInput={(params) => (
                <TextField
                    {...params}
                    label={label}
                    required={required}
                    disabled={disabled}
                    error={error}
                    helperText={helperText ?? 'Start typing an address — suggestions powered by Google Maps'}
                    InputProps={{
                        ...params.InputProps,
                        endAdornment: (
                            <>
                                {loading ? <CircularProgress color="inherit" size={16} /> : null}
                                {params.InputProps.endAdornment}
                            </>
                        ),
                    }}
                />
            )}
        />
    );
}
