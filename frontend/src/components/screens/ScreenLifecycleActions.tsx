import { useState } from 'react';
import { Box, Button, CircularProgress } from '@mui/material';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSnackbar } from 'notistack';
import { isAxiosError } from 'axios';
import api from '../../services/api';

interface LifecycleState {
    status: string;
    verificationStatus: string;
    isOnline: boolean;
    allowedActions: string[];
}

/**
 * Renders the lifecycle buttons for a screen — strictly from the server's
 * allowedActions list, never from client-side rules. Guard failures
 * (unverified, no device paired, active bookings blocking archive) come back
 * as plain-language errors and surface verbatim.
 */
const ACTION_META: Record<string, { label: string; color: 'primary' | 'warning' | 'error' | 'inherit'; confirm?: string }> = {
    SubmitForVerification: { label: 'Submit for verification', color: 'primary' },
    Activate: { label: 'Activate — open for booking', color: 'primary' },
    Pause: { label: 'Pause bookings', color: 'inherit' },
    Resume: { label: 'Resume', color: 'primary' },
    StartMaintenance: { label: 'Start maintenance', color: 'warning' },
    EndMaintenance: { label: 'End maintenance', color: 'primary' },
    Archive: {
        label: 'Archive',
        color: 'error',
        confirm: 'Archive this screen? It will be hidden everywhere. Booking history and earnings are preserved.',
    },
};

export default function ScreenLifecycleActions({ screenId }: { screenId: string }) {
    const queryClient = useQueryClient();
    const { enqueueSnackbar } = useSnackbar();
    const [pendingAction, setPendingAction] = useState<string | null>(null);

    const { data, isLoading } = useQuery({
        queryKey: ['screen-lifecycle', screenId],
        queryFn: async (): Promise<LifecycleState> =>
            (await api.get(`/screens/${screenId}/lifecycle`)).data.data,
    });

    const transition = useMutation({
        mutationFn: async (action: string) =>
            (await api.post(`/screens/${screenId}/lifecycle/${action}`, {})).data.data,
        onSuccess: (result: { status: string }) => {
            enqueueSnackbar(`Screen is now ${result.status}`, { variant: 'success' });
            queryClient.invalidateQueries({ queryKey: ['screen-lifecycle', screenId] });
            queryClient.invalidateQueries({ queryKey: ['screen', screenId] });
            queryClient.invalidateQueries({ queryKey: ['screens'] });
        },
        onError: (err: unknown) => {
            const message = (isAxiosError<{ message?: string }>(err) ? err.response?.data?.message : undefined)
                ?? 'That action is not available right now.';
            enqueueSnackbar(message, { variant: 'error' });
        },
        onSettled: () => setPendingAction(null),
    });

    if (isLoading || !data) return null;

    return (
        <Box display="flex" gap={1} flexWrap="wrap">
            {data.allowedActions.map((action) => {
                const meta = ACTION_META[action] ?? { label: action, color: 'inherit' as const };
                const busy = pendingAction === action && transition.isPending;
                return (
                    <Button
                        key={action}
                        size="small"
                        variant={meta.color === 'primary' ? 'contained' : 'outlined'}
                        color={meta.color === 'inherit' ? 'inherit' : meta.color}
                        disabled={transition.isPending}
                        startIcon={busy ? <CircularProgress size={14} color="inherit" /> : undefined}
                        onClick={() => {
                            if (meta.confirm && !window.confirm(meta.confirm)) return;
                            setPendingAction(action);
                            transition.mutate(action);
                        }}
                    >
                        {meta.label}
                    </Button>
                );
            })}
            <ResetDeviceBindingButton screenId={screenId} />
        </Box>
    );
}

/**
 * Owner escape hatch for the "device fingerprint does not match" handshake
 * failure — replaced player hardware, or fingerprint drift on old player
 * builds. Files an override request; the next player handshake rebinds to the
 * new device and the override is consumed. Backed by the existing
 * /devices/{id}/override endpoint, which until now had no UI at all.
 */
function ResetDeviceBindingButton({ screenId }: { screenId: string }) {
    const { enqueueSnackbar } = useSnackbar();
    const reset = useMutation({
        mutationFn: async (reason: string) =>
            (await api.post(`/devices/${screenId}/override`, { reason })).data,
        onSuccess: () => enqueueSnackbar(
            'Device binding reset. Restart the player — it will re-pair on its next handshake.',
            { variant: 'success' }),
        onError: (err: unknown) => {
            const message = (isAxiosError<{ message?: string }>(err) ? err.response?.data?.message : undefined)
                ?? 'Could not reset the device binding.';
            enqueueSnackbar(message, { variant: 'error' });
        },
    });

    return (
        <Button
            size="small"
            variant="outlined"
            color="inherit"
            disabled={reset.isPending}
            onClick={() => {
                const reason = window.prompt(
                    'Reset device binding?\n\nUse this when the player hardware was replaced or the player reports a device mismatch. Briefly say why:');
                if (reason && reason.trim()) reset.mutate(reason.trim());
            }}
        >
            Reset device binding
        </Button>
    );
}
