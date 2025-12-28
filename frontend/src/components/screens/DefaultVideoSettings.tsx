import React, { useState } from 'react';
import {
    Card,
    CardContent,
    Typography,
    Button,
    Alert,
    Box,
    LinearProgress,
    IconButton,
    Tooltip,
} from '@mui/material';
import {
    CloudUpload,
    Delete,
    Info,
} from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../services/api';
import { useSnackbar } from 'notistack';

interface DefaultVideoSettingsProps {
    screenId: string;
}

interface DefaultVideoInfo {
    hasCustomVideo: boolean;
    videoUrl: string | null;
    uploadedAt: string | null;
    sizeBytes: number | null;
    isUsingUniversal: boolean;
}

export default function DefaultVideoSettings({ screenId }: DefaultVideoSettingsProps) {
    const { enqueueSnackbar } = useSnackbar();
    const queryClient = useQueryClient();
    const [uploading, setUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);

    // Fetch current default video info
    const { data: defaultVideo, isLoading } = useQuery<DefaultVideoInfo>({
        queryKey: ['defaultVideo', screenId],
        queryFn: async () => {
            const response = await api.get(`/screens/${screenId}/default-video`);
            return response.data.data;
        },
    });

    // Upload mutation
    const uploadMutation = useMutation({
        mutationFn: async (file: File) => {
            const formData = new FormData();
            formData.append('video', file);

            const response = await api.post(
                `/screens/${screenId}/default-video`,
                formData,
                {
                    headers: {
                        'Content-Type': 'multipart/form-data',
                    },
                    onUploadProgress: (progressEvent) => {
                        const progress = progressEvent.total
                            ? Math.round((progressEvent.loaded * 100) / progressEvent.total)
                            : 0;
                        setUploadProgress(progress);
                    },
                }
            );
            return response.data;
        },
        onSuccess: () => {
            enqueueSnackbar('Default video uploaded successfully', { variant: 'success' });
            queryClient.invalidateQueries({ queryKey: ['defaultVideo', screenId] });
            setUploading(false);
            setUploadProgress(0);
        },
        onError: (error: any) => {
            enqueueSnackbar(
                error.response?.data?.message || 'Failed to upload default video',
                { variant: 'error' }
            );
            setUploading(false);
            setUploadProgress(0);
        },
    });

    // Delete mutation
    const deleteMutation = useMutation({
        mutationFn: async () => {
            await api.delete(`/screens/${screenId}/default-video`);
        },
        onSuccess: () => {
            enqueueSnackbar('Default video deleted, using universal default', { variant: 'success' });
            queryClient.invalidateQueries({ queryKey: ['defaultVideo', screenId] });
        },
        onError: (error: any) => {
            enqueueSnackbar(
                error.response?.data?.message || 'Failed to delete default video',
                { variant: 'error' }
            );
        },
    });

    const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        // Validate file type
        if (!file.type.includes('video/mp4')) {
            enqueueSnackbar('Only MP4 files are supported', { variant: 'error' });
            return;
        }

        // Validate file size (50MB max)
        const maxSize = 50 * 1024 * 1024; // 50MB
        if (file.size > maxSize) {
            enqueueSnackbar('File too large. Maximum size is 50MB', { variant: 'error' });
            return;
        }

        setUploading(true);
        uploadMutation.mutate(file);
    };

    const handleDelete = () => {
        if (window.confirm('Are you sure you want to delete the custom default video? The screen will use the universal default video instead.')) {
            deleteMutation.mutate();
        }
    };

    const formatBytes = (bytes: number | null): string => {
        if (!bytes) return 'Unknown size';
        const mb = bytes / (1024 * 1024);
        return `${mb.toFixed(2)} MB`;
    };

    const formatDate = (dateString: string | null): string => {
        if (!dateString) return 'Unknown';
        return new Date(dateString).toLocaleString();
    };

    if (isLoading) {
        return (
            <Card>
                <CardContent>
                    <LinearProgress />
                </CardContent>
            </Card>
        );
    }

    return (
        <Card>
            <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                    <Typography variant="h6" sx={{ flexGrow: 1 }}>
                        Default Video for Empty Slots
                    </Typography>
                    <Tooltip title="This video plays when no ads are scheduled for a slot">
                        <IconButton size="small">
                            <Info />
                        </IconButton>
                    </Tooltip>
                </Box>

                <Alert severity="info" sx={{ mb: 3 }}>
                    The default video will play in empty ad slots when no campaigns are scheduled.
                    You can upload a custom video or use the universal default.
                </Alert>

                {defaultVideo?.hasCustomVideo ? (
                    <>
                        <Box sx={{ mb: 3 }}>
                            <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                                Current Default Video
                            </Typography>
                            <video
                                src={defaultVideo.videoUrl!}
                                controls
                                style={{ maxWidth: '100%', maxHeight: '400px', borderRadius: '8px' }}
                            />
                        </Box>

                        <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
                            <Box>
                                <Typography variant="caption" color="text.secondary">
                                    Uploaded
                                </Typography>
                                <Typography variant="body2">
                                    {formatDate(defaultVideo.uploadedAt)}
                                </Typography>
                            </Box>
                            <Box>
                                <Typography variant="caption" color="text.secondary">
                                    File Size
                                </Typography>
                                <Typography variant="body2">
                                    {formatBytes(defaultVideo.sizeBytes)}
                                </Typography>
                            </Box>
                        </Box>

                        <Box sx={{ display: 'flex', gap: 2 }}>
                            <Button
                                variant="outlined"
                                component="label"
                                startIcon={<CloudUpload />}
                                disabled={uploading}
                            >
                                Replace Video
                                <input
                                    type="file"
                                    accept="video/mp4"
                                    hidden
                                    onChange={handleFileSelect}
                                />
                            </Button>
                            <Button
                                variant="outlined"
                                color="error"
                                startIcon={<Delete />}
                                onClick={handleDelete}
                                disabled={deleteMutation.isPending}
                            >
                                Use Universal Default
                            </Button>
                        </Box>
                    </>
                ) : (
                    <>
                        <Alert severity="warning" sx={{ mb: 3 }}>
                            No custom default video. Using universal default video.
                        </Alert>

                        <Button
                            variant="contained"
                            component="label"
                            startIcon={<CloudUpload />}
                            disabled={uploading}
                            fullWidth
                        >
                            Upload Custom Default Video
                            <input
                                type="file"
                                accept="video/mp4"
                                hidden
                                onChange={handleFileSelect}
                            />
                        </Button>

                        <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                            Supported format: MP4 only. Maximum size: 50MB. Recommended duration: 30-60 seconds.
                        </Typography>
                    </>
                )}

                {uploading && (
                    <Box sx={{ mt: 3 }}>
                        <Typography variant="body2" gutterBottom>
                            Uploading... {uploadProgress}%
                        </Typography>
                        <LinearProgress variant="determinate" value={uploadProgress} />
                    </Box>
                )}
            </CardContent>
        </Card>
    );
}
