import { useMemo, useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
    Box,
    Container,
    Typography,
    Paper,
    TextField,
    Button,
    Grid,
    MenuItem,
    Card,
    CardContent,
    Divider,
    CircularProgress,
} from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSnackbar } from 'notistack';
import { api } from '../../services/api';
import SlotAvailabilityCard from '../../components/bookings/SlotAvailabilityCard';
import BookingConfirmationDialog from '../../components/bookings/BookingConfirmationDialog';

// Define type directly to avoid import issues
interface BookingDateBreakdown {
    requestedDates: string[];
    availableDates: string[];
    unavailableDates: string[];
    totalRequested: number;
    totalAvailable: number;
    totalUnavailable: number;
    isPartialBooking: boolean;
}

// Calculate tomorrow's date for validation
const getTomorrow = () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    return tomorrow;
};

const bookingSchema = z.object({
    campaignId: z.string().min(1, 'Campaign is required'),
    creativeId: z.string().min(1, 'Creative is required'),
    screenId: z.string().min(1, 'Screen is required'),
    startDate: z.date().refine((date) => {
        const tomorrow = getTomorrow();
        return date >= tomorrow;
    }, {
        message: 'Booking start date must be at least tomorrow. Same-day bookings are not allowed.',
    }),
    endDate: z.date(),
}).refine((data) => data.endDate >= data.startDate, {
    message: 'End date must be greater than or equal to start date',
    path: ['endDate'],
});

type BookingFormData = z.infer<typeof bookingSchema>;

interface Campaign {
    id: string;
    name: string;
}

interface Creative {
    id: string;
    name: string;
}

interface Screen {
    id: string;
    name: string;
    pricePerSlot: number;
    currency: string;
    timeFrameMinutes: number;
    schedule: {
        monday: DaySchedule;
        tuesday: DaySchedule;
        wednesday: DaySchedule;
        thursday: DaySchedule;
        friday: DaySchedule;
        saturday: DaySchedule;
        sunday: DaySchedule;
    };
}

interface DaySchedule {
    isOperating: boolean;
    startTime: string;
    endTime: string;
}

export default function CreateBookingPage() {
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const { enqueueSnackbar } = useSnackbar();
    const [searchParams] = useSearchParams();
    const preSelectedScreenId = searchParams.get('screenId');
    const preSelectedCampaignId = searchParams.get('campaignId');

    const {
        control,
        handleSubmit,
        formState: { errors },
        watch,
    } = useForm<BookingFormData>({
        resolver: zodResolver(bookingSchema),
        defaultValues: {
            campaignId: preSelectedCampaignId || '',
            creativeId: '',
            screenId: preSelectedScreenId || '',
            startDate: getTomorrow(), // Start from tomorrow
            endDate: new Date(Date.now() + 8 * 24 * 60 * 60 * 1000), // 8 days from now (tomorrow + 7 days)
        },
    });

    const selectedCampaignId = watch('campaignId');
    const selectedScreenId = watch('screenId');
    const startDate = watch('startDate');
    const endDate = watch('endDate');

    // Fetch campaigns
    const { data: campaigns, error: campaignsError, isLoading: campaignsLoading } = useQuery<Campaign[]>({
        queryKey: ['campaigns'],
        queryFn: async () => {
            const response = await api.get('/campaigns');
            console.log('Campaigns API response:', response.data);
            return response.data.data; // ApiResponse wrapper
        },
    });

    // Log campaigns for debugging
    console.log('Campaigns data:', campaigns);
    console.log('Campaigns error:', campaignsError);
    console.log('Campaigns loading:', campaignsLoading);

    // Fetch creatives for selected campaign
    const { data: creatives } = useQuery<Creative[]>({
        queryKey: ['creatives', selectedCampaignId],
        queryFn: async () => {
            const response = await api.get(`/campaigns/${selectedCampaignId}/creatives`);
            return response.data.data; // ApiResponse wrapper
        },
        enabled: !!selectedCampaignId,
    });

    // Fetch screens (list)
    const { data: screens } = useQuery<Screen[]>({
        queryKey: ['screens'],
        queryFn: async () => {
            const response = await api.get('/screens');
            return response.data.data; // ApiResponse wrapper
        },
    });

    // Fetch full screen details (with schedule)
    const { data: selectedScreenDetails } = useQuery<Screen>({
        queryKey: ['screen-details', selectedScreenId],
        queryFn: async () => {
            const response = await api.get(`/screens/${selectedScreenId}`);
            return response.data.data;
        },
        enabled: !!selectedScreenId,
    });

    // Fetch availability data for accurate calculation
    const { data: availabilityData } = useQuery({
        queryKey: ['screen-availability-calc', selectedScreenId, startDate, endDate],
        queryFn: async () => {
            // Format dates in local timezone to avoid UTC offset issues
            const formatDate = (date: Date) => {
                const year = date.getFullYear();
                const month = String(date.getMonth() + 1).padStart(2, '0');
                const day = String(date.getDate()).padStart(2, '0');
                return `${year}-${month}-${day}`;
            };

            const response = await api.get(`/screens/${selectedScreenId}/availability`, {
                params: {
                    startDate: formatDate(startDate!),
                    endDate: formatDate(endDate!),
                },
            });
            return response.data.data;
        },
        enabled: !!selectedScreenId && !!startDate && !!endDate,
    });

    // Calculate booking impressions and price (using availability data)
    const calculation = useMemo(() => {
        if (!selectedScreenDetails || !startDate || !endDate || !availabilityData) return null;

        console.log('=== Booking Calculation ===');
        console.log('Start Date:', startDate);
        console.log('End Date:', endDate);
        console.log('Availability Data:', availabilityData);

        const parseTime = (timeStr: string) => {
            const [hours, minutes] = timeStr.split(':').map(Number);
            return hours * 60 + minutes;
        };

        let totalImpressions = 0;
        let operatingDays = 0;
        let bookableDays = 0;
        const breakdown: Array<{ date: Date; day: string; hours: number; plays: number; available: boolean }> = [];

        const current = new Date(startDate);
        const end = new Date(endDate);

        while (current <= end) {
            const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
            const dayName = dayNames[current.getDay()] as keyof typeof selectedScreenDetails.schedule;
            const daySchedule = selectedScreenDetails.schedule[dayName];

            // Find availability for this specific date (improved date matching)
            const currentDateStr = `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, '0')}-${String(current.getDate()).padStart(2, '0')}`;
            const dayAvailability = availabilityData.availability.find((a: any) => {
                const availDate = a.date.split('T')[0];
                return availDate === currentDateStr;
            });

            console.log('Checking date:', currentDateStr, 'Found availability:', dayAvailability);

            const hasAvailableSlots = dayAvailability && dayAvailability.availableSlots > 0;

            if (daySchedule?.isOperating && hasAvailableSlots) {
                const startMin = parseTime(daySchedule.startTime);
                const endMin = parseTime(daySchedule.endTime);
                const operatingMinutes = endMin - startMin;
                const frames = Math.floor(operatingMinutes / selectedScreenDetails.timeFrameMinutes);

                operatingDays++;
                bookableDays++;
                totalImpressions += frames;

                console.log('Day has availability:', currentDateStr, 'frames:', frames);

                breakdown.push({
                    date: new Date(current),
                    day: dayName,
                    hours: operatingMinutes / 60,
                    plays: frames,
                    available: true,
                });
            } else if (daySchedule?.isOperating) {
                // Operating but sold out
                operatingDays++;
                breakdown.push({
                    date: new Date(current),
                    day: dayName,
                    hours: 0,
                    plays: 0,
                    available: false,
                });
            }

            current.setDate(current.getDate() + 1);
        }

        const totalDays = Math.floor((end.getTime() - new Date(startDate).getTime()) / (1000 * 60 * 60 * 24)) + 1;
        // Per-minute pricing: price per slot × total minutes (impressions)
        // Only charges for bookable days (days with available slots)
        const totalPrice = selectedScreenDetails.pricePerSlot * totalImpressions;

        return {
            totalDays,
            operatingDays,
            bookableDays,  // NEW
            totalImpressions,
            totalPrice,
            breakdown,
        };
    }, [selectedScreenDetails, startDate, endDate, availabilityData]);

    const createMutation = useMutation({
        mutationFn: async (data: BookingFormData) => {
            const response = await api.post('/bookings', data);
            return response.data.data; // ApiResponse wrapper
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['bookings'] });
            enqueueSnackbar('Booking created successfully', { variant: 'success' });
            navigate('/bookings');
        },
        onError: (error: any) => {
            enqueueSnackbar(
                error.response?.data?.message || 'Failed to create booking',
                { variant: 'error' }
            );
        },
    });

    // State for confirmation dialog - REMOVED (no longer needed)
    // Backend will handle slot assignment automatically

    // Format date helper
    const formatDate = (date: Date) => {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    };

    // Submit booking directly - backend auto-assigns available slot
    const onSubmit = (data: BookingFormData) => {
        // Check if there are any available slots based on calculation
        if (!calculation || calculation.bookableDays === 0) {
            enqueueSnackbar(
                'No dates available in the selected range. All slots are sold out.',
                { variant: 'error' }
            );
            return;
        }

        // Format and submit booking - backend will auto-assign an available slot
        const formattedData = {
            ...data,
            startDate: formatDate(data.startDate),
            endDate: formatDate(data.endDate),
        };

        createMutation.mutate(formattedData);
    };

    return (
        <Container maxWidth="md" sx={{ mt: 4, mb: 4 }}>
            <Box mb={3}>
                <Typography variant="h4" gutterBottom>
                    Create New Booking
                </Typography>
                <Typography variant="body1" color="textSecondary">
                    Book a screen for your campaign
                </Typography>
            </Box>

            <Grid container spacing={3}>
                {/* Form */}
                <Grid item xs={12} md={8}>
                    <Paper sx={{ p: 4 }}>
                        <form onSubmit={handleSubmit(onSubmit)}>
                            <Grid container spacing={3}>
                                {/* Campaign */}
                                <Grid item xs={12}>
                                    <Controller
                                        name="campaignId"
                                        control={control}
                                        render={({ field }) => (
                                            <TextField
                                                {...field}
                                                fullWidth
                                                select
                                                label="Campaign"
                                                error={!!errors.campaignId}
                                                helperText={errors.campaignId?.message}
                                                required
                                            >
                                                {!campaigns || campaigns.length === 0 ? (
                                                    <MenuItem value="" disabled>
                                                        No campaigns available
                                                    </MenuItem>
                                                ) : (
                                                    campaigns.map((campaign) => (
                                                        <MenuItem key={campaign.id} value={campaign.id}>
                                                            {campaign.name}
                                                        </MenuItem>
                                                    ))
                                                )}
                                            </TextField>
                                        )}
                                    />
                                </Grid>

                                {/* Creative */}
                                <Grid item xs={12}>
                                    <Controller
                                        name="creativeId"
                                        control={control}
                                        render={({ field }) => (
                                            <TextField
                                                {...field}
                                                fullWidth
                                                select
                                                label="Creative"
                                                error={!!errors.creativeId}
                                                helperText={errors.creativeId?.message}
                                                disabled={!selectedCampaignId}
                                                required
                                            >
                                                {!creatives || creatives.length === 0 ? (
                                                    <MenuItem value="" disabled>
                                                        {selectedCampaignId ? 'No creatives available' : 'Select a campaign first'}
                                                    </MenuItem>
                                                ) : (
                                                    creatives.map((creative) => (
                                                        <MenuItem key={creative.id} value={creative.id}>
                                                            {creative.name}
                                                        </MenuItem>
                                                    ))
                                                )}
                                            </TextField>
                                        )}
                                    />
                                </Grid>

                                {/* Screen */}
                                <Grid item xs={12}>
                                    <Controller
                                        name="screenId"
                                        control={control}
                                        render={({ field }) => (
                                            <TextField
                                                {...field}
                                                fullWidth
                                                select
                                                label="Screen"
                                                error={!!errors.screenId}
                                                helperText={errors.screenId?.message}
                                                required
                                            >
                                                {!screens || screens.length === 0 ? (
                                                    <MenuItem value="" disabled>
                                                        No screens available
                                                    </MenuItem>
                                                ) : (
                                                    screens.map((screen) => (
                                                        <MenuItem key={screen.id} value={screen.id}>
                                                            {screen.name} - {screen.currency} {screen.pricePerSlot}/slot
                                                        </MenuItem>
                                                    ))
                                                )}
                                            </TextField>
                                        )}
                                    />
                                </Grid>

                                {/* Start Date */}
                                <Grid item xs={12} md={6}>
                                    <LocalizationProvider dateAdapter={AdapterDateFns}>
                                        <Controller
                                            name="startDate"
                                            control={control}
                                            render={({ field }) => (
                                                <DatePicker
                                                    {...field}
                                                    label="Start Date"
                                                    minDate={getTomorrow()}
                                                    slotProps={{
                                                        textField: {
                                                            fullWidth: true,
                                                            error: !!errors.startDate,
                                                            helperText: errors.startDate?.message || 'Bookings must start from tomorrow onwards',
                                                            required: true,
                                                        },
                                                    }}
                                                />
                                            )}
                                        />
                                    </LocalizationProvider>
                                </Grid>

                                {/* End Date */}
                                <Grid item xs={12} sm={6}>
                                    <LocalizationProvider dateAdapter={AdapterDateFns}>
                                        <Controller
                                            name="endDate"
                                            control={control}
                                            render={({ field }) => (
                                                <DatePicker
                                                    {...field}
                                                    label="End Date"
                                                    minDate={startDate || getTomorrow()}
                                                    slotProps={{
                                                        textField: {
                                                            fullWidth: true,
                                                            error: !!errors.endDate,
                                                            helperText: errors.endDate?.message,
                                                            required: true,
                                                        },
                                                    }}
                                                />
                                            )}
                                        />
                                    </LocalizationProvider>
                                </Grid>


                                {/* Slot Availability */}
                                {selectedScreenId && startDate && endDate && (
                                    <Grid item xs={12}>
                                        <SlotAvailabilityCard
                                            screenId={selectedScreenId}
                                            startDate={startDate}
                                            endDate={endDate}
                                        />
                                    </Grid>
                                )}

                                {/* Actions */}
                                <Grid item xs={12}>
                                    <Box display="flex" gap={2} justifyContent="flex-end">
                                        <Button
                                            variant="outlined"
                                            onClick={() => navigate('/bookings')}
                                            disabled={createMutation.isPending}
                                        >
                                            Cancel
                                        </Button>
                                        <Button
                                            type="submit"
                                            variant="contained"
                                            disabled={createMutation.isPending}
                                        >
                                            Create Booking
                                        </Button>
                                    </Box>
                                </Grid>
                            </Grid>
                        </form>
                    </Paper>
                </Grid>

                {/* Summary */}
                <Grid item xs={12} md={4}>
                    <Card>
                        <CardContent>
                            <Typography variant="h6" gutterBottom>
                                Booking Summary
                            </Typography>
                            <Divider sx={{ my: 2 }} />
                            {calculation ? (
                                <>
                                    <Box mb={2}>
                                        <Typography variant="body2" color="textSecondary">
                                            Screen
                                        </Typography>
                                        <Typography variant="body1">{selectedScreenDetails?.name}</Typography>
                                    </Box>
                                    <Box mb={2}>
                                        <Typography variant="body2" color="textSecondary">
                                            Total Days
                                        </Typography>
                                        <Typography variant="body1">{calculation.totalDays} days</Typography>
                                    </Box>
                                    <Box mb={2}>
                                        <Typography variant="body2" color="textSecondary">
                                            Operating Days
                                        </Typography>
                                        <Typography variant="body1">{calculation.operatingDays} days</Typography>
                                    </Box>
                                    <Box mb={2}>
                                        <Typography variant="body2" color="textSecondary">
                                            Expected Impressions
                                        </Typography>
                                        <Typography variant="h6" color="primary">
                                            {calculation.totalImpressions.toLocaleString()} plays
                                        </Typography>
                                    </Box>
                                    <Divider sx={{ my: 2 }} />
                                    <Box>
                                        <Typography variant="body2" color="textSecondary">
                                            Total Price
                                        </Typography>
                                        <Typography variant="h5" color="primary">
                                            {selectedScreenDetails?.currency} {calculation.totalPrice.toLocaleString()}
                                        </Typography>
                                        <Typography variant="caption" color="textSecondary">
                                            ({selectedScreenDetails?.currency} {selectedScreenDetails?.pricePerSlot}/minute × {calculation.totalImpressions} minutes)
                                        </Typography>
                                    </Box>
                                </>
                            ) : (
                                <Typography variant="body2" color="textSecondary">
                                    Select screen and dates to see calculation
                                </Typography>
                            )}
                        </CardContent>
                    </Card>
                </Grid>
            </Grid>

            {/* Confirmation dialog removed - booking submits directly */}
        </Container>
    );
}
