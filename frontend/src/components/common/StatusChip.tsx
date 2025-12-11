import { Chip, Tooltip } from '@mui/material';
import type { ChipProps } from '@mui/material';
import type { BookingStatus, CampaignStatus } from '../../constants/statusConfig';
import { BOOKING_STATUS_CONFIG, CAMPAIGN_STATUS_CONFIG } from '../../constants/statusConfig';

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

    const chip = (
        <Chip
            label={config.label}
            color={config.color}
            size="small"
            icon={showIcon ? <Icon fontSize="small" /> : undefined}
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
