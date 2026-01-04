// WelcomeTourModal - First-time user welcome with role selection
import React from 'react';
import {
    Dialog,
    DialogTitle,
    DialogContent,
    Button,
    Box,
    Typography,
    Divider,
} from '@mui/material';
import PersonIcon from '@mui/icons-material/Person';
import TvIcon from '@mui/icons-material/Tv';
import CloseIcon from '@mui/icons-material/Close';
import IconButton from '@mui/material/IconButton';

interface WelcomeTourModalProps {
    open: boolean;
    onClose: () => void;
    onStartAdvertiserTour: () => void;
    onStartScreenOwnerTour: () => void;
}

export const WelcomeTourModal: React.FC<WelcomeTourModalProps> = ({
    open,
    onClose,
    onStartAdvertiserTour,
    onStartScreenOwnerTour,
}) => {
    const handleAdvertiser = () => {
        onClose();
        setTimeout(onStartAdvertiserTour, 300); // Small delay for smooth transition
    };

    const handleScreenOwner = () => {
        onClose();
        setTimeout(onStartScreenOwnerTour, 300);
    };

    return (
        <Dialog
            open={open}
            onClose={onClose}
            maxWidth="sm"
            fullWidth
            PaperProps={{
                sx: { borderRadius: 3 }
            }}
        >
            <DialogTitle sx={{ pr: 6 }}>
                <Typography component="div" variant="h5" fontWeight="bold" textAlign="center">
                    Welcome to PixelCCMS Demo! 🎬
                </Typography>
                <IconButton
                    onClick={onClose}
                    sx={{
                        position: 'absolute',
                        right: 8,
                        top: 8,
                    }}
                >
                    <CloseIcon />
                </IconButton>
            </DialogTitle>

            <Divider />

            <DialogContent sx={{ py: 4 }}>
                <Typography variant="body1" textAlign="center" sx={{ mb: 4 }}>
                    Choose your role to start an interactive guided tour that will show you exactly how everything works!
                </Typography>

                <Box sx={{ display: 'flex', gap: 2, flexDirection: 'column' }}>
                    <Button
                        variant="contained"
                        size="large"
                        startIcon={<PersonIcon fontSize="large" />}
                        onClick={handleAdvertiser}
                        sx={{
                            py: 2.5,
                            fontSize: '1.1rem',
                            textTransform: 'none',
                        }}
                    >
                        I'm an Advertiser
                        <Typography variant="caption" display="block" sx={{ ml: 1, opacity: 0.8 }}>
                            Show me how to book ad slots
                        </Typography>
                    </Button>

                    <Button
                        variant="outlined"
                        size="large"
                        startIcon={<TvIcon fontSize="large" />}
                        onClick={handleScreenOwner}
                        sx={{
                            py: 2.5,
                            fontSize: '1.1rem',
                            textTransform: 'none',
                        }}
                    >
                        I'm a Screen Owner
                        <Typography variant="caption" display="block" sx={{ ml: 1, opacity: 0.7 }}>
                            Show me how to manage my screens
                        </Typography>
                    </Button>

                    <Divider sx={{ my: 1 }} />

                    <Button
                        variant="text"
                        onClick={onClose}
                        sx={{
                            mt: 1,
                            color: 'text.secondary',
                            textTransform: 'none',
                        }}
                    >
                        Skip tour, I'll explore on my own
                    </Button>
                </Box>
            </DialogContent>
        </Dialog>
    );
};
