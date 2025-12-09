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
    Link,
    MenuItem,
    Grid,
} from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { useSnackbar } from 'notistack';
import { api } from '../../services/api';

const registerSchema = z.object({
    email: z.string().email('Invalid email address'),
    password: z.string().min(8, 'Password must be at least 8 characters'),
    confirmPassword: z.string(),
    firstName: z.string().min(2, 'First name must be at least 2 characters'),
    lastName: z.string().min(2, 'Last name must be at least 2 characters'),
    role: z.enum(['Admin', 'ScreenOwner', 'Advertiser']),
}).refine((data) => data.password === data.confirmPassword, {
    message: "Passwords don't match",
    path: ['confirmPassword'],
});

type RegisterFormData = z.infer<typeof registerSchema>;

export default function RegisterPage() {
    const navigate = useNavigate();
    const { enqueueSnackbar } = useSnackbar();

    const {
        control,
        handleSubmit,
        formState: { errors },
    } = useForm<RegisterFormData>({
        resolver: zodResolver(registerSchema),
        defaultValues: {
            email: '',
            password: '',
            confirmPassword: '',
            firstName: '',
            lastName: '',
            role: 'Advertiser',
        },
    });

    const registerMutation = useMutation({
        mutationFn: async (data: Omit<RegisterFormData, 'confirmPassword'>) => {
            const response = await api.post('/auth/register', data);
            return response.data;
        },
        onSuccess: () => {
            enqueueSnackbar('Registration successful! Please login.', { variant: 'success' });
            navigate('/login');
        },
        onError: (error: any) => {
            enqueueSnackbar(
                error.response?.data?.message || 'Registration failed',
                { variant: 'error' }
            );
        },
    });

    const onSubmit = (data: RegisterFormData) => {
        const { confirmPassword, ...registerData } = data;
        registerMutation.mutate(registerData);
    };

    return (
        <Container maxWidth="sm">
            <Box
                sx={{
                    minHeight: '100vh',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                }}
            >
                <Paper elevation={3} sx={{ p: 4, width: '100%' }}>
                    <Typography variant="h4" component="h1" gutterBottom align="center">
                        Create Account
                    </Typography>
                    <Typography variant="body2" color="textSecondary" align="center" paragraph>
                        Sign up for CCMS
                    </Typography>

                    <Box component="form" onSubmit={handleSubmit(onSubmit)} sx={{ mt: 3 }}>
                        <Grid container spacing={2}>
                            <Grid item xs={12} sm={6}>
                                <Controller
                                    name="firstName"
                                    control={control}
                                    render={({ field }) => (
                                        <TextField
                                            {...field}
                                            fullWidth
                                            label="First Name"
                                            error={!!errors.firstName}
                                            helperText={errors.firstName?.message}
                                            required
                                        />
                                    )}
                                />
                            </Grid>
                            <Grid item xs={12} sm={6}>
                                <Controller
                                    name="lastName"
                                    control={control}
                                    render={({ field }) => (
                                        <TextField
                                            {...field}
                                            fullWidth
                                            label="Last Name"
                                            error={!!errors.lastName}
                                            helperText={errors.lastName?.message}
                                            required
                                        />
                                    )}
                                />
                            </Grid>
                            <Grid item xs={12}>
                                <Controller
                                    name="email"
                                    control={control}
                                    render={({ field }) => (
                                        <TextField
                                            {...field}
                                            fullWidth
                                            label="Email Address"
                                            type="email"
                                            error={!!errors.email}
                                            helperText={errors.email?.message}
                                            required
                                        />
                                    )}
                                />
                            </Grid>
                            <Grid item xs={12}>
                                <Controller
                                    name="password"
                                    control={control}
                                    render={({ field }) => (
                                        <TextField
                                            {...field}
                                            fullWidth
                                            label="Password"
                                            type="password"
                                            error={!!errors.password}
                                            helperText={errors.password?.message}
                                            required
                                        />
                                    )}
                                />
                            </Grid>
                            <Grid item xs={12}>
                                <Controller
                                    name="confirmPassword"
                                    control={control}
                                    render={({ field }) => (
                                        <TextField
                                            {...field}
                                            fullWidth
                                            label="Confirm Password"
                                            type="password"
                                            error={!!errors.confirmPassword}
                                            helperText={errors.confirmPassword?.message}
                                            required
                                        />
                                    )}
                                />
                            </Grid>
                            <Grid item xs={12}>
                                <Controller
                                    name="role"
                                    control={control}
                                    render={({ field }) => (
                                        <TextField
                                            {...field}
                                            fullWidth
                                            select
                                            label="Account Type"
                                            error={!!errors.role}
                                            helperText={errors.role?.message || 'Select your account type'}
                                            required
                                        >
                                            <MenuItem value="Advertiser">Advertiser</MenuItem>
                                            <MenuItem value="ScreenOwner">Screen Owner</MenuItem>
                                            <MenuItem value="Admin">Admin</MenuItem>
                                        </TextField>
                                    )}
                                />
                            </Grid>
                        </Grid>

                        <Button
                            type="submit"
                            fullWidth
                            variant="contained"
                            size="large"
                            sx={{ mt: 3 }}
                            disabled={registerMutation.isPending}
                        >
                            {registerMutation.isPending ? 'Creating Account...' : 'Sign Up'}
                        </Button>

                        <Box sx={{ mt: 2, textAlign: 'center' }}>
                            <Typography variant="body2">
                                Already have an account?{' '}
                                <Link
                                    component="button"
                                    variant="body2"
                                    onClick={() => navigate('/login')}
                                    sx={{ cursor: 'pointer' }}
                                >
                                    Sign In
                                </Link>
                            </Typography>
                        </Box>
                    </Box>
                </Paper>
            </Box>
        </Container>
    );
}
