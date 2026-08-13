import { Box, Typography, Button, Paper } from '@mui/material';
import {
    Inbox as InboxIcon,
    AddCircleOutline as AddIcon,
} from '@mui/icons-material';

interface EmptyStateProps {
    title: string;
    message?: string;
    action?: {
        label: string;
        onClick: () => void;
    };
    icon?: React.ReactNode;
}

export default function EmptyState({
    title,
    message,
    action,
    icon,
}: EmptyStateProps) {
    return (
        <Paper
            elevation={0}
            sx={{
                p: 6,
                textAlign: 'center',
                backgroundColor: 'background.default',
                border: '1px dashed',
                borderColor: 'divider',
            }}
        >
            <Box mb={2}>
                {icon || <InboxIcon sx={{ fontSize: 64, color: 'text.disabled' }} />}
            </Box>
            <Typography variant="h6" gutterBottom color="text.secondary">
                {title}
            </Typography>
            {message && (
                <Typography variant="body2" color="text.secondary" paragraph>
                    {message}
                </Typography>
            )}
            {action && (
                <Button
                    variant="contained"
                    startIcon={<AddIcon />}
                    onClick={action.onClick}
                    sx={{ mt: 2 }}
                >
                    {action.label}
                </Button>
            )}
        </Paper>
    );
}
