import { useEffect, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getPaymentStatus } from '../services/paymentApi';

const POLL_INTERVAL_MS = 5000;

interface UsePaymentPollerOptions {
    bookingId: string;
    enabled: boolean;
    onConfirmed?: () => void;
}

export function usePaymentPoller({ bookingId, enabled, onConfirmed }: UsePaymentPollerOptions) {
    const queryClient = useQueryClient();
    const onConfirmedRef = useRef(onConfirmed);

    useEffect(() => {
        onConfirmedRef.current = onConfirmed;
    }, [onConfirmed]);

    const { data: paymentStatus, isLoading } = useQuery({
        queryKey: ['payment-status', bookingId],
        queryFn: () => getPaymentStatus(bookingId),
        enabled,
        refetchInterval: (query) => {
            const status = query.state.data?.paymentStatus;
            // Stop polling once captured, refunded, or expired
            if (status === 'Captured' || status === 'Refunded' || status === 'Expired') {
                return false;
            }
            return POLL_INTERVAL_MS;
        },
        staleTime: 0,
    });

    useEffect(() => {
        if (paymentStatus?.paymentStatus === 'Captured') {
            // Invalidate bookings cache so the list updates
            queryClient.invalidateQueries({ queryKey: ['bookings'] });
            queryClient.invalidateQueries({ queryKey: ['booking', bookingId] });
            onConfirmedRef.current?.();
        }
    }, [paymentStatus?.paymentStatus, bookingId, queryClient]);

    return {
        paymentStatus: paymentStatus?.paymentStatus ?? null,
        paymentMethod: paymentStatus?.paymentMethod ?? null,
        isLoading,
        isCaptured: paymentStatus?.paymentStatus === 'Captured',
    };
}
