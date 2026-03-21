import { useState } from 'react';
import {
    Box, Typography, Card, CardContent, Grid, Button, Table, TableBody,
    TableCell, TableContainer, TableHead, TableRow, Chip, Paper,
    CircularProgress, Dialog, DialogTitle, DialogContent, DialogActions,
    TextField, Alert, IconButton, Tooltip,
} from '@mui/material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSnackbar } from 'notistack';
import {
    getAllMachines, getMyMachines, authorizeMachine,
    revokeMachine, checkMachineStatus,
} from '../../services/profileApi';
import type { AdminMachine, MachineStatusResponse } from '../../types/profile';

// Browser fingerprint — same logic as AdminPayoutsPage
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

export default function AdminMachinesPage() {
    const { enqueueSnackbar } = useSnackbar();
    const queryClient = useQueryClient();
    const fingerprint = getBrowserFingerprint();

    const [authorizeOpen, setAuthorizeOpen] = useState(false);
    const [revokeTarget, setRevokeTarget] = useState<AdminMachine | null>(null);
    const [machineName, setMachineName] = useState('');
    const [machineDetails, setMachineDetails] = useState('');

    // ── Queries ──────────────────────────────────────
    const { data: allMachines, isLoading: allLoading } = useQuery({
        queryKey: ['admin-machines-all'],
        queryFn: getAllMachines,
    });

    const { data: myMachines, isLoading: myLoading } = useQuery({
        queryKey: ['admin-machines-my'],
        queryFn: getMyMachines,
    });

    const { data: currentStatus, isLoading: statusLoading } = useQuery<MachineStatusResponse>({
        queryKey: ['admin-machine-status', fingerprint],
        queryFn: () => checkMachineStatus(fingerprint),
    });

    // ── Mutations ────────────────────────────────────
    const authorizeMutation = useMutation({
        mutationFn: () => authorizeMachine(fingerprint, machineName, machineDetails || undefined),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['admin-machines-all'] });
            queryClient.invalidateQueries({ queryKey: ['admin-machines-my'] });
            queryClient.invalidateQueries({ queryKey: ['admin-machine-status'] });
            setAuthorizeOpen(false);
            setMachineName('');
            setMachineDetails('');
            enqueueSnackbar('Machine authorized successfully', { variant: 'success' });
        },
        onError: () => enqueueSnackbar('Failed to authorize machine', { variant: 'error' }),
    });

    const revokeMutation = useMutation({
        mutationFn: (id: string) => revokeMachine(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['admin-machines-all'] });
            queryClient.invalidateQueries({ queryKey: ['admin-machines-my'] });
            queryClient.invalidateQueries({ queryKey: ['admin-machine-status'] });
            setRevokeTarget(null);
            enqueueSnackbar('Machine revoked', { variant: 'success' });
        },
        onError: () => enqueueSnackbar('Failed to revoke machine', { variant: 'error' }),
    });

    const activeMachines = allMachines?.filter(m => m.status === 'Active') ?? [];
    const revokedMachines = allMachines?.filter(m => m.status === 'Revoked') ?? [];

    return (
        <Box>
            <Typography variant="h4" fontWeight={700} mb={3}>
                Authorized Machines
            </Typography>

            {/* Current Machine Status */}
            <Card sx={{ mb: 3, border: '1px solid', borderColor: 'divider' }}>
                <CardContent>
                    <Grid container spacing={2} alignItems="center">
                        <Grid size={{ xs: 12, md: 8 }}>
                            <Typography variant="h6" gutterBottom>This Machine</Typography>
                            {statusLoading ? (
                                <CircularProgress size={20} />
                            ) : currentStatus?.isAuthorized ? (
                                <Box>
                                    <Chip label="Authorized" color="success" size="small" sx={{ mr: 1 }} />
                                    <Typography variant="body2" color="text.secondary" component="span">
                                        {currentStatus.machineName}
                                        {currentStatus.lastUsedAt && ` · Last used ${new Date(currentStatus.lastUsedAt).toLocaleString()}`}
                                    </Typography>
                                </Box>
                            ) : (
                                <Box>
                                    <Chip label="Not Authorized" color="warning" size="small" sx={{ mr: 1 }} />
                                    <Typography variant="body2" color="text.secondary" component="span">
                                        This machine cannot process payouts
                                    </Typography>
                                </Box>
                            )}
                        </Grid>
                        <Grid size={{ xs: 12, md: 4 }} sx={{ textAlign: { md: 'right' } }}>
                            {!currentStatus?.isAuthorized && (
                                <Button
                                    variant="contained"
                                    onClick={() => setAuthorizeOpen(true)}
                                >
                                    Authorize This Machine
                                </Button>
                            )}
                        </Grid>
                    </Grid>
                </CardContent>
            </Card>

            {/* Summary Cards */}
            <Grid container spacing={2} mb={3}>
                <Grid size={{ xs: 6, md: 3 }}>
                    <Card>
                        <CardContent sx={{ textAlign: 'center' }}>
                            <Typography variant="h4" fontWeight={700} color="success.main">
                                {activeMachines.length}
                            </Typography>
                            <Typography variant="body2" color="text.secondary">Active</Typography>
                        </CardContent>
                    </Card>
                </Grid>
                <Grid size={{ xs: 6, md: 3 }}>
                    <Card>
                        <CardContent sx={{ textAlign: 'center' }}>
                            <Typography variant="h4" fontWeight={700} color="error.main">
                                {revokedMachines.length}
                            </Typography>
                            <Typography variant="body2" color="text.secondary">Revoked</Typography>
                        </CardContent>
                    </Card>
                </Grid>
                <Grid size={{ xs: 6, md: 3 }}>
                    <Card>
                        <CardContent sx={{ textAlign: 'center' }}>
                            <Typography variant="h4" fontWeight={700}>
                                {myMachines?.length ?? 0}
                            </Typography>
                            <Typography variant="body2" color="text.secondary">My Machines</Typography>
                        </CardContent>
                    </Card>
                </Grid>
                <Grid size={{ xs: 6, md: 3 }}>
                    <Card>
                        <CardContent sx={{ textAlign: 'center' }}>
                            <Typography variant="h4" fontWeight={700}>
                                {allMachines?.length ?? 0}
                            </Typography>
                            <Typography variant="body2" color="text.secondary">Total</Typography>
                        </CardContent>
                    </Card>
                </Grid>
            </Grid>

            {/* Active Machines Table */}
            <Typography variant="h6" fontWeight={600} mb={1}>Active Machines</Typography>
            {allLoading ? (
                <Box display="flex" justifyContent="center" py={4}><CircularProgress /></Box>
            ) : activeMachines.length === 0 ? (
                <Alert severity="info" sx={{ mb: 3 }}>No active authorized machines</Alert>
            ) : (
                <TableContainer component={Paper} sx={{ mb: 4 }}>
                    <Table>
                        <TableHead>
                            <TableRow>
                                <TableCell>Machine Name</TableCell>
                                <TableCell>Admin</TableCell>
                                <TableCell>Authorized By</TableCell>
                                <TableCell>Authorized At</TableCell>
                                <TableCell>Last Used</TableCell>
                                <TableCell align="right">Actions</TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {activeMachines.map(m => (
                                <TableRow key={m.id} hover>
                                    <TableCell>
                                        <Typography variant="body2" fontWeight={600}>{m.machineName}</Typography>
                                        {m.machineDetails && (
                                            <Typography variant="caption" color="text.secondary" display="block">
                                                {m.machineDetails}
                                            </Typography>
                                        )}
                                    </TableCell>
                                    <TableCell>{m.adminName}</TableCell>
                                    <TableCell>{m.authorizedByName}</TableCell>
                                    <TableCell>{new Date(m.createdAt).toLocaleDateString()}</TableCell>
                                    <TableCell>
                                        {m.lastUsedAt ? new Date(m.lastUsedAt).toLocaleString() : '—'}
                                    </TableCell>
                                    <TableCell align="right">
                                        <Button
                                            size="small"
                                            color="error"
                                            onClick={() => setRevokeTarget(m)}
                                        >
                                            Revoke
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </TableContainer>
            )}

            {/* Revoked Machines Table */}
            {revokedMachines.length > 0 && (
                <>
                    <Typography variant="h6" fontWeight={600} mb={1} color="text.secondary">
                        Revoked Machines
                    </Typography>
                    <TableContainer component={Paper} sx={{ mb: 4, opacity: 0.7 }}>
                        <Table>
                            <TableHead>
                                <TableRow>
                                    <TableCell>Machine Name</TableCell>
                                    <TableCell>Admin</TableCell>
                                    <TableCell>Authorized At</TableCell>
                                    <TableCell>Revoked At</TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {revokedMachines.map(m => (
                                    <TableRow key={m.id}>
                                        <TableCell>{m.machineName}</TableCell>
                                        <TableCell>{m.adminName}</TableCell>
                                        <TableCell>{new Date(m.createdAt).toLocaleDateString()}</TableCell>
                                        <TableCell>
                                            {m.revokedAt ? new Date(m.revokedAt).toLocaleDateString() : '—'}
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </TableContainer>
                </>
            )}

            {/* Authorize Dialog */}
            <Dialog open={authorizeOpen} onClose={() => setAuthorizeOpen(false)} maxWidth="sm" fullWidth>
                <DialogTitle>Authorize This Machine</DialogTitle>
                <DialogContent>
                    <Typography variant="body2" color="text.secondary" mb={2}>
                        Give this browser/machine a name so you can identify it later.
                        Once authorized, it can be used to process payouts.
                    </Typography>
                    <TextField
                        label="Machine Name"
                        fullWidth
                        required
                        value={machineName}
                        onChange={e => setMachineName(e.target.value)}
                        placeholder="e.g. Office Laptop, Home Desktop"
                        sx={{ mb: 2 }}
                    />
                    <TextField
                        label="Details (optional)"
                        fullWidth
                        multiline
                        rows={2}
                        value={machineDetails}
                        onChange={e => setMachineDetails(e.target.value)}
                        placeholder="e.g. Chrome on Windows 11, Finance desk"
                    />
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setAuthorizeOpen(false)}>Cancel</Button>
                    <Button
                        variant="contained"
                        disabled={!machineName.trim() || authorizeMutation.isPending}
                        onClick={() => authorizeMutation.mutate()}
                    >
                        {authorizeMutation.isPending ? <CircularProgress size={20} /> : 'Authorize'}
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Revoke Confirmation Dialog */}
            <Dialog open={!!revokeTarget} onClose={() => setRevokeTarget(null)} maxWidth="xs" fullWidth>
                <DialogTitle>Revoke Machine</DialogTitle>
                <DialogContent>
                    <Alert severity="warning" sx={{ mb: 2 }}>
                        This machine will no longer be able to process payouts.
                    </Alert>
                    <Typography variant="body2">
                        <strong>Machine:</strong> {revokeTarget?.machineName}
                    </Typography>
                    <Typography variant="body2">
                        <strong>Admin:</strong> {revokeTarget?.adminName}
                    </Typography>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setRevokeTarget(null)}>Cancel</Button>
                    <Button
                        variant="contained"
                        color="error"
                        disabled={revokeMutation.isPending}
                        onClick={() => revokeTarget && revokeMutation.mutate(revokeTarget.id)}
                    >
                        {revokeMutation.isPending ? <CircularProgress size={20} /> : 'Revoke'}
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
}
