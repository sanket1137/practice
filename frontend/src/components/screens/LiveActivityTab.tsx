import { useState, useEffect, useRef, useCallback } from 'react';
import {
    Box,
    Grid,
    Card,
    CardHeader,
    CardContent,
    CardActions,
    Avatar,
    Chip,
    Button,
    Typography,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    TextField,
    CircularProgress,
    Alert,
    MenuItem
} from '@mui/material';
import {
    Upload as UploadIcon,
    Delete as DeleteIcon,
    Lock
} from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { isAxiosError } from 'axios';
import { api } from '../../services/api';
import { websocketService } from '../../services/websocket';

interface SlotStatus {
    slotNumber: number;
    status: string; // "Empty" | "Custom" | "Booked"
    contentName?: string;
    videoUrl?: string;
    canEdit: boolean;
    ownerContent?: {
        id: string;
        name: string;
        pricePerPlay: number;
        totalPlays: number;
        totalRevenue: number;
    };
}

interface UploadDialogProps {
    open: boolean;
    slotNumber: number;
    onClose: () => void;
    screenId: string;
}

function UploadSlotDialog({ open, slotNumber, onClose, screenId }: UploadDialogProps) {
    const [name, setName] = useState('');
    const [price, setPrice] = useState<number>(0);
    const [currency, setCurrency] = useState<string>('INR'); // Default to INR
    const [file, setFile] = useState<File | null>(null);
    const [errorMessage, setErrorMessage] = useState<string>('');
    const queryClient = useQueryClient();

    const uploadMutation = useMutation({
        mutationFn: async () => {
            const formData = new FormData();
            formData.append('name', name.trim());
            // Ensure price is a valid number, default to 0 if NaN
            const safePrice = isNaN(price) ? 0 : price;
            formData.append('pricePerPlay', safePrice.toString());
            formData.append('currency', currency);
            if (file) formData.append('file', file);

            return api.post(`/screens/${screenId}/slots/${slotNumber}/content`, formData);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['slot-status', screenId] });
            handleClose();
        },
        onError: (error: unknown) => {
            // Extract the actual error message from the backend response
            const backendMessage = (isAxiosError<{ message?: string; errors?: string[] }>(error)
                ? error.response?.data?.message || error.response?.data?.errors?.[0]
                : undefined)
                || (error instanceof Error ? error.message : undefined)
                || 'Upload failed. Please try again.';
            setErrorMessage(backendMessage);
        }
    });

    const handleClose = () => {
        setName('');
        setPrice(0);
        setCurrency('INR'); // Reset to default
        setFile(null);
        setErrorMessage('');
        onClose();
    };

    const currencySymbols: Record<string, string> = {
        'INR': '₹',
        'USD': '$',
        'EUR': '€',
        'GBP': '£'
    };

    return (
        <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
            <DialogTitle>Upload Content for Slot {slotNumber}</DialogTitle>
            <DialogContent>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 2 }}>
                    <TextField
                        label="Content Name"
                        fullWidth
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        required
                    />
                    <Box sx={{ display: 'flex', gap: 2 }}>
                        <TextField
                            select
                            label="Currency"
                            value={currency}
                            onChange={(e) => setCurrency(e.target.value)}
                            sx={{ width: '40%' }}
                        >
                            <MenuItem value="INR">INR (₹)</MenuItem>
                            <MenuItem value="USD">USD ($)</MenuItem>
                            <MenuItem value="EUR">EUR (€)</MenuItem>
                            <MenuItem value="GBP">GBP (£)</MenuItem>
                        </TextField>
                        <TextField
                            label={`Price Per Play (${currencySymbols[currency]})`}
                            type="number"
                            fullWidth
                            value={price}
                            onChange={(e) => {
                                const val = parseFloat(e.target.value);
                                setPrice(isNaN(val) ? 0 : val);
                            }}
                            required
                            inputProps={{ min: 0, step: 0.01 }}
                        />
                    </Box>
                    <Button variant="outlined" component="label" fullWidth>
                        {file ? file.name : 'Choose Video File'}
                        <input
                            type="file"
                            hidden
                            accept="video/*"
                            onChange={(e) => setFile(e.target.files?.[0] || null)}
                        />
                    </Button>
                    {uploadMutation.isError && (
                        <Alert severity="error">{errorMessage || 'Upload failed. Please try again.'}</Alert>
                    )}
                </Box>
            </DialogContent>
            <DialogActions>
                <Button onClick={handleClose}>Cancel</Button>
                <Button
                    onClick={() => uploadMutation.mutate()}
                    variant="contained"
                    disabled={!name || !file || uploadMutation.isPending}
                    startIcon={uploadMutation.isPending ? <CircularProgress size={20} /> : <UploadIcon />}
                >
                    Upload
                </Button>
            </DialogActions>
        </Dialog>
    );
}

export default function LiveActivityTab({ screenId }: { screenId: string }) {
    const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
    const [selectedSlot, setSelectedSlot] = useState<number>(1);
    const [currentlyPlaying, setCurrentlyPlaying] = useState<{ slotNumber: number; creativeId: string | null } | null>(null);
    const queryClient = useQueryClient();
    const subscribedRef = useRef(false);

    const { data: slotsData, isLoading } = useQuery({
        queryKey: ['slot-status', screenId],
        queryFn: () => api.get<{ data: SlotStatus[] }>(`/screens/${screenId}/slots/status`),
        // Removed refetchInterval - using SignalR for real-time updates instead
        staleTime: 30000 // Consider data fresh for 30 seconds
    });

    // Stable callback refs to avoid re-subscribing on every render
    const handleAdStarted = useCallback((data: { screenId: string; slotNumber?: number; creativeId?: string }) => {
        console.log('🎬 AdStarted:', data);
        if (data.screenId === screenId) {
            setCurrentlyPlaying({
                slotNumber: data.slotNumber || 0,
                creativeId: data.creativeId || null
            });
        }
    }, [screenId]);

    const handleImpressionRecorded = useCallback(() => {
        queryClient.invalidateQueries({ queryKey: ['slot-status', screenId] });
    }, [queryClient, screenId]);

    const handleSlotStatusChanged = useCallback(() => {
        queryClient.invalidateQueries({ queryKey: ['slot-status', screenId] });
    }, [queryClient, screenId]);

    // Playlist changed on backend (slot content uploaded/removed, booking approved, etc.)
    // Refresh slot status so the UI reflects the new playlist immediately.
    const handlePlaylistUpdated = useCallback(() => {
        queryClient.invalidateQueries({ queryKey: ['slot-status', screenId] });
    }, [queryClient, screenId]);

    // No-op handler for player-only SetSyncMode events (prevents SignalR warnings)
    const handleSetSyncMode = useCallback(() => {}, []);

    // Real-time SignalR subscription using the singleton websocketService
    useEffect(() => {
        let cancelled = false;

        const setup = async () => {
            try {
                await websocketService.connect();
                if (cancelled) return;

                // Register event listeners
                websocketService.on('AdStarted', handleAdStarted);
                websocketService.on('ImpressionRecorded', handleImpressionRecorded);
                websocketService.on('SlotStatusChanged', handleSlotStatusChanged);
                websocketService.on('PlaylistUpdated', handlePlaylistUpdated);
                // SetSyncMode is a player-only command; register a no-op handler
                // to prevent SignalR "No client method" warnings in the console
                websocketService.on('SetSyncMode', handleSetSyncMode);

                // Subscribe to this screen's events
                await websocketService.subscribeToScreen(screenId, () => {});
                subscribedRef.current = true;
                console.log('✅ SignalR connected for screen:', screenId);

                // Request fast sync while viewing live activity
                await websocketService.requestFastSync(screenId);
            } catch (err) {
                if (!cancelled) {
                    console.error('❌ SignalR connection error:', err);
                }
            }
        };

        setup();

        return () => {
            cancelled = true;
            // Clean up event listeners
            websocketService.off('AdStarted', handleAdStarted);
            websocketService.off('ImpressionRecorded', handleImpressionRecorded);
            websocketService.off('SlotStatusChanged', handleSlotStatusChanged);
            websocketService.off('PlaylistUpdated', handlePlaylistUpdated);
            websocketService.off('SetSyncMode', handleSetSyncMode);

            // Unsubscribe and revert to normal sync
            if (subscribedRef.current) {
                websocketService.invokeIfConnected('UnsubscribeFromScreen', screenId);
                websocketService.requestNormalSync(screenId);
                subscribedRef.current = false;
            }
        };
    }, [screenId, handleAdStarted, handleImpressionRecorded, handleSlotStatusChanged, handlePlaylistUpdated, handleSetSyncMode]);

    const deleteMutation = useMutation({
        mutationFn: (slotNumber: number) =>
            api.delete(`/screens/${screenId}/slots/${slotNumber}/content`),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['slot-status', screenId] });
        }
    });

    const handleUploadClick = (slotNumber: number) => {
        setSelectedSlot(slotNumber);
        setUploadDialogOpen(true);
    };

    const handleDeleteClick = (slotNumber: number) => {
        if (confirm('Remove custom content? Default video will play instead.')) {
            deleteMutation.mutate(slotNumber);
        }
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'Booked': return 'success';
            case 'Custom': return 'warning';
            default: return 'default';
        }
    };

    if (isLoading) {
        return (
            <Box display="flex" justifyContent="center" p={4}>
                <CircularProgress />
            </Box>
        );
    }

    const slots = slotsData?.data.data || [];

    return (
        <Box sx={{ p: 3 }}>
            <Typography variant="h5" gutterBottom>
                Real-Time Screen Activity
            </Typography>
            <Typography variant="body2" color="text.secondary" gutterBottom>
                Manage your screen slots and monitor live playback
            </Typography>
            <Grid container spacing={2} sx={{ mt: 2 }}>
                {slots.map((slot) => (
                    <Grid
                        key={slot.slotNumber}
                        size={{
                            xs: 12,
                            md: 6,
                            lg: 4
                        }}>
                        <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                            <CardHeader
                                avatar={
                                    <Avatar sx={{ bgcolor: slot.status === 'Booked' ? 'success.main' : slot.status === 'Custom' ? 'warning.main' : 'grey.500' }}>
                                        {slot.status === 'Booked' ? <Lock /> : slot.slotNumber}
                                    </Avatar>
                                }
                                title={`Slot ${slot.slotNumber}`}
                                action={
                                    <Chip
                                        label={slot.status}
                                        color={getStatusColor(slot.status)}
                                        size="small"
                                    />
                                }
                            />

                            <CardContent>
                                <Typography variant="body2" gutterBottom>
                                    {slot.status === 'Booked' && '🎬 '}
                                    {slot.status === 'Custom' && '📹 '}
                                    {slot.status === 'Empty' && '🎥 '}
                                    {slot.contentName || 'Default Video'}
                                </Typography>

                                {/* Video Preview */}
                                {slot.videoUrl ? (
                                    <Box sx={{ mt: 2, mb: 1 }}>
                                        <video
                                            src={slot.videoUrl}
                                            style={{
                                                width: '100%',
                                                maxHeight: '150px',
                                                borderRadius: '8px',
                                                backgroundColor: '#000',
                                                objectFit: 'contain'
                                            }}
                                            controls
                                            muted
                                        />
                                        <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                                            {currentlyPlaying?.slotNumber === slot.slotNumber ? (
                                                <Typography variant="caption" color="success.main" fontWeight="bold">
                                                    ▶️ Currently Playing
                                                </Typography>
                                            ) : (
                                                'Preview'
                                            )}
                                        </Typography>
                                    </Box>
                                ) : (
                                    <Box sx={{
                                        mt: 2,
                                        mb: 1,
                                        p: 2,
                                        bgcolor: '#1a1a1a',
                                        borderRadius: '8px',
                                        textAlign: 'center',
                                        height: '150px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center'
                                    }}>
                                        <Typography variant="caption" color="text.secondary">
                                            No video available
                                        </Typography>
                                    </Box>
                                )}

                                {slot.ownerContent && (
                                    <Box sx={{ mt: 1 }}>
                                        <Typography variant="caption" display="block">
                                            ${slot.ownerContent.pricePerPlay.toFixed(2)}/play • {slot.ownerContent.totalPlays} plays
                                        </Typography>
                                        <Typography variant="caption" color="success.main">
                                            Revenue: ${slot.ownerContent.totalRevenue.toFixed(2)}
                                        </Typography>
                                    </Box>
                                )}

                                {!slot.canEdit && slot.status === 'Booked' && (
                                    <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                                        🔒 Locked (active booking)
                                    </Typography>
                                )}
                            </CardContent>

                            <CardActions sx={{ mt: 'auto' }}>
                                {slot.canEdit && (
                                    <>
                                        <Button
                                            size="small"
                                            startIcon={<UploadIcon />}
                                            onClick={() => handleUploadClick(slot.slotNumber)}
                                        >
                                            {slot.status === 'Custom' ? 'Update' : 'Upload'}
                                        </Button>
                                        {slot.status === 'Custom' && (
                                            <Button
                                                size="small"
                                                color="error"
                                                startIcon={deleteMutation.isPending ? <CircularProgress size={16} /> : <DeleteIcon />}
                                                onClick={() => handleDeleteClick(slot.slotNumber)}
                                                disabled={deleteMutation.isPending}
                                            >
                                                Remove
                                            </Button>
                                        )}
                                    </>
                                )}
                            </CardActions>
                        </Card>
                    </Grid>
                ))}
            </Grid>
            <UploadSlotDialog
                open={uploadDialogOpen}
                slotNumber={selectedSlot}
                onClose={() => setUploadDialogOpen(false)}
                screenId={screenId}
            />
        </Box>
    );
}
