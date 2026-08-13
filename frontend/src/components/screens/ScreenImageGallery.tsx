import { useState } from 'react';
import {
    Box,
    Typography,
    Paper,
    Tabs,
    Tab,
    ImageList,
    ImageListItem,
    Dialog,
    DialogContent,
    IconButton,
    useMediaQuery,
    useTheme,
    Chip,
    Stack,
} from '@mui/material';
import {
    Close as CloseIcon,
    NavigateBefore as PrevIcon,
    NavigateNext as NextIcon,
    PhotoCamera as ScreenPhotoIcon,
    Landscape as SurroundingIcon,
    Star as StarIcon,
    ZoomIn as ZoomIcon,
} from '@mui/icons-material';
import type { ScreenImage } from '../../types/screen';

interface ScreenImageGalleryProps {
    images: ScreenImage[];
    screenName: string;
    showTabs?: boolean;
}

export default function ScreenImageGallery({ images, screenName, showTabs = true }: ScreenImageGalleryProps) {
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
    const isTablet = useMediaQuery(theme.breakpoints.down('md'));
    
    const [activeTab, setActiveTab] = useState<'all' | 'Screen' | 'Surrounding'>('all');
    const [lightboxOpen, setLightboxOpen] = useState(false);
    const [lightboxIndex, setLightboxIndex] = useState(0);

    // Filter images by type
    const screenImages = images.filter(img => img.imageType === 'Screen');
    const surroundingImages = images.filter(img => img.imageType === 'Surrounding');
    
    const getFilteredImages = () => {
        switch (activeTab) {
            case 'Screen':
                return screenImages;
            case 'Surrounding':
                return surroundingImages;
            default:
                return images;
        }
    };
    
    const filteredImages = getFilteredImages();
    
    const handleImageClick = (index: number) => {
        setLightboxIndex(index);
        setLightboxOpen(true);
    };
    
    const handlePrev = () => {
        setLightboxIndex((prev) => (prev > 0 ? prev - 1 : filteredImages.length - 1));
    };
    
    const handleNext = () => {
        setLightboxIndex((prev) => (prev < filteredImages.length - 1 ? prev + 1 : 0));
    };
    
    const handleKeyDown = (event: React.KeyboardEvent) => {
        if (event.key === 'ArrowLeft') handlePrev();
        if (event.key === 'ArrowRight') handleNext();
        if (event.key === 'Escape') setLightboxOpen(false);
    };

    if (images.length === 0) {
        return (
            <Paper sx={{ p: 4, textAlign: 'center' }}>
                <ScreenPhotoIcon sx={{ fontSize: 64, color: 'text.disabled', mb: 2 }} />
                <Typography variant="h6" color="text.secondary">
                    No photos available
                </Typography>
                <Typography variant="body2" color="text.secondary">
                    The screen owner hasn't uploaded any photos yet.
                </Typography>
            </Paper>
        );
    }

    const getCols = () => {
        if (isMobile) return 2;
        if (isTablet) return 3;
        return 4;
    };

    return (
        <Box>
            {/* Tabs for filtering */}
            {showTabs && (screenImages.length > 0 || surroundingImages.length > 0) && (
                <Tabs
                    value={activeTab}
                    onChange={(_, newValue) => setActiveTab(newValue)}
                    sx={{ mb: 2 }}
                >
                    <Tab
                        label={
                            <Stack direction="row" alignItems="center" spacing={1}>
                                <span>All Photos</span>
                                <Chip label={images.length} size="small" />
                            </Stack>
                        }
                        value="all"
                    />
                    {screenImages.length > 0 && (
                        <Tab
                            icon={<ScreenPhotoIcon fontSize="small" />}
                            iconPosition="start"
                            label={
                                <Stack direction="row" alignItems="center" spacing={1}>
                                    <span>Screen</span>
                                    <Chip label={screenImages.length} size="small" color="primary" />
                                </Stack>
                            }
                            value="Screen"
                        />
                    )}
                    {surroundingImages.length > 0 && (
                        <Tab
                            icon={<SurroundingIcon fontSize="small" />}
                            iconPosition="start"
                            label={
                                <Stack direction="row" alignItems="center" spacing={1}>
                                    <span>Surroundings</span>
                                    <Chip label={surroundingImages.length} size="small" color="secondary" />
                                </Stack>
                            }
                            value="Surrounding"
                        />
                    )}
                </Tabs>
            )}

            {/* Image Grid */}
            <ImageList cols={getCols()} gap={12}>
                {filteredImages.map((image, index) => (
                    <ImageListItem
                        key={image.id}
                        sx={{
                            cursor: 'pointer',
                            borderRadius: 1,
                            overflow: 'hidden',
                            position: 'relative',
                            '&:hover': {
                                '& .overlay': {
                                    opacity: 1,
                                },
                            },
                        }}
                        onClick={() => handleImageClick(index)}
                    >
                        <img
                            src={image.imageUrl}
                            alt={`${screenName} - ${image.imageType} photo ${index + 1}`}
                            loading="lazy"
                            style={{
                                height: 200,
                                width: '100%',
                                objectFit: 'cover',
                            }}
                        />
                        {/* Hover overlay */}
                        <Box
                            className="overlay"
                            sx={{
                                position: 'absolute',
                                top: 0,
                                left: 0,
                                right: 0,
                                bottom: 0,
                                bgcolor: 'rgba(0,0,0,0.4)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                opacity: 0,
                                transition: 'opacity 0.2s',
                            }}
                        >
                            <ZoomIcon sx={{ color: 'white', fontSize: 32 }} />
                        </Box>
                        {/* Primary badge */}
                        {image.isPrimary && (
                            <Chip
                                icon={<StarIcon sx={{ fontSize: 14 }} />}
                                label="Primary"
                                size="small"
                                color="warning"
                                sx={{
                                    position: 'absolute',
                                    top: 8,
                                    left: 8,
                                }}
                            />
                        )}
                        {/* Type badge (only show in "all" view) */}
                        {activeTab === 'all' && (
                            <Chip
                                label={image.imageType}
                                size="small"
                                sx={{
                                    position: 'absolute',
                                    bottom: 8,
                                    right: 8,
                                    bgcolor: image.imageType === 'Screen' ? 'primary.main' : 'secondary.main',
                                    color: 'white',
                                    fontSize: '0.7rem',
                                }}
                            />
                        )}
                    </ImageListItem>
                ))}
            </ImageList>

            {/* Lightbox Dialog */}
            <Dialog
                open={lightboxOpen}
                onClose={() => setLightboxOpen(false)}
                maxWidth="xl"
                fullWidth
                onKeyDown={handleKeyDown}
                PaperProps={{
                    sx: {
                        bgcolor: 'black',
                        backgroundImage: 'none',
                    },
                }}
            >
                <DialogContent
                    sx={{
                        p: 0,
                        position: 'relative',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        minHeight: '80vh',
                        bgcolor: 'black',
                    }}
                >
                    {/* Close button */}
                    <IconButton
                        onClick={() => setLightboxOpen(false)}
                        sx={{
                            position: 'absolute',
                            top: 16,
                            right: 16,
                            color: 'white',
                            bgcolor: 'rgba(0,0,0,0.5)',
                            '&:hover': { bgcolor: 'rgba(0,0,0,0.7)' },
                            zIndex: 10,
                        }}
                    >
                        <CloseIcon />
                    </IconButton>

                    {/* Navigation buttons */}
                    {filteredImages.length > 1 && (
                        <>
                            <IconButton
                                onClick={handlePrev}
                                sx={{
                                    position: 'absolute',
                                    left: 16,
                                    color: 'white',
                                    bgcolor: 'rgba(0,0,0,0.5)',
                                    '&:hover': { bgcolor: 'rgba(0,0,0,0.7)' },
                                }}
                            >
                                <PrevIcon />
                            </IconButton>
                            <IconButton
                                onClick={handleNext}
                                sx={{
                                    position: 'absolute',
                                    right: 16,
                                    color: 'white',
                                    bgcolor: 'rgba(0,0,0,0.5)',
                                    '&:hover': { bgcolor: 'rgba(0,0,0,0.7)' },
                                }}
                            >
                                <NextIcon />
                            </IconButton>
                        </>
                    )}

                    {/* Current image */}
                    {filteredImages[lightboxIndex] && (
                        <Box
                            sx={{
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                maxWidth: '100%',
                                maxHeight: '100%',
                            }}
                        >
                            <img
                                src={filteredImages[lightboxIndex].imageUrl}
                                alt={`${screenName} - Photo ${lightboxIndex + 1}`}
                                style={{
                                    maxWidth: '100%',
                                    maxHeight: '75vh',
                                    objectFit: 'contain',
                                }}
                            />
                            <Box
                                sx={{
                                    mt: 2,
                                    color: 'white',
                                    textAlign: 'center',
                                }}
                            >
                                <Typography variant="body2">
                                    {lightboxIndex + 1} / {filteredImages.length}
                                </Typography>
                                <Stack direction="row" spacing={1} justifyContent="center" mt={1}>
                                    <Chip
                                        label={filteredImages[lightboxIndex].imageType}
                                        size="small"
                                        color={filteredImages[lightboxIndex].imageType === 'Screen' ? 'primary' : 'secondary'}
                                    />
                                    {filteredImages[lightboxIndex].isPrimary && (
                                        <Chip
                                            icon={<StarIcon sx={{ fontSize: 14 }} />}
                                            label="Primary"
                                            size="small"
                                            color="warning"
                                        />
                                    )}
                                </Stack>
                            </Box>
                        </Box>
                    )}
                </DialogContent>
            </Dialog>
        </Box>
    );
}
