import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
    Box,
    Card,
    CardContent,
    Typography,
    Grid,
    Paper,
    Button,
    CircularProgress,
    Alert,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Chip,
    Tabs,
    Tab,
    IconButton,
    Tooltip,
} from '@mui/material';
import {
    DatePicker,
    LocalizationProvider,
} from '@mui/x-date-pickers';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import TableChartIcon from '@mui/icons-material/TableChart';
import BarChartIcon from '@mui/icons-material/BarChart';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { api } from '../../services/api';

interface DailyBreakdown {
    date: string;
    totalPlays: number;
    fullPlays: number;
    partialPlays: number;
    totalDurationSeconds: number;
    firstPlayAt: string | null;
    lastPlayAt: string | null;
    completionRate: number;
}

interface BookingReport {
    bookingId: string;
    campaignId: string;
    campaignName: string;
    screenId: string;
    screenName: string;
    screenLocation: string;
    creativeId: string;
    creativeName: string;
    bookingPeriod: { startDate: string; endDate: string };
    reportPeriod: { startDate: string; endDate: string };
    generatedAt: string;
    totalPlays: number;
    fullPlays: number;
    partialPlays: number;
    totalDurationSeconds: number;
    totalExpectedDurationSeconds: number;
    completionRate: number;
    averagePlayDurationSeconds: number;
    dailyBreakdown: DailyBreakdown[];
}

interface TabPanelProps {
    children?: React.ReactNode;
    index: number;
    value: number;
}

function TabPanel(props: TabPanelProps) {
    const { children, value, index, ...other } = props;
    return (
        <div role="tabpanel" hidden={value !== index} {...other}>
            {value === index && <Box sx={{ p: 3 }}>{children}</Box>}
        </div>
    );
}

const AdvertiserReportPage: React.FC = () => {
    const { bookingId } = useParams<{ bookingId: string }>();
    const navigate = useNavigate();
    
    const [report, setReport] = useState<BookingReport | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [tabValue, setTabValue] = useState(0);
    const [startDate, setStartDate] = useState<Date | null>(null);
    const [endDate, setEndDate] = useState<Date | null>(null);
    const [exporting, setExporting] = useState(false);

    const fetchReport = async () => {
        if (!bookingId) return;
        
        setLoading(true);
        setError(null);
        
        try {
            let url = `/reports/bookings/${bookingId}/impressions`;
            const params = new URLSearchParams();
            if (startDate) params.append('startDate', startDate.toISOString());
            if (endDate) params.append('endDate', endDate.toISOString());
            if (params.toString()) url += `?${params.toString()}`;
            
            const response = await api.get(url);
            if (response.data.success) {
                setReport(response.data.data);
            } else {
                setError(response.data.message || 'Failed to load report');
            }
        } catch (err: any) {
            setError(err.response?.data?.message || 'Failed to load report');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchReport();
    }, [bookingId, startDate, endDate]);

    const handleExport = async (format: 'csv' | 'pdf') => {
        if (!bookingId) return;
        
        setExporting(true);
        try {
            let url = `/reports/bookings/${bookingId}/export?format=${format}`;
            const params = new URLSearchParams();
            if (startDate) params.append('startDate', startDate.toISOString());
            if (endDate) params.append('endDate', endDate.toISOString());
            if (params.toString()) url += `&${params.toString()}`;
            
            const response = await api.get(url, { responseType: 'blob' });
            
            // Create download link
            const blob = new Blob([response.data], { 
                type: format === 'pdf' ? 'application/pdf' : 'text/csv' 
            });
            const downloadUrl = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = downloadUrl;
            link.download = `booking-report-${bookingId}.${format}`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            window.URL.revokeObjectURL(downloadUrl);
        } catch (err) {
            console.error('Export failed:', err);
        } finally {
            setExporting(false);
        }
    };

    const formatDuration = (seconds: number): string => {
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = seconds % 60;
        
        if (hours > 0) return `${hours}h ${minutes}m`;
        if (minutes > 0) return `${minutes}m ${secs}s`;
        return `${secs}s`;
    };

    const getCompletionColor = (rate: number): 'success' | 'warning' | 'error' => {
        if (rate >= 90) return 'success';
        if (rate >= 70) return 'warning';
        return 'error';
    };

    if (loading) {
        return (
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '50vh' }}>
                <CircularProgress />
            </Box>
        );
    }

    if (error) {
        return (
            <Box sx={{ p: 3 }}>
                <Alert severity="error">{error}</Alert>
                <Button onClick={() => navigate(-1)} sx={{ mt: 2 }}>Go Back</Button>
            </Box>
        );
    }

    if (!report) {
        return (
            <Box sx={{ p: 3 }}>
                <Alert severity="info">No report data available</Alert>
            </Box>
        );
    }

    return (
        <LocalizationProvider dateAdapter={AdapterDateFns}>
            <Box sx={{ p: 3 }}>
                {/* Header */}
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 3 }}>
                    <Box>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                            <IconButton onClick={() => navigate(-1)} size="small">
                                <ArrowBackIcon />
                            </IconButton>
                            <Typography variant="h4">📊 Impression Report</Typography>
                        </Box>
                        <Typography variant="subtitle1" color="textSecondary">
                            {report.campaignName} • {report.screenName}
                        </Typography>
                        <Typography variant="body2" color="textSecondary">
                            {report.screenLocation}
                        </Typography>
                    </Box>
                    
                    <Box sx={{ display: 'flex', gap: 1 }}>
                        <Button
                            variant="outlined"
                            startIcon={<TableChartIcon />}
                            onClick={() => handleExport('csv')}
                            disabled={exporting}
                        >
                            Export CSV
                        </Button>
                        <Button
                            variant="contained"
                            startIcon={<PictureAsPdfIcon />}
                            onClick={() => handleExport('pdf')}
                            disabled={exporting}
                        >
                            Export PDF
                        </Button>
                    </Box>
                </Box>

                {/* Date Range Picker */}
                <Card sx={{ mb: 3 }}>
                    <CardContent>
                        <Grid container spacing={2} alignItems="center">
                            <Grid size={{ xs: 12, sm: 4 }}>
                                <DatePicker
                                    label="Start Date"
                                    value={startDate}
                                    onChange={(date) => setStartDate(date)}
                                    slotProps={{ textField: { fullWidth: true, size: 'small' } }}
                                />
                            </Grid>
                            <Grid size={{ xs: 12, sm: 4 }}>
                                <DatePicker
                                    label="End Date"
                                    value={endDate}
                                    onChange={(date) => setEndDate(date)}
                                    slotProps={{ textField: { fullWidth: true, size: 'small' } }}
                                />
                            </Grid>
                            <Grid size={{ xs: 12, sm: 4 }}>
                                <Button 
                                    variant="outlined" 
                                    onClick={() => { setStartDate(null); setEndDate(null); }}
                                    fullWidth
                                >
                                    Reset to Booking Period
                                </Button>
                            </Grid>
                        </Grid>
                    </CardContent>
                </Card>

                {/* Summary Cards */}
                <Grid container spacing={2} sx={{ mb: 3 }}>
                    <Grid size={{ xs: 6, sm: 3 }}>
                        <Paper sx={{ p: 2, textAlign: 'center', bgcolor: 'primary.lighter' }}>
                            <PlayArrowIcon sx={{ fontSize: 32, color: 'primary.main', mb: 1 }} />
                            <Typography variant="caption" color="textSecondary" display="block">
                                Total Plays
                            </Typography>
                            <Typography variant="h4" fontWeight="bold" color="primary.main">
                                {report.totalPlays.toLocaleString()}
                            </Typography>
                        </Paper>
                    </Grid>
                    
                    <Grid size={{ xs: 6, sm: 3 }}>
                        <Paper sx={{ p: 2, textAlign: 'center', bgcolor: 'success.lighter' }}>
                            <CheckCircleIcon sx={{ fontSize: 32, color: 'success.main', mb: 1 }} />
                            <Typography variant="caption" color="textSecondary" display="block">
                                Full Plays
                            </Typography>
                            <Typography variant="h4" fontWeight="bold" color="success.main">
                                {report.fullPlays.toLocaleString()}
                            </Typography>
                        </Paper>
                    </Grid>
                    
                    <Grid size={{ xs: 6, sm: 3 }}>
                        <Paper sx={{ p: 2, textAlign: 'center', bgcolor: 'info.lighter' }}>
                            <TrendingUpIcon sx={{ fontSize: 32, color: 'info.main', mb: 1 }} />
                            <Typography variant="caption" color="textSecondary" display="block">
                                Completion Rate
                            </Typography>
                            <Typography variant="h4" fontWeight="bold" color="info.main">
                                {report.completionRate}%
                            </Typography>
                        </Paper>
                    </Grid>
                    
                    <Grid size={{ xs: 6, sm: 3 }}>
                        <Paper sx={{ p: 2, textAlign: 'center', bgcolor: 'warning.lighter' }}>
                            <AccessTimeIcon sx={{ fontSize: 32, color: 'warning.main', mb: 1 }} />
                            <Typography variant="caption" color="textSecondary" display="block">
                                Total Playtime
                            </Typography>
                            <Typography variant="h4" fontWeight="bold" color="warning.main">
                                {formatDuration(report.totalDurationSeconds)}
                            </Typography>
                        </Paper>
                    </Grid>
                </Grid>

                {/* Tabs */}
                <Card>
                    <Tabs 
                        value={tabValue} 
                        onChange={(_, newValue) => setTabValue(newValue)}
                        sx={{ borderBottom: 1, borderColor: 'divider' }}
                    >
                        <Tab icon={<BarChartIcon />} label="Daily Breakdown" />
                        <Tab icon={<TableChartIcon />} label="Detailed Table" />
                    </Tabs>

                    {/* Daily Breakdown Chart */}
                    <TabPanel value={tabValue} index={0}>
                        <Box sx={{ height: 300, display: 'flex', alignItems: 'flex-end', gap: 1, p: 2, overflowX: 'auto' }}>
                            {report.dailyBreakdown.slice(-14).map((day, index) => {
                                const maxPlays = Math.max(...report.dailyBreakdown.map(d => d.totalPlays), 1);
                                const barHeight = (day.totalPlays / maxPlays) * 200;
                                
                                return (
                                    <Tooltip 
                                        key={index}
                                        title={
                                            <Box>
                                                <Typography variant="body2">{new Date(day.date).toLocaleDateString()}</Typography>
                                                <Typography variant="body2">Total: {day.totalPlays}</Typography>
                                                <Typography variant="body2">Full: {day.fullPlays}</Typography>
                                                <Typography variant="body2">Rate: {day.completionRate}%</Typography>
                                            </Box>
                                        }
                                    >
                                        <Box sx={{ textAlign: 'center', minWidth: 50 }}>
                                            <Box
                                                sx={{
                                                    width: 40,
                                                    height: Math.max(barHeight, 4),
                                                    bgcolor: day.completionRate >= 90 ? 'success.main' : 
                                                             day.completionRate >= 70 ? 'warning.main' : 'error.main',
                                                    borderRadius: '4px 4px 0 0',
                                                    mx: 'auto',
                                                    transition: 'height 0.3s',
                                                }}
                                            />
                                            <Typography variant="caption" color="textSecondary">
                                                {new Date(day.date).getDate()}
                                            </Typography>
                                        </Box>
                                    </Tooltip>
                                );
                            })}
                        </Box>
                        
                        {/* Legend */}
                        <Box sx={{ display: 'flex', gap: 3, justifyContent: 'center', mt: 2 }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                <Box sx={{ width: 16, height: 16, bgcolor: 'success.main', borderRadius: 1 }} />
                                <Typography variant="caption">≥90% completion</Typography>
                            </Box>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                <Box sx={{ width: 16, height: 16, bgcolor: 'warning.main', borderRadius: 1 }} />
                                <Typography variant="caption">70-89% completion</Typography>
                            </Box>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                <Box sx={{ width: 16, height: 16, bgcolor: 'error.main', borderRadius: 1 }} />
                                <Typography variant="caption">&lt;70% completion</Typography>
                            </Box>
                        </Box>
                    </TabPanel>

                    {/* Detailed Table */}
                    <TabPanel value={tabValue} index={1}>
                        <TableContainer>
                            <Table size="small">
                                <TableHead>
                                    <TableRow>
                                        <TableCell>Date</TableCell>
                                        <TableCell align="right">Total Plays</TableCell>
                                        <TableCell align="right">Full Plays</TableCell>
                                        <TableCell align="right">Partial</TableCell>
                                        <TableCell align="right">Duration</TableCell>
                                        <TableCell align="center">Completion</TableCell>
                                        <TableCell>First Play</TableCell>
                                        <TableCell>Last Play</TableCell>
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    {report.dailyBreakdown.map((day, index) => (
                                        <TableRow 
                                            key={index}
                                            sx={{ '&:nth-of-type(odd)': { bgcolor: 'action.hover' } }}
                                        >
                                            <TableCell>
                                                {new Date(day.date).toLocaleDateString('en-US', { 
                                                    weekday: 'short', 
                                                    month: 'short', 
                                                    day: 'numeric' 
                                                })}
                                            </TableCell>
                                            <TableCell align="right">
                                                <Typography fontWeight="bold">
                                                    {day.totalPlays.toLocaleString()}
                                                </Typography>
                                            </TableCell>
                                            <TableCell align="right">
                                                {day.fullPlays.toLocaleString()}
                                            </TableCell>
                                            <TableCell align="right">
                                                {day.partialPlays > 0 && (
                                                    <Chip 
                                                        size="small" 
                                                        label={day.partialPlays} 
                                                        color="warning"
                                                        variant="outlined"
                                                    />
                                                )}
                                                {day.partialPlays === 0 && '-'}
                                            </TableCell>
                                            <TableCell align="right">
                                                {formatDuration(day.totalDurationSeconds)}
                                            </TableCell>
                                            <TableCell align="center">
                                                <Chip
                                                    size="small"
                                                    label={`${day.completionRate}%`}
                                                    color={getCompletionColor(day.completionRate)}
                                                />
                                            </TableCell>
                                            <TableCell>
                                                {day.firstPlayAt 
                                                    ? new Date(day.firstPlayAt).toLocaleTimeString('en-US', { 
                                                        hour: '2-digit', 
                                                        minute: '2-digit' 
                                                    })
                                                    : '-'
                                                }
                                            </TableCell>
                                            <TableCell>
                                                {day.lastPlayAt 
                                                    ? new Date(day.lastPlayAt).toLocaleTimeString('en-US', { 
                                                        hour: '2-digit', 
                                                        minute: '2-digit' 
                                                    })
                                                    : '-'
                                                }
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </TableContainer>
                    </TabPanel>
                </Card>

                {/* Report Metadata */}
                <Box sx={{ mt: 2, textAlign: 'center' }}>
                    <Typography variant="caption" color="textSecondary">
                        Report generated: {new Date(report.generatedAt).toLocaleString()} • 
                        Booking period: {new Date(report.bookingPeriod.startDate).toLocaleDateString()} - {new Date(report.bookingPeriod.endDate).toLocaleDateString()}
                    </Typography>
                </Box>
            </Box>
        </LocalizationProvider>
    );
};

export default AdvertiserReportPage;
