import { useState, useEffect, useCallback } from 'react';
import {
    Dialog,
    DialogTitle,
    DialogContent,
    Box,
    Typography,
    Tabs,
    Tab,
    Button,
    IconButton,
    Chip,
    Divider,
    Alert,
} from '@mui/material';
import {
    Close as CloseIcon,
    QrCode2 as QrCodeIcon,
    PhoneAndroid as UpiAppsIcon,
    AccountBalance as BankIcon,
    ContentCopy as CopyIcon,
    CheckCircle as CheckIcon,
} from '@mui/icons-material';
import { QRCodeSVG } from 'qrcode.react';
import { useSnackbar } from 'notistack';
import { usePaymentPoller } from '../../hooks/usePaymentPoller';
import type { CreateOrderResponse } from '../../types/payment';

interface PaymentScreenProps {
    open: boolean;
    onClose: () => void;
    orderDetails: CreateOrderResponse | null;
    bookingId: string;
    onPaymentConfirmed?: () => void;
}

const UPI_APPS = [
    { name: 'Google Pay', scheme: 'tez://upi/pay', icon: '💳' },
    { name: 'PhonePe', scheme: 'phonepe://pay', icon: '📱' },
    { name: 'Paytm', scheme: 'paytmmp://pay', icon: '💰' },
    { name: 'BHIM', scheme: 'upi://pay', icon: '🏦' },
];

function CountdownTimer({ expiresAt }: { expiresAt: string }) {
    const [timeLeft, setTimeLeft] = useState('');

    useEffect(() => {
        const update = () => {
            const now = new Date().getTime();
            const expiry = new Date(expiresAt).getTime();
            const diff = expiry - now;

            if (diff <= 0) {
                setTimeLeft('Expired');
                return;
            }

            const hours = Math.floor(diff / (1000 * 60 * 60));
            const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
            const seconds = Math.floor((diff % (1000 * 60)) / 1000);

            if (hours > 0) {
                setTimeLeft(`${hours}h ${minutes}m ${seconds}s`);
            } else {
                setTimeLeft(`${minutes}m ${seconds}s`);
            }
        };

        update();
        const interval = setInterval(update, 1000);
        return () => clearInterval(interval);
    }, [expiresAt]);

    return (
        <Typography
            variant="body2"
            sx={{
                color: timeLeft === 'Expired' ? 'error.main' : 'warning.main',
                fontWeight: 600,
                fontFamily: 'monospace',
            }}
        >
            {timeLeft}
        </Typography>
    );
}

export default function PaymentScreen({
    open,
    onClose,
    orderDetails,
    bookingId,
    onPaymentConfirmed,
}: PaymentScreenProps) {
    const [activeTab, setActiveTab] = useState(0);
    const [copiedField, setCopiedField] = useState<string | null>(null);
    const { enqueueSnackbar } = useSnackbar();

    const { isCaptured } = usePaymentPoller({
        bookingId,
        enabled: open && !!orderDetails,
        onConfirmed: () => {
            enqueueSnackbar('Payment confirmed!', { variant: 'success' });
            onPaymentConfirmed?.();
        },
    });

    const handleCopy = useCallback(async (text: string, fieldName: string) => {
        await navigator.clipboard.writeText(text);
        setCopiedField(fieldName);
        enqueueSnackbar(`${fieldName} copied to clipboard`, { variant: 'info' });
        setTimeout(() => setCopiedField(null), 2000);
    }, [enqueueSnackbar]);

    if (!orderDetails) return null;

    const upiPayString = `upi://pay?pa=pixelspot@razorpay&pn=PixelSpot&am=${orderDetails.amount}&cu=${orderDetails.currency}&tn=Booking${orderDetails.bookingId}`;

    const CopyButton = ({ text, label }: { text: string; label: string }) => (
        <IconButton
            size="small"
            onClick={() => handleCopy(text, label)}
            sx={{ color: copiedField === label ? 'success.main' : 'text.secondary' }}
        >
            {copiedField === label ? <CheckIcon fontSize="small" /> : <CopyIcon fontSize="small" />}
        </IconButton>
    );

    return (
        <Dialog open={open} onClose={isCaptured ? onClose : undefined} maxWidth="sm" fullWidth>
            <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Box>
                    <Typography variant="h6">Complete Payment</Typography>
                    <Typography variant="body2" color="text.secondary">
                        {orderDetails.currency} {orderDetails.amount.toLocaleString()}
                    </Typography>
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    {orderDetails.paymentExpiresAt && (
                        <Box sx={{ textAlign: 'right' }}>
                            <Typography variant="caption" color="text.secondary">
                                Expires in
                            </Typography>
                            <CountdownTimer expiresAt={orderDetails.paymentExpiresAt} />
                        </Box>
                    )}
                    <IconButton onClick={onClose} size="small">
                        <CloseIcon />
                    </IconButton>
                </Box>
            </DialogTitle>

            <DialogContent>
                {isCaptured ? (
                    <Box sx={{ textAlign: 'center', py: 4 }}>
                        <CheckIcon sx={{ fontSize: 64, color: 'success.main', mb: 2 }} />
                        <Typography variant="h5" gutterBottom>
                            Payment Successful
                        </Typography>
                        <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
                            Your booking is now confirmed.
                        </Typography>
                        <Button variant="contained" onClick={onClose}>
                            Done
                        </Button>
                    </Box>
                ) : (
                    <>
                        <Tabs
                            value={activeTab}
                            onChange={(_, v) => setActiveTab(v)}
                            variant="fullWidth"
                            sx={{ mb: 3 }}
                        >
                            <Tab icon={<QrCodeIcon />} label="UPI QR" />
                            <Tab icon={<UpiAppsIcon />} label="UPI Apps" />
                            {orderDetails.virtualAccountNumber && (
                                <Tab icon={<BankIcon />} label="Bank Transfer" />
                            )}
                        </Tabs>

                        {/* UPI QR Tab */}
                        {activeTab === 0 && (
                            <Box sx={{ textAlign: 'center', py: 2 }}>
                                <Box
                                    sx={{
                                        display: 'inline-flex',
                                        p: 3,
                                        bgcolor: 'white',
                                        borderRadius: 2,
                                        mb: 2,
                                    }}
                                >
                                    <QRCodeSVG
                                        value={upiPayString}
                                        size={220}
                                        level="M"
                                        includeMargin
                                    />
                                </Box>
                                <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                                    Scan this QR code with any UPI app to pay
                                </Typography>
                                <Chip
                                    label={`${orderDetails.currency} ${orderDetails.amount.toLocaleString()}`}
                                    color="primary"
                                    variant="outlined"
                                />
                            </Box>
                        )}

                        {/* UPI Apps Tab */}
                        {activeTab === 1 && (
                            <Box sx={{ py: 2 }}>
                                <Typography variant="body2" color="text.secondary" sx={{ mb: 2, textAlign: 'center' }}>
                                    Choose a UPI app to pay
                                </Typography>
                                <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
                                    {UPI_APPS.map((app) => (
                                        <Button
                                            key={app.name}
                                            variant="outlined"
                                            fullWidth
                                            sx={{
                                                py: 2,
                                                display: 'flex',
                                                flexDirection: 'column',
                                                gap: 0.5,
                                                textTransform: 'none',
                                            }}
                                            onClick={() => {
                                                window.location.href = `${app.scheme}?pa=pixelspot@razorpay&pn=PixelSpot&am=${orderDetails.amount}&cu=${orderDetails.currency}&tn=Booking`;
                                            }}
                                        >
                                            <Typography variant="h5">{app.icon}</Typography>
                                            <Typography variant="body2">{app.name}</Typography>
                                        </Button>
                                    ))}
                                </Box>
                                <Alert severity="info" sx={{ mt: 2 }}>
                                    UPI deep links work best on mobile devices
                                </Alert>
                            </Box>
                        )}

                        {/* Bank Transfer Tab */}
                        {activeTab === 2 && orderDetails.virtualAccountNumber && (
                            <Box sx={{ py: 2 }}>
                                <Typography variant="body2" color="text.secondary" sx={{ mb: 2, textAlign: 'center' }}>
                                    Transfer the exact amount to this account via NEFT/RTGS/IMPS
                                </Typography>
                                <Box
                                    sx={{
                                        border: 1,
                                        borderColor: 'divider',
                                        borderRadius: 2,
                                        p: 2,
                                    }}
                                >
                                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                                        <Box>
                                            <Typography variant="caption" color="text.secondary">
                                                Account Number
                                            </Typography>
                                            <Typography variant="body1" fontFamily="monospace" fontWeight={600}>
                                                {orderDetails.virtualAccountNumber}
                                            </Typography>
                                        </Box>
                                        <CopyButton text={orderDetails.virtualAccountNumber} label="Account Number" />
                                    </Box>
                                    <Divider sx={{ my: 1 }} />
                                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                                        <Box>
                                            <Typography variant="caption" color="text.secondary">
                                                IFSC Code
                                            </Typography>
                                            <Typography variant="body1" fontFamily="monospace" fontWeight={600}>
                                                {orderDetails.virtualAccountIfsc}
                                            </Typography>
                                        </Box>
                                        <CopyButton text={orderDetails.virtualAccountIfsc!} label="IFSC Code" />
                                    </Box>
                                    <Divider sx={{ my: 1 }} />
                                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <Box>
                                            <Typography variant="caption" color="text.secondary">
                                                Amount
                                            </Typography>
                                            <Typography variant="body1" fontWeight={600}>
                                                {orderDetails.currency} {orderDetails.amount.toLocaleString()}
                                            </Typography>
                                        </Box>
                                        <CopyButton text={orderDetails.amount.toString()} label="Amount" />
                                    </Box>
                                </Box>
                                <Alert severity="warning" sx={{ mt: 2 }}>
                                    Please transfer the exact amount. Partial payments will not be processed.
                                </Alert>
                            </Box>
                        )}

                        <Typography
                            variant="caption"
                            color="text.secondary"
                            sx={{ display: 'block', textAlign: 'center', mt: 2 }}
                        >
                            Waiting for payment confirmation...
                        </Typography>
                    </>
                )}
            </DialogContent>
        </Dialog>
    );
}
