import React from 'react';
import { Box, Typography, Grid, Paper } from '@mui/material';
import { useAuthStore } from '../../store/authStore';

const DashboardPage = () => {
    const user = useAuthStore((state) => state.user);

    return (
        <Box sx={{ p: 3 }}>
            <Typography variant="h4" gutterBottom>
                Welcome back, {user?.firstName}
            </Typography>

            <Grid container spacing={3} sx={{ mt: 2 }}>
                <Grid item xs={12} md={4}>
                    <Paper sx={{ p: 3, height: '100%' }}>
                        <Typography variant="h6" gutterBottom>
                            Role
                        </Typography>
                        <Typography variant="body1" color="text.secondary">
                            {user?.role}
                        </Typography>
                    </Paper>
                </Grid>

                <Grid item xs={12} md={4}>
                    <Paper sx={{ p: 3, height: '100%' }}>
                        <Typography variant="h6" gutterBottom>
                            Status
                        </Typography>
                        <Typography variant="body1" color="success.main">
                            Active
                        </Typography>
                    </Paper>
                </Grid>

                <Grid item xs={12} md={4}>
                    <Paper sx={{ p: 3, height: '100%' }}>
                        <Typography variant="h6" gutterBottom>
                            Quick Actions
                        </Typography>
                        {/* Add quick actions based on role */}
                    </Paper>
                </Grid>
            </Grid>
        </Box>
    );
};

export default DashboardPage;
