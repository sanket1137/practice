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
} from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useSnackbar } from 'notistack';
import { api } from '../../services/api';

const campaignSchema = z.object({
    name: z.string().min(3, 'Name must be at least 3 characters'),
    description: z.string().min(10, 'Description must be at least 10 characters'),
    budget: z.number().min(1, 'Budget must be greater than 0'),
    currency: z.string().min(1, 'Currency is required'),
    startDate: z.date(),
    endDate: z.date(),
    status: z.enum(['Draft', 'Active', 'Paused', 'Completed']),
}).refine((data) => data.endDate > data.startDate, {
    message: 'End date must be after start date',
    path: ['endDate'],
});

type CampaignFormData = z.infer<typeof campaignSchema>;

export default function CreateCampaignPage() {
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const { enqueueSnackbar } = useSnackbar();

    const {
        control,
        handleSubmit,
        formState: { errors },
    } = useForm<CampaignFormData>({
        resolver: zodResolver(campaignSchema),
        defaultValues: {
            name: '',
            description: '',
            budget: 0,
            currency: 'USD',
            startDate: new Date(),
            endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
            status: 'Draft',
        },
    });

    const createMutation = useMutation({
        mutationFn: async (data: CampaignFormData) => {
            const response = await api.post('/campaigns', data);
            return response.data.data; // ApiResponse wrapper
        },
        onSuccess: (data) => {
            queryClient.invalidateQueries({ queryKey: ['campaigns'] });
            enqueueSnackbar('Campaign created successfully', { variant: 'success' });
            navigate(`/campaigns/${data.id}`);
        },
        onError: (error: any) => {
            enqueueSnackbar(
                error.response?.data?.message || 'Failed to create campaign',
                { variant: 'error' }
            );
        },
    });

    const onSubmit = (data: CampaignFormData) => {
        createMutation.mutate(data);
    };

    return (
        <Container maxWidth="md" sx={{ mt: 4, mb: 4 }}>
            <Box mb={3}>
                <Typography variant="h4" gutterBottom>
                    Create New Campaign
                </Typography>
                <Typography variant="body1" color="textSecondary">
                    Set up your advertising campaign details
                </Typography>
            </Box>
            <Paper sx={{ p: 4 }}>
                <form onSubmit={handleSubmit(onSubmit)}>
                    <Grid container spacing={3}>
                        {/* Campaign Name */}
                        <Grid size={12}>
                            <Controller
                                name="name"
                                control={control}
                                render={({ field }) => (
                                    <TextField
                                        {...field}
                                        fullWidth
                                        label="Campaign Name"
                                        error={!!errors.name}
                                        helperText={errors.name?.message}
                                        required
                                    />
                                )}
                            />
                        </Grid>

                        {/* Description */}
                        <Grid size={12}>
                            <Controller
                                name="description"
                                control={control}
                                render={({ field }) => (
                                    <TextField
                                        {...field}
                                        fullWidth
                                        label="Description"
                                        multiline
                                        rows={4}
                                        error={!!errors.description}
                                        helperText={errors.description?.message}
                                        required
                                    />
                                )}
                            />
                        </Grid>

                        {/* Budget */}
                        <Grid
                            size={{
                                xs: 12,
                                sm: 6
                            }}>
                            <Controller
                                name="budget"
                                control={control}
                                render={({ field: { onChange, value, ...field } }) => (
                                    <TextField
                                        {...field}
                                        fullWidth
                                        label="Budget"
                                        type="number"
                                        value={value}
                                        onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
                                        error={!!errors.budget}
                                        helperText={errors.budget?.message}
                                        required
                                    />
                                )}
                            />
                        </Grid>

                        {/* Currency */}
                        <Grid
                            size={{
                                xs: 12,
                                sm: 6
                            }}>
                            <Controller
                                name="currency"
                                control={control}
                                render={({ field }) => (
                                    <TextField
                                        {...field}
                                        fullWidth
                                        select
                                        label="Currency"
                                        error={!!errors.currency}
                                        helperText={errors.currency?.message}
                                        required
                                    >
                                        <MenuItem value="USD">USD</MenuItem>
                                        <MenuItem value="EUR">EUR</MenuItem>
                                        <MenuItem value="GBP">GBP</MenuItem>
                                        <MenuItem value="INR">INR</MenuItem>
                                    </TextField>
                                )}
                            />
                        </Grid>

                        {/* Start Date */}
                        <Grid
                            size={{
                                xs: 12,
                                sm: 6
                            }}>
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
                        <Grid
                            size={{
                                xs: 12,
                                sm: 6
                            }}>
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

                        {/* Status */}
                        <Grid size={12}>
                            <Controller
                                name="status"
                                control={control}
                                render={({ field }) => (
                                    <TextField
                                        {...field}
                                        fullWidth
                                        select
                                        label="Status"
                                        error={!!errors.status}
                                        helperText={errors.status?.message}
                                        required
                                    >
                                        <MenuItem value="Draft">Draft</MenuItem>
                                        <MenuItem value="Active">Active</MenuItem>
                                        <MenuItem value="Paused">Paused</MenuItem>
                                        <MenuItem value="Completed">Completed</MenuItem>
                                    </TextField>
                                )}
                            />
                        </Grid>

                        {/* Actions */}
                        <Grid size={12}>
                            <Box display="flex" gap={2} justifyContent="flex-end">
                                <Button
                                    variant="outlined"
                                    onClick={() => navigate('/campaigns')}
                                    disabled={createMutation.isPending}
                                >
                                    Cancel
                                </Button>
                                <Button
                                    type="submit"
                                    variant="contained"
                                    disabled={createMutation.isPending}
                                >
                                    {createMutation.isPending ? 'Creating...' : 'Create Campaign'}
                                </Button>
                            </Box>
                        </Grid>
                    </Grid>
                </form>
            </Paper>
        </Container>
    );
}
