import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Box,
    Button,
    Card,
    CardActionArea,
    CardContent,
    Container,
    Grid,
    Skeleton,
    Typography,
} from '@mui/material';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import MonitorHeartIcon from '@mui/icons-material/MonitorHeart';
import { useQuery } from '@tanstack/react-query';
import { MapContainer, TileLayer, Marker, Tooltip as LeafletTooltip } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import api from '../../services/api';
import { websocketService } from '../../services/websocket';
import StatTile from '../../components/ui/StatTile';
import { PacingChart, type PacingPoint } from '../../components/ui/charts';
import CampaignStatusPill from '../../components/campaigns/CampaignStatusPill';

interface MonitorTileData {
    campaignId: string;
    name: string;
    status: string;
    subState: string;
    startDate: string;
    endDate: string;
    expectedTotal: number;
    deliveredTotal: number;
    deliveredToday: number;
    deliveryPct: number;
    elapsedDays: number;
    totalDays: number;
    screensOnline: number;
    screensTotal: number;
    pacing: PacingPoint[];
}

interface MonitorScreenPin {
    screenId: string;
    name: string;
    city?: string | null;
    latitude?: number | null;
    longitude?: number | null;
    isOnline: boolean;
    campaigns: string[];
}

interface MonitorWall {
    totals: { liveCampaigns: number; playsToday: number; screensOnline: number; screensTotal: number };
    campaigns: MonitorTileData[];
    screens: MonitorScreenPin[];
}

interface FeedEvent {
    /** Stable key so only the newly arrived row animates in. */
    id: number;
    at: Date;
    campaignId?: string;
    screenId?: string;
    slot?: number;
    kind: 'started' | 'completed';
}

let feedSeq = 0;

// Ticks survive navigating away from the wall and back.
const wallTickCache: { ticks: Record<string, number>; serverTotals: Record<string, number> } = {
    ticks: {}, serverTotals: {},
};

const pinIcon = (isOnline: boolean) => L.divIcon({
    html: `
        <div style="position: relative; width: 18px; height: 18px;">
            ${isOnline ? `<span style="position:absolute; inset:-5px; border-radius:50%; border:2px solid #34d27b; opacity:.6; animation: ps-mon-pulse 2s ease-out infinite;"></span>
            <style>@keyframes ps-mon-pulse { 0% { transform: scale(.8); opacity:.7; } 100% { transform: scale(1.5); opacity:0; } }</style>` : ''}
            <div style="width:18px; height:18px; border-radius:50%; background:${isOnline ? '#34d27b' : '#f87171'}; border:3px solid white; box-shadow:0 2px 6px rgba(0,0,0,.4);"></div>
        </div>`,
    className: 'ps-monitor-pin',
    iconSize: [18, 18],
    iconAnchor: [9, 9],
});

/**
 * The Monitor Room: the advertiser's NOC wall — every running campaign as a
 * live tile (ticking plays, mini pacing), the fleet map with live/offline
 * pins, and a global play feed. Built to stay open on a second display.
 */
/** Big tabular number that pops when its value changes (live tick). */
function PopNumber({ value }: { value: number }) {
    const [pulsing, setPulsing] = useState(false);
    const prev = useRef(value);
    useEffect(() => {
        if (prev.current === value) return;
        prev.current = value;
        setPulsing(true);
        const t = setTimeout(() => setPulsing(false), 650);
        return () => clearTimeout(t);
    }, [value]);
    return (
        <Typography variant="h3" sx={{
            fontVariantNumeric: 'tabular-nums',
            transformOrigin: 'left center',
            ...(pulsing && {
                animation: 'ps-tile-pop 0.65s cubic-bezier(0.22, 1.2, 0.36, 1)',
                '@keyframes ps-tile-pop': {
                    '0%': { transform: 'scale(1)' },
                    '30%': { transform: 'scale(1.07)', textShadow: '0 0 18px rgba(52,210,123,0.45)' },
                    '100%': { transform: 'scale(1)', textShadow: 'none' },
                },
            }),
        }}>
            {value.toLocaleString()}
        </Typography>
    );
}

export default function MonitorRoomPage() {
    const navigate = useNavigate();
    const [ticks, setTicks] = useState<Record<string, number>>(wallTickCache.ticks);
    const [feed, setFeed] = useState<FeedEvent[]>([]);
    const subscribedRef = useRef<Set<string>>(new Set());

    const { data, isLoading, refetch } = useQuery<MonitorWall>({
        queryKey: ['advertiser-monitor'],
        queryFn: async () => (await api.get('/analytics/advertiser/monitor')).data.data,
        refetchInterval: 30 * 1000,
    });

    // Join every visible campaign's realtime group once; events tick the
    // matching tile and the global feed. Poll reconciles every 30s.
    useEffect(() => {
        const ids = data?.campaigns.map((c) => c.campaignId) ?? [];
        ids.forEach((id) => {
            if (!subscribedRef.current.has(id)) {
                subscribedRef.current.add(id);
                websocketService.subscribeToCampaign(id).catch(() => { /* resubscribed on reconnect */ });
            }
        });
    }, [data]);

    useEffect(() => {
        type AdEvent = { CampaignId?: string; campaignId?: string; ScreenId?: string; screenId?: string; SlotNumber?: number; slotNumber?: number };
        const push = (kind: FeedEvent['kind']) => (e: AdEvent) => {
            const cid = (e?.CampaignId ?? e?.campaignId)?.toString().toLowerCase();
            if (!cid || !subscribedRef.current.has(cid)) {
                // Events for campaigns we haven't subscribed to (ids come lowercased
                // from the hub) — match case-insensitively against the set.
                const known = [...subscribedRef.current].find((k) => k.toLowerCase() === cid);
                if (!known) return;
            }
            if (kind === 'completed' && cid) {
                setTicks((t) => ({ ...t, [cid]: (t[cid] ?? 0) + 1 }));
            }
            setFeed((f) => [{
                id: ++feedSeq,
                at: new Date(),
                campaignId: cid,
                screenId: (e.ScreenId ?? e.screenId)?.toString(),
                slot: e.SlotNumber ?? e.slotNumber,
                kind,
            }, ...f].slice(0, 40));
        };
        const onStarted = push('started');
        const onCompleted = push('completed');
        const onStatus = () => refetch();
        websocketService.on('AdStarted', onStarted);
        websocketService.on('AdCompleted', onCompleted);
        websocketService.on('CampaignStatusChanged', onStatus);
        return () => {
            websocketService.off('AdStarted', onStarted);
            websocketService.off('AdCompleted', onCompleted);
            websocketService.off('CampaignStatusChanged', onStatus);
        };
    }, [refetch]);
    // Reconcile ticks against what each campaign's server total has absorbed —
    // plays reach the DB on the player's sync cycle, so a blanket reset on every
    // poll would snap live counters back to stale totals.
    const prevTotalsRef = useRef<Record<string, number> | null>(
        Object.keys(wallTickCache.serverTotals).length ? wallTickCache.serverTotals : null);
    useEffect(() => {
        if (!data) return;
        const totals: Record<string, number> = {};
        data.campaigns.forEach((c) => { totals[c.campaignId.toLowerCase()] = c.deliveredTotal; });
        const prev = prevTotalsRef.current;
        if (prev) {
            setTicks((m) => {
                const next = { ...m };
                for (const [cid, count] of Object.entries(totals)) {
                    const absorbed = Math.max(0, count - (prev[cid] ?? count));
                    if (absorbed > 0 && next[cid]) next[cid] = Math.max(0, next[cid] - absorbed);
                }
                return next;
            });
        }
        prevTotalsRef.current = totals;
    }, [data]);

    useEffect(() => {
        wallTickCache.ticks = ticks;
        wallTickCache.serverTotals = prevTotalsRef.current ?? {};
    }, [ticks, data]);

    const names = useMemo(() => {
        const campaign = new Map<string, string>();
        const screen = new Map<string, string>();
        data?.campaigns.forEach((c) => campaign.set(c.campaignId.toLowerCase(), c.name));
        data?.screens.forEach((s) => screen.set(s.screenId.toLowerCase(), s.name));
        return {
            campaign: (id?: string) => (id ? campaign.get(id.toLowerCase()) ?? 'Campaign' : 'Campaign'),
            screen: (id?: string) => (id ? screen.get(id.toLowerCase()) ?? 'Screen' : 'Screen'),
        };
    }, [data]);

    const tickFor = (id: string) => ticks[id.toLowerCase()] ?? 0;
    const liveTicksTotal = Object.values(ticks).reduce((s, v) => s + v, 0);

    const mapScreens = (data?.screens ?? []).filter(
        (s) => s.latitude != null && s.longitude != null);
    const mapCenter: [number, number] = mapScreens.length
        ? [mapScreens[0].latitude!, mapScreens[0].longitude!]
        : [20.59, 78.96]; // India

    if (isLoading || !data) {
        return (
            <Container maxWidth="xl" sx={{ py: 3 }}>
                <Skeleton variant="rounded" height={90} sx={{ mb: 2 }} />
                <Skeleton variant="rounded" height={420} />
            </Container>
        );
    }

    return (
        <Container maxWidth="xl" sx={{ py: 3 }}>
            <Box sx={{ mb: 2 }}>
                <Typography variant="h3">Monitor</Typography>
                <Typography variant="body2" color="text.secondary">
                    Every campaign, live. Leave this open — it keeps itself current.
                </Typography>
            </Box>

            {/* Wall KPIs */}
            <Grid container spacing={2} sx={{ mb: 2 }}>
                <Grid size={{ xs: 6, md: 3 }}>
                    <StatTile label="Live now" live={data.totals.liveCampaigns > 0}
                        value={data.totals.liveCampaigns}
                        footer={`${data.campaigns.length} campaign${data.campaigns.length === 1 ? '' : 's'} on the wall`} />
                </Grid>
                <Grid size={{ xs: 6, md: 3 }}>
                    <StatTile label="Plays today" live pulseOn={data.totals.playsToday + liveTicksTotal}
                        value={(data.totals.playsToday + liveTicksTotal).toLocaleString()} />
                </Grid>
                <Grid size={{ xs: 6, md: 3 }}>
                    <StatTile label="Screens online"
                        value={`${data.totals.screensOnline}/${data.totals.screensTotal}`} />
                </Grid>
                <Grid size={{ xs: 6, md: 3 }}>
                    <StatTile label="Feed"
                        value={feed.length ? `${feed.length} events` : 'quiet'}
                        footer="last 40 plays, all campaigns" />
                </Grid>
            </Grid>

            <Grid container spacing={2}>
                {/* Campaign tiles */}
                <Grid size={{ xs: 12, lg: 7 }}>
                    {data.campaigns.length === 0 ? (
                        <Card><CardContent sx={{ py: 6, textAlign: 'center' }}>
                            <MonitorHeartIcon sx={{ fontSize: 44, color: 'text.disabled', mb: 1 }} />
                            <Typography variant="h5" sx={{ mb: 0.5 }}>The wall is dark</Typography>
                            <Typography variant="body2" color="text.secondary" sx={{ mb: 2.5, maxWidth: 380, mx: 'auto' }}>
                                Book your first campaign and it appears here as a live tile —
                                plays ticking in the moment they air, pacing drawing itself.
                            </Typography>
                            <Box sx={{ display: 'flex', gap: 1.5, justifyContent: 'center', flexWrap: 'wrap' }}>
                                <Button variant="contained" onClick={() => navigate('/screens/discover')}>
                                    Find screens
                                </Button>
                                <Button variant="outlined" onClick={() => navigate('/campaigns/new')}>
                                    Start a campaign
                                </Button>
                            </Box>
                        </CardContent></Card>
                    ) : (
                        <Grid container spacing={2}>
                            {data.campaigns.map((c) => (
                                <Grid key={c.campaignId} size={{ xs: 12, sm: 6 }}>
                                    <Card sx={{ height: '100%' }}>
                                        <CardActionArea onClick={() => navigate(`/campaigns/${c.campaignId}`)} sx={{ height: '100%' }}>
                                            <CardContent sx={{ p: 2 }}>
                                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.75 }}>
                                                    <Typography variant="body1" fontWeight={700} noWrap sx={{ flex: 1, minWidth: 0 }}>
                                                        {c.name}
                                                    </Typography>
                                                    <CampaignStatusPill status={c.status} subState={c.subState} startDate={c.startDate} />
                                                </Box>
                                                <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1.5, mb: 1 }}>
                                                    <PopNumber value={c.deliveredTotal + tickFor(c.campaignId)} />
                                                    <Typography variant="caption" color="text.secondary">
                                                        plays{tickFor(c.campaignId) > 0 ? ` (+${tickFor(c.campaignId)} live)` : ''} · {c.deliveryPct.toFixed(0)}% delivered
                                                        {c.subState === 'live' && ` · day ${c.elapsedDays}/${c.totalDays}`}
                                                    </Typography>
                                                </Box>
                                                <Box sx={{ height: 56 }}>
                                                    {c.pacing.length > 0 && <PacingChart data={c.pacing} mini />}
                                                </Box>
                                                <Typography variant="caption" color="text.secondary">
                                                    {c.screensOnline}/{c.screensTotal} screen{c.screensTotal === 1 ? '' : 's'} online
                                                    · {(c.deliveredToday + tickFor(c.campaignId)).toLocaleString()} today
                                                </Typography>
                                            </CardContent>
                                        </CardActionArea>
                                    </Card>
                                </Grid>
                            ))}
                        </Grid>
                    )}
                </Grid>

                {/* Map + feed column */}
                <Grid size={{ xs: 12, lg: 5 }}>
                    <Card sx={{ mb: 2 }}>
                        <Box sx={{ height: 280, '& .leaflet-container': { height: '100%', width: '100%', borderRadius: '16px' } }}>
                            {mapScreens.length === 0 ? (
                                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'text.secondary', fontSize: 13 }}>
                                    Screens appear on the map once campaigns are booked
                                </Box>
                            ) : (
                                <MapContainer center={mapCenter} zoom={mapScreens.length === 1 ? 12 : 5} scrollWheelZoom={false}>
                                    <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                                        attribution='&copy; OpenStreetMap' />
                                    {mapScreens.map((s) => (
                                        <Marker key={s.screenId} position={[s.latitude!, s.longitude!]} icon={pinIcon(s.isOnline)}>
                                            <LeafletTooltip direction="top" offset={[0, -10]}>
                                                <strong>{s.name}</strong>{s.city ? ` · ${s.city}` : ''}<br />
                                                {s.isOnline ? 'Live now' : 'Offline'} · {s.campaigns.join(', ')}
                                            </LeafletTooltip>
                                        </Marker>
                                    ))}
                                </MapContainer>
                            )}
                        </Box>
                    </Card>

                    <Card>
                        <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                            <Typography variant="h4" component="h3" sx={{ mb: 1 }}>Global play feed</Typography>
                            <Box sx={{ maxHeight: 240, overflowY: 'auto', display: 'grid', gap: 0.5, gridTemplateColumns: 'minmax(0, 1fr)' }}>
                                {feed.length === 0 ? (
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 1 }}>
                                        {data.totals.liveCampaigns > 0 && (
                                            <Box sx={{
                                                width: 8, height: 8, borderRadius: '50%', bgcolor: 'success.main', flexShrink: 0,
                                                animation: 'ps-pulse 2s ease-in-out infinite',
                                                '@keyframes ps-pulse': {
                                                    '0%, 100%': { opacity: 1, boxShadow: '0 0 0 0 rgba(52,210,123,0.5)' },
                                                    '50%': { opacity: 0.6, boxShadow: '0 0 0 6px rgba(52,210,123,0)' },
                                                },
                                            }} />
                                        )}
                                        <Typography variant="caption" color="text.secondary">
                                            {data.totals.liveCampaigns > 0
                                                ? 'Listening — plays across all campaigns land here the second they air.'
                                                : 'Plays across all your campaigns tick in here the moment they air.'}
                                        </Typography>
                                    </Box>
                                ) : feed.map((e) => (
                                    <Box key={e.id} sx={{
                                        display: 'flex', alignItems: 'center', gap: 0.75, fontSize: 12, fontFamily: 'monospace',
                                        animation: 'ps-feed-in 0.4s ease-out',
                                        '@keyframes ps-feed-in': {
                                            from: { opacity: 0, transform: 'translateY(-8px)' },
                                            to: { opacity: 1, transform: 'translateY(0)' },
                                        },
                                    }}>
                                        <Typography component="span" variant="caption" color="text.disabled" sx={{ fontFamily: 'inherit' }}>
                                            {e.at.toLocaleTimeString()}
                                        </Typography>
                                        <PlayArrowIcon sx={{ fontSize: 12, color: e.kind === 'completed' ? 'success.main' : 'text.disabled' }} />
                                        <Typography component="span" variant="caption" sx={{ fontFamily: 'inherit' }} noWrap>
                                            {names.campaign(e.campaignId)} · {names.screen(e.screenId)}
                                            {e.slot != null ? ` · slot ${e.slot}` : ''}{e.kind === 'completed' ? ' ✓' : ''}
                                        </Typography>
                                    </Box>
                                ))}
                            </Box>
                        </CardContent>
                    </Card>
                </Grid>
            </Grid>
        </Container>
    );
}
