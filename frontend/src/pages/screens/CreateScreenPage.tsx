import { useState } from 'react';
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
    Tooltip,
    CircularProgress,
} from '@mui/material';
import MyLocationIcon from '@mui/icons-material/MyLocation';
import { useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { useSnackbar } from 'notistack';
import { api } from '../../services/api';
import OperatingScheduleForm from '../../components/screens/OperatingScheduleForm';
import RevenueEstimateCard from '../../components/screens/RevenueEstimateCard';
import { useRevenueCalculation } from '../../hooks/useRevenueCalculation';
import TimezoneSelector from '../../components/common/TimezoneSelector';
import { getBrowserTimezone } from '../../utils/timezone';
import { generateScreenTags } from '../../services/screenTagsService';

export default function CreateScreenPage() {
    const navigate = useNavigate();
    const { enqueueSnackbar } = useSnackbar();
    const [gettingLocation, setGettingLocation] = useState(false);
    const [formData, setFormData] = useState({
        name: '',
        description: '',
        physicalWidth: '',
        physicalHeight: '',
        dimensionUnit: 'feet',
        resolutionWidth: '1920',
        resolutionHeight: '1080',
        street: '',
        city: '',
        state: '',
        country: 'India',
        postalCode: '',
        latitude: '',
        longitude: '',
        timeFrameMinutes: '1',
        slotsPerFrame: '6',
        deviceId: '',
        pricePerSlot: '',
        currency: 'INR',
        timezone: getBrowserTimezone(), // Default to browser timezone
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

    // Calculate revenue estimates in real-time
    const revenueEstimate = useRevenueCalculation({
        timeFrameMinutes: parseInt(formData.timeFrameMinutes) || 1,
        slotsPerFrame: parseInt(formData.slotsPerFrame) || 6,
        pricePerSlot: parseFloat(formData.pricePerSlot) || 0,
        schedule,
    });

    // Calculate ad duration per slot
    const adDurationSeconds = formData.timeFrameMinutes && formData.slotsPerFrame
        ? (parseInt(formData.timeFrameMinutes) * 60) / parseInt(formData.slotsPerFrame)
        : 0;

    const isEvenDivision = adDurationSeconds === 0 || Number.isInteger(adDurationSeconds);

    const createScreenMutation = useMutation({
        mutationFn: async (data: typeof formData & { schedule: typeof schedule }) => {
            const response = await api.post('/screens', {
                name: data.name,
                description: data.description,
                physicalWidth: parseFloat(data.physicalWidth),
                physicalHeight: parseFloat(data.physicalHeight),
                dimensionUnit: data.dimensionUnit,
                resolutionWidth: parseInt(data.resolutionWidth),
                resolutionHeight: parseInt(data.resolutionHeight),
                location: {
                    street: data.street,
                    city: data.city,
                    state: data.state,
                    country: data.country,
                    postalCode: data.postalCode,
                },
                latitude: data.latitude ? parseFloat(data.latitude) : 0,
                longitude: data.longitude ? parseFloat(data.longitude) : 0,
                schedule: data.schedule,
                timeFrameMinutes: parseInt(data.timeFrameMinutes),
                slotsPerFrame: parseInt(data.slotsPerFrame),
                deviceId: data.deviceId,
                pricePerSlot: parseFloat(data.pricePerSlot),
                currency: data.currency,
                timezone: data.timezone,
            });
            return response.data;
        },
        onSuccess: async (response) => {
            // Auto-generate tags if latitude/longitude provided
            const screenId = response.data?.id;
            if (screenId && formData.latitude && formData.longitude) {
                try {
                    enqueueSnackbar('Screen created! Generating tags based on location...', { variant: 'info' });
                    const tagResult = await generateScreenTags(screenId, false);
                    enqueueSnackbar(`Generated ${tagResult.tagsGenerated} tags for your screen!`, { variant: 'success' });
                } catch (error) {
                    console.error('Failed to generate tags:', error);
                    enqueueSnackbar('Screen created but tag generation failed. You can generate tags manually later.', { variant: 'warning' });
                }
            }
            navigate('/screens');
        },
    });

    // Get current location using browser geolocation
    const handleGetCurrentLocation = () => {
        if (!navigator.geolocation) {
            enqueueSnackbar('Geolocation is not supported by your browser', { variant: 'error' });
            return;
        }
        
        setGettingLocation(true);
        navigator.geolocation.getCurrentPosition(
            (position) => {
                setFormData({
                    ...formData,
                    latitude: position.coords.latitude.toFixed(6),
                    longitude: position.coords.longitude.toFixed(6),
                });
                setGettingLocation(false);
                enqueueSnackbar('Location detected successfully!', { variant: 'success' });
            },
            (error) => {
                setGettingLocation(false);
                let message = 'Failed to get location';
                switch (error.code) {
                    case error.PERMISSION_DENIED:
                        message = 'Location permission denied. Please enable location access.';
                        break;
                    case error.POSITION_UNAVAILABLE:
                        message = 'Location information unavailable.';
                        break;
                    case error.TIMEOUT:
                        message = 'Location request timed out.';
                        break;
                }
                enqueueSnackbar(message, { variant: 'error' });
            },
            { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
        );
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setFormData({
            ...formData,
            [e.target.name]: e.target.value,
        });
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!isEvenDivision) {
            enqueueSnackbar('Frame time must divide evenly by slots — ad duration must be a whole number of seconds.', { variant: 'error' });
            return;
        }
        createScreenMutation.mutate({ ...formData, schedule });
    };

    return (
        <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
            <Paper sx={{ p: 4 }}>
                <Typography variant="h4" gutterBottom>
                    Add New Screen
                </Typography>
                <Typography variant="body2" color="textSecondary" paragraph>
                    Fill in the details below to add a new digital screen to your inventory.
                </Typography>

                <Box component="form" onSubmit={handleSubmit} sx={{ mt: 3 }}>
                    <Grid container spacing={3}>
                        {/* Basic Information */}
                        <Grid size={12}>
                            <Typography variant="h6" gutterBottom>
                                Basic Information
                            </Typography>
                        </Grid>
                        <Grid size={12}>
                            <TextField
                                required
                                fullWidth
                                name="name"
                                label="Screen Name"
                                value={formData.name}
                                onChange={handleChange}
                            />
                        </Grid>
                        <Grid size={12}>
                            <TextField
                                required
                                fullWidth
                                multiline
                                rows={3}
                                name="description"
                                label="Description"
                                value={formData.description}
                                onChange={handleChange}
                            />
                        </Grid>

                        {/* Physical Dimensions */}
                        <Grid size={12}>
                            <Typography variant="h6" gutterBottom sx={{ mt: 2 }}>
                                Physical Dimensions
                            </Typography>
                        </Grid>
                        <Grid
                            size={{
                                xs: 12,
                                sm: 4
                            }}>
                            <TextField
                                required
                                fullWidth
                                type="number"
                                name="physicalWidth"
                                label="Width"
                                value={formData.physicalWidth}
                                onChange={handleChange}
                            />
                        </Grid>
                        <Grid
                            size={{
                                xs: 12,
                                sm: 4
                            }}>
                            <TextField
                                required
                                fullWidth
                                type="number"
                                name="physicalHeight"
                                label="Height"
                                value={formData.physicalHeight}
                                onChange={handleChange}
                            />
                        </Grid>
                        <Grid
                            size={{
                                xs: 12,
                                sm: 4
                            }}>
                            <TextField
                                select
                                fullWidth
                                name="dimensionUnit"
                                label="Unit"
                                value={formData.dimensionUnit}
                                onChange={handleChange}
                            >
                                <MenuItem value="feet">Feet</MenuItem>
                                <MenuItem value="meters">Meters</MenuItem>
                            </TextField>
                        </Grid>

                        {/* Resolution */}
                        <Grid size={12}>
                            <Typography variant="h6" gutterBottom sx={{ mt: 2 }}>
                                Screen Resolution
                            </Typography>
                        </Grid>
                        <Grid
                            size={{
                                xs: 12,
                                sm: 6
                            }}>
                            <TextField
                                required
                                fullWidth
                                type="number"
                                name="resolutionWidth"
                                label="Resolution Width (px)"
                                value={formData.resolutionWidth}
                                onChange={handleChange}
                            />
                        </Grid>
                        <Grid
                            size={{
                                xs: 12,
                                sm: 6
                            }}>
                            <TextField
                                required
                                fullWidth
                                type="number"
                                name="resolutionHeight"
                                label="Resolution Height (px)"
                                value={formData.resolutionHeight}
                                onChange={handleChange}
                            />
                        </Grid>

                        {/* Location */}
                        <Grid size={12}>
                            <Typography variant="h6" gutterBottom sx={{ mt: 2 }}>
                                Location
                            </Typography>
                        </Grid>
                        <Grid size={12}>
                            <TextField
                                required
                                fullWidth
                                name="street"
                                label="Street Address"
                                value={formData.street}
                                onChange={handleChange}
                            />
                        </Grid>
                        <Grid
                            size={{
                                xs: 12,
                                sm: 6
                            }}>
                            <TextField
                                required
                                fullWidth
                                name="city"
                                label="City"
                                value={formData.city}
                                onChange={handleChange}
                            />
                        </Grid>
                        <Grid
                            size={{
                                xs: 12,
                                sm: 6
                            }}>
                            <TextField
                                required
                                fullWidth
                                name="state"
                                label="State"
                                value={formData.state}
                                onChange={handleChange}
                            />
                        </Grid>
                        <Grid
                            size={{
                                xs: 12,
                                sm: 6
                            }}>
                            <TextField
                                required
                                fullWidth
                                name="country"
                                label="Country"
                                value={formData.country}
                                onChange={handleChange}
                            />
                        </Grid>
                        <Grid
                            size={{
                                xs: 12,
                                sm: 6
                            }}>
                            <TextField
                                required
                                fullWidth
                                name="postalCode"
                                label="Postal Code"
                                value={formData.postalCode}
                                onChange={handleChange}
                            />
                        </Grid>

                        {/* GPS Coordinates */}
                        <Grid size={12}>
                            <Typography variant="h6" gutterBottom sx={{ mt: 2 }}>
                                GPS Coordinates
                                <Typography variant="caption" color="text.secondary" sx={{ ml: 1 }}>
                                    (Required for auto-tagging)
                                </Typography>
                            </Typography>
                            <Alert severity="info" sx={{ mb: 2 }}>
                                Accurate GPS coordinates help us identify nearby points of interest and automatically tag your screen for better advertiser discovery.
                            </Alert>
                        </Grid>
                        <Grid
                            size={{
                                xs: 12,
                                sm: 5
                            }}>
                            <TextField
                                required
                                fullWidth
                                type="number"
                                name="latitude"
                                label="Latitude"
                                value={formData.latitude}
                                onChange={handleChange}
                                placeholder="e.g., 12.9716"
                                helperText="Range: -90 to 90"
                                inputProps={{ step: 'any', min: -90, max: 90 }}
                            />
                        </Grid>
                        <Grid
                            size={{
                                xs: 12,
                                sm: 5
                            }}>
                            <TextField
                                required
                                fullWidth
                                type="number"
                                name="longitude"
                                label="Longitude"
                                value={formData.longitude}
                                onChange={handleChange}
                                placeholder="e.g., 77.5946"
                                helperText="Range: -180 to 180"
                                inputProps={{ step: 'any', min: -180, max: 180 }}
                            />
                        </Grid>
                        <Grid
                            size={{
                                xs: 12,
                                sm: 2
                            }}
                            sx={{ display: 'flex', alignItems: 'center' }}>
                            <Tooltip title="Use my current location">
                                <span>
                                    <Button
                                        variant="outlined"
                                        fullWidth
                                        onClick={handleGetCurrentLocation}
                                        disabled={gettingLocation}
                                        startIcon={gettingLocation ? <CircularProgress size={20} /> : <MyLocationIcon />}
                                        sx={{ height: 56 }}
                                    >
                                        {gettingLocation ? 'Getting...' : 'Detect'}
                                    </Button>
                                </span>
                            </Tooltip>
                        </Grid>

                        {/* Slot Configuration & Pricing */}
                        <Grid size={12}>
                            <Typography variant="h6" gutterBottom sx={{ mt: 2 }}>
                                Slot Configuration & Pricing
                            </Typography>
                        </Grid>
                        <Grid
                            size={{
                                xs: 12,
                                sm: 4
                            }}>
                            <TextField
                                required
                                fullWidth
                                type="number"
                                name="timeFrameMinutes"
                                label="Time Frame (minutes)"
                                value={formData.timeFrameMinutes}
                                onChange={handleChange}
                                helperText="Duration of one ad cycle"
                            />
                        </Grid>
                        <Grid
                            size={{
                                xs: 12,
                                sm: 4
                            }}>
                            <TextField
                                required
                                fullWidth
                                type="number"
                                name="slotsPerFrame"
                                label="Slots Per Frame"
                                value={formData.slotsPerFrame}
                                onChange={handleChange}
                                helperText="Number of ads per cycle"
                            />
                        </Grid>
                        <Grid
                            size={{
                                xs: 12,
                                sm: 4
                            }}>
                            <TextField
                                required
                                fullWidth
                                type="number"
                                name="pricePerSlot"
                                label="Price Per Slot"
                                value={formData.pricePerSlot}
                                onChange={handleChange}
                                helperText={`${formData.currency} per slot (for one complete ad cycle)`}
                                inputProps={{ step: '0.01' }}
                            />
                        </Grid>

                        {adDurationSeconds > 0 && (
                            <Grid size={12}>
                                <Alert severity={isEvenDivision ? 'info' : 'error'}>
                                    <strong>Ad Duration per Slot:</strong> {adDurationSeconds.toFixed(1)} seconds
                                    {!isEvenDivision && (
                                        <>
                                            <br />
                                            <Typography variant="caption" color="error">
                                                ⚠ Slot duration must be a whole number of seconds. Adjust Time Frame or Slots Per Frame.
                                            </Typography>
                                        </>
                                    )}
                                    <br />
                                    <Typography variant="caption">
                                        Each ad will play for {adDurationSeconds.toFixed(1)} seconds in the {formData.timeFrameMinutes}-minute cycle
                                    </Typography>
                                </Alert>
                            </Grid>
                        )}

                        <Grid
                            size={{
                                xs: 12,
                                sm: 12
                            }}>
                            <TextField
                                select
                                fullWidth
                                name="currency"
                                label="Currency"
                                value={formData.currency}
                                onChange={handleChange}
                            >
                                <MenuItem value="USD">USD</MenuItem>
                                <MenuItem value="EUR">EUR</MenuItem>
                                <MenuItem value="GBP">GBP</MenuItem>
                                <MenuItem value="INR">INR</MenuItem>
                            </TextField>
                        </Grid>

                        {/* Timezone Selection */}
                        <Grid size={12}>
                            <Typography variant="h6" gutterBottom sx={{ mt: 2 }}>
                                Timezone
                            </Typography>
                        </Grid>
                        <Grid size={12}>
                            <TimezoneSelector
                                value={formData.timezone}
                                onChange={(timezone) => setFormData({ ...formData, timezone })}
                                required
                                helperText="Operating hours will be interpreted in this timezone"
                            />
                        </Grid>

                        {/* Operating Schedule */}
                        <Grid sx={{ mt: 2 }} size={12}>
                            <OperatingScheduleForm
                                schedule={schedule}
                                onChange={setSchedule}
                            />
                        </Grid>

                        {/* Device ID */}
                        <Grid sx={{ mt: 2 }} size={12}>
                            <Typography variant="h6" gutterBottom>
                                Device Configuration
                            </Typography>
                        </Grid>
                        <Grid size={12}>
                            <TextField
                                fullWidth
                                name="deviceId"
                                label="Device ID (optional)"
                                value={formData.deviceId}
                                onChange={handleChange}
                                helperText="ID of the Raspberry Pi or player device"
                            />
                        </Grid>

                        {/* Revenue Estimate */}
                        {formData.pricePerSlot && (
                            <Grid size={12}>
                                <RevenueEstimateCard
                                    estimate={revenueEstimate}
                                    currency={formData.currency}
                                />
                            </Grid>
                        )}

                        {/* Actions */}
                        <Grid size={12}>
                            <Box display="flex" gap={2} justifyContent="flex-end" sx={{ mt: 3 }}>
                                <Button
                                    variant="outlined"
                                    onClick={() => navigate('/screens')}
                                >
                                    Cancel
                                </Button>
                                <Button
                                    type="submit"
                                    variant="contained"
                                    disabled={createScreenMutation.isPending}
                                >
                                    {createScreenMutation.isPending ? 'Creating...' : 'Create Screen'}
                                </Button>
                            </Box>
                        </Grid>

                        {createScreenMutation.isError && (
                            <Grid size={12}>
                                <Alert severity="error">
                                    Error creating screen. Please try again.
                                </Alert>
                            </Grid>
                        )}
                    </Grid>
                </Box>
            </Paper>
        </Container>
    );
}
