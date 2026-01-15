import { useState, useEffect } from 'react';
import {
    Container,
    Paper,
    Typography,
    TextField,
    Button,
    Grid,
    Box,
    MenuItem,
    Alert,
    LinearProgress,
} from '@mui/material';
import { useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import { api } from '../../services/api';
import { useSnackbar } from 'notistack';
import OperatingScheduleForm from '../../components/screens/OperatingScheduleForm';
import TimezoneSelector from '../../components/common/TimezoneSelector';

export default function UpdateScreenPage() {
    const { id } = useParams();
    const navigate = useNavigate();
    const { enqueueSnackbar } = useSnackbar();

    const [formData, setFormData] = useState({
        name: '',
        description: '',
        physicalWidth: '',
        physicalHeight: '',
        resolutionWidth: '',
        resolutionHeight: '',
        street: '',
        city: '',
        state: '',
        country: '',
        postalCode: '',
        latitude: '',
        longitude: '',
        timeFrameMinutes: '',
        slotsPerFrame: '',
        pricePerSlot: '',
        status: 'Active',
        timezone: 'UTC',
    });

    const [schedule, setSchedule] = useState({
        monday: { isOperating: true, startTime: '09:00', endTime: '22:00' },
        tuesday: { isOperating: true, startTime: '09:00', endTime: '22:00' },
        wednesday: { isOperating: true, startTime: '09:00', endTime: '22:00' },
        thursday: { isOperating: true, startTime: '09:00', endTime: '22:00' },
        friday: { isOperating: true, startTime: '09:00', endTime: '22:00' },
        saturday: { isOperating: true, startTime: '10:00', endTime: '22:00' },
        sunday: { isOperating: true, startTime: '10:00', endTime: '21:00' },
    });

    // Fetch existing screen data
    const { data: screen, isLoading } = useQuery({
        queryKey: ['screen', id],
        queryFn: async () => {
            const response = await api.get(`/screens/${id}`);
            return response.data.data;
        },
    });

    // Pre-populate form when screen data loads
    useEffect(() => {
        if (screen) {
            setFormData({
                name: screen.name || '',
                description: screen.description || '',
                physicalWidth: screen.physicalWidth?.toString() || '',
                physicalHeight: screen.physicalHeight?.toString() || '',
                resolutionWidth: screen.resolutionWidth?.toString() || '',
                resolutionHeight: screen.resolutionHeight?.toString() || '',
                street: screen.location?.street || '',
                city: screen.location?.city || '',
                state: screen.location?.state || '',
                country: screen.location?.country || '',
                postalCode: screen.location?.postalCode || '',
                latitude: screen.latitude?.toString() || '',
                longitude: screen.longitude?.toString() || '',
                timeFrameMinutes: screen.timeFrameMinutes?.toString() || '',
                slotsPerFrame: screen.slotsPerFrame?.toString() || '',
                pricePerSlot: screen.pricePerSlot?.toString() || '',
                status: screen.status || 'Active',
                timezone: screen.timezone || 'UTC',
            });

            if (screen.schedule) {
                setSchedule(screen.schedule);
            }
        }
    }, [screen]);

    const updateScreenMutation = useMutation({
        mutationFn: async (data: any) => {
            const response = await api.put(`/screens/${id}`, {
                name: data.name,
                description: data.description,
                physicalWidth: data.physicalWidth ? parseFloat(data.physicalWidth) : undefined,
                physicalHeight: data.physicalHeight ? parseFloat(data.physicalHeight) : undefined,
                resolutionWidth: data.resolutionWidth ? parseInt(data.resolutionWidth) : undefined,
                resolutionHeight: data.resolutionHeight ? parseInt(data.resolutionHeight) : undefined,
                location: {
                    street: data.street,
                    city: data.city,
                    state: data.state,
                    country: data.country,
                    postalCode: data.postalCode,
                },
                latitude: data.latitude ? parseFloat(data.latitude) : undefined,
                longitude: data.longitude ? parseFloat(data.longitude) : undefined,
                schedule: data.schedule,
                timeFrameMinutes: data.timeFrameMinutes ? parseInt(data.timeFrameMinutes) : undefined,
                slotsPerFrame: data.slotsPerFrame ? parseInt(data.slotsPerFrame) : undefined,
                pricePerSlot: data.pricePerSlot ? parseFloat(data.pricePerSlot) : undefined,
                status: data.status,
                timezone: data.timezone,
            });
            return response.data;
        },
        onSuccess: () => {
            enqueueSnackbar('Screen updated successfully', { variant: 'success' });
            navigate(`/screens/${id}`);
        },
        onError: (error: any) => {
            enqueueSnackbar(error.response?.data?.message || 'Failed to update screen', { variant: 'error' });
        },
    });

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setFormData({
            ...formData,
            [e.target.name]: e.target.value,
        });
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        updateScreenMutation.mutate({ ...formData, schedule });
    };

    if (isLoading) {
        return (
            <Container maxWidth="lg" sx={{ mt: 4 }}>
                <LinearProgress />
                <Typography sx={{ mt: 2 }}>Loading screen details...</Typography>
            </Container>
        );
    }

    return (
        <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
            <Paper sx={{ p: 4 }}>
                <Typography variant="h4" gutterBottom>
                    Edit Screen
                </Typography>
                <Typography variant="body2" color="textSecondary" paragraph>
                    Update screen details below. Changes will be saved immediately.
                </Typography>

                <Box component="form" onSubmit={handleSubmit} sx={{ mt: 3 }}>
                    <Grid container spacing={3}>
                        {/* Basic Information */}
                        <Grid item xs={12}>
                            <Typography variant="h6" gutterBottom>
                                Basic Information
                            </Typography>
                        </Grid>
                        <Grid item xs={12}>
                            <TextField
                                fullWidth
                                name="name"
                                label="Screen Name"
                                value={formData.name}
                                onChange={handleChange}
                            />
                        </Grid>
                        <Grid item xs={12}>
                            <TextField
                                fullWidth
                                multiline
                                rows={3}
                                name="description"
                                label="Description"
                                value={formData.description}
                                onChange={handleChange}
                            />
                        </Grid>

                        {/* Resolution */}
                        <Grid item xs={12}>
                            <Typography variant="h6" gutterBottom sx={{ mt: 2 }}>
                                Screen Resolution
                            </Typography>
                        </Grid>
                        <Grid item xs={12} sm={6}>
                            <TextField
                                fullWidth
                                type="number"
                                name="resolutionWidth"
                                label="Resolution Width (px)"
                                value={formData.resolutionWidth}
                                onChange={handleChange}
                            />
                        </Grid>
                        <Grid item xs={12} sm={6}>
                            <TextField
                                fullWidth
                                type="number"
                                name="resolutionHeight"
                                label="Resolution Height (px)"
                                value={formData.resolutionHeight}
                                onChange={handleChange}
                            />
                        </Grid>

                        {/* Location */}
                        <Grid item xs={12}>
                            <Typography variant="h6" gutterBottom sx={{ mt: 2 }}>
                                Location
                            </Typography>
                        </Grid>
                        <Grid item xs={12}>
                            <TextField
                                fullWidth
                                name="street"
                                label="Street Address"
                                value={formData.street}
                                onChange={handleChange}
                            />
                        </Grid>
                        <Grid item xs={12} sm={6}>
                            <TextField
                                fullWidth
                                name="city"
                                label="City"
                                value={formData.city}
                                onChange={handleChange}
                            />
                        </Grid>
                        <Grid item xs={12} sm={6}>
                            <TextField
                                fullWidth
                                name="state"
                                label="State"
                                value={formData.state}
                                onChange={handleChange}
                            />
                        </Grid>

                        {/* Slot Configuration & Pricing */}
                        <Grid item xs={12}>
                            <Typography variant="h6" gutterBottom sx={{ mt: 2 }}>
                                Slot Configuration & Pricing
                            </Typography>
                        </Grid>
                        <Grid item xs={12} sm={4}>
                            <TextField
                                fullWidth
                                type="number"
                                name="timeFrameMinutes"
                                label="Time Frame (minutes)"
                                value={formData.timeFrameMinutes}
                                onChange={handleChange}
                                helperText="Duration of one ad cycle"
                            />
                        </Grid>
                        <Grid item xs={12} sm={4}>
                            <TextField
                                fullWidth
                                type="number"
                                name="slotsPerFrame"
                                label="Slots Per Frame"
                                value={formData.slotsPerFrame}
                                onChange={handleChange}
                                helperText="Number of ads per cycle"
                            />
                        </Grid>
                        <Grid item xs={12} sm={4}>
                            <TextField
                                fullWidth
                                type="number"
                                name="pricePerSlot"
                                label="Price Per Slot"
                                value={formData.pricePerSlot}
                                onChange={handleChange}
                                inputProps={{ step: '0.01' }}
                            />
                        </Grid>

                        {/* Status */}
                        <Grid item xs={12} sm={6}>
                            <TextField
                                select
                                fullWidth
                                name="status"
                                label="Status"
                                value={formData.status}
                                onChange={handleChange}
                            >
                                <MenuItem value="Active">Active</MenuItem>
                                <MenuItem value="Inactive">Inactive</MenuItem>
                                <MenuItem value="Maintenance">Maintenance</MenuItem>
                            </TextField>
                        </Grid>

                        {/* Timezone Selection */}
                        <Grid item xs={12}>
                            <Typography variant="h6" gutterBottom sx={{ mt: 2 }}>
                                Timezone
                            </Typography>
                        </Grid>
                        <Grid item xs={12}>
                            <TimezoneSelector
                                value={formData.timezone}
                                onChange={(timezone) => setFormData({ ...formData, timezone })}
                                helperText="Operating hours are interpreted in this timezone"
                            />
                        </Grid>

                        {/* Operating Schedule */}
                        <Grid item xs={12} sx={{ mt: 2 }}>
                            <OperatingScheduleForm
                                schedule={schedule}
                                onChange={setSchedule}
                            />
                        </Grid>

                        {/* Actions */}
                        <Grid item xs={12}>
                            <Box display="flex" gap={2} justifyContent="flex-end" sx={{ mt: 3 }}>
                                <Button
                                    variant="outlined"
                                    onClick={() => navigate(`/screens/${id}`)}
                                >
                                    Cancel
                                </Button>
                                <Button
                                    type="submit"
                                    variant="contained"
                                    disabled={updateScreenMutation.isPending}
                                >
                                    {updateScreenMutation.isPending ? 'Saving...' : 'Save Changes'}
                                </Button>
                            </Box>
                        </Grid>

                        {updateScreenMutation.isError && (
                            <Grid item xs={12}>
                                <Alert severity="error">
                                    Error updating screen. Please try again.
                                </Alert>
                            </Grid>
                        )}
                    </Grid>
                </Box>
            </Paper>
        </Container>
    );
}
