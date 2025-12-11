import { Tooltip, IconButton } from '@mui/material';
import type { TooltipProps } from '@mui/material';
import { Help as HelpIcon } from '@mui/icons-material';
import type { ReactElement } from 'react';

interface HelpTooltipProps {
    title: string;
    iconSize?: 'small' | 'medium' | 'large';
    showIcon?: boolean;
    placement?: TooltipProps['placement'];
    children?: ReactElement;
}

export default function HelpTooltip({
    title,
    iconSize = 'small',
    showIcon = true,
    placement = 'top',
    children,
}: HelpTooltipProps) {
    if (!showIcon && children) {
        return (
            <Tooltip title={title} arrow placement={placement}>
                {children}
            </Tooltip>
        );
    }

    return (
        <Tooltip title={title} arrow placement={placement}>
            <IconButton size="small" sx={{ ml: 0.5 }}>
                <HelpIcon fontSize={iconSize} color="action" />
            </IconButton>
        </Tooltip>
    );
}

// Preset help tooltips for common scenarios
export const HELP_TOOLTIPS = {
    slotNumber: 'A slot is a designated advertising position on the screen. Each screen can have multiple slots.',
    partialBooking: 'A partial booking means some requested dates are unavailable. Only available dates will be booked.',
    budgetUtilization: 'Shows how much of your campaign budget has been spent versus allocated.',
    impressions: 'The number of times your ad has been displayed to viewers.',
    screenUtilization: 'Percentage of time slots that are currently booked on this screen.',
    dateRange: 'Select the start and end dates for your campaign or booking.',
    currency: 'The currency used for pricing. Defaults to USD.',
    approval: 'Screen owners must approve bookings before they become active.',
    revenue: 'Total income generated from bookings on this screen.',
};
