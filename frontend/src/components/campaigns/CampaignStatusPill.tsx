import { Box, Chip, Tooltip } from '@mui/material';

/**
 * The one way campaign state renders anywhere in the app. Status comes from
 * the server's derived state machine; subState (from the monitor endpoint)
 * refines what "Active" means right now. No local status rules — ever.
 */
export default function CampaignStatusPill({ status, subState, startDate, size = 'small' }: {
    status: string;
    subState?: string | null;
    startDate?: string | null;
    size?: 'small' | 'medium';
}) {
    const live = subState === 'live';

    const meta = (() => {
        if (live) return { label: 'LIVE', color: 'success' as const, tip: 'Playing on screen right now' };
        switch (subState) {
            case 'scheduled':
                return {
                    label: startDate
                        ? `Scheduled · ${new Date(startDate).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}`
                        : 'Scheduled',
                    color: 'info' as const,
                    tip: 'Approved — starts playing on its start date',
                };
            case 'awaiting-approval':
                return { label: 'Awaiting approval', color: 'warning' as const, tip: 'Waiting for the screen owner to approve' };
            case 'completed':
                return { label: 'Completed', color: 'default' as const, tip: 'Finished — report available' };
            case 'cancelled':
                return { label: "Didn't run", color: 'error' as const, tip: 'Ended without airing' };
            case 'draft':
                return { label: 'Draft', color: 'default' as const, tip: 'Not submitted yet' };
        }
        // No subState available (list views) — plain server status.
        switch (status) {
            case 'Active': return { label: 'Active', color: 'success' as const, tip: 'Has open bookings' };
            case 'Completed': return { label: 'Completed', color: 'default' as const, tip: 'Finished' };
            case 'Cancelled': return { label: "Didn't run", color: 'error' as const, tip: 'Ended without airing' };
            case 'Paused': return { label: 'Paused', color: 'warning' as const, tip: 'Paused by you' };
            default: return { label: 'Draft', color: 'default' as const, tip: 'Not submitted yet' };
        }
    })();

    return (
        <Tooltip title={meta.tip} arrow>
            <Chip
                size={size}
                color={meta.color === 'default' ? undefined : meta.color}
                variant={live ? 'filled' : 'outlined'}
                label={
                    <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.6 }}>
                        {live && (
                            <Box component="span" sx={{
                                width: 7, height: 7, borderRadius: '50%', bgcolor: '#fff',
                                animation: 'ps-live-pulse 1.6s ease-in-out infinite',
                                '@keyframes ps-live-pulse': {
                                    '0%, 100%': { opacity: 1 }, '50%': { opacity: 0.45 },
                                },
                            }} />
                        )}
                        {meta.label}
                    </Box>
                }
                sx={{ fontWeight: 700, letterSpacing: live ? '0.06em' : undefined }}
            />
        </Tooltip>
    );
}
