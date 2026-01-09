import React, { useState } from 'react';
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
    IconButton,
    TextField,
    CircularProgress,
    Alert,
    MenuItem
} from '@mui/material';
import {
    Upload as UploadIcon,
    Delete as DeleteIcon,
    PlayArrow,
    Lock
} from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../services/api';
import { HubConnectionBuilder, HubConnection } from '@microsoft/signalr';
import { useEffect, useRef } from 'react';

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
    const queryClient = useQueryClient();

    const uploadMutation = useMutation({
        mutationFn: async () => {
            const formData = new FormData();
            formData.append('name', name);
            formData.append('pricePerPlay', price.toString());
            formData.append('currency', currency);
            if (file) formData.append('file', file);

            return api.post(`/screens/${screenId}/slots/${slotNumber}/content`, formData);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['slot-status', screenId] });
            handleClose();
        }
    });

    const handleClose = () => {
        setName('');
        setPrice(0);
        setCurrency('INR'); // Reset to default
        setFile(null);
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
                            onChange={(e) => setPrice(parseFloat(e.target.value))}
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
                        <Alert severity="error">Upload failed. Please try again.</Alert>
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
    const queryClient = useQueryClient();
    const connectionRef = useRef<HubConnection | null>(null);

    const { data: slotsData, isLoading } = useQuery({
        queryKey: ['slot-status', screenId],
        queryFn: () => api.get<{ data: SlotStatus[] }>(`/screens/${screenId}/slots/status`),
        refetchInterval: 10000 // Refresh every 10 seconds
    });

    // Real-time SignalR subscription for impression updates
    useEffect(() => {
        const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5257';

        const connection = new HubConnectionBuilder()
            .withUrl(`${API_BASE}/hubs/playback`)
            .withAutomaticReconnect()
            .build();

        connection.on('ImpressionRecorded', (data: { screenId: string; slotNumber: number; ownerContentId: string; timestamp: string }) => {
            console.log('📊 Impression recorded:', data);

            // Invalidate and refetch slot status to get updated play counts
            queryClient.invalidateQueries({ queryKey: ['slot-status', screenId] });
        });

        connection.start()
            .then(() => {
                console.log('✅ SignalR connected for screen:', screenId);
                // Subscribe to screen-specific events
                return connection.invoke('SubscribeToScreen', screenId);
            })
            .catch(err => console.error('❌ SignalR connection error:', err));

        connectionRef.current = connection;

        return () => {
            connection.stop();
        };
    }, [screenId, queryClient]);

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
                    <Grid item xs={12} md={6} lg={4} key={slot.slotNumber}>
                        <Card>
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
                                            Currently Playing
                                        </Typography>
                                    </Box>
                                ) : (
                                    <Box sx={{ mt: 2, mb: 1, p: 2, bgcolor: '#1a1a1a', borderRadius: '8px', textAlign: 'center' }}>
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

                            <CardActions>
                                {slot.canEdit && (
                                    <>
                                        <Button
                                            size="small"
                                            startIcon={<UploadIcon />}
                                            onClick={() => handleUploadClick(slot.slotNumber)}
                                        >
                                            {slot.status === ' Custom' ? 'Update' : 'Upload'}
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
