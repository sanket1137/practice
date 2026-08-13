import {
    HourglassEmpty as PendingIcon,
    CheckCircle as ApprovedIcon,
    PlayArrow as ActiveIcon,
    CheckCircleOutline as CompletedIcon,
    Cancel as RejectedIcon,
    Edit as DraftIcon,
    DoNotDisturbOn as CancelledIcon,
    Payment as PaymentPendingIcon,
} from '@mui/icons-material';
import type { SvgIconComponent } from '@mui/icons-material';

export type BookingStatus = 'Pending' | 'Approved' | 'Active' | 'Completed' | 'Rejected' | 'Draft' | 'Cancelled' | 'PaymentPending';
export type CampaignStatus = 'Draft' | 'Active' | 'Paused' | 'Completed';

export interface StatusConfig {
    label: string;
    color: 'default' | 'primary' | 'secondary' | 'error' | 'warning' | 'info' | 'success';
    icon: SvgIconComponent;
    description: string;
}

export const BOOKING_STATUS_CONFIG: Record<BookingStatus, StatusConfig> = {
    Pending: {
        label: 'Pending',
        color: 'warning',
        icon: PendingIcon,
        description: 'Awaiting approval',
    },
    Approved: {
        label: 'Approved',
        color: 'info',
        icon: ApprovedIcon,
        description: 'Approved but not yet started',
    },
    Active: {
        label: 'Active',
        color: 'success',
        icon: ActiveIcon,
        description: 'Currently running',
    },
    Completed: {
        label: 'Completed',
        color: 'default',
        icon: CompletedIcon,
        description: 'Finished successfully',
    },
    Rejected: {
        label: 'Rejected',
        color: 'error',
        icon: RejectedIcon,
        description: 'Booking was denied',
    },
    Draft: {
        label: 'Draft',
        color: 'default',
        icon: DraftIcon,
        description: 'Saved but not submitted',
    },
    Cancelled: {
        label: 'Cancelled',
        color: 'error',
        icon: CancelledIcon,
        description: 'Booking was cancelled',
    },
    PaymentPending: {
        label: 'Awaiting Payment',
        color: 'warning',
        icon: PaymentPendingIcon,
        description: 'Payment required within 24 hours',
    },
};

export const CAMPAIGN_STATUS_CONFIG: Record<CampaignStatus, StatusConfig> = {
    Draft: {
        label: 'Draft',
        color: 'default',
        icon: DraftIcon,
        description: 'Not yet published',
    },
    Active: {
        label: 'Active',
        color: 'success',
        icon: ActiveIcon,
        description: 'Currently running',
    },
    Paused: {
        label: 'Paused',
        color: 'warning',
        icon: PendingIcon,
        description: 'Temporarily stopped',
    },
    Completed: {
        label: 'Completed',
        color: 'default',
        icon: CompletedIcon,
        description: 'Campaign ended',
    },
};
