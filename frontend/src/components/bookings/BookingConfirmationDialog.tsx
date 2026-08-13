import React from 'react';
import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Button,
    Typography,
    Grid,
    Paper,
    Box,
    Chip,
    Alert,
    FormControlLabel,
    Checkbox,
} from '@mui/material';
import WarningIcon from '@mui/icons-material/Warning';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import { format } from 'date-fns';

// Define type directly in component to avoid import issues
interface BookingDateBreakdown {
    requestedDates: string[];
    availableDates: string[];
    unavailableDates: string[];
    totalRequested: number;
    totalAvailable: number;
    totalUnavailable: number;
    isPartialBooking: boolean;
}

interface BookingConfirmationDialogProps {
    open: boolean;
    onClose: () => void;
    onConfirm: () => void;
    dateBreakdown: BookingDateBreakdown | null;
    calculatedPrice: number;
    currency: string;
}

const BookingConfirmationDialog: React.FC<BookingConfirmationDialogProps> = ({
    open,
    onClose,
    onConfirm,
    dateBreakdown,
    calculatedPrice,
    currency,
}) => {
    const [accepted, setAccepted] = React.useState(false);

    if (!dateBreakdown) return null;

    const { availableDates, unavailableDates, isPartialBooking, totalRequested, totalAvailable, totalUnavailable } = dateBreakdown;

    const handleConfirm = () => {
        if (isPartialBooking && !accepted) {
            return; // Prevent confirmation without accepting partial booking
        }
        onConfirm();
    };

    return (
        <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
            <DialogTitle>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    {isPartialBooking ? (
                        <>
                            <WarningIcon color="warning" />
                            <Typography variant="h6">Partial Booking Available</Typography>
                        </>
                    ) : (
                        <>
                            <CheckCircleIcon color="success" />
                            <Typography variant="h6">Confirm Booking</Typography>
                        </>
                    )}
                </Box>
            </DialogTitle>
            <DialogContent>
                {isPartialBooking && (
                    <Alert severity="warning" sx={{ mb: 3 }}>
                        <Typography variant="body2">
                            <strong>Note:</strong> Some dates in your selected range are unavailable.
                            Your booking will only include the available dates shown below.
                        </Typography>
                    </Alert>
                )}

                {/* Summary Cards */}
                <Box sx={{ mb: 3 }}>
                    <Typography variant="subtitle1" gutterBottom fontWeight="bold">
                        Booking Summary
                    </Typography>
                    <Grid container spacing={2}>
                        <Grid size={4}>
                            <Paper sx={{ p: 2, textAlign: 'center', bgcolor: 'grey.100' }}>
                                <Typography variant="caption" color="text.secondary">
                                    Requested
                                </Typography>
                                <Typography variant="h5" fontWeight="bold">
                                    {totalRequested}
                                </Typography>
                                <Typography variant="caption">days</Typography>
                            </Paper>
                        </Grid>
                        <Grid size={4}>
                            <Paper sx={{ p: 2, textAlign: 'center', bgcolor: 'success.lighter' }}>
                                <Typography variant="caption" color="text.secondary">
                                    Available
                                </Typography>
                                <Typography variant="h5" fontWeight="bold" color="success.dark">
                                    {totalAvailable}
                                </Typography>
                                <Typography variant="caption">days</Typography>
                            </Paper>
                        </Grid>
                        {isPartialBooking && (
                            <Grid size={4}>
                                <Paper sx={{ p: 2, textAlign: 'center', bgcolor: 'error.lighter' }}>
                                    <Typography variant="caption" color="text.secondary">
                                        Sold Out
                                    </Typography>
                                    <Typography variant="h5" fontWeight="bold" color="error.dark">
                                        {totalUnavailable}
                                    </Typography>
                                    <Typography variant="caption">days</Typography>
                                </Paper>
                            </Grid>
                        )}
                    </Grid>
                </Box>

                {/* Available Dates */}
                <Box sx={{ mb: 3 }}>
                    <Typography variant="subtitle2" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        <CheckCircleIcon fontSize="small" color="success" />
                        Booking will be created for these dates:
                    </Typography>
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mt: 1 }}>
                        {availableDates.map((date) => (
                            <Chip
                                key={date}
                                label={format(new Date(date), 'MMM dd, yyyy')}
                                color="success"
                                size="small"
                                variant="outlined"
                            />
                        ))}
                    </Box>
                </Box>

                {/* Unavailable Dates */}
                {isPartialBooking && (
                    <Box sx={{ mb: 3 }}>
                        <Typography variant="subtitle2" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                            <WarningIcon fontSize="small" color="error" />
                            These dates are sold out:
                        </Typography>
                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mt: 1 }}>
                            {unavailableDates.map((date) => (
                                <Chip
                                    key={date}
                                    label={format(new Date(date), 'MMM dd, yyyy')}
                                    color="error"
                                    size="small"
                                    variant="outlined"
                                />
                            ))}
                        </Box>
                    </Box>
                )}

                {/* Price Summary */}
                <Paper sx={{ p: 2, bgcolor: 'primary.lighter', borderLeft: 4, borderColor: 'primary.main' }}>
                    <Grid container spacing={2} alignItems="center">
                        <Grid size={6}>
                            <Typography variant="body2" color="text.secondary">
                                Total Price
                            </Typography>
                            <Typography variant="h5" fontWeight="bold" color="primary.dark">
                                {currency} {calculatedPrice.toLocaleString()}
                            </Typography>
                        </Grid>
                        <Grid size={6}>
                            <Typography variant="caption" color="text.secondary">
                                Based on {totalAvailable} {totalAvailable === 1 ? 'day' : 'days'}
                            </Typography>
                        </Grid>
                    </Grid>
                </Paper>

                {/* Acceptance Checkbox for Partial Bookings */}
                {isPartialBooking && (
                    <Box sx={{ mt: 2 }}>
                        <FormControlLabel
                            control={
                                <Checkbox
                                    checked={accepted}
                                    onChange={(e) => setAccepted(e.target.checked)}
                                    color="primary"
                                />
                            }
                            label={
                                <Typography variant="body2">
                                    I understand and accept this partial booking with {totalAvailable} out of {totalRequested} requested days
                                </Typography>
                            }
                        />
                    </Box>
                )}
            </DialogContent>
            <DialogActions sx={{ px: 3, pb: 2 }}>
                <Button onClick={onClose} color="inherit">
                    Cancel
                </Button>
                <Button
                    onClick={handleConfirm}
                    variant="contained"
                    color="primary"
                    disabled={isPartialBooking && !accepted}
                >
                    {isPartialBooking ? 'Proceed with Partial Booking' : 'Confirm Booking'}
                </Button>
            </DialogActions>
        </Dialog>
    );
};

export default BookingConfirmationDialog;
