import { Box, Chip } from '@mui/material';
import { Wifi, WifiOff, Refresh } from '@mui/icons-material';

interface ConnectionStatusProps {
    status: 'disconnected' | 'connecting' | 'connected' | 'reconnecting';
}

export default function ConnectionStatus({ status }: ConnectionStatusProps) {
    const getStatusProps = () => {
        switch (status) {
            case 'connected':
                return {
                    label: 'Connected',
                    color: 'success' as const,
                    icon: <Wifi sx={{ fontSize: 16 }} />
                };
            case 'connecting':
                return {
                    label: 'Connecting...',
                    color: 'warning' as const,
                    icon: <Refresh sx={{ fontSize: 16, animation: 'spin 1s linear infinite' }} />
                };
            case 'reconnecting':
                return {
                    label: 'Reconnecting...',
                    color: 'warning' as const,
                    icon: <Refresh sx={{ fontSize: 16, animation: 'spin 1s linear infinite' }} />
                };
            case 'disconnected':
            default:
                return {
                    label: 'Disconnected',
                    color: 'error' as const,
                    icon: <WifiOff sx={{ fontSize: 16 }} />
                };
        }
    };

    const statusProps = getStatusProps();

    return (
        <Box>
            <Chip
                icon={statusProps.icon}
                label={statusProps.label}
                color={statusProps.color}
                size="small"
                sx={{ fontSize: '0.75rem' }}
            />
            <style>{`
                @keyframes spin {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }
            `}</style>
        </Box>
    );
}
