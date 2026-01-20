import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
    Container,
    Paper,
    Typography,
    Box,
    Grid,
    Card,
    CardContent,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Button,
    CircularProgress,
    Alert,
    Chip,
} from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import {
    ArrowBack as BackIcon,
    Download as DownloadIcon,
    PictureAsPdf as PdfIcon,
    PlayCircleOutline as PlayIcon,
    CheckCircle as FullPlayIcon,
    Percent as PercentIcon,
    Timer as TimerIcon,
    Tv as ScreenIcon,
} from '@mui/icons-material';
import { api } from '../../services/api';

interface ScreenSummary {
    bookingId: string;
    screenId: string;
    screenName: string;
    screenLocation: string;
    totalPlays: number;
    fullPlays: number;
    completionRate: number;
}

interface CampaignSummaryReport {
    campaignId: string;
    campaignName: string;
    advertiserId: string;
    campaignPeriod: { startDate: string; endDate: string };
    reportPeriod: { startDate: string; endDate: string };
    generatedAt: string;
    totalScreens: number;
    totalPlays: number;
    fullPlays: number;
    partialPlays: number;
    totalDurationSeconds: number;
    completionRate: number;
    averagePlayDurationSeconds: number;
    screenStats: ScreenSummary[];
}

export default function CampaignReportPage() {
    const { campaignId } = useParams();
    const navigate = useNavigate();
    
    const [report, setReport] = useState<CampaignSummaryReport | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [exporting, setExporting] = useState(false);
    
    const [startDate, setStartDate] = useState<Date | null>(null);
    const [endDate, setEndDate] = useState<Date | null>(null);

    const fetchReport = async () => {
        if (!campaignId) return;
        
        setLoading(true);
        setError(null);
        
        try {
            let url = `/reports/campaigns/${campaignId}/summary`;
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
    }, [campaignId, startDate, endDate]);

    const handleExport = async (format: 'csv' | 'pdf') => {
        if (!campaignId) return;
        
        setExporting(true);
        try {
            let url = `/reports/campaigns/${campaignId}/export?format=${format}`;
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
            link.download = `campaign-report-${campaignId}.${format}`;
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
            <Container maxWidth="lg" sx={{ mt: 4 }}>
                <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
                    <CircularProgress />
                </Box>
            </Container>
        );
    }

    if (error) {
        return (
            <Container maxWidth="lg" sx={{ mt: 4 }}>
                <Button startIcon={<BackIcon />} onClick={() => navigate(-1)} sx={{ mb: 2 }}>
                    Back
                </Button>
                <Alert severity="error">{error}</Alert>
            </Container>
        );
    }

    if (!report) {
        return (
            <Container maxWidth="lg" sx={{ mt: 4 }}>
                <Button startIcon={<BackIcon />} onClick={() => navigate(-1)} sx={{ mb: 2 }}>
                    Back
                </Button>
                <Alert severity="info">No report data available</Alert>
            </Container>
        );
    }

    return (
        <LocalizationProvider dateAdapter={AdapterDateFns}>
            <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
                {/* Header */}
                <Button startIcon={<BackIcon />} onClick={() => navigate(-1)} sx={{ mb: 2 }}>
                    Back
                </Button>
                
                <Paper sx={{ p: 3, mb: 3 }}>
                    <Box display="flex" justifyContent="space-between" alignItems="start" flexWrap="wrap" gap={2}>
                        <Box>
                            <Typography variant="h4" gutterBottom>
                                Campaign Report
                            </Typography>
                            <Typography variant="h6" color="primary">
                                {report.campaignName}
                            </Typography>
                            <Typography variant="body2" color="textSecondary">
                                Campaign Period: {new Date(report.campaignPeriod.startDate).toLocaleDateString()} - {new Date(report.campaignPeriod.endDate).toLocaleDateString()}
                            </Typography>
                        </Box>
                        
                        {/* Date Filters */}
                        <Box display="flex" gap={2} alignItems="center" flexWrap="wrap">
                            <DatePicker
                                label="Start Date"
                                value={startDate}
                                onChange={setStartDate}
                                slotProps={{ textField: { size: 'small' } }}
                            />
                            <DatePicker
                                label="End Date"
                                value={endDate}
                                onChange={setEndDate}
                                slotProps={{ textField: { size: 'small' } }}
                            />
                        </Box>
                        
                        {/* Export Buttons */}
                        <Box display="flex" gap={1}>
                            <Button
                                variant="outlined"
                                startIcon={<DownloadIcon />}
                                onClick={() => handleExport('csv')}
                                disabled={exporting}
                            >
                                CSV
                            </Button>
                            <Button
                                variant="contained"
                                startIcon={<PdfIcon />}
                                onClick={() => handleExport('pdf')}
                                disabled={exporting}
                            >
                                PDF
                            </Button>
                        </Box>
                    </Box>
                </Paper>

                {/* Summary Cards */}
                <Grid container spacing={3} sx={{ mb: 3 }}>
                    <Grid size={{ xs: 12, sm: 6, md: 2.4 }}>
                        <Card sx={{ height: '100%' }}>
                            <CardContent>
                                <Box display="flex" alignItems="center" gap={1} mb={1}>
                                    <ScreenIcon color="primary" />
                                    <Typography variant="body2" color="textSecondary">
                                        Total Screens
                                    </Typography>
                                </Box>
                                <Typography variant="h4">
                                    {report.totalScreens}
                                </Typography>
                            </CardContent>
                        </Card>
                    </Grid>
                    
                    <Grid size={{ xs: 12, sm: 6, md: 2.4 }}>
                        <Card sx={{ height: '100%' }}>
                            <CardContent>
                                <Box display="flex" alignItems="center" gap={1} mb={1}>
                                    <PlayIcon color="primary" />
                                    <Typography variant="body2" color="textSecondary">
                                        Total Plays
                                    </Typography>
                                </Box>
                                <Typography variant="h4">
                                    {report.totalPlays.toLocaleString()}
                                </Typography>
                            </CardContent>
                        </Card>
                    </Grid>

                    <Grid size={{ xs: 12, sm: 6, md: 2.4 }}>
                        <Card sx={{ height: '100%' }}>
                            <CardContent>
                                <Box display="flex" alignItems="center" gap={1} mb={1}>
                                    <FullPlayIcon color="success" />
                                    <Typography variant="body2" color="textSecondary">
                                        Full Plays
                                    </Typography>
                                </Box>
                                <Typography variant="h4" color="success.main">
                                    {report.fullPlays.toLocaleString()}
                                </Typography>
                            </CardContent>
                        </Card>
                    </Grid>

                    <Grid size={{ xs: 12, sm: 6, md: 2.4 }}>
                        <Card sx={{ height: '100%' }}>
                            <CardContent>
                                <Box display="flex" alignItems="center" gap={1} mb={1}>
                                    <PercentIcon color="info" />
                                    <Typography variant="body2" color="textSecondary">
                                        Completion Rate
                                    </Typography>
                                </Box>
                                <Typography variant="h4" color={`${getCompletionColor(report.completionRate)}.main`}>
                                    {report.completionRate}%
                                </Typography>
                            </CardContent>
                        </Card>
                    </Grid>

                    <Grid size={{ xs: 12, sm: 6, md: 2.4 }}>
                        <Card sx={{ height: '100%' }}>
                            <CardContent>
                                <Box display="flex" alignItems="center" gap={1} mb={1}>
                                    <TimerIcon color="secondary" />
                                    <Typography variant="body2" color="textSecondary">
                                        Total Playtime
                                    </Typography>
                                </Box>
                                <Typography variant="h4">
                                    {formatDuration(report.totalDurationSeconds)}
                                </Typography>
                            </CardContent>
                        </Card>
                    </Grid>
                </Grid>

                {/* Per-Screen Performance Table */}
                <Paper sx={{ p: 3 }}>
                    <Typography variant="h6" gutterBottom>
                        Performance by Screen
                    </Typography>
                    
                    <TableContainer>
                        <Table>
                            <TableHead>
                                <TableRow>
                                    <TableCell>Screen</TableCell>
                                    <TableCell>Location</TableCell>
                                    <TableCell align="right">Total Plays</TableCell>
                                    <TableCell align="right">Full Plays</TableCell>
                                    <TableCell align="right">Partial Plays</TableCell>
                                    <TableCell align="right">Completion Rate</TableCell>
                                    <TableCell align="center">Actions</TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {report.screenStats && report.screenStats.length > 0 ? (
                                    report.screenStats.map((screen) => (
                                        <TableRow key={screen.bookingId} hover>
                                            <TableCell>
                                                <Typography fontWeight="medium">
                                                    {screen.screenName}
                                                </Typography>
                                            </TableCell>
                                            <TableCell>{screen.screenLocation}</TableCell>
                                            <TableCell align="right">
                                                {screen.totalPlays.toLocaleString()}
                                            </TableCell>
                                            <TableCell align="right">
                                                {screen.fullPlays.toLocaleString()}
                                            </TableCell>
                                            <TableCell align="right">
                                                {(screen.totalPlays - screen.fullPlays).toLocaleString()}
                                            </TableCell>
                                            <TableCell align="right">
                                                <Chip 
                                                    label={`${screen.completionRate}%`}
                                                    size="small"
                                                    color={getCompletionColor(screen.completionRate)}
                                                />
                                            </TableCell>
                                            <TableCell align="center">
                                                <Button
                                                    size="small"
                                                    onClick={() => navigate(`/reports/bookings/${screen.bookingId}`)}
                                                >
                                                    Details
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                ) : (
                                    <TableRow>
                                        <TableCell colSpan={7} align="center">
                                            <Typography color="textSecondary">
                                                No screen data available for this period
                                            </Typography>
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </TableContainer>
                </Paper>

                {/* Report Metadata */}
                <Box mt={2} textAlign="center">
                    <Typography variant="caption" color="textSecondary">
                        Report generated at {new Date(report.generatedAt).toLocaleString()}
                        {' | '}
                        Report Period: {new Date(report.reportPeriod.startDate).toLocaleDateString()} - {new Date(report.reportPeriod.endDate).toLocaleDateString()}
                    </Typography>
                </Box>
            </Container>
        </LocalizationProvider>
    );
}
