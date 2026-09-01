import {
    Alert,
    Box,
    Card,
    CardContent,
    Chip,
    Divider,
    LinearProgress,
    Skeleton,
    Tooltip,
    Typography,
} from '@mui/material';
import type { ChipProps } from '@mui/material';
import PaymentsIcon from '@mui/icons-material/Payments';
import { useQuery } from '@tanstack/react-query';
import { isAxiosError } from 'axios';
import api from '../../services/api';

interface BookingPayoutEntry {
    id: string;
    type: 'Advance' | 'Final' | 'Full' | string;
    status: 'Pending' | 'Processing' | 'Completed' | 'Failed' | string;
    grossAmount: number;
    commissionAmount: number;
    netAmount: number;
    advancePercentage: number;
    adminNotes?: string | null;
    createdAt: string;
    processedAt?: string | null;
}

interface BookingEarnings {
    bookingId: string;
    bookingStatus: string;
    currency: string;
    grossAmount: number;
    commissionPercentage: number;
    commissionAmount: number;
    netToOwner: number;
    advancePercentage: number;
    isInternal: boolean;
    deliveredImpressions: number;
    expectedImpressions: number;
    deliveryPercentage: number;
    payouts: BookingPayoutEntry[];
}

const fmtMoney = (amount: number, currency: string) => {
    try {
        return new Intl.NumberFormat('en-IN', {
            style: 'currency',
            currency,
            maximumFractionDigits: Number.isInteger(amount) ? 0 : 2,
        }).format(amount);
    } catch {
        return `${currency} ${amount.toFixed(2)}`;
    }
};

const statusColor = (status: string): ChipProps['color'] =>
    status === 'Completed' ? 'success'
    : status === 'Failed' ? 'error'
    : status === 'Processing' ? 'info'
    : 'warning';

/**
 * Owner-side money view for one booking: the split (gross → commission → net),
 * delivery progress, and the advance/final payout timeline. Renders nothing
 * when the caller isn't allowed to see it (the API returns 403 for non-owners).
 */
export default function BookingEarningsCard({ bookingId }: { bookingId: string }) {
    const { data, isLoading, error } = useQuery({
        queryKey: ['booking-earnings', bookingId],
        queryFn: async (): Promise<BookingEarnings> => {
            const res = await api.get(`/payouts/bookings/${bookingId}`);
            return res.data.data;
        },
        enabled: !!bookingId,
        staleTime: 30 * 1000,
        retry: (failureCount, err) =>
            !(isAxiosError(err) && (err.response?.status === 403 || err.response?.status === 404)) && failureCount < 2,
    });

    // Not the owner (or booking gone): show nothing rather than an error box.
    if (error && isAxiosError(error) && (error.response?.status === 403 || error.response?.status === 404)) return null;

    if (isLoading) {
        return (
            <Card variant="outlined">
                <CardContent><Skeleton variant="rounded" height={140} /></CardContent>
            </Card>
        );
    }
    if (!data) return null;

    const advance = data.payouts.find((p) => p.type === 'Advance');
    const settlement = data.payouts.find((p) => p.type === 'Final' || p.type === 'Full');
    const deliveryKnown = data.expectedImpressions > 0;
    const isDone = data.bookingStatus === 'Completed';

    return (
        <Card variant="outlined">
            <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                    <PaymentsIcon color="primary" fontSize="small" />
                    <Typography variant="subtitle1" fontWeight={700}>Your earnings</Typography>
                </Box>

                {data.isInternal ? (
                    <Alert severity="info">
                        This is your own reserved slot — no payout applies to internal bookings.
                    </Alert>
                ) : (
                    <>
                        {/* The split */}
                        <Box sx={{ display: 'flex', gap: 3, flexWrap: 'wrap', mb: 2 }}>
                            <Box>
                                <Typography variant="overline" color="text.secondary">Booking value</Typography>
                                <Typography variant="h6" fontWeight={700}>{fmtMoney(data.grossAmount, data.currency)}</Typography>
                            </Box>
                            <Box>
                                <Typography variant="overline" color="text.secondary">Platform fee ({data.commissionPercentage}%)</Typography>
                                <Typography variant="h6" fontWeight={700} color="text.secondary">
                                    −{fmtMoney(data.commissionAmount, data.currency)}
                                </Typography>
                            </Box>
                            <Box>
                                <Typography variant="overline" color="text.secondary">You earn</Typography>
                                <Typography variant="h6" fontWeight={700} color="success.main">
                                    {fmtMoney(data.netToOwner, data.currency)}
                                </Typography>
                            </Box>
                        </Box>

                        {/* Delivery progress — what the final payout is sized by */}
                        {deliveryKnown && (
                            <Box sx={{ mb: 2 }}>
                                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                                    <Typography variant="body2" color="text.secondary">
                                        Delivery: {data.deliveredImpressions.toLocaleString()} / {data.expectedImpressions.toLocaleString()} plays
                                    </Typography>
                                    <Typography variant="body2" fontWeight={700}
                                        color={data.deliveryPercentage >= 95 ? 'success.main' : data.deliveryPercentage >= 80 ? 'warning.main' : 'error.main'}>
                                        {data.deliveryPercentage.toFixed(1)}%
                                    </Typography>
                                </Box>
                                <Tooltip title="Final payout is delivery-linked: 95%+ pays the full remainder, 80–94% pays pro-rata, below 80% is held for review." arrow>
                                    <LinearProgress
                                        variant="determinate"
                                        value={Math.min(100, data.deliveryPercentage)}
                                        color={data.deliveryPercentage >= 95 ? 'success' : data.deliveryPercentage >= 80 ? 'warning' : 'error'}
                                        sx={{ height: 8, borderRadius: 4 }}
                                    />
                                </Tooltip>
                            </Box>
                        )}

                        <Divider sx={{ mb: 2 }} />

                        {/* Payout timeline */}
                        <Box sx={{ display: 'grid', gap: 1.5 }}>
                            <PayoutStep
                                title={`Advance (${(advance?.advancePercentage ?? data.advancePercentage).toFixed(0)}% on activation)`}
                                entry={advance}
                                currency={data.currency}
                                pendingLabel={
                                    data.bookingStatus === 'Active' || isDone
                                        ? 'Being recorded…'
                                        : 'Recorded automatically when the campaign starts playing'
                                }
                            />
                            <PayoutStep
                                title="Final settlement (delivery-linked, on completion)"
                                entry={settlement}
                                currency={data.currency}
                                pendingLabel={
                                    isDone
                                        ? 'Being recorded…'
                                        : '95%+ delivery pays the full remainder · 80–94% pro-rata · below 80% held for review'
                                }
                            />
                        </Box>
                    </>
                )}
            </CardContent>
        </Card>
    );
}

function PayoutStep({ title, entry, currency, pendingLabel }: {
    title: string;
    entry?: BookingPayoutEntry;
    currency: string;
    pendingLabel: string;
}) {
    return (
        <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'flex-start' }}>
            <Box sx={{
                mt: 0.75, width: 10, height: 10, borderRadius: '50%', flexShrink: 0,
                bgcolor: entry
                    ? (entry.status === 'Completed' ? 'success.main' : entry.status === 'Failed' ? 'error.main' : 'warning.main')
                    : 'action.disabled',
            }} />
            <Box sx={{ flex: 1, minWidth: 0 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                    <Typography variant="body2" fontWeight={600}>{title}</Typography>
                    {entry && (
                        <>
                            <Typography variant="body2" fontWeight={700}>{fmtMoney(entry.netAmount, currency)}</Typography>
                            <Chip size="small" label={entry.status === 'Completed' ? 'Paid' : entry.status} color={statusColor(entry.status)} variant="outlined" />
                        </>
                    )}
                </Box>
                <Typography variant="caption" color="text.secondary">
                    {entry
                        ? (entry.adminNotes ||
                            (entry.processedAt
                                ? `Processed ${new Date(entry.processedAt).toLocaleDateString()}`
                                : `Recorded ${new Date(entry.createdAt).toLocaleDateString()}`))
                        : pendingLabel}
                </Typography>
            </Box>
        </Box>
    );
}
