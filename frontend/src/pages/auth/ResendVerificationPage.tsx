import { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
    Box,
    Container,
    Typography,
    Paper,
    TextField,
    Button,
    Alert,
    CircularProgress,
} from '@mui/material';
import EmailIcon from '@mui/icons-material/Email';
import { useMutation } from '@tanstack/react-query';
import { useSnackbar } from 'notistack';
import axios from 'axios';
import { api } from '../../services/api';

interface LocationState {
    email?: string;
}

export default function ResendVerificationPage() {
    const navigate = useNavigate();
    const location = useLocation();
    const { enqueueSnackbar } = useSnackbar();
    
    // Get email from navigation state if available
    const state = (location.state as LocationState) || {};
    const emailFromState = state.email || '';
    
    const [email, setEmail] = useState(emailFromState);
    const [sent, setSent] = useState(false);
    // Not rendered — only guards against re-triggering the auto-send effect below,
    // so a ref (not state) avoids an extra render-triggering setState in the effect.
    const autoSentRef = useRef(false);

    const resendMutation = useMutation({
        mutationFn: async (emailAddress: string) => {
            const response = await api.post('/auth/send-email-verification', { email: emailAddress });
            return response.data;
        },
        onSuccess: () => {
            setSent(true);
            enqueueSnackbar('Verification email sent!', { variant: 'success' });
        },
        onError: (error: unknown) => {
            const message = axios.isAxiosError<{ message?: string }>(error)
                ? error.response?.data?.message
                : undefined;
            enqueueSnackbar(
                message || 'Failed to send verification email',
                { variant: 'error' }
            );
        },
    });
    
    // If email is provided via state, auto-send the verification email
    useEffect(() => {
        if (emailFromState && !sent && !autoSentRef.current && !resendMutation.isPending) {
            autoSentRef.current = true;
            resendMutation.mutate(emailFromState);
        }
    }, [emailFromState, sent, resendMutation]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!email) {
            enqueueSnackbar('Please enter your email address', { variant: 'warning' });
            return;
        }
        resendMutation.mutate(email);
    };

    // Show loading state while auto-sending
    if (emailFromState && resendMutation.isPending && !sent) {
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
                        <CircularProgress size={60} sx={{ mb: 3 }} />
                        <Typography variant="h6" gutterBottom>
                            Sending Verification Email
                        </Typography>
                        <Typography variant="body2" color="textSecondary">
                            Sending to {email}...
                        </Typography>
                    </Paper>
                </Box>
            </Container>
        );
    }

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
                    <Box sx={{ textAlign: 'center', mb: 3 }}>
                        <EmailIcon sx={{ fontSize: 48, color: 'primary.main' }} />
                        <Typography variant="h4" component="h1" gutterBottom>
                            Resend Verification Email
                        </Typography>
                        <Typography variant="body2" color="textSecondary">
                            {emailFromState 
                                ? `We'll send a verification link to ${emailFromState}`
                                : 'Enter your email address to receive a new verification link'
                            }
                        </Typography>
                    </Box>

                    {sent ? (
                        <Box sx={{ textAlign: 'center' }}>
                            <Alert severity="success" sx={{ mb: 3 }}>
                                Verification email sent to <strong>{email}</strong>! Please check your inbox and spam folder.
                            </Alert>
                            <Typography variant="body2" paragraph>
                                Didn't receive the email?
                            </Typography>
                            <Button
                                variant="outlined"
                                onClick={() => {
                                    setSent(false);
                                    autoSentRef.current = false;
                                }}
                                sx={{ mr: 2 }}
                            >
                                Try Again
                            </Button>
                            <Button
                                variant="text"
                                onClick={() => navigate('/login')}
                            >
                                Back to Login
                            </Button>
                        </Box>
                    ) : (
                        <Box component="form" onSubmit={handleSubmit}>
                            <TextField
                                fullWidth
                                label="Email Address"
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                sx={{ mb: 3 }}
                                required
                                autoFocus
                            />
                            <Button
                                fullWidth
                                type="submit"
                                variant="contained"
                                size="large"
                                disabled={resendMutation.isPending}
                                sx={{ mb: 2 }}
                            >
                                {resendMutation.isPending ? (
                                    <CircularProgress size={24} color="inherit" />
                                ) : (
                                    'Send Verification Email'
                                )}
                            </Button>
                            <Button
                                fullWidth
                                variant="text"
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
