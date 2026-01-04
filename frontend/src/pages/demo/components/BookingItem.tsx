// BookingItem Component (MUI Version)

import React from 'react';
import { Box, Typography, Button, Paper } from '@mui/material';
import CheckIcon from '@mui/icons-material/Check';
import CloseIcon from '@mui/icons-material/Close';
import type { Booking } from '../types';
import { formatTimestamp } from '../utils/demoUtils';

interface BookingItemProps {
    booking: Booking;
    campaignName: string;
    onApprove: (bookingId: string) => void;
    onReject: (bookingId: string) => void;
}

export const BookingItem: React.FC<BookingItemProps> = ({
    booking,
    campaignName,
    onApprove,
    onReject,
}) => {
    const [isProcessing, setIsProcessing] = React.useState(false);

    const handleAction = async (action: () => void) => {
        setIsProcessing(true);
        await new Promise(resolve => setTimeout(resolve, 300));
        action();
        setIsProcessing(false);
    };

    if (booking.status !== 'pending') return null;

    return (
        <Paper variant="outlined" sx={{ p: 2, bgcolor: 'warning.lighter' }}>
            <Box>
                <Typography variant="subtitle2" fontWeight="bold">
                    {campaignName}
                </Typography>
                <Typography variant="caption" color="text.secondary" display="block">
                    Booked at {formatTimestamp(booking.createdAt)}
                </Typography>
                <Typography variant="caption" color="warning.dark" display="block">
                    Expires in ~5 minutes
                </Typography>
            </Box>

            <Box sx={{ display: 'flex', gap: 1, mt: 2 }}>
                <Button
                    className="approve-button"
                    variant="contained"
                    color="success"
                    fullWidth
                    startIcon={<CheckIcon />}
                    disabled={isProcessing}
                    onClick={() => handleAction(() => onApprove(booking.id))}
                >
                    Approve
                </Button>
                <Button
                    variant="contained"
                    color="error"
                    fullWidth
                    startIcon={<CloseIcon />}
                    disabled={isProcessing}
                    onClick={() => handleAction(() => onReject(booking.id))}
                >
                    Reject
                </Button>
            </Box>
        </Paper>
    );
};
