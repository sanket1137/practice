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
    Link,
} from '@mui/material';
import PhoneIcon from '@mui/icons-material/Phone';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import EmailIcon from '@mui/icons-material/Email';
import { useMutation } from '@tanstack/react-query';
import { useSnackbar } from 'notistack';
import { api } from '../../services/api';
import { useAuthStore } from '../../store/authStore';

interface LocationState {
    email?: string;
    phoneNumber?: string; // Full phone number with country code (for resend)
    maskedPhone?: string; // Masked phone number for display
    otpSent?: boolean; // OTP already sent during registration
    fromLogin?: boolean; // Coming from login (needs to send OTP first)
}

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

interface SendOtpResult {
    success: boolean;
    message?: string;
    remainingAttempts?: number;
}

interface VerifyOtpResult {
    success: boolean;
    isFullyVerified: boolean;
    message?: string;
}

export default function VerifyPhonePage() {
    const navigate = useNavigate();
    const location = useLocation();
    const { enqueueSnackbar } = useSnackbar();
    const setAuth = useAuthStore((state) => state.setAuth);
    
    // Get data from location state (from registration or login)
    const state = location.state as LocationState || {};
    const emailFromState = state.email || '';
    const phoneFromState = state.phoneNumber || ''; // Full phone with country code
    const maskedPhoneFromState = state.maskedPhone || ''; // Masked for display
    const otpAlreadySent = state.otpSent || false;
    const fromLogin = state.fromLogin || false;
    
    const [email] = useState(emailFromState);
    const [otp, setOtp] = useState(['', '', '', '', '', '']);
    // If coming from login, need to send OTP first, otherwise start at OTP step
    const [step, setStep] = useState<'send-otp' | 'otp' | 'success' | 'email-pending' | 'auto-login'>(
        fromLogin ? 'send-otp' : 'otp'
    );
    const [countdown, setCountdown] = useState(otpAlreadySent ? 60 : 0);
    const [remainingAttempts, setRemainingAttempts] = useState(5);
    const [displayPhone] = useState(maskedPhoneFromState);
    
    const otpRefs = useRef<(HTMLInputElement | null)[]>([]);

    // Countdown timer for resend
    useEffect(() => {
        if (countdown > 0) {
            const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
            return () => clearTimeout(timer);
        }
    }, [countdown]);

    // Redirect if no email provided - must come from registration or login
    useEffect(() => {
        if (!emailFromState) {
            enqueueSnackbar('Please register or login first', { variant: 'warning' });
            navigate('/register');
        }
    }, [emailFromState, navigate, enqueueSnackbar]);

    // Focus first OTP input on mount
    useEffect(() => {
        if (step === 'otp') {
            otpRefs.current[0]?.focus();
        }
    }, [step]);

    // Send OTP mutation (for users coming from login)
    const sendOtpMutation = useMutation({
        mutationFn: async () => {
            // Use resend endpoint which looks up phone from user record
            const response = await api.post<{ data: SendOtpResult }>('/auth/resend-phone-otp', {
                email
            });
            return response.data.data;
        },
        onSuccess: (data) => {
            enqueueSnackbar('OTP sent to your phone!', { variant: 'success' });
            setStep('otp');
            setCountdown(60);
            if (data?.remainingAttempts !== undefined) {
                setRemainingAttempts(data.remainingAttempts);
            }
        },
        onError: (error: any) => {
            enqueueSnackbar(
                error.response?.data?.message || 'Failed to send OTP',
                { variant: 'error' }
            );
        },
    });

    // Resend OTP mutation
    const resendOtpMutation = useMutation({
        mutationFn: async () => {
            // If we have full phone from registration, use send-phone-otp
            // Otherwise use resend-phone-otp which looks up from user record
            if (phoneFromState) {
                const response = await api.post<{ data: SendOtpResult }>('/auth/send-phone-otp', {
                    email,
                    phoneNumber: phoneFromState
                });
                return response.data.data;
            } else {
                const response = await api.post<{ data: SendOtpResult }>('/auth/resend-phone-otp', {
                    email
                });
                return response.data.data;
            }
        },
        onSuccess: (data) => {
            enqueueSnackbar('OTP resent to your phone!', { variant: 'success' });
            setCountdown(60);
            if (data?.remainingAttempts !== undefined) {
                setRemainingAttempts(data.remainingAttempts);
            }
        },
        onError: (error: any) => {
            enqueueSnackbar(
                error.response?.data?.message || 'Failed to resend OTP',
                { variant: 'error' }
            );
        },
    });

    const verifyOtpMutation = useMutation({
        mutationFn: async (data: { email: string; otp: string }) => {
            const response = await api.post<{ data: VerifyOtpResult }>('/auth/verify-phone', data);
            return response.data.data;
        },
        onSuccess: async (data) => {
            if (data?.isFullyVerified) {
                // Both phone and email verified - attempt auto-login
                setStep('auto-login');
                enqueueSnackbar('Phone verified! Logging you in...', { variant: 'success' });
                
                try {
                    // Call complete-verification endpoint for auto-login
                    const loginResponse = await api.post<{ data: CompleteVerificationResponse }>(
                        '/auth/complete-verification',
                        { email }
                    );
                    const { user, accessToken, refreshToken } = loginResponse.data.data;
                    setAuth(user, accessToken, refreshToken);
                    enqueueSnackbar('Welcome! You are now logged in.', { variant: 'success' });
                    navigate('/dashboard');
                } catch (error) {
                    // Auto-login failed, show success and manual login button
                    setStep('success');
                    enqueueSnackbar('Verification complete! Please log in.', { variant: 'info' });
                }
            } else {
                // Phone verified but email still pending
                setStep('email-pending');
                enqueueSnackbar('Phone verified! Please check your email to complete verification.', { variant: 'info' });
            }
        },
        onError: (error: any) => {
            const message = error.response?.data?.message || 'Invalid OTP';
            enqueueSnackbar(message, { variant: 'error' });
            // Clear OTP fields on error
            setOtp(['', '', '', '', '', '']);
            otpRefs.current[0]?.focus();
        },
    });

    const handleResendOtp = () => {
        resendOtpMutation.mutate();
    };

    const handleSendOtp = () => {
        sendOtpMutation.mutate();
    };

    const handleVerifyOtp = () => {
        const otpString = otp.join('');
        if (otpString.length !== 6) {
            enqueueSnackbar('Please enter the complete 6-digit OTP', { variant: 'warning' });
            return;
        }
        verifyOtpMutation.mutate({ email, otp: otpString });
    };

    const handleOtpChange = (index: number, value: string) => {
        if (value.length > 1) {
            // Handle paste
            const digits = value.replace(/\D/g, '').slice(0, 6).split('');
            const newOtp = [...otp];
            digits.forEach((digit, i) => {
                if (index + i < 6) {
                    newOtp[index + i] = digit;
                }
            });
            setOtp(newOtp);
            const nextIndex = Math.min(index + digits.length, 5);
            otpRefs.current[nextIndex]?.focus();
        } else {
            // Handle single character
            const newOtp = [...otp];
            newOtp[index] = value.replace(/\D/g, '');
            setOtp(newOtp);
            
            if (value && index < 5) {
                otpRefs.current[index + 1]?.focus();
            }
        }
    };

    const handleOtpKeyDown = (index: number, e: React.KeyboardEvent) => {
        if (e.key === 'Backspace' && !otp[index] && index > 0) {
            otpRefs.current[index - 1]?.focus();
        }
    };

    // Format phone for display: +91 987****210
    const formatPhoneDisplay = () => {
        if (displayPhone) {
            return displayPhone;
        }
        if (phoneFromState) {
            // Format: +91XXXXXXXXXX -> +91 XXX****XXX
            const digits = phoneFromState.replace(/\D/g, '');
            if (digits.length >= 10) {
                const last10 = digits.slice(-10);
                return `+91 ${last10.slice(0, 3)}****${last10.slice(-3)}`;
            }
        }
        return 'your phone';
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
                    <Box sx={{ textAlign: 'center', mb: 3 }}>
                        <PhoneIcon sx={{ fontSize: 48, color: 'primary.main' }} />
                        <Typography variant="h4" component="h1" gutterBottom>
                            Verify Phone Number
                        </Typography>
                        <Typography variant="body2" color="textSecondary">
                            {step === 'send-otp' 
                                ? 'Click below to receive OTP on your registered phone'
                                : 'Enter the OTP sent to your registered phone number'
                            }
                        </Typography>
                    </Box>

                    {step === 'send-otp' && (
                        <Box>
                            <Alert severity="info" sx={{ mb: 3 }}>
                                We'll send an OTP to your registered phone number ({displayPhone || 'ending in ***'})
                            </Alert>
                            
                            <Button
                                fullWidth
                                variant="contained"
                                size="large"
                                onClick={handleSendOtp}
                                disabled={sendOtpMutation.isPending}
                                sx={{ mb: 2 }}
                            >
                                {sendOtpMutation.isPending ? (
                                    <CircularProgress size={24} color="inherit" />
                                ) : (
                                    'Send OTP'
                                )}
                            </Button>
                            
                            <Box sx={{ textAlign: 'center', mt: 2 }}>
                                <Link
                                    component="button"
                                    variant="body2"
                                    onClick={() => navigate('/login')}
                                    sx={{ cursor: 'pointer' }}
                                >
                                    Back to Login
                                </Link>
                            </Box>
                        </Box>
                    )}

                    {step === 'otp' && (
                        <Box>
                            <Alert severity="info" sx={{ mb: 3 }}>
                                OTP sent to {formatPhoneDisplay()}
                            </Alert>
                            
                            <Typography variant="body2" align="center" sx={{ mb: 2 }}>
                                Enter the 6-digit OTP
                            </Typography>
                            
                            <Box sx={{ display: 'flex', justifyContent: 'center', gap: 1, mb: 3 }}>
                                {otp.map((digit, index) => (
                                    <TextField
                                        key={index}
                                        inputRef={(el) => (otpRefs.current[index] = el)}
                                        value={digit}
                                        onChange={(e) => handleOtpChange(index, e.target.value)}
                                        onKeyDown={(e) => handleOtpKeyDown(index, e)}
                                        inputProps={{
                                            maxLength: 6,
                                            style: { textAlign: 'center', fontSize: '1.5rem' },
                                        }}
                                        sx={{ width: 50 }}
                                    />
                                ))}
                            </Box>

                            <Button
                                fullWidth
                                variant="contained"
                                size="large"
                                onClick={handleVerifyOtp}
                                disabled={verifyOtpMutation.isPending || otp.join('').length !== 6}
                                sx={{ mb: 2 }}
                            >
                                {verifyOtpMutation.isPending ? (
                                    <CircularProgress size={24} color="inherit" />
                                ) : (
                                    'Verify OTP'
                                )}
                            </Button>

                            <Box sx={{ textAlign: 'center' }}>
                                {countdown > 0 ? (
                                    <Typography variant="body2" color="textSecondary">
                                        Resend OTP in {countdown}s
                                    </Typography>
                                ) : (
                                    <Link
                                        component="button"
                                        variant="body2"
                                        onClick={handleResendOtp}
                                        disabled={resendOtpMutation.isPending}
                                        sx={{ cursor: 'pointer' }}
                                    >
                                        {resendOtpMutation.isPending ? 'Sending...' : `Resend OTP (${remainingAttempts} remaining)`}
                                    </Link>
                                )}
                            </Box>
                        </Box>
                    )}

                    {step === 'success' && (
                        <Box sx={{ textAlign: 'center' }}>
                            <CheckCircleOutlineIcon 
                                sx={{ fontSize: 80, color: 'success.main', mb: 2 }} 
                            />
                            <Alert severity="success" sx={{ mb: 3 }}>
                                Account verified successfully!
                            </Alert>
                            <Typography variant="body1" paragraph>
                                Your account is now fully verified. Please log in to continue.
                            </Typography>
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

                    {step === 'auto-login' && (
                        <Box sx={{ textAlign: 'center', py: 4 }}>
                            <CircularProgress size={60} sx={{ mb: 3 }} />
                            <Typography variant="h6" gutterBottom>
                                Verification Complete!
                            </Typography>
                            <Typography variant="body2" color="textSecondary">
                                Logging you in...
                            </Typography>
                        </Box>
                    )}

                    {step === 'email-pending' && (
                        <Box sx={{ textAlign: 'center' }}>
                            <CheckCircleOutlineIcon 
                                sx={{ fontSize: 60, color: 'success.main', mb: 1 }} 
                            />
                            <Alert severity="success" sx={{ mb: 2 }}>
                                Phone number verified successfully!
                            </Alert>
                            
                            <Box sx={{ mb: 3, p: 2, bgcolor: 'warning.light', borderRadius: 2 }}>
                                <EmailIcon sx={{ fontSize: 40, color: 'warning.dark', mb: 1 }} />
                                <Typography variant="h6" gutterBottom>
                                    Email Verification Pending
                                </Typography>
                                <Typography variant="body2" color="text.secondary">
                                    We've sent a verification link to <strong>{email}</strong>.
                                    Please check your inbox and click the link to complete registration.
                                </Typography>
                            </Box>
                            
                            <Button
                                variant="outlined"
                                color="primary"
                                onClick={() => navigate('/resend-verification', { state: { email } })}
                                sx={{ mb: 2 }}
                                fullWidth
                            >
                                Resend Verification Email
                            </Button>
                            
                            <Button
                                variant="text"
                                onClick={() => navigate('/login')}
                            >
                                Go to Login
                            </Button>
                        </Box>
                    )}
                </Paper>
            </Box>
        </Container>
    );
}
