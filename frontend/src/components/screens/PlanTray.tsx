import { useMemo, useState } from 'react';
import {
    Box,
    Button,
    Chip,
    CircularProgress,
    Collapse,
    Divider,
    IconButton,
    Paper,
    Stack,
    TextField,
    Tooltip,
    Typography,
} from '@mui/material';
import PlaylistAddCheckIcon from '@mui/icons-material/PlaylistAddCheck';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import DeleteSweepIcon from '@mui/icons-material/DeleteSweep';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import RocketLaunchIcon from '@mui/icons-material/RocketLaunch';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import api from '../../services/api';
import { usePlan, removeFromPlan, clearPlan } from '../../store/planStore';

interface ProposalEstimate {
    days: number;
    currency: string;
    totalFootfallPerDay: number;
    totalEstPlays: number;
    totalEstCost: number;
    screens: {
        screenId: string;
        name: string;
        availableDays: number;
        totalDays: number;
        estPlays: number;
        estCost: number;
    }[];
}

function isoDaysFromNow(days: number): string {
    const d = new Date();
    d.setDate(d.getDate() + days);
    return d.toISOString().slice(0, 10);
}

const fmt = (n: number) => n.toLocaleString('en-IN');

/**
 * Floating basket for the Discover page: collects screens into a plan,
 * prices the flight live against the same engine that prices real bookings,
 * and hands off to either a client-ready PDF proposal or the campaign
 * wizard with every screen pre-selected.
 */
export default function PlanTray() {
    const navigate = useNavigate();
    const plan = usePlan();
    const [expanded, setExpanded] = useState(true);
    const [from, setFrom] = useState(() => isoDaysFromNow(1));
    const [to, setTo] = useState(() => isoDaysFromNow(14));
    const [downloading, setDownloading] = useState(false);
    const [downloadError, setDownloadError] = useState<string | null>(null);

    const ids = useMemo(() => plan.map((p) => p.id), [plan]);
    const datesValid = !!from && !!to && from <= to;

    const { data: estimate, isFetching: estimating, error: estimateError } = useQuery({
        queryKey: ['proposal-estimate', ids.join(','), from, to],
        queryFn: async (): Promise<ProposalEstimate> => {
            const res = await api.post('/reports/proposal/estimate', {
                screenIds: ids,
                from,
                to,
            });
            return res.data.data;
        },
        enabled: ids.length > 0 && datesValid,
        staleTime: 60 * 1000,
        retry: 1,
    });

    if (plan.length === 0) return null;

    const handleDownloadProposal = async () => {
        setDownloading(true);
        setDownloadError(null);
        try {
            const res = await api.post(
                '/reports/proposal',
                { screenIds: ids, from, to },
                { responseType: 'blob' },
            );
            const url = URL.createObjectURL(res.data);
            const a = document.createElement('a');
            a.href = url;
            a.download = `pixelspot-media-plan-${from}-to-${to}.pdf`;
            document.body.appendChild(a);
            a.click();
            a.remove();
            URL.revokeObjectURL(url);
        } catch {
            setDownloadError('Could not generate the proposal. Please try again.');
        } finally {
            setDownloading(false);
        }
    };

    const handleBook = () => {
        navigate(`/campaigns/new?screens=${ids.join(',')}`);
    };

    return (
        <Paper
            elevation={12}
            sx={{
                position: 'fixed',
                bottom: { xs: 12, md: 20 },
                left: '50%',
                transform: 'translateX(-50%)',
                width: { xs: 'calc(100vw - 24px)', sm: 560, md: 640 },
                maxHeight: '70vh',
                overflowY: 'auto',
                zIndex: 1450,
                borderRadius: 3,
                border: '1px solid var(--ps-border)',
                background: 'var(--ps-surface)',
                backdropFilter: 'blur(14px)',
                boxShadow: '0 24px 60px rgba(16, 24, 40, 0.35)',
            }}
        >
            {/* Header strip — always visible */}
            <Box
                onClick={() => setExpanded((e) => !e)}
                sx={{
                    px: 2,
                    py: 1.25,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1.25,
                    cursor: 'pointer',
                    userSelect: 'none',
                }}
            >
                <PlaylistAddCheckIcon sx={{ color: '#8B5CF6' }} />
                <Typography variant="subtitle2" fontWeight={700} sx={{ flex: 1 }}>
                    {plan.length} screen{plan.length > 1 ? 's' : ''} in plan
                    {estimate && (
                        <Typography component="span" variant="body2" color="text.secondary" sx={{ ml: 1 }}>
                            · est. ₹{fmt(Math.round(estimate.totalEstCost))} · {fmt(estimate.totalEstPlays)} plays
                        </Typography>
                    )}
                    {estimating && (
                        <CircularProgress size={12} sx={{ ml: 1, verticalAlign: 'middle' }} />
                    )}
                </Typography>
                <Tooltip title="Clear plan">
                    <IconButton
                        size="small"
                        onClick={(e) => {
                            e.stopPropagation();
                            clearPlan();
                        }}
                    >
                        <DeleteSweepIcon fontSize="small" />
                    </IconButton>
                </Tooltip>
                <IconButton size="small">
                    {expanded ? <ExpandMoreIcon /> : <ExpandLessIcon />}
                </IconButton>
            </Box>

            <Collapse in={expanded}>
                <Divider />
                <Box sx={{ p: 2, pt: 1.5 }}>
                    {/* Selected screens */}
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75, mb: 1.5 }}>
                        {plan.map((p) => (
                            <Chip
                                key={p.id}
                                size="small"
                                label={p.city ? `${p.name} · ${p.city}` : p.name}
                                onDelete={() => removeFromPlan(p.id)}
                                sx={{ maxWidth: 240 }}
                            />
                        ))}
                    </Box>

                    {/* Flight dates */}
                    <Stack direction="row" spacing={1.5} sx={{ mb: 1.5 }}>
                        <TextField
                            label="From"
                            type="date"
                            size="small"
                            value={from}
                            onChange={(e) => setFrom(e.target.value)}
                            InputLabelProps={{ shrink: true }}
                            sx={{ flex: 1 }}
                        />
                        <TextField
                            label="To"
                            type="date"
                            size="small"
                            value={to}
                            onChange={(e) => setTo(e.target.value)}
                            InputLabelProps={{ shrink: true }}
                            sx={{ flex: 1 }}
                        />
                    </Stack>
                    {!datesValid && (
                        <Typography variant="caption" color="error" sx={{ display: 'block', mb: 1 }}>
                            Pick a valid date range (from ≤ to, max 92 days).
                        </Typography>
                    )}

                    {/* Estimate band */}
                    <Box
                        sx={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(4, 1fr)',
                            gap: 1,
                            p: 1.25,
                            borderRadius: 2,
                            border: '1px solid var(--ps-border)',
                            background: 'rgba(139, 92, 246, 0.06)',
                            mb: 1.5,
                        }}
                    >
                        {[
                            { label: 'Screens', value: String(plan.length) },
                            {
                                label: 'Footfall/day*',
                                value: estimate ? fmt(estimate.totalFootfallPerDay) : '—',
                            },
                            {
                                label: 'Est. plays',
                                value: estimate ? fmt(estimate.totalEstPlays) : '—',
                            },
                            {
                                label: 'Est. total',
                                value: estimate ? `₹${fmt(Math.round(estimate.totalEstCost))}` : '—',
                            },
                        ].map((cell) => (
                            <Box key={cell.label} sx={{ textAlign: 'center' }}>
                                <Typography variant="subtitle2" fontWeight={800} noWrap>
                                    {estimating ? '…' : cell.value}
                                </Typography>
                                <Typography variant="caption" color="text.secondary" noWrap>
                                    {cell.label}
                                </Typography>
                            </Box>
                        ))}
                    </Box>
                    {!!estimateError && (
                        <Typography variant="caption" color="error" sx={{ display: 'block', mb: 1 }}>
                            Estimate unavailable — check dates or try again.
                        </Typography>
                    )}
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1.5 }}>
                        *Owner-declared daily audience estimates, not measured counts. Estimate assumes
                        one slot per loop on each screen; unavailable days are excluded automatically.
                    </Typography>
                    {downloadError && (
                        <Typography variant="caption" color="error" sx={{ display: 'block', mb: 1 }}>
                            {downloadError}
                        </Typography>
                    )}

                    {/* Actions */}
                    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
                        <Button
                            variant="outlined"
                            size="small"
                            startIcon={downloading ? <CircularProgress size={14} /> : <PictureAsPdfIcon />}
                            disabled={downloading || !datesValid}
                            onClick={handleDownloadProposal}
                            sx={{ flex: 1 }}
                        >
                            Download proposal PDF
                        </Button>
                        <Button
                            variant="contained"
                            size="small"
                            startIcon={<RocketLaunchIcon />}
                            onClick={handleBook}
                            sx={{
                                flex: 1,
                                background: 'linear-gradient(135deg, #8B5CF6, #6D28D9)',
                                '&:hover': { background: 'linear-gradient(135deg, #7C3AED, #5B21B6)' },
                            }}
                        >
                            Book these screens
                        </Button>
                    </Stack>
                </Box>
            </Collapse>
        </Paper>
    );
}
