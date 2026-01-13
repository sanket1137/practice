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
    Alert,
    InputAdornment,
    Chip,
} from '@mui/material';
import PhoneIcon from '@mui/icons-material/Phone';
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
    phoneNumber: z.string()
        .min(10, 'Phone number must be 10 digits')
        .max(10, 'Phone number must be 10 digits')
        .regex(/^[6-9]\d{9}$/, 'Enter a valid Indian mobile number'),
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
        getValues,
        formState: { errors },
    } = useForm<RegisterFormData>({
        resolver: zodResolver(registerSchema),
        defaultValues: {
            email: '',
            password: '',
            confirmPassword: '',
            firstName: '',
            lastName: '',
            phoneNumber: '',
            role: 'Advertiser',
        },
    });

    const registerMutation = useMutation({
        mutationFn: async (data: Omit<RegisterFormData, 'confirmPassword'>) => {
            // Send phone with country code prefix (E.164 format)
            const registerData = {
                ...data,
                phoneNumber: `+91${data.phoneNumber}` // India country code
            };
            const response = await api.post('/auth/register', registerData);
            return response.data;
        },
        onSuccess: (response) => {
            // API Response structure: { success: true, data: { requiresVerification, phoneNumber, email, ... } }
            const data = response.data;
            if (data?.requiresVerification) {
                enqueueSnackbar('Registration successful! Please verify your phone number.', { variant: 'success' });
                // Navigate to verification page with email, phone number, and otpSent flag
                // Backend auto-sends OTP during registration, so start at OTP step directly
                navigate('/verify-phone', { 
                    state: { 
                        email: getValues('email'),
                        phoneNumber: `+91${getValues('phoneNumber')}`, // Full phone for resend
                        maskedPhone: data.phoneNumber, // Masked phone from backend for display
                        otpSent: true // OTP was already sent during registration
                    } 
                });
            } else {
                enqueueSnackbar('Registration successful!', { variant: 'success' });
                navigate('/login');
            }
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
                                    name="phoneNumber"
                                    control={control}
                                    render={({ field }) => (
                                        <TextField
                                            {...field}
                                            fullWidth
                                            label="Mobile Number"
                                            type="tel"
                                            placeholder="9876543210"
                                            error={!!errors.phoneNumber}
                                            helperText={errors.phoneNumber?.message || 'Enter 10-digit Indian mobile number'}
                                            required
                                            InputProps={{
                                                startAdornment: (
                                                    <InputAdornment position="start">
                                                        <Chip
                                                            icon={<PhoneIcon sx={{ fontSize: 16 }} />}
                                                            label="🇮🇳 +91"
                                                            size="small"
                                                            variant="outlined"
                                                            sx={{ 
                                                                mr: 0.5,
                                                                '& .MuiChip-label': { px: 1 }
                                                            }}
                                                        />
                                                    </InputAdornment>
                                                ),
                                            }}
                                            inputProps={{
                                                maxLength: 10,
                                            }}
                                            onChange={(e) => {
                                                // Only allow digits
                                                const value = e.target.value.replace(/\D/g, '').slice(0, 10);
                                                field.onChange(value);
                                            }}
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
