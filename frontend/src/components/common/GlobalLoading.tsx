import { Backdrop, CircularProgress, Typography } from '@mui/material';

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
