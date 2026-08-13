import React from 'react';
import { Alert, Collapse, Snackbar, Typography, Box, CircularProgress } from '@mui/material';
import { WifiOff as WifiOffIcon, SignalWifi4Bar as WifiOnIcon } from '@mui/icons-material';
import { useNetworkStatus } from '../../hooks/useNetworkStatus';

interface OfflineBannerProps {
    /** Show as a fixed banner at top of screen */
    variant?: 'banner' | 'snackbar' | 'inline';
    /** Custom message when offline */
    offlineMessage?: string;
    /** Custom message when connection restored */
    onlineMessage?: string;
    /** Show loading indicator when reconnecting */
    showReconnecting?: boolean;
}

/**
 * Component that shows a banner/notification when the user goes offline.
 * 
 * Usage:
 * ```tsx
 * // As a fixed banner at the top
 * <OfflineBanner variant="banner" />
 * 
 * // As a snackbar notification
 * <OfflineBanner variant="snackbar" />
 * 
 * // Inline in a specific location
 * <OfflineBanner variant="inline" />
 * ```
 */
export const OfflineBanner: React.FC<OfflineBannerProps> = ({
    variant = 'banner',
    offlineMessage = 'You are offline. Some features may not be available.',
    onlineMessage = 'Connection restored!',
    showReconnecting = true,
}) => {
    const { isOnline, wasOffline } = useNetworkStatus();

    if (variant === 'snackbar') {
        return (
            <>
                <Snackbar
                    open={!isOnline}
                    anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
                >
                    <Alert 
                        severity="warning" 
                        icon={<WifiOffIcon />}
                        sx={{ width: '100%' }}
                    >
                        {offlineMessage}
                    </Alert>
                </Snackbar>
                <Snackbar
                    open={wasOffline && isOnline}
                    autoHideDuration={3000}
                    anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
                >
                    <Alert 
                        severity="success" 
                        icon={<WifiOnIcon />}
                        sx={{ width: '100%' }}
                    >
                        {onlineMessage}
                    </Alert>
                </Snackbar>
            </>
        );
    }

    if (variant === 'inline') {
        if (isOnline && !wasOffline) return null;
        
        return (
            <Collapse in={!isOnline || wasOffline}>
                <Alert 
                    severity={isOnline ? 'success' : 'warning'}
                    icon={isOnline ? <WifiOnIcon /> : <WifiOffIcon />}
                    sx={{ mb: 2 }}
                >
                    {isOnline ? onlineMessage : offlineMessage}
                </Alert>
            </Collapse>
        );
    }

    // Banner variant (default)
    return (
        <>
            <Collapse in={!isOnline}>
                <Box
                    sx={{
                        position: 'fixed',
                        top: 0,
                        left: 0,
                        right: 0,
                        zIndex: 9999,
                        bgcolor: 'warning.main',
                        color: 'warning.contrastText',
                        py: 1,
                        px: 2,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 1,
                        boxShadow: 2,
                    }}
                >
                    <WifiOffIcon fontSize="small" />
                    <Typography variant="body2" fontWeight="medium">
                        {offlineMessage}
                    </Typography>
                    {showReconnecting && (
                        <CircularProgress size={16} color="inherit" sx={{ ml: 1 }} />
                    )}
                </Box>
            </Collapse>
            <Collapse in={wasOffline && isOnline}>
                <Box
                    sx={{
                        position: 'fixed',
                        top: 0,
                        left: 0,
                        right: 0,
                        zIndex: 9999,
                        bgcolor: 'success.main',
                        color: 'success.contrastText',
                        py: 1,
                        px: 2,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 1,
                        boxShadow: 2,
                    }}
                >
                    <WifiOnIcon fontSize="small" />
                    <Typography variant="body2" fontWeight="medium">
                        {onlineMessage}
                    </Typography>
                </Box>
            </Collapse>
        </>
    );
};

export default OfflineBanner;
