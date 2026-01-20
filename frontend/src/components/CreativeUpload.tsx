import { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import {
    Box,
    Typography,
    Paper,
    LinearProgress,
    IconButton,
    Card,
    CardMedia,
    CardContent,
    Button,
    Grid,
    Chip,
} from '@mui/material';
import {
    CloudUpload as UploadIcon,
    Delete as DeleteIcon,
    PlayArrow as PlayIcon,
} from '@mui/icons-material';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useSnackbar } from 'notistack';
import { api } from '../../services/api';

interface CreativeUploadProps {
    campaignId: string;
    onUploadComplete?: () => void;
}

interface UploadedFile {
    file: File;
    preview: string;
    progress: number;
    id?: string;
}

export default function CreativeUpload({ campaignId, onUploadComplete }: CreativeUploadProps) {
    const queryClient = useQueryClient();
    const { enqueueSnackbar } = useSnackbar();
    const [files, setFiles] = useState<UploadedFile[]>([]);

    const uploadMutation = useMutation({
        mutationFn: async (file: File) => {
            const formData = new FormData();
            formData.append('file', file);
            formData.append('name', file.name);
            formData.append('campaignId', campaignId);

            const response = await api.post(`/campaigns/${campaignId}/creatives`, formData, {
                headers: {
                    'Content-Type': 'multipart/form-data',
                },
                onUploadProgress: (progressEvent) => {
                    const progress = progressEvent.total
                        ? Math.round((progressEvent.loaded * 100) / progressEvent.total)
                        : 0;

                    setFiles((prev) =>
                        prev.map((f) =>
                            f.file === file ? { ...f, progress } : f
                        )
                    );
                },
            });

            return response.data;
        },
        onSuccess: (data, file) => {
            setFiles((prev) =>
                prev.map((f) =>
                    f.file === file ? { ...f, id: data.id, progress: 100 } : f
                )
            );
            queryClient.invalidateQueries({ queryKey: ['campaigns', campaignId, 'creatives'] });
            enqueueSnackbar('Creative uploaded successfully', { variant: 'success' });
            onUploadComplete?.();
        },
        onError: (error: any, file) => {
            enqueueSnackbar(
                error.response?.data?.message || 'Failed to upload creative',
                { variant: 'error' }
            );
            setFiles((prev) => prev.filter((f) => f.file !== file));
        },
    });

    const onDrop = useCallback((acceptedFiles: File[]) => {
        const newFiles = acceptedFiles.map((file) => ({
            file,
            preview: URL.createObjectURL(file),
            progress: 0,
        }));

        setFiles((prev) => [...prev, ...newFiles]);

        // Upload each file
        acceptedFiles.forEach((file) => {
            uploadMutation.mutate(file);
        });
    }, [uploadMutation]);

    const { getRootProps, getInputProps, isDragActive } = useDropzone({
        onDrop,
        accept: {
            'video/*': ['.mp4', '.mov', '.avi', '.mkv'],
            'image/*': ['.png', '.jpg', '.jpeg', '.gif'],
        },
        maxSize: 100 * 1024 * 1024, // 100MB
    });

    const removeFile = (fileToRemove: UploadedFile) => {
        URL.revokeObjectURL(fileToRemove.preview);
        setFiles((prev) => prev.filter((f) => f !== fileToRemove));
    };

    const formatFileSize = (bytes: number) => {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
    };

    const isVideo = (file: File) => file.type.startsWith('video/');

    return (
        <Box>
            {/* Upload Area */}
            <Paper
                {...getRootProps()}
                sx={{
                    p: 4,
                    textAlign: 'center',
                    cursor: 'pointer',
                    border: '2px dashed',
                    borderColor: isDragActive ? 'primary.main' : 'grey.300',
                    bgcolor: isDragActive ? 'action.hover' : 'background.paper',
                    transition: 'all 0.2s',
                    '&:hover': {
                        borderColor: 'primary.main',
                        bgcolor: 'action.hover',
                    },
                }}
            >
                <input {...getInputProps()} />
                <UploadIcon sx={{ fontSize: 60, color: 'primary.main', mb: 2 }} />
                <Typography variant="h6" gutterBottom>
                    {isDragActive ? 'Drop files here' : 'Drag & drop files here'}
                </Typography>
                <Typography variant="body2" color="textSecondary" paragraph>
                    or click to select files
                </Typography>
                <Typography variant="caption" color="textSecondary">
                    Supported formats: MP4, MOV, AVI, MKV, PNG, JPG, JPEG, GIF (Max 100MB)
                </Typography>
            </Paper>
            {/* Uploaded Files */}
            {files.length > 0 && (
                <Box mt={3}>
                    <Typography variant="h6" gutterBottom>
                        Uploaded Files ({files.length})
                    </Typography>
                    <Grid container spacing={2}>
                        {files.map((uploadedFile, index) => (
                            <Grid
                                key={index}
                                size={{
                                    xs: 12,
                                    sm: 6,
                                    md: 4
                                }}>
                                <Card>
                                    <Box sx={{ position: 'relative' }}>
                                        {isVideo(uploadedFile.file) ? (
                                            <CardMedia
                                                component="video"
                                                height="200"
                                                src={uploadedFile.preview}
                                                controls
                                            />
                                        ) : (
                                            <CardMedia
                                                component="img"
                                                height="200"
                                                image={uploadedFile.preview}
                                                alt={uploadedFile.file.name}
                                            />
                                        )}
                                        {uploadedFile.progress < 100 && (
                                            <Box
                                                sx={{
                                                    position: 'absolute',
                                                    top: 0,
                                                    left: 0,
                                                    right: 0,
                                                    bottom: 0,
                                                    bgcolor: 'rgba(0,0,0,0.5)',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                }}
                                            >
                                                <Box sx={{ width: '80%' }}>
                                                    <LinearProgress
                                                        variant="determinate"
                                                        value={uploadedFile.progress}
                                                    />
                                                    <Typography
                                                        variant="caption"
                                                        color="white"
                                                        sx={{ mt: 1, display: 'block', textAlign: 'center' }}
                                                    >
                                                        {uploadedFile.progress}%
                                                    </Typography>
                                                </Box>
                                            </Box>
                                        )}
                                    </Box>
                                    <CardContent>
                                        <Typography variant="subtitle2" noWrap>
                                            {uploadedFile.file.name}
                                        </Typography>
                                        <Box display="flex" justifyContent="space-between" alignItems="center" mt={1}>
                                            <Typography variant="caption" color="textSecondary">
                                                {formatFileSize(uploadedFile.file.size)}
                                            </Typography>
                                            <Chip
                                                label={uploadedFile.progress === 100 ? 'Uploaded' : 'Uploading...'}
                                                color={uploadedFile.progress === 100 ? 'success' : 'default'}
                                                size="small"
                                            />
                                        </Box>
                                        <Box display="flex" justifyContent="flex-end" mt={1}>
                                            <IconButton
                                                size="small"
                                                color="error"
                                                onClick={() => removeFile(uploadedFile)}
                                                disabled={uploadedFile.progress < 100}
                                            >
                                                <DeleteIcon fontSize="small" />
                                            </IconButton>
                                        </Box>
                                    </CardContent>
                                </Card>
                            </Grid>
                        ))}
                    </Grid>
                </Box>
            )}
        </Box>
    );
}
