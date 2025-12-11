import { useState } from 'react';
import {
    Box,
    Checkbox,
    Toolbar,
    Typography,
    IconButton,
    Tooltip,
    Collapse,
} from '@mui/material';
import {
    Delete as DeleteIcon,
    Close as CloseIcon,
    CheckCircle as ApproveIcon,
    Cancel as RejectIcon,
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

// Hook to manage batch selection
export function useBatchSelection<T extends { id: string }>(items: T[] = []) {
    const [selected, setSelected] = useState<string[]>([]);

    const isSelected = (id: string) => selected.includes(id);

    const isAllSelected = items.length > 0 && selected.length === items.length;

    const isIndeterminate = selected.length > 0 && selected.length < items.length;

    const toggleSelect = (id: string) => {
        setSelected(prev =>
            prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
        );
    };

    const toggleSelectAll = () => {
        setSelected(isAllSelected ? [] : items.map(item => item.id));
    };

    const clearSelection = () => setSelected([]);

    const getSelectedItems = () => items.filter(item => selected.includes(item.id));

    return {
        selected,
        isSelected,
        isAllSelected,
        isIndeterminate,
        toggleSelect,
        toggleSelectAll,
        clearSelection,
        getSelectedItems,
        selectedCount: selected.length,
    };
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
