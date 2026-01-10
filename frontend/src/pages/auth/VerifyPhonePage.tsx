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
import type { SendOtpResult, VerifyOtpResult } from '../../types/auth';

interface LocationState {
    email?: string;
    phoneNumber?: string; // Masked phone number from registration
    otpSent?: boolean; // OTP already sent during registration
}

export default function VerifyPhonePage() {
    const navigate = useNavigate();
    const location = useLocation();
    const { enqueueSnackbar } = useSnackbar();
    
    // Get data from location state (from registration or login redirect)
    const state = location.state as LocationState || {};
    const emailFromState = state.email || '';
    const phoneFromState = state.phoneNumber || ''; // Masked phone from registration
    const otpAlreadySent = state.otpSent || false;
    
    const [email, setEmail] = useState(emailFromState);
    const [phoneNumber, setPhoneNumber] = useState('');
    const [maskedPhone, setMaskedPhone] = useState(phoneFromState);
    const [otp, setOtp] = useState(['', '', '', '', '', '']);
    // If OTP was already sent during registration, start at OTP step
    const [step, setStep] = useState<'phone' | 'otp' | 'success' | 'email-pending'>(
        otpAlreadySent ? 'otp' : 'phone'
    );
    const [countdown, setCountdown] = useState(otpAlreadySent ? 60 : 0);
    const [remainingAttempts, setRemainingAttempts] = useState(5);
    
    const otpRefs = useRef<(HTMLInputElement | null)[]>([]);

    // Countdown timer for resend
    useEffect(() => {
        if (countdown > 0) {
            const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
            return () => clearTimeout(timer);
        }
    }, [countdown]);

    // Redirect if no email provided
    useEffect(() => {
        if (!emailFromState) {
            enqueueSnackbar('Please register or login first', { variant: 'warning' });
            navigate('/register');
        }
    }, [emailFromState, navigate, enqueueSnackbar]);

    const sendOtpMutation = useMutation({
        mutationFn: async (data: { email: string; phoneNumber: string }) => {
            const response = await api.post<{ data: SendOtpResult }>('/auth/send-phone-otp', data);
            return response.data.data;
        },
        onSuccess: (data) => {
            enqueueSnackbar('OTP sent to your phone!', { variant: 'success' });
            setStep('otp');
            setCountdown(60); // 60 second cooldown
            if (data.remainingAttempts !== undefined) {
                setRemainingAttempts(data.remainingAttempts);
            }
            // Set masked phone for display
            if (phoneNumber) {
                setMaskedPhone(`${phoneNumber.slice(0, 3)}****${phoneNumber.slice(-3)}`);
            }
        },
        onError: (error: any) => {
            enqueueSnackbar(
                error.response?.data?.message || 'Failed to send OTP',
                { variant: 'error' }
            );
        },
    });

    // Resend OTP mutation - uses email to look up phone number from user record
    const resendOtpMutation = useMutation({
        mutationFn: async () => {
            const response = await api.post<{ data: SendOtpResult }>('/auth/resend-phone-otp', { email });
            return response.data.data;
        },
        onSuccess: (data) => {
            enqueueSnackbar('OTP resent to your phone!', { variant: 'success' });
            setCountdown(60);
            if (data.remainingAttempts !== undefined) {
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
        onSuccess: (data) => {
            if (data.isFullyVerified) {
                setStep('success');
                enqueueSnackbar('Phone verified! Your account is now fully verified.', { variant: 'success' });
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

    const handleSendOtp = () => {
        if (!email) {
            enqueueSnackbar('Please enter your email address', { variant: 'warning' });
            return;
        }
        if (!phoneNumber || phoneNumber.length !== 10) {
            enqueueSnackbar('Please enter a valid 10-digit phone number', { variant: 'warning' });
            return;
        }
        sendOtpMutation.mutate({ email, phoneNumber });
    };

    const handleResendOtp = () => {
        if (phoneNumber) {
            // If we have the full phone number (from phone step), use send-phone-otp
            sendOtpMutation.mutate({ email, phoneNumber });
        } else {
            // If we came from registration (OTP already sent), use resend endpoint
            resendOtpMutation.mutate();
        }
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
                            We need to verify your phone number to complete registration
                        </Typography>
                    </Box>

                    {step === 'phone' && (
                        <Box>
                            {!emailFromState && (
                                <TextField
                                    fullWidth
                                    label="Email Address"
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    sx={{ mb: 2 }}
                                    required
                                />
                            )}
                            <TextField
                                fullWidth
                                label="Phone Number"
                                placeholder="10-digit mobile number"
                                value={phoneNumber}
                                onChange={(e) => setPhoneNumber(e.target.value.replace(/\D/g, '').slice(0, 10))}
                                inputProps={{ maxLength: 10 }}
                                helperText="Enter your 10-digit Indian mobile number"
                                sx={{ mb: 3 }}
                                required
                            />
                            <Button
                                fullWidth
                                variant="contained"
                                size="large"
                                onClick={handleSendOtp}
                                disabled={sendOtpMutation.isPending}
                            >
                                {sendOtpMutation.isPending ? (
                                    <CircularProgress size={24} color="inherit" />
                                ) : (
                                    'Send OTP'
                                )}
                            </Button>
                        </Box>
                    )}

                    {step === 'otp' && (
                        <Box>
                            <Alert severity="info" sx={{ mb: 3 }}>
                                OTP sent to +91 {maskedPhone || (phoneNumber ? `${phoneNumber.slice(0, 3)}****${phoneNumber.slice(-3)}` : 'your phone')}
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
                                        disabled={sendOtpMutation.isPending || resendOtpMutation.isPending}
                                    >
                                        Resend OTP ({remainingAttempts} remaining)
                                    </Link>
                                )}
                            </Box>

                            {/* Only show "Change Phone Number" if we entered phone manually (not from registration) */}
                            {!otpAlreadySent && (
                                <Button
                                    fullWidth
                                    variant="text"
                                    onClick={() => setStep('phone')}
                                    sx={{ mt: 2 }}
                                >
                                    Change Phone Number
                                </Button>
                            )}
                        </Box>
                    )}

                    {step === 'success' && (
                        <Box sx={{ textAlign: 'center' }}>
                            <CheckCircleOutlineIcon 
                                sx={{ fontSize: 80, color: 'success.main', mb: 2 }} 
                            />
                            <Alert severity="success" sx={{ mb: 3 }}>
                                Phone number verified successfully!
                            </Alert>
                            <Typography variant="body1" paragraph>
                                Your account is now fully verified. You can now log in.
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
