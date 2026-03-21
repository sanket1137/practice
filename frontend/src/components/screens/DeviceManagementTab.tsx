import { useState } from 'react';
import {
    Box,
    Typography,
    Paper,
    Button,
    Chip,
    Alert,
    CircularProgress,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    TextField,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Divider,
    Tooltip,
} from '@mui/material';
import {
    DevicesOther as DeviceIcon,
    LinkOff as UnlinkIcon,
    SwapHoriz as SwapIcon,
    History as HistoryIcon,
    CheckCircle as BoundIcon,
    Cancel as UnboundIcon,
    Timer as PendingIcon,
    Warning as WarningIcon,
} from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../services/api';
import { useSnackbar } from 'notistack';
import { useAuthStore } from '../../store/authStore';

interface DeviceBindingStatus {
    screenId: string;
    screenName: string;
    isBound: boolean;
    boundAt: string | null;
    lastVerification: string | null;
    hasPendingOverride: boolean;
    pendingOverrideExpiresAt: string | null;
    lastOverrideReason: string | null;
    lastOverrideAt: string | null;
    lastOverrideByUserId: string | null;
}

interface DeviceOverrideResult {
    success: boolean;
    reason: string;
    expiresAt: string | null;
}

interface DeviceOverrideHistoryItem {
    id: string;
    screenId: string;
    action: string;
    reason: string;
    oldFingerprintPrefix: string | null;
    newFingerprintPrefix: string | null;
    requestedByUserId: string;
    performedAt: string;
}

interface DeviceManagementTabProps {
    screenId: string;
}

export default function DeviceManagementTab({ screenId }: DeviceManagementTabProps) {
    const { enqueueSnackbar } = useSnackbar();
    const queryClient = useQueryClient();
    const user = useAuthStore((state) => state.user);
    const isAdmin = user?.role === 'Admin';

    const [overrideDialogOpen, setOverrideDialogOpen] = useState(false);
    const [clearDialogOpen, setClearDialogOpen] = useState(false);
    const [overrideReason, setOverrideReason] = useState('');

    // Fetch binding status
    const { data: bindingStatus, isLoading: statusLoading } = useQuery<DeviceBindingStatus>({
        queryKey: ['device-binding', screenId],
        queryFn: async () => {
            const response = await api.get(`/devices/${screenId}/binding`);
            return response.data.data;
        },
        refetchInterval: 30000, // Poll every 30s to track pending override countdown
    });

    // Fetch override history
    const { data: history = [], isLoading: historyLoading } = useQuery<DeviceOverrideHistoryItem[]>({
        queryKey: ['device-history', screenId],
        queryFn: async () => {
            const response = await api.get(`/devices/${screenId}/history`);
            return response.data.data;
        },
    });

    // Override mutation
    const overrideMutation = useMutation<DeviceOverrideResult>({
        mutationFn: async () => {
            const response = await api.post(`/devices/${screenId}/override`, { reason: overrideReason });
            return response.data.data;
        },
        onSuccess: (data) => {
            enqueueSnackbar(data.reason, { variant: 'success' });
            setOverrideDialogOpen(false);
            setOverrideReason('');
            queryClient.invalidateQueries({ queryKey: ['device-binding', screenId] });
            queryClient.invalidateQueries({ queryKey: ['device-history', screenId] });
        },
        onError: (error: any) => {
            enqueueSnackbar(
                error.response?.data?.message || 'Failed to request device override',
                { variant: 'error' }
            );
        },
    });

    // Clear binding mutation (admin only)
    const clearMutation = useMutation({
        mutationFn: async () => {
            await api.post(`/devices/${screenId}/clear`);
        },
        onSuccess: () => {
            enqueueSnackbar('Device binding cleared successfully', { variant: 'success' });
            setClearDialogOpen(false);
            queryClient.invalidateQueries({ queryKey: ['device-binding', screenId] });
            queryClient.invalidateQueries({ queryKey: ['device-history', screenId] });
        },
        onError: (error: any) => {
            enqueueSnackbar(
                error.response?.data?.message || 'Failed to clear device binding',
                { variant: 'error' }
            );
        },
    });

    const formatDate = (dateStr: string | null) => {
        if (!dateStr) return '—';
        return new Date(dateStr).toLocaleString();
    };

    const getActionColor = (action: string) => {
        switch (action) {
            case 'First_Binding': return 'success';
            case 'Override_Requested': return 'warning';
            case 'Override_Applied': return 'info';
            case 'Binding_Cleared': return 'error';
            default: return 'default';
        }
    };

    const getRemainingTime = () => {
        if (!bindingStatus?.pendingOverrideExpiresAt) return null;
        const expires = new Date(bindingStatus.pendingOverrideExpiresAt).getTime();
        const now = Date.now();
        const remaining = Math.max(0, Math.floor((expires - now) / 60000));
        return remaining;
    };

    if (statusLoading) {
        return (
            <Box display="flex" justifyContent="center" p={4}>
                <CircularProgress />
            </Box>
        );
    }

    return (
        <Box>
            <Typography variant="h6" gutterBottom>
                Device Management
            </Typography>
            <Typography variant="body2" color="textSecondary" paragraph>
                Manage the player device bound to this screen. Each screen is locked to a
                specific hardware device for security.
            </Typography>

            {/* Binding Status Card */}
            <Paper sx={{ p: 3, mb: 3 }}>
                <Box display="flex" alignItems="center" gap={1} mb={2}>
                    <DeviceIcon color="primary" />
                    <Typography variant="h6">Binding Status</Typography>
                </Box>

                <Box display="flex" flexDirection="column" gap={2}>
                    {/* Status indicator */}
                    <Box display="flex" alignItems="center" gap={2}>
                        <Typography variant="subtitle2" sx={{ minWidth: 140 }}>Status:</Typography>
                        {bindingStatus?.isBound ? (
                            <Chip icon={<BoundIcon />} label="Device Bound" color="success" />
                        ) : (
                            <Chip icon={<UnboundIcon />} label="No Device Bound" color="default" />
                        )}
                    </Box>

                    {bindingStatus?.isBound && (
                        <>
                            <Box display="flex" alignItems="center" gap={2}>
                                <Typography variant="subtitle2" sx={{ minWidth: 140 }}>Bound Since:</Typography>
                                <Typography variant="body2">{formatDate(bindingStatus.boundAt)}</Typography>
                            </Box>
                            <Box display="flex" alignItems="center" gap={2}>
                                <Typography variant="subtitle2" sx={{ minWidth: 140 }}>Last Verified:</Typography>
                                <Typography variant="body2">{formatDate(bindingStatus.lastVerification)}</Typography>
                            </Box>
                        </>
                    )}

                    {/* Pending override alert */}
                    {bindingStatus?.hasPendingOverride && (
                        <Alert severity="warning" icon={<PendingIcon />}>
                            Override window is active! A new device can connect within{' '}
                            <strong>{getRemainingTime()} minutes</strong>.
                            {bindingStatus.pendingOverrideExpiresAt && (
                                <> Expires at {formatDate(bindingStatus.pendingOverrideExpiresAt)}.</>
                            )}
                        </Alert>
                    )}

                    {/* Last override info */}
                    {bindingStatus?.lastOverrideReason && (
                        <Box display="flex" alignItems="center" gap={2}>
                            <Typography variant="subtitle2" sx={{ minWidth: 140 }}>Last Override:</Typography>
                            <Typography variant="body2">
                                {bindingStatus.lastOverrideReason} — {formatDate(bindingStatus.lastOverrideAt)}
                            </Typography>
                        </Box>
                    )}
                </Box>

                <Divider sx={{ my: 2 }} />

                {/* Actions */}
                <Box display="flex" gap={2} flexWrap="wrap">
                    <Tooltip title="Opens a 30-minute window for a new device to register">
                        <Button
                            variant="outlined"
                            color="warning"
                            startIcon={<SwapIcon />}
                            onClick={() => setOverrideDialogOpen(true)}
                            disabled={bindingStatus?.hasPendingOverride || overrideMutation.isPending}
                        >
                            {bindingStatus?.hasPendingOverride ? 'Override Active' : 'Request Device Override'}
                        </Button>
                    </Tooltip>

                    {isAdmin && (
                        <Tooltip title="Completely remove device binding (Admin only)">
                            <Button
                                variant="outlined"
                                color="error"
                                startIcon={<UnlinkIcon />}
                                onClick={() => setClearDialogOpen(true)}
                                disabled={!bindingStatus?.isBound || clearMutation.isPending}
                            >
                                Clear Binding
                            </Button>
                        </Tooltip>
                    )}
                </Box>
            </Paper>

            {/* Override History */}
            <Paper sx={{ p: 3 }}>
                <Box display="flex" alignItems="center" gap={1} mb={2}>
                    <HistoryIcon color="primary" />
                    <Typography variant="h6">Device History</Typography>
                </Box>

                {historyLoading ? (
                    <CircularProgress size={24} />
                ) : history.length === 0 ? (
                    <Typography variant="body2" color="textSecondary">
                        No device binding history yet.
                    </Typography>
                ) : (
                    <TableContainer>
                        <Table size="small">
                            <TableHead>
                                <TableRow>
                                    <TableCell>Date</TableCell>
                                    <TableCell>Action</TableCell>
                                    <TableCell>Reason</TableCell>
                                    <TableCell>Old Device</TableCell>
                                    <TableCell>New Device</TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {history.map((entry) => (
                                    <TableRow key={entry.id}>
                                        <TableCell sx={{ whiteSpace: 'nowrap' }}>
                                            {formatDate(entry.performedAt)}
                                        </TableCell>
                                        <TableCell>
                                            <Chip
                                                label={entry.action.replace(/_/g, ' ')}
                                                size="small"
                                                color={getActionColor(entry.action) as any}
                                                variant="outlined"
                                            />
                                        </TableCell>
                                        <TableCell>{entry.reason}</TableCell>
                                        <TableCell>
                                            <Typography variant="caption" fontFamily="monospace">
                                                {entry.oldFingerprintPrefix || '—'}
                                            </Typography>
                                        </TableCell>
                                        <TableCell>
                                            <Typography variant="caption" fontFamily="monospace">
                                                {entry.newFingerprintPrefix || '—'}
                                            </Typography>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </TableContainer>
                )}
            </Paper>

            {/* Override Request Dialog */}
            <Dialog
                open={overrideDialogOpen}
                onClose={() => setOverrideDialogOpen(false)}
                maxWidth="sm"
                fullWidth
            >
                <DialogTitle>
                    <Box display="flex" alignItems="center" gap={1}>
                        <WarningIcon color="warning" />
                        Request Device Override
                    </Box>
                </DialogTitle>
                <DialogContent>
                    <Typography variant="body2" paragraph sx={{ mt: 1 }}>
                        This will open a <strong>30-minute window</strong> for a new player device
                        to connect and bind to this screen. The current device binding will be
                        replaced when the new device connects.
                    </Typography>
                    <Alert severity="info" sx={{ mb: 2 }}>
                        Use this when replacing a Raspberry Pi or Android player device with new hardware.
                    </Alert>
                    <TextField
                        label="Reason for Override"
                        fullWidth
                        required
                        multiline
                        rows={2}
                        value={overrideReason}
                        onChange={(e) => setOverrideReason(e.target.value)}
                        placeholder="e.g., Replacing damaged Pi with new unit"
                        helperText="Provide a brief reason for the audit trail"
                    />
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setOverrideDialogOpen(false)}>Cancel</Button>
                    <Button
                        onClick={() => overrideMutation.mutate()}
                        variant="contained"
                        color="warning"
                        disabled={!overrideReason.trim() || overrideMutation.isPending}
                    >
                        {overrideMutation.isPending ? 'Requesting...' : 'Confirm Override'}
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Clear Binding Confirmation Dialog */}
            <Dialog open={clearDialogOpen} onClose={() => setClearDialogOpen(false)}>
                <DialogTitle>Clear Device Binding?</DialogTitle>
                <DialogContent>
                    <Typography variant="body2">
                        This will completely remove the device fingerprint binding for this screen.
                        The next device to connect will automatically be bound.
                    </Typography>
                    <Alert severity="error" sx={{ mt: 2 }}>
                        This action is admin-only and cannot be undone. Only use this if
                        the override flow is insufficient (e.g., lost device, corrupted fingerprint).
                    </Alert>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setClearDialogOpen(false)}>Cancel</Button>
                    <Button
                        onClick={() => clearMutation.mutate()}
                        variant="contained"
                        color="error"
                        disabled={clearMutation.isPending}
                    >
                        {clearMutation.isPending ? 'Clearing...' : 'Clear Binding'}
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
}
