import { useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
    Box,
    Container,
    Typography,
    Paper,
    TextField,
    Button,
    Grid,
    MenuItem,
    Card,
    CardContent,
} from '@mui/material';
import { CloudUpload as UploadIcon } from '@mui/icons-material';
import { useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useSnackbar } from 'notistack';
import { api } from '../../services/api';

const creativeSchema = z.object({
    name: z.string().min(3, 'Name must be at least 3 characters'),
    type: z.enum(['Image', 'Video']),
    file: z.instanceof(File).optional(),
});

type CreativeFormData = z.infer<typeof creativeSchema>;

export default function UploadCreativePage() {
    const { id } = useParams(); // Campaign ID
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const { enqueueSnackbar } = useSnackbar();
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [preview, setPreview] = useState<string | null>(null);

    const {
        control,
        handleSubmit,
        formState: { errors },
        watch,
    } = useForm<CreativeFormData>({
        resolver: zodResolver(creativeSchema),
        defaultValues: {
            name: '',
            type: 'Video',
        },
    });

    const selectedType = watch('type');

    const createMutation = useMutation({
        mutationFn: async (data: CreativeFormData) => {
            const formData = new FormData();
            formData.append('name', data.name);
            formData.append('campaignId', id!);
            // Duration, width, height are auto-extracted by backend from video file!
            if (selectedFile) {
                formData.append('file', selectedFile);
            }

            const response = await api.post(`/creatives/upload`, formData, {
                headers: {
                    'Content-Type': 'multipart/form-data',
                },
            });
            return response.data.data; // ApiResponse wrapper
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['creatives', id] });
            enqueueSnackbar('Creative uploaded successfully', { variant: 'success' });
            navigate(`/campaigns/${id}`);
        },
        onError: (error: any) => {
            enqueueSnackbar(
                error.response?.data?.message || 'Failed to upload creative',
                { variant: 'error' }
            );
        },
    });

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            setSelectedFile(file);

            // Create preview for images
            if (file.type.startsWith('image/')) {
                const reader = new FileReader();
                reader.onloadend = () => {
                    setPreview(reader.result as string);
                };
                reader.readAsDataURL(file);
            } else {
                setPreview(null);
            }
        }
    };

    const onSubmit = (data: CreativeFormData) => {
        if (!selectedFile) {
            enqueueSnackbar('Please select a file to upload', { variant: 'error' });
            return;
        }
        createMutation.mutate(data);
    };

    return (
        <Container maxWidth="md" sx={{ mt: 4, mb: 4 }}>
            <Box mb={3}>
                <Typography variant="h4" gutterBottom>
                    Upload Creative
                </Typography>
                <Typography variant="body1" color="textSecondary">
                    Upload a new creative for your campaign
                </Typography>
            </Box>
            <Grid container spacing={3}>
                {/* Form */}
                <Grid
                    size={{
                        xs: 12,
                        md: 8
                    }}>
                    <Paper sx={{ p: 4 }}>
                        <form onSubmit={handleSubmit(onSubmit)}>
                            <Grid container spacing={3}>
                                {/* Name */}
                                <Grid size={12}>
                                    <Controller
                                        name="name"
                                        control={control}
                                        render={({ field }) => (
                                            <TextField
                                                {...field}
                                                fullWidth
                                                label="Creative Name"
                                                error={!!errors.name}
                                                helperText={errors.name?.message}
                                                required
                                            />
                                        )}
                                    />
                                </Grid>

                                {/* Type */}
                                <Grid
                                    size={{
                                        xs: 12,
                                        sm: 6
                                    }}>
                                    <Controller
                                        name="type"
                                        control={control}
                                        render={({ field }) => (
                                            <TextField
                                                {...field}
                                                fullWidth
                                                select
                                                label="Type"
                                                error={!!errors.type}
                                                helperText={errors.type?.message}
                                                required
                                            >
                                                <MenuItem value="Image">Image</MenuItem>
                                                <MenuItem value="Video">Video</MenuItem>
                                            </TextField>
                                        )}
                                    />
                                </Grid>

                                {/* File Upload - Duration auto-detected! */}
                                <Grid size={12}>
                                    <Controller
                                        name="width"
                                        control={control}
                                        render={({ field: { onChange, value, ...field } }) => (
                                            <TextField
                                                {...field}
                                                fullWidth
                                                label="Width (pixels)"
                                                type="number"
                                                value={value}
                                                onChange={(e) => onChange(parseInt(e.target.value))}
                                                error={!!errors.width}
                                                helperText={errors.width?.message || 'e.g., 1920 for Full HD'}
                                                required
                                            />
                                        )}
                                    />
                                </Grid>

                                {/* Height */}
                                <Grid
                                    size={{
                                        xs: 12,
                                        sm: 6
                                    }}>
                                    <Controller
                                        name="height"
                                        control={control}
                                        render={({ field: { onChange, value, ...field } }) => (
                                            <TextField
                                                {...field}
                                                fullWidth
                                                label="Height (pixels)"
                                                type="number"
                                                value={value}
                                                onChange={(e) => onChange(parseInt(e.target.value))}
                                                error={!!errors.height}
                                                helperText={errors.height?.message || 'e.g., 1080 for Full HD'}
                                                required
                                            />
                                        )}
                                    />
                                </Grid>

                                {/* File Upload */}
                                <Grid size={12}>
                                    <Button
                                        variant="outlined"
                                        component="label"
                                        fullWidth
                                        startIcon={<UploadIcon />}
                                        sx={{ py: 2 }}
                                    >
                                        {selectedFile ? selectedFile.name : 'Choose File'}
                                        <input
                                            type="file"
                                            hidden
                                            accept={selectedType === 'Image' ? 'image/*' : 'video/*'}
                                            onChange={handleFileChange}
                                        />
                                    </Button>
                                    <Typography variant="caption" color="textSecondary" display="block" sx={{ mt: 1 }}>
                                        {selectedType === 'Image'
                                            ? 'Supported formats: JPG, PNG, GIF (Max 10MB)'
                                            : 'Supported formats: MP4, AVI, MOV (Max 50MB)'}
                                    </Typography>
                                </Grid>

                                {/* Actions */}
                                <Grid size={12}>
                                    <Box display="flex" gap={2} justifyContent="flex-end">
                                        <Button
                                            variant="outlined"
                                            onClick={() => navigate(`/campaigns/${id}`)}
                                            disabled={createMutation.isPending}
                                        >
                                            Cancel
                                        </Button>
                                        <Button
                                            type="submit"
                                            variant="contained"
                                            disabled={createMutation.isPending || !selectedFile}
                                        >
                                            {createMutation.isPending ? 'Uploading...' : 'Upload Creative'}
                                        </Button>
                                    </Box>
                                </Grid>
                            </Grid>
                        </form>
                    </Paper>
                </Grid>

                {/* Preview */}
                <Grid
                    size={{
                        xs: 12,
                        md: 4
                    }}>
                    <Card>
                        <CardContent>
                            <Typography variant="h6" gutterBottom>
                                Preview
                            </Typography>
                            {preview ? (
                                <Box
                                    component="img"
                                    src={preview}
                                    alt="Preview"
                                    sx={{
                                        width: '100%',
                                        height: 'auto',
                                        borderRadius: 1,
                                        mt: 2,
                                    }}
                                />
                            ) : (
                                <Box
                                    sx={{
                                        width: '100%',
                                        height: 200,
                                        bgcolor: 'grey.200',
                                        borderRadius: 1,
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        mt: 2,
                                    }}
                                >
                                    <Typography color="textSecondary">No file selected</Typography>
                                </Box>
                            )}
                        </CardContent>
                    </Card>
                </Grid>
            </Grid>
        </Container>
    );
}
