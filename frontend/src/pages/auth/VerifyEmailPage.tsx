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

export default function VerifyEmailPage() {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const token = searchParams.get('token');
    const [status, setStatus] = useState<'verifying' | 'success' | 'error'>('verifying');
    const [message, setMessage] = useState('');

    const verifyMutation = useMutation({
        mutationFn: async (verificationToken: string) => {
            const response = await api.post('/auth/verify-email', { token: verificationToken });
            return response.data;
        },
        onSuccess: (data) => {
            setStatus('success');
            setMessage(data.message || 'Email verified successfully!');
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

                    {status === 'success' && (
                        <Box sx={{ my: 4 }}>
                            <CheckCircleOutlineIcon 
                                sx={{ fontSize: 80, color: 'success.main' }} 
                            />
                            <Alert severity="success" sx={{ mt: 2, mb: 3 }}>
                                {message}
                            </Alert>
                            <Typography variant="body1" paragraph>
                                Your email has been verified. You can now proceed to verify your phone number.
                            </Typography>
                            <Button
                                variant="contained"
                                color="primary"
                                size="large"
                                onClick={() => navigate('/verify-phone')}
                                sx={{ mr: 2 }}
                            >
                                Verify Phone Number
                            </Button>
                            <Button
                                variant="outlined"
                                onClick={() => navigate('/login')}
                            >
                                Go to Login
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
