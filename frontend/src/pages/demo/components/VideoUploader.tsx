// VideoUploader Component (MUI Version)

import React, { useRef, useState } from 'react';
import { Box, Typography, Alert, Paper } from '@mui/material';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import { validateVideoLength } from '../utils/demoUtils';

interface VideoUploaderProps {
    onUpload: (file: File, duration: number) => void;
    currentVideo: { name: string; duration: number } | null;
}

export const VideoUploader: React.FC<VideoUploaderProps> = ({ onUpload, currentVideo }) => {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [isValidating, setIsValidating] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        setIsValidating(true);
        setError(null);

        try {
            const { valid, duration } = await validateVideoLength(file);

            if (!valid) {
                setError(`Video must be 10 seconds or less (current: ${duration.toFixed(1)}s)`);
                if (fileInputRef.current) fileInputRef.current.value = '';
                return;
            }

            onUpload(file, duration);
        } catch (err) {
            setError('Failed to validate video');
        } finally {
            setIsValidating(false);
        }
    };

    return (
        <Box className="upload-video-section">
            <Typography variant="subtitle1" fontWeight="medium" gutterBottom>
                Upload Creative Video
            </Typography>

            <Paper
                variant="outlined"
                sx={{
                    p: 3,
                    textAlign: 'center',
                    border: '2px dashed',
                    borderColor: 'divider',
                    cursor: 'pointer',
                    '&:hover': {
                        borderColor: 'primary.main',
                        bgcolor: 'action.hover',
                    },
                }}
                onClick={() => fileInputRef.current?.click()}
            >
                <input
                    ref={fileInputRef}
                    type="file"
                    accept="video/mp4,video/webm"
                    onChange={handleFileSelect}
                    style={{ display: 'none' }}
                />

                <CloudUploadIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 1 }} />

                <Typography variant="body2" color="text.secondary">
                    {isValidating ? 'Validating...' : 'Click to browse or drag and drop'}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                    MP4 or WebM (max 10 seconds)
                </Typography>
            </Paper>

            {error && (
                <Alert severity="error" sx={{ mt: 2 }}>
                    {error}
                </Alert>
            )}

            {currentVideo && !error && (
                <Alert
                    severity="success"
                    icon={<CheckCircleIcon />}
                    sx={{ mt: 2 }}
                >
                    <Typography variant="body2" fontWeight="medium">
                        {currentVideo.name}
                    </Typography>
                    <Typography variant="caption">
                        Duration: {currentVideo.duration.toFixed(1)}s
                    </Typography>
                </Alert>
            )}
        </Box>
    );
};
