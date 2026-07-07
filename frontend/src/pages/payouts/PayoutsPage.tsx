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
} from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSnackbar } from 'notistack';
import {
    getPayoutSummary,
    getPayoutHistory,
    requestPayout,
} from '../../services/paymentApi';

export default function PayoutsPage() {
    const { enqueueSnackbar } = useSnackbar();
    const queryClient = useQueryClient();
    const [requestOpen, setRequestOpen] = useState(false);
    const [periodStart, setPeriodStart] = useState('');
    const [periodEnd, setPeriodEnd] = useState('');

    const { data: summary, isLoading: summaryLoading } = useQuery({
        queryKey: ['payout-summary'],
        queryFn: getPayoutSummary,
    });

    const { data: payouts, isLoading: payoutsLoading } = useQuery({
        queryKey: ['payout-history'],
        queryFn: () => getPayoutHistory(1, 50),
    });

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
                        'radial-gradient(900px 340px at 100% -8%, rgba(10,102,216,0.12), transparent 60%), #ffffff',
                    border: '1px solid rgba(16, 24, 40, 0.08)',
                    boxShadow: '0 8px 24px rgba(16, 24, 40, 0.06)',
                    display: 'flex',
                    flexDirection: { xs: 'column', sm: 'row' },
                    justifyContent: 'space-between',
                    alignItems: { xs: 'flex-start', sm: 'center' },
                    gap: 2,
                }}
            >
                <Box>
                    <Typography variant="h4" gutterBottom sx={{ mb: 0.5 }}>Payouts</Typography>
                    <Typography variant="body1" color="text.secondary">
                        Request and track your screen earnings payouts.
                    </Typography>
                </Box>
                <Button
                    variant="contained"
                    startIcon={<RequestIcon />}
                    onClick={() => setRequestOpen(true)}
                >
                    Request payout
                </Button>
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

            {/* Payout History */}
            <Typography variant="h6" fontWeight={600} gutterBottom>
                Payout History
            </Typography>

            {payoutsLoading ? (
                <Box display="flex" justifyContent="center" py={4}>
                    <CircularProgress />
                </Box>
            ) : !payouts?.length ? (
                <Alert severity="info">No payouts yet. Request your first payout above.</Alert>
            ) : (
                <TableContainer component={Paper}>
                    <Table>
                        <TableHead>
                            <TableRow>
                                <TableCell>Period</TableCell>
                                <TableCell align="right">Gross</TableCell>
                                <TableCell align="right">Commission</TableCell>
                                <TableCell align="right">Net Amount</TableCell>
                                <TableCell>Status</TableCell>
                                <TableCell>Requested</TableCell>
                                <TableCell>Processed</TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {payouts.map((p) => (
                                <TableRow key={p.id}>
                                    <TableCell>
                                        {new Date(p.periodStart).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })}
                                        {' – '}
                                        {new Date(p.periodEnd).toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' })}
                                    </TableCell>
                                    <TableCell align="right">
                                        ₹{p.grossAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                    </TableCell>
                                    <TableCell align="right" sx={{ color: 'text.secondary' }}>
                                        ₹{p.commissionAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                        <Typography variant="caption" display="block" color="text.disabled">
                                            ({p.commissionPercentage}%)
                                        </Typography>
                                    </TableCell>
                                    <TableCell align="right" sx={{ fontWeight: 600 }}>
                                        ₹{p.netAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                    </TableCell>
                                    <TableCell>{getStatusChip(p.status)}</TableCell>
                                    <TableCell>
                                        {new Date(p.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                                    </TableCell>
                                    <TableCell>
                                        {p.processedAt
                                            ? new Date(p.processedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
                                            : '—'}
                                    </TableCell>
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
