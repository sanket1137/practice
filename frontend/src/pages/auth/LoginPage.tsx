import React, { useState } from 'react';
import {
    Box,
    Card,
    CardContent,
    TextField,
    Button,
    Typography,
    Container,
    Alert,
    Stack,
} from '@mui/material';
import TvIcon from '@mui/icons-material/Tv';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import api from '../../services/api';

const LoginPage = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const setAuth = useAuthStore((state) => state.setAuth);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            const response = await api.post('/auth/login', { email, password });
            const data = response.data.data;
            
            // Check if user needs verification
            if (data.requiresVerification) {
                // Phone not verified - redirect to phone verification
                if (!data.isPhoneVerified) {
                    navigate('/verify-phone', { 
                        state: { 
                            email: data.email || email,
                            phoneNumber: data.phoneNumber, // Masked phone from backend
                            otpSent: false, // Will need to send OTP
                            fromLogin: true // Indicate this is from login
                        } 
                    });
                    return;
                }
                // Email not verified - redirect to email verification info
                if (!data.isEmailVerified) {
                    navigate('/resend-verification', { 
                        state: { email: data.email || email } 
                    });
                    return;
                }
            }

            const { user, accessToken, refreshToken } = data;
            setAuth(user, accessToken, refreshToken);
            const returnUrl = searchParams.get('returnUrl');
            if (returnUrl && returnUrl.startsWith('/')) {
                navigate(returnUrl);
            } else if (user?.accountType === 'CmsOwner') {
                // CMS-mode owners get a dedicated self-hosted dashboard
                navigate('/cms/screens');
            } else {
                navigate('/dashboard');
            }
        } catch (err: any) {
            setError(err.response?.data?.message || 'Login failed');
        } finally {
            setLoading(false);
        }
    };

    return (
        <Container maxWidth="sm" sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '100vh',
            py: 4,
            position: 'relative',
            '&::before': {
                content: '""',
                position: 'absolute',
                inset: 0,
                background:
                    'radial-gradient(900px 420px at 50% -10%, rgba(10, 102, 216, 0.16), transparent 58%), radial-gradient(700px 300px at 50% 100%, rgba(10, 102, 216, 0.08), transparent 65%)',
                pointerEvents: 'none',
            },
        }}>
            <Card sx={{ width: '100%', maxWidth: 460, p: { xs: 1.5, sm: 2 }, borderRadius: 4, position: 'relative', zIndex: 1 }}>
                <CardContent>
                    <Stack spacing={2.5} alignItems="center" sx={{ mb: 3 }}>
                        <Box
                            sx={{
                                width: 56,
                                height: 56,
                                borderRadius: 3,
                                bgcolor: 'primary.main',
                                color: 'primary.contrastText',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                boxShadow: '0 10px 24px rgba(10, 102, 216, 0.28)',
                            }}
                        >
                            <TvIcon />
                        </Box>
                        <Box textAlign="center">
                            <Typography variant="h4" component="h1" sx={{ mb: 0.5 }}>
                                Welcome back
                            </Typography>
                            <Typography variant="body1" color="text.secondary">
                                Sign in to your PixelSpot account
                            </Typography>
                        </Box>
                    </Stack>

                    {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

                    <form onSubmit={handleSubmit}>
                        <TextField
                            fullWidth
                            label="Email"
                            type="email"
                            placeholder="you@company.com"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            margin="normal"
                            required
                        />
                        <TextField
                            fullWidth
                            label="Password"
                            type="password"
                            placeholder="Enter password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            margin="normal"
                            required
                        />
                        <Button
                            fullWidth
                            type="submit"
                            variant="contained"
                            size="large"
                            disabled={loading}
                            sx={{ mt: 3, py: 1.2, fontSize: '1.05rem' }}
                        >
                            {loading ? 'Signing in...' : 'Sign in'}
                        </Button>

                        <Box sx={{ mt: 1, textAlign: 'right' }}>
                            <Button
                                variant="text"
                                size="small"
                                onClick={() => navigate('/forgot-password')}
                                sx={{ textTransform: 'none' }}
                            >
                                Forgot password?
                            </Button>
                        </Box>

                        <Box sx={{ mt: 1, textAlign: 'center' }}>
                            <Typography variant="body2">
                                Don't have an account?{' '}
                                <Button
                                    variant="text"
                                    onClick={() => navigate('/register')}
                                    sx={{ textTransform: 'none' }}
                                >
                                    Create account
                                </Button>
                            </Typography>
                        </Box>
                    </form>
                </CardContent>
            </Card>
        </Container>
    );
};

export default LoginPage;
