import { useState } from 'react';
import {
    Box,
    Container,
    Typography,
    Paper,
    Card,
    CardContent,
    Button,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Chip,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    TextField,
    CircularProgress,
    Alert,
} from '@mui/material';
import {
    AccountBalanceWallet as WalletIcon,
    Add as AddIcon,
    ArrowUpward as CreditIcon,
    ArrowDownward as DebitIcon,
} from '@mui/icons-material';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useSnackbar } from 'notistack';
import {
    getWallet,
    getWalletTransactions,
    createWalletTopUp,
    confirmWalletTopUp,
    loadRazorpayScript,
} from '../../services/paymentApi';
import type { RazorpayResponse } from '../../types/payment';

export default function WalletPage() {
    const { enqueueSnackbar } = useSnackbar();
    const queryClient = useQueryClient();
    const [topUpOpen, setTopUpOpen] = useState(false);
    const [topUpAmount, setTopUpAmount] = useState('');
    const [processing, setProcessing] = useState(false);

    const { data: wallet, isLoading: walletLoading } = useQuery({
        queryKey: ['wallet'],
        queryFn: getWallet,
    });

    const { data: transactions, isLoading: txLoading } = useQuery({
        queryKey: ['wallet-transactions'],
        queryFn: () => getWalletTransactions(1, 50),
    });

    const handleTopUp = async () => {
        const amount = parseFloat(topUpAmount);
        if (isNaN(amount) || amount < 1) {
            enqueueSnackbar('Enter a valid amount (min ₹1)', { variant: 'warning' });
            return;
        }

        setProcessing(true);
        try {
            const loaded = await loadRazorpayScript();
            if (!loaded) {
                enqueueSnackbar('Failed to load Razorpay. Check your connection.', { variant: 'error' });
                return;
            }

            const order = await createWalletTopUp(amount);

            const options = {
                key: order.keyId,
                amount: order.amount,
                currency: order.currency,
                order_id: order.orderId,
                name: 'CCMS Wallet',
                description: `Top up ₹${amount}`,
                handler: async (response: RazorpayResponse) => {
                    try {
                        await confirmWalletTopUp(
                            response.razorpay_order_id,
                            response.razorpay_payment_id,
                            response.razorpay_signature,
                            amount,
                        );
                        enqueueSnackbar('Wallet topped up successfully!', { variant: 'success' });
                        queryClient.invalidateQueries({ queryKey: ['wallet'] });
                        queryClient.invalidateQueries({ queryKey: ['wallet-transactions'] });
                    } catch {
                        enqueueSnackbar('Payment received but confirmation failed. Contact support.', { variant: 'error' });
                    }
                },
                theme: { color: '#2e7d32' },
            };

            const rzp = new window.Razorpay(options);
            rzp.open();
            setTopUpOpen(false);
            setTopUpAmount('');
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : 'Top-up failed';
            enqueueSnackbar(msg, { variant: 'error' });
        } finally {
            setProcessing(false);
        }
    };

    const getTypeChip = (type: string) => {
        switch (type) {
            case 'TopUp':
            case 'Refund':
                return <Chip icon={<CreditIcon />} label={type} color="success" size="small" />;
            case 'Debit':
            case 'Payout':
                return <Chip icon={<DebitIcon />} label={type} color="error" size="small" />;
            default:
                return <Chip label={type} size="small" />;
        }
    };

    if (walletLoading) {
        return (
            <Box display="flex" justifyContent="center" py={8}>
                <CircularProgress />
            </Box>
        );
    }

    return (
        <Container maxWidth="lg" sx={{ py: 3 }}>
            <Typography variant="h4" fontWeight={700} gutterBottom>
                Wallet
            </Typography>

            {/* Balance Card */}
            <Card sx={{ mb: 4, background: 'linear-gradient(135deg, #2e7d32 0%, #1b5e20 100%)', color: 'white' }}>
                <CardContent sx={{ py: 4, px: 4, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Box display="flex" alignItems="center" gap={2}>
                        <WalletIcon sx={{ fontSize: 48 }} />
                        <Box>
                            <Typography variant="body2" sx={{ opacity: 0.8 }}>
                                Available Balance
                            </Typography>
                            <Typography variant="h3" fontWeight={700}>
                                ₹{wallet?.balance?.toLocaleString('en-IN', { minimumFractionDigits: 2 }) ?? '0.00'}
                            </Typography>
                        </Box>
                    </Box>
                    <Button
                        variant="contained"
                        startIcon={<AddIcon />}
                        onClick={() => setTopUpOpen(true)}
                        sx={{ bgcolor: 'white', color: '#2e7d32', '&:hover': { bgcolor: '#e8f5e9' } }}
                    >
                        Add Money
                    </Button>
                </CardContent>
            </Card>

            {/* Transaction History */}
            <Typography variant="h6" fontWeight={600} gutterBottom>
                Transaction History
            </Typography>

            {txLoading ? (
                <Box display="flex" justifyContent="center" py={4}>
                    <CircularProgress />
                </Box>
            ) : !transactions?.length ? (
                <Alert severity="info">No transactions yet. Top up your wallet to get started.</Alert>
            ) : (
                <TableContainer component={Paper}>
                    <Table>
                        <TableHead>
                            <TableRow>
                                <TableCell>Date</TableCell>
                                <TableCell>Type</TableCell>
                                <TableCell>Description</TableCell>
                                <TableCell align="right">Amount</TableCell>
                                <TableCell align="right">Balance After</TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {transactions.map((tx) => (
                                <TableRow key={tx.id}>
                                    <TableCell>
                                        {new Date(tx.createdAt).toLocaleDateString('en-IN', {
                                            day: 'numeric',
                                            month: 'short',
                                            year: 'numeric',
                                            hour: '2-digit',
                                            minute: '2-digit',
                                        })}
                                    </TableCell>
                                    <TableCell>{getTypeChip(tx.type)}</TableCell>
                                    <TableCell>{tx.description ?? '-'}</TableCell>
                                    <TableCell
                                        align="right"
                                        sx={{
                                            fontWeight: 600,
                                            color: tx.type === 'Debit' || tx.type === 'Payout' ? 'error.main' : 'success.main',
                                        }}
                                    >
                                        {tx.type === 'Debit' || tx.type === 'Payout' ? '-' : '+'}₹
                                        {tx.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                    </TableCell>
                                    <TableCell align="right">
                                        ₹{tx.balanceAfter.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </TableContainer>
            )}

            {/* Top-Up Dialog */}
            <Dialog open={topUpOpen} onClose={() => setTopUpOpen(false)} maxWidth="xs" fullWidth>
                <DialogTitle>Add Money to Wallet</DialogTitle>
                <DialogContent>
                    <TextField
                        autoFocus
                        fullWidth
                        label="Amount (₹)"
                        type="number"
                        value={topUpAmount}
                        onChange={(e) => setTopUpAmount(e.target.value)}
                        slotProps={{ htmlInput: { min: 1 } }}
                        sx={{ mt: 1 }}
                    />
                    <Box display="flex" gap={1} mt={2}>
                        {[500, 1000, 2000, 5000].map((amt) => (
                            <Chip
                                key={amt}
                                label={`₹${amt}`}
                                onClick={() => setTopUpAmount(String(amt))}
                                variant={topUpAmount === String(amt) ? 'filled' : 'outlined'}
                                color="primary"
                                clickable
                            />
                        ))}
                    </Box>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setTopUpOpen(false)}>Cancel</Button>
                    <Button variant="contained" onClick={handleTopUp} disabled={processing}>
                        {processing ? <CircularProgress size={20} /> : 'Pay with Razorpay'}
                    </Button>
                </DialogActions>
            </Dialog>
        </Container>
    );
}
