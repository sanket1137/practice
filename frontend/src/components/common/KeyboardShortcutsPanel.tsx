import { useState, useEffect } from 'react';
import {
    Dialog,
    DialogTitle,
    DialogContent,
    Typography,
    Box,
    Grid,
    Chip,
    IconButton,
    Divider,
} from '@mui/material';
import { Close as CloseIcon, Keyboard as KeyboardIcon } from '@mui/icons-material';

interface Shortcut {
    keys: string[];
    description: string;
    category: string;
}

const shortcuts: Shortcut[] = [
    // Navigation
    { keys: ['Ctrl', 'K'], description: 'Open global search', category: 'Navigation' },
    { keys: ['?'], description: 'Show keyboard shortcuts', category: 'Navigation' },
    { keys: ['Esc'], description: 'Close dialog/modal', category: 'Navigation' },

    // Actions
    { keys: ['Ctrl', 'N'], description: 'Create new (context-aware)', category: 'Actions' },
    { keys: ['Ctrl', 'S'], description: 'Save current form', category: 'Actions' },
    { keys: ['Ctrl', 'Enter'], description: 'Submit form', category: 'Actions' },

    // Lists & Tables
    { keys: ['↑', '↓'], description: 'Navigate items', category: 'Lists' },
    { keys: ['Enter'], description: 'Open selected item', category: 'Lists' },
    { keys: ['Ctrl', 'A'], description: 'Select all', category: 'Lists' },
];

interface KeyboardShortcutsPanelProps {
    open: boolean;
    onClose: () => void;
}

export default function KeyboardShortcutsPanel({ open, onClose }: KeyboardShortcutsPanelProps) {
    const categories = Array.from(new Set(shortcuts.map(s => s.category)));

    return (
        <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
            <DialogTitle>
                <Box display="flex" alignItems="center" justifyContent="space-between">
                    <Box display="flex" alignItems="center" gap={1}>
                        <KeyboardIcon />
                        <Typography variant="h6">Keyboard Shortcuts</Typography>
                    </Box>
                    <IconButton onClick={onClose} size="small">
                        <CloseIcon />
                    </IconButton>
                </Box>
            </DialogTitle>
            <DialogContent>
                {categories.map((category, index) => (
                    <Box key={category} mb={3}>
                        {index > 0 && <Divider sx={{ mb: 2 }} />}
                        <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                            {category}
                        </Typography>
                        <Grid container spacing={2}>
                            {shortcuts
                                .filter(s => s.category === category)
                                .map((shortcut, idx) => (
                                    <Grid
                                        key={idx}
                                        size={{
                                            xs: 12,
                                            sm: 6
                                        }}>
                                        <Box display="flex" justifyContent="space-between" alignItems="center">
                                            <Typography variant="body2">{shortcut.description}</Typography>
                                            <Box display="flex" gap={0.5}>
                                                {shortcut.keys.map((key, keyIdx) => (
                                                    <Chip
                                                        key={keyIdx}
                                                        label={key}
                                                        size="small"
                                                        sx={{
                                                            fontFamily: 'monospace',
                                                            fontWeight: 'bold',
                                                            minWidth: 40,
                                                        }}
                                                    />
                                                ))}
                                            </Box>
                                        </Box>
                                    </Grid>
                                ))}
                        </Grid>
                    </Box>
                ))}
            </DialogContent>
        </Dialog>
    );
}

// Hook to manage keyboard shortcuts panel
export function useKeyboardShortcuts() {
    const [open, setOpen] = useState(false);

    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            // Show shortcuts panel with ?
            if (event.key === '?' && !event.ctrlKey && !event.metaKey) {
                event.preventDefault();
                setOpen(true);
            }

            // Close with Esc
            if (event.key === 'Escape' && open) {
                setOpen(false);
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [open]);

    return { open, setOpen };
}
