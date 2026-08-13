import { useSnackbar } from 'notistack';
import type { VariantType } from 'notistack';
import { IconButton } from '@mui/material';
import { Close as CloseIcon } from '@mui/icons-material';

interface ToastOptions {
    variant?: VariantType;
    persist?: boolean;
    action?: {
        label: string;
        onClick: () => void;
    };
}

export function useToast() {
    const { enqueueSnackbar, closeSnackbar } = useSnackbar();

    const showToast = (message: string, options?: ToastOptions) => {
        const key = enqueueSnackbar(message, {
            variant: options?.variant || 'default',
            persist: options?.persist || false,
            action: (snackbarId) => (
                <>
                    {options?.action && (
                        <IconButton
                            size="small"
                            color="inherit"
                            onClick={() => {
                                options.action!.onClick();
                                closeSnackbar(snackbarId);
                            }}
                            sx={{ mr: 1 }}
                        >
                            {options.action.label}
                        </IconButton>
                    )}
                    <IconButton
                        size="small"
                        color="inherit"
                        onClick={() => closeSnackbar(snackbarId)}
                    >
                        <CloseIcon fontSize="small" />
                    </IconButton>
                </>
            ),
        });
        return key;
    };

    return {
        success: (message: string, options?: Omit<ToastOptions, 'variant'>) =>
            showToast(message, { ...options, variant: 'success' }),
        error: (message: string, options?: Omit<ToastOptions, 'variant'>) =>
            showToast(message, { ...options, variant: 'error' }),
        warning: (message: string, options?: Omit<ToastOptions, 'variant'>) =>
            showToast(message, { ...options, variant: 'warning' }),
        info: (message: string, options?: Omit<ToastOptions, 'variant'>) =>
            showToast(message, { ...options, variant: 'info' }),
        close: closeSnackbar,
    };
}
