import { useEffect, useRef, useState, useCallback } from 'react';
import { MapContainer, TileLayer, useMap, useMapEvents } from 'react-leaflet';
import MarkerClusterGroup from 'react-leaflet-cluster';
import { Box, Button, CircularProgress } from '@mui/material';
import { Search as SearchIcon } from '@mui/icons-material';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import ScreenMarker from './ScreenMarker';
import type { Screen } from '../../types/screen';

// Fix Leaflet default marker icon issue
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';
import iconRetina from 'leaflet/dist/images/marker-icon-2x.png';

const DefaultIcon = L.icon({
    iconUrl: icon,
    iconRetinaUrl: iconRetina,
    shadowUrl: iconShadow,
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41],
});
L.Marker.prototype.options.icon = DefaultIcon;

// Custom cluster icon creator (AdOnMo style - dark circles with count)
const createClusterCustomIcon = (cluster: any) => {
    const count = cluster.getChildCount();
    let size = 40;
    let className = 'cluster-marker';

    if (count >= 100) {
        size = 55;
        className += ' cluster-large';
    } else if (count >= 50) {
        size = 50;
        className += ' cluster-medium';
    } else if (count >= 10) {
        size = 45;
        className += ' cluster-small';
    }

    return L.divIcon({
        html: `<div class="${className}"><span>${count}</span></div>`,
        className: 'custom-marker-cluster',
        iconSize: L.point(size, size, true),
    });
};

// Cluster styles (injected as CSS)
const clusterStyles = `
    .custom-marker-cluster {
        background: transparent !important;
    }
    .cluster-marker {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 100%;
        height: 100%;
        border-radius: 50%;
        background: linear-gradient(135deg, #1a2e1a 0%, #0d1f0d 100%);
        border: 3px solid #4caf50;
        color: white;
        font-weight: 700;
        font-size: 14px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.4);
        transition: transform 0.2s ease;
    }
    .cluster-marker:hover {
        transform: scale(1.1);
    }
    .cluster-marker span {
        text-shadow: 0 1px 2px rgba(0,0,0,0.5);
    }
    .cluster-small {
        font-size: 13px;
    }
    .cluster-medium {
        font-size: 15px;
    }
    .cluster-large {
        font-size: 17px;
    }
`;

interface MapBounds {
    north: number;
    south: number;
    east: number;
    west: number;
    center: { lat: number; lng: number };
    zoom: number;
}

interface ScreensMapProps {
    screens: Screen[];
    isLoading?: boolean;
    onScreenClick?: (screen: Screen) => void;
    onScreenHover?: (screen: Screen | null) => void;
    onBoundsChange?: (bounds: MapBounds) => void;
    onSearchArea?: (center: { lat: number; lng: number }, radiusKm: number) => void;
    selectedScreenId?: string;
    initialCenter?: [number, number];
    initialZoom?: number;
    showSearchAreaButton?: boolean;
    isOwnerView?: boolean;
}

// Component to handle map events
function MapEventHandler({
    onBoundsChange,
    onSearchArea,
    showSearchAreaButton,
}: {
    onBoundsChange?: (bounds: MapBounds) => void;
    onSearchArea?: (center: { lat: number; lng: number }, radiusKm: number) => void;
    showSearchAreaButton?: boolean;
}) {
    const map = useMap();
    const [showSearchButton, setShowSearchButton] = useState(false);
    const initialBoundsRef = useRef<string | null>(null);

    const getBoundsData = useCallback((): MapBounds => {
        const bounds = map.getBounds();
        const center = map.getCenter();
        return {
            north: bounds.getNorth(),
            south: bounds.getSouth(),
            east: bounds.getEast(),
            west: bounds.getWest(),
            center: { lat: center.lat, lng: center.lng },
            zoom: map.getZoom(),
        };
    }, [map]);

    const calculateRadius = useCallback((): number => {
        const bounds = map.getBounds();
        const center = map.getCenter();
        const ne = bounds.getNorthEast();
        // Calculate distance from center to corner in km
        const distance = center.distanceTo(ne) / 1000;
        return Math.min(distance, 500); // Cap at 500km
    }, [map]);

    useMapEvents({
        moveend: () => {
            const boundsData = getBoundsData();
            onBoundsChange?.(boundsData);

            // Show search button if bounds changed from initial
            const boundsKey = `${boundsData.center.lat.toFixed(3)}-${boundsData.center.lng.toFixed(3)}-${boundsData.zoom}`;
            if (initialBoundsRef.current === null) {
                initialBoundsRef.current = boundsKey;
            } else if (boundsKey !== initialBoundsRef.current && showSearchAreaButton) {
                setShowSearchButton(true);
            }
        },
        zoomend: () => {
            const boundsData = getBoundsData();
            onBoundsChange?.(boundsData);
        },
    });

    const handleSearchArea = () => {
        const center = map.getCenter();
        const radius = calculateRadius();
        onSearchArea?.({ lat: center.lat, lng: center.lng }, radius);
        setShowSearchButton(false);
        initialBoundsRef.current = `${center.lat.toFixed(3)}-${center.lng.toFixed(3)}-${map.getZoom()}`;
    };

    if (!showSearchButton || !showSearchAreaButton) return null;

    return (
        <Box
            sx={{
                position: 'absolute',
                top: 80,
                left: '50%',
                transform: 'translateX(-50%)',
                zIndex: 1000,
            }}
        >
            <Button
                variant="contained"
                color="primary"
                startIcon={<SearchIcon />}
                onClick={handleSearchArea}
                sx={{
                    bgcolor: '#1a2e1a',
                    '&:hover': { bgcolor: '#0d1f0d' },
                    boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
                    borderRadius: 3,
                    px: 3,
                }}
            >
                Search This Area
            </Button>
        </Box>
    );
}

// Component to fit bounds to markers
function FitBoundsToMarkers({ screens }: { screens: Screen[] }) {
    const map = useMap();
    const hasFittedRef = useRef(false);

    useEffect(() => {
        if (screens.length > 0 && !hasFittedRef.current) {
            const validScreens = screens.filter(
                (s) => s.latitude != null && s.longitude != null
            );
            if (validScreens.length > 0) {
                const bounds = L.latLngBounds(
                    validScreens.map((s) => [s.latitude!, s.longitude!] as [number, number])
                );
                map.fitBounds(bounds, { padding: [50, 50], maxZoom: 14 });
                hasFittedRef.current = true;
            }
        }
    }, [screens, map]);

    return null;
}

export default function ScreensMap({
    screens,
    isLoading = false,
    onScreenClick,
    onScreenHover,
    onBoundsChange,
    onSearchArea,
    selectedScreenId,
    initialCenter = [12.9716, 77.5946], // Bangalore default
    initialZoom = 11,
    showSearchAreaButton = true,
    isOwnerView = false,
}: ScreensMapProps) {
    // Inject cluster styles
    useEffect(() => {
        const styleId = 'cluster-styles';
        if (!document.getElementById(styleId)) {
            const styleSheet = document.createElement('style');
            styleSheet.id = styleId;
            styleSheet.textContent = clusterStyles;
            document.head.appendChild(styleSheet);
        }
    }, []);

    // Filter screens with valid coordinates
    const validScreens = screens.filter(
        (s) => s.latitude != null && s.longitude != null
    );

    return (
        <Box sx={{ position: 'relative', height: '100%', width: '100%' }}>
            {isLoading && (
                <Box
                    sx={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        bgcolor: 'rgba(255,255,255,0.7)',
                        zIndex: 1001,
                    }}
                >
                    <CircularProgress />
                </Box>
            )}
            <MapContainer
                center={initialCenter}
                zoom={initialZoom}
                style={{ height: '100%', width: '100%' }}
                scrollWheelZoom={true}
            >
                <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
                    url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
                />
                <MapEventHandler
                    onBoundsChange={onBoundsChange}
                    onSearchArea={onSearchArea}
                    showSearchAreaButton={showSearchAreaButton}
                />
                <FitBoundsToMarkers screens={validScreens} />
                <MarkerClusterGroup
                    chunkedLoading
                    iconCreateFunction={createClusterCustomIcon}
                    maxClusterRadius={60}
                    spiderfyOnMaxZoom={true}
                    showCoverageOnHover={false}
                    disableClusteringAtZoom={16}
                >
                    {validScreens.map((screen) => (
                        <ScreenMarker
                            key={screen.id}
                            screen={screen}
                            isSelected={selectedScreenId === screen.id}
                            onClick={onScreenClick}
                            onHover={onScreenHover}
                            isOwnerView={isOwnerView}
                        />
                    ))}
                </MarkerClusterGroup>
            </MapContainer>
        </Box>
    );
}
