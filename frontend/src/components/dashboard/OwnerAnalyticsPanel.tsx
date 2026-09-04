import { useEffect, useRef, useState } from 'react';
import { Box, Grid, Skeleton, ToggleButton, ToggleButtonGroup } from '@mui/material';
import CurrencyRupeeIcon from '@mui/icons-material/CurrencyRupee';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import SensorsIcon from '@mui/icons-material/Sensors';
import EventAvailableIcon from '@mui/icons-material/EventAvailable';
import { useQuery } from '@tanstack/react-query';
import api from '../../services/api';
import { websocketService } from '../../services/websocket';
import StatTile from '../ui/StatTile';
import { ChartCard, TrendAreaChart, DonutChart } from '../ui/charts';

interface OwnerSummary {
    totalRevenueMonth: number;
    revenueChangePercent: number;
    avgDailyRevenue: number;
    activeBookings: number;
    totalBookings: number;
    screenUptimePercent: number;
    totalScreens: number;
    onlineScreens: number;
    totalImpressions: number;
    todayImpressions: number;
}

interface DailyRevenue {
    date: string;
    dayName: string;
    revenue: number;
    impressions: number;
    bookings: number;
}

interface ScreenRevenue {
    screenId: string;
    screenName: string;
    revenue: number;
    impressions: number;
    isOnline: boolean;
}

const inr = (v: number) =>
    new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(v);

/**
 * The owner's analytics band: revenue/plays/uptime KPIs (auto-refreshing, with
 * realtime play ticks when the hub broadcasts them), a 30-day revenue × plays
 * trend, and a revenue-by-screen donut. Built entirely on the ui/ kit so the
 * same pieces serve Earnings and screen pages.
 */
export default function OwnerAnalyticsPanel() {
    const [rangeDays, setRangeDays] = useState<7 | 30>(30);
    // Plays that arrived over the live socket since the last summary refetch.
    const [liveTicks, setLiveTicks] = useState(0);

    const { data: summary, isLoading: summaryLoading } = useQuery<OwnerSummary>({
        queryKey: ['owner-analytics-summary'],
        queryFn: async () => (await api.get('/analytics/owner/summary')).data.data,
        refetchInterval: 30 * 1000,
    });

    const { data: daily = [], isLoading: dailyLoading } = useQuery<DailyRevenue[]>({
        queryKey: ['owner-analytics-daily', rangeDays],
        queryFn: async () => (await api.get(`/analytics/owner/revenue/daily?days=${rangeDays}`)).data.data ?? [],
        staleTime: 5 * 60 * 1000,
    });

    const { data: screens = [] } = useQuery<ScreenRevenue[]>({
        queryKey: ['owner-analytics-screens'],
        queryFn: async () => (await api.get('/analytics/owner/screens')).data.data ?? [],
        staleTime: 5 * 60 * 1000,
    });

    // Realtime: bump the today-plays counter whenever the hub reports a play;
    // the 30s summary refetch reconciles to the authoritative number.
    useEffect(() => {
        const onPlay = () => setLiveTicks((t) => t + 1);
        websocketService.on('ImpressionRecorded', onPlay);
        websocketService.on('AdCompleted', onPlay);
        return () => {
            websocketService.off('ImpressionRecorded', onPlay);
            websocketService.off('AdCompleted', onPlay);
        };
    }, []);
    // Reconcile: subtract only what the server's today-count has absorbed.
    const prevTodayRef = useRef<number | null>(null);
    useEffect(() => {
        if (summary == null) return;
        const prev = prevTodayRef.current;
        if (prev != null) {
            const absorbed = Math.max(0, summary.todayImpressions - prev);
            if (absorbed > 0) setLiveTicks((t) => Math.max(0, t - absorbed));
        }
        prevTodayRef.current = summary.todayImpressions;
    }, [summary]);

    const chartData = daily.map((d) => ({
        day: new Date(d.date).toLocaleDateString(undefined, { day: 'numeric', month: 'short' }),
        revenue: d.revenue,
        plays: d.impressions,
    }));

    const topScreens = [...screens].sort((a, b) => b.revenue - a.revenue);
    const donutData = topScreens.slice(0, 5).map((s) => ({ name: s.screenName, value: s.revenue }));
    const othersRevenue = topScreens.slice(5).reduce((sum, s) => sum + s.revenue, 0);
    if (othersRevenue > 0) donutData.push({ name: 'Others', value: othersRevenue });
    const donutTotal = donutData.reduce((s, d) => s + d.value, 0);

    if (summaryLoading) {
        return <Skeleton variant="rounded" height={120} sx={{ mb: 3 }} />;
    }
    if (!summary) return null;

    return (
        <Box sx={{ mb: 3 }}>
            {/* KPI band */}
            <Grid container spacing={2} sx={{ mb: 2 }}>
                <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                    <StatTile
                        label="Revenue this month"
                        icon={<CurrencyRupeeIcon />}
                        value={inr(summary.totalRevenueMonth)}
                        delta={summary.revenueChangePercent}
                        footer={`avg ${inr(summary.avgDailyRevenue)}/day`}
                    />
                </Grid>
                <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                    <StatTile
                        label="Plays today"
                        icon={<PlayArrowIcon />}
                        live
                        value={(summary.todayImpressions + liveTicks).toLocaleString()}
                        footer={`${summary.totalImpressions.toLocaleString()} all-time`}
                    />
                </Grid>
                <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                    <StatTile
                        label="Fleet online"
                        icon={<SensorsIcon />}
                        value={`${summary.onlineScreens}/${summary.totalScreens}`}
                        footer={`${summary.screenUptimePercent}% of fleet reporting`}
                    />
                </Grid>
                <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                    <StatTile
                        label="Active bookings"
                        icon={<EventAvailableIcon />}
                        value={summary.activeBookings}
                        footer={`${summary.totalBookings} lifetime bookings`}
                    />
                </Grid>
            </Grid>

            {/* Trend + breakdown */}
            <Grid container spacing={2}>
                <Grid size={{ xs: 12, md: 8 }}>
                    <ChartCard
                        title="Revenue & plays"
                        subtitle={`Last ${rangeDays} days across your fleet`}
                        actions={
                            <ToggleButtonGroup size="small" exclusive value={rangeDays}
                                onChange={(_, v) => v && setRangeDays(v)}>
                                <ToggleButton value={7} sx={{ px: 1.25, py: 0.25, fontSize: 12 }}>7d</ToggleButton>
                                <ToggleButton value={30} sx={{ px: 1.25, py: 0.25, fontSize: 12 }}>30d</ToggleButton>
                            </ToggleButtonGroup>
                        }
                    >
                        {dailyLoading ? (
                            <Skeleton variant="rounded" height="100%" />
                        ) : (
                            <TrendAreaChart
                                data={chartData}
                                xKey="day"
                                series={[
                                    { key: 'revenue', name: 'Revenue', format: inr },
                                    { key: 'plays', name: 'Plays', axis: 'right' },
                                ]}
                            />
                        )}
                    </ChartCard>
                </Grid>
                <Grid size={{ xs: 12, md: 4 }}>
                    <ChartCard title="Revenue by screen" subtitle="This month" height={280}>
                        {donutData.length === 0 ? (
                            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'text.secondary', fontSize: 13 }}>
                                Revenue appears here once bookings start earning
                            </Box>
                        ) : (
                            <DonutChart
                                data={donutData}
                                centerValue={inr(donutTotal)}
                                centerLabel="total"
                                format={inr}
                            />
                        )}
                    </ChartCard>
                </Grid>
            </Grid>
        </Box>
    );
}
