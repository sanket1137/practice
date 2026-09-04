import { Box, Card, CardContent, Typography } from '@mui/material';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import TrendingDownIcon from '@mui/icons-material/TrendingDown';
import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';

/**
 * KPI tile: label, big value, optional delta vs previous period, optional
 * "live" pulse dot for realtime numbers, optional footer. Theme-aware.
 */
export default function StatTile({ label, value, delta, deltaLabel, live, icon, footer, pulseOn }: {
    label: string;
    value: ReactNode;
    /** Percent change vs previous period; colors green/red by sign. */
    delta?: number | null;
    deltaLabel?: string;
    /** Renders a pulsing green dot next to the label. */
    live?: boolean;
    icon?: ReactNode;
    footer?: ReactNode;
    /** When this changes (after mount), the value briefly pulses — wire it to the live counter. */
    pulseOn?: string | number;
}) {
    const [pulsing, setPulsing] = useState(false);
    const prevPulse = useRef(pulseOn);
    useEffect(() => {
        if (pulseOn === undefined || prevPulse.current === pulseOn) return;
        prevPulse.current = pulseOn;
        setPulsing(true);
        const t = setTimeout(() => setPulsing(false), 650);
        return () => clearTimeout(t);
    }, [pulseOn]);

    return (
        <Card sx={{ height: '100%' }}>
            <CardContent sx={{ p: 2.25, '&:last-child': { pb: 2.25 } }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 0.75 }}>
                    {icon && <Box sx={{ color: 'text.disabled', display: 'flex', '& svg': { fontSize: 16 } }}>{icon}</Box>}
                    <Typography variant="overline" color="text.secondary" sx={{ lineHeight: 1 }}>
                        {label}
                    </Typography>
                    {live && (
                        <Box sx={{
                            width: 7, height: 7, borderRadius: '50%', bgcolor: 'success.main', ml: 0.25,
                            animation: 'ps-pulse 2s ease-in-out infinite',
                            '@keyframes ps-pulse': {
                                '0%, 100%': { opacity: 1, boxShadow: '0 0 0 0 rgba(52,210,123,0.5)' },
                                '50%': { opacity: 0.7, boxShadow: '0 0 0 5px rgba(52,210,123,0)' },
                            },
                        }} />
                    )}
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1, flexWrap: 'wrap' }}>
                    <Typography variant="h3" component="div" sx={{
                        fontVariantNumeric: 'tabular-nums',
                        transformOrigin: 'left center',
                        ...(pulsing && {
                            animation: 'ps-tile-pop 0.65s cubic-bezier(0.22, 1.2, 0.36, 1)',
                            '@keyframes ps-tile-pop': {
                                '0%': { transform: 'scale(1)', textShadow: 'none' },
                                '30%': { transform: 'scale(1.06)', textShadow: '0 0 18px rgba(52,210,123,0.45)' },
                                '100%': { transform: 'scale(1)', textShadow: 'none' },
                            },
                        }),
                    }}>
                        {value}
                    </Typography>
                    {delta != null && Number.isFinite(delta) && (
                        <Box sx={{
                            display: 'inline-flex', alignItems: 'center', gap: 0.25,
                            px: 0.75, py: 0.25, borderRadius: '6px',
                            bgcolor: delta >= 0 ? 'success.light' : 'error.light',
                            color: delta >= 0 ? 'success.main' : 'error.main',
                            fontSize: 11, fontWeight: 700,
                        }}>
                            {delta >= 0 ? <TrendingUpIcon sx={{ fontSize: 13 }} /> : <TrendingDownIcon sx={{ fontSize: 13 }} />}
                            {Math.abs(delta).toFixed(1)}%
                        </Box>
                    )}
                </Box>
                {(deltaLabel || footer) && (
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                        {footer ?? deltaLabel}
                    </Typography>
                )}
            </CardContent>
        </Card>
    );
}
