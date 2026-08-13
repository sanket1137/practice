import { useState, useMemo } from 'react';
import { Box, Typography, Container, Grid, Stack, Button } from '@mui/material';
import CalendarToday from '@mui/icons-material/CalendarToday';
import ShowChart from '@mui/icons-material/ShowChart';
import CloudUpload from '@mui/icons-material/CloudUpload';

import { COLORS, FONTS } from './landingData';

interface SectionProps {
  themeMode: 'light' | 'dark';
}

export default function SocialProof({ themeMode }: SectionProps) {
  const c = COLORS[themeMode];
  const [budget, setBudget] = useState<number>(35000);
  const [days, setDays] = useState<number>(10);
  const [selectedScreen, setSelectedScreen] = useState<string>('all');

  const estimates = useMemo(() => {
    const screensCount = selectedScreen === 'all' ? 8 : 1;
    const ratePerDay = selectedScreen === 'all' ? 1800 : 2200;
    const baseImpressionsPerDay = selectedScreen === 'all' ? 12000 : 8000;

    const actualBudget = budget;
    const slotsCount = Math.max(1, Math.floor(actualBudget / (ratePerDay * days)));
    const impressions = slotsCount * baseImpressionsPerDay * days * screensCount;

    return {
      slots: slotsCount,
      impressions,
    };
  }, [budget, days, selectedScreen]);

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
            Advertiser Sandbox
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
            Interactive Reach Planner
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
            Configure your campaign budget and schedule below to instantly estimate audience impressions across premium screen hubs.
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
          <Grid container spacing={5}>
            {/* Inputs Column */}
            <Grid size={{ xs: 12, lg: 5 }}>
              <Stack spacing={4}>
                <Typography sx={{ fontFamily: FONTS.display, fontWeight: 800, fontSize: '20px', color: c.text1 }}>
                  Configure Ad Buy
                </Typography>

                {/* Search Target Screen selector */}
                <Box>
                  <Typography sx={{ fontFamily: FONTS.mono, fontSize: '11px', color: c.text3, mb: 1.5, letterSpacing: '0.05em' }}>
                    TARGET SCREENS
                  </Typography>
                  <Stack direction="row" gap={1.5} flexWrap="wrap">
                    {[
                      { id: 'all', label: 'All Prime Hubs (8 Screens)' },
                      { id: 'mall', label: 'Phoenix Mall Lobby' },
                      { id: 'market', label: 'Connaught Place Main' },
                    ].map(opt => (
                      <Button
                        key={opt.id}
                        onClick={() => setSelectedScreen(opt.id)}
                        sx={{
                          fontFamily: FONTS.body,
                          textTransform: 'none',
                          fontSize: '12px',
                          fontWeight: 600,
                          color: selectedScreen === opt.id ? c.text1 : c.text2,
                          bgcolor: selectedScreen === opt.id ? 'rgba(99, 102, 241, 0.12)' : (themeMode === 'light' ? '#F1F5F9' : 'rgba(255,255,255,0.02)'),
                          border: `1px solid ${selectedScreen === opt.id ? COLORS.primaryPurple : c.border}`,
                          borderRadius: '8px',
                          px: 2,
                          py: 0.8,
                          '&:hover': {
                            bgcolor: selectedScreen === opt.id ? 'rgba(99, 102, 241, 0.2)' : 'rgba(255,255,255,0.05)',
                          },
                        }}
                      >
                        {opt.label}
                      </Button>
                    ))}
                  </Stack>
                </Box>

                {/* Budget Slider */}
                <Box>
                  <Stack direction="row" justifyContent="space-between" mb={1.5}>
                    <Typography sx={{ fontFamily: FONTS.mono, fontSize: '11px', color: c.text3, letterSpacing: '0.05em' }}>
                      CAMPAIGN BUDGET
                    </Typography>
                    <Typography sx={{ fontFamily: FONTS.mono, fontSize: '14px', color: COLORS.primaryPurple, fontWeight: 700 }}>
                      ₹{budget.toLocaleString('en-IN')}
                    </Typography>
                  </Stack>
                  <input
                    type="range"
                    min={5000}
                    max={150000}
                    step={5000}
                    value={budget}
                    onChange={e => setBudget(Number(e.target.value))}
                    className="premium-slider"
                  />
                </Box>

                {/* Duration Slider */}
                <Box>
                  <Stack direction="row" justifyContent="space-between" mb={1.5}>
                    <Typography sx={{ fontFamily: FONTS.mono, fontSize: '11px', color: c.text3, letterSpacing: '0.05em' }}>
                      DURATION (DAYS)
                    </Typography>
                    <Typography sx={{ fontFamily: FONTS.mono, fontSize: '14px', color: COLORS.primaryPurple, fontWeight: 700 }}>
                      {days} Days
                    </Typography>
                  </Stack>
                  <input
                    type="range"
                    min={1}
                    max={30}
                    value={days}
                    onChange={e => setDays(Number(e.target.value))}
                    className="premium-slider"
                  />
                </Box>
              </Stack>
            </Grid>

            {/* Visualizer Outputs Column */}
            <Grid size={{ xs: 12, lg: 7 }}>
              <Box
                sx={{
                  bgcolor: themeMode === 'light' ? '#F8FAFC' : 'rgba(7, 11, 20, 0.4)',
                  border: `1px solid ${c.border}`,
                  borderRadius: '16px',
                  p: { xs: 3, md: 5 },
                  height: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'center',
                }}
              >
                <Typography sx={{ fontFamily: FONTS.display, fontSize: '12px', fontWeight: 800, color: c.text3, mb: 3, letterSpacing: '0.05em' }}>
                  ESTIMATED CAMPAIGN REACH
                </Typography>

                <Grid container spacing={3} mb={4}>
                  <Grid size={{ xs: 12, sm: 6 }}>
                    <Box sx={{ borderLeft: `3px solid ${COLORS.primaryPurple}`, pl: 2 }}>
                      <Typography sx={{ fontFamily: FONTS.mono, fontSize: { xs: '26px', md: '34px' }, fontWeight: 800, color: c.text1, lineHeight: 1.1 }}>
                        {estimates.impressions.toLocaleString('en-IN')}
                      </Typography>
                      <Typography sx={{ fontFamily: FONTS.body, fontSize: '12px', color: c.text3, mt: 0.5 }}>
                        Est. Audience Impressions
                      </Typography>
                    </Box>
                  </Grid>

                  <Grid size={{ xs: 12, sm: 6 }}>
                    <Box sx={{ borderLeft: `3px solid ${COLORS.electricBlue}`, pl: 2 }}>
                      <Typography sx={{ fontFamily: FONTS.mono, fontSize: { xs: '26px', md: '34px' }, fontWeight: 800, color: c.text1, lineHeight: 1.1 }}>
                        {estimates.slots}
                      </Typography>
                      <Typography sx={{ fontFamily: FONTS.body, fontSize: '12px', color: c.text3, mt: 0.5 }}>
                        Allocated Slots / Day
                      </Typography>
                    </Box>
                  </Grid>
                </Grid>

                {/* Simulated Campaign Steps Preview */}
                <Stack gap={2} sx={{ pt: 3, borderTop: `1px solid ${c.border}` }}>
                  {[
                    { Icon: CloudUpload, title: 'Creatives Uploaded', desc: 'Summer collection MP4/JPG ready' },
                    { Icon: CalendarToday, title: 'Ad Booking Lock', desc: 'Secure slot assignment guaranteed' },
                    { Icon: ShowChart, title: 'Live ROI Tracking', desc: 'View impressions within 60 seconds of playback' },
                  ].map((step, idx) => (
                    <Box key={idx} sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                      <Box sx={{ width: 32, height: 32, borderRadius: '8px', bgcolor: 'rgba(99, 102, 241, 0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: COLORS.primaryPurple }}>
                        <step.Icon sx={{ fontSize: 16 }} />
                      </Box>
                      <Box>
                        <Typography sx={{ fontFamily: FONTS.body, fontSize: '13px', fontWeight: 700, color: c.text1 }}>{step.title}</Typography>
                        <Typography sx={{ fontFamily: FONTS.body, fontSize: '11px', color: c.text3 }}>{step.desc}</Typography>
                      </Box>
                    </Box>
                  ))}
                </Stack>
              </Box>
            </Grid>
          </Grid>
        </Box>
      </Container>
    </Box>
  );
}
