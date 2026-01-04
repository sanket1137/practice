// DemoPage - Main Interactive Demo Component (MUI Version - Simplified Layout)

import React, { useCallback } from 'react';
import { Box, Container, Typography, Chip, Paper } from '@mui/material';
import { useDemoState } from './hooks/useDemoState';
import { AdvertiserPanel } from './components/AdvertiserPanel';
import { ScreenOwnerPanel } from './components/ScreenOwnerPanel';

export const DemoPage: React.FC = () => {
    const {
        state,
        uploadCreative,
        createBooking,
        approveBooking,
        rejectBooking,
        stopStream,
        addPlayLog,
        incrementPlayCount,
    } = useDemoState();

    const handleAdStart = useCallback((screenId: string) => {
        addPlayLog(screenId, 'ad_start', 'Ad playback started');
    }, [addPlayLog]);

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
        </Box>
    );
};

export default DemoPage;
