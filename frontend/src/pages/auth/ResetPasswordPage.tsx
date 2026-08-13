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
import { useNavigate, useSearchParams } from 'react-router-dom';
import api from '../../services/api';

const ResetPasswordPage = () => {
    const [searchParams] = useSearchParams();
    const token = searchParams.get('token');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState(false);
    const [error, setError] = useState('');
    const navigate = useNavigate();

    const passwordsMatch = newPassword === confirmPassword;
    const passwordValid = newPassword.length >= 8;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!passwordsMatch || !passwordValid) return;

        setError('');
        setLoading(true);

        try {
            await api.post('/auth/reset-password', { token, newPassword });
            setSuccess(true);
        } catch (err: unknown) {
            const axiosErr = err as { response?: { data?: { message?: string } } };
            setError(axiosErr.response?.data?.message || 'Failed to reset password. The link may have expired.');
        } finally {
            setLoading(false);
        }
    };

    if (!token) {
        return (
            <Container maxWidth="sm" sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                minHeight: '100vh'
            }}>
                <Card sx={{ width: '100%', p: 2 }}>
                    <CardContent>
                        <Alert severity="error" sx={{ mb: 2 }}>
                            Invalid reset link. Please request a new password reset.
                        </Alert>
                        <Button
                            fullWidth
                            variant="contained"
                            onClick={() => navigate('/forgot-password')}
                        >
                            Request new reset link
                        </Button>
                    </CardContent>
                </Card>
            </Container>
        );
    }

    if (success) {
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
                            Password reset successful
                        </Typography>
                        <Alert severity="success" sx={{ mb: 3 }}>
                            Your password has been updated. You can now log in with your new password.
                        </Alert>
                        <Button
                            fullWidth
                            variant="contained"
                            onClick={() => navigate('/login')}
                        >
                            Go to login
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
                        Set new password
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 3, textAlign: 'center' }}>
                        Enter your new password below.
                    </Typography>

                    {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

                    <form onSubmit={handleSubmit}>
                        <TextField
                            fullWidth
                            label="New password"
                            type="password"
                            value={newPassword}
                            onChange={(e) => setNewPassword(e.target.value)}
                            margin="normal"
                            required
                            autoFocus
                            helperText={newPassword && !passwordValid ? 'Password must be at least 8 characters' : ''}
                            error={!!newPassword && !passwordValid}
                        />
                        <TextField
                            fullWidth
                            label="Confirm new password"
                            type="password"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            margin="normal"
                            required
                            helperText={confirmPassword && !passwordsMatch ? 'Passwords do not match' : ''}
                            error={!!confirmPassword && !passwordsMatch}
                        />
                        <Button
                            fullWidth
                            type="submit"
                            variant="contained"
                            size="large"
                            disabled={loading || !passwordValid || !passwordsMatch}
                            sx={{ mt: 2 }}
                        >
                            {loading ? 'Resetting...' : 'Reset password'}
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

export default ResetPasswordPage;
