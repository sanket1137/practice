import { useState } from 'react';
import {
    Box,
    Container,
    Grid,
    Paper,
    Typography,
    Card,
    CardContent,
    Alert,
    Skeleton,
    Button,
    ButtonGroup,
    Stack,
} from '@mui/material';
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer,
    LineChart,
    Line,
} from 'recharts';
import DownloadIcon from '@mui/icons-material/Download';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import { useTheme } from '@mui/material/styles';
import { TrendAreaChart } from '../../components/ui/charts';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { format, subDays, startOfMonth, endOfMonth, startOfYear } from 'date-fns';
import { useQuery } from '@tanstack/react-query';
import { useUserRole } from '../../hooks/useUserRole';
import { useAccountVisibility } from '../../hooks/useAccountVisibility';
import {
    getOwnerAnalyticsSummary,
    getOwnerScreenBreakdown,
    getOwnerDailyRevenue,
    getAdvertiserAnalyticsSummary,
    getAdvertiserCampaigns,
    getAdvertiserDailyImpressions,
    getPlatformAnalyticsSummary,
    getPlatformDailyStats,
    getAdvertiserDateRangeAnalytics,
    getMediaOwnerDateRangeAnalytics,
    exportAnalyticsCsv,
    exportAnalyticsPdf,
    type OwnerAnalyticsSummary,
    type ScreenRevenue,
    type DailyRevenue,
    type AdvertiserAnalyticsSummary,
    type CampaignPerformanceSummary,
    type DailyImpressions,
    type PlatformAnalyticsSummary,
    type PlatformDailyStats,
    type AdvertiserDateRangeAnalytics,
    type MediaOwnerDateRangeAnalytics,
} from '../../services/analyticsApi';

// Helper to format currency
const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR',
        maximumFractionDigits: 0,
    }).format(amount);
};

// Helper to format change percent with color
const formatChangePercent = (percent: number): { text: string; color: string } => {
    const sign = percent >= 0 ? '+' : '';
    return {
        text: `${sign}${percent.toFixed(1)}%`,
        color: percent >= 0 ? 'success.main' : 'error.main',
    };
};

// Skeleton for stat cards
const StatCardSkeleton = () => (
    <Card>
        <CardContent>
            <Skeleton variant="text" width="60%" />
            <Skeleton variant="text" width="40%" height={40} />
            <Skeleton variant="text" width="50%" />
        </CardContent>
    </Card>
);

// Skeleton for charts
const ChartSkeleton = ({ height = 400 }: { height?: number }) => (
    <Paper sx={{ p: 3, height }}>
        <Skeleton variant="text" width="30%" sx={{ mb: 2 }} />
        <Skeleton variant="rectangular" height={height - 100} />
    </Paper>
);

type DatePreset = 'today' | '7d' | '30d' | '90d' | 'month' | 'year' | 'thisyear' | 'alltime' | 'custom';

interface DateRange { from: Date; to: Date; }

function DateRangeSelector({
    value,
    onChange,
    onExport,
    exporting,
    onExportPdf,
    exportingPdf,
}: {
    value: DateRange;
    onChange: (range: DateRange) => void;
    onExport?: () => void;
    exporting?: boolean;
    onExportPdf?: () => void;
    exportingPdf?: boolean;
}) {
    const [activePreset, setActivePreset] = useState<DatePreset>('30d');
    const [customFrom, setCustomFrom] = useState<Date | null>(null);
    const [customTo, setCustomTo] = useState<Date | null>(null);

    const applyPreset = (preset: DatePreset) => {
        setActivePreset(preset);
        const now = new Date();
        let from: Date;
        let to: Date = now;
        switch (preset) {
            case 'today': from = now; break;
            case '7d': from = subDays(now, 6); break;
            case '30d': from = subDays(now, 29); break;
            case '90d': from = subDays(now, 89); break;
            case 'month': from = startOfMonth(now); to = endOfMonth(now); break;
            case 'year': from = startOfYear(now); break;
            case 'thisyear': from = startOfYear(now); break;
            case 'alltime': from = new Date(2020, 0, 1); break;
            default: return;
        }
        onChange({ from, to });
    };

    const applyCustom = () => {
        if (customFrom && customTo) {
            setActivePreset('custom');
            onChange({ from: customFrom, to: customTo });
        }
    };

    const presets: { label: string; value: DatePreset }[] = [
        { label: 'Today', value: 'today' },
        { label: '7D', value: '7d' },
        { label: '30D', value: '30d' },
        { label: '90D', value: '90d' },
        { label: 'Month', value: 'month' },
        { label: 'YTD', value: 'year' },
        { label: 'This Year', value: 'thisyear' },
        { label: 'All Time', value: 'alltime' },
    ];

    return (
        <LocalizationProvider dateAdapter={AdapterDateFns}>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems={{ sm: 'center' }} flexWrap="wrap" gap={1}>
                <ButtonGroup size="small" variant="outlined">
                    {presets.map((p) => (
                        <Button
                            key={p.value}
                            variant={activePreset === p.value ? 'contained' : 'outlined'}
                            onClick={() => applyPreset(p.value)}
                        >
                            {p.label}
                        </Button>
                    ))}
                </ButtonGroup>
                <Stack direction="row" spacing={1} alignItems="center">
                    <DatePicker
                        label="From"
                        value={activePreset === 'custom' ? customFrom : value.from}
                        onChange={(d) => { setCustomFrom(d); setActivePreset('custom'); }}
                        slotProps={{ textField: { size: 'small', sx: { width: 150 } } }}
                    />
                    <DatePicker
                        label="To"
                        value={activePreset === 'custom' ? customTo : value.to}
                        onChange={(d) => { setCustomTo(d); setActivePreset('custom'); }}
                        slotProps={{ textField: { size: 'small', sx: { width: 150 } } }}
                    />
                    {activePreset === 'custom' && (
                        <Button size="small" variant="contained" onClick={applyCustom}>Apply</Button>
                    )}
                </Stack>
                <Stack direction="row" spacing={1} sx={{ ml: 'auto' }}>
                    {onExport && (
                        <Button
                            size="small"
                            variant="outlined"
                            startIcon={<DownloadIcon />}
                            onClick={onExport}
                            disabled={exporting}
                        >
                            {exporting ? 'Exporting...' : 'Export CSV'}
                        </Button>
                    )}
                    {onExportPdf && (
                        <Button
                            size="small"
                            variant="outlined"
                            color="secondary"
                            startIcon={<PictureAsPdfIcon />}
                            onClick={onExportPdf}
                            disabled={exportingPdf}
                        >
                            {exportingPdf ? 'Exporting...' : 'Export PDF'}
                        </Button>
                    )}
                </Stack>
            </Stack>
        </LocalizationProvider>
    );
}


export default function AnalyticsPage() {
    const { isScreenOwner, isAdvertiser } = useUserRole();
    const { isPrivate } = useAccountVisibility();

    // ==========================================
    // SCREEN OWNER ANALYTICS - Focus on Earnings
    // ==========================================
    if (isScreenOwner) {
        return <ScreenOwnerAnalytics isPrivate={isPrivate} />;
    }

    // ==========================================
    // ADVERTISER ANALYTICS - Focus on Campaign Performance
    // ==========================================
    if (isAdvertiser) {
        return <AdvertiserAnalytics />;
    }

    // ==========================================
    // ADMIN ANALYTICS - Platform Overview (Default)
    // ==========================================
    return <AdminAnalytics />;
}


// ============================================
// SCREEN OWNER ANALYTICS COMPONENT
// ============================================
function ScreenOwnerAnalytics({ isPrivate }: { isPrivate: boolean }) {
    const muiTheme = useTheme();
    const [dateRange, setDateRange] = useState<DateRange>({ from: subDays(new Date(), 29), to: new Date() });
    const [exporting, setExporting] = useState(false);
    const [exportingPdf, setExportingPdf] = useState(false);

    const dateFrom = format(dateRange.from, 'yyyy-MM-dd');
    const dateTo = format(dateRange.to, 'yyyy-MM-dd');

    const { data: summary, isLoading: summaryLoading, error: summaryError } = useQuery<OwnerAnalyticsSummary>({
        queryKey: ['analytics', 'owner', 'summary'],
        queryFn: getOwnerAnalyticsSummary,
    });

    const { data: screens, isLoading: screensLoading } = useQuery<ScreenRevenue[]>({
        queryKey: ['analytics', 'owner', 'screens'],
        queryFn: getOwnerScreenBreakdown,
    });

    const { data: dailyRevenue, isLoading: dailyLoading } = useQuery<DailyRevenue[]>({
        queryKey: ['analytics', 'owner', 'daily'],
        queryFn: () => getOwnerDailyRevenue(7),
    });

    const { data: dateRangeData } = useQuery<MediaOwnerDateRangeAnalytics>({
        queryKey: ['analytics', 'owner', 'daterange', dateFrom, dateTo],
        queryFn: () => getMediaOwnerDateRangeAnalytics(dateFrom, dateTo),
    });

    const handleExport = async () => {
        setExporting(true);
        try {
            await exportAnalyticsCsv('mediaowner', dateFrom, dateTo);
        } finally {
            setExporting(false);
        }
    };

    const handleExportPdf = async () => {
        setExportingPdf(true);
        try {
            await exportAnalyticsPdf('mediaowner', dateFrom, dateTo);
        } finally {
            setExportingPdf(false);
        }
    };

    const isLoading = summaryLoading || screensLoading || dailyLoading;

    if (summaryError) {
        return (
            <Container maxWidth="lg" sx={{ mt: 4 }}>
                <Alert severity="error">Failed to load analytics. Please try again later.</Alert>
            </Container>
        );
    }

    return (
        <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
            <Box
                sx={{
                    p: { xs: 2.5, md: 3.5 },
                    mb: 3,
                    borderRadius: 3,
                    background:
                        'radial-gradient(900px 340px at 100% -8%, rgba(10,102,216,0.12), transparent 60%), var(--ps-surface)',
                    border: '1px solid var(--ps-border)',
                    boxShadow: '0 8px 24px rgba(0,0,0,0.10)',
                    display: 'flex',
                    alignItems: { sm: 'center' },
                    flexDirection: { xs: 'column', sm: 'row' },
                    gap: 2,
                }}
            >
                <Box>
                    <Typography variant="h4" gutterBottom sx={{ mb: 0.5 }}>
                        {isPrivate ? 'Screen Operations Analytics' : 'Earnings & Analytics'}
                    </Typography>
                    <Typography variant="body1" color="text.secondary">
                        {isPrivate
                            ? 'Track uptime, delivery, and screen health in private operations mode'
                            : 'Track your screen performance and revenue'}
                    </Typography>
                </Box>
            </Box>
            <Box mb={3}>
                <DateRangeSelector
                    value={dateRange}
                    onChange={setDateRange}
                    onExport={handleExport}
                    exporting={exporting}
                    onExportPdf={handleExportPdf}
                    exportingPdf={exportingPdf}
                />
            </Box>

            {isPrivate && (
                <Alert severity="info" sx={{ mb: 3 }}>
                    Private mode prioritizes operational metrics. Marketplace revenue and fill-rate widgets are hidden.
                </Alert>
            )}

            {/* Summary Cards */}
            <Grid container spacing={3} sx={{ mb: 4 }}>
                <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                    {isLoading ? <StatCardSkeleton /> : (
                        <Card>
                            <CardContent>
                                <Typography color="textSecondary" gutterBottom>
                                    {isPrivate ? 'Total Impressions' : 'Total Revenue (Month)'}
                                </Typography>
                                <Typography variant="h4" color={isPrivate ? 'info.main' : 'success.main'}>
                                    {isPrivate
                                        ? (summary?.totalImpressions || 0).toLocaleString()
                                        : formatCurrency(summary?.totalRevenueMonth || 0)}
                                </Typography>
                                <Typography variant="body2" sx={{ color: formatChangePercent(summary?.revenueChangePercent || 0).color }}>
                                    {isPrivate
                                        ? `${(summary?.todayImpressions || 0).toLocaleString()} plays today`
                                        : `${formatChangePercent(summary?.revenueChangePercent || 0).text} from last month`}
                                </Typography>
                            </CardContent>
                        </Card>
                    )}
                </Grid>
                <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                    {isLoading ? <StatCardSkeleton /> : (
                        <Card>
                            <CardContent>
                                <Typography color="textSecondary" gutterBottom>
                                    {isPrivate ? 'Online Screens' : 'Avg. Daily Earnings'}
                                </Typography>
                                <Typography variant="h4">
                                    {isPrivate
                                        ? `${summary?.onlineScreens || 0}/${summary?.totalScreens || 0}`
                                        : formatCurrency(summary?.avgDailyRevenue || 0)}
                                </Typography>
                                <Typography variant="body2" color="text.secondary">
                                    {isPrivate ? 'Currently online' : 'Across all screens'}
                                </Typography>
                            </CardContent>
                        </Card>
                    )}
                </Grid>
                <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                    {isLoading ? <StatCardSkeleton /> : (
                        <Card>
                            <CardContent>
                                <Typography color="textSecondary" gutterBottom>
                                    {isPrivate ? 'Screen Uptime' : 'Active Bookings'}
                                </Typography>
                                <Typography variant="h4">{isPrivate ? `${summary?.screenUptimePercent || 0}%` : summary?.activeBookings || 0}</Typography>
                                <Typography variant="body2" color="text.secondary">
                                    {isPrivate ? 'Network availability' : 'Currently running'}
                                </Typography>
                            </CardContent>
                        </Card>
                    )}
                </Grid>
                <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                    {isLoading ? <StatCardSkeleton /> : (
                        <Card>
                            <CardContent>
                                <Typography color="textSecondary" gutterBottom>
                                    {isPrivate ? 'Total Screens' : 'Screen Uptime'}
                                </Typography>
                                <Typography variant="h4" color="info.main">
                                    {isPrivate ? summary?.totalScreens || 0 : `${summary?.screenUptimePercent || 0}%`}
                                </Typography>
                                <Typography variant="body2" color="text.secondary">
                                    {isPrivate
                                        ? `${summary?.onlineScreens || 0} online`
                                        : `${summary?.onlineScreens || 0} of ${summary?.totalScreens || 0} online`}
                                </Typography>
                            </CardContent>
                        </Card>
                    )}
                </Grid>
            </Grid>

            <Grid container spacing={3}>
                {/* Revenue Chart */}
                {!isPrivate && (
                <Grid size={{ xs: 12, lg: 8 }}>
                    {dailyLoading ? <ChartSkeleton height={350} /> : (
                        <Paper sx={{ p: { xs: 2, sm: 3 }, height: { xs: 300, sm: 350, md: 400 } }}>
                            <Typography variant="h6" gutterBottom>
                                Revenue & plays
                            </Typography>
                            {dailyRevenue && dailyRevenue.length > 0 ? (
                                <Box sx={{ height: '88%' }}>
                                    <TrendAreaChart
                                        data={dailyRevenue as unknown as Record<string, unknown>[]}
                                        xKey="dayName"
                                        series={[
                                            { key: 'revenue', name: 'Revenue', format: formatCurrency },
                                            { key: 'impressions', name: 'Plays', axis: 'right' },
                                        ]}
                                    />
                                </Box>
                            ) : (
                                <Box display="flex" alignItems="center" justifyContent="center" height="80%">
                                    <Typography color="textSecondary">No revenue data available</Typography>
                                </Box>
                            )}
                        </Paper>
                    )}
                </Grid>
                )}

                {/* Earnings Summary */}
                <Grid size={{ xs: 12, lg: isPrivate ? 12 : 4 }}>
                    {screensLoading ? <ChartSkeleton height={350} /> : (
                        <Paper sx={{ p: { xs: 2, sm: 3 }, height: { xs: 'auto', lg: 400 }, minHeight: { xs: 200, lg: 400 }, overflow: 'auto' }}>
                            <Typography variant="h6" gutterBottom>
                                {isPrivate ? 'Screen Health by Location' : 'Revenue by Screen'}
                            </Typography>
                            {screens && screens.length > 0 ? (
                                <Box sx={{ mt: 3 }}>
                                    {screens.slice(0, 5).map((screen) => (
                                        <Box key={screen.screenId} mb={3}>
                                            <Box display="flex" justifyContent="space-between" alignItems="center">
                                                <Typography variant="body2" color="textSecondary">
                                                    {screen.screenName}
                                                </Typography>
                                                <Box
                                                    sx={{
                                                        width: 8,
                                                        height: 8,
                                                        borderRadius: '50%',
                                                        bgcolor: screen.isOnline ? 'success.main' : 'grey.400',
                                                    }}
                                                />
                                            </Box>
                                            <Typography variant="h5">{isPrivate ? `${screen.uptimePercent}% uptime` : formatCurrency(screen.revenue)}</Typography>
                                            <Typography variant="caption" color="textSecondary">
                                                {isPrivate
                                                    ? `${screen.impressions.toLocaleString()} plays • ${screen.isOnline ? 'Online' : 'Offline'}`
                                                    : `${screen.impressions.toLocaleString()} plays • ${screen.activeBookings} active bookings`}
                                            </Typography>
                                        </Box>
                                    ))}
                                </Box>
                            ) : (
                                <Box display="flex" alignItems="center" justifyContent="center" height="80%">
                                    <Typography color="textSecondary">No screens found</Typography>
                                </Box>
                            )}
                        </Paper>
                    )}
                </Grid>

                {/* Impressions */}
                <Grid size={{ xs: 12 }}>
                    {dailyLoading ? <ChartSkeleton height={350} /> : (
                        <Paper sx={{ p: { xs: 2, sm: 3 }, height: { xs: 300, sm: 350, md: 400 } }}>
                            <Typography variant="h6" gutterBottom>
                                Plays delivered
                            </Typography>
                            {dailyRevenue && dailyRevenue.length > 0 ? (
                                <Box sx={{ height: '88%' }}>
                                    <TrendAreaChart
                                        data={dailyRevenue as unknown as Record<string, unknown>[]}
                                        xKey="dayName"
                                        series={[{ key: 'impressions', name: 'Plays' }]}
                                    />
                                </Box>
                            ) : (
                                <Box display="flex" alignItems="center" justifyContent="center" height="80%">
                                    <Typography color="textSecondary">No impression data available</Typography>
                                </Box>
                            )}
                        </Paper>
                    )}
                </Grid>

                {/* Revenue Over Time (date-range) */}
                {!isPrivate && dateRangeData && dateRangeData.revenueOverTime.length > 0 && (
                    <Grid size={{ xs: 12, lg: 8 }}>
                        <Paper sx={{ p: { xs: 2, sm: 3 }, height: { xs: 300, sm: 350, md: 400 } }}>
                            <Typography variant="h6" gutterBottom>
                                Revenue Over Time ({dateFrom} → {dateTo})
                            </Typography>
                            <Box sx={{ height: '88%' }}>
                                <TrendAreaChart
                                    data={dateRangeData.revenueOverTime.map((r) => ({ ...r, day: r.date.slice(5) }))}
                                    xKey="day"
                                    series={[{ key: 'amount', name: 'Revenue', format: formatCurrency }]}
                                />
                            </Box>
                        </Paper>
                    </Grid>
                )}

                {/* Fill Rate by Screen (date-range) */}
                {!isPrivate && dateRangeData && dateRangeData.fillRateByScreen.length > 0 && (
                    <Grid size={{ xs: 12, lg: 4 }}>
                        <Paper sx={{ p: { xs: 2, sm: 3 }, height: { xs: 300, sm: 350, md: 400 } }}>
                            <Typography variant="h6" gutterBottom>
                                Fill Rate by Screen
                            </Typography>
                            <ResponsiveContainer width="100%" height="90%">
                                <BarChart data={dateRangeData.fillRateByScreen} layout="vertical" margin={{ top: 5, right: 30, left: 60, bottom: 5 }}>
                                    <CartesianGrid stroke={muiTheme.palette.divider} horizontal={false} />
                                    <XAxis type="number" domain={[0, 100]} tickFormatter={(v) => `${v}%`}
                                        tick={{ fontSize: 11, fill: muiTheme.palette.text.disabled }} axisLine={false} tickLine={false} />
                                    <YAxis type="category" dataKey="screenName" width={80}
                                        tick={{ fontSize: 11, fill: muiTheme.palette.text.secondary }} axisLine={false} tickLine={false} />
                                    <Tooltip formatter={(v: number) => `${v}%`}
                                        contentStyle={{
                                            background: muiTheme.palette.background.paper,
                                            border: `1px solid ${muiTheme.palette.divider}`,
                                            borderRadius: 10, fontSize: 12, color: muiTheme.palette.text.primary,
                                        }} />
                                    <Bar dataKey="fillRate" fill={muiTheme.palette.secondary.main} radius={[0, 6, 6, 0]} name="Fill Rate %" />
                                </BarChart>
                            </ResponsiveContainer>
                        </Paper>
                    </Grid>
                )}
            </Grid>
        </Container>
    );
}


// ============================================
// ADVERTISER ANALYTICS COMPONENT
// ============================================
function AdvertiserAnalytics() {
    const [dateRange, setDateRange] = useState<DateRange>({ from: subDays(new Date(), 29), to: new Date() });
    const [exporting, setExporting] = useState(false);
    const [exportingPdf, setExportingPdf] = useState(false);

    const dateFrom = format(dateRange.from, 'yyyy-MM-dd');
    const dateTo = format(dateRange.to, 'yyyy-MM-dd');

    const { data: summary, isLoading: summaryLoading, error: summaryError } = useQuery<AdvertiserAnalyticsSummary>({
        queryKey: ['analytics', 'advertiser', 'summary'],
        queryFn: getAdvertiserAnalyticsSummary,
    });

    const { data: campaigns, isLoading: campaignsLoading } = useQuery<CampaignPerformanceSummary[]>({
        queryKey: ['analytics', 'advertiser', 'campaigns'],
        queryFn: getAdvertiserCampaigns,
    });

    const { data: dailyImpressions, isLoading: dailyLoading } = useQuery<DailyImpressions[]>({
        queryKey: ['analytics', 'advertiser', 'daily'],
        queryFn: () => getAdvertiserDailyImpressions(7),
    });

    const { data: dateRangeData } = useQuery<AdvertiserDateRangeAnalytics>({
        queryKey: ['analytics', 'advertiser', 'daterange', dateFrom, dateTo],
        queryFn: () => getAdvertiserDateRangeAnalytics(dateFrom, dateTo),
    });

    const isLoading = summaryLoading || campaignsLoading || dailyLoading;

    const handleExport = async () => {
        setExporting(true);
        try {
            await exportAnalyticsCsv('advertiser', dateFrom, dateTo);
        } finally {
            setExporting(false);
        }
    };

    const handleExportPdf = async () => {
        setExportingPdf(true);
        try {
            await exportAnalyticsPdf('advertiser', dateFrom, dateTo);
        } finally {
            setExportingPdf(false);
        }
    };

    if (summaryError) {
        return (
            <Container maxWidth="lg" sx={{ mt: 4 }}>
                <Alert severity="error">Failed to load analytics. Please try again later.</Alert>
            </Container>
        );
    }

    return (
        <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
            <Box
                sx={{
                    p: { xs: 2.5, md: 3.5 },
                    mb: 3,
                    borderRadius: 3,
                    background:
                        'radial-gradient(900px 340px at 100% -8%, rgba(10,102,216,0.12), transparent 60%), var(--ps-surface)',
                    border: '1px solid var(--ps-border)',
                    boxShadow: '0 8px 24px rgba(0,0,0,0.10)',
                    display: 'flex',
                    alignItems: { sm: 'center' },
                    flexDirection: { xs: 'column', sm: 'row' },
                    gap: 2,
                }}
            >
                <Box>
                    <Typography variant="h4" gutterBottom sx={{ mb: 0.5 }}>
                        Campaign Analytics
                    </Typography>
                    <Typography variant="body1" color="text.secondary">
                        Track your campaign performance and spend
                    </Typography>
                </Box>
            </Box>
            <Box mb={3}>
                <DateRangeSelector
                    value={dateRange}
                    onChange={setDateRange}
                    onExport={handleExport}
                    exporting={exporting}
                    onExportPdf={handleExportPdf}
                    exportingPdf={exportingPdf}
                />
            </Box>

            {/* Summary Cards */}
            <Grid container spacing={3} sx={{ mb: 4 }}>
                <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                    {isLoading ? <StatCardSkeleton /> : (
                        <Card>
                            <CardContent>
                                <Typography color="textSecondary" gutterBottom>
                                    Total Impressions
                                </Typography>
                                <Typography variant="h4">{(summary?.totalImpressions || 0).toLocaleString()}</Typography>
                                <Typography variant="body2" sx={{ color: formatChangePercent(summary?.impressionChangePercent || 0).color }}>
                                    {formatChangePercent(summary?.impressionChangePercent || 0).text} from last week
                                </Typography>
                            </CardContent>
                        </Card>
                    )}
                </Grid>
                <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                    {isLoading ? <StatCardSkeleton /> : (
                        <Card>
                            <CardContent>
                                <Typography color="textSecondary" gutterBottom>
                                    Total Spend
                                </Typography>
                                <Typography variant="h4">{formatCurrency(summary?.totalSpendMonth || 0)}</Typography>
                                <Typography variant="body2" color="text.secondary">
                                    This month
                                </Typography>
                            </CardContent>
                        </Card>
                    )}
                </Grid>
                <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                    {isLoading ? <StatCardSkeleton /> : (
                        <Card>
                            <CardContent>
                                <Typography color="textSecondary" gutterBottom>
                                    Avg. CPM
                                </Typography>
                                <Typography variant="h4">{formatCurrency(summary?.avgCpm || 0)}</Typography>
                                <Typography variant="body2" sx={{ color: formatChangePercent(-(summary?.cpmChangePercent || 0)).color }}>
                                    {formatChangePercent(-(summary?.cpmChangePercent || 0)).text} from last month
                                </Typography>
                            </CardContent>
                        </Card>
                    )}
                </Grid>
                <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                    {isLoading ? <StatCardSkeleton /> : (
                        <Card>
                            <CardContent>
                                <Typography color="textSecondary" gutterBottom>
                                    Active Campaigns
                                </Typography>
                                <Typography variant="h4" color="primary">{summary?.activeCampaigns || 0}</Typography>
                                <Typography variant="body2" color="text.secondary">
                                    of {summary?.totalCampaigns || 0} total
                                </Typography>
                            </CardContent>
                        </Card>
                    )}
                </Grid>
            </Grid>

            <Grid container spacing={3}>
                {/* Impressions Chart */}
                <Grid size={{ xs: 12, lg: 8 }}>
                    {dailyLoading ? <ChartSkeleton height={350} /> : (
                        <Paper sx={{ p: { xs: 2, sm: 3 }, height: { xs: 300, sm: 350, md: 400 } }}>
                            <Typography variant="h6" gutterBottom>
                                Plays delivered
                            </Typography>
                            {dailyImpressions && dailyImpressions.length > 0 ? (
                                <Box sx={{ height: '88%' }}>
                                    <TrendAreaChart
                                        data={dailyImpressions as unknown as Record<string, unknown>[]}
                                        xKey="dayName"
                                        series={[{ key: 'impressions', name: 'Plays' }]}
                                    />
                                </Box>
                            ) : (
                                <Box display="flex" alignItems="center" justifyContent="center" height="80%">
                                    <Typography color="textSecondary">No impression data available</Typography>
                                </Box>
                            )}
                        </Paper>
                    )}
                </Grid>

                {/* Campaign Summary */}
                <Grid size={{ xs: 12, lg: 4 }}>
                    {campaignsLoading ? <ChartSkeleton height={350} /> : (
                        <Paper sx={{ p: { xs: 2, sm: 3 }, height: { xs: 'auto', lg: 400 }, minHeight: { xs: 200, lg: 400 }, overflow: 'auto' }}>
                            <Typography variant="h6" gutterBottom>
                                Campaign Performance
                            </Typography>
                            {campaigns && campaigns.length > 0 ? (
                                <Box sx={{ mt: 3 }}>
                                    {campaigns.slice(0, 5).map((campaign) => (
                                        <Box key={campaign.campaignId} mb={3}>
                                            <Typography variant="body2" color="textSecondary">
                                                {campaign.campaignName}
                                            </Typography>
                                            <Typography variant="h5">
                                                {campaign.deliveredImpressions.toLocaleString()} plays
                                            </Typography>
                                            <Typography 
                                                variant="body2" 
                                                sx={{ 
                                                    color: campaign.deliveryPercent >= 50 ? 'success.main' : 'warning.main' 
                                                }}
                                            >
                                                {campaign.deliveryPercent.toFixed(0)}% of target
                                            </Typography>
                                        </Box>
                                    ))}
                                </Box>
                            ) : (
                                <Box display="flex" alignItems="center" justifyContent="center" height="80%">
                                    <Typography color="textSecondary">No campaigns found</Typography>
                                </Box>
                            )}
                        </Paper>
                    )}
                </Grid>

                {/* Booking Trends */}
                <Grid size={{ xs: 12 }}>
                    {dailyLoading ? <ChartSkeleton height={350} /> : (
                        <Paper sx={{ p: { xs: 2, sm: 3 }, height: { xs: 300, sm: 350, md: 400 } }}>
                            <Typography variant="h6" gutterBottom>
                                Booking Trends
                            </Typography>
                            {dailyImpressions && dailyImpressions.length > 0 ? (
                                <Box sx={{ height: '88%' }}>
                                    <TrendAreaChart
                                        data={dailyImpressions as unknown as Record<string, unknown>[]}
                                        xKey="dayName"
                                        series={[{ key: 'bookings', name: 'Bookings' }]}
                                    />
                                </Box>
                            ) : (
                                <Box display="flex" alignItems="center" justifyContent="center" height="80%">
                                    <Typography color="textSecondary">No booking data available</Typography>
                                </Box>
                            )}
                        </Paper>
                    )}
                </Grid>

                {/* Spend Over Time (date-range) */}
                {dateRangeData && dateRangeData.spendOverTime.length > 0 && (
                    <Grid size={{ xs: 12 }}>
                        <Paper sx={{ p: { xs: 2, sm: 3 }, height: { xs: 300, sm: 350, md: 400 } }}>
                            <Typography variant="h6" gutterBottom>
                                Spend Over Time ({dateFrom} → {dateTo})
                            </Typography>
                            <Box sx={{ height: '88%' }}>
                                <TrendAreaChart
                                    data={dateRangeData.spendOverTime.map((r) => ({ ...r, day: r.date.slice(5) }))}
                                    xKey="day"
                                    series={[{ key: 'amount', name: 'Spend', format: formatCurrency }]}
                                />
                            </Box>
                        </Paper>
                    </Grid>
                )}
            </Grid>
        </Container>
    );
}


// ============================================
// ADMIN ANALYTICS COMPONENT
// ============================================
function AdminAnalytics() {
    const { data: summary, isLoading: summaryLoading, error: summaryError } = useQuery<PlatformAnalyticsSummary>({
        queryKey: ['analytics', 'admin', 'platform'],
        queryFn: getPlatformAnalyticsSummary,
    });

    const { data: dailyStats, isLoading: dailyLoading } = useQuery<PlatformDailyStats[]>({
        queryKey: ['analytics', 'admin', 'daily'],
        queryFn: () => getPlatformDailyStats(7),
    });

    const isLoading = summaryLoading || dailyLoading;

    if (summaryError) {
        return (
            <Container maxWidth="lg" sx={{ mt: 4 }}>
                <Alert severity="error">Failed to load platform analytics. You may not have admin access.</Alert>
            </Container>
        );
    }

    return (
        <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
            <Box
                sx={{
                    p: { xs: 2.5, md: 3.5 },
                    mb: 4,
                    borderRadius: 3,
                    background:
                        'radial-gradient(900px 340px at 100% -8%, rgba(10,102,216,0.12), transparent 60%), var(--ps-surface)',
                    border: '1px solid var(--ps-border)',
                    boxShadow: '0 8px 24px rgba(0,0,0,0.10)',
                }}
            >
                <Typography variant="h4" gutterBottom sx={{ mb: 0.5 }}>
                    Platform Analytics
                </Typography>
                <Typography variant="body1" color="text.secondary">
                    Performance metrics across all screens and campaigns
                </Typography>
            </Box>

            <Grid container spacing={3}>
                {/* Summary Cards */}
                <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                    {isLoading ? <StatCardSkeleton /> : (
                        <Card>
                            <CardContent>
                                <Typography color="textSecondary" gutterBottom>
                                    Total Impressions
                                </Typography>
                                <Typography variant="h4">{(summary?.totalImpressions || 0).toLocaleString()}</Typography>
                                <Typography variant="body2" sx={{ color: formatChangePercent(summary?.impressionChangePercent || 0).color }}>
                                    {formatChangePercent(summary?.impressionChangePercent || 0).text} from last month
                                </Typography>
                            </CardContent>
                        </Card>
                    )}
                </Grid>
                <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                    {isLoading ? <StatCardSkeleton /> : (
                        <Card>
                            <CardContent>
                                <Typography color="textSecondary" gutterBottom>
                                    Total Revenue
                                </Typography>
                                <Typography variant="h4">{formatCurrency(summary?.revenueThisMonth || 0)}</Typography>
                                <Typography variant="body2" sx={{ color: formatChangePercent(summary?.revenueChangePercent || 0).color }}>
                                    {formatChangePercent(summary?.revenueChangePercent || 0).text} from last month
                                </Typography>
                            </CardContent>
                        </Card>
                    )}
                </Grid>
                <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                    {isLoading ? <StatCardSkeleton /> : (
                        <Card>
                            <CardContent>
                                <Typography color="textSecondary" gutterBottom>
                                    Active Screens
                                </Typography>
                                <Typography variant="h4">{summary?.onlineScreens || 0}</Typography>
                                <Typography variant="body2" color="text.secondary">
                                    {summary?.avgScreenUptime || 0}% uptime
                                </Typography>
                            </CardContent>
                        </Card>
                    )}
                </Grid>
                <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                    {isLoading ? <StatCardSkeleton /> : (
                        <Card>
                            <CardContent>
                                <Typography color="textSecondary" gutterBottom>
                                    Active Campaigns
                                </Typography>
                                <Typography variant="h4">{summary?.activeCampaigns || 0}</Typography>
                                <Typography variant="body2" color="text.secondary">
                                    {summary?.totalAdvertisers || 0} advertisers
                                </Typography>
                            </CardContent>
                        </Card>
                    )}
                </Grid>

                {/* Impressions Chart */}
                <Grid size={{ xs: 12, lg: 8 }}>
                    {dailyLoading ? <ChartSkeleton height={350} /> : (
                        <Paper sx={{ p: { xs: 2, sm: 3 }, height: { xs: 300, sm: 350, md: 400 } }}>
                            <Typography variant="h6" gutterBottom>
                                Weekly Impressions
                            </Typography>
                            {dailyStats && dailyStats.length > 0 ? (
                                <ResponsiveContainer width="100%" height="90%">
                                    <BarChart
                                        data={dailyStats}
                                        margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                                    >
                                        <CartesianGrid strokeDasharray="3 3" />
                                        <XAxis dataKey="dayName" />
                                        <YAxis />
                                        <Tooltip />
                                        <Legend />
                                        <Bar dataKey="impressions" fill="#8884d8" name="Impressions" />
                                    </BarChart>
                                </ResponsiveContainer>
                            ) : (
                                <Box display="flex" alignItems="center" justifyContent="center" height="80%">
                                    <Typography color="textSecondary">No data available</Typography>
                                </Box>
                            )}
                        </Paper>
                    )}
                </Grid>

                {/* Revenue Summary */}
                <Grid size={{ xs: 12, lg: 4 }}>
                    <Grid container spacing={3}>
                        <Grid size={{ xs: 12 }}>
                            {isLoading ? <StatCardSkeleton /> : (
                                <Card>
                                    <CardContent>
                                        <Typography color="textSecondary" gutterBottom>
                                            Total Revenue (All Time)
                                        </Typography>
                                        <Typography variant="h4" color="success.main">
                                            {formatCurrency(summary?.totalRevenue || 0)}
                                        </Typography>
                                        <Typography variant="body2" color="text.secondary">
                                            {summary?.approvedBookings || 0} completed bookings
                                        </Typography>
                                    </CardContent>
                                </Card>
                            )}
                        </Grid>
                        <Grid size={{ xs: 12 }}>
                            {isLoading ? <StatCardSkeleton /> : (
                                <Card>
                                    <CardContent>
                                        <Typography color="textSecondary" gutterBottom>
                                            Pending Approvals
                                        </Typography>
                                        <Typography variant="h4" color="warning.main">
                                            {summary?.pendingApprovals || 0}
                                        </Typography>
                                        <Typography variant="body2" color="text.secondary">
                                            Booking requests
                                        </Typography>
                                    </CardContent>
                                </Card>
                            )}
                        </Grid>
                        <Grid size={{ xs: 12 }}>
                            {isLoading ? <StatCardSkeleton /> : (
                                <Card>
                                    <CardContent>
                                        <Typography color="textSecondary" gutterBottom>
                                            Platform Users
                                        </Typography>
                                        <Typography variant="h4">{summary?.totalUsers || 0}</Typography>
                                        <Typography variant="body2" color="success.main">
                                            +{summary?.newUsersThisMonth || 0} this month
                                        </Typography>
                                    </CardContent>
                                </Card>
                            )}
                        </Grid>
                    </Grid>
                </Grid>

                {/* Revenue Trend */}
                <Grid size={{ xs: 12 }}>
                    {dailyLoading ? <ChartSkeleton height={350} /> : (
                        <Paper sx={{ p: { xs: 2, sm: 3 }, height: { xs: 300, sm: 350, md: 400 } }}>
                            <Typography variant="h6" gutterBottom>
                                Revenue & Booking Trends
                            </Typography>
                            {dailyStats && dailyStats.length > 0 ? (
                                <ResponsiveContainer width="100%" height="90%">
                                    <LineChart
                                        data={dailyStats}
                                        margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                                    >
                                        <CartesianGrid strokeDasharray="3 3" />
                                        <XAxis dataKey="dayName" />
                                        <YAxis yAxisId="left" />
                                        <YAxis yAxisId="right" orientation="right" />
                                        <Tooltip formatter={(value: number, name: string) => 
                                            name === 'Revenue' ? formatCurrency(value) : value
                                        } />
                                        <Legend />
                                        <Line
                                            yAxisId="left"
                                            type="monotone"
                                            dataKey="revenue"
                                            stroke="#4caf50"
                                            name="Revenue"
                                            strokeWidth={2}
                                        />
                                        <Line
                                            yAxisId="right"
                                            type="monotone"
                                            dataKey="newBookings"
                                            stroke="#82ca9d"
                                            name="New Bookings"
                                            strokeWidth={2}
                                        />
                                    </LineChart>
                                </ResponsiveContainer>
                            ) : (
                                <Box display="flex" alignItems="center" justifyContent="center" height="80%">
                                    <Typography color="textSecondary">No data available</Typography>
                                </Box>
                            )}
                        </Paper>
                    )}
                </Grid>
            </Grid>
        </Container>
    );
}
