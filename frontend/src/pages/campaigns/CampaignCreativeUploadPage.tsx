import { useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
    Alert,
    Box,
    Button,
    Container,
    LinearProgress,
    Paper,
    TextField,
    Typography,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import MovieIcon from '@mui/icons-material/Movie';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useSnackbar } from 'notistack';
import api from '../../services/api';

const ACCEPTED = ['video/mp4', 'video/webm', 'image/jpeg', 'image/png', 'image/webp'];
const MAX_BYTES = 100 * 1024 * 1024;

/**
 * Add a creative to an existing campaign — the page /campaigns/:id/creatives/new
 * linked to but which never existed (it 404'd). Uploads through the same
 * endpoint the wizard uses; any resolution is accepted and the player fits it
 * to each screen at play time.
 */
export default function CampaignCreativeUploadPage() {
    const { id: campaignId } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const { enqueueSnackbar } = useSnackbar();
    const fileInput = useRef<HTMLInputElement>(null);

    const [name, setName] = useState('');
    const [duration, setDuration] = useState(10);
    const [file, setFile] = useState<File | null>(null);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    const pickFile = (f: File | null) => {
        setError(null);
        if (!f) return;
        if (!ACCEPTED.includes(f.type)) {
            setError('Use MP4/WebM video or JPEG/PNG/WebP image.');
            return;
        }
        if (f.size > MAX_BYTES) {
            setError('File is over 100 MB.');
            return;
        }
        setFile(f);
        if (!name) setName(f.name.replace(/\.[^.]+$/, ''));
        if (previewUrl) URL.revokeObjectURL(previewUrl);
        setPreviewUrl(URL.createObjectURL(f));
    };

    const uploadMutation = useMutation({
        mutationFn: async () => {
            const form = new FormData();
            form.append('file', file!);
            form.append('name', name.trim());
            form.append('duration', String(duration));
            if (campaignId) form.append('campaignId', campaignId);
            return api.post('/creatives/upload', form, {
                headers: { 'Content-Type': 'multipart/form-data' },
            });
        },
        onSuccess: () => {
            enqueueSnackbar('Creative uploaded', { variant: 'success' });
            queryClient.invalidateQueries({ queryKey: ['campaign', campaignId] });
            queryClient.invalidateQueries({ queryKey: ['creatives'] });
            navigate(`/campaigns/${campaignId}`);
        },
        onError: () => enqueueSnackbar('Upload failed — try again', { variant: 'error' }),
    });

    const isVideo = file?.type.startsWith('video');
    const canSubmit = !!file && name.trim().length > 0 && !uploadMutation.isPending;

    return (
        <Container maxWidth="sm" sx={{ py: 3 }}>
            <Button startIcon={<ArrowBackIcon />} onClick={() => navigate(`/campaigns/${campaignId}`)} sx={{ mb: 2 }}>
                Back to campaign
            </Button>
            <Paper sx={{ p: 3 }}>
                <Typography variant="h4" gutterBottom>Add creative</Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                    Upload any resolution — the player fits it to every screen automatically,
                    no redesign needed. Video plays for its own length; images show for the
                    duration you set.
                </Typography>

                {/* Drop zone */}
                <Box
                    onClick={() => fileInput.current?.click()}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => { e.preventDefault(); pickFile(e.dataTransfer.files?.[0] ?? null); }}
                    sx={{
                        border: '2px dashed', borderColor: file ? 'success.main' : 'divider',
                        borderRadius: 2, p: 3, textAlign: 'center', cursor: 'pointer', mb: 2,
                        transition: 'border-color 0.2s',
                        '&:hover': { borderColor: 'primary.main' },
                    }}
                >
                    <input
                        ref={fileInput} type="file" hidden accept={ACCEPTED.join(',')}
                        onChange={(e) => pickFile(e.target.files?.[0] ?? null)}
                    />
                    {previewUrl ? (
                        isVideo ? (
                            <Box component="video" src={previewUrl} controls muted
                                sx={{ maxWidth: '100%', maxHeight: 240, borderRadius: 1 }} />
                        ) : (
                            <Box component="img" src={previewUrl} alt=""
                                sx={{ maxWidth: '100%', maxHeight: 240, borderRadius: 1 }} />
                        )
                    ) : (
                        <>
                            <CloudUploadIcon sx={{ fontSize: 40, color: 'text.disabled' }} />
                            <Typography variant="body2" sx={{ mt: 1 }}>
                                Drop your ad here, or click to choose
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                                MP4 / WebM / JPEG / PNG / WebP · up to 100 MB
                            </Typography>
                        </>
                    )}
                </Box>
                {file && (
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 2 }}>
                        <MovieIcon sx={{ fontSize: 14 }} /> {file.name} · {(file.size / 1024 / 1024).toFixed(1)} MB
                    </Typography>
                )}
                {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

                <TextField
                    label="Creative name" fullWidth value={name}
                    onChange={(e) => setName(e.target.value)} sx={{ mb: 2 }}
                />
                {!isVideo && (
                    <TextField
                        label="Display duration (seconds)" type="number" fullWidth value={duration}
                        onChange={(e) => setDuration(Math.max(3, Math.min(60, Number(e.target.value) || 10)))}
                        helperText="How long the image stays on screen each play (3–60s)"
                        sx={{ mb: 2 }}
                    />
                )}

                {uploadMutation.isPending && <LinearProgress sx={{ mb: 2 }} />}
                <Button
                    variant="contained" fullWidth size="large" startIcon={<CloudUploadIcon />}
                    disabled={!canSubmit} onClick={() => uploadMutation.mutate()}
                >
                    {uploadMutation.isPending ? 'Uploading…' : 'Upload creative'}
                </Button>
            </Paper>
        </Container>
    );
}
