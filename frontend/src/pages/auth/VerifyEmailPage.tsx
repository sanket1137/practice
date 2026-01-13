import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import {
    Box,
    Container,
    Typography,
    Paper,
    CircularProgress,
    Alert,
    Button,
} from '@mui/material';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import { useMutation } from '@tanstack/react-query';
import { api } from '../../services/api';
import { useSnackbar } from 'notistack';
import { useAuthStore } from '../../store/authStore';

// Auto-login response type
interface CompleteVerificationResponse {
    accessToken: string;
    refreshToken: string;
    user: {
        id: string;
        email: string;
        firstName: string;
        lastName: string;
        role: string;
    };
}

interface VerifyEmailResult {
    success: boolean;
    message?: string;
    email?: string;
    isFullyVerified?: boolean;
    isPhoneVerified?: boolean;
}

export default function VerifyEmailPage() {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const { enqueueSnackbar } = useSnackbar();
    const setAuth = useAuthStore((state) => state.setAuth);
    const token = searchParams.get('token');
    const [status, setStatus] = useState<'verifying' | 'success' | 'error' | 'auto-login' | 'phone-pending'>('verifying');
    const [message, setMessage] = useState('');
    const [email, setEmail] = useState('');

    const verifyMutation = useMutation({
        mutationFn: async (verificationToken: string) => {
            const response = await api.post<{ data: VerifyEmailResult }>('/auth/verify-email', { token: verificationToken });
            return response.data;
        },
        onSuccess: async (response) => {
            const data = response.data;
            setEmail(data.email || '');
            
            if (data.isFullyVerified) {
                // Both email and phone verified - attempt auto-login
                setStatus('auto-login');
                setMessage('Email verified! Logging you in...');
                
                try {
                    const loginResponse = await api.post<{ data: CompleteVerificationResponse }>(
                        '/auth/complete-verification',
                        { email: data.email }
                    );
                    const { user, accessToken, refreshToken } = loginResponse.data.data;
                    setAuth(user, accessToken, refreshToken);
                    enqueueSnackbar('Welcome! You are now logged in.', { variant: 'success' });
                    navigate('/dashboard');
                } catch (error) {
                    // Auto-login failed, show success with login button
                    setStatus('success');
                    setMessage('Email verified successfully! Please log in to continue.');
                }
            } else if (!data.isPhoneVerified) {
                // Email verified but phone pending
                setStatus('phone-pending');
                setMessage('Email verified! Please verify your phone number to complete registration.');
            } else {
                setStatus('success');
                setMessage(response.message || 'Email verified successfully!');
            }
        },
        onError: (error: any) => {
            setStatus('error');
            setMessage(error.response?.data?.message || 'Email verification failed');
        },
    });

    useEffect(() => {
        if (token) {
            verifyMutation.mutate(token);
        } else {
            setStatus('error');
            setMessage('Invalid verification link. No token provided.');
        }
    }, [token]);

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
                <Paper elevation={3} sx={{ p: 4, width: '100%', textAlign: 'center' }}>
                    <Typography variant="h4" component="h1" gutterBottom>
                        Email Verification
                    </Typography>

                    {status === 'verifying' && (
                        <Box sx={{ my: 4 }}>
                            <CircularProgress size={60} />
                            <Typography variant="body1" sx={{ mt: 2 }}>
                                Verifying your email address...
                            </Typography>
                        </Box>
                    )}

                    {status === 'auto-login' && (
                        <Box sx={{ my: 4 }}>
                            <CircularProgress size={60} />
                            <Typography variant="body1" sx={{ mt: 2 }}>
                                {message}
                            </Typography>
                        </Box>
                    )}

                    {status === 'success' && (
                        <Box sx={{ my: 4 }}>
                            <CheckCircleOutlineIcon 
                                sx={{ fontSize: 80, color: 'success.main' }} 
                            />
                            <Alert severity="success" sx={{ mt: 2, mb: 3 }}>
                                {message}
                            </Alert>
                            <Button
                                variant="contained"
                                color="primary"
                                size="large"
                                onClick={() => navigate('/login')}
                            >
                                Go to Login
                            </Button>
                        </Box>
                    )}

                    {status === 'phone-pending' && (
                        <Box sx={{ my: 4 }}>
                            <CheckCircleOutlineIcon 
                                sx={{ fontSize: 80, color: 'success.main' }} 
                            />
                            <Alert severity="success" sx={{ mt: 2, mb: 3 }}>
                                Email verified successfully!
                            </Alert>
                            <Alert severity="warning" sx={{ mb: 3 }}>
                                Please verify your phone number to complete registration.
                            </Alert>
                            <Button
                                variant="contained"
                                color="primary"
                                size="large"
                                onClick={() => navigate('/verify-phone', { 
                                    state: { 
                                        email,
                                        otpSent: false,
                                        fromLogin: true
                                    } 
                                })}
                                sx={{ mr: 2 }}
                            >
                                Verify Phone Number
                            </Button>
                        </Box>
                    )}

                    {status === 'error' && (
                        <Box sx={{ my: 4 }}>
                            <ErrorOutlineIcon 
                                sx={{ fontSize: 80, color: 'error.main' }} 
                            />
                            <Alert severity="error" sx={{ mt: 2, mb: 3 }}>
                                {message}
                            </Alert>
                            <Button
                                variant="contained"
                                onClick={() => navigate('/resend-verification')}
                                sx={{ mr: 2 }}
                            >
                                Resend Verification Email
                            </Button>
                            <Button
                                variant="outlined"
                                onClick={() => navigate('/login')}
                            >
                                Back to Login
                            </Button>
                        </Box>
                    )}
                </Paper>
            </Box>
        </Container>
    );
}
