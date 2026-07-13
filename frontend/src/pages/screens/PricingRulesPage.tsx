import { useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Alert,
  Box,
  Button,
  Card,
  Chip,
  Container,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Grid,
  IconButton,
  MenuItem,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSnackbar } from 'notistack';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import api from '../../services/api';
import type { PricingRuleDto, CreatePricingRuleRequest } from '../../types/pricingRule';

const ruleSchema = z.object({
  name: z.string().min(1, 'Name is required').max(200),
  ruleType: z.enum(['Weekday', 'DateRange', 'SpecificDate']),
  regularSlotPrice: z.number().positive('Price must be positive').nullable().optional(),
  isActive: z.boolean(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  daysOfWeek: z.string().optional(),
});
type RuleFormValues = z.infer<typeof ruleSchema>;

const fetchRules = async (screenId: string): Promise<PricingRuleDto[]> => {
  const res = await api.get(`/screens/${screenId}/pricing-rules`);
  return res.data.data ?? [];
};

export default function PricingRulesPage() {
  const { id: screenId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { enqueueSnackbar } = useSnackbar();
  const queryClient = useQueryClient();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<PricingRuleDto | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  const { data: rules = [], isLoading } = useQuery({
    queryKey: ['pricing-rules', screenId],
    queryFn: () => fetchRules(screenId!),
    enabled: !!screenId,
    staleTime: 5 * 60 * 1000,
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['pricing-rules', screenId] });

  const createMutation = useMutation({
    mutationFn: (data: CreatePricingRuleRequest) =>
      api.post(`/screens/${screenId}/pricing-rules`, data),
    onSuccess: () => { invalidate(); enqueueSnackbar('Rule created', { variant: 'success' }); setDialogOpen(false); },
    onError: () => enqueueSnackbar('Failed to create rule', { variant: 'error' }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: CreatePricingRuleRequest }) =>
      api.put(`/screens/${screenId}/pricing-rules/${id}`, data),
    onSuccess: () => { invalidate(); enqueueSnackbar('Rule updated', { variant: 'success' }); setDialogOpen(false); },
    onError: () => enqueueSnackbar('Failed to update rule', { variant: 'error' }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/screens/${screenId}/pricing-rules/${id}`),
    onSuccess: () => { invalidate(); enqueueSnackbar('Rule deleted', { variant: 'success' }); setDeleteTarget(null); },
    onError: () => enqueueSnackbar('Failed to delete rule', { variant: 'error' }),
  });

  const toggleMutation = useMutation({
    mutationFn: (id: string) => api.post(`/screens/${screenId}/pricing-rules/${id}/toggle`),
    onSuccess: () => invalidate(),
    onError: () => enqueueSnackbar('Failed to toggle rule', { variant: 'error' }),
  });

  const { control, handleSubmit, reset, watch, formState: { errors } } = useForm<RuleFormValues>({
    resolver: zodResolver(ruleSchema),
    defaultValues: { name: '', ruleType: 'DateRange', isActive: true },
  });

  const ruleType = watch('ruleType');
  const watchStartDate = watch('startDate');
  const watchEndDate = watch('endDate');
  const watchDaysOfWeek = watch('daysOfWeek');

  const conflictingRules = useMemo<PricingRuleDto[]>(() => {
    if (!dialogOpen) return [];
    const otherRules = rules.filter((r) => r.id !== editingRule?.id && r.isActive);

    if ((ruleType === 'DateRange' || ruleType === 'SpecificDate') && watchStartDate && watchEndDate) {
      const start = new Date(watchStartDate);
      const end = new Date(watchEndDate);
      return otherRules.filter((r) => {
        if (!r.startDate || !r.endDate) return false;
        const rStart = new Date(r.startDate);
        const rEnd = new Date(r.endDate);
        return start <= rEnd && end >= rStart;
      });
    }

    if (ruleType === 'Weekday' && watchDaysOfWeek) {
      const newDays = watchDaysOfWeek.split(',').map((d) => d.trim());
      return otherRules.filter((r) => {
        if (r.ruleType !== 'Weekday' || !r.daysOfWeek) return false;
        const existingDays = r.daysOfWeek.split(',').map((d) => d.trim());
        return newDays.some((d) => existingDays.includes(d));
      });
    }

    return [];
  }, [dialogOpen, ruleType, watchStartDate, watchEndDate, watchDaysOfWeek, rules, editingRule]);

  const openCreate = () => {
    setEditingRule(null);
    reset({ name: '', ruleType: 'DateRange', isActive: true });
    setDialogOpen(true);
  };

  const openEdit = (rule: PricingRuleDto) => {
    setEditingRule(rule);
    reset({
      name: rule.name,
      ruleType: rule.ruleType as RuleFormValues['ruleType'],
      regularSlotPrice: rule.regularSlotPrice ?? undefined,
      isActive: rule.isActive,
      startDate: rule.startDate ?? '',
      endDate: rule.endDate ?? '',
      daysOfWeek: rule.daysOfWeek ?? '',
    });
    setDialogOpen(true);
  };

  const onSubmit = (data: RuleFormValues) => {
    const payload: CreatePricingRuleRequest = {
      name: data.name,
      ruleType: data.ruleType,
      regularSlotPrice: data.regularSlotPrice ?? undefined,
      isActive: data.isActive,
      startDate: data.startDate || undefined,
      endDate: data.endDate || undefined,
      daysOfWeek: data.daysOfWeek || undefined,
    };
    if (editingRule) {
      updateMutation.mutate({ id: editingRule.id, data: payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 4, gap: 2 }}>
        <Button startIcon={<ArrowBackIcon />} variant="text" onClick={() => navigate(-1)}>
          Back
        </Button>
        <Typography variant="h5" fontWeight={700}>Pricing rules</Typography>
        <Box sx={{ flex: 1 }} />
        <Button variant="contained" startIcon={<AddIcon />} onClick={openCreate}>
          Add rule
        </Button>
      </Box>

      {isLoading && <Typography>Loading�</Typography>}

      {!isLoading && rules.length === 0 && (
        <Card variant="outlined" sx={{ textAlign: 'center', p: 4, bgcolor: 'background.paper' }}>
          <Typography variant="h6">No pricing rules yet</Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2 }}>
            Add rules to override the base slot price for specific dates or weekdays.
          </Typography>
          <Button variant="contained" startIcon={<AddIcon />} onClick={openCreate}>
            Add first rule
          </Button>
        </Card>
      )}

      {rules.length > 0 && (
        <Card variant="outlined" sx={{ bgcolor: 'background.paper' }}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Name</TableCell>
                <TableCell>Type</TableCell>
                <TableCell>Price/slot</TableCell>
                <TableCell>Date range</TableCell>
                <TableCell>Days</TableCell>
                <TableCell>Active</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {rules.map((rule) => (
                <TableRow key={rule.id} sx={{ '&:hover': { bgcolor: 'rgba(255,255,255,0.04)' } }}>
                  <TableCell>{rule.name}</TableCell>
                  <TableCell>
                    <Chip label={rule.ruleType} size="small" color="info" variant="outlined" />
                  </TableCell>
                  <TableCell>
                    {rule.regularSlotPrice != null ? `?${rule.regularSlotPrice.toFixed(2)}` : '�'}
                  </TableCell>
                  <TableCell>
                    {rule.startDate && rule.endDate ? `${rule.startDate} ? ${rule.endDate}` : '�'}
                  </TableCell>
                  <TableCell>{rule.daysOfWeek ?? '�'}</TableCell>
                  <TableCell>
                    <Switch
                      size="small"
                      checked={rule.isActive}
                      onChange={() => toggleMutation.mutate(rule.id)}
                    />
                  </TableCell>
                  <TableCell align="right">
                    <Tooltip title="Edit">
                      <IconButton size="small" onClick={() => openEdit(rule)}>
                        <EditIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Delete">
                      <IconButton size="small" color="error" onClick={() => setDeleteTarget(rule.id)}>
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      {/* Create / Edit Dialog */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{editingRule ? 'Edit rule' : 'Create pricing rule'}</DialogTitle>
        <DialogContent dividers>
          <Box component="form" id="pricing-rule-form" onSubmit={handleSubmit(onSubmit)}>
            <Grid container spacing={2}>
              <Grid size={{ xs: 12 }}>
                <Controller name="name" control={control} render={({ field }) => (
                  <TextField {...field} label="Rule name" fullWidth error={!!errors.name} helperText={errors.name?.message} />
                )} />
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <Controller name="ruleType" control={control} render={({ field }) => (
                  <TextField {...field} label="Rule type" select fullWidth>
                    <MenuItem value="DateRange">Date range</MenuItem>
                    <MenuItem value="Weekday">Weekday</MenuItem>
                    <MenuItem value="SpecificDate">Specific date</MenuItem>
                  </TextField>
                )} />
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <Controller name="regularSlotPrice" control={control} render={({ field }) => (
                  <TextField
                    {...field}
                    onChange={(e) => field.onChange(parseFloat(e.target.value) || null)}
                    label="Price per slot (?)"
                    type="number"
                    fullWidth
                    error={!!errors.regularSlotPrice}
                    helperText={errors.regularSlotPrice?.message}
                  />
                )} />
              </Grid>
              {(ruleType === 'DateRange' || ruleType === 'SpecificDate') && (
                <>
                  <Grid size={{ xs: 12, sm: 6 }}>
                    <Controller name="startDate" control={control} render={({ field }) => (
                      <TextField {...field} label="Start date" type="date" fullWidth InputLabelProps={{ shrink: true }} />
                    )} />
                  </Grid>
                  <Grid size={{ xs: 12, sm: 6 }}>
                    <Controller name="endDate" control={control} render={({ field }) => (
                      <TextField {...field} label="End date" type="date" fullWidth InputLabelProps={{ shrink: true }} />
                    )} />
                  </Grid>
                </>
              )}
              {ruleType === 'Weekday' && (
                <Grid size={{ xs: 12 }}>
                  <Controller name="daysOfWeek" control={control} render={({ field }) => (
                    <TextField
                      {...field}
                      label="Days of week (comma-separated, 0=Sun�6=Sat)"
                      fullWidth
                      placeholder="e.g. 1,2,3,4,5 for weekdays"
                    />
                  )} />
                </Grid>
              )}
              <Grid size={{ xs: 12 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Controller name="isActive" control={control} render={({ field }) => (
                    <Switch checked={field.value} onChange={field.onChange} />
                  )} />
                  <Typography variant="body2">Active</Typography>
                </Box>
              </Grid>

              {/* Conflict Detection */}
              {conflictingRules.length === 0 && (watchStartDate || watchDaysOfWeek) && (
                <Grid size={{ xs: 12 }}>
                  <Alert severity="success" sx={{ py: 0.5 }}>No conflicts with existing rules</Alert>
                </Grid>
              )}
              {conflictingRules.length > 0 && (
                <Grid size={{ xs: 12 }}>
                  <Alert severity="warning">
                    Overlaps with: <strong>{conflictingRules.map((r) => r.name).join(', ')}</strong>.
                    Priority order: Specific date {'>'} Date range {'>'} Weekday {'>'} Base price.
                    The most specific rule wins per day.
                  </Alert>
                </Grid>
              )}
            </Grid>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
          <Button
            type="submit"
            form="pricing-rule-form"
            variant="contained"
            disabled={createMutation.isPending || updateMutation.isPending}
          >
            {editingRule ? 'Save changes' : 'Create rule'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation */}
      <Dialog open={!!deleteTarget} onClose={() => setDeleteTarget(null)} maxWidth="xs">
        <DialogTitle>Delete rule?</DialogTitle>
        <DialogContent>
          <Typography>This action cannot be undone.</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteTarget(null)}>Cancel</Button>
          <Button
            variant="contained"
            color="error"
            onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget)}
            disabled={deleteMutation.isPending}
          >
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
}
