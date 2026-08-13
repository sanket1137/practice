// DemoPage - Main Interactive Demo Component (MUI Version - Simplified Layout)

import React, { useCallback, useState } from 'react';
import { Box, Container, Typography, Chip, Paper, IconButton, Tooltip } from '@mui/material';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import PlayCircleIcon from '@mui/icons-material/PlayCircle';
import { useDemoState } from './hooks/useDemoState';
import { AdvertiserPanel } from './components/AdvertiserPanel';
import { ScreenOwnerPanel } from './components/ScreenOwnerPanel';
import { HelpModal } from './components/HelpModal';
import { GuidedTour } from './components/GuidedTour';
import { WelcomeTourModal } from './components/WelcomeTourModal';
import { advertiserTourSteps, screenOwnerTourSteps } from './config/tourSteps';

export const DemoPage: React.FC = () => {
    const [helpOpen, setHelpOpen] = useState(false);
    const [showWelcome, setShowWelcome] = useState(() => {
        return !localStorage.getItem('demo-tour-completed');
    });
    const [tourType, setTourType] = useState<'advertiser' | 'screenOwner' | null>(null);
    const [runTour, setRunTour] = useState(false);

    const {
        state,
        uploadCreative,
        createBooking,
        approveBooking,
        rejectBooking,
        addPlayLog,
        incrementPlayCount,
    } = useDemoState();

    const handleAdStart = useCallback((screenId: string) => {
        addPlayLog(screenId, 'ad_start', 'Ad playback started');
    }, [addPlayLog]);

    // Tour handlers
    const handleStartAdvertiserTour = () => {
        console.log('🎬 Starting Advertiser Tour');
        setTourType('advertiser');
        setRunTour(true);
    };

    const handleStartScreenOwnerTour = () => {
        console.log('📺 Starting Screen Owner Tour');
        setTourType('screenOwner');
        setRunTour(true);
    };

    const handleTourFinish = () => {
        console.log('✅ Tour Finished');
        setRunTour(false);
        setTourType(null);
    };

    const handleWelcomeClose = () => {
        setShowWelcome(false);
        localStorage.setItem('demo-tour-completed', 'true');
    };

    const tourSteps = React.useMemo(() => {
        if (tourType === 'advertiser') {
            console.log('🎬 Using advertiser steps:', advertiserTourSteps.length);
            return advertiserTourSteps;
        } else if (tourType === 'screenOwner') {
            console.log('📺 Using screen owner steps:', screenOwnerTourSteps.length);
            return screenOwnerTourSteps;
        }
        return advertiserTourSteps; // fallback
    }, [tourType]);

    return (
        <Box sx={{ minHeight: '100vh', bgcolor: 'background.default' }}>
            {/* Header */}
            <Box
                sx={{
                    background: 'linear-gradient(135deg, #1976d2 0%, #9c27b0 100%)',
                    color: 'white',
                    py: 4,
                    boxShadow: 3,
                }}
            >
                <Container maxWidth="xl">
                    <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                        <Box sx={{ flex: 1 }}>
                            <Typography variant="h3" fontWeight="bold" gutterBottom>
                                🎬 Experience CCMS - Interactive Demo
                            </Typography>
                            <Typography variant="h6" sx={{ opacity: 0.9, mb: 2 }}>
                                See how advertisers and screen owners work together in real-time
                            </Typography>
                            <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                                <Chip
                                    label="⏱️ Bookings expire in 5 minutes"
                                    sx={{ bgcolor: 'rgba(255,255,255,0.2)', color: 'white' }}
                                />
                                <Chip
                                    label="📺 Stream preview lasts 1 minute"
                                    sx={{ bgcolor: 'rgba(255,255,255,0.2)', color: 'white' }}
                                />
                                <Chip
                                    label="💾 Demo Mode - No data saved"
                                    sx={{ bgcolor: '#ffd54f', color: 'text.primary' }}
                                />
                            </Box>
                        </Box>


                        {/* Tour Button */}
                        <Tooltip title="Start Interactive Tour">
                            <IconButton
                                onClick={handleStartAdvertiserTour}
                                sx={{
                                    bgcolor: 'rgba(255,255,255,0.2)',
                                    color: 'white',
                                    '&:hover': { bgcolor: 'rgba(255,255,255,0.3)' },
                                    mr: 1
                                }}
                                size="large"
                            >
                                <PlayCircleIcon fontSize="large" />
                            </IconButton>
                        </Tooltip>

                        {/* Help Button */}
                        <Tooltip title="View Demo Instructions">
                            <IconButton
                                onClick={() => setHelpOpen(true)}
                                sx={{
                                    bgcolor: 'rgba(255,255,255,0.2)',
                                    color: 'white',
                                    '&:hover': { bgcolor: 'rgba(255,255,255,0.3)' }
                                }}
                                size="large"
                            >
                                <HelpOutlineIcon fontSize="large" />
                            </IconButton>
                        </Tooltip>
                    </Box>
                </Container>
            </Box>

            {/* Split View */}
            <Container maxWidth="xl" sx={{ py: 4 }}>
                <Box sx={{ display: 'flex', gap: 3, minHeight: 'calc(100vh - 280px)' }}>
                    {/* Left Side - Advertiser */}
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Paper
                            elevation={3}
                            sx={{
                                height: '100%',
                                minHeight: 600,
                                maxHeight: 'calc(100vh - 300px)',
                                display: 'flex',
                                flexDirection: 'column',
                                overflow: 'hidden',
                            }}
                        >
                            <AdvertiserPanel
                                campaign={state.campaign}
                                screens={state.screens.map(s => ({
                                    id: s.id,
                                    name: s.name,
                                    location: s.location,
                                }))}
                                campaignLogs={state.campaignLogs}
                                pricePerSlot={state.pricingConfig.pricePerSlot}
                                advertiserStats={state.advertiserStats}
                                bookings={state.bookings}
                                fullScreens={state.screens}
                                slots={state.slots}
                                onUploadVideo={uploadCreative}
                                onCreateBooking={createBooking}
                            />
                        </Paper>
                    </Box>

                    {/* Right Side - Screen Owner */}
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Paper
                            elevation={3}
                            sx={{
                                height: '100%',
                                minHeight: 600,
                                maxHeight: 'calc(100vh - 300px)',
                                display: 'flex',
                                flexDirection: 'column',
                                overflow: 'hidden',
                            }}
                        >
                            <ScreenOwnerPanel
                                screens={state.screens}
                                bookings={state.bookings}
                                campaignName={state.campaign.name}
                                videoUrl={state.campaign.creative.videoUrl}
                                slots={state.slots}
                                pricePerSlot={state.pricingConfig.pricePerSlot}
                                screenOwnerStats={state.screenOwnerStats}
                                onApprove={approveBooking}
                                onReject={rejectBooking}
                                onAdStart={handleAdStart}
                                onIncrementPlayCount={incrementPlayCount}
                            />
                        </Paper>
                    </Box>
                </Box>
            </Container>

            {/* Footer Instructions */}
            <Container maxWidth="xl" sx={{ pb: 4 }}>
                <Paper
                    elevation={2}
                    sx={{
                        p: 3,
                        bgcolor: 'primary.lighter',
                        border: '2px solid',
                        borderColor: 'primary.light',
                    }}
                >
                    <Typography variant="h6" fontWeight="bold" color="primary.dark" gutterBottom>
                        📖 How to Use This Demo
                    </Typography>
                    <Box sx={{ display: 'flex', gap: 4 }}>
                        <Box sx={{ flex: 1 }}>
                            <Typography variant="subtitle1" fontWeight="bold" color="primary.dark" gutterBottom>
                                As Advertiser (Left):
                            </Typography>
                            <Box component="ol" sx={{ pl: 3 }}>
                                <li>Upload a video (max 10 seconds)</li>
                                <li>Select a screen from dropdown</li>
                                <li>Click "Book Now"</li>
                                <li>Watch the status in Campaign Logs</li>
                            </Box>
                        </Box>
                        <Box sx={{ flex: 1 }}>
                            <Typography variant="subtitle1" fontWeight="bold" color="primary.dark" gutterBottom>
                                As Screen Owner (Right):
                            </Typography>
                            <Box component="ol" sx={{ pl: 3 }}>
                                <li>See booking appear in queue</li>
                                <li>Click "Approve" to start stream</li>
                                <li>Watch video play (1 min preview)</li>
                                <li>Or click "Reject" to decline</li>
                            </Box>
                        </Box>
                    </Box>
                </Paper>
            </Container>

            {/* Welcome Tour Modal */}
            <WelcomeTourModal
                open={showWelcome}
                onClose={handleWelcomeClose}
                onStartAdvertiserTour={handleStartAdvertiserTour}
                onStartScreenOwnerTour={handleStartScreenOwnerTour}
            />

            {/* Guided Tour */}
            {runTour && tourType && (
                <GuidedTour
                    steps={tourSteps}
                    run={runTour}
                    onFinish={handleTourFinish}
                />
            )}

            {/* Help Modal */}
            <HelpModal open={helpOpen} onClose={() => setHelpOpen(false)} />
        </Box>
    );
};

export default DemoPage;
