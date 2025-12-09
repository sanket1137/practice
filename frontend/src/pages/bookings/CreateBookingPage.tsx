import { useMemo } from 'react';
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
} from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSnackbar } from 'notistack';
import { api } from '../../services/api';

const bookingSchema = z.object({
    campaignId: z.string().min(1, 'Campaign is required'),
    creativeId: z.string().min(1, 'Creative is required'),
    screenId: z.string().min(1, 'Screen is required'),
    startDate: z.date(),
    endDate: z.date(),
}).refine((data) => data.endDate > data.startDate, {
    message: 'End date must be after start date',
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
            startDate: new Date(),
            endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
        },
    });

    const selectedCampaignId = watch('campaignId');
    const selectedScreenId = watch('screenId');
    const startDate = watch('startDate');
    const endDate = watch('endDate');

    // Fetch campaigns
    const { data: campaigns } = useQuery<Campaign[]>({
        queryKey: ['campaigns'],
        queryFn: async () => {
            const response = await api.get('/campaigns');
            return response.data.data; // ApiResponse wrapper
        },
    });

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

    // Calculate booking impressions and price
    const calculation = useMemo(() => {
        if (!selectedScreenDetails || !startDate || !endDate) return null;

        const parseTime = (timeStr: string) => {
            const [hours, minutes] = timeStr.split(':').map(Number);
            return hours * 60 + minutes;
        };

        let totalImpressions = 0;
        let operatingDays = 0;
        const breakdown: Array<{ date: Date; day: string; hours: number; plays: number }> = [];

        const current = new Date(startDate);
        const end = new Date(endDate);

        while (current <= end) {
            const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
            const dayName = dayNames[current.getDay()] as keyof typeof selectedScreenDetails.schedule;
            const daySchedule = selectedScreenDetails.schedule[dayName];

            if (daySchedule?.isOperating) {
                const startMin = parseTime(daySchedule.startTime);
                const endMin = parseTime(daySchedule.endTime);
                const operatingMinutes = endMin - startMin;
                const frames = Math.floor(operatingMinutes / selectedScreenDetails.timeFrameMinutes);

                operatingDays++;
                totalImpressions += frames;

                breakdown.push({
                    date: new Date(current),
                    day: dayName,
                    hours: operatingMinutes / 60,
                    plays: frames,
                });
            }

            current.setDate(current.getDate() + 1);
        }

        const totalDays = Math.floor((end.getTime() - new Date(startDate).getTime()) / (1000 * 60 * 60 * 24)) + 1;
        const totalPrice = selectedScreenDetails.pricePerSlot * operatingDays;

        return {
            totalDays,
            operatingDays,
            totalImpressions,
            totalPrice,
            breakdown,
        };
    }, [selectedScreenDetails, startDate, endDate]);

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

    const onSubmit = (data: BookingFormData) => {
        createMutation.mutate(data);
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
                                                {campaigns?.map((campaign) => (
                                                    <MenuItem key={campaign.id} value={campaign.id}>
                                                        {campaign.name}
                                                    </MenuItem>
                                                ))}
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
                                                {creatives?.map((creative) => (
                                                    <MenuItem key={creative.id} value={creative.id}>
                                                        {creative.name}
                                                    </MenuItem>
                                                ))}
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
                                                {screens?.map((screen) => (
                                                    <MenuItem key={screen.id} value={screen.id}>
                                                        {screen.name} - {screen.currency} {screen.pricePerSlot}/slot
                                                    </MenuItem>
                                                ))}
                                            </TextField>
                                        )}
                                    />
                                </Grid>

                                {/* Start Date */}
                                <Grid item xs={12} sm={6}>
                                    <LocalizationProvider dateAdapter={AdapterDateFns}>
                                        <Controller
                                            name="startDate"
                                            control={control}
                                            render={({ field }) => (
                                                <DatePicker
                                                    {...field}
                                                    label="Start Date"
                                                    slotProps={{
                                                        textField: {
                                                            fullWidth: true,
                                                            error: !!errors.startDate,
                                                            helperText: errors.startDate?.message,
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
                                            {createMutation.isPending ? 'Creating...' : 'Create Booking'}
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
                                            ({selectedScreenDetails?.pricePerSlot}/day × {calculation.operatingDays} days)
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
        </Container>
    );
}
