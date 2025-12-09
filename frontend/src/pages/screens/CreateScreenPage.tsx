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
} from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { api } from '../../services/api';

export default function CreateScreenPage() {
    const navigate = useNavigate();
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
        country: 'USA',
        postalCode: '',
        latitude: '',
        longitude: '',
        timeFrameMinutes: '1',
        slotsPerFrame: '6',
        deviceId: '',
        pricePerSlot: '',
        currency: 'USD',
    });

    const createScreenMutation = useMutation({
        mutationFn: async (data: any) => {
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
                schedule: {
                    monday: { isOperating: true, startTime: '09:00', endTime: '22:00' },
                    tuesday: { isOperating: true, startTime: '09:00', endTime: '22:00' },
                    wednesday: { isOperating: true, startTime: '09:00', endTime: '22:00' },
                    thursday: { isOperating: true, startTime: '09:00', endTime: '22:00' },
                    friday: { isOperating: true, startTime: '09:00', endTime: '22:00' },
                    saturday: { isOperating: true, startTime: '10:00', endTime: '22:00' },
                    sunday: { isOperating: true, startTime: '10:00', endTime: '21:00' },
                },
                timeFrameMinutes: parseInt(data.timeFrameMinutes),
                slotsPerFrame: parseInt(data.slotsPerFrame),
                deviceId: data.deviceId,
                pricePerSlot: parseFloat(data.pricePerSlot),
                currency: data.currency,
            });
            return response.data;
        },
        onSuccess: () => {
            navigate('/screens');
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
        createScreenMutation.mutate(formData);
    };

    return (
        <Container maxWidth="md" sx={{ mt: 4, mb: 4 }}>
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
                        <Grid item xs={12}>
                            <Typography variant="h6" gutterBottom>
                                Basic Information
                            </Typography>
                        </Grid>
                        <Grid item xs={12}>
                            <TextField
                                required
                                fullWidth
                                name="name"
                                label="Screen Name"
                                value={formData.name}
                                onChange={handleChange}
                            />
                        </Grid>
                        <Grid item xs={12}>
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
                        <Grid item xs={12}>
                            <Typography variant="h6" gutterBottom sx={{ mt: 2 }}>
                                Physical Dimensions
                            </Typography>
                        </Grid>
                        <Grid item xs={12} sm={4}>
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
                        <Grid item xs={12} sm={4}>
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
                        <Grid item xs={12} sm={4}>
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
                        <Grid item xs={12}>
                            <Typography variant="h6" gutterBottom sx={{ mt: 2 }}>
                                Screen Resolution
                            </Typography>
                        </Grid>
                        <Grid item xs={12} sm={6}>
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
                        <Grid item xs={12} sm={6}>
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
                        <Grid item xs={12}>
                            <Typography variant="h6" gutterBottom sx={{ mt: 2 }}>
                                Location
                            </Typography>
                        </Grid>
                        <Grid item xs={12}>
                            <TextField
                                required
                                fullWidth
                                name="street"
                                label="Street Address"
                                value={formData.street}
                                onChange={handleChange}
                            />
                        </Grid>
                        <Grid item xs={12} sm={6}>
                            <TextField
                                required
                                fullWidth
                                name="city"
                                label="City"
                                value={formData.city}
                                onChange={handleChange}
                            />
                        </Grid>
                        <Grid item xs={12} sm={6}>
                            <TextField
                                required
                                fullWidth
                                name="state"
                                label="State"
                                value={formData.state}
                                onChange={handleChange}
                            />
                        </Grid>
                        <Grid item xs={12} sm={6}>
                            <TextField
                                required
                                fullWidth
                                name="country"
                                label="Country"
                                value={formData.country}
                                onChange={handleChange}
                            />
                        </Grid>
                        <Grid item xs={12} sm={6}>
                            <TextField
                                required
                                fullWidth
                                name="postalCode"
                                label="Postal Code"
                                value={formData.postalCode}
                                onChange={handleChange}
                            />
                        </Grid>

                        {/* Technical Details */}
                        <Grid item xs={12}>
                            <Typography variant="h6" gutterBottom sx={{ mt: 2 }}>
                                Technical Details
                            </Typography>
                        </Grid>
                        <Grid item xs={12} sm={6}>
                            <TextField
                                required
                                fullWidth
                                type="number"
                                name="timeFrameMinutes"
                                label="Time Frame (minutes)"
                                value={formData.timeFrameMinutes}
                                onChange={handleChange}
                                helperText="Duration of each advertising cycle"
                            />
                        </Grid>
                        <Grid item xs={12} sm={6}>
                            <TextField
                                required
                                fullWidth
                                type="number"
                                name="slotsPerFrame"
                                label="Slots Per Frame"
                                value={formData.slotsPerFrame}
                                onChange={handleChange}
                                helperText="Number of ads shown per cycle"
                            />
                        </Grid>
                        <Grid item xs={12}>
                            <TextField
                                fullWidth
                                name="deviceId"
                                label="Device ID (optional)"
                                value={formData.deviceId}
                                onChange={handleChange}
                                helperText="ID of the Raspberry Pi or player device"
                            />
                        </Grid>

                        {/* Pricing */}
                        <Grid item xs={12}>
                            <Typography variant="h6" gutterBottom sx={{ mt: 2 }}>
                                Pricing
                            </Typography>
                        </Grid>
                        <Grid item xs={12} sm={8}>
                            <TextField
                                required
                                fullWidth
                                type="number"
                                name="pricePerSlot"
                                label="Price Per Slot"
                                value={formData.pricePerSlot}
                                onChange={handleChange}
                            />
                        </Grid>
                        <Grid item xs={12} sm={4}>
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

                        {/* Actions */}
                        <Grid item xs={12}>
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
                            <Grid item xs={12}>
                                <Typography color="error">
                                    Error creating screen. Please try again.
                                </Typography>
                            </Grid>
                        )}
                    </Grid>
                </Box>
            </Paper>
        </Container>
    );
}
