import { Box, Typography, Container, Grid, Stack, Button } from '@mui/material';
import Monitor from '@mui/icons-material/Monitor';
import FolderOpen from '@mui/icons-material/FolderOpen';
import Campaign from '@mui/icons-material/Campaign';
import CalendarToday from '@mui/icons-material/CalendarToday';
import Assessment from '@mui/icons-material/Assessment';
import Payments from '@mui/icons-material/Payments';
import SettingsSuggest from '@mui/icons-material/SettingsSuggest';
import Router from '@mui/icons-material/Router';

import { COLORS, FONTS } from './landingData';

interface SectionProps {
  themeMode: 'light' | 'dark';
}

export default function FeaturesGrid({ themeMode }: SectionProps) {
  const c = COLORS[themeMode];

  return (
    <Box className="reveal-section" sx={{ py: { xs: 8, sm: 10, md: 16 }, bgcolor: c.bg, position: 'relative' }}>
      <Container maxWidth="lg">
        {/* Section Header */}
        <Box sx={{ textAlign: 'center', mb: { xs: 6, md: 10 } }}>
          <Typography
            sx={{
              fontFamily: FONTS.mono,
              color: COLORS.primaryPurple,
              fontSize: '12px',
              fontWeight: 700,
              letterSpacing: '0.15em',
              textTransform: 'uppercase',
              mb: 2,
            }}
          >
            Capabilities
          </Typography>
          <Typography
            variant="h2"
            sx={{
              fontFamily: FONTS.display,
              fontWeight: 900,
              fontSize: { xs: '26px', sm: '34px', md: '48px' },
              color: c.text1,
              mb: 2.5,
              letterSpacing: '-0.02em',
            }}
          >
            Everything you need in one platform
          </Typography>
          <Typography
            sx={{
              fontFamily: FONTS.body,
              color: c.text2,
              fontSize: { xs: '14px', sm: '15px', md: '18px' },
              maxWidth: 600,
              mx: 'auto',
            }}
          >
            Designed to simplify physical operations and maximize digital signage impact.
          </Typography>
        </Box>

        {/* Bento Grid Layout */}
        <Grid container spacing={{ xs: 2, md: 3 }} sx={{ mb: 6 }}>
          {/* Card 1: Screen Management (xs=12, md=8) */}
          <Grid size={{ xs: 12, md: 8 }}>
            <Box
              className="glass-card"
              sx={{
                p: { xs: 3, md: 4 },
                height: '100%',
                borderRadius: '20px',
                border: `1px solid ${c.border}`,
                bgcolor: c.surfaceCard,
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
              }}
            >
              <Box>
                <Stack direction="row" alignItems="center" gap={1.5} mb={2.5}>
                  <Box sx={{ width: 34, height: 34, borderRadius: '8px', bgcolor: 'rgba(99, 102, 241, 0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: COLORS.primaryPurple }}>
                    <Monitor sx={{ fontSize: 18 }} />
                  </Box>
                  <Typography sx={{ fontFamily: FONTS.display, fontWeight: 800, fontSize: { xs: '16px', md: '18px' }, color: c.text1 }}>
                    Screen Management
                  </Typography>
                </Stack>
                <Typography sx={{ fontFamily: FONTS.body, color: c.text2, fontSize: { xs: '13px', md: '14.5px' }, maxWidth: 440, mb: 4 }}>
                  Add, group, and command display screen layouts remotely. Keep screen networks online and running with live status logs.
                </Typography>
              </Box>
              {/* Visual preview */}
              <Box sx={{
                bgcolor: themeMode === 'light' ? '#FAFAFA' : 'rgba(0,0,0,0.15)',
                border: `1px solid ${c.border}`,
                borderRadius: '8px',
                p: 2,
                display: 'flex',
                gap: 1.5,
                flexDirection: { xs: 'column', sm: 'row' },
              }}>
                {[
                  { name: 'Delhi Screen 1', state: 'Online' },
                  { name: 'Mumbai Lobby 2', state: 'Online' },
                  { name: 'Bangalore Stand B', state: 'Offline' },
                ].map((scr, idx) => (
                  <Box key={idx} sx={{ flex: 1, p: 1.2, bgcolor: c.surfaceCard, border: `1px solid ${c.border}`, borderRadius: '6px', textAlign: 'center' }}>
                    <Typography sx={{ fontFamily: FONTS.body, fontSize: '10px', fontWeight: 700, color: c.text1 }}>{scr.name}</Typography>
                    <Typography sx={{ fontFamily: FONTS.mono, fontSize: '8px', color: scr.state === 'Online' ? COLORS.success : '#ef4444', fontWeight: 800, mt: 0.5 }}>{scr.state}</Typography>
                  </Box>
                ))}
              </Box>
            </Box>
          </Grid>

          {/* Card 2: Content Management (xs=12, md=4) */}
          <Grid size={{ xs: 12, md: 4 }}>
            <Box
              className="glass-card"
              sx={{
                p: { xs: 3, md: 4 },
                height: '100%',
                borderRadius: '20px',
                border: `1px solid ${c.border}`,
                bgcolor: c.surfaceCard,
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
              }}
            >
              <Box sx={{ mb: 4 }}>
                <Stack direction="row" alignItems="center" gap={1.5} mb={2.5}>
                  <Box sx={{ width: 34, height: 34, borderRadius: '8px', bgcolor: 'rgba(99, 102, 241, 0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: COLORS.primaryPurple }}>
                    <FolderOpen sx={{ fontSize: 18 }} />
                  </Box>
                  <Typography sx={{ fontFamily: FONTS.display, fontWeight: 800, fontSize: { xs: '16px', md: '18px' }, color: c.text1 }}>
                    Content System
                  </Typography>
                </Stack>
                <Typography sx={{ fontFamily: FONTS.body, color: c.text2, fontSize: { xs: '13px', md: '14px' }, lineHeight: 1.5 }}>
                  Upload media creatives, categorize playlists, and transcode content assets automatically to fit target screen dimensions.
                </Typography>
              </Box>
              <Typography sx={{ fontFamily: FONTS.mono, fontSize: '11px', color: COLORS.primaryPurple, fontWeight: 700 }}>
                Supports MP4, JPG, HTML5 →
              </Typography>
            </Box>
          </Grid>

          {/* Card 3: Campaign Management (xs=12, md=4) */}
          <Grid size={{ xs: 12, md: 4 }}>
            <Box
              className="glass-card"
              sx={{
                p: { xs: 3, md: 4 },
                height: '100%',
                borderRadius: '20px',
                border: `1px solid ${c.border}`,
                bgcolor: c.surfaceCard,
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
              }}
            >
              <Box sx={{ mb: 4 }}>
                <Stack direction="row" alignItems="center" gap={1.5} mb={2.5}>
                  <Box sx={{ width: 34, height: 34, borderRadius: '8px', bgcolor: 'rgba(99, 102, 241, 0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: COLORS.primaryPurple }}>
                    <Campaign sx={{ fontSize: 18 }} />
                  </Box>
                  <Typography sx={{ fontFamily: FONTS.display, fontWeight: 800, fontSize: { xs: '16px', md: '18px' }, color: c.text1 }}>
                    Ad Campaigns
                  </Typography>
                </Stack>
                <Typography sx={{ fontFamily: FONTS.body, color: c.text2, fontSize: { xs: '13px', md: '14px' }, lineHeight: 1.5 }}>
                  Define reach metrics, set slot-based scheduling budgets, and assign advertising creatives to screen zones with ease.
                </Typography>
              </Box>
              <Typography sx={{ fontFamily: FONTS.mono, fontSize: '11px', color: COLORS.primaryPurple, fontWeight: 700 }}>
                100% automated payouts →
              </Typography>
            </Box>
          </Grid>

          {/* Card 4: Smart Scheduling (xs=12, md=8) */}
          <Grid size={{ xs: 12, md: 8 }}>
            <Box
              className="glass-card"
              sx={{
                p: { xs: 3, md: 4 },
                height: '100%',
                borderRadius: '20px',
                border: `1px solid ${c.border}`,
                bgcolor: c.surfaceCard,
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
              }}
            >
              <Box>
                <Stack direction="row" alignItems="center" gap={1.5} mb={2.5}>
                  <Box sx={{ width: 34, height: 34, borderRadius: '8px', bgcolor: 'rgba(99, 102, 241, 0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: COLORS.primaryPurple }}>
                    <CalendarToday sx={{ fontSize: 18 }} />
                  </Box>
                  <Typography sx={{ fontFamily: FONTS.display, fontWeight: 800, fontSize: { xs: '16px', md: '18px' }, color: c.text1 }}>
                    Smart Scheduling
                  </Typography>
                </Stack>
                <Typography sx={{ fontFamily: FONTS.body, color: c.text2, fontSize: { xs: '13px', md: '14.5px' }, maxWidth: 440, mb: 4 }}>
                  Deliver contextually relevant content. Automate playbacks by location coordinates, local hours, or custom event rules.
                </Typography>
              </Box>
              {/* Visual preview */}
              <Box sx={{
                bgcolor: themeMode === 'light' ? '#FAFAFA' : 'rgba(0,0,0,0.15)',
                border: `1px solid ${c.border}`,
                borderRadius: '8px',
                p: 2,
              }}>
                <Stack direction={{ xs: 'column', sm: 'row' }} gap={1.5} justifyContent="space-between">
                  {['09:00 AM - Morning Fuel', '01:00 PM - Lunch Specials', '06:00 PM - Prime Time'].map((slot, idx) => (
                    <Box key={idx} sx={{ flex: 1, p: 1, bgcolor: c.surfaceCard, border: `1px solid ${c.border}`, borderRadius: '6px' }}>
                      <Typography sx={{ fontFamily: FONTS.mono, fontSize: '8px', color: COLORS.primaryPurple, fontWeight: 700 }}>{slot.split(' - ')[0]}</Typography>
                      <Typography sx={{ fontFamily: FONTS.body, fontSize: '9px', color: c.text1, fontWeight: 700, mt: 0.5 }}>{slot.split(' - ')[1]}</Typography>
                    </Box>
                  ))}
                </Stack>
              </Box>
            </Box>
          </Grid>

          {/* Card 5: Analytics & Reports (xs=12, md=6) */}
          <Grid size={{ xs: 12, md: 6 }}>
            <Box
              className="glass-card"
              sx={{
                p: { xs: 3, md: 4 },
                height: '100%',
                borderRadius: '20px',
                border: `1px solid ${c.border}`,
                bgcolor: c.surfaceCard,
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
              }}
            >
              <Box sx={{ mb: 4 }}>
                <Stack direction="row" alignItems="center" gap={1.5} mb={2.5}>
                  <Box sx={{ width: 34, height: 34, borderRadius: '8px', bgcolor: 'rgba(99, 102, 241, 0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: COLORS.primaryPurple }}>
                    <Assessment sx={{ fontSize: 18 }} />
                  </Box>
                  <Typography sx={{ fontFamily: FONTS.display, fontWeight: 800, fontSize: { xs: '16px', md: '18px' }, color: c.text1 }}>
                    Analytics & Reports
                  </Typography>
                </Stack>
                <Typography sx={{ fontFamily: FONTS.body, color: c.text2, fontSize: { xs: '13px', md: '14.5px' }, lineHeight: 1.6 }}>
                  Track every loop and play. Generate downloadable client proof logs showing precise audience views, active durations, and network uptime percentages.
                </Typography>
              </Box>
            </Box>
          </Grid>

          {/* Card 6: Monetization (xs=12, md=6) */}
          <Grid size={{ xs: 12, md: 6 }}>
            <Box
              className="glass-card"
              sx={{
                p: { xs: 3, md: 4 },
                height: '100%',
                borderRadius: '20px',
                border: `1px solid ${c.border}`,
                bgcolor: c.surfaceCard,
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
              }}
            >
              <Box sx={{ mb: 4 }}>
                <Stack direction="row" alignItems="center" gap={1.5} mb={2.5}>
                  <Box sx={{ width: 34, height: 34, borderRadius: '8px', bgcolor: 'rgba(99, 102, 241, 0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: COLORS.primaryPurple }}>
                    <Payments sx={{ fontSize: 18 }} />
                  </Box>
                  <Typography sx={{ fontFamily: FONTS.display, fontWeight: 800, fontSize: { xs: '16px', md: '18px' }, color: c.text1 }}>
                    Monetization
                  </Typography>
                </Stack>
                <Typography sx={{ fontFamily: FONTS.body, color: c.text2, fontSize: { xs: '13px', md: '14.5px' }, lineHeight: 1.6 }}>
                  Turn display networks into high-yield ad assets. List screen spaces on our direct marketplace, accept programmatic bids, and receive advance settlements.
                </Typography>
              </Box>
            </Box>
          </Grid>

          {/* Card 7: Automation Rules (xs=12, md=4) */}
          <Grid size={{ xs: 12, md: 4 }}>
            <Box
              className="glass-card"
              sx={{
                p: { xs: 3, md: 4 },
                height: '100%',
                borderRadius: '20px',
                border: `1px solid ${c.border}`,
                bgcolor: c.surfaceCard,
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
              }}
            >
              <Box sx={{ mb: 4 }}>
                <Stack direction="row" alignItems="center" gap={1.5} mb={2.5}>
                  <Box sx={{ width: 34, height: 34, borderRadius: '8px', bgcolor: 'rgba(99, 102, 241, 0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: COLORS.primaryPurple }}>
                    <SettingsSuggest sx={{ fontSize: 18 }} />
                  </Box>
                  <Typography sx={{ fontFamily: FONTS.display, fontWeight: 800, fontSize: { xs: '16px', md: '18px' }, color: c.text1 }}>
                    Automation
                  </Typography>
                </Stack>
                <Typography sx={{ fontFamily: FONTS.body, color: c.text2, fontSize: { xs: '13px', md: '14px' }, lineHeight: 1.5 }}>
                  Configure intelligent event triggers. Change creatives instantly based on weather forecasts, store inventory items, or local crowd density.
                </Typography>
              </Box>
            </Box>
          </Grid>

          {/* Card 8: Multi-Location Support (xs=12, md=8) */}
          <Grid size={{ xs: 12, md: 8 }}>
            <Box
              className="glass-card"
              sx={{
                p: { xs: 3, md: 4 },
                height: '100%',
                borderRadius: '20px',
                border: `1px solid ${c.border}`,
                bgcolor: c.surfaceCard,
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
              }}
            >
              <Box>
                <Stack direction="row" alignItems="center" gap={1.5} mb={2.5}>
                  <Box sx={{ width: 34, height: 34, borderRadius: '8px', bgcolor: 'rgba(99, 102, 241, 0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: COLORS.primaryPurple }}>
                    <Router sx={{ fontSize: 18 }} />
                  </Box>
                  <Typography sx={{ fontFamily: FONTS.display, fontWeight: 800, fontSize: { xs: '16px', md: '18px' }, color: c.text1 }}>
                    Multi-Location Support
                  </Typography>
                </Stack>
                <Typography sx={{ fontFamily: FONTS.body, color: c.text2, fontSize: { xs: '13px', md: '14.5px' }, maxWidth: 440, mb: 4 }}>
                  Control displays across diverse malls, stores, and cities from one central browser dashboard. Group and tag nodes by city codes with ease.
                </Typography>
              </Box>
              {/* Visual location mockups */}
              <Box sx={{
                bgcolor: themeMode === 'light' ? '#FAFAFA' : 'rgba(0,0,0,0.15)',
                border: `1px solid ${c.border}`,
                borderRadius: '8px',
                p: 2,
              }}>
                <Stack direction={{ xs: 'column', sm: 'row' }} gap={{ xs: 1, sm: 2 }} justifyContent="space-between">
                  {['Mumbai Metro Grid (12 Displays)', 'CP Flagship Kiosk (4 Displays)', 'Phoenix Mall West (8 Displays)'].map((loc, idx) => (
                    <Box key={idx} sx={{ flex: 1, p: 1, bgcolor: c.surfaceCard, border: `1px solid ${c.border}`, borderRadius: '6px' }}>
                      <Typography sx={{ fontFamily: FONTS.body, fontSize: '9px', color: c.text1, fontWeight: 700 }}>{loc.split(' (')[0]}</Typography>
                      <Typography sx={{ fontFamily: FONTS.mono, fontSize: '8px', color: c.text3, mt: 0.5 }}>{loc.split(' (')[1].replace(')', '')}</Typography>
                    </Box>
                  ))}
                </Stack>
              </Box>
            </Box>
          </Grid>
        </Grid>

        {/* Explore all features button */}
        <Box sx={{ textAlign: 'center' }}>
          <Button
            variant="outlined"
            sx={{
              fontFamily: FONTS.body,
              borderColor: c.border,
              color: c.text1,
              bgcolor: themeMode === 'light' ? '#FFFFFF' : 'transparent',
              textTransform: 'none',
              fontSize: '14px',
              fontWeight: 600,
              borderRadius: '10px',
              px: 4,
              py: 1.4,
              '&:hover': {
                borderColor: c.text2,
                bgcolor: 'rgba(255, 255, 255, 0.02)',
              },
            }}
          >
            Explore All Features →
          </Button>
        </Box>
      </Container>
    </Box>
  );
}
