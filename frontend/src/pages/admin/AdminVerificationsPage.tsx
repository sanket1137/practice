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
} from '@mui/material';
import VisibilityIcon from '@mui/icons-material/Visibility';
import VerifiedIcon from '@mui/icons-material/Verified';
import HourglassEmptyIcon from '@mui/icons-material/HourglassEmpty';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import { format, parseISO } from 'date-fns';

import { useAdminVerifications } from '../../hooks/useAdminVerifications';
import type { AdminVerificationListParams } from '../../types/verification';
import VerificationDetailDialog from '../../components/admin/VerificationDetailDialog';

const STATUS_OPTIONS = [
  { value: '', label: 'All statuses' },
  { value: 'PendingReview', label: 'Pending review' },
  { value: 'Verified', label: 'Verified' },
  { value: 'Rejected', label: 'Rejected' },
  { value: 'Unverified', label: 'Unverified' },
];

const DEVICE_OPTIONS = [
  { value: '', label: 'All devices' },
  { value: 'RaspberryPi', label: 'Raspberry Pi' },
  { value: 'Android', label: 'Android' },
  { value: 'ChromeOS', label: 'ChromeOS' },
];

const STATUS_COLOR: Record<string, 'success' | 'warning' | 'error' | 'info' | 'default'> = {
  PendingReview: 'warning',
  Verified: 'success',
  Rejected: 'error',
  Unverified: 'default',
  QrDisplayed: 'info',
  ReVerificationRequired: 'warning',
};

export default function AdminVerificationsPage() {
  const [params, setParams] = useState<AdminVerificationListParams>({
    status: '',
    deviceType: '',
    search: '',
    page: 1,
    pageSize: 20,
  });
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const { data, isLoading } = useAdminVerifications(params);

  const handlePageChange = (_: unknown, newPage: number) => {
    setParams((prev) => ({ ...prev, page: newPage + 1 }));
  };

  const handleRowsPerPageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setParams((prev) => ({ ...prev, pageSize: parseInt(e.target.value, 10), page: 1 }));
  };

  const pendingCount = data?.items.filter((v) => v.status === 'PendingReview').length ?? 0;

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
        <Typography variant="h4" gutterBottom sx={{ mb: 0.5 }}>Screen verifications</Typography>
        <Typography variant="body1" color="text.secondary">
          Review pending screens and approve trusted operators.
        </Typography>
      </Box>

      {/* Summary cards */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid size={{ xs: 6, md: 3 }}>
          <Card>
            <CardContent sx={{ textAlign: 'center' }}>
              <HourglassEmptyIcon sx={{ fontSize: 32, color: 'warning.main', mb: 0.5 }} />
              <Typography variant="h4" fontWeight={700} color="warning.main">
                {pendingCount}
              </Typography>
              <Typography variant="body2" color="text.secondary">Pending review</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 6, md: 3 }}>
          <Card>
            <CardContent sx={{ textAlign: 'center' }}>
              <VerifiedIcon sx={{ fontSize: 32, color: 'success.main', mb: 0.5 }} />
              <Typography variant="h4" fontWeight={700} color="success.main">
                {data?.items.filter((v) => v.status === 'Verified').length ?? 0}
              </Typography>
              <Typography variant="body2" color="text.secondary">Verified</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 6, md: 3 }}>
          <Card>
            <CardContent sx={{ textAlign: 'center' }}>
              <ErrorOutlineIcon sx={{ fontSize: 32, color: 'error.main', mb: 0.5 }} />
              <Typography variant="h4" fontWeight={700} color="error.main">
                {data?.items.filter((v) => v.status === 'Rejected').length ?? 0}
              </Typography>
              <Typography variant="body2" color="text.secondary">Rejected</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 6, md: 3 }}>
          <Card>
            <CardContent sx={{ textAlign: 'center' }}>
              <Typography variant="h4" fontWeight={700}>
                {data?.totalCount ?? 0}
              </Typography>
              <Typography variant="body2" color="text.secondary">Total</Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Filters */}
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ mb: 2 }}>
        <TextField
          size="small"
          placeholder="Search screen or owner…"
          value={params.search}
          onChange={(e) => setParams((prev) => ({ ...prev, search: e.target.value, page: 1 }))}
          sx={{ minWidth: 200 }}
        />
        <TextField
          select
          size="small"
          value={params.status}
          onChange={(e) => setParams((prev) => ({ ...prev, status: e.target.value, page: 1 }))}
          sx={{ minWidth: 160 }}
        >
          {STATUS_OPTIONS.map((opt) => (
            <MenuItem key={opt.value} value={opt.value}>
              {opt.label}
            </MenuItem>
          ))}
        </TextField>
        <TextField
          select
          size="small"
          value={params.deviceType}
          onChange={(e) => setParams((prev) => ({ ...prev, deviceType: e.target.value, page: 1 }))}
          sx={{ minWidth: 140 }}
        >
          {DEVICE_OPTIONS.map((opt) => (
            <MenuItem key={opt.value} value={opt.value}>
              {opt.label}
            </MenuItem>
          ))}
        </TextField>
      </Stack>

      {/* Table */}
      <Card>
        <CardContent sx={{ p: 0 }}>
          {isLoading ? (
            <Box sx={{ p: 3 }}>
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} variant="rounded" height={48} sx={{ mb: 1 }} />
              ))}
            </Box>
          ) : !data?.items.length ? (
            <Box sx={{ p: 4, textAlign: 'center' }}>
              <Typography color="text.secondary">No verifications found</Typography>
            </Box>
          ) : (
            <>
              <TableContainer>
                <Table stickyHeader>
                  <TableHead>
                    <TableRow>
                      <TableCell>Screen</TableCell>
                      <TableCell>Owner</TableCell>
                      <TableCell>Device</TableCell>
                      <TableCell>Status</TableCell>
                      <TableCell>Video</TableCell>
                      <TableCell>Submitted</TableCell>
                      <TableCell align="right">Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {data.items.map((item) => (
                      <TableRow
                        key={item.id}
                        sx={{ '&:hover': { bgcolor: 'rgba(255,255,255,0.04)' }, cursor: 'pointer' }}
                        onClick={() => setSelectedId(item.id)}
                      >
                        <TableCell>
                          <Typography variant="body2" fontWeight={600}>{item.screenName}</Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2">{item.ownerName}</Typography>
                          <Typography variant="caption" color="text.secondary">{item.ownerEmail}</Typography>
                        </TableCell>
                        <TableCell>{item.deviceType ?? '—'}</TableCell>
                        <TableCell>
                          <Chip
                            label={item.status}
                            color={STATUS_COLOR[item.status] ?? 'default'}
                            size="small"
                          />
                        </TableCell>
                        <TableCell>
                          <Chip
                            label={item.hasVideo ? 'Yes' : 'No'}
                            color={item.hasVideo ? 'success' : 'default'}
                            size="small"
                            variant="outlined"
                          />
                        </TableCell>
                        <TableCell>
                          {format(parseISO(item.createdAt), 'dd MMM yyyy, HH:mm')}
                        </TableCell>
                        <TableCell align="right">
                          <Tooltip title="View details">
                            <IconButton size="small" onClick={() => setSelectedId(item.id)}>
                              <VisibilityIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>

              <TablePagination
                component="div"
                count={data.totalCount}
                page={params.page - 1}
                onPageChange={handlePageChange}
                rowsPerPage={params.pageSize}
                onRowsPerPageChange={handleRowsPerPageChange}
                rowsPerPageOptions={[10, 20, 50]}
              />
            </>
          )}
        </CardContent>
      </Card>

      {/* Detail dialog */}
      <VerificationDetailDialog
        verificationId={selectedId}
        open={!!selectedId}
        onClose={() => setSelectedId(null)}
      />
    </Box>
  );
}
