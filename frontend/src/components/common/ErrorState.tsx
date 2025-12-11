import { Box, Button, Typography, Paper } from '@mui/material';
import {
    Error as ErrorIcon,
    Warning as WarningIcon,
    Info as InfoIcon,
} from '@mui/icons-material';

interface ErrorStateProps {
    title?: string;
    message?: string;
    action?: {
        label: string;
        onClick: () => void;
    };
    severity?: 'error' | 'warning' | 'info';
}

export default function ErrorState({
    title = 'Something went wrong',
    message = 'We encountered an error while loading this content.',
    action,
    severity = 'error',
}: ErrorStateProps) {
    const icons = {
        error: <ErrorIcon sx={{ fontSize: 64, color: 'error.main' }} />,
        warning: <WarningIcon sx={{ fontSize: 64, color: 'warning.main' }} />,
        info: <InfoIcon sx={{ fontSize: 64, color: 'info.main' }} />,
    };

    return (
        <Paper
            elevation={0}
            sx={{
                p: 4,
                textAlign: 'center',
                backgroundColor: 'background.default',
                border: '1px dashed',
                borderColor: 'divider',
            }}
        >
            <Box mb={2}>{icons[severity]}</Box>
            <Typography variant="h6" gutterBottom>
                {title}
            </Typography>
            <Typography variant="body2" color="text.secondary" paragraph>
                {message}
            </Typography>
            {action && (
                <Button
                    variant="contained"
                    onClick={action.onClick}
                    sx={{ mt: 2 }}
                >
                    {action.label}
                </Button>
            )}
        </Paper>
    );
}
