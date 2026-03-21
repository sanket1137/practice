import { Chip, Tooltip, keyframes } from '@mui/material';
import type { ChipProps } from '@mui/material';
import type { BookingStatus, CampaignStatus } from '../../constants/statusConfig';
import { BOOKING_STATUS_CONFIG, CAMPAIGN_STATUS_CONFIG } from '../../constants/statusConfig';

const pulseAnimation = keyframes`
    0%, 100% { opacity: 1; }
    50% { opacity: 0.6; }
`;

interface StatusChipProps extends Omit<ChipProps, 'color'> {
    status: BookingStatus | CampaignStatus;
    type: 'booking' | 'campaign';
    showIcon?: boolean;
    showTooltip?: boolean;
}

export default function StatusChip({
    status,
    type,
    showIcon = true,
    showTooltip = true,
    ...chipProps
}: StatusChipProps) {
    const config = type === 'booking'
        ? BOOKING_STATUS_CONFIG[status as BookingStatus]
        : CAMPAIGN_STATUS_CONFIG[status as CampaignStatus];

    if (!config) {
        return <Chip label={status} size="small" {...chipProps} />;
    }

    const Icon = config.icon;
    const isPulsing = status === 'PaymentPending';

    const chip = (
        <Chip
            label={config.label}
            color={config.color}
            size="small"
            icon={showIcon ? <Icon fontSize="small" /> : undefined}
            sx={isPulsing ? { animation: `${pulseAnimation} 2s ease-in-out infinite` } : undefined}
            {...chipProps}
        />
    );

    if (showTooltip) {
        return (
            <Tooltip title={config.description} arrow>
                {chip}
            </Tooltip>
        );
    }

    return chip;
}
