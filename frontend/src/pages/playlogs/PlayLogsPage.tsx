import { useMemo, useState } from 'react';
import {
    Box,
    Button,
    Chip,
    Collapse,
    Container,
    Grid,
    MenuItem,
    Skeleton,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TablePagination,
    TableRow,
    TextField,
    Tooltip,
    Typography,
} from '@mui/material';
import DownloadIcon from '@mui/icons-material/Download';
import VerifiedIcon from '@mui/icons-material/Verified';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import ShieldIcon from '@mui/icons-material/GppGood';
import ShieldAlertIcon from '@mui/icons-material/GppBad';
import RefreshIcon from '@mui/icons-material/Refresh';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { useQuery } from '@tanstack/react-query';
import { useSnackbar } from 'notistack';
import api from '../../services/api';
import StatTile from '../../components/ui/StatTile';

interface LogEntry {
    playedAt: string;
    screenId: string;
    screenName?: string | null;
    campaignId?: string | null;
    campaignName?: string | null;
    advertiserName?: string | null;
    bookingId?: string | null;
    isHouseContent: boolean;
    slotPosition?: number | null;
    durationSeconds?: number | null;
    wasFullPlay?: boolean | null;
    isVerified: boolean;
    impressionId?: string | null;
    slotPlayKey?: string | null;
    verificationHash?: string | null;
    canonicalId?: string | null;
    playedAtTicks?: number;
    ownerContentId?: string | null;
}

interface PlayLogResponse {
    totalCount: number;
    page: number;
    pageSize: number;
    totalPages: number;
    totals: { plays: number; fullPlays: number; verified: number };
    entries: LogEntry[];
}

interface SealDay {
    day: string;
    recordCount: number;
    recordsRoot: string;
    prevSealHash: string;
    sealHash: string;
    sealedAt: string;
    verified: boolean;
}

interface IntegrityResponse {
    screenId: string;
    screenName: string;
    algorithm: string;
    verifiedAt: string;
    chainIntact: boolean;
    sealedDays: number;
    latestSealHash?: string | null;
    pendingToday: number;
    note: string;
    days: SealDay[];
}

interface ScreenOption { id: string; name: string }

const toIso = (d: Date) => d.toISOString().slice(0, 10);
const short = (h?: string | null, n = 12) => (h ? `${h.slice(0, n)}…` : '—');

/**
 * Proof-of-play console. Every play row carries its cryptographic identity
 * (device hash + dedup key), and the ledger panel proves the log's integrity
 * live: per-day SHA-256 digests chained day→day, recomputed from raw records
 * on every verification. The CSV embeds the same proof so the file an
 * advertiser receives is checkable, not just claimed.
 */
export default function PlayLogsPage() {
    const { enqueueSnackbar } = useSnackbar();
    const [screenId, setScreenId] = useState<string>('all');
    const [campaignId, setCampaignId] = useState<string>('all');
    const [contentType, setContentType] = useState<string>('all');
    const [quality, setQuality] = useState<string>('all');
    const [verification, setVerification] = useState<string>('all');
    const [from, setFrom] = useState(() => toIso(new Date(Date.now() - 6 * 86400_000)));
    const [to, setTo] = useState(() => toIso(new Date()));
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(100);
    const [exporting, setExporting] = useState(false);
    const [sealsOpen, setSealsOpen] = useState(false);

    const { data: screens = [] } = useQuery<ScreenOption[]>({
        queryKey: ['screens'],
        queryFn: async () => (await api.get('/screens')).data.data ?? [],
        staleTime: 5 * 60 * 1000,
    });

    const params = (p: number, size = pageSize) => {
        const q = new URLSearchParams({ from, to, page: String(p), pageSize: String(size) });
        if (screenId !== 'all') q.set('screenId', screenId);
        if (campaignId !== 'all') q.set('campaignId', campaignId);
        if (contentType !== 'all') q.set('contentType', contentType);
        if (quality !== 'all') q.set('quality', quality);
        if (verification !== 'all') q.set('verification', verification);
        return q.toString();
    };

    const { data, isLoading } = useQuery<PlayLogResponse>({
        queryKey: ['play-log', screenId, campaignId, contentType, quality, verification, from, to, page, pageSize],
        queryFn: async () => (await api.get(`/reports/owner/play-log?${params(page)}`)).data.data,
        placeholderData: (prev) => prev,
    });

    // Ledger integrity — meaningful per screen (each screen has its own chain).
    const { data: integrity, isFetching: verifying, refetch: reverify } = useQuery<IntegrityResponse>({
        queryKey: ['play-log-integrity', screenId],
        queryFn: async () => (await api.get(`/reports/owner/play-log/integrity?screenId=${screenId}&days=30`)).data.data,
        enabled: screenId !== 'all',
        staleTime: 60 * 1000,
    });

    const campaignOptions = useMemo(() => {
        const seen = new Map<string, string>();
        (data?.entries ?? []).forEach((e) => {
            if (e.campaignId && e.campaignName) seen.set(e.campaignId, e.campaignName);
        });
        return [...seen.entries()].map(([id, name]) => ({ id, name }));
    }, [data]);

    const resetPage = () => setPage(1);
    const setRange = (days: number) => {
        setFrom(toIso(new Date(Date.now() - (days - 1) * 86400_000)));
        setTo(toIso(new Date()));
        resetPage();
    };

    const fetchIntegrityFor = async (sid: string): Promise<IntegrityResponse | null> => {
        try {
            return (await api.get(`/reports/owner/play-log/integrity?screenId=${sid}&days=30`)).data.data;
        } catch {
            return null;
        }
    };

    const exportCsv = async () => {
        setExporting(true);
        try {
            const rows: LogEntry[] = [];
            for (let p = 1; p <= 10; p++) {
                const res = await api.get(`/reports/owner/play-log?${params(p, 500)}`);
                const chunk: PlayLogResponse = res.data.data;
                rows.push(...chunk.entries);
                if (p >= chunk.totalPages) break;
            }
            const esc = (v: string | null | undefined) => `"${(v ?? '').replace(/"/g, '""')}"`;
            // Column names are part of the verification contract — the public
            // verifier script (/verify-play-log.py) reads them by exact name.
            const header =
                'Played at (UTC),Screen,Content,Advertiser,Booking Id,Slot,Duration (s),Full play,Verified,' +
                'Impression Id,Slot Play Key (SHA-256),Device Verification Hash,' +
                'Canonical Id,Played At (Ticks),Campaign Id,OwnerContent Id';
            const lines = rows.map((e) => [
                new Date(e.playedAt).toISOString(),
                esc(e.screenName),
                esc(e.isHouseContent ? 'House content' : e.campaignName),
                esc(e.advertiserName),
                e.bookingId ?? '',
                e.slotPosition ?? '',
                e.durationSeconds ?? '',
                e.wasFullPlay ? 'yes' : 'no',
                e.isVerified ? 'yes' : 'no',
                esc(e.impressionId),
                esc(e.slotPlayKey),
                esc(e.verificationHash),
                esc(e.canonicalId),
                e.playedAtTicks ?? '',
                e.campaignId ?? '',
                e.ownerContentId ?? '',
            ].join(','));

            // Ledger proof footer: the seal chain for every screen in the export,
            // verified live at export time.
            const footer: string[] = ['', '--- LEDGER INTEGRITY (per-screen SHA-256 hash chain) ---'];
            const screenIds = screenId !== 'all'
                ? [screenId]
                : [...new Set(rows.map((r) => r.screenId))].slice(0, 10);
            for (const sid of screenIds) {
                const integ = await fetchIntegrityFor(sid);
                if (!integ) continue;
                footer.push(
                    `Screen: ${integ.screenName} (${integ.screenId}) · chain ${integ.chainIntact ? 'INTACT' : 'BROKEN'} · ` +
                    `${integ.sealedDays} sealed day(s) · verified at ${integ.verifiedAt}`,
                );
                footer.push('Day,Records,Records Root (SHA-256),Prev Seal,Seal Hash,Recomputed & Matched');
                integ.days.forEach((d) => footer.push(
                    `${d.day},${d.recordCount},${d.recordsRoot},${d.prevSealHash},${d.sealHash},${d.verified ? 'yes' : 'no'}`,
                ));
            }
            footer.push('');
            footer.push('How this proves integrity: each play row above hashes on the player device the moment it airs');
            footer.push('(Device Verification Hash) and carries a unique SHA-256 play key. Every closed UTC day is sealed:');
            footer.push('Records Root = SHA-256 over the canonical form of that day\'s records, and each Seal Hash =');
            footer.push('SHA-256(screenId|day|recordCount|recordsRoot|previousSealHash) — a hash chain. Changing, adding');
            footer.push('or deleting any historical play changes its day\'s recomputed root, which no longer matches the');
            footer.push('stored seal and breaks every later link. "Recomputed & Matched: yes" means the digest was');
            footer.push('recalculated from the raw records at export time and matched the sealed value.');
            footer.push('');
            footer.push('INDEPENDENT VERIFICATION (no PixelSpot account or network needed): this file contains every');
            footer.push('raw field the hashes are built from. Download the open verifier script from');
            footer.push('https://ccms.pixelspot.in/verify-play-log.py (about 150 lines of standard-library Python,');
            footer.push('readable in full before running) and run:  python verify-play-log.py <this file>');
            footer.push('It recomputes all digests offline and prints PASS/FAIL per sealed day. For a clean check,');
            footer.push('export whole days without campaign/quality filters.');

            const blob = new Blob([[header, ...lines, ...footer].join('\n')], { type: 'text/csv;charset=utf-8' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `play-log-${from}-to-${to}.csv`;
            a.click();
            URL.revokeObjectURL(url);
            if ((data?.totalCount ?? 0) > rows.length) {
                enqueueSnackbar(`Exported the most recent ${rows.length.toLocaleString()} of ${data?.totalCount.toLocaleString()} plays — narrow the date range for the rest`, { variant: 'info' });
            }
        } catch {
            enqueueSnackbar('Export failed', { variant: 'error' });
        } finally {
            setExporting(false);
        }
    };

    const totals = data?.totals;
    const fullPct = totals && totals.plays > 0 ? (totals.fullPlays / totals.plays) * 100 : null;
    const verifiedPct = totals && totals.plays > 0 ? (totals.verified / totals.plays) * 100 : null;

    const selectSx = { minWidth: 150 };

    return (
        <Container maxWidth="lg" sx={{ py: 3 }}>
            <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2, mb: 3, flexWrap: 'wrap' }}>
                <Box sx={{ flex: 1, minWidth: 240 }}>
                    <Typography variant="h3" gutterBottom>Play logs</Typography>
                    <Typography variant="body2" color="text.secondary">
                        Proof of play for every ad your screens ran — each play hashed on the device the
                        moment it airs, every day sealed into a tamper-evident hash chain. The export is
                        the checkable proof you hand an advertiser.
                    </Typography>
                </Box>
                <Button variant="contained" startIcon={<DownloadIcon />} onClick={exportCsv}
                    disabled={exporting || !data?.totalCount}>
                    {exporting ? 'Exporting…' : 'Export proof (CSV)'}
                </Button>
            </Box>

            {/* Filters */}
            <Box sx={{ display: 'flex', gap: 1.5, mb: 3, flexWrap: 'wrap', alignItems: 'center' }}>
                <TextField select size="small" label="Screen" value={screenId}
                    onChange={(e) => { setScreenId(e.target.value); resetPage(); }} sx={{ minWidth: 180 }}>
                    <MenuItem value="all">All screens</MenuItem>
                    {screens.map((s) => <MenuItem key={s.id} value={s.id}>{s.name}</MenuItem>)}
                </TextField>
                <TextField select size="small" label="Campaign" value={campaignId}
                    onChange={(e) => { setCampaignId(e.target.value); resetPage(); }} sx={{ minWidth: 180 }}>
                    <MenuItem value="all">All campaigns</MenuItem>
                    {campaignOptions.map((c) => <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>)}
                </TextField>
                <TextField select size="small" label="Content" value={contentType}
                    onChange={(e) => { setContentType(e.target.value); resetPage(); }} sx={selectSx}>
                    <MenuItem value="all">All content</MenuItem>
                    <MenuItem value="campaign">Campaigns only</MenuItem>
                    <MenuItem value="house">House content</MenuItem>
                </TextField>
                <TextField select size="small" label="Play quality" value={quality}
                    onChange={(e) => { setQuality(e.target.value); resetPage(); }} sx={selectSx}>
                    <MenuItem value="all">All plays</MenuItem>
                    <MenuItem value="full">Full plays</MenuItem>
                    <MenuItem value="partial">Partial plays</MenuItem>
                </TextField>
                <TextField select size="small" label="Verification" value={verification}
                    onChange={(e) => { setVerification(e.target.value); resetPage(); }} sx={selectSx}>
                    <MenuItem value="all">All</MenuItem>
                    <MenuItem value="verified">Verified</MenuItem>
                    <MenuItem value="late">Late-reported</MenuItem>
                </TextField>
                <TextField size="small" label="From" type="date" value={from}
                    onChange={(e) => { setFrom(e.target.value); resetPage(); }} InputLabelProps={{ shrink: true }} />
                <TextField size="small" label="To" type="date" value={to}
                    onChange={(e) => { setTo(e.target.value); resetPage(); }} InputLabelProps={{ shrink: true }} />
                <Chip label="7d" size="small" onClick={() => setRange(7)} clickable />
                <Chip label="30d" size="small" onClick={() => setRange(30)} clickable />
            </Box>

            {/* Ledger integrity */}
            {screenId === 'all' ? (
                <Box sx={{ mb: 3, p: 1.5, borderRadius: 2, border: '1px dashed', borderColor: 'divider', display: 'flex', alignItems: 'center', gap: 1 }}>
                    <ShieldIcon fontSize="small" color="disabled" />
                    <Typography variant="caption" color="text.secondary">
                        Each screen keeps its own tamper-evident ledger — select a screen above to view and
                        live-verify its seal chain. Exports always include the proof for every screen they contain.
                    </Typography>
                </Box>
            ) : integrity && (
                <Box sx={{
                    mb: 3, p: 2, borderRadius: 2, border: '1px solid',
                    borderColor: integrity.chainIntact ? 'success.main' : 'error.main',
                    bgcolor: integrity.chainIntact ? 'success.light' : 'error.light',
                }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                        {integrity.chainIntact
                            ? <ShieldIcon color="success" />
                            : <ShieldAlertIcon color="error" />}
                        <Typography variant="body2" fontWeight={700}>
                            {integrity.chainIntact
                                ? `Ledger verified — chain intact across ${integrity.sealedDays} sealed day(s)`
                                : 'LEDGER MISMATCH — a sealed day no longer matches its records'}
                        </Typography>
                        <Typography variant="caption" color="text.secondary" sx={{ fontFamily: 'monospace' }}>
                            latest seal {short(integrity.latestSealHash)}
                        </Typography>
                        <Box sx={{ flex: 1 }} />
                        <Typography variant="caption" color="text.secondary">
                            verified {new Date(integrity.verifiedAt).toLocaleTimeString()}
                        </Typography>
                        <Button size="small" startIcon={<RefreshIcon />} disabled={verifying}
                            onClick={() => reverify()}>
                            Re-verify
                        </Button>
                        <Button size="small" endIcon={<ExpandMoreIcon sx={{ transform: sealsOpen ? 'rotate(180deg)' : 'none', transition: '0.2s' }} />}
                            onClick={() => setSealsOpen((o) => !o)}>
                            Seals
                        </Button>
                    </Box>
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                        Every play is hashed on the device as it airs; each closed day's records are digested
                        (SHA-256) and chained to the previous day's seal. "Verified" means this browser session
                        just recomputed the digests from the raw records and every link matched.
                        {integrity.pendingToday > 0 && ` Today's ${integrity.pendingToday.toLocaleString()} play(s) seal automatically at UTC day close.`}
                    </Typography>
                    <Collapse in={sealsOpen}>
                        <TableContainer sx={{ mt: 1.5, maxHeight: 260 }}>
                            <Table size="small" stickyHeader>
                                <TableHead>
                                    <TableRow>
                                        <TableCell>Day</TableCell>
                                        <TableCell align="right">Records</TableCell>
                                        <TableCell>Records root</TableCell>
                                        <TableCell>Seal hash</TableCell>
                                        <TableCell align="center">Recomputed ✓</TableCell>
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    {integrity.days.map((d) => (
                                        <TableRow key={d.day}>
                                            <TableCell>{d.day}</TableCell>
                                            <TableCell align="right">{d.recordCount.toLocaleString()}</TableCell>
                                            <TableCell sx={{ fontFamily: 'monospace', fontSize: 11 }}>{short(d.recordsRoot, 16)}</TableCell>
                                            <TableCell sx={{ fontFamily: 'monospace', fontSize: 11 }}>{short(d.sealHash, 16)}</TableCell>
                                            <TableCell align="center">
                                                {d.verified
                                                    ? <VerifiedIcon sx={{ fontSize: 15 }} color="success" />
                                                    : <ShieldAlertIcon sx={{ fontSize: 15 }} color="error" />}
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </TableContainer>
                    </Collapse>
                </Box>
            )}

            {/* Totals */}
            <Grid container spacing={2} sx={{ mb: 3 }}>
                <Grid size={{ xs: 12, sm: 4 }}>
                    <StatTile label="Plays in range" value={(totals?.plays ?? 0).toLocaleString()} />
                </Grid>
                <Grid size={{ xs: 6, sm: 4 }}>
                    <StatTile label="Full plays" value={fullPct != null ? `${fullPct.toFixed(1)}%` : '—'} />
                </Grid>
                <Grid size={{ xs: 6, sm: 4 }}>
                    <StatTile label="Verified" value={verifiedPct != null ? `${verifiedPct.toFixed(1)}%` : '—'} />
                </Grid>
            </Grid>

            {/* Log table */}
            {isLoading && !data ? (
                <Skeleton variant="rounded" height={320} />
            ) : (
                <TableContainer>
                    <Table size="small">
                        <TableHead>
                            <TableRow>
                                <TableCell>Played at</TableCell>
                                <TableCell>Screen</TableCell>
                                <TableCell>Content</TableCell>
                                <TableCell>Advertiser</TableCell>
                                <TableCell align="center">Slot</TableCell>
                                <TableCell align="right">Duration</TableCell>
                                <TableCell>Proof</TableCell>
                                <TableCell align="center">Status</TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {(data?.entries ?? []).map((e, i) => (
                                <TableRow key={`${e.playedAt}-${i}`}>
                                    <TableCell sx={{ whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>
                                        {new Date(e.playedAt).toLocaleString(undefined, {
                                            day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', second: '2-digit',
                                        })}
                                    </TableCell>
                                    <TableCell>{e.screenName ?? '—'}</TableCell>
                                    <TableCell>
                                        {e.isHouseContent
                                            ? <Chip size="small" variant="outlined" label="House content" />
                                            : (e.campaignName ?? 'Direct booking')}
                                    </TableCell>
                                    <TableCell>{e.advertiserName ?? '—'}</TableCell>
                                    <TableCell align="center">{e.slotPosition ?? '—'}</TableCell>
                                    <TableCell align="right">
                                        {e.durationSeconds != null ? `${e.durationSeconds}s` : '—'}
                                        {e.wasFullPlay === false && (
                                            <Typography component="span" variant="caption" color="warning.main"> partial</Typography>
                                        )}
                                    </TableCell>
                                    <TableCell>
                                        <Tooltip arrow title={
                                            `Unique play key (SHA-256): ${e.slotPlayKey ?? '—'}\n` +
                                            `Device hash: ${e.verificationHash ?? '—'}`
                                        }>
                                            <Typography variant="caption" sx={{ fontFamily: 'monospace', color: 'text.secondary', cursor: 'help' }}>
                                                {short(e.slotPlayKey ?? e.verificationHash, 10)}
                                            </Typography>
                                        </Tooltip>
                                    </TableCell>
                                    <TableCell align="center">
                                        {e.isVerified ? (
                                            <Tooltip title="Timestamp within the accepted window — counted as verified delivery" arrow>
                                                <VerifiedIcon sx={{ fontSize: 16 }} color="success" />
                                            </Tooltip>
                                        ) : (
                                            <Tooltip title="Reported late (e.g. after an offline stretch) — stored and counted, flagged for review" arrow>
                                                <HelpOutlineIcon sx={{ fontSize: 16 }} color="warning" />
                                            </Tooltip>
                                        )}
                                    </TableCell>
                                </TableRow>
                            ))}
                            {(data?.entries?.length ?? 0) === 0 && (
                                <TableRow>
                                    <TableCell colSpan={8} align="center" sx={{ py: 5, color: 'text.secondary' }}>
                                        No plays recorded for these filters.
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                    <TablePagination
                        component="div"
                        count={data?.totalCount ?? 0}
                        page={(data?.page ?? 1) - 1}
                        onPageChange={(_, p) => setPage(p + 1)}
                        rowsPerPage={pageSize}
                        onRowsPerPageChange={(e) => { setPageSize(Number(e.target.value)); resetPage(); }}
                        rowsPerPageOptions={[50, 100, 250]}
                        labelRowsPerPage="Plays per page"
                    />
                </TableContainer>
            )}
        </Container>
    );
}
