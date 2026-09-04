import { useState } from 'react';
import {
    Container,
    Paper,
    Typography,
    TextField,
    Button,
    Grid,
    Box,
    Alert,
    LinearProgress,
    MenuItem,
} from '@mui/material';
import { useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { isAxiosError } from 'axios';
import { api } from '../../services/api';
import { VENUE_TYPE_OPTIONS } from '../../types/screen';
import { useSnackbar } from 'notistack';
import OperatingScheduleForm from '../../components/screens/OperatingScheduleForm';
import TimezoneSelector from '../../components/common/TimezoneSelector';
import ScreenTagsManager from '../../components/screens/ScreenTagsManager';

/**
 * Screen edit form. Renders as a full page at /screens/:id/edit, and also
 * embeds inside the workspace's Settings tab (embedded mode drops the page
 * chrome and stays in place on save instead of navigating away).
 */
export default function UpdateScreenPage({ embedded = false }: { embedded?: boolean }) {
    const { id } = useParams();
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const { enqueueSnackbar } = useSnackbar();

    const [formData, setFormData] = useState({
        name: '',
        description: '',
        venueType: '',
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

    // Pre-populate the (subsequently user-editable) form the first time screen
    // data loads. A state guard + render-time check avoids deriving this in an
    // effect, which would cause an extra render and could stomp user edits if
    // `screen` were ever re-fetched.
    const [prePopulated, setPrePopulated] = useState(false);
    if (screen && !prePopulated) {
        setPrePopulated(true);
        setFormData({
            name: screen.name || '',
            description: screen.description || '',
            venueType: screen.venueType && screen.venueType !== 'Unclassified' ? screen.venueType : '',
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

    const updateScreenMutation = useMutation({
        mutationFn: async (data: typeof formData & { schedule: typeof schedule }) => {
            const response = await api.put(`/screens/${id}`, {
                name: data.name,
                description: data.description,
                venueType: data.venueType || undefined,
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
            queryClient.invalidateQueries({ queryKey: ['screen', id] });
            if (!embedded) navigate(`/screens/${id}`);
        },
        onError: (error: unknown) => {
            const message = isAxiosError(error) ? (error.response?.data as { message?: string } | undefined)?.message : undefined;
            enqueueSnackbar(message || 'Failed to update screen', { variant: 'error' });
        },
    });

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setFormData({
            ...formData,
            [e.target.name]: e.target.value,
        });
    };

    // Calculate ad duration per slot
    const adDurationSeconds = formData.timeFrameMinutes && formData.slotsPerFrame
        ? (parseInt(formData.timeFrameMinutes) * 60) / parseInt(formData.slotsPerFrame)
        : 0;
    const isEvenDivision = adDurationSeconds === 0 || Number.isInteger(adDurationSeconds);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!isEvenDivision) {
            enqueueSnackbar('Frame time must divide evenly by slots — ad duration must be a whole number of seconds.', { variant: 'error' });
            return;
        }
        updateScreenMutation.mutate({ ...formData, schedule });
    };

    if (isLoading) {
        const progress = (
            <>
                <LinearProgress />
                <Typography sx={{ mt: 2 }}>Loading screen details...</Typography>
            </>
        );
        return embedded ? <Box>{progress}</Box> : <Container maxWidth="lg" sx={{ mt: 4 }}>{progress}</Container>;
    }

    const form = (
            <Paper sx={{ p: embedded ? 3 : 4 }} variant={embedded ? 'outlined' : 'elevation'}>
                {!embedded && (
                    <>
                        <Typography variant="h4" gutterBottom>
                            Edit Screen
                        </Typography>
                        <Typography variant="body2" color="textSecondary" paragraph>
                            Update screen details below. Changes will be saved immediately.
                        </Typography>
                    </>
                )}

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
                                fullWidth
                                name="name"
                                label="Screen Name"
                                value={formData.name}
                                onChange={handleChange}
                            />
                        </Grid>
                        <Grid size={12}>
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
                        <Grid size={{ xs: 12, sm: 6 }}>
                            <TextField
                                select
                                fullWidth
                                name="venueType"
                                label="Venue type"
                                value={formData.venueType}
                                onChange={handleChange}
                                helperText="Where the screen is installed — shown to advertisers and in proposals"
                            >
                                {VENUE_TYPE_OPTIONS.map((v) => (
                                    <MenuItem key={v.value} value={v.value}>{v.label}</MenuItem>
                                ))}
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
                                fullWidth
                                name="state"
                                label="State"
                                value={formData.state}
                                onChange={handleChange}
                            />
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
                                fullWidth
                                type="number"
                                name="pricePerSlot"
                                label="Price Per Slot"
                                value={formData.pricePerSlot}
                                onChange={handleChange}
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

                        {/* Status is managed by lifecycle actions (Activate / Pause /
                            Maintenance / Archive) on the screen page — the server
                            enforces verification and device guards there, so a free
                            edit here would just be rejected. */}
                        <Grid
                            size={{
                                xs: 12,
                                sm: 6
                            }}>
                            <TextField
                                fullWidth
                                label="Status"
                                value={formData.status}
                                disabled
                                helperText="Change status with the lifecycle actions on the screen page."
                            />
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
                                helperText="Operating hours are interpreted in this timezone"
                            />
                        </Grid>

                        {/* Operating Schedule */}
                        <Grid sx={{ mt: 2 }} size={12}>
                            <OperatingScheduleForm
                                schedule={schedule}
                                onChange={setSchedule}
                            />
                        </Grid>

                        {/* Screen Tags */}
                        <Grid sx={{ mt: 2 }} size={12}>
                            <Typography variant="h6" gutterBottom>
                                Screen Tags
                            </Typography>
                            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                                Tags help advertisers find your screen. Auto-generated tags are based on nearby points of interest.
                            </Typography>
                            {id && <ScreenTagsManager screenId={id} />}
                        </Grid>

                        {/* Actions */}
                        <Grid size={12}>
                            <Box display="flex" gap={2} justifyContent="flex-end" sx={{ mt: 3 }}>
                                {!embedded && (
                                    <Button
                                        variant="outlined"
                                        onClick={() => navigate(`/screens/${id}`)}
                                    >
                                        Cancel
                                    </Button>
                                )}
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
                            <Grid size={12}>
                                <Alert severity="error">
                                    Error updating screen. Please try again.
                                </Alert>
                            </Grid>
                        )}
                    </Grid>
                </Box>
            </Paper>
    );

    return embedded ? form : <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>{form}</Container>;
}
