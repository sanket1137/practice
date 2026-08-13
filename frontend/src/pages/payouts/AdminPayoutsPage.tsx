import { useState } from 'react';
import {
    Box, Typography, Card, CardContent, Grid, Button, Table, TableBody,
    TableCell, TableContainer, TableHead, TableRow, Chip, Paper,
    CircularProgress, Dialog, DialogTitle, DialogContent, DialogActions,
    TextField, Alert, Tabs, Tab,
} from '@mui/material';
import type { ChipProps } from '@mui/material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSnackbar } from 'notistack';
import { isAxiosError } from 'axios';
import {
    getPendingPayouts, processPayout, failPayout,
    releaseFinalPayout, getDeliverySummary, getAdminPayoutHistory,
} from '../../services/profileApi';
import type { PendingPayout, DeliverySummary } from '../../types/profile';

// Simple browser fingerprint for admin machine auth
function getBrowserFingerprint(): string {
    const nav = navigator;
    const raw = [
        nav.userAgent,
        nav.language,
        screen.width + 'x' + screen.height,
        Intl.DateTimeFormat().resolvedOptions().timeZone,
        nav.hardwareConcurrency,
    ].join('|');
    return raw;
}

function getErrorMessage(err: unknown, fallback: string): string {
    if (isAxiosError(err)) {
        const message = (err.response?.data as { message?: string } | undefined)?.message;
        if (message) return message;
    }
    return fallback;
}

export default function AdminPayoutsPage() {
    const { enqueueSnackbar } = useSnackbar();
    const queryClient = useQueryClient();
    const [tab, setTab] = useState(0);
    const [selectedPayout, setSelectedPayout] = useState<PendingPayout | null>(null);
    const [deliverySummary, setDeliverySummary] = useState<DeliverySummary | null>(null);
    const [processDialogOpen, setProcessDialogOpen] = useState(false);
    const [failDialogOpen, setFailDialogOpen] = useState(false);
    const [releaseDialogOpen, setReleaseDialogOpen] = useState(false);
    const [failReason, setFailReason] = useState('');
    const [adjustedAmount, setAdjustedAmount] = useState('');
    const [adminNotes, setAdminNotes] = useState('');

    const fingerprint = getBrowserFingerprint();

    const { data: pendingPayouts, isLoading: pendingLoading } = useQuery({
        queryKey: ['admin-pending-payouts'],
        queryFn: getPendingPayouts,
    });

    const { data: history, isLoading: historyLoading } = useQuery({
        queryKey: ['admin-payout-history'],
        queryFn: getAdminPayoutHistory,
    });

    const processMutation = useMutation({
        mutationFn: ({ id, notes }: { id: string; notes?: string }) =>
            processPayout(id, fingerprint, notes),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['admin-pending-payouts'] });
            queryClient.invalidateQueries({ queryKey: ['admin-payout-history'] });
            setProcessDialogOpen(false);
            enqueueSnackbar('Payout processed successfully', { variant: 'success' });
        },
        onError: (err: unknown) => {
            enqueueSnackbar(getErrorMessage(err, 'Failed to process payout'), { variant: 'error' });
        },
    });

    const failMutation = useMutation({
        mutationFn: ({ id, reason }: { id: string; reason: string }) =>
            failPayout(id, fingerprint, reason),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['admin-pending-payouts'] });
            setFailDialogOpen(false);
            setFailReason('');
            enqueueSnackbar('Payout marked as failed', { variant: 'info' });
        },
        onError: (err: unknown) => {
            enqueueSnackbar(getErrorMessage(err, 'Failed to update payout'), { variant: 'error' });
        },
    });

    const releaseMutation = useMutation({
        mutationFn: ({ bookingId, amount, notes }: { bookingId: string; amount?: number; notes?: string }) =>
            releaseFinalPayout(bookingId, fingerprint, amount, notes),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['admin-pending-payouts'] });
            setReleaseDialogOpen(false);
            setAdjustedAmount('');
            setAdminNotes('');
            enqueueSnackbar('Final payout released', { variant: 'success' });
        },
        onError: (err: unknown) => {
            enqueueSnackbar(getErrorMessage(err, 'Failed to release final payout'), { variant: 'error' });
        },
    });

    const handleViewDelivery = async (bookingId: string) => {
        try {
            const summary = await getDeliverySummary(bookingId);
            setDeliverySummary(summary);
            setReleaseDialogOpen(true);
        } catch {
            enqueueSnackbar('Failed to load delivery summary', { variant: 'error' });
        }
    };

    const statusColor = (status: string): ChipProps['color'] => {
        switch (status) {
            case 'Pending': return 'warning';
            case 'Completed': return 'success';
            case 'Failed': return 'error';
            default: return 'default';
        }
    };

    return (
        <Box>
            <Box
                sx={{
                    p: { xs: 2.5, md: 3.5 },
                    mb: 3,
                    borderRadius: 3,
                    background:
                        'radial-gradient(900px 340px at 100% -8%, rgba(10,102,216,0.12), transparent 60%), #ffffff',
                    border: '1px solid rgba(16, 24, 40, 0.08)',
                    boxShadow: '0 8px 24px rgba(16, 24, 40, 0.06)',
                }}
            >
                <Typography variant="h4" gutterBottom sx={{ mb: 0.5 }}>Payout management</Typography>
                <Typography variant="body1" color="text.secondary">
                    Review and process payout requests across the platform.
                </Typography>
            </Box>

            <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 3 }}>
                <Tab label={`Pending (${pendingPayouts?.length || 0})`} />
                <Tab label="History" />
            </Tabs>

            {/* Pending Payouts Tab */}
            {tab === 0 && (
                <TableContainer component={Paper}>
                    {pendingLoading ? (
                        <Box display="flex" justifyContent="center" py={4}><CircularProgress /></Box>
                    ) : !pendingPayouts?.length ? (
                        <Alert severity="info" sx={{ m: 2 }}>No pending payouts</Alert>
                    ) : (
                        <Table>
                            <TableHead>
                                <TableRow>
                                    <TableCell>Owner</TableCell>
                                    <TableCell>Screen</TableCell>
                                    <TableCell>Type</TableCell>
                                    <TableCell align="right">Gross</TableCell>
                                    <TableCell align="right">Net</TableCell>
                                    <TableCell>Bank</TableCell>
                                    <TableCell>Created</TableCell>
                                    <TableCell>Actions</TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {pendingPayouts.map((payout) => (
                                    <TableRow key={payout.id}>
                                        <TableCell>{payout.ownerName}</TableCell>
                                        <TableCell>{payout.screenName}</TableCell>
                                        <TableCell>
                                            <Chip
                                                label={payout.type}
                                                size="small"
                                                color={payout.type === 'Advance' ? 'info' : 'primary'}
                                            />
                                        </TableCell>
                                        <TableCell align="right">{payout.currency} {payout.grossAmount.toFixed(2)}</TableCell>
                                        <TableCell align="right">{payout.currency} {payout.netAmount.toFixed(2)}</TableCell>
                                        <TableCell>
                                            {payout.bankAccountOnFile
                                                ? <Chip label="On file" color="success" size="small" />
                                                : <Chip label="Missing" color="error" size="small" />}
                                        </TableCell>
                                        <TableCell>{new Date(payout.createdAt).toLocaleDateString()}</TableCell>
                                        <TableCell>
                                            <Box display="flex" gap={1}>
                                                <Button
                                                    size="small"
                                                    variant="contained"
                                                    color="success"
                                                    disabled={!payout.bankAccountOnFile}
                                                    onClick={() => {
                                                        setSelectedPayout(payout);
                                                        setProcessDialogOpen(true);
                                                    }}
                                                >
                                                    Process
                                                </Button>
                                                <Button
                                                    size="small"
                                                    variant="outlined"
                                                    color="error"
                                                    onClick={() => {
                                                        setSelectedPayout(payout);
                                                        setFailDialogOpen(true);
                                                    }}
                                                >
                                                    Fail
                                                </Button>
                                                {payout.type === 'Advance' && payout.bookingId && (
                                                    <Button
                                                        size="small"
                                                        variant="outlined"
                                                        onClick={() => handleViewDelivery(payout.bookingId!)}
                                                    >
                                                        Review
                                                    </Button>
                                                )}
                                            </Box>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    )}
                </TableContainer>
            )}

            {/* History Tab */}
            {tab === 1 && (
                <TableContainer component={Paper}>
                    {historyLoading ? (
                        <Box display="flex" justifyContent="center" py={4}><CircularProgress /></Box>
                    ) : !history?.length ? (
                        <Alert severity="info" sx={{ m: 2 }}>No payout history</Alert>
                    ) : (
                        <Table>
                            <TableHead>
                                <TableRow>
                                    <TableCell>Type</TableCell>
                                    <TableCell>Booking</TableCell>
                                    <TableCell align="right">Gross</TableCell>
                                    <TableCell align="right">Commission</TableCell>
                                    <TableCell align="right">Net</TableCell>
                                    <TableCell>Status</TableCell>
                                    <TableCell>Created</TableCell>
                                    <TableCell>Processed</TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {history.map((p) => (
                                    <TableRow key={p.id}>
                                        <TableCell>
                                            <Chip label={p.type || 'Full'} size="small" />
                                        </TableCell>
                                        <TableCell sx={{ fontFamily: 'monospace', fontSize: '0.75rem' }}>
                                            {p.bookingId?.slice(0, 8) || '—'}
                                        </TableCell>
                                        <TableCell align="right">{p.currency} {p.grossAmount.toFixed(2)}</TableCell>
                                        <TableCell align="right">{p.commissionPercentage}%</TableCell>
                                        <TableCell align="right">{p.currency} {p.netAmount.toFixed(2)}</TableCell>
                                        <TableCell>
                                            <Chip label={p.status} size="small" color={statusColor(p.status)} />
                                        </TableCell>
                                        <TableCell>{new Date(p.createdAt).toLocaleDateString()}</TableCell>
                                        <TableCell>{p.processedAt ? new Date(p.processedAt).toLocaleDateString() : '—'}</TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    )}
                </TableContainer>
            )}

            {/* Process Payout Dialog */}
            <Dialog open={processDialogOpen} onClose={() => setProcessDialogOpen(false)} maxWidth="sm" fullWidth>
                <DialogTitle>Process Payout</DialogTitle>
                <DialogContent>
                    {selectedPayout && (
                        <Box>
                            <Typography>Owner: <strong>{selectedPayout.ownerName}</strong></Typography>
                            <Typography>Net Amount: <strong>{selectedPayout.currency} {selectedPayout.netAmount.toFixed(2)}</strong></Typography>
                            <Typography variant="body2" color="text.secondary" mt={1}>
                                This will mark the payout as completed and notify the screen owner.
                            </Typography>
                        </Box>
                    )}
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setProcessDialogOpen(false)}>Cancel</Button>
                    <Button
                        variant="contained"
                        color="success"
                        onClick={() => selectedPayout && processMutation.mutate({ id: selectedPayout.id })}
                        disabled={processMutation.isPending}
                    >
                        {processMutation.isPending ? 'Processing...' : 'Confirm Process'}
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Fail Payout Dialog */}
            <Dialog open={failDialogOpen} onClose={() => setFailDialogOpen(false)} maxWidth="sm" fullWidth>
                <DialogTitle>Mark Payout as Failed</DialogTitle>
                <DialogContent>
                    <TextField
                        label="Reason"
                        fullWidth
                        multiline
                        rows={3}
                        sx={{ mt: 1 }}
                        value={failReason}
                        onChange={(e) => setFailReason(e.target.value)}
                    />
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setFailDialogOpen(false)}>Cancel</Button>
                    <Button
                        variant="contained"
                        color="error"
                        onClick={() => selectedPayout && failMutation.mutate({ id: selectedPayout.id, reason: failReason })}
                        disabled={failMutation.isPending || !failReason}
                    >
                        {failMutation.isPending ? 'Updating...' : 'Confirm Fail'}
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Release Final Payout Dialog with Delivery Summary */}
            <Dialog open={releaseDialogOpen} onClose={() => setReleaseDialogOpen(false)} maxWidth="md" fullWidth>
                <DialogTitle>Delivery Summary & Final Payout</DialogTitle>
                <DialogContent>
                    {deliverySummary ? (
                        <Box>
                            <Grid container spacing={2} sx={{ mb: 2 }}>
                                <Grid size={{ xs: 6, sm: 3 }}>
                                    <Card variant="outlined">
                                        <CardContent sx={{ textAlign: 'center', py: 1 }}>
                                            <Typography variant="caption" color="text.secondary">Delivered</Typography>
                                            <Typography variant="h6">{deliverySummary.deliveredImpressions}</Typography>
                                        </CardContent>
                                    </Card>
                                </Grid>
                                <Grid size={{ xs: 6, sm: 3 }}>
                                    <Card variant="outlined">
                                        <CardContent sx={{ textAlign: 'center', py: 1 }}>
                                            <Typography variant="caption" color="text.secondary">Expected</Typography>
                                            <Typography variant="h6">{deliverySummary.expectedImpressions}</Typography>
                                        </CardContent>
                                    </Card>
                                </Grid>
                                <Grid size={{ xs: 6, sm: 3 }}>
                                    <Card variant="outlined">
                                        <CardContent sx={{ textAlign: 'center', py: 1 }}>
                                            <Typography variant="caption" color="text.secondary">Delivery Rate</Typography>
                                            <Typography variant="h6" color={deliverySummary.deliveryRate >= 80 ? 'success.main' : 'warning.main'}>
                                                {deliverySummary.deliveryRate}%
                                            </Typography>
                                        </CardContent>
                                    </Card>
                                </Grid>
                                <Grid size={{ xs: 6, sm: 3 }}>
                                    <Card variant="outlined">
                                        <CardContent sx={{ textAlign: 'center', py: 1 }}>
                                            <Typography variant="caption" color="text.secondary">Active Days</Typography>
                                            <Typography variant="h6">{deliverySummary.activeDays}/{deliverySummary.totalDays}</Typography>
                                        </CardContent>
                                    </Card>
                                </Grid>
                            </Grid>

                            <Alert severity="info" sx={{ mb: 2 }}>
                                Total Price: {deliverySummary.currency} {deliverySummary.totalPrice.toFixed(2)} |
                                Advance Paid: {deliverySummary.currency} {deliverySummary.advancePaid.toFixed(2)} |
                                Remaining: {deliverySummary.currency} {deliverySummary.remainingAmount.toFixed(2)}
                            </Alert>

                            <TextField
                                label="Adjusted Final Amount (optional)"
                                fullWidth
                                type="number"
                                sx={{ mb: 2 }}
                                value={adjustedAmount}
                                onChange={(e) => setAdjustedAmount(e.target.value)}
                                placeholder={deliverySummary.remainingAmount.toFixed(2)}
                                helperText="Leave empty to use the calculated remaining amount"
                            />
                            <TextField
                                label="Admin Notes"
                                fullWidth
                                multiline
                                rows={2}
                                value={adminNotes}
                                onChange={(e) => setAdminNotes(e.target.value)}
                            />
                        </Box>
                    ) : (
                        <Box display="flex" justifyContent="center" py={4}><CircularProgress /></Box>
                    )}
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setReleaseDialogOpen(false)}>Cancel</Button>
                    <Button
                        variant="contained"
                        color="primary"
                        disabled={releaseMutation.isPending || !deliverySummary}
                        onClick={() => deliverySummary && releaseMutation.mutate({
                            bookingId: deliverySummary.bookingId,
                            amount: adjustedAmount ? parseFloat(adjustedAmount) : undefined,
                            notes: adminNotes || undefined,
                        })}
                    >
                        {releaseMutation.isPending ? 'Releasing...' : 'Release Final Payout'}
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
}
