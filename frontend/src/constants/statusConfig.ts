import {
    HourglassEmpty as PendingIcon,
    CheckCircle as ApprovedIcon,
    PlayArrow as ActiveIcon,
    CheckCircleOutline as CompletedIcon,
    Cancel as RejectedIcon,
    Edit as DraftIcon,
} from '@mui/icons-material';

export type BookingStatus = 'Pending' | 'Approved' | 'Active' | 'Completed' | 'Rejected' | 'Draft';
export type CampaignStatus = 'Draft' | 'Active' | 'Paused' | 'Completed';

export interface StatusConfig {
    label: string;
    color: 'default' | 'primary' | 'secondary' | 'error' | 'warning' | 'info' | 'success';
    icon: any;
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
