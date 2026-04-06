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
import api from '../../services/api';

const ForgotPasswordPage = () => {
    const [email, setEmail] = useState('');
    const [loading, setLoading] = useState(false);
    const [submitted, setSubmitted] = useState(false);
    const [error, setError] = useState('');
    const navigate = useNavigate();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            await api.post('/auth/request-password-reset', { email });
            setSubmitted(true);
        } catch (err: unknown) {
            const axiosErr = err as { response?: { data?: { message?: string } } };
            setError(axiosErr.response?.data?.message || 'Failed to send reset link. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    if (submitted) {
        return (
            <Container maxWidth="sm" sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                minHeight: '100vh'
            }}>
                <Card sx={{ width: '100%', p: 2 }}>
                    <CardContent>
                        <Typography variant="h5" gutterBottom align="center" sx={{ mb: 2 }}>
                            Check your email
                        </Typography>
                        <Alert severity="success" sx={{ mb: 2 }}>
                            If an account exists for <strong>{email}</strong>, we've sent a password reset link.
                            Please check your inbox and spam folder.
                        </Alert>
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 3, textAlign: 'center' }}>
                            The link will expire in 1 hour.
                        </Typography>
                        <Button
                            fullWidth
                            variant="contained"
                            onClick={() => navigate('/login')}
                        >
                            Back to login
                        </Button>
                    </CardContent>
                </Card>
            </Container>
        );
    }

    return (
        <Container maxWidth="sm" sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '100vh'
        }}>
            <Card sx={{ width: '100%', p: 2 }}>
                <CardContent>
                    <Typography variant="h5" gutterBottom align="center" sx={{ mb: 1 }}>
                        Forgot password?
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 3, textAlign: 'center' }}>
                        Enter your email address and we'll send you a link to reset your password.
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
                            autoFocus
                        />
                        <Button
                            fullWidth
                            type="submit"
                            variant="contained"
                            size="large"
                            disabled={loading}
                            sx={{ mt: 2 }}
                        >
                            {loading ? 'Sending...' : 'Send reset link'}
                        </Button>

                        <Box sx={{ mt: 2, textAlign: 'center' }}>
                            <Button
                                variant="text"
                                onClick={() => navigate('/login')}
                                sx={{ textTransform: 'none' }}
                            >
                                Back to login
                            </Button>
                        </Box>
                    </form>
                </CardContent>
            </Card>
        </Container>
    );
};

export default ForgotPasswordPage;
