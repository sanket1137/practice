import { Box, Paper, Typography, Grid, Skeleton, Button } from '@mui/material';
import {
    Tv as ScreenIcon,
    Circle as CircleIcon,
    SignalWifiOff as OfflineIcon,
    Build as MaintenanceIcon,
} from '@mui/icons-material';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { api } from '../../services/api';

interface Screen {
    id: string;
    name: string;
    status: string;
    isOnline: boolean;
    location: {
        city: string;
    };
}

export default function ScreenStatusGrid() {
    const navigate = useNavigate();

    const { data: screens, isLoading } = useQuery<Screen[]>({
        queryKey: ['screens'],
        queryFn: async () => {
            const response = await api.get('/screens');
            return response.data?.data || [];
        },
    });

    if (isLoading) {
        return (
            <Paper sx={{ p: 3 }}>
                <Typography variant="h6" gutterBottom>Screen Status</Typography>
                <Grid container spacing={2}>
                    {[1, 2, 3, 4].map((i) => (
                        <Grid key={i} size={{ xs: 6, sm: 3 }}>
                            <Skeleton variant="rectangular" height={100} sx={{ borderRadius: 2 }} />
                        </Grid>
                    ))}
                </Grid>
            </Paper>
        );
    }

    const onlineCount = screens?.filter(s => s.isOnline).length || 0;
    const offlineCount = screens?.filter(s => !s.isOnline && s.status !== 'Maintenance').length || 0;
    const maintenanceCount = screens?.filter(s => s.status === 'Maintenance').length || 0;
    const totalScreens = screens?.length || 0;

    const getStatusIcon = (screen: Screen) => {
        if (screen.status === 'Maintenance') return <MaintenanceIcon fontSize="small" />;
        return screen.isOnline ?
            <CircleIcon sx={{ fontSize: 10, color: 'success.main' }} /> :
            <OfflineIcon fontSize="small" sx={{ color: 'error.main' }} />;
    };

    return (
        <Paper sx={{ p: 3 }}>
            <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                <Typography variant="h6">Screen Status</Typography>
                <Button size="small" onClick={() => navigate('/screens')}>
                    Manage Screens
                </Button>
            </Box>

            {/* Summary Stats */}
            <Grid container spacing={2} sx={{ mb: 3 }}>
                <Grid size={{ xs: 4 }}>
                    <Box
                        sx={{
                            textAlign: 'center',
                            p: 2,
                            bgcolor: 'success.lighter',
                            borderRadius: 2,
                        }}
                    >
                        <Typography variant="h4" color="success.dark" fontWeight="bold">
                            {onlineCount}
                        </Typography>
                        <Typography variant="body2" color="success.dark">
                            Online
                        </Typography>
                    </Box>
                </Grid>
                <Grid size={{ xs: 4 }}>
                    <Box
                        sx={{
                            textAlign: 'center',
                            p: 2,
                            bgcolor: 'error.lighter',
                            borderRadius: 2,
                        }}
                    >
                        <Typography variant="h4" color="error.dark" fontWeight="bold">
                            {offlineCount}
                        </Typography>
                        <Typography variant="body2" color="error.dark">
                            Offline
                        </Typography>
                    </Box>
                </Grid>
                <Grid size={{ xs: 4 }}>
                    <Box
                        sx={{
                            textAlign: 'center',
                            p: 2,
                            bgcolor: 'warning.lighter',
                            borderRadius: 2,
                        }}
                    >
                        <Typography variant="h4" color="warning.dark" fontWeight="bold">
                            {maintenanceCount}
                        </Typography>
                        <Typography variant="body2" color="warning.dark">
                            Maintenance
                        </Typography>
                    </Box>
                </Grid>
            </Grid>

            {/* Screen Grid */}
            {totalScreens === 0 ? (
                <Box textAlign="center" py={4}>
                    <ScreenIcon sx={{ fontSize: 48, color: 'text.disabled', mb: 1 }} />
                    <Typography color="text.secondary">No screens registered yet</Typography>
                    <Button
                        variant="contained"
                        sx={{ mt: 2 }}
                        onClick={() => navigate('/screens/new')}
                    >
                        Add Your First Screen
                    </Button>
                </Box>
            ) : (
                <Grid container spacing={1}>
                    {screens?.slice(0, 8).map((screen) => (
                        <Grid key={screen.id} size={{ xs: 6, sm: 3 }}>
                            <Box
                                sx={{
                                    p: 1.5,
                                    border: '1px solid',
                                    borderColor: 'divider',
                                    borderRadius: 2,
                                    cursor: 'pointer',
                                    transition: 'all 0.2s',
                                    '&:hover': {
                                        borderColor: 'primary.main',
                                        bgcolor: 'action.hover',
                                    },
                                }}
                                onClick={() => navigate(`/screens/${screen.id}`)}
                            >
                                <Box display="flex" alignItems="center" gap={0.5} mb={0.5}>
                                    {getStatusIcon(screen)}
                                    <Typography
                                        variant="body2"
                                        fontWeight="medium"
                                        noWrap
                                        sx={{ maxWidth: '80%' }}
                                    >
                                        {screen.name}
                                    </Typography>
                                </Box>
                                <Typography variant="caption" color="text.secondary">
                                    {screen.location.city}
                                </Typography>
                            </Box>
                        </Grid>
                    ))}
                </Grid>
            )}

            {totalScreens > 8 && (
                <Box textAlign="center" mt={2}>
                    <Button size="small" onClick={() => navigate('/screens')}>
                        View All {totalScreens} Screens
                    </Button>
                </Box>
            )}
        </Paper>
    );
}
