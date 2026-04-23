import { useState } from 'react';
import {
    Box,
    Typography,
    Card,
    CardContent,
    Grid,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Chip,
    IconButton,
    Tooltip,
    TextField,
    MenuItem,
    Stack,
    Skeleton,
    TablePagination,
    Button,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
} from '@mui/material';
import VisibilityIcon from '@mui/icons-material/Visibility';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CancelIcon from '@mui/icons-material/Cancel';
import HourglassEmptyIcon from '@mui/icons-material/HourglassEmpty';
import { format, parseISO } from 'date-fns';
import { useSnackbar } from 'notistack';

import { useAdminVisibilityRequests } from '../../hooks/useAdminVisibilityRequests';
import type { VisibilityRequestDetailDto } from '../../types/profile';

const STATUS_OPTIONS = [
    { value: '', label: 'All statuses' },
    { value: 'Pending', label: 'Pending' },
    { value: 'Approved', label: 'Approved' },
    { value: 'Rejected', label: 'Rejected' },
];

const STATUS_COLOR: Record<string, 'success' | 'warning' | 'error' | 'default'> = {
    Pending: 'warning',
    Approved: 'success',
    Rejected: 'error',
};

export default function AdminVisibilityRequestsPage() {
    const { enqueueSnackbar } = useSnackbar();
    const [status, setStatus] = useState('');
    const [search, setSearch] = useState('');
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(20);
    const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
    const [rejectTargetId, setRejectTargetId] = useState<string | null>(null);
    const [rejectReason, setRejectReason] = useState('');
    const [detailRequest, setDetailRequest] = useState<VisibilityRequestDetailDto | null>(null);

    const { requests, isLoading, approve, isApproving, reject, isRejecting } =
        useAdminVisibilityRequests({ status: status || undefined, search: search || undefined, page, pageSize });

    const handlePageChange = (_: unknown, newPage: number) => {
        setPage(newPage + 1);
    };

    const handleRowsPerPageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setPageSize(parseInt(e.target.value, 10));
        setPage(1);
    };

    const handleApprove = async (id: string) => {
        try {
            await approve(id);
            enqueueSnackbar('Visibility request approved', { variant: 'success' });
        } catch {
            enqueueSnackbar('Failed to approve request', { variant: 'error' });
        }
    };

    const handleRejectOpen = (id: string) => {
        setRejectTargetId(id);
        setRejectReason('');
        setRejectDialogOpen(true);
    };

    const handleRejectConfirm = async () => {
        if (!rejectTargetId || !rejectReason.trim()) return;
        try {
            await reject({ id: rejectTargetId, reason: rejectReason.trim() });
            enqueueSnackbar('Visibility request rejected', { variant: 'success' });
            setRejectDialogOpen(false);
        } catch {
            enqueueSnackbar('Failed to reject request', { variant: 'error' });
        }
    };

    const pendingCount = requests?.items.filter((r) => r.status === 'Pending').length ?? 0;

    return (
        <Box>
            <Typography variant="h5" fontWeight="bold" sx={{ mb: 3 }}>
                Visibility requests
            </Typography>

            {/* Stats */}
            <Grid container spacing={2} sx={{ mb: 3 }}>
                <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                    <Card>
                        <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                            <HourglassEmptyIcon color="warning" sx={{ fontSize: 40 }} />
                            <Box>
                                <Typography variant="h5">{pendingCount}</Typography>
                                <Typography variant="body2" color="text.secondary">Pending</Typography>
                            </Box>
                        </CardContent>
                    </Card>
                </Grid>
                <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                    <Card>
                        <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                            <CheckCircleIcon color="success" sx={{ fontSize: 40 }} />
                            <Box>
                                <Typography variant="h5">{requests?.totalCount ?? 0}</Typography>
                                <Typography variant="body2" color="text.secondary">Total requests</Typography>
                            </Box>
                        </CardContent>
                    </Card>
                </Grid>
            </Grid>

            {/* Filters */}
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ mb: 3 }}>
                <TextField
                    select
                    size="small"
                    label="Status"
                    value={status}
                    onChange={(e) => { setStatus(e.target.value); setPage(1); }}
                    sx={{ minWidth: 160 }}
                >
                    {STATUS_OPTIONS.map((opt) => (
                        <MenuItem key={opt.value} value={opt.value}>{opt.label}</MenuItem>
                    ))}
                </TextField>
                <TextField
                    size="small"
                    label="Search by name or email"
                    value={search}
                    onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                    sx={{ minWidth: 240 }}
                />
            </Stack>

            {/* Table */}
            <Card>
                <TableContainer>
                    <Table stickyHeader>
                        <TableHead>
                            <TableRow>
                                <TableCell>User</TableCell>
                                <TableCell>Email</TableCell>
                                <TableCell align="center">Screens</TableCell>
                                <TableCell>Status</TableCell>
                                <TableCell>Requested</TableCell>
                                <TableCell>Message</TableCell>
                                <TableCell align="right">Actions</TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {isLoading ? (
                                Array.from({ length: 5 }).map((_, i) => (
                                    <TableRow key={i}>
                                        {Array.from({ length: 7 }).map((_, j) => (
                                            <TableCell key={j}><Skeleton /></TableCell>
                                        ))}
                                    </TableRow>
                                ))
                            ) : !requests?.items.length ? (
                                <TableRow>
                                    <TableCell colSpan={7} align="center" sx={{ py: 4 }}>
                                        <Typography color="text.secondary">No visibility requests found</Typography>
                                    </TableCell>
                                </TableRow>
                            ) : (
                                requests.items.map((req) => (
                                    <TableRow key={req.id} sx={{ '&:hover': { bgcolor: 'rgba(255,255,255,0.04)' } }}>
                                        <TableCell>{req.userName}</TableCell>
                                        <TableCell>{req.userEmail}</TableCell>
                                        <TableCell align="center">{req.screensCount}</TableCell>
                                        <TableCell>
                                            <Chip
                                                label={req.status}
                                                size="small"
                                                color={STATUS_COLOR[req.status] ?? 'default'}
                                            />
                                        </TableCell>
                                        <TableCell>
                                            {format(parseISO(req.requestedAt), 'dd MMM yyyy')}
                                        </TableCell>
                                        <TableCell sx={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                            {req.requestMessage || '—'}
                                        </TableCell>
                                        <TableCell align="right">
                                            <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                                                <Tooltip title="View details">
                                                    <IconButton size="small" onClick={() => setDetailRequest(req)}>
                                                        <VisibilityIcon fontSize="small" />
                                                    </IconButton>
                                                </Tooltip>
                                                {req.status === 'Pending' && (
                                                    <>
                                                        <Tooltip title="Approve">
                                                            <IconButton
                                                                size="small"
                                                                color="success"
                                                                disabled={isApproving}
                                                                onClick={() => handleApprove(req.id)}
                                                            >
                                                                <CheckCircleIcon fontSize="small" />
                                                            </IconButton>
                                                        </Tooltip>
                                                        <Tooltip title="Reject">
                                                            <IconButton
                                                                size="small"
                                                                color="error"
                                                                onClick={() => handleRejectOpen(req.id)}
                                                            >
                                                                <CancelIcon fontSize="small" />
                                                            </IconButton>
                                                        </Tooltip>
                                                    </>
                                                )}
                                            </Stack>
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </TableContainer>
                {requests && (
                    <TablePagination
                        component="div"
                        count={requests.totalCount}
                        page={page - 1}
                        onPageChange={handlePageChange}
                        rowsPerPage={pageSize}
                        onRowsPerPageChange={handleRowsPerPageChange}
                    />
                )}
            </Card>

            {/* Reject Dialog */}
            <Dialog open={rejectDialogOpen} onClose={() => setRejectDialogOpen(false)} maxWidth="sm" fullWidth>
                <DialogTitle>Reject visibility request</DialogTitle>
                <DialogContent>
                    <TextField
                        autoFocus
                        fullWidth
                        multiline
                        rows={3}
                        label="Rejection reason"
                        value={rejectReason}
                        onChange={(e) => setRejectReason(e.target.value)}
                        sx={{ mt: 1 }}
                    />
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setRejectDialogOpen(false)}>Cancel</Button>
                    <Button
                        variant="contained"
                        color="error"
                        disabled={!rejectReason.trim() || isRejecting}
                        onClick={handleRejectConfirm}
                    >
                        {isRejecting ? 'Rejecting...' : 'Reject'}
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Detail Dialog */}
            <Dialog
                open={!!detailRequest}
                onClose={() => setDetailRequest(null)}
                maxWidth="sm"
                fullWidth
            >
                {detailRequest && (
                    <>
                        <DialogTitle>Visibility request details</DialogTitle>
                        <DialogContent>
                            <Stack spacing={2} sx={{ mt: 1 }}>
                                <Box>
                                    <Typography variant="caption" color="text.secondary">User</Typography>
                                    <Typography>{detailRequest.userName}</Typography>
                                </Box>
                                <Box>
                                    <Typography variant="caption" color="text.secondary">Email</Typography>
                                    <Typography>{detailRequest.userEmail}</Typography>
                                </Box>
                                <Box>
                                    <Typography variant="caption" color="text.secondary">Screens</Typography>
                                    <Typography>{detailRequest.screensCount}</Typography>
                                </Box>
                                <Box>
                                    <Typography variant="caption" color="text.secondary">Status</Typography>
                                    <Box>
                                        <Chip
                                            label={detailRequest.status}
                                            size="small"
                                            color={STATUS_COLOR[detailRequest.status] ?? 'default'}
                                        />
                                    </Box>
                                </Box>
                                <Box>
                                    <Typography variant="caption" color="text.secondary">Requested</Typography>
                                    <Typography>
                                        {format(parseISO(detailRequest.requestedAt), 'dd MMM yyyy HH:mm')}
                                    </Typography>
                                </Box>
                                {detailRequest.requestMessage && (
                                    <Box>
                                        <Typography variant="caption" color="text.secondary">Message</Typography>
                                        <Typography>{detailRequest.requestMessage}</Typography>
                                    </Box>
                                )}
                                {detailRequest.adminReviewedAt && (
                                    <Box>
                                        <Typography variant="caption" color="text.secondary">Reviewed</Typography>
                                        <Typography>
                                            {format(parseISO(detailRequest.adminReviewedAt), 'dd MMM yyyy HH:mm')}
                                            {detailRequest.adminReviewedByName && ` by ${detailRequest.adminReviewedByName}`}
                                        </Typography>
                                    </Box>
                                )}
                                {detailRequest.rejectionReason && (
                                    <Box>
                                        <Typography variant="caption" color="text.secondary">Rejection reason</Typography>
                                        <Typography color="error.main">{detailRequest.rejectionReason}</Typography>
                                    </Box>
                                )}
                            </Stack>
                        </DialogContent>
                        <DialogActions>
                            <Button onClick={() => setDetailRequest(null)}>Close</Button>
                            {detailRequest.status === 'Pending' && (
                                <>
                                    <Button
                                        variant="contained"
                                        color="success"
                                        disabled={isApproving}
                                        onClick={async () => {
                                            await handleApprove(detailRequest.id);
                                            setDetailRequest(null);
                                        }}
                                    >
                                        Approve
                                    </Button>
                                    <Button
                                        variant="contained"
                                        color="error"
                                        onClick={() => {
                                            setDetailRequest(null);
                                            handleRejectOpen(detailRequest.id);
                                        }}
                                    >
                                        Reject
                                    </Button>
                                </>
                            )}
                        </DialogActions>
                    </>
                )}
            </Dialog>
        </Box>
    );
}
