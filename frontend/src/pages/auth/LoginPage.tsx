import React, { useState } from 'react';
import {
    Box,
    Card,
    CardContent,
    TextField,
    Button,
    Typography,
    Container,
    Alert
} from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import api from '../../services/api';

const LoginPage = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();
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
            navigate('/dashboard');
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
            minHeight: '100vh'
        }}>
            <Card sx={{ width: '100%', p: 2 }}>
                <CardContent>
                    <Typography variant="h4" component="h1" gutterBottom align="center" sx={{ mb: 4 }}>
                        CCMS Login
                    </Typography>

                    {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

                    <form onSubmit={handleSubmit}>
                        <TextField
                            fullWidth
                            label="Email"
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            margin="normal"
                            required
                        />
                        <TextField
                            fullWidth
                            label="Password"
                            type="password"
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
                            sx={{ mt: 3 }}
                        >
                            {loading ? 'Logging in...' : 'Login'}
                        </Button>

                        <Box sx={{ mt: 2, textAlign: 'center' }}>
                            <Typography variant="body2">
                                Don't have an account?{' '}
                                <Button
                                    variant="text"
                                    onClick={() => navigate('/register')}
                                    sx={{ textTransform: 'none' }}
                                >
                                    Sign Up
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
