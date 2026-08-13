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
