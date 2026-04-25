import { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import {
    Box, Card, CardContent, CardMedia, Typography, Stack, Grid, LinearProgress,
    IconButton, Tooltip, Skeleton,
} from '@mui/material';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import DeleteIcon from '@mui/icons-material/Delete';
import ImageIcon from '@mui/icons-material/Image';
import VideocamIcon from '@mui/icons-material/Videocam';
import HtmlIcon from '@mui/icons-material/Html';
import PermMediaIcon from '@mui/icons-material/PermMedia';
import axios from 'axios';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSnackbar } from 'notistack';
import { cmsMediaApi, computeSha256Hex } from '../../services/cmsApi';
import EmptyState from '../../components/common/EmptyState';
import type { MediaAssetDto } from '../../types/cms';

const ACCEPTED = {
    'image/jpeg': [], 'image/png': [], 'image/webp': [], 'image/gif': [],
    'video/mp4': [], 'video/webm': [], 'video/quicktime': [],
    'text/html': ['.html'],
};
const MAX_SIZE = 500 * 1024 * 1024;

interface UploadProgress {
    fileName: string;
    phase: 'hashing' | 'checking' | 'presigning' | 'uploading' | 'finalizing' | 'done' | 'error';
    pct: number;
    error?: string;
}

export default function CmsMediaPage() {
    const { enqueueSnackbar } = useSnackbar();
    const queryClient = useQueryClient();
    const [progress, setProgress] = useState<Record<string, UploadProgress>>({});

    const { data, isLoading } = useQuery({
        queryKey: ['cms-media'],
        queryFn: () => cmsMediaApi.list(1, 48),
    });

    const handleFiles = useCallback(async (files: File[]) => {
        for (const file of files) {
            const key = `${file.name}_${file.size}`;
            const update = (p: Partial<UploadProgress>) =>
                setProgress((prev) => ({
                    ...prev,
                    [key]: { ...(prev[key] ?? { fileName: file.name, phase: 'hashing', pct: 0 }), ...p },
                }));
            try {
                update({ phase: 'hashing', pct: 5 });
                const sha256 = await computeSha256Hex(file);

                update({ phase: 'checking', pct: 15 });
                const existing = await cmsMediaApi.checkSha256({ sha256 });
                if (existing.exists) {
                    update({ phase: 'done', pct: 100 });
                    enqueueSnackbar(`${file.name} already in library`, { variant: 'info' });
                    continue;
                }

                update({ phase: 'presigning', pct: 20 });
                const presign = await cmsMediaApi.presignUpload({
                    sha256,
                    originalName: file.name,
                    mimeType: file.type || 'application/octet-stream',
                    sizeBytes: file.size,
                });

                update({ phase: 'uploading', pct: 25 });
                await axios.put(presign.uploadUrl, file, {
                    headers: { 'Content-Type': file.type || 'application/octet-stream' },
                    onUploadProgress: (e) => {
                        if (e.total) {
                            const upct = Math.round((e.loaded / e.total) * 70);
                            update({ pct: 25 + upct });
                        }
                    },
                });

                update({ phase: 'finalizing', pct: 95 });
                // Optional metadata extraction (dimensions/duration)
                const meta = await extractMediaMeta(file);
                await cmsMediaApi.finalize({ mediaAssetId: presign.mediaAssetId, ...meta });

                update({ phase: 'done', pct: 100 });
                enqueueSnackbar(`Uploaded ${file.name}`, { variant: 'success' });
            } catch (err) {
                const msg = err instanceof Error ? err.message : 'Upload failed';
                update({ phase: 'error', pct: 0, error: msg });
                enqueueSnackbar(`${file.name}: ${msg}`, { variant: 'error' });
            }
        }
        queryClient.invalidateQueries({ queryKey: ['cms-media'] });
    }, [enqueueSnackbar, queryClient]);

    const { getRootProps, getInputProps, isDragActive } = useDropzone({
        onDrop: handleFiles,
        accept: ACCEPTED,
        maxSize: MAX_SIZE,
    });

    const deleteMut = useMutation({
        mutationFn: (id: string) => cmsMediaApi.delete(id),
        onSuccess: () => {
            enqueueSnackbar('Asset deleted', { variant: 'success' });
            queryClient.invalidateQueries({ queryKey: ['cms-media'] });
        },
        onError: (err: { response?: { data?: { message?: string } } }) => {
            enqueueSnackbar(err.response?.data?.message ?? 'Delete failed', { variant: 'error' });
        },
    });

    const activeUploads = Object.values(progress).filter((p) => p.phase !== 'done' && p.phase !== 'error');

    return (
        <Box>
            <Typography variant="h5" fontWeight={700} gutterBottom>Media Library</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                Upload once, reuse in any playlist. Duplicates are detected via SHA-256.
            </Typography>

            <Card
                {...getRootProps()}
                sx={{
                    p: 4,
                    mb: 3,
                    textAlign: 'center',
                    border: '2px dashed',
                    borderColor: isDragActive ? 'primary.main' : 'divider',
                    bgcolor: isDragActive ? 'action.hover' : 'background.paper',
                    cursor: 'pointer',
                }}
            >
                <input {...getInputProps()} />
                <CloudUploadIcon sx={{ fontSize: 48, color: 'primary.main' }} />
                <Typography variant="h6">
                    {isDragActive ? 'Drop files here' : 'Drag & drop or click to upload'}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                    Images · Videos · HTML5 · Max 500 MB
                </Typography>
            </Card>

            {activeUploads.length > 0 && (
                <Card sx={{ mb: 3 }}>
                    <CardContent>
                        <Typography variant="subtitle2" gutterBottom>Uploads in progress</Typography>
                        <Stack spacing={2}>
                            {activeUploads.map((p) => (
                                <Box key={p.fileName}>
                                    <Stack direction="row" justifyContent="space-between">
                                        <Typography variant="body2" noWrap>{p.fileName}</Typography>
                                        <Typography variant="caption" color="text.secondary">
                                            {p.phase} · {p.pct}%
                                        </Typography>
                                    </Stack>
                                    <LinearProgress variant="determinate" value={p.pct} />
                                </Box>
                            ))}
                        </Stack>
                    </CardContent>
                </Card>
            )}

            {isLoading && (
                <Grid container spacing={2}>
                    {Array.from({ length: 12 }).map((_, i) => (
                        <Grid key={i} size={{ xs: 6, sm: 4, md: 3, lg: 2 }}>
                            <Card>
                                <Skeleton variant="rectangular" sx={{ aspectRatio: '16/9' }} />
                                <CardContent sx={{ p: 1, '&:last-child': { pb: 1 } }}>
                                    <Skeleton variant="text" />
                                    <Skeleton variant="text" width="50%" />
                                </CardContent>
                            </Card>
                        </Grid>
                    ))}
                </Grid>
            )}

            {data && data.items.length === 0 && (
                <EmptyState
                    title="No media yet"
                    message="Drop images, videos, or HTML bundles above to start building playlists."
                    icon={<PermMediaIcon sx={{ fontSize: 64, color: 'text.disabled' }} />}
                />
            )}

            {data && data.items.length > 0 && (
                <Grid container spacing={2}>
                    {data.items.map((m) => (
                        <Grid key={m.id} size={{ xs: 6, sm: 4, md: 3, lg: 2 }}>
                            <MediaTile asset={m} onDelete={() => deleteMut.mutate(m.id)} />
                        </Grid>
                    ))}
                </Grid>
            )}
        </Box>
    );
}

function MediaTile({ asset, onDelete }: { asset: MediaAssetDto; onDelete: () => void }) {
    const isImage = asset.mimeType.startsWith('image/');
    const isVideo = asset.mimeType.startsWith('video/');
    return (
        <Card sx={{ position: 'relative' }}>
            {isImage && <CardMedia component="img" src={asset.fileUrl} alt={asset.originalName} sx={{ aspectRatio: '16/9', objectFit: 'cover' }} />}
            {isVideo && (
                <Box sx={{ aspectRatio: '16/9', bgcolor: 'background.default', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <VideocamIcon sx={{ fontSize: 40, color: 'text.secondary' }} />
                </Box>
            )}
            {!isImage && !isVideo && (
                <Box sx={{ aspectRatio: '16/9', bgcolor: 'background.default', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {asset.mimeType === 'text/html' ? <HtmlIcon sx={{ fontSize: 40 }} /> : <ImageIcon sx={{ fontSize: 40 }} />}
                </Box>
            )}
            <CardContent sx={{ p: 1, '&:last-child': { pb: 1 } }}>
                <Typography variant="caption" noWrap display="block">{asset.originalName}</Typography>
                <Typography variant="caption" color="text.secondary">
                    {(asset.sizeBytes / (1024 * 1024)).toFixed(1)} MB
                </Typography>
            </CardContent>
            <Tooltip title="Delete">
                <IconButton
                    size="small"
                    onClick={onDelete}
                    sx={{ position: 'absolute', top: 4, right: 4, bgcolor: 'rgba(0,0,0,0.5)', color: 'white' }}
                >
                    <DeleteIcon fontSize="small" />
                </IconButton>
            </Tooltip>
        </Card>
    );
}

async function extractMediaMeta(file: File): Promise<{ width?: number; height?: number; durationSeconds?: number }> {
    return new Promise((resolve) => {
        if (file.type.startsWith('image/')) {
            const img = new Image();
            const url = URL.createObjectURL(file);
            img.onload = () => {
                resolve({ width: img.naturalWidth, height: img.naturalHeight });
                URL.revokeObjectURL(url);
            };
            img.onerror = () => { resolve({}); URL.revokeObjectURL(url); };
            img.src = url;
        } else if (file.type.startsWith('video/')) {
            const vid = document.createElement('video');
            const url = URL.createObjectURL(file);
            vid.onloadedmetadata = () => {
                resolve({
                    width: vid.videoWidth,
                    height: vid.videoHeight,
                    durationSeconds: vid.duration,
                });
                URL.revokeObjectURL(url);
            };
            vid.onerror = () => { resolve({}); URL.revokeObjectURL(url); };
            vid.src = url;
        } else {
            resolve({});
        }
    });
}
