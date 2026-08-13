import {
    Checkbox,
    Toolbar,
    Typography,
    IconButton,
    Tooltip,
    Collapse,
} from '@mui/material';
import {
    Close as CloseIcon,
} from '@mui/icons-material';

interface BatchAction {
    icon: React.ReactNode;
    label: string;
    onClick: (selectedIds: string[]) => void;
    color?: 'primary' | 'error' | 'warning' | 'success';
    disabled?: boolean;
}

interface BatchActionsToolbarProps {
    selectedCount: number;
    onClearSelection: () => void;
    actions: BatchAction[];
}

export function BatchActionsToolbar({
    selectedCount,
    onClearSelection,
    actions,
}: BatchActionsToolbarProps) {
    return (
        <Collapse in={selectedCount > 0}>
            <Toolbar
                sx={{
                    bgcolor: 'primary.lighter',
                    borderRadius: 1,
                    mb: 2,
                    pl: 2,
                    pr: 1,
                }}
            >
                <Typography variant="subtitle1" component="div" sx={{ flex: 1 }}>
                    {selectedCount} selected
                </Typography>
                {actions.map((action, index) => (
                    <Tooltip key={index} title={action.label}>
                        <span>
                            <IconButton
                                color={action.color || 'default'}
                                onClick={() => action.onClick([])}
                                disabled={action.disabled}
                            >
                                {action.icon}
                            </IconButton>
                        </span>
                    </Tooltip>
                ))}
                <Tooltip title="Clear selection">
                    <IconButton onClick={onClearSelection}>
                        <CloseIcon />
                    </IconButton>
                </Tooltip>
            </Toolbar>
        </Collapse>
    );
}

// Select All Checkbox Component
export function SelectAllCheckbox({
    checked,
    indeterminate,
    onChange,
}: {
    checked: boolean;
    indeterminate: boolean;
    onChange: () => void;
}) {
    return (
        <Checkbox
            checked={checked}
            indeterminate={indeterminate}
            onChange={onChange}
            inputProps={{ 'aria-label': 'select all' }}
        />
    );
}
