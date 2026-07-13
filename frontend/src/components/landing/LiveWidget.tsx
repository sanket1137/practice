import { useState, useEffect } from 'react';
import { Box, Typography, Container, Grid, Stack, Button } from '@mui/material';
import OfflineBolt from '@mui/icons-material/OfflineBolt';

import { COLORS, FONTS } from './landingData';

interface SectionProps {
  themeMode: 'light' | 'dark';
}

export default function LiveWidget({ themeMode }: SectionProps) {
  const c = COLORS[themeMode];
  const [layoutMode, setLayoutMode] = useState<'full' | 'split'>('full');
  const [earnings, setEarnings] = useState<number>(4520);
  const [isPlaying, setIsPlaying] = useState<boolean>(true);

  useEffect(() => {
    if (!isPlaying) return;
    const interval = setInterval(() => {
      setEarnings(prev => prev + Math.floor(Math.random() * 3) + 1);
    }, 2000);
    return () => clearInterval(interval);
  }, [isPlaying]);

  return (
    <Box className="reveal-section" sx={{ py: { xs: 10, md: 16 }, bgcolor: c.bg, position: 'relative', overflow: 'hidden' }}>
      <Container maxWidth="lg">
        {/* Section Header */}
        <Box sx={{ textAlign: 'center', mb: { xs: 8, md: 12 } }}>
          <Typography
            sx={{
              fontFamily: FONTS.mono,
              color: COLORS.primaryPurple,
              fontSize: '12px',
              fontWeight: 700,
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              mb: 2,
            }}
          >
            Screen Owner Sandbox
          </Typography>
          <Typography
            variant="h2"
            sx={{
              fontFamily: FONTS.display,
              fontWeight: 800,
              fontSize: { xs: '30px', md: '42px' },
              color: c.text1,
              mb: 2,
            }}
          >
            Live Player Simulator
          </Typography>
          <Typography
            sx={{
              fontFamily: FONTS.body,
              color: c.text2,
              fontSize: { xs: '15px', md: '17px' },
              maxWidth: 600,
              mx: 'auto',
            }}
          >
            Connect any television or LED panel, split screens into active layout zones, and watch your earnings stream increase.
          </Typography>
        </Box>

        {/* Sandbox Calculator Wrapper */}
        <Box
          className="glass-card"
          sx={{
            p: { xs: 3, md: 6 },
            borderRadius: '24px',
            border: `1px solid ${c.border}`,
            bgcolor: c.surfaceCard,
            boxShadow: themeMode === 'light' ? '0 15px 35px rgba(0,0,0,0.02)' : 'none',
          }}
        >
          <Grid container spacing={5} alignItems="center">
            {/* Control Panel Column */}
            <Grid size={{ xs: 12, lg: 5 }}>
              <Stack spacing={4}>
                <Box>
                  <Typography sx={{ fontFamily: FONTS.display, fontWeight: 800, fontSize: '20px', color: c.text1, mb: 1 }}>
                    Hardware Controller
                  </Typography>
                  <Typography sx={{ fontFamily: FONTS.body, color: c.text2, fontSize: '13.5px' }}>
                    Simulate how physical display players respond to remote CCMS configuration commands.
                  </Typography>
                </Box>

                {/* Switch between Online / Offline */}
                <Box>
                  <Typography sx={{ fontFamily: FONTS.mono, fontSize: '11px', color: c.text3, mb: 1.5, letterSpacing: '0.05em' }}>
                    PLAYER STATE
                  </Typography>
                  <Stack direction="row" gap={1.5}>
                    <Button
                      onClick={() => setIsPlaying(true)}
                      sx={{
                        fontFamily: FONTS.body,
                        textTransform: 'none',
                        fontSize: '12px',
                        fontWeight: 600,
                        color: isPlaying ? '#ffffff' : c.text2,
                        bgcolor: isPlaying ? COLORS.success : (themeMode === 'light' ? '#F1F5F9' : 'rgba(255,255,255,0.02)'),
                        border: `1px solid ${isPlaying ? 'transparent' : c.border}`,
                        borderRadius: '8px',
                        px: 3,
                        py: 1,
                        '&:hover': {
                          bgcolor: isPlaying ? '#16a34a' : 'rgba(255,255,255,0.05)',
                        },
                      }}
                    >
                      Wake Player (Online)
                    </Button>
                    <Button
                      onClick={() => setIsPlaying(false)}
                      sx={{
                        fontFamily: FONTS.body,
                        textTransform: 'none',
                        fontSize: '12px',
                        fontWeight: 600,
                        color: !isPlaying ? '#ffffff' : c.text2,
                        bgcolor: !isPlaying ? '#ef4444' : (themeMode === 'light' ? '#F1F5F9' : 'rgba(255,255,255,0.02)'),
                        border: `1px solid ${!isPlaying ? 'transparent' : c.border}`,
                        borderRadius: '8px',
                        px: 3,
                        py: 1,
                        '&:hover': {
                          bgcolor: !isPlaying ? '#dc2626' : 'rgba(255,255,255,0.05)',
                        },
                      }}
                    >
                      Kill Player (Offline)
                    </Button>
                  </Stack>
                </Box>

                {/* Switch Layout Mode */}
                <Box>
                  <Typography sx={{ fontFamily: FONTS.mono, fontSize: '11px', color: c.text3, mb: 1.5, letterSpacing: '0.05em' }}>
                    LAYOUT CONFIGURATION
                  </Typography>
                  <Stack direction="row" gap={1.5}>
                    <Button
                      onClick={() => setLayoutMode('full')}
                      sx={{
                        fontFamily: FONTS.body,
                        textTransform: 'none',
                        fontSize: '12px',
                        fontWeight: 600,
                        color: layoutMode === 'full' ? '#ffffff' : c.text2,
                        bgcolor: layoutMode === 'full' ? COLORS.primaryPurple : (themeMode === 'light' ? '#F1F5F9' : 'rgba(255,255,255,0.02)'),
                        border: `1px solid ${layoutMode === 'full' ? 'transparent' : c.border}`,
                        borderRadius: '8px',
                        px: 3,
                        py: 1,
                        '&:hover': {
                          bgcolor: layoutMode === 'full' ? COLORS.primaryPurpleHover : 'rgba(255,255,255,0.05)',
                        },
                      }}
                    >
                      Full Zone
                    </Button>
                    <Button
                      onClick={() => setLayoutMode('split')}
                      sx={{
                        fontFamily: FONTS.body,
                        textTransform: 'none',
                        fontSize: '12px',
                        fontWeight: 600,
                        color: layoutMode === 'split' ? '#ffffff' : c.text2,
                        bgcolor: layoutMode === 'split' ? COLORS.primaryPurple : (themeMode === 'light' ? '#F1F5F9' : 'rgba(255,255,255,0.02)'),
                        border: `1px solid ${layoutMode === 'split' ? 'transparent' : c.border}`,
                        borderRadius: '8px',
                        px: 3,
                        py: 1,
                        '&:hover': {
                          bgcolor: layoutMode === 'split' ? COLORS.primaryPurpleHover : 'rgba(255, 255, 255, 0.05)',
                        },
                      }}
                    >
                      Split Zones (L + R)
                    </Button>
                  </Stack>
                </Box>
              </Stack>
            </Grid>

            {/* Television Simulator Column */}
            <Grid size={{ xs: 12, lg: 7 }}>
              <Box
                sx={{
                  bgcolor: '#080c15',
                  borderRadius: '16px',
                  border: '12px solid #1e293b',
                  boxShadow: '0 20px 50px rgba(0, 0, 0, 0.5)',
                  overflow: 'hidden',
                  aspectRatio: '16/9',
                  position: 'relative',
                  display: 'flex',
                  flexDirection: 'column',
                }}
              >
                {/* Active Indicator Header */}
                <Box
                  sx={{
                    position: 'absolute',
                    top: 12,
                    left: 12,
                    bgcolor: isPlaying ? 'rgba(34, 197, 94, 0.2)' : 'rgba(239, 68, 68, 0.2)',
                    border: `1px solid ${isPlaying ? COLORS.success : '#ef4444'}`,
                    borderRadius: '100px',
                    px: 1.5,
                    py: 0.5,
                    zIndex: 20,
                  }}
                >
                  <Typography sx={{ fontFamily: FONTS.mono, fontSize: '9px', fontWeight: 700, color: isPlaying ? COLORS.success : '#ef4444' }}>
                    {isPlaying ? '● DISPLAY LIVE' : '○ DISCONNECTED'}
                  </Typography>
                </Box>

                {/* Earnings Ticker Overlay */}
                <Box
                  sx={{
                    position: 'absolute',
                    top: 12,
                    right: 12,
                    bgcolor: 'rgba(0,0,0,0.85)',
                    border: '1px solid rgba(255,255,255,0.08)',
                    borderRadius: '8px',
                    px: 1.5,
                    py: 0.75,
                    zIndex: 20,
                  }}
                >
                  <Typography sx={{ fontFamily: FONTS.mono, fontSize: '8px', color: '#94a3b8' }}>MONETIZED REVENUE</Typography>
                  <Typography sx={{ fontFamily: FONTS.mono, fontSize: '13px', fontWeight: 800, color: COLORS.success, mt: 0.25 }}>
                    ₹{earnings.toLocaleString('en-IN')}
                  </Typography>
                </Box>

                {/* Simulated Content Screen Body */}
                <Box sx={{ flex: 1, position: 'relative', display: 'flex' }}>
                  {isPlaying ? (
                    layoutMode === 'full' ? (
                      <Box sx={{
                        flex: 1,
                        bgcolor: '#4f46e5',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        p: 3,
                        backgroundImage: 'radial-gradient(circle, #6366f1 20%, #4f46e5 100%)',
                      }}>
                        <Typography sx={{ fontFamily: FONTS.display, fontSize: '20px', fontWeight: 800, color: '#fff', textAlign: 'center' }}>
                          Primary Brand Campaign Zone
                        </Typography>
                      </Box>
                    ) : (
                      <>
                        {/* Left Zone */}
                        <Box sx={{
                          flex: 1.2,
                          bgcolor: '#4f46e5',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          p: 2,
                          backgroundImage: 'radial-gradient(circle, #6366f1 20%, #4f46e5 100%)',
                          borderRight: '2px solid #080c15',
                        }}>
                          <Typography sx={{ fontFamily: FONTS.display, fontSize: '15px', fontWeight: 800, color: '#fff', textAlign: 'center' }}>
                            Main Ad Zone (70%)
                          </Typography>
                        </Box>
                        {/* Right Zone */}
                        <Box sx={{
                          flex: 0.8,
                          bgcolor: '#0ea5e9',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          p: 2,
                          backgroundImage: 'radial-gradient(circle, #38bdf8 20%, #0ea5e9 100%)',
                        }}>
                          <Typography sx={{ fontFamily: FONTS.display, fontSize: '13px', fontWeight: 800, color: '#fff', textAlign: 'center' }}>
                            Promo Info Panel (30%)
                          </Typography>
                        </Box>
                      </>
                    )
                  ) : (
                    <Box sx={{
                      flex: 1,
                      bgcolor: '#0f172a',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexDirection: 'column',
                      gap: 2,
                    }}>
                      <OfflineBolt sx={{ color: '#ef4444', fontSize: 36 }} />
                      <Typography sx={{ fontFamily: FONTS.body, fontSize: '14px', color: '#94a3b8', fontWeight: 600 }}>
                        Player offline. Content suspended.
                      </Typography>
                    </Box>
                  )}
                </Box>
              </Box>
            </Grid>
          </Grid>
        </Box>
      </Container>
    </Box>
  );
}
