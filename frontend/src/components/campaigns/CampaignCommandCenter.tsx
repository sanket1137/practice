import { useEffect, useMemo, useRef, useState } from 'react';
import {
    Alert,
    Box,
    Button,
    Card,
    CardContent,
    Chip,
    Collapse,
    Grid,
    IconButton,
    Skeleton,
    Tooltip,
    Typography,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import LiveTvIcon from '@mui/icons-material/LiveTv';
import WifiOffIcon from '@mui/icons-material/WifiOff';
import DownloadIcon from '@mui/icons-material/Download';
import ReceiptLongIcon from '@mui/icons-material/ReceiptLong';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';
import { websocketService } from '../../services/websocket';
import StatTile from '../ui/StatTile';
import { ChartCard, PacingChart, TrendAreaChart, type PacingPoint } from '../ui/charts';
import CampaignStatusPill from './CampaignStatusPill';
import { WebRTCPlayer } from '../streaming/WebRTCPlayer';

interface MonitorScreen {
    bookingId: string;
    bookingStatus: string;
    screenId: string;
    screenName: string;
    city?: string | null;
    isOnline: boolean;
    startDate: string;
    endDate: string;
    expected: number;
    plays: number;
    playsToday: number;
    deliveryPct: number;
    lastPlayAt?: string | null;
}

interface MonitorData {
    campaignId: string;
    name: string;
    status: string;
    subState: string;
    currency: string;
    startDate: string;
    endDate: string;
    totalDays: number;
    elapsedDays: number;
    spend: number;
    expectedTotal: number;
    deliveredTotal: number;
    deliveredToday: number;
    deliveryPct: number;
    cpm?: number | null;
    pacing: PacingPoint[];
    screens: MonitorScreen[];
}

interface FeedEvent {
    /** Stable key so only the newly arrived row animates in. */
    id: number;
    at: Date;
    screenId?: string;
    slot?: number;
    kind: 'started' | 'completed';
}

let feedSeq = 0;

// Live-tick memory across navigation: the component unmounts when the user
// visits a report and remounts on return — without this, ticks (plays the hub
// announced but the DB hasn't absorbed yet) vanished and counters appeared to
// go backwards. Keyed by campaign; server baselines ride along so
// reconciliation stays exact across remounts.
const tickCache = new Map<string, {
    ticks: number;
    screenTicks: Record<string, number>;
    serverTotal: number;
    serverPerScreen: Record<string, number>;
}>();

const inr = (v: number, currency = 'INR') => {
    try {
        return new Intl.NumberFormat('en-IN', { style: 'currency', currency, maximumFractionDigits: 0 }).format(v);
    } catch { return `${currency} ${v.toFixed(0)}`; }
};

/**
 * The Command Center: the room where one campaign is watched. Live counters
 * tick from the hub, the pacing chart answers "am I on track", and every
 * screen row expands IN PLACE — hourly chart, delivery split, inline live
 * stream — the advertiser never gets routed to the screen's own page.
 */
export default function CampaignCommandCenter({ campaignId }: { campaignId: string }) {
    const navigate = useNavigate();
    const cacheKey = campaignId.toLowerCase();
    const cached = tickCache.get(cacheKey);
    const [liveTicks, setLiveTicks] = useState(cached?.ticks ?? 0);
    const [screenTicks, setScreenTicks] = useState<Record<string, number>>(cached?.screenTicks ?? {});
    const [feed, setFeed] = useState<FeedEvent[]>([]);
    const [expanded, setExpanded] = useState<string | null>(null);

    const { data, isLoading, refetch } = useQuery<MonitorData>({
        queryKey: ['campaign-monitor', campaignId],
        queryFn: async () => (await api.get(`/campaigns/${campaignId}/monitor`)).data.data,
        enabled: !!campaignId,
        refetchInterval: 30 * 1000,
    });

    // Realtime: join the campaign group; play events tick counters + the feed,
    // status changes refetch the room. The 30s poll reconciles everything.
    useEffect(() => {
        if (!campaignId) return;
        websocketService.subscribeToCampaign(campaignId).catch(() => { /* reconnect path resubscribes */ });

        type AdEvent = { CampaignId?: string; campaignId?: string; ScreenId?: string; screenId?: string; SlotNumber?: number; slotNumber?: number };
        const forThis = (e: AdEvent) => (e?.CampaignId ?? e?.campaignId)?.toString().toLowerCase() === campaignId.toLowerCase();
        const push = (kind: FeedEvent['kind']) => (e: AdEvent) => {
            if (!forThis(e)) return;
            const sid = (e.ScreenId ?? e.screenId)?.toString().toLowerCase();
            if (kind === 'completed') {
                setLiveTicks((t) => t + 1);
                if (sid) setScreenTicks((m) => ({ ...m, [sid]: (m[sid] ?? 0) + 1 }));
            }
            setFeed((f) => [{
                id: ++feedSeq,
                at: new Date(),
                screenId: sid,
                slot: e.SlotNumber ?? e.slotNumber,
                kind,
            }, ...f].slice(0, 30));
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
    }, [campaignId, refetch]);

    // Attention-driven sync: while someone is actually in this room, ask each
    // of the campaign's screens to sync every 60s; when they leave, players
    // fall back to the 10-minute baseline. Database load follows attention,
    // not fleet size.
    const screenIdsKey = (data?.screens ?? []).map((s) => s.screenId).sort().join(',');
    useEffect(() => {
        if (!screenIdsKey) return;
        const ids = screenIdsKey.split(',');
        ids.forEach((id) => { websocketService.requestFastSync(id).catch(() => { /* baseline still applies */ }); });
        return () => {
            ids.forEach((id) => { websocketService.requestNormalSync(id).catch(() => { /* player reverts on its own eventually */ }); });
        };
    }, [screenIdsKey]);

    // Reconcile, don't reset: plays reach the database only on the player's
    // periodic sync (minutes), while hub events are instant. When fresh server
    // data arrives, subtract only what the server has now absorbed — the
    // remaining ticks keep the counters live between syncs instead of
    // snapping back to a stale total every poll.
    const prevTotalsRef = useRef<{ total: number; perScreen: Record<string, number> } | null>(
        cached ? { total: cached.serverTotal, perScreen: cached.serverPerScreen } : null);
    useEffect(() => {
        if (!data) return;
        const perScreen: Record<string, number> = {};
        data.screens.forEach((s) => { perScreen[s.screenId.toLowerCase()] = s.plays; });
        const prev = prevTotalsRef.current;
        if (prev) {
            const absorbed = Math.max(0, data.deliveredTotal - prev.total);
            if (absorbed > 0) setLiveTicks((t) => Math.max(0, t - absorbed));
            setScreenTicks((m) => {
                const next = { ...m };
                for (const [sid, count] of Object.entries(perScreen)) {
                    const delta = Math.max(0, count - (prev.perScreen[sid] ?? count));
                    if (delta > 0 && next[sid]) next[sid] = Math.max(0, next[sid] - delta);
                }
                return next;
            });
        }
        prevTotalsRef.current = { total: data.deliveredTotal, perScreen };
    }, [data]);

    // Write-through to the navigation cache on every change.
    useEffect(() => {
        tickCache.set(cacheKey, {
            ticks: liveTicks,
            screenTicks,
            serverTotal: prevTotalsRef.current?.total ?? 0,
            serverPerScreen: prevTotalsRef.current?.perScreen ?? {},
        });
    }, [cacheKey, liveTicks, screenTicks, data]);

    const screenName = useMemo(() => {
        const m = new Map<string, string>();
        data?.screens.forEach((s) => m.set(s.screenId.toLowerCase(), s.screenName));
        return (id?: string) => (id ? m.get(id.toLowerCase()) ?? 'Screen' : 'Screen');
    }, [data]);

    if (isLoading || !data) {
        return <Skeleton variant="rounded" height={260} sx={{ mb: 3 }} />;
    }

    const liveTotal = data.deliveredTotal + liveTicks;
    const liveDeliveryPct = data.expectedTotal > 0
        ? Math.min(100, (liveTotal * 100) / data.expectedTotal)
        : data.deliveryPct;
    // Ticks land on the pacing curve's last point so the chart moves with the feed.
    const livePacing = data.pacing.length > 0
        ? data.pacing.map((p, i) => i === data.pacing.length - 1
            ? { ...p, delivered: p.delivered + liveTicks, deliveredCum: p.deliveredCum + liveTicks }
            : p)
        : data.pacing;
    const tickForScreen = (id: string) => screenTicks[id.toLowerCase()] ?? 0;

    const paceDelta = data.totalDays > 0 && data.expectedTotal > 0
        ? liveDeliveryPct - Math.round((data.elapsedDays / data.totalDays) * 100)
        : null;
    const offline = data.screens.filter((s) => !s.isOnline &&
        (s.bookingStatus === 'Active' || s.bookingStatus === 'Approved'));

    const downloadBlob = async (url: string, filename: string) => {
        const res = await api.get(url, { responseType: 'blob' });
        const objectUrl = URL.createObjectURL(res.data);
        const a = document.createElement('a');
        a.href = objectUrl; a.download = filename; a.click();
        URL.revokeObjectURL(objectUrl);
    };

    return (
        <Box sx={{ mb: 4 }}>
            {/* Header row */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2, flexWrap: 'wrap' }}>
                <CampaignStatusPill status={data.status} subState={data.subState} startDate={data.startDate} size="medium" />
                <Typography variant="body2" color="text.secondary">
                    {new Date(data.startDate).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}
                    {' – '}
                    {new Date(data.endDate).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}
                    {data.subState === 'live' && ` · day ${data.elapsedDays} of ${data.totalDays}`}
                </Typography>
                <Box sx={{ flex: 1 }} />
                <Button size="small" startIcon={<DownloadIcon />}
                    onClick={() => navigate(`/reports/campaigns/${campaignId}`)}>
                    Report
                </Button>
                <Tooltip title="Timestamped, hash-chain-verified play log for this campaign's bookings" arrow>
                    <Button size="small" startIcon={<ReceiptLongIcon />}
                        onClick={() => data.screens[0] && downloadBlob(
                            `/reports/bookings/${data.screens[0].bookingId}/logs/export`,
                            `play-log-${data.name}.csv`)}>
                        Play log
                    </Button>
                </Tooltip>
            </Box>

            {/* Offline alert */}
            {offline.length > 0 && (
                <Alert severity="warning" icon={<WifiOffIcon />} sx={{ mb: 2 }}>
                    {offline.map((s) => s.screenName).join(', ')} {offline.length === 1 ? 'is' : 'are'} offline —
                    plays are paused and counted; you only pay for what actually airs. The owner has been alerted.
                </Alert>
            )}

            {/* KPI band */}
            <Grid container spacing={2} sx={{ mb: 2 }}>
                <Grid size={{ xs: 6, md: 3 }}>
                    <StatTile label="Plays" live={data.subState === 'live'} pulseOn={liveTotal}
                        value={liveTotal.toLocaleString()}
                        footer={liveTicks > 0
                            ? `${data.deliveredTotal.toLocaleString()} synced + ${liveTicks} live · ${(data.deliveredToday + liveTicks).toLocaleString()} today`
                            : `${(data.deliveredToday + liveTicks).toLocaleString()} today`} />
                </Grid>
                <Grid size={{ xs: 6, md: 3 }}>
                    <StatTile label="Delivery"
                        value={`${liveDeliveryPct.toFixed(1)}%`}
                        footer={`of ${data.expectedTotal.toLocaleString()} planned plays`} />
                </Grid>
                <Grid size={{ xs: 6, md: 3 }}>
                    <StatTile label="Pacing"
                        value={paceDelta == null ? '—' : paceDelta >= 0 ? 'On pace' : 'Behind'}
                        delta={paceDelta}
                        footer={`day ${data.elapsedDays} of ${data.totalDays}`} />
                </Grid>
                <Grid size={{ xs: 6, md: 3 }}>
                    <StatTile label="Spend · CPM"
                        value={inr(data.spend, data.currency)}
                        footer={data.cpm != null ? `${inr(data.cpm, data.currency)} per 1,000 plays` : 'CPM appears with first plays'} />
                </Grid>
            </Grid>

            <Grid container spacing={2}>
                {/* Pacing */}
                <Grid size={{ xs: 12, md: 8 }}>
                    <ChartCard title="Delivery pacing" subtitle="Cumulative plays vs straight-line target" height={240}>
                        {livePacing.length === 0 ? (
                            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'text.secondary', fontSize: 13 }}>
                                Pacing draws itself once the campaign starts playing
                            </Box>
                        ) : (
                            <PacingChart data={livePacing} />
                        )}
                    </ChartCard>
                </Grid>

                {/* Live feed */}
                <Grid size={{ xs: 12, md: 4 }}>
                    <Card sx={{ height: '100%' }}>
                        <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                            <Typography variant="h4" component="h3" sx={{ mb: 1 }}>Live play feed</Typography>
                            <Box sx={{ maxHeight: 232, overflowY: 'auto', display: 'grid', gap: 0.5, gridTemplateColumns: 'minmax(0, 1fr)' }}>
                                {feed.length === 0 ? (
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 1 }}>
                                        {data.subState === 'live' && (
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
                                            {data.subState === 'live'
                                                ? 'Listening — the next play lands here the second it airs.'
                                                : 'Plays appear here in realtime while the campaign is live.'}
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
                                            {screenName(e.screenId)}{e.slot != null ? ` · slot ${e.slot}` : ''}
                                            {e.kind === 'completed' ? ' ✓' : ''}
                                        </Typography>
                                    </Box>
                                ))}
                            </Box>
                        </CardContent>
                    </Card>
                </Grid>

                {/* Per-screen rows — advertiser lens, expand in place */}
                <Grid size={12}>
                    <Card>
                        <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                            <Typography variant="h4" component="h3" sx={{ mb: 1.5 }}>Your screens</Typography>
                            <Box sx={{ display: 'grid', gap: 1, gridTemplateColumns: 'minmax(0, 1fr)' }}>
                                {data.screens.map((s) => (
                                    <ScreenRow key={s.bookingId} screen={s} liveTick={tickForScreen(s.screenId)}
                                        expanded={expanded === s.bookingId}
                                        onToggle={() => setExpanded(expanded === s.bookingId ? null : s.bookingId)} />
                                ))}
                            </Box>
                        </CardContent>
                    </Card>
                </Grid>
            </Grid>
        </Box>
    );
}

function ScreenRow({ screen: s, liveTick, expanded, onToggle }: {
    screen: MonitorScreen; liveTick: number; expanded: boolean; onToggle: () => void;
}) {
    const [hourlyDate] = useState(() => new Date().toISOString().slice(0, 10));
    const { data: hourly } = useQuery<{ hourlyPlays: number[] }>({
        queryKey: ['booking-hourly', s.bookingId, hourlyDate],
        queryFn: async () => (await api.get(`/reports/bookings/${s.bookingId}/hourly?date=${hourlyDate}`)).data.data,
        enabled: expanded,
        staleTime: 60 * 1000,
        refetchInterval: expanded ? 60 * 1000 : false,
    });
    const hourlyRows = (hourly?.hourlyPlays ?? []).map((v, h) => ({ hour: `${h}:00`, plays: v }));

    return (
        <Box sx={{ border: 1, borderColor: 'divider', borderRadius: 2 }}>
            <Box onClick={onToggle} sx={{
                display: 'flex', alignItems: 'center', gap: 1.5, p: 1.25, cursor: 'pointer',
                '&:hover': { bgcolor: 'action.hover' }, borderRadius: 2,
            }}>
                <Box sx={{
                    width: 9, height: 9, borderRadius: '50%', flexShrink: 0,
                    bgcolor: s.isOnline ? 'success.main' : 'error.main',
                }} />
                <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography variant="body2" fontWeight={700} noWrap>
                        {s.screenName}
                        {s.city && <Typography component="span" variant="body2" color="text.secondary"> · {s.city}</Typography>}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                        {(s.plays + liveTick).toLocaleString()} plays{liveTick > 0 ? ` (+${liveTick} live)` : ''} ({(s.playsToday + liveTick).toLocaleString()} today)
                        · {(s.expected > 0 ? Math.min(100, ((s.plays + liveTick) * 100) / s.expected) : s.deliveryPct).toFixed(0)}% delivered
                        {!s.isOnline && ' · offline'}
                    </Typography>
                </Box>
                <Chip size="small" variant="outlined" label={s.bookingStatus} />
                <IconButton size="small">
                    <ExpandMoreIcon sx={{ transform: expanded ? 'rotate(180deg)' : 'none', transition: '0.2s' }} />
                </IconButton>
            </Box>
            <Collapse in={expanded} unmountOnExit>
                <Box sx={{ p: 2, pt: 0.5, borderTop: 1, borderColor: 'divider' }}>
                    <Grid container spacing={2}>
                        <Grid size={{ xs: 12, md: 5 }}>
                            <Typography variant="caption" color="text.secondary" fontWeight={700}>
                                TODAY, HOUR BY HOUR
                            </Typography>
                            <Box sx={{ height: 160, mt: 0.5 }}>
                                {hourlyRows.length === 0 ? (
                                    <Typography variant="caption" color="text.secondary">No plays recorded today yet.</Typography>
                                ) : (
                                    <TrendAreaChart data={hourlyRows} xKey="hour"
                                        series={[{ key: 'plays', name: 'Plays' }]} />
                                )}
                            </Box>
                            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
                                {s.expected.toLocaleString()} plays planned · runs {s.startDate} → {s.endDate}
                            </Typography>
                        </Grid>
                        <Grid size={{ xs: 12, md: 7 }}>
                            <Typography variant="caption" color="text.secondary" fontWeight={700}
                                sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                <LiveTvIcon sx={{ fontSize: 14 }} /> LIVE ON THE GLASS
                            </Typography>
                            <Box sx={{ mt: 0.5 }}>
                                {s.isOnline ? (
                                    <WebRTCPlayer screenId={s.screenId} autoStart={false} />
                                ) : (
                                    <Alert severity="warning" icon={<WifiOffIcon />}>
                                        Screen is offline — the stream returns when the player reconnects.
                                        Your plays are protected by delivery-linked billing.
                                    </Alert>
                                )}
                            </Box>
                        </Grid>
                    </Grid>
                </Box>
            </Collapse>
        </Box>
    );
}
