import { Backdrop, CircularProgress, Typography, Box } from '@mui/material';

interface GlobalLoadingProps {
    open: boolean;
    message?: string;
}

export default function GlobalLoading({ open, message }: GlobalLoadingProps) {
    return (
        <Backdrop
            sx={{
                color: '#fff',
                zIndex: (theme) => theme.zIndex.modal + 1,
                flexDirection: 'column',
                gap: 2,
            }}
            open={open}
        >
            <CircularProgress color="inherit" size={60} />
            {message && (
                <Typography variant="h6" component="div">
                    {message}
                </Typography>
            )}
        </Backdrop>
    );
}

// Hook to manage global loading state
export function useGlobalLoading() {
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState<string>();

    const showLoading = (msg?: string) => {
        setMessage(msg);
        setLoading(true);
    };

    const hideLoading = () => {
        setLoading(false);
        setMessage(undefined);
    };

    return {
        loading,
        message,
        showLoading,
        hideLoading,
    };
}
