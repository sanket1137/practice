import { useEffect } from 'react';
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
    LinearProgress,
} from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSnackbar } from 'notistack';
import { api } from '../../services/api';

const campaignSchema = z.object({
    name: z.string().min(1, 'Name is required'),
    description: z.string().min(1, 'Description is required'),
    startDate: z.date(),
    endDate: z.date(),
    budget: z.number().min(0, 'Budget must be positive'),
    currency: z.string().min(1, 'Currency is required'),
    status: z.enum(['Draft', 'Active', 'Paused', 'Completed']),
}).refine((data) => data.endDate > data.startDate, {
    message: 'End date must be after start date',
    path: ['endDate'],
});

type CampaignFormData = z.infer<typeof campaignSchema>;

export default function EditCampaignPage() {
    const { id } = useParams();
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const { enqueueSnackbar } = useSnackbar();

    const {
        control,
        handleSubmit,
        formState: { errors },
        reset,
    } = useForm<CampaignFormData>({
        resolver: zodResolver(campaignSchema),
        defaultValues: {
            name: '',
            description: '',
            startDate: new Date(),
            endDate: new Date(),
            budget: 0,
            currency: 'USD',
            status: 'Draft',
        },
    });

    // Fetch campaign details
    const { data: campaign, isLoading } = useQuery({
        queryKey: ['campaign', id],
        queryFn: async () => {
            const response = await api.get(`/campaigns/${id}`);
            return response.data.data;
        },
    });

    // Populate form when campaign data loads
    useEffect(() => {
        if (campaign) {
            reset({
                name: campaign.name,
                description: campaign.description,
                startDate: new Date(campaign.startDate),
                endDate: new Date(campaign.endDate),
                budget: campaign.budget,
                currency: campaign.currency,
                status: campaign.status,
            });
        }
    }, [campaign, reset]);

    const updateMutation = useMutation({
        mutationFn: async (data: CampaignFormData) => {
            const response = await api.put(`/campaigns/${id}`, data);
            return response.data.data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['campaigns'] });
            queryClient.invalidateQueries({ queryKey: ['campaign', id] });
            enqueueSnackbar('Campaign updated successfully', { variant: 'success' });
            navigate(`/campaigns/${id}`);
        },
        onError: (error: any) => {
            enqueueSnackbar(
                error.response?.data?.message || 'Failed to update campaign',
                { variant: 'error' }
            );
        },
    });

    const onSubmit = (data: CampaignFormData) => {
        updateMutation.mutate(data);
    };

    if (isLoading) {
        return (
            <Container maxWidth="md" sx={{ mt: 4 }}>
                <LinearProgress />
            </Container>
        );
    }

    if (!campaign) {
        return (
            <Container maxWidth="md" sx={{ mt: 4 }}>
                <Typography>Campaign not found</Typography>
            </Container>
        );
    }

    return (
        <Container maxWidth="md" sx={{ mt: 4, mb: 4 }}>
            <Box mb={3}>
                <Typography variant="h4" gutterBottom>
                    Edit Campaign
                </Typography>
                <Typography variant="body1" color="textSecondary">
                    Update your campaign details
                </Typography>
            </Box>
            <Paper sx={{ p: 4 }}>
                <form onSubmit={handleSubmit(onSubmit)}>
                    <Grid container spacing={3}>
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

                        <Grid size={12}>
                            <Controller
                                name="description"
                                control={control}
                                render={({ field }) => (
                                    <TextField
                                        {...field}
                                        fullWidth
                                        multiline
                                        rows={4}
                                        label="Description"
                                        error={!!errors.description}
                                        helperText={errors.description?.message}
                                        required
                                    />
                                )}
                            />
                        </Grid>

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
                                        onChange={(e) => onChange(parseFloat(e.target.value))}
                                        error={!!errors.budget}
                                        helperText={errors.budget?.message}
                                        required
                                    />
                                )}
                            />
                        </Grid>

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
                                        label="Currency"
                                        error={!!errors.currency}
                                        helperText={errors.currency?.message}
                                        required
                                    />
                                )}
                            />
                        </Grid>

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

                        <Grid size={12}>
                            <Box display="flex" gap={2} justifyContent="flex-end">
                                <Button
                                    variant="outlined"
                                    onClick={() => navigate(`/campaigns/${id}`)}
                                    disabled={updateMutation.isPending}
                                >
                                    Cancel
                                </Button>
                                <Button
                                    type="submit"
                                    variant="contained"
                                    disabled={updateMutation.isPending}
                                >
                                    {updateMutation.isPending ? 'Updating...' : 'Update Campaign'}
                                </Button>
                            </Box>
                        </Grid>
                    </Grid>
                </form>
            </Paper>
        </Container>
    );
}
