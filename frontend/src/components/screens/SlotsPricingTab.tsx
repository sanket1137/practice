import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Alert,
    Box,
    Button,
    Card,
    CardContent,
    Checkbox,
    Chip,
    CircularProgress,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    IconButton,
    MenuItem,
    Select,
    Skeleton,
    Stack,
    Switch,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    TextField,
    ToggleButton,
    ToggleButtonGroup,
    Tooltip,
    Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import CelebrationIcon from '@mui/icons-material/Celebration';
import SettingsIcon from '@mui/icons-material/Settings';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSnackbar } from 'notistack';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import api from '../../services/api';
import { festivalsApi, type FestivalEntry } from '../../services/festivalsApi';
import type { PricingRuleDto, CreatePricingRuleRequest } from '../../types/pricingRule';

/** Structural subset of the screen the tab needs — matches ScreenDto fields. */
export interface SlotsPricingScreenInfo {
    id: string;
    pricePerSlot: number;
    currency: string;
    timeFrameMinutes: number;
    slotsPerFrame: number;
    averageOperatingHoursPerDay?: number;
}

interface DayDemand {
    date: string; // YYYY-MM-DD
    totalSlots: number;
    bookedSlots: number;
}

interface PriceBenchmark {
    scope: string | null;
    sampleSize: number;
    currency: string;
    yourPrice: number;
    p25?: number | null;
    median?: number | null;
    p75?: number | null;
}

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const PREVIEW_DAYS = 30;
const MULTIPLIER_OPTIONS = [1.1, 1.2, 1.25, 1.5, 1.75, 2.0, 2.5, 3.0];

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

const toIsoDay = (d: Date) => {
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${d.getFullYear()}-${m}-${day}`;
};

const fmtIsoDay = (iso: string) => {
    const [y, m, d] = iso.split('-').map(Number);
    return new Date(y, m - 1, d).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
};

/**
 * Client-side mirror of the backend pricing engine (BookingCalculationService.ResolveDayPrice):
 * type precedence SpecificDate > DateRange > Weekday; within a type the highest
 * price wins; rules without a positive price are inert; base price otherwise.
 * ISO date strings compare lexicographically, so no timezone maths is needed.
 */
function resolveDayPrice(date: Date, basePrice: number, rules: PricingRuleDto[]): { price: number; ruleName: string | null } {
    const iso = toIsoDay(date);
    const dayNumber = String(date.getDay()); // 0=Sunday … 6=Saturday
    for (const type of ['SpecificDate', 'DateRange', 'Weekday'] as const) {
        let best: PricingRuleDto | null = null;
        for (const rule of rules) {
            if (rule.ruleType !== type || !rule.isActive || !(rule.regularSlotPrice != null && rule.regularSlotPrice > 0)) continue;
            const matches =
                type === 'SpecificDate' ? rule.startDate === iso :
                type === 'DateRange' ? !!rule.startDate && rule.startDate <= iso && iso <= (rule.endDate ?? rule.startDate) :
                (rule.daysOfWeek ?? '').split(',').map((s) => s.trim()).includes(dayNumber);
            if (matches && (best == null || rule.regularSlotPrice! > best.regularSlotPrice!)) best = rule;
        }
        if (best) return { price: best.regularSlotPrice!, ruleName: best.name };
    }
    return { price: basePrice, ruleName: null };
}

const ruleSchema = z.object({
    name: z.string().min(1, 'Name is required').max(200),
    ruleType: z.enum(['Weekday', 'DateRange', 'SpecificDate']),
    // The engine ignores rules without a positive price, so the editor requires one.
    regularSlotPrice: z.number({ message: 'Price is required' }).positive('Price must be positive'),
    isActive: z.boolean(),
    startDate: z.string().optional(),
    endDate: z.string().optional(),
    days: z.array(z.string()),
}).superRefine((v, ctx) => {
    if (v.ruleType === 'SpecificDate' && !v.startDate)
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['startDate'], message: 'Pick the date' });
    if (v.ruleType === 'DateRange') {
        if (!v.startDate) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['startDate'], message: 'Start date required' });
        if (!v.endDate) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['endDate'], message: 'End date required' });
        if (v.startDate && v.endDate && v.endDate < v.startDate)
            ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['endDate'], message: 'Must be on or after start' });
    }
    if (v.ruleType === 'Weekday' && v.days.length === 0)
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['days'], message: 'Pick at least one day' });
});
type RuleFormValues = z.infer<typeof ruleSchema>;

export default function SlotsPricingTab({ screen }: { screen: SlotsPricingScreenInfo }) {
    const navigate = useNavigate();
    const { enqueueSnackbar } = useSnackbar();
    const queryClient = useQueryClient();

    const [editorOpen, setEditorOpen] = useState(false);
    const [editingRule, setEditingRule] = useState<PricingRuleDto | null>(null);
    const [festiveOpen, setFestiveOpen] = useState(false);
    const [deleteTarget, setDeleteTarget] = useState<PricingRuleDto | null>(null);

    const currency = screen.currency || 'INR';
    const basePrice = screen.pricePerSlot;
    const slotSeconds = screen.slotsPerFrame > 0 ? Math.round((screen.timeFrameMinutes * 60) / screen.slotsPerFrame) : null;
    const playsPerDay = screen.averageOperatingHoursPerDay && screen.timeFrameMinutes > 0
        ? Math.round((screen.averageOperatingHoursPerDay * 60) / screen.timeFrameMinutes)
        : null;

    const { data: rules = [], isLoading } = useQuery({
        queryKey: ['pricing-rules', screen.id],
        queryFn: async (): Promise<PricingRuleDto[]> => {
            const res = await api.get(`/screens/${screen.id}/pricing-rules`);
            return res.data.data ?? [];
        },
        staleTime: 60 * 1000,
    });

    const invalidate = () => queryClient.invalidateQueries({ queryKey: ['pricing-rules', screen.id] });

    const { data: demand = [] } = useQuery({
        queryKey: ['screen-demand', screen.id],
        queryFn: async (): Promise<DayDemand[]> => {
            const res = await api.get(`/screens/${screen.id}/demand?days=90`);
            return res.data.data ?? [];
        },
        staleTime: 5 * 60 * 1000,
    });

    const { data: benchmark } = useQuery<PriceBenchmark>({
        queryKey: ['price-benchmark', screen.id],
        queryFn: async () => (await api.get(`/screens/${screen.id}/price-benchmark`)).data.data,
        staleTime: 30 * 60 * 1000,
    });

    const createMutation = useMutation({
        mutationFn: (data: CreatePricingRuleRequest) => api.post(`/screens/${screen.id}/pricing-rules`, data),
        onSuccess: () => { invalidate(); enqueueSnackbar('Rule created', { variant: 'success' }); setEditorOpen(false); },
        onError: () => enqueueSnackbar('Failed to create rule', { variant: 'error' }),
    });
    const updateMutation = useMutation({
        mutationFn: ({ id, data }: { id: string; data: CreatePricingRuleRequest }) =>
            api.put(`/screens/${screen.id}/pricing-rules/${id}`, data),
        onSuccess: () => { invalidate(); enqueueSnackbar('Rule updated', { variant: 'success' }); setEditorOpen(false); },
        onError: () => enqueueSnackbar('Failed to update rule', { variant: 'error' }),
    });
    const deleteMutation = useMutation({
        mutationFn: (id: string) => api.delete(`/screens/${screen.id}/pricing-rules/${id}`),
        onSuccess: () => { invalidate(); enqueueSnackbar('Rule deleted', { variant: 'success' }); setDeleteTarget(null); },
        onError: () => enqueueSnackbar('Failed to delete rule', { variant: 'error' }),
    });
    const toggleMutation = useMutation({
        mutationFn: (id: string) => api.post(`/screens/${screen.id}/pricing-rules/${id}/toggle`),
        onSuccess: invalidate,
        onError: () => enqueueSnackbar('Failed to toggle rule', { variant: 'error' }),
    });

    // ── 30-day price preview, always in sync with the rules query ──
    const preview = useMemo(() => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        return Array.from({ length: PREVIEW_DAYS }, (_, i) => {
            const date = new Date(today);
            date.setDate(today.getDate() + i);
            const { price, ruleName } = resolveDayPrice(date, basePrice, rules);
            return { date, price, ruleName };
        });
    }, [rules, basePrice]);

    const ruledDays = preview.filter((d) => d.ruleName != null).length;
    const avgPrice = preview.length ? preview.reduce((s, d) => s + d.price, 0) / preview.length : basePrice;

    // ── Rule editor form ──
    const { control, handleSubmit, reset, watch, formState: { errors } } = useForm<RuleFormValues>({
        resolver: zodResolver(ruleSchema),
        defaultValues: { name: '', ruleType: 'DateRange', regularSlotPrice: basePrice, isActive: true, startDate: '', endDate: '', days: [] },
    });
    const ruleType = watch('ruleType');
    const watchPrice = watch('regularSlotPrice');
    const watchStart = watch('startDate');
    const watchEnd = watch('endDate');
    const watchDays = watch('days');

    const conflictingRules = useMemo<PricingRuleDto[]>(() => {
        if (!editorOpen) return [];
        const others = rules.filter((r) => r.id !== editingRule?.id && r.isActive);
        if (ruleType === 'SpecificDate' && watchStart)
            return others.filter((r) => r.ruleType === 'SpecificDate' && r.startDate === watchStart);
        if (ruleType === 'DateRange' && watchStart && watchEnd)
            return others.filter((r) => r.ruleType === 'DateRange' && !!r.startDate &&
                r.startDate <= watchEnd && watchStart <= (r.endDate ?? r.startDate));
        if (ruleType === 'Weekday' && watchDays.length)
            return others.filter((r) => r.ruleType === 'Weekday' &&
                (r.daysOfWeek ?? '').split(',').some((d) => watchDays.includes(d.trim())));
        return [];
    }, [editorOpen, ruleType, watchStart, watchEnd, watchDays, rules, editingRule]);

    const impactPct = basePrice > 0 && watchPrice > 0 ? ((watchPrice - basePrice) / basePrice) * 100 : null;

    const openCreate = () => {
        setEditingRule(null);
        reset({ name: '', ruleType: 'DateRange', regularSlotPrice: basePrice, isActive: true, startDate: '', endDate: '', days: [] });
        setEditorOpen(true);
    };

    // Heatmap cell click → single-date rule prefilled with that day and its
    // currently-resolved price, so pricing a hot day is two clicks.
    const openCreateForDate = (iso: string, currentPrice: number) => {
        setEditingRule(null);
        reset({
            name: `Peak day ${fmtIsoDay(iso)}`,
            ruleType: 'SpecificDate',
            regularSlotPrice: currentPrice,
            isActive: true,
            startDate: iso,
            endDate: '',
            days: [],
        });
        setEditorOpen(true);
    };
    const openEdit = (rule: PricingRuleDto) => {
        setEditingRule(rule);
        reset({
            name: rule.name,
            ruleType: rule.ruleType as RuleFormValues['ruleType'],
            regularSlotPrice: rule.regularSlotPrice ?? basePrice,
            isActive: rule.isActive,
            startDate: rule.startDate ?? '',
            endDate: rule.endDate ?? '',
            days: (rule.daysOfWeek ?? '').split(',').map((d) => d.trim()).filter(Boolean),
        });
        setEditorOpen(true);
    };

    const onSubmit = (data: RuleFormValues) => {
        const payload: CreatePricingRuleRequest = {
            name: data.name,
            ruleType: data.ruleType,
            regularSlotPrice: data.regularSlotPrice,
            isActive: data.isActive,
            // The engine matches SpecificDate on its start date only.
            startDate: data.ruleType !== 'Weekday' ? data.startDate || undefined : undefined,
            endDate: data.ruleType === 'DateRange' ? data.endDate || undefined
                : data.ruleType === 'SpecificDate' ? data.startDate || undefined : undefined,
            daysOfWeek: data.ruleType === 'Weekday' ? data.days.join(',') : undefined,
        };
        if (editingRule) updateMutation.mutate({ id: editingRule.id, data: payload });
        else createMutation.mutate(payload);
    };

    const describeWhen = (rule: PricingRuleDto) => {
        if (rule.ruleType === 'Weekday') {
            const days = (rule.daysOfWeek ?? '').split(',').map((d) => DAY_LABELS[Number(d.trim())]).filter(Boolean);
            return (
                <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
                    {days.map((d) => <Chip key={d} label={d} size="small" variant="outlined" />)}
                </Stack>
            );
        }
        if (rule.ruleType === 'SpecificDate') return rule.startDate ? fmtIsoDay(rule.startDate) : '—';
        return rule.startDate && rule.endDate ? `${fmtIsoDay(rule.startDate)} – ${fmtIsoDay(rule.endDate)}` : '—';
    };

    return (
        <Box>
            {/* ── Base rate ── */}
            <Card variant="outlined" sx={{ mb: 3 }}>
                <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 3, flexWrap: 'wrap' }}>
                    <Box>
                        <Typography variant="overline" color="text.secondary">Base rate</Typography>
                        <Typography variant="h5" fontWeight={700}>
                            {fmtMoney(basePrice, currency)} <Typography component="span" variant="body2" color="text.secondary">per slot per loop</Typography>
                        </Typography>
                    </Box>
                    <Box sx={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
                        {slotSeconds != null && (
                            <Box>
                                <Typography variant="overline" color="text.secondary">Slot length</Typography>
                                <Typography variant="body1" fontWeight={600}>{slotSeconds}s of every {screen.timeFrameMinutes} min loop</Typography>
                            </Box>
                        )}
                        {playsPerDay != null && (
                            <Box>
                                <Typography variant="overline" color="text.secondary">Est. plays per day</Typography>
                                <Typography variant="body1" fontWeight={600}>~{playsPerDay.toLocaleString()}</Typography>
                            </Box>
                        )}
                    </Box>
                    <Box sx={{ flex: 1 }} />
                    <Button size="small" startIcon={<SettingsIcon />} onClick={() => navigate(`/screens/${screen.id}?tab=settings`)}>
                        Change base price
                    </Button>
                </CardContent>
                {benchmark && benchmark.sampleSize >= 3 && benchmark.median != null && (
                    <Box sx={{ px: 2, pb: 1.5, mt: -1 }}>
                        <Typography variant="caption" color="text.secondary">
                            Similar screens in {benchmark.scope}: {fmtMoney(benchmark.p25 ?? 0, currency)}–{fmtMoney(benchmark.p75 ?? 0, currency)}/slot
                            · median {fmtMoney(benchmark.median, currency)} ({benchmark.sampleSize} screens) —{' '}
                            {basePrice < (benchmark.p25 ?? 0) ? 'you are priced below most of them; there may be room to raise.'
                                : basePrice > (benchmark.p75 ?? Infinity) ? 'you are priced above most of them.'
                                : 'your base price sits in the typical range.'}
                        </Typography>
                    </Box>
                )}
            </Card>

            {/* ── Demand heatmap (90 days) ── */}
            {demand.length > 0 && (
                <DemandHeatmap
                    demand={demand}
                    currency={currency}
                    basePrice={basePrice}
                    rules={rules}
                    onDayClick={openCreateForDate}
                />
            )}

            {/* ── 30-day preview ── */}
            <Card variant="outlined" sx={{ mb: 3 }}>
                <CardContent>
                    <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 2, mb: 1.5, flexWrap: 'wrap' }}>
                        <Typography variant="subtitle1" fontWeight={700}>Next 30 days</Typography>
                        <Typography variant="body2" color="text.secondary">
                            {ruledDays > 0
                                ? `${ruledDays} day${ruledDays === 1 ? '' : 's'} priced by rules · average ${fmtMoney(avgPrice, currency)}/slot`
                                : 'All days at base price — add rules to charge more on peak days'}
                        </Typography>
                    </Box>
                    {isLoading ? (
                        <Skeleton variant="rounded" height={72} />
                    ) : (
                        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(62px, 1fr))', gap: 0.75 }}>
                            {preview.map(({ date, price, ruleName }) => (
                                <Tooltip key={date.toISOString()} title={ruleName ?? 'Base price'} arrow>
                                    <Box
                                        sx={{
                                            p: 0.75,
                                            borderRadius: 1,
                                            textAlign: 'center',
                                            border: 1,
                                            borderColor: ruleName ? 'success.main' : 'divider',
                                            bgcolor: ruleName ? 'rgba(76,175,80,0.10)' : 'transparent',
                                        }}
                                    >
                                        <Typography variant="caption" color="text.secondary" display="block" lineHeight={1.3}>
                                            {DAY_LABELS[date.getDay()]} {date.getDate()}/{date.getMonth() + 1}
                                        </Typography>
                                        <Typography variant="caption" fontWeight={700} display="block" lineHeight={1.4}>
                                            {fmtMoney(price, currency)}
                                        </Typography>
                                    </Box>
                                </Tooltip>
                            ))}
                        </Box>
                    )}
                </CardContent>
            </Card>

            {/* ── Rules ── */}
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 1.5, gap: 1 }}>
                <Typography variant="subtitle1" fontWeight={700}>Pricing rules</Typography>
                <Box sx={{ flex: 1 }} />
                <Button size="small" startIcon={<CelebrationIcon />} onClick={() => setFestiveOpen(true)}>
                    Add festive pricing
                </Button>
                <Button size="small" variant="contained" startIcon={<AddIcon />} onClick={openCreate}>
                    Add rule
                </Button>
            </Box>

            {isLoading ? (
                <Skeleton variant="rounded" height={120} />
            ) : rules.length === 0 ? (
                <Card variant="outlined" sx={{ textAlign: 'center', p: 4 }}>
                    <Typography variant="h6">No pricing rules yet</Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                        Rules override the base slot price for weekends, date ranges, or single dates.
                        The most specific active rule wins each day.
                    </Typography>
                    <Button variant="contained" startIcon={<AddIcon />} onClick={openCreate}>Add first rule</Button>
                </Card>
            ) : (
                <TableContainer component={Card} variant="outlined">
                    <Table size="small">
                        <TableHead>
                            <TableRow>
                                <TableCell>Name</TableCell>
                                <TableCell>Type</TableCell>
                                <TableCell>When</TableCell>
                                <TableCell align="right">Price/slot</TableCell>
                                <TableCell align="right">vs base</TableCell>
                                <TableCell align="center">Active</TableCell>
                                <TableCell align="right">Actions</TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {rules.map((rule) => {
                                const delta = rule.regularSlotPrice != null && basePrice > 0
                                    ? ((rule.regularSlotPrice - basePrice) / basePrice) * 100 : null;
                                return (
                                    <TableRow key={rule.id} hover>
                                        <TableCell sx={{ fontWeight: 600 }}>{rule.name}</TableCell>
                                        <TableCell>
                                            <Chip
                                                size="small"
                                                variant="outlined"
                                                label={rule.ruleType === 'DateRange' ? 'Date range' : rule.ruleType === 'SpecificDate' ? 'Single date' : 'Weekly'}
                                            />
                                        </TableCell>
                                        <TableCell>{describeWhen(rule)}</TableCell>
                                        <TableCell align="right" sx={{ fontWeight: 600 }}>
                                            {rule.regularSlotPrice != null ? fmtMoney(rule.regularSlotPrice, currency) : '—'}
                                        </TableCell>
                                        <TableCell align="right">
                                            {delta == null ? '—' : (
                                                <Typography variant="body2" color={delta >= 0 ? 'success.main' : 'warning.main'} fontWeight={600}>
                                                    {delta >= 0 ? '+' : ''}{delta.toFixed(0)}%
                                                </Typography>
                                            )}
                                        </TableCell>
                                        <TableCell align="center">
                                            <Switch size="small" checked={rule.isActive} onChange={() => toggleMutation.mutate(rule.id)} />
                                        </TableCell>
                                        <TableCell align="right">
                                            <Tooltip title="Edit">
                                                <IconButton size="small" onClick={() => openEdit(rule)}><EditIcon fontSize="small" /></IconButton>
                                            </Tooltip>
                                            <Tooltip title="Delete">
                                                <IconButton size="small" color="error" onClick={() => setDeleteTarget(rule)}><DeleteIcon fontSize="small" /></IconButton>
                                            </Tooltip>
                                        </TableCell>
                                    </TableRow>
                                );
                            })}
                        </TableBody>
                    </Table>
                </TableContainer>
            )}

            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
                When rules overlap, the most specific one wins: single date beats date range beats weekly.
                Within the same type the highest price applies. New bookings pick up rule changes immediately; already-confirmed bookings keep their agreed price.
            </Typography>

            {/* ── Rule editor ── */}
            <Dialog open={editorOpen} onClose={() => setEditorOpen(false)} maxWidth="sm" fullWidth>
                <DialogTitle>{editingRule ? 'Edit rule' : 'New pricing rule'}</DialogTitle>
                <DialogContent dividers>
                    <Box component="form" id="slots-pricing-rule-form" onSubmit={handleSubmit(onSubmit)}>
                        <Stack spacing={2}>
                            <Controller name="name" control={control} render={({ field }) => (
                                <TextField {...field} label="Rule name" placeholder="e.g. Weekend rate, Diwali week"
                                    fullWidth error={!!errors.name} helperText={errors.name?.message} />
                            )} />
                            <Box sx={{ display: 'flex', gap: 2 }}>
                                <Controller name="ruleType" control={control} render={({ field }) => (
                                    <TextField {...field} label="Applies to" select fullWidth>
                                        <MenuItem value="DateRange">A date range</MenuItem>
                                        <MenuItem value="SpecificDate">A single date</MenuItem>
                                        <MenuItem value="Weekday">Days of the week</MenuItem>
                                    </TextField>
                                )} />
                                <Controller name="regularSlotPrice" control={control} render={({ field }) => (
                                    <TextField
                                        {...field}
                                        value={Number.isFinite(field.value) ? field.value : ''}
                                        onChange={(e) => field.onChange(e.target.value === '' ? Number.NaN : parseFloat(e.target.value))}
                                        label={`Price per slot (${currency})`}
                                        type="number"
                                        fullWidth
                                        error={!!errors.regularSlotPrice}
                                        helperText={errors.regularSlotPrice?.message}
                                    />
                                )} />
                            </Box>
                            {impactPct != null && Number.isFinite(impactPct) && (
                                <Alert severity={impactPct >= 0 ? 'info' : 'warning'} sx={{ py: 0.5 }}>
                                    {impactPct >= 0 ? '+' : ''}{impactPct.toFixed(0)}% vs base ({fmtMoney(basePrice, currency)}).
                                    {impactPct < 0 && ' This prices below your base rate — a discount.'}
                                </Alert>
                            )}
                            {ruleType === 'SpecificDate' && (
                                <Controller name="startDate" control={control} render={({ field }) => (
                                    <TextField {...field} label="Date" type="date" fullWidth InputLabelProps={{ shrink: true }}
                                        error={!!errors.startDate} helperText={errors.startDate?.message} />
                                )} />
                            )}
                            {ruleType === 'DateRange' && (
                                <Box sx={{ display: 'flex', gap: 2 }}>
                                    <Controller name="startDate" control={control} render={({ field }) => (
                                        <TextField {...field} label="From" type="date" fullWidth InputLabelProps={{ shrink: true }}
                                            error={!!errors.startDate} helperText={errors.startDate?.message} />
                                    )} />
                                    <Controller name="endDate" control={control} render={({ field }) => (
                                        <TextField {...field} label="To" type="date" fullWidth InputLabelProps={{ shrink: true }}
                                            error={!!errors.endDate} helperText={errors.endDate?.message} />
                                    )} />
                                </Box>
                            )}
                            {ruleType === 'Weekday' && (
                                <Box>
                                    <Controller name="days" control={control} render={({ field }) => (
                                        <ToggleButtonGroup
                                            value={field.value}
                                            onChange={(_, v: string[]) => field.onChange(v)}
                                            size="small"
                                            color="primary"
                                            sx={{ flexWrap: 'wrap' }}
                                        >
                                            {DAY_LABELS.map((label, i) => (
                                                <ToggleButton key={label} value={String(i)} sx={{ px: 1.75 }}>{label}</ToggleButton>
                                            ))}
                                        </ToggleButtonGroup>
                                    )} />
                                    {errors.days && <Typography variant="caption" color="error" display="block" mt={0.5}>{errors.days.message}</Typography>}
                                </Box>
                            )}
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                <Controller name="isActive" control={control} render={({ field }) => (
                                    <Switch checked={field.value} onChange={field.onChange} />
                                )} />
                                <Typography variant="body2">Active</Typography>
                            </Box>
                            {conflictingRules.length > 0 && (
                                <Alert severity="warning">
                                    Overlaps with <strong>{conflictingRules.map((r) => r.name).join(', ')}</strong> of the same type —
                                    the higher price will win on shared days.
                                </Alert>
                            )}
                        </Stack>
                    </Box>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setEditorOpen(false)}>Cancel</Button>
                    <Button type="submit" form="slots-pricing-rule-form" variant="contained"
                        disabled={createMutation.isPending || updateMutation.isPending}>
                        {editingRule ? 'Save changes' : 'Create rule'}
                    </Button>
                </DialogActions>
            </Dialog>

            <FestiveQuickAdd
                open={festiveOpen}
                onClose={() => setFestiveOpen(false)}
                screenId={screen.id}
                basePrice={basePrice}
                currency={currency}
                existingRules={rules}
                onCreated={invalidate}
            />

            {/* ── Delete confirm ── */}
            <Dialog open={!!deleteTarget} onClose={() => setDeleteTarget(null)} maxWidth="xs" fullWidth>
                <DialogTitle>Delete "{deleteTarget?.name}"?</DialogTitle>
                <DialogContent>
                    <Typography variant="body2">
                        Days covered by this rule go back to the base price (or the next matching rule). This cannot be undone.
                    </Typography>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setDeleteTarget(null)}>Cancel</Button>
                    <Button variant="contained" color="error" disabled={deleteMutation.isPending}
                        onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}>
                        Delete
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
}

/**
 * Festive quick-add: pick upcoming festivals, set a multiplier, and create
 * date-range rules in one go (server computes price = base × multiplier).
 */
function FestiveQuickAdd({ open, onClose, screenId, basePrice, currency, existingRules, onCreated }: {
    open: boolean;
    onClose: () => void;
    screenId: string;
    basePrice: number;
    currency: string;
    existingRules: PricingRuleDto[];
    onCreated: () => void;
}) {
    const { enqueueSnackbar } = useSnackbar();
    const [selections, setSelections] = useState<Record<string, { festival: FestivalEntry; multiplier: number }>>({});

    const year = new Date().getFullYear();
    const { data: festivals = [], isLoading } = useQuery({
        queryKey: ['festivals', year],
        queryFn: async () => {
            // Current + next year so late-year owners still see the upcoming season.
            const [a, b] = await Promise.all([festivalsApi.getFestivals(year), festivalsApi.getFestivals(year + 1)]);
            const today = toIsoDay(new Date());
            return [...a, ...b].filter((f) => f.endDate >= today).sort((x, y) => x.startDate.localeCompare(y.startDate));
        },
        enabled: open,
        staleTime: 60 * 60 * 1000,
    });

    const hasOverlap = (f: FestivalEntry) => existingRules.some((r) =>
        r.isActive && !!r.startDate && r.startDate <= f.endDate && f.startDate <= (r.endDate ?? r.startDate));

    const submitMutation = useMutation({
        mutationFn: async () => {
            const rules = Object.values(selections).map(({ festival, multiplier }) => ({
                name: `${festival.name} festive pricing`,
                startDate: festival.startDate,
                endDate: festival.endDate,
                multiplier,
            }));
            await api.post(`/screens/${screenId}/pricing-rules/bulk`, { rules });
        },
        onSuccess: () => {
            enqueueSnackbar(`${Object.keys(selections).length} festive rule(s) created`, { variant: 'success' });
            setSelections({});
            onCreated();
            onClose();
        },
        onError: () => enqueueSnackbar('Failed to create festive rules', { variant: 'error' }),
    });

    const toggle = (f: FestivalEntry) => setSelections((prev) => {
        const next = { ...prev };
        if (next[f.id]) delete next[f.id];
        else next[f.id] = { festival: f, multiplier: f.suggestedMultiplier || 1.5 };
        return next;
    });

    const count = Object.keys(selections).length;

    return (
        <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
            <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <CelebrationIcon color="primary" /> Festive pricing
            </DialogTitle>
            <DialogContent dividers>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                    Demand spikes around festivals. Pick the ones that matter for your location and set a
                    multiplier — each becomes a date-range rule you can edit later.
                </Typography>
                {isLoading ? (
                    <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}><CircularProgress size={28} /></Box>
                ) : festivals.length === 0 ? (
                    <Alert severity="info">No upcoming festivals found.</Alert>
                ) : (
                    <Stack spacing={1}>
                        {festivals.map((f) => {
                            const sel = selections[f.id];
                            const overlap = hasOverlap(f);
                            return (
                                <Box key={f.id} sx={{
                                    display: 'flex', alignItems: 'center', gap: 1, p: 1, borderRadius: 1,
                                    border: 1, borderColor: sel ? 'primary.main' : 'divider',
                                }}>
                                    <Checkbox checked={!!sel} onChange={() => toggle(f)} size="small" />
                                    <Box sx={{ flex: 1, minWidth: 0 }}>
                                        <Typography variant="body2" fontWeight={600} noWrap>{f.name}</Typography>
                                        <Typography variant="caption" color="text.secondary">
                                            {fmtIsoDay(f.startDate)} – {fmtIsoDay(f.endDate)}
                                            {overlap && ' · overlaps an existing rule'}
                                        </Typography>
                                    </Box>
                                    {sel && (
                                        <>
                                            <Select
                                                size="small"
                                                value={sel.multiplier}
                                                onChange={(e) => setSelections((prev) => ({
                                                    ...prev, [f.id]: { ...prev[f.id], multiplier: Number(e.target.value) },
                                                }))}
                                                sx={{ minWidth: 84 }}
                                            >
                                                {MULTIPLIER_OPTIONS.map((m) => <MenuItem key={m} value={m}>{m}×</MenuItem>)}
                                            </Select>
                                            <Typography variant="body2" fontWeight={700} sx={{ minWidth: 72, textAlign: 'right' }}>
                                                {fmtMoney(Math.round(basePrice * sel.multiplier * 100) / 100, currency)}
                                            </Typography>
                                        </>
                                    )}
                                </Box>
                            );
                        })}
                    </Stack>
                )}
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose}>Cancel</Button>
                <Button variant="contained" disabled={count === 0 || submitMutation.isPending} onClick={() => submitMutation.mutate()}>
                    Create {count > 0 ? `${count} rule${count === 1 ? '' : 's'}` : 'rules'}
                </Button>
            </DialogActions>
        </Dialog>
    );
}

const CELL = 14;   // px
const CELL_GAP = 3; // px

const occupancyColor = (pct: number) =>
    pct <= 0 ? 'rgba(128,128,128,0.14)'
    : pct < 25 ? 'rgba(255,152,0,0.30)'
    : pct < 50 ? 'rgba(255,152,0,0.50)'
    : pct < 75 ? 'rgba(255,152,0,0.72)'
    : pct < 100 ? '#fb8c00'
    : '#e64a19';

const isoToDate = (iso: string) => {
    const [y, m, d] = iso.split('-').map(Number);
    return new Date(y, m - 1, d);
};

/**
 * 90-day demand heatmap (GitHub-contribution style): columns are weeks, rows
 * Sun–Sat, color intensity is slot occupancy from bookings. Each cell's
 * tooltip pairs demand with that day's resolved price; clicking a day opens
 * the rule editor prefilled for it — see a hot day, price it.
 */
function DemandHeatmap({ demand, currency, basePrice, rules, onDayClick }: {
    demand: DayDemand[];
    currency: string;
    basePrice: number;
    rules: PricingRuleDto[];
    onDayClick: (iso: string, currentPrice: number) => void;
}) {
    const cells = useMemo(() => demand.map((d) => {
        const date = isoToDate(d.date);
        const pct = d.totalSlots > 0 ? (d.bookedSlots / d.totalSlots) * 100 : 0;
        const { price, ruleName } = resolveDayPrice(date, basePrice, rules);
        return { ...d, dateObj: date, pct, price, ruleName };
    }), [demand, basePrice, rules]);

    const offset = cells.length ? cells[0].dateObj.getDay() : 0;
    const columns = Math.ceil((offset + cells.length) / 7);

    // Month label per week-column: labelled where a month starts (or at col 0),
    // suppressed when the previous label is fewer than 3 columns away.
    const monthLabels = useMemo(() => {
        const labels: (string | null)[] = Array(columns).fill(null);
        let lastCol = -3;
        cells.forEach((c, i) => {
            const col = Math.floor((offset + i) / 7);
            if ((i === 0 || c.dateObj.getDate() === 1) && col - lastCol >= 3) {
                labels[col] = c.dateObj.toLocaleDateString(undefined, { month: 'short' });
                lastCol = col;
            }
        });
        return labels;
    }, [cells, offset, columns]);

    const avgPct = cells.length ? cells.reduce((s, c) => s + c.pct, 0) / cells.length : 0;
    const busiest = cells.reduce<typeof cells[number] | null>(
        (best, c) => (c.bookedSlots > 0 && (!best || c.pct > best.pct) ? c : best), null);
    const hotUnpriced = cells.filter((c) => c.pct >= 50 && c.ruleName == null).length;

    return (
        <Card variant="outlined" sx={{ mb: 3 }}>
            <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 2, mb: 1.5, flexWrap: 'wrap' }}>
                    <Typography variant="subtitle1" fontWeight={700}>Demand — next 90 days</Typography>
                    <Typography variant="body2" color="text.secondary">
                        {busiest
                            ? `${avgPct.toFixed(0)}% average occupancy · busiest ${busiest.dateObj.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })} (${busiest.bookedSlots}/${busiest.totalSlots} slots)`
                            : 'No bookings ahead yet — demand fills in as advertisers book'}
                    </Typography>
                </Box>

                {hotUnpriced > 0 && (
                    <Alert severity="info" sx={{ mb: 1.5, py: 0.5 }}>
                        {hotUnpriced} high-demand day{hotUnpriced === 1 ? '' : 's'} (50%+ booked) still at base price —
                        click a day below to price it.
                    </Alert>
                )}

                <Box sx={{ overflowX: 'auto', pb: 0.5 }}>
                    {/* Month labels */}
                    <Box sx={{ display: 'flex', ml: `${28 + CELL_GAP}px`, mb: '2px' }}>
                        {monthLabels.map((label, i) => (
                            <Typography key={i} variant="caption" color="text.secondary"
                                sx={{ width: CELL + CELL_GAP, flexShrink: 0, fontSize: 10, lineHeight: 1 }}>
                                {label ?? ''}
                            </Typography>
                        ))}
                    </Box>
                    <Box sx={{ display: 'flex' }}>
                        {/* Weekday labels */}
                        <Box sx={{ display: 'grid', gridTemplateRows: `repeat(7, ${CELL}px)`, rowGap: `${CELL_GAP}px`, width: 28, flexShrink: 0 }}>
                            {DAY_LABELS.map((d, i) => (
                                <Typography key={d} variant="caption" color="text.secondary"
                                    sx={{ fontSize: 9, lineHeight: `${CELL}px`, visibility: i % 2 === 1 ? 'visible' : 'hidden' }}>
                                    {d}
                                </Typography>
                            ))}
                        </Box>
                        {/* Cells */}
                        <Box sx={{
                            display: 'grid',
                            gridTemplateRows: `repeat(7, ${CELL}px)`,
                            gridAutoFlow: 'column',
                            gridAutoColumns: `${CELL}px`,
                            gap: `${CELL_GAP}px`,
                            ml: `${CELL_GAP}px`,
                        }}>
                            {Array.from({ length: offset }, (_, i) => <Box key={`pad-${i}`} />)}
                            {cells.map((c) => (
                                <Tooltip
                                    key={c.date}
                                    arrow
                                    title={
                                        `${c.dateObj.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' })} · ` +
                                        `${c.bookedSlots}/${c.totalSlots} slots booked (${c.pct.toFixed(0)}%) · ` +
                                        `${fmtMoney(c.price, currency)}/slot${c.ruleName ? ` (${c.ruleName})` : ''}`
                                    }
                                >
                                    <Box
                                        onClick={() => onDayClick(c.date, c.price)}
                                        sx={{
                                            width: CELL, height: CELL, borderRadius: '3px', cursor: 'pointer',
                                            bgcolor: occupancyColor(c.pct),
                                            outline: c.ruleName ? '1px solid rgba(76,175,80,0.8)' : 'none',
                                            outlineOffset: '-1px',
                                            '&:hover': { transform: 'scale(1.25)' },
                                            transition: 'transform 80ms',
                                        }}
                                    />
                                </Tooltip>
                            ))}
                        </Box>
                    </Box>
                </Box>

                {/* Legend */}
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 1.5, flexWrap: 'wrap' }}>
                    <Typography variant="caption" color="text.secondary" sx={{ mr: 0.5 }}>Demand:</Typography>
                    {[0, 20, 40, 60, 80, 100].map((p) => (
                        <Box key={p} sx={{ width: 11, height: 11, borderRadius: '2px', bgcolor: occupancyColor(p) }} />
                    ))}
                    <Typography variant="caption" color="text.secondary" sx={{ ml: 0.5 }}>
                        low → full · green outline = a pricing rule already covers that day · click any day to create a rule for it
                    </Typography>
                </Box>
            </CardContent>
        </Card>
    );
}
