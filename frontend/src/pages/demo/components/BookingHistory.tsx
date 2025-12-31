// BookingHistory Component - Shows advertiser's booking list with status and play counts

import React from 'react';
import { Box, Typography, Paper, Chip, Table, TableBody, TableCell, TableContainer, TableHead, TableRow } from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import PendingIcon from '@mui/icons-material/Pending';
import CancelIcon from '@mui/icons-material/Cancel';
import type { Booking, Screen } from '../types';
import { formatTimestamp } from '../utils/demoUtils';

interface BookingHistoryProps {
    bookings: Booking[];
    screens: Screen[];
    pricePerPlay: number;
}

export const BookingHistory: React.FC<BookingHistoryProps> = ({
    bookings,
    screens,
    pricePerPlay = 10,
}) => {
    if (bookings.length === 0) {
        return (
            <Paper variant="outlined" sx={{ p: 3, textAlign: 'center' }}>
                <Typography variant="body2" color="text.secondary">
                    No bookings yet
                </Typography>
                <Typography variant="caption" color="text.secondary">
                    Upload a video and book a screen to get started!
                </Typography>
            </Paper>
        );
    }

    const getStatusIcon = (status: string) => {
        switch (status) {
            case 'approved': return <CheckCircleIcon fontSize="small" color="success" />;
            case 'pending': return <PendingIcon fontSize="small" color="warning" />;
            case 'rejected': return <CancelIcon fontSize="small" color="error" />;
            default: return <CancelIcon fontSize="small" color="disabled" />;
        }
    };

    const getStatusChip = (status: string) => {
        const colors: Record<string, any> = {
            approved: 'success',
            pending: 'warning',
            rejected: 'error',
            expired: 'default',
        };
        return <Chip label={status.toUpperCase()} color={colors[status] || 'default'} size="small" />;
    };

    return (
        <Box>
            <Typography variant="h6" fontWeight="bold" gutterBottom>
                📋 Your Bookings
            </Typography>

            <TableContainer component={Paper} variant="outlined">
                <Table size="small">
                    <TableHead>
                        <TableRow>
                            <TableCell><strong>Screen</strong></TableCell>
                            <TableCell align="center"><strong>Status</strong></TableCell>
                            <TableCell align="right"><strong>Plays</strong></TableCell>
                            <TableCell align="right"><strong>Cost</strong></TableCell>
                            <TableCell align="right"><strong>Time</strong></TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {bookings.slice().reverse().map((booking) => {
                            const screen = screens.find(s => s.id === booking.screenId);
                            const playCount = booking.playCount || 0;
                            const cost = playCount * pricePerPlay;

                            return (
                                <TableRow key={booking.id}>
                                    <TableCell>
                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                            {getStatusIcon(booking.status)}
                                            <Typography variant="body2">
                                                {screen?.name || 'Unknown'}
                                            </Typography>
                                        </Box>
                                    </TableCell>
                                    <TableCell align="center">
                                        {getStatusChip(booking.status)}
                                    </TableCell>
                                    <TableCell align="right">
                                        <Typography variant="body2" fontWeight={playCount > 0 ? 'bold' : 'normal'}>
                                            {playCount}
                                        </Typography>
                                    </TableCell>
                                    <TableCell align="right">
                                        <Typography variant="body2" color={cost > 0 ? 'primary.main' : 'text.secondary'}>
                                            ₹{cost}
                                        </Typography>
                                    </TableCell>
                                    <TableCell align="right">
                                        <Typography variant="caption" color="text.secondary">
                                            {formatTimestamp(booking.createdAt)}
                                        </Typography>
                                    </TableCell>
                                </TableRow>
                            );
                        })}
                    </TableBody>
                </Table>
            </TableContainer>
        </Box>
    );
};
