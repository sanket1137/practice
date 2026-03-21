import { useState } from 'react';
import {
    Dialog, DialogTitle, DialogContent, DialogActions, Button,
    TextField, MenuItem, Grid, CircularProgress, Alert, Typography,
    InputAdornment,
} from '@mui/material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSnackbar } from 'notistack';
import { api } from '../../services/api';
import { selfReserveSlot } from '../../services/profileApi';
import type { SelfReserveSlotRequest } from '../../types/profile';

interface Creative {
    id: string;
    name: string;
    duration: number;
    width: number;
    height: number;
}

interface Props {
    open: boolean;
    onClose: () => void;
    screenId: string;
    screenName: string;
}

export default function SelfReserveDialog({ open, onClose, screenId, screenName }: Props) {
    const { enqueueSnackbar } = useSnackbar();
    const queryClient = useQueryClient();

    const [creativeId, setCreativeId] = useState('');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [slotNumber, setSlotNumber] = useState('');
    const [clientName, setClientName] = useState('');
    const [clientContact, setClientContact] = useState('');
    const [internalNotes, setInternalNotes] = useState('');
    const [price, setPrice] = useState('');

    const { data: creatives, isLoading: creativesLoading } = useQuery<Creative[]>({
        queryKey: ['my-creatives'],
        queryFn: async () => {
            const response = await api.get('/creatives/my');
            return response.data.data;
        },
        enabled: open,
    });

    const mutation = useMutation({
        mutationFn: (req: SelfReserveSlotRequest) => selfReserveSlot(req),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['bookings'] });
            queryClient.invalidateQueries({ queryKey: ['self-reserved'] });
            enqueueSnackbar('Slot reserved successfully', { variant: 'success' });
            handleClose();
        },
        onError: () => enqueueSnackbar('Failed to reserve slot', { variant: 'error' }),
    });

    const handleClose = () => {
        setCreativeId('');
        setStartDate('');
        setEndDate('');
        setSlotNumber('');
        setClientName('');
        setClientContact('');
        setInternalNotes('');
        setPrice('');
        onClose();
    };

    const handleSubmit = () => {
        const req: SelfReserveSlotRequest = {
            screenId,
            creativeId,
            startDate,
            endDate,
            slotNumber: slotNumber ? parseInt(slotNumber, 10) : undefined,
            clientName: clientName || undefined,
            clientContact: clientContact || undefined,
            internalNotes: internalNotes || undefined,
            price: price ? parseFloat(price) : undefined,
        };
        mutation.mutate(req);
    };

    const canSubmit = creativeId && startDate && endDate && !mutation.isPending;

    return (
        <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
            <DialogTitle>Self-Reserve Slot — {screenName}</DialogTitle>
            <DialogContent>
                <Typography variant="body2" color="text.secondary" mb={2}>
                    Reserve a slot on your own screen. This will be immediately approved.
                </Typography>

                {creativesLoading ? (
                    <CircularProgress size={24} />
                ) : !creatives?.length ? (
                    <Alert severity="warning" sx={{ mb: 2 }}>
                        No creatives found. Upload a creative first (Campaigns → Upload Creative without selecting a campaign).
                    </Alert>
                ) : (
                    <TextField
                        select
                        fullWidth
                        label="Creative"
                        value={creativeId}
                        onChange={e => setCreativeId(e.target.value)}
                        required
                        sx={{ mb: 2, mt: 1 }}
                    >
                        {creatives.map(c => (
                            <MenuItem key={c.id} value={c.id}>
                                {c.name} ({c.width}×{c.height}, {c.duration}s)
                            </MenuItem>
                        ))}
                    </TextField>
                )}

                <Grid container spacing={2}>
                    <Grid size={{ xs: 6 }}>
                        <TextField
                            fullWidth
                            label="Start Date"
                            type="date"
                            value={startDate}
                            onChange={e => setStartDate(e.target.value)}
                            required
                            slotProps={{ inputLabel: { shrink: true } }}
                        />
                    </Grid>
                    <Grid size={{ xs: 6 }}>
                        <TextField
                            fullWidth
                            label="End Date"
                            type="date"
                            value={endDate}
                            onChange={e => setEndDate(e.target.value)}
                            required
                            slotProps={{ inputLabel: { shrink: true } }}
                        />
                    </Grid>
                    <Grid size={{ xs: 6 }}>
                        <TextField
                            fullWidth
                            label="Slot Number (optional)"
                            type="number"
                            value={slotNumber}
                            onChange={e => setSlotNumber(e.target.value)}
                            helperText="Leave empty for auto-assign"
                        />
                    </Grid>
                    <Grid size={{ xs: 6 }}>
                        <TextField
                            fullWidth
                            label="Custom Price (optional)"
                            type="number"
                            value={price}
                            onChange={e => setPrice(e.target.value)}
                            InputProps={{ startAdornment: <InputAdornment position="start">₹</InputAdornment> }}
                            helperText="Overrides default slot price"
                        />
                    </Grid>
                    <Grid size={{ xs: 6 }}>
                        <TextField
                            fullWidth
                            label="Client Name (optional)"
                            value={clientName}
                            onChange={e => setClientName(e.target.value)}
                        />
                    </Grid>
                    <Grid size={{ xs: 6 }}>
                        <TextField
                            fullWidth
                            label="Client Contact (optional)"
                            value={clientContact}
                            onChange={e => setClientContact(e.target.value)}
                        />
                    </Grid>
                    <Grid size={12}>
                        <TextField
                            fullWidth
                            label="Internal Notes (optional)"
                            multiline
                            rows={2}
                            value={internalNotes}
                            onChange={e => setInternalNotes(e.target.value)}
                        />
                    </Grid>
                </Grid>

                {mutation.isError && (
                    <Alert severity="error" sx={{ mt: 2 }}>Failed to reserve slot. Please try again.</Alert>
                )}
            </DialogContent>
            <DialogActions>
                <Button onClick={handleClose}>Cancel</Button>
                <Button
                    variant="contained"
                    disabled={!canSubmit}
                    onClick={handleSubmit}
                >
                    {mutation.isPending ? <CircularProgress size={20} /> : 'Reserve Slot'}
                </Button>
            </DialogActions>
        </Dialog>
    );
}
