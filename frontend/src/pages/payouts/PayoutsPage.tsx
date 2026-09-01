import { useState } from 'react';
import {
    Box,
    Container,
    Typography,
    Paper,
    Card,
    CardContent,
    Grid,
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
    AccountBalance as EarningsIcon,
    Percent as CommissionIcon,
    Payments as NetIcon,
    RequestQuote as RequestIcon,
    AccountBalanceWallet as BankIcon,
    Download as DownloadIcon,
} from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { useSnackbar } from 'notistack';
import { api } from '../../services/api';
import {
    getPayoutSummary,
    requestPayout,
} from '../../services/paymentApi';

/** One row of the owner's full payout ledger (GET /payouts/mine). */
interface LedgerEntry {
    id: string;
    bookingId?: string | null;
    payoutType: string; // Advance | Final | Full
    screenName: string;
    campaignName?: string | null;
    grossAmount: number;
    commissionPercentage: number;
    commissionAmount: number;
    netAmount: number;
    advancePercentage: number;
    currency: string;
    status: string;
    createdAt: string;
}

export default function PayoutsPage() {
    const { enqueueSnackbar } = useSnackbar();
    const queryClient = useQueryClient();
    const navigate = useNavigate();
    const [requestOpen, setRequestOpen] = useState(false);
    const [periodStart, setPeriodStart] = useState('');
    const [periodEnd, setPeriodEnd] = useState('');

    const { data: summary, isLoading: summaryLoading } = useQuery({
        queryKey: ['payout-summary'],
        queryFn: getPayoutSummary,
    });

    // Full ledger — every payout in every state, with booking context.
    const { data: ledger, isLoading: payoutsLoading } = useQuery<LedgerEntry[]>({
        queryKey: ['payout-ledger'],
        queryFn: async () => {
            const res = await api.get('/payouts/mine?pageSize=200');
            return res.data.data ?? [];
        },
    });

    const downloadStatement = () => {
        if (!ledger?.length) return;
        const header = 'Date,Screen,Campaign,Type,Status,Currency,Gross,Commission %,Commission,Net';
        const esc = (v: string) => `"${(v ?? '').replace(/"/g, '""')}"`;
        const rows = ledger.map((p) => [
            new Date(p.createdAt).toISOString().slice(0, 10),
            esc(p.screenName),
            esc(p.campaignName ?? ''),
            p.payoutType,
            p.status,
            p.currency,
            p.grossAmount.toFixed(2),
            p.commissionPercentage.toFixed(2),
            p.commissionAmount.toFixed(2),
            p.netAmount.toFixed(2),
        ].join(','));
        const blob = new Blob([[header, ...rows].join('\n')], { type: 'text/csv;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `earnings-statement-${new Date().toISOString().slice(0, 10)}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    };

    const requestMutation = useMutation({
        mutationFn: () => requestPayout(periodStart, periodEnd),
        onSuccess: () => {
            enqueueSnackbar('Payout request submitted successfully!', { variant: 'success' });
            queryClient.invalidateQueries({ queryKey: ['payout-summary'] });
            queryClient.invalidateQueries({ queryKey: ['payout-history'] });
            setRequestOpen(false);
            setPeriodStart('');
            setPeriodEnd('');
        },
        onError: (err: Error) => {
            enqueueSnackbar(err.message || 'Failed to request payout', { variant: 'error' });
        },
    });

    const getStatusChip = (status: string) => {
        const colorMap: Record<string, 'warning' | 'info' | 'success' | 'error'> = {
            Pending: 'warning',
            Processing: 'info',
            Completed: 'success',
            Failed: 'error',
        };
        return <Chip label={status} color={colorMap[status] ?? 'default'} size="small" />;
    };

    if (summaryLoading) {
        return (
            <Box display="flex" justifyContent="center" py={8}>
                <CircularProgress />
            </Box>
        );
    }

    return (
        <Container maxWidth="lg" sx={{ py: 3 }}>
            <Box
                sx={{
                    p: { xs: 2.5, md: 3.5 },
                    mb: 3,
                    borderRadius: 3,
                    background:
                        'radial-gradient(900px 340px at 100% -8%, rgba(10,102,216,0.12), transparent 60%), var(--ps-surface)',
                    border: '1px solid var(--ps-border)',
                    boxShadow: '0 8px 24px rgba(0,0,0,0.10)',
                    display: 'flex',
                    flexDirection: { xs: 'column', sm: 'row' },
                    justifyContent: 'space-between',
                    alignItems: { xs: 'flex-start', sm: 'center' },
                    gap: 2,
                }}
            >
                <Box>
                    <Typography variant="h4" gutterBottom sx={{ mb: 0.5 }}>Earnings</Typography>
                    <Typography variant="body1" color="text.secondary">
                        Every rupee your screens earn: the ledger, advances, settlements, and statements.
                    </Typography>
                </Box>
                <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                    <Button
                        variant="outlined"
                        startIcon={<DownloadIcon />}
                        onClick={downloadStatement}
                        disabled={!ledger?.length}
                    >
                        Statement (CSV)
                    </Button>
                    <Button
                        variant="contained"
                        startIcon={<RequestIcon />}
                        onClick={() => setRequestOpen(true)}
                    >
                        Request payout
                    </Button>
                </Box>
            </Box>

            {/* Summary Cards */}
            <Grid container spacing={3} sx={{ mb: 4 }}>
                <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                    <Card>
                        <CardContent>
                            <Box display="flex" alignItems="center" gap={1} mb={1}>
                                <EarningsIcon color="primary" />
                                <Typography variant="body2" color="text.secondary">
                                    Gross Earnings
                                </Typography>
                            </Box>
                            <Typography variant="h5" fontWeight={700}>
                                ₹{summary?.totalGrossEarnings?.toLocaleString('en-IN', { minimumFractionDigits: 2 }) ?? '0.00'}
                            </Typography>
                        </CardContent>
                    </Card>
                </Grid>
                <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                    <Card>
                        <CardContent>
                            <Box display="flex" alignItems="center" gap={1} mb={1}>
                                <CommissionIcon color="warning" />
                                <Typography variant="body2" color="text.secondary">
                                    Platform Commission
                                </Typography>
                            </Box>
                            <Typography variant="h5" fontWeight={700}>
                                ₹{summary?.totalCommission?.toLocaleString('en-IN', { minimumFractionDigits: 2 }) ?? '0.00'}
                            </Typography>
                        </CardContent>
                    </Card>
                </Grid>
                <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                    <Card>
                        <CardContent>
                            <Box display="flex" alignItems="center" gap={1} mb={1}>
                                <NetIcon color="success" />
                                <Typography variant="body2" color="text.secondary">
                                    Net Earnings
                                </Typography>
                            </Box>
                            <Typography variant="h5" fontWeight={700}>
                                ₹{summary?.totalNetEarnings?.toLocaleString('en-IN', { minimumFractionDigits: 2 }) ?? '0.00'}
                            </Typography>
                        </CardContent>
                    </Card>
                </Grid>
                <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                    <Card>
                        <CardContent>
                            <Box display="flex" alignItems="center" gap={1} mb={1}>
                                <RequestIcon color="info" />
                                <Typography variant="body2" color="text.secondary">
                                    Pending Payout
                                </Typography>
                            </Box>
                            <Typography variant="h5" fontWeight={700}>
                                ₹{summary?.pendingPayoutAmount?.toLocaleString('en-IN', { minimumFractionDigits: 2 }) ?? '0.00'}
                            </Typography>
                        </CardContent>
                    </Card>
                </Grid>
            </Grid>

            {/* Bank account */}
            <Card sx={{ mb: 4 }}>
                <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
                    <BankIcon color="primary" />
                    <Box sx={{ flex: 1, minWidth: 220 }}>
                        <Typography variant="subtitle2" fontWeight={700}>Bank account</Typography>
                        <Typography variant="body2" color="text.secondary">
                            Payouts are transferred to the bank account on your profile.
                        </Typography>
                    </Box>
                    <Button variant="outlined" size="small" onClick={() => navigate('/profile')}>
                        Manage bank details
                    </Button>
                </CardContent>
            </Card>

            {/* Ledger — every payout, every state */}
            <Typography variant="h6" fontWeight={600} gutterBottom>
                Ledger
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
                Advances are recorded the moment a booking starts playing; final settlements when it
                completes, sized by actual delivery. Click a row to see that booking's full timeline.
            </Typography>

            {payoutsLoading ? (
                <Box display="flex" justifyContent="center" py={4}>
                    <CircularProgress />
                </Box>
            ) : !ledger?.length ? (
                <Alert severity="info">
                    Nothing here yet — your first advance is recorded automatically the moment a booking
                    on one of your screens starts playing.
                </Alert>
            ) : (
                <TableContainer component={Paper}>
                    <Table size="small">
                        <TableHead>
                            <TableRow>
                                <TableCell>Date</TableCell>
                                <TableCell>Booking</TableCell>
                                <TableCell>Type</TableCell>
                                <TableCell align="right">Gross</TableCell>
                                <TableCell align="right">Fee</TableCell>
                                <TableCell align="right">Net</TableCell>
                                <TableCell>Status</TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {ledger.map((p) => (
                                <TableRow
                                    key={p.id}
                                    hover={!!p.bookingId}
                                    sx={{ cursor: p.bookingId ? 'pointer' : 'default' }}
                                    onClick={() => p.bookingId && navigate(`/bookings/${p.bookingId}`)}
                                >
                                    <TableCell>
                                        {new Date(p.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                                    </TableCell>
                                    <TableCell>
                                        <Typography variant="body2" fontWeight={600} noWrap>{p.screenName}</Typography>
                                        {p.campaignName && (
                                            <Typography variant="caption" color="text.secondary" noWrap display="block">
                                                {p.campaignName}
                                            </Typography>
                                        )}
                                    </TableCell>
                                    <TableCell>
                                        <Chip
                                            size="small"
                                            variant="outlined"
                                            label={p.payoutType === 'Advance'
                                                ? `Advance ${p.advancePercentage.toFixed(0)}%`
                                                : p.payoutType === 'Final' ? 'Final settlement' : 'Full payout'}
                                        />
                                    </TableCell>
                                    <TableCell align="right">
                                        ₹{p.grossAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                    </TableCell>
                                    <TableCell align="right" sx={{ color: 'text.secondary' }}>
                                        −₹{p.commissionAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                        <Typography variant="caption" display="block" color="text.disabled">
                                            ({p.commissionPercentage}%)
                                        </Typography>
                                    </TableCell>
                                    <TableCell align="right" sx={{ fontWeight: 700 }}>
                                        ₹{p.netAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                    </TableCell>
                                    <TableCell>{getStatusChip(p.status)}</TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </TableContainer>
            )}

            {/* Request Payout Dialog */}
            <Dialog open={requestOpen} onClose={() => setRequestOpen(false)} maxWidth="xs" fullWidth>
                <DialogTitle>Request Payout</DialogTitle>
                <DialogContent>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                        Select the period for which you want to request a payout. Only completed (paid) bookings will be included.
                    </Typography>
                    <TextField
                        fullWidth
                        label="Period Start"
                        type="date"
                        value={periodStart}
                        onChange={(e) => setPeriodStart(e.target.value)}
                        slotProps={{ inputLabel: { shrink: true } }}
                        sx={{ mb: 2 }}
                    />
                    <TextField
                        fullWidth
                        label="Period End"
                        type="date"
                        value={periodEnd}
                        onChange={(e) => setPeriodEnd(e.target.value)}
                        slotProps={{ inputLabel: { shrink: true } }}
                    />
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setRequestOpen(false)}>Cancel</Button>
                    <Button
                        variant="contained"
                        onClick={() => requestMutation.mutate()}
                        disabled={!periodStart || !periodEnd || requestMutation.isPending}
                    >
                        {requestMutation.isPending ? <CircularProgress size={20} /> : 'Submit Request'}
                    </Button>
                </DialogActions>
            </Dialog>
        </Container>
    );
}
