// VideoPreview Component (MUI Version)

import React, { useRef, useEffect } from 'react';
import { Box, Chip } from '@mui/material';
import VideocamOffIcon from '@mui/icons-material/VideocamOff';

interface VideoPreviewProps {
    videoUrl: string | null;
    isPlaying: boolean;
    onEnded?: () => void;
}

export const VideoPreview: React.FC<VideoPreviewProps> = ({
    videoUrl,
    isPlaying,
    onEnded,
}) => {
    const videoRef = useRef<HTMLVideoElement>(null);

    useEffect(() => {
        if (videoRef.current) {
            if (isPlaying && videoUrl) {
                videoRef.current.play().catch(console.error);
            } else {
                videoRef.current.pause();
            }
        }
    }, [isPlaying, videoUrl]);

    if (!videoUrl) {
        return (
            <Box
                sx={{
                    aspectRatio: '16/9',
                    bgcolor: 'grey.900',
                    borderRadius: 1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'grey.500',
                }}
            >
                <Box sx={{ textAlign: 'center' }}>
                    <VideocamOffIcon sx={{ fontSize: 64, mb: 1 }} />
                    <Box sx={{ fontSize: 14 }}>No content</Box>
                </Box>
            </Box>
        );
    }

    return (
        <Box sx={{ position: 'relative', aspectRatio: '16/9', bgcolor: 'black', borderRadius: 1, overflow: 'hidden' }}>
            <video
                ref={videoRef}
                src={videoUrl}
                loop
                muted
                playsInline
                onEnded={onEnded}
                style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'contain',
                }}
            />

            {isPlaying && (
                <Chip
                    label="LIVE"
                    color="error"
                    size="small"
                    icon={
                        <Box
                            sx={{
                                width: 8,
                                height: 8,
                                borderRadius: '50%',
                                bgcolor: 'white',
                                animation: 'pulse 1.5s ease-in-out infinite',
                                '@keyframes pulse': {
                                    '0%, 100%': { opacity: 1 },
                                    '50%': { opacity: 0.5 },
                                },
                            }}
                        />
                    }
                    sx={{ position: 'absolute', top: 8, right: 8 }}
                />
            )}
        </Box>
    );
};
