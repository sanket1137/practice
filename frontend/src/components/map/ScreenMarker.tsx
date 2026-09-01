import { useMemo } from 'react';
import { Marker, Popup, Tooltip } from 'react-leaflet';
import { Box, Typography, Chip, Button, Stack } from '@mui/material';
import {
    Tv as TvIcon,
    Circle as CircleIcon,
    Edit as EditIcon,
    BookOnline as BookIcon,
} from '@mui/icons-material';
import L from 'leaflet';
import type { Screen } from '../../types/screen';

interface ScreenMarkerProps {
    screen: Screen;
    isSelected?: boolean;
    onClick?: (screen: Screen) => void;
    onHover?: (screen: Screen | null) => void;
    isOwnerView?: boolean;
}

// Marker color speaks the screen's real state, not just a binary dot.
// Owner view: green = live now (with pulse), red = should be live but dark,
// amber = paused/maintenance, blue = still in setup, grey = archived.
const ownerMarkerColor = (status: string | undefined, isOnline: boolean | undefined) => {
    if (isOnline) return { color: '#34d27b', pulse: true, label: 'live' };
    switch (status) {
        case 'Active': return { color: '#f87171', pulse: false, label: 'offline' };
        case 'Paused':
        case 'Maintenance': return { color: '#f59e0b', pulse: false, label: status.toLowerCase() };
        case 'Archived': return { color: '#9e9e9e', pulse: false, label: 'archived' };
        default: return { color: '#5c86ff', pulse: false, label: 'setup' };
    }
};

const createMarkerIcon = (screen: Screen, isSelected: boolean, isOwnerView: boolean) => {
    const { color, pulse } = isOwnerView
        ? ownerMarkerColor(screen.status, screen.isOnline)
        : { color: screen.isOnline ? '#4caf50' : '#ff9800', pulse: !!screen.isOnline };

    const selectedStyle = isSelected ? 'transform: scale(1.2); filter: drop-shadow(0 0 8px rgba(255,255,255,0.8));' : '';
    const pulseRing = pulse
        ? `<span style="
                position: absolute; inset: -6px; border-radius: 50%;
                border: 2px solid ${color}; opacity: 0.6;
                animation: ps-marker-pulse 2s ease-out infinite;
            "></span>
            <style>@keyframes ps-marker-pulse { 0% { transform: scale(0.8); opacity: 0.7; } 100% { transform: scale(1.35); opacity: 0; } }</style>`
        : '';

    return L.divIcon({
        html: `
            <div style="position: relative; width: 36px; height: 36px;">
                ${pulseRing}
                <div style="
                    width: 36px;
                    height: 36px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    background: ${color};
                    border: 3px solid white;
                    border-radius: 50%;
                    box-shadow: 0 3px 10px rgba(0,0,0,0.4);
                    ${selectedStyle}
                    transition: transform 0.2s ease;
                ">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="white">
                        <path d="M21 3H3c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h5v2h8v-2h5c1.1 0 1.99-.9 1.99-2L23 5c0-1.1-.9-2-2-2zm0 14H3V5h18v12z"/>
                    </svg>
                </div>
            </div>
        `,
        className: 'custom-screen-marker',
        iconSize: [36, 36],
        iconAnchor: [18, 18],
        popupAnchor: [0, -18],
    });
};

export function ScreenMarker({
    screen,
    isSelected = false,
    onClick,
    onHover,
    isOwnerView = false,
}: ScreenMarkerProps) {
    const position: [number, number] = [screen.latitude!, screen.longitude!];

    const icon = useMemo(
        () => createMarkerIcon(screen, isSelected, isOwnerView),
        [screen, isSelected, isOwnerView]
    );

    // Get primary tag for display
    const primaryTag = screen.primaryTags?.[0] || screen.tags?.[0];

    return (
        <Marker
            position={position}
            icon={icon}
            eventHandlers={{
                click: () => onClick?.(screen),
                mouseover: () => onHover?.(screen),
                mouseout: () => onHover?.(null),
            }}
        >
            <Tooltip direction="top" offset={[0, -20]} opacity={0.95}>
                <Box sx={{ minWidth: 150 }}>
                    <Typography variant="subtitle2" fontWeight={600}>
                        {screen.name}
                    </Typography>
                    {screen.pricePerSlot && (
                        <Typography variant="body2" color="primary" fontWeight={500}>
                            {screen.currency || 'INR'} {screen.pricePerSlot.toLocaleString()}/play
                        </Typography>
                    )}
                    {primaryTag && (
                        <Typography variant="caption" color="text.secondary">
                            {primaryTag.displayName}
                        </Typography>
                    )}
                </Box>
            </Tooltip>
            <Popup>
                <Box sx={{ minWidth: 250, p: 1 }}>
                    {/* Header */}
                    <Stack direction="row" alignItems="center" spacing={1} mb={1}>
                        <TvIcon color="primary" />
                        <Typography variant="subtitle1" fontWeight={600}>
                            {screen.name}
                        </Typography>
                    </Stack>

                    {/* Status */}
                    <Stack direction="row" alignItems="center" spacing={1} mb={1.5}>
                        <CircleIcon
                            sx={{
                                fontSize: 10,
                                color: screen.isOnline || screen.status === 'Active' ? 'success.main' : 'grey.500',
                            }}
                        />
                        <Typography variant="body2" color="text.secondary">
                            {screen.isOnline ? 'Online' : screen.status}
                        </Typography>
                        {primaryTag && (
                            <Chip
                                label={primaryTag.displayName}
                                size="small"
                                sx={{
                                    bgcolor: primaryTag.colorCode || 'primary.light',
                                    color: 'white',
                                    fontSize: '0.7rem',
                                    height: 20,
                                }}
                            />
                        )}
                    </Stack>

                    {/* Location */}
                    <Typography variant="body2" color="text.secondary" mb={1}>
                        {screen.location?.city}, {screen.location?.state}
                    </Typography>

                    {/* Price */}
                    {screen.pricePerSlot && (
                        <Box
                            sx={{
                                bgcolor: 'grey.100',
                                borderRadius: 1,
                                p: 1,
                                mb: 1.5,
                            }}
                        >
                            <Typography variant="h6" color="primary" fontWeight={700}>
                                {screen.currency || 'INR'} {screen.pricePerSlot.toLocaleString()}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                                per play
                            </Typography>
                        </Box>
                    )}

                    {/* Specs */}
                    {screen.resolutionWidth && screen.resolutionHeight && (
                        <Typography variant="caption" color="text.secondary" display="block" mb={1.5}>
                            {screen.resolutionWidth} × {screen.resolutionHeight}px
                            {screen.dailyTotalImpressions && ` • ${screen.dailyTotalImpressions.toLocaleString()} daily views`}
                        </Typography>
                    )}

                    {/* Action Button */}
                    <Button
                        variant="contained"
                        fullWidth
                        size="small"
                        startIcon={isOwnerView ? <EditIcon /> : <BookIcon />}
                        onClick={() => onClick?.(screen)}
                        sx={{
                            bgcolor: isOwnerView ? 'primary.main' : 'success.main',
                            '&:hover': {
                                bgcolor: isOwnerView ? 'primary.dark' : 'success.dark',
                            },
                        }}
                    >
                        {isOwnerView ? 'Manage Screen' : 'Book This Screen'}
                    </Button>
                </Box>
            </Popup>
        </Marker>
    );
}

export default ScreenMarker;
