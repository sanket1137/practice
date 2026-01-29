import { useState, useCallback, useEffect } from 'react';
import { useDropzone } from 'react-dropzone';
import {
    Box,
    Typography,
    Paper,
    LinearProgress,
    IconButton,
    Card,
    CardMedia,
    CardActions,
    Grid,
    Chip,
    Stack,
    Alert,
    Tabs,
    Tab,
    Tooltip,
} from '@mui/material';
import {
    CloudUpload as UploadIcon,
    Delete as DeleteIcon,
    Star as StarIcon,
    StarBorder as StarBorderIcon,
    PhotoCamera as ScreenPhotoIcon,
    Landscape as SurroundingIcon,
} from '@mui/icons-material';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSnackbar } from 'notistack';
import { api } from '../../services/api';
import type { ScreenImage, UploadScreenImagesResponse } from '../../types/screen';
import { SCREEN_IMAGE_VALIDATION } from '../../types/screen';

interface ScreenImageUploadProps {
    screenId: string;
    onImagesChanged?: () => void;
    disabled?: boolean;
}

interface PendingFile {
    file: File;
    preview: string;
    progress: number;
    error?: string;
}

type ImageType = 'Screen' | 'Surrounding';

export default function ScreenImageUpload({ screenId, onImagesChanged, disabled }: ScreenImageUploadProps) {
    const queryClient = useQueryClient();
    const { enqueueSnackbar } = useSnackbar();
    const [activeTab, setActiveTab] = useState<ImageType>('Screen');
    const [pendingFiles, setPendingFiles] = useState<PendingFile[]>([]);

    // Fetch existing images
    const { data: existingImages = [], isLoading } = useQuery<ScreenImage[]>({
        queryKey: ['screens', screenId, 'images'],
        queryFn: async () => {
            const response = await api.get(`/screens/${screenId}/images`);
            return response.data.data || [];
        },
        enabled: !!screenId,
    });

    // Get counts by type
    const screenPhotoCount = existingImages.filter(img => img.imageType === 'Screen').length;
    const surroundingPhotoCount = existingImages.filter(img => img.imageType === 'Surrounding').length;

    // Upload mutation
    const uploadMutation = useMutation({
        mutationFn: async ({ files, imageType }: { files: File[], imageType: ImageType }) => {
            const formData = new FormData();
            files.forEach(file => formData.append('files', file));

            const response = await api.post<{ data: UploadScreenImagesResponse }>(
                `/screens/${screenId}/images?imageType=${imageType}`,
                formData,
                {
                    headers: { 'Content-Type': 'multipart/form-data' },
                    onUploadProgress: (progressEvent) => {
                        const progress = progressEvent.total
                            ? Math.round((progressEvent.loaded * 100) / progressEvent.total)
                            : 0;
                        setPendingFiles(prev => prev.map(f => ({ ...f, progress })));
                    },
                }
            );
            return response.data.data;
        },
        onSuccess: (data) => {
            setPendingFiles([]);
            queryClient.invalidateQueries({ queryKey: ['screens', screenId, 'images'] });
            queryClient.invalidateQueries({ queryKey: ['screens', screenId] });
            
            if (data.uploadedImages.length > 0) {
                enqueueSnackbar(`${data.uploadedImages.length} image(s) uploaded successfully`, { variant: 'success' });
            }
            if (data.errors.length > 0) {
                data.errors.forEach(err => enqueueSnackbar(err, { variant: 'error' }));
            }
            onImagesChanged?.();
        },
        onError: (error: any) => {
            setPendingFiles([]);
            enqueueSnackbar(error.response?.data?.message || 'Failed to upload images', { variant: 'error' });
        },
    });

    // Delete mutation
    const deleteMutation = useMutation({
        mutationFn: async (imageId: string) => {
            await api.delete(`/screens/${screenId}/images/${imageId}`);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['screens', screenId, 'images'] });
            queryClient.invalidateQueries({ queryKey: ['screens', screenId] });
            enqueueSnackbar('Image deleted', { variant: 'success' });
            onImagesChanged?.();
        },
        onError: (error: any) => {
            enqueueSnackbar(error.response?.data?.message || 'Failed to delete image', { variant: 'error' });
        },
    });

    // Set primary mutation
    const setPrimaryMutation = useMutation({
        mutationFn: async (imageId: string) => {
            await api.post(`/screens/${screenId}/images/${imageId}/set-primary`);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['screens', screenId, 'images'] });
            queryClient.invalidateQueries({ queryKey: ['screens', screenId] });
            enqueueSnackbar('Primary image updated', { variant: 'success' });
            onImagesChanged?.();
        },
        onError: (error: any) => {
            enqueueSnackbar(error.response?.data?.message || 'Failed to set primary image', { variant: 'error' });
        },
    });

    // Calculate remaining slots
    const remainingScreenPhotos = SCREEN_IMAGE_VALIDATION.maxScreenPhotos - screenPhotoCount;
    const remainingSurroundingPhotos = SCREEN_IMAGE_VALIDATION.maxSurroundingPhotos - surroundingPhotoCount;
    const currentLimit = activeTab === 'Screen' ? remainingScreenPhotos : remainingSurroundingPhotos;

    const onDrop = useCallback((acceptedFiles: File[]) => {
        // Validate file count
        if (acceptedFiles.length > currentLimit) {
            enqueueSnackbar(
                `You can only upload ${currentLimit} more ${activeTab.toLowerCase()} photo(s)`,
                { variant: 'warning' }
            );
            acceptedFiles = acceptedFiles.slice(0, currentLimit);
        }

        if (acceptedFiles.length === 0) return;

        // Create previews and upload
        const newPending = acceptedFiles.map(file => ({
            file,
            preview: URL.createObjectURL(file),
            progress: 0,
        }));
        setPendingFiles(newPending);
        uploadMutation.mutate({ files: acceptedFiles, imageType: activeTab });
    }, [activeTab, currentLimit, uploadMutation, enqueueSnackbar]);

    const { getRootProps, getInputProps, isDragActive } = useDropzone({
        onDrop,
        accept: {
            'image/jpeg': ['.jpg', '.jpeg'],
            'image/png': ['.png'],
            'image/webp': ['.webp'],
        },
        maxSize: SCREEN_IMAGE_VALIDATION.maxFileSizeBytes,
        maxFiles: currentLimit,
        disabled: disabled || currentLimit <= 0,
    });

    // Cleanup previews on unmount
    useEffect(() => {
        return () => {
            pendingFiles.forEach(f => URL.revokeObjectURL(f.preview));
        };
    }, [pendingFiles]);

    const formatFileSize = (bytes: number) => {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
    };

    const filteredImages = existingImages.filter(img => img.imageType === activeTab);
    const totalImages = existingImages.length;

    return (
        <Box>
            {/* Image Counts Summary */}
            <Stack direction="row" spacing={2} mb={2}>
                <Chip
                    icon={<ScreenPhotoIcon />}
                    label={`Screen Photos: ${screenPhotoCount}/${SCREEN_IMAGE_VALIDATION.maxScreenPhotos}`}
                    color={screenPhotoCount > 0 ? 'primary' : 'default'}
                    variant={activeTab === 'Screen' ? 'filled' : 'outlined'}
                />
                <Chip
                    icon={<SurroundingIcon />}
                    label={`Surrounding Photos: ${surroundingPhotoCount}/${SCREEN_IMAGE_VALIDATION.maxSurroundingPhotos}`}
                    color={surroundingPhotoCount > 0 ? 'secondary' : 'default'}
                    variant={activeTab === 'Surrounding' ? 'filled' : 'outlined'}
                />
            </Stack>

            {/* Minimum Image Warning */}
            {totalImages < SCREEN_IMAGE_VALIDATION.minTotalImages && (
                <Alert severity="warning" sx={{ mb: 2 }}>
                    At least {SCREEN_IMAGE_VALIDATION.minTotalImages} image is required. 
                    Please upload screen or surrounding photos.
                </Alert>
            )}

            {/* Tabs for Image Type */}
            <Tabs
                value={activeTab}
                onChange={(_, newValue) => setActiveTab(newValue)}
                sx={{ mb: 2 }}
            >
                <Tab
                    value="Screen"
                    label={`Screen Photos (${screenPhotoCount})`}
                    icon={<ScreenPhotoIcon />}
                    iconPosition="start"
                />
                <Tab
                    value="Surrounding"
                    label={`Surrounding Photos (${surroundingPhotoCount})`}
                    icon={<SurroundingIcon />}
                    iconPosition="start"
                />
            </Tabs>

            {/* Upload Area */}
            <Paper
                {...getRootProps()}
                sx={{
                    p: 3,
                    textAlign: 'center',
                    cursor: currentLimit > 0 && !disabled ? 'pointer' : 'not-allowed',
                    border: '2px dashed',
                    borderColor: isDragActive ? 'primary.main' : currentLimit <= 0 ? 'grey.400' : 'grey.300',
                    bgcolor: isDragActive ? 'action.hover' : currentLimit <= 0 ? 'grey.100' : 'background.paper',
                    opacity: currentLimit <= 0 || disabled ? 0.6 : 1,
                    transition: 'all 0.2s',
                    '&:hover': currentLimit > 0 && !disabled ? {
                        borderColor: 'primary.main',
                        bgcolor: 'action.hover',
                    } : {},
                }}
            >
                <input {...getInputProps()} />
                <UploadIcon sx={{ fontSize: 48, color: 'primary.main', mb: 1 }} />
                <Typography variant="h6" gutterBottom>
                    {isDragActive
                        ? 'Drop images here'
                        : currentLimit <= 0
                            ? `Maximum ${activeTab.toLowerCase()} photos reached`
                            : `Drag & drop ${activeTab.toLowerCase()} photos here`}
                </Typography>
                <Typography variant="body2" color="textSecondary">
                    {currentLimit > 0
                        ? `or click to select (${currentLimit} remaining)`
                        : `${activeTab === 'Screen' ? SCREEN_IMAGE_VALIDATION.maxScreenPhotos : SCREEN_IMAGE_VALIDATION.maxSurroundingPhotos} max`}
                </Typography>
                <Typography variant="caption" color="textSecondary" display="block" mt={1}>
                    JPG, PNG, WebP • Max 10MB each
                </Typography>
            </Paper>

            {/* Pending Uploads */}
            {pendingFiles.length > 0 && (
                <Box mt={2}>
                    <Typography variant="subtitle2" gutterBottom>
                        Uploading...
                    </Typography>
                    <Grid container spacing={2}>
                        {pendingFiles.map((pf, index) => (
                            <Grid key={index} size={{ xs: 6, sm: 4, md: 3 }}>
                                <Card sx={{ position: 'relative' }}>
                                    <CardMedia
                                        component="img"
                                        height="120"
                                        image={pf.preview}
                                        alt="Uploading"
                                        sx={{ objectFit: 'cover' }}
                                    />
                                    <LinearProgress
                                        variant="determinate"
                                        value={pf.progress}
                                        sx={{ position: 'absolute', bottom: 0, left: 0, right: 0 }}
                                    />
                                </Card>
                            </Grid>
                        ))}
                    </Grid>
                </Box>
            )}

            {/* Existing Images */}
            {filteredImages.length > 0 && (
                <Box mt={3}>
                    <Typography variant="subtitle2" gutterBottom>
                        {activeTab} Photos ({filteredImages.length})
                    </Typography>
                    <Grid container spacing={2}>
                        {filteredImages
                            .sort((a, b) => a.displayOrder - b.displayOrder)
                            .map((image) => (
                                <Grid key={image.id} size={{ xs: 6, sm: 4, md: 3 }}>
                                    <Card sx={{ position: 'relative' }}>
                                        <CardMedia
                                            component="img"
                                            height="140"
                                            image={image.imageUrl}
                                            alt={image.originalFileName || 'Screen image'}
                                            sx={{ objectFit: 'cover' }}
                                        />
                                        {image.isPrimary && (
                                            <Chip
                                                label="Primary"
                                                size="small"
                                                color="primary"
                                                sx={{
                                                    position: 'absolute',
                                                    top: 8,
                                                    left: 8,
                                                }}
                                            />
                                        )}
                                        <CardActions sx={{ justifyContent: 'space-between', p: 1 }}>
                                            <Tooltip title={image.isPrimary ? 'Primary image' : 'Set as primary'}>
                                                <IconButton
                                                    size="small"
                                                    onClick={() => !image.isPrimary && setPrimaryMutation.mutate(image.id)}
                                                    disabled={image.isPrimary || setPrimaryMutation.isPending}
                                                    color={image.isPrimary ? 'primary' : 'default'}
                                                >
                                                    {image.isPrimary ? <StarIcon /> : <StarBorderIcon />}
                                                </IconButton>
                                            </Tooltip>
                                            <Tooltip title="Delete image">
                                                <IconButton
                                                    size="small"
                                                    onClick={() => deleteMutation.mutate(image.id)}
                                                    disabled={deleteMutation.isPending || totalImages <= SCREEN_IMAGE_VALIDATION.minTotalImages}
                                                    color="error"
                                                >
                                                    <DeleteIcon />
                                                </IconButton>
                                            </Tooltip>
                                        </CardActions>
                                        {image.sizeBytes && (
                                            <Typography
                                                variant="caption"
                                                color="textSecondary"
                                                sx={{ px: 1, pb: 1, display: 'block' }}
                                            >
                                                {formatFileSize(image.sizeBytes)}
                                            </Typography>
                                        )}
                                    </Card>
                                </Grid>
                            ))}
                    </Grid>
                </Box>
            )}

            {/* Empty State */}
            {!isLoading && filteredImages.length === 0 && pendingFiles.length === 0 && (
                <Box mt={3} textAlign="center" py={4}>
                    <Typography variant="body2" color="textSecondary">
                        No {activeTab.toLowerCase()} photos uploaded yet
                    </Typography>
                </Box>
            )}
        </Box>
    );
}
