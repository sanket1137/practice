import { Chip, Tooltip } from '@mui/material';
import type { ChipProps } from '@mui/material';

/**
 * The one place screen lifecycle states are rendered. The server's state
 * machine (ScreenLifecycleService) is the source of truth — this maps each
 * state to a label, colour and owner-facing explanation so every list, header
 * and card shows lifecycle identically.
 */
const STATUS_META: Record<string, { label: string; color: ChipProps['color']; hint: string }> = {
    Draft: { label: 'Draft', color: 'default', hint: 'Being set up. Not visible to advertisers yet.' },
    PendingVerification: { label: 'Pending verification', color: 'warning', hint: 'Waiting for QR verification to complete.' },
    Ready: { label: 'Ready', color: 'info', hint: 'Verified. Activate it to open for booking.' },
    Active: { label: 'Active', color: 'success', hint: 'Open for booking and visible to advertisers.' },
    Paused: { label: 'Paused', color: 'default', hint: 'New bookings paused. Existing bookings still play.' },
    Maintenance: { label: 'Maintenance', color: 'warning', hint: 'Temporarily out of service for physical work.' },
    Archived: { label: 'Archived', color: 'default', hint: 'Retired. History preserved.' },
    // Legacy values that may exist briefly around the migration window.
    Inactive: { label: 'Paused', color: 'default', hint: 'New bookings paused.' },
    Offline: { label: 'Ready', color: 'info', hint: 'Verified. Activate it to open for booking.' },
};

export function screenStatusMeta(status: string | undefined | null) {
    return STATUS_META[status ?? ''] ?? { label: status ?? 'Unknown', color: 'default' as const, hint: '' };
}

export default function ScreenStatusChip({ status, size = 'small' }: { status: string | undefined | null; size?: ChipProps['size'] }) {
    const meta = screenStatusMeta(status);
    const chip = <Chip label={meta.label} color={meta.color} size={size} />;
    return meta.hint ? <Tooltip title={meta.hint} arrow>{chip}</Tooltip> : chip;
}
