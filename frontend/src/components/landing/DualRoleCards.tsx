import { useState, useMemo, useEffect } from 'react';
import { Box, Typography, Container, Stack, Button, Grid } from '@mui/material';
import Campaign from '@mui/icons-material/Campaign';
import Monitor from '@mui/icons-material/Monitor';
import ArrowForward from '@mui/icons-material/ArrowForward';
import CloudUpload from '@mui/icons-material/CloudUpload';
import ShowChart from '@mui/icons-material/ShowChart';
import OfflineBolt from '@mui/icons-material/OfflineBolt';
import CalendarToday from '@mui/icons-material/CalendarToday';
import ErrorOutline from '@mui/icons-material/ErrorOutline';
import CheckCircleOutline from '@mui/icons-material/CheckCircleOutline';
import TrendingUp from '@mui/icons-material/TrendingUp';
import Visibility from '@mui/icons-material/Visibility';
import Devices from '@mui/icons-material/Devices';
import AccountBalanceWallet from '@mui/icons-material/AccountBalanceWallet';

import { COLORS, FONTS, DUAL_ROLES, PROBLEM_SOLUTIONS } from './landingData';
import { useNavigate } from 'react-router-dom';

interface SectionProps {
  themeMode: 'light' | 'dark';
}

type TabType = 'advertiser' | 'owner';

export default function DualRoleCards({ themeMode }: SectionProps) {
  const c = COLORS[themeMode];
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<TabType>('advertiser');

  // Advertiser state variables
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

  // Screen Owner state variables
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

  const currentProblemSolution = PROBLEM_SOLUTIONS[activeTab];

  return (
    <Box className="reveal-section" sx={{ py: { xs: 8, sm: 10, md: 16 }, bgcolor: c.bg, position: 'relative' }}>
      <Container maxWidth="lg">
        {/* Section Header */}
        <Box sx={{ textAlign: 'center', mb: { xs: 5, md: 8 } }}>
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
            The Problem We Solve
          </Typography>
          <Typography
            sx={{
              fontFamily: FONTS.display,
              fontWeight: 900,
              fontSize: { xs: '28px', sm: '36px', md: '48px' },
              color: c.text1,
              mb: 2.5,
              letterSpacing: '-0.02em',
            }}
          >
            One Platform. <Box component="span" sx={{ color: COLORS.primaryPurple }}>Two Businesses.</Box>
          </Typography>
          <Typography
            sx={{
              fontFamily: FONTS.body,
              color: c.text2,
              fontSize: { xs: '14px', sm: '16px', md: '18px' },
              maxWidth: 640,
              mx: 'auto',
              mb: { xs: 4, md: 6 },
              lineHeight: 1.6,
            }}
          >
            Whether you're a brand looking for reach or a screen owner seeking revenue — PixelSpot connects both sides of the digital out-of-home ecosystem. <strong>Completely free.</strong>
          </Typography>

          {/* Premium Selector Switcher */}
          <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="center" gap={2} mb={{ xs: 5, md: 8 }}>
            <Button
              onClick={() => setActiveTab('advertiser')}
              startIcon={<Campaign />}
              sx={{
                fontFamily: FONTS.body,
                textTransform: 'none',
                fontSize: { xs: '14px', sm: '15px' },
                fontWeight: 700,
                color: activeTab === 'advertiser' ? '#ffffff' : c.text2,
                bgcolor: activeTab === 'advertiser' ? COLORS.primaryPurple : (themeMode === 'light' ? '#FFFFFF' : 'rgba(255,255,255,0.02)'),
                border: `1px solid ${activeTab === 'advertiser' ? 'transparent' : c.border}`,
                borderRadius: '30px',
                px: 4,
                py: 1.5,
                boxShadow: activeTab === 'advertiser' ? `0 10px 25px rgba(99, 102, 241, 0.2)` : 'none',
                '&:hover': {
                  bgcolor: activeTab === 'advertiser' ? COLORS.primaryPurpleHover : 'rgba(255,255,255,0.05)',
                },
              }}
            >
              I am an Advertiser
            </Button>
            <Button
              onClick={() => setActiveTab('owner')}
              startIcon={<Monitor />}
              sx={{
                fontFamily: FONTS.body,
                textTransform: 'none',
                fontSize: { xs: '14px', sm: '15px' },
                fontWeight: 700,
                color: activeTab === 'owner' ? '#ffffff' : c.text2,
                bgcolor: activeTab === 'owner' ? COLORS.electricBlue : (themeMode === 'light' ? '#FFFFFF' : 'rgba(255,255,255,0.02)'),
                border: `1px solid ${activeTab === 'owner' ? 'transparent' : c.border}`,
                borderRadius: '30px',
                px: 4,
                py: 1.5,
                boxShadow: activeTab === 'owner' ? `0 10px 25px rgba(14, 165, 233, 0.15)` : 'none',
                '&:hover': {
                  bgcolor: activeTab === 'owner' ? COLORS.electricBlueHover : 'rgba(255,255,255,0.05)',
                },
              }}
            >
              I am a Screen Owner
            </Button>
          </Stack>
        </Box>

        {/* ── Problem + Solution Cards (TOP PRIORITY) ── */}
        <Grid container spacing={3} sx={{ mb: { xs: 5, md: 8 } }}>
          {/* Problem Card */}
          <Grid size={{ xs: 12, md: 6 }}>
            <Box className="problem-card" sx={{ height: '100%' }}>
              <Stack direction="row" alignItems="center" gap={1.5} mb={2}>
                <Box sx={{
                  width: 36, height: 36, borderRadius: '10px',
                  bgcolor: 'rgba(239, 68, 68, 0.1)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <ErrorOutline sx={{ color: '#ef4444', fontSize: 20 }} />
                </Box>
                <Typography sx={{
                  fontFamily: FONTS.display, fontWeight: 800, fontSize: { xs: '16px', md: '18px' },
                  color: '#ef4444',
                }}>
                  {currentProblemSolution.headline}
                </Typography>
              </Stack>
              {currentProblemSolution.problems.map((prob, idx) => (
                <Box key={idx}>
                  <Typography sx={{
                    fontFamily: FONTS.body, fontWeight: 700,
                    fontSize: { xs: '15px', md: '17px' },
                    color: c.text1, mb: 1.5, lineHeight: 1.5,
                  }}>
                    "{prob.pain}"
                  </Typography>
                  <Typography sx={{
                    fontFamily: FONTS.body, color: c.text2,
                    fontSize: { xs: '13px', md: '14px' }, lineHeight: 1.6,
                  }}>
                    {prob.detail}
                  </Typography>
                </Box>
              ))}
            </Box>
          </Grid>

          {/* Solution Card */}
          <Grid size={{ xs: 12, md: 6 }}>
            <Box className="solution-card" sx={{ height: '100%' }}>
              <Stack direction="row" alignItems="center" gap={1.5} mb={2.5}>
                <Box sx={{
                  width: 36, height: 36, borderRadius: '10px',
                  bgcolor: 'rgba(34, 197, 94, 0.1)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <CheckCircleOutline sx={{ color: COLORS.success, fontSize: 20 }} />
                </Box>
                <Typography sx={{
                  fontFamily: FONTS.display, fontWeight: 800, fontSize: { xs: '16px', md: '18px' },
                  color: COLORS.success,
                }}>
                  {currentProblemSolution.solutionHeadline}
                </Typography>
              </Stack>
              <Stack gap={2}>
                {currentProblemSolution.solutions.map((sol, idx) => {
                  const icons = activeTab === 'advertiser'
                    ? [TrendingUp, Visibility, ShowChart, AccountBalanceWallet]
                    : [Devices, Monitor, AccountBalanceWallet, TrendingUp];
                  const Icon = icons[idx] || CheckCircleOutline;
                  return (
                    <Stack key={idx} direction="row" alignItems="flex-start" gap={1.5}>
                      <Box sx={{
                        width: 28, height: 28, borderRadius: '7px',
                        bgcolor: 'rgba(34, 197, 94, 0.08)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        flexShrink: 0, mt: 0.25,
                      }}>
                        <Icon sx={{ fontSize: 14, color: COLORS.success }} />
                      </Box>
                      <Typography sx={{
                        fontFamily: FONTS.body, fontSize: { xs: '13px', md: '14px' },
                        color: c.text1, fontWeight: 500, lineHeight: 1.5,
                      }}>
                        {sol}
                      </Typography>
                    </Stack>
                  );
                })}
              </Stack>
            </Box>
          </Grid>
        </Grid>

        {/* Dynamic Interactive Showcases */}
        {activeTab === 'advertiser' ? (
          /* ── TAB 1: Advertiser Showcase ── */
          <Box className="interactive-showcase-panel">
            <Grid container spacing={{ xs: 3, md: 5 }} alignItems="center">
              {/* Left Sandbox Configuration */}
              <Grid size={{ xs: 12, lg: 5 }}>
                <Stack spacing={3.5}>
                  <Box>
                    <Typography sx={{ fontFamily: FONTS.display, fontWeight: 800, fontSize: { xs: '20px', md: '24px' }, color: c.text1, mb: 1.5 }}>
                      Plan Campaigns Instantly
                    </Typography>
                    <Typography sx={{ fontFamily: FONTS.body, color: c.text2, fontSize: { xs: '13px', md: '14px' }, lineHeight: 1.5 }}>
                      {DUAL_ROLES.advertiser.desc} Configure your reach below and see estimated results in real time.
                    </Typography>
                  </Box>

                  {/* Targeted Screens Selector */}
                  <Box>
                    <Typography sx={{ fontFamily: FONTS.mono, fontSize: '11px', color: c.text3, mb: 1.5, letterSpacing: '0.05em' }}>
                      TARGET HUBS
                    </Typography>
                    <Stack direction="row" gap={1} flexWrap="wrap">
                      {[
                        { id: 'all', label: 'All Prime Hubs (8)' },
                        { id: 'mall', label: 'Phoenix Mall' },
                        { id: 'market', label: 'CP Main' },
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
                            bgcolor: selectedScreen === opt.id ? 'rgba(99, 102, 241, 0.12)' : (themeMode === 'light' ? '#FFFFFF' : 'rgba(255,255,255,0.01)'),
                            border: `1px solid ${selectedScreen === opt.id ? COLORS.primaryPurple : c.border}`,
                            borderRadius: '8px',
                            px: 2,
                            py: 0.8,
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
                      <Typography sx={{ fontFamily: FONTS.mono, fontSize: '11px', color: c.text3 }}>
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
                      <Typography sx={{ fontFamily: FONTS.mono, fontSize: '11px', color: c.text3 }}>
                        CAMPAIGN DAYS
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

                  <Button
                    variant="contained"
                    endIcon={<ArrowForward />}
                    onClick={() => navigate('/register')}
                    sx={{
                      fontFamily: FONTS.body,
                      bgcolor: COLORS.primaryPurple,
                      color: '#ffffff',
                      textTransform: 'none',
                      fontSize: '15px',
                      fontWeight: 700,
                      borderRadius: '10px',
                      py: 1.6,
                      boxShadow: `0 8px 24px rgba(99, 102, 241, 0.2)`,
                      '&:hover': {
                        bgcolor: COLORS.primaryPurpleHover,
                        boxShadow: `0 12px 32px rgba(99, 102, 241, 0.3)`,
                      },
                    }}
                  >
                    Start Campaign — Free
                  </Button>
                </Stack>
              </Grid>

              {/* Right Output Dashboard Visualization */}
              <Grid size={{ xs: 12, lg: 7 }}>
                <Box sx={{
                  bgcolor: themeMode === 'light' ? '#FAFAFA' : 'rgba(7, 11, 20, 0.4)',
                  border: `1px solid ${c.border}`,
                  borderRadius: '16px',
                  p: { xs: 3, md: 5 },
                  display: 'flex',
                  flexDirection: 'column',
                }}>
                  <Typography sx={{ fontFamily: FONTS.display, fontSize: '12px', fontWeight: 800, color: c.text3, mb: 3, letterSpacing: '0.05em' }}>
                    ESTIMATED CAMPAIGN REACH
                  </Typography>

                  <Grid container spacing={3} mb={4}>
                    <Grid size={{ xs: 12, sm: 6 }}>
                      <Box sx={{ borderLeft: `3px solid ${COLORS.primaryPurple}`, pl: 2 }}>
                        <Typography sx={{ fontFamily: FONTS.mono, fontSize: { xs: '22px', sm: '26px', md: '34px' }, fontWeight: 900, color: c.text1, lineHeight: 1.1 }}>
                          {estimates.impressions.toLocaleString('en-IN')}
                        </Typography>
                        <Typography sx={{ fontFamily: FONTS.body, fontSize: '12px', color: c.text3, mt: 0.5 }}>
                          Est. Audience Impressions
                        </Typography>
                      </Box>
                    </Grid>
                    <Grid size={{ xs: 12, sm: 6 }}>
                      <Box sx={{ borderLeft: `3px solid ${COLORS.electricBlue}`, pl: 2 }}>
                        <Typography sx={{ fontFamily: FONTS.mono, fontSize: { xs: '22px', sm: '26px', md: '34px' }, fontWeight: 900, color: c.text1, lineHeight: 1.1 }}>
                          {estimates.slots}
                        </Typography>
                        <Typography sx={{ fontFamily: FONTS.body, fontSize: '12px', color: c.text3, mt: 0.5 }}>
                          Allocated Slots / Day
                        </Typography>
                      </Box>
                    </Grid>
                  </Grid>

                  <Stack gap={2} sx={{ pt: 3, borderTop: `1px solid ${c.border}` }}>
                    {[
                      { Icon: CloudUpload, title: 'Upload Media', desc: 'Drag-and-drop creatives to the dashboard' },
                      { Icon: CalendarToday, title: 'Automated Locking', desc: 'Secure slot assignment coordinates instantly' },
                      { Icon: ShowChart, title: 'ROI Analysis', desc: 'Measure views and counts inside of reports' },
                    ].map((step, idx) => (
                      <Box key={idx} sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                        <Box sx={{ width: 32, height: 32, borderRadius: '8px', bgcolor: 'rgba(99, 102, 241, 0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: COLORS.primaryPurple, flexShrink: 0 }}>
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
        ) : (
          /* ── TAB 2: Screen Owner Showcase ── */
          <Box className="interactive-showcase-panel">
            <Grid container spacing={{ xs: 3, md: 5 }} alignItems="center">
              {/* Left Configuration Column */}
              <Grid size={{ xs: 12, lg: 5 }}>
                <Stack spacing={3.5}>
                  <Box>
                    <Typography sx={{ fontFamily: FONTS.display, fontWeight: 800, fontSize: { xs: '20px', md: '24px' }, color: c.text1, mb: 1.5 }}>
                      Monetize Your Screens
                    </Typography>
                    <Typography sx={{ fontFamily: FONTS.body, color: c.text2, fontSize: { xs: '13px', md: '14px' }, lineHeight: 1.5 }}>
                      {DUAL_ROLES.owner.desc} Connect displays and split your grids to run ad campaigns automatically.
                    </Typography>
                  </Box>

                  {/* Switch between Online / Offline */}
                  <Box>
                    <Typography sx={{ fontFamily: FONTS.mono, fontSize: '11px', color: c.text3, mb: 1.5, letterSpacing: '0.05em' }}>
                      PLAYER STATUS
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
                          bgcolor: isPlaying ? COLORS.success : (themeMode === 'light' ? '#FFFFFF' : 'rgba(255,255,255,0.01)'),
                          border: `1px solid ${isPlaying ? 'transparent' : c.border}`,
                          borderRadius: '8px',
                          px: 3,
                          py: 1,
                        }}
                      >
                        Online
                      </Button>
                      <Button
                        onClick={() => setIsPlaying(false)}
                        sx={{
                          fontFamily: FONTS.body,
                          textTransform: 'none',
                          fontSize: '12px',
                          fontWeight: 600,
                          color: !isPlaying ? '#ffffff' : c.text2,
                          bgcolor: !isPlaying ? '#ef4444' : (themeMode === 'light' ? '#FFFFFF' : 'rgba(255,255,255,0.01)'),
                          border: `1px solid ${!isPlaying ? 'transparent' : c.border}`,
                          borderRadius: '8px',
                          px: 3,
                          py: 1,
                        }}
                      >
                        Offline
                      </Button>
                    </Stack>
                  </Box>

                  {/* Switch Layout Mode */}
                  <Box>
                    <Typography sx={{ fontFamily: FONTS.mono, fontSize: '11px', color: c.text3, mb: 1.5, letterSpacing: '0.05em' }}>
                      ZONE CANVAS CONFIGURATION
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
                          bgcolor: layoutMode === 'full' ? COLORS.electricBlue : (themeMode === 'light' ? '#FFFFFF' : 'rgba(255,255,255,0.01)'),
                          border: `1px solid ${layoutMode === 'full' ? 'transparent' : c.border}`,
                          borderRadius: '8px',
                          px: 3,
                          py: 1,
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
                          bgcolor: layoutMode === 'split' ? COLORS.electricBlue : (themeMode === 'light' ? '#FFFFFF' : 'rgba(255,255,255,0.01)'),
                          border: `1px solid ${layoutMode === 'split' ? 'transparent' : c.border}`,
                          borderRadius: '8px',
                          px: 3,
                          py: 1,
                        }}
                      >
                        Split Zones
                      </Button>
                    </Stack>
                  </Box>

                  <Button
                    variant="contained"
                    endIcon={<ArrowForward />}
                    onClick={() => navigate('/register')}
                    sx={{
                      fontFamily: FONTS.body,
                      bgcolor: COLORS.electricBlue,
                      color: '#ffffff',
                      textTransform: 'none',
                      fontSize: '15px',
                      fontWeight: 700,
                      borderRadius: '10px',
                      py: 1.6,
                      boxShadow: `0 8px 24px rgba(14, 165, 233, 0.2)`,
                      '&:hover': {
                        bgcolor: COLORS.electricBlueHover,
                        boxShadow: `0 12px 32px rgba(14, 165, 233, 0.3)`,
                      },
                    }}
                  >
                    List My Screens — Free
                  </Button>
                </Stack>
              </Grid>

              {/* Right Television TV Emulator Screen */}
              <Grid size={{ xs: 12, lg: 7 }}>
                <Box
                  sx={{
                    bgcolor: '#070b13',
                    borderRadius: { xs: '12px', md: '16px' },
                    border: { xs: '8px solid #1e293b', md: '12px solid #1e293b' },
                    boxShadow: '0 20px 45px rgba(0, 0, 0, 0.4)',
                    overflow: 'hidden',
                    aspectRatio: '16/9',
                    position: 'relative',
                    display: 'flex',
                    flexDirection: 'column',
                  }}
                >
                  {/* Active status overlay */}
                  <Box
                    sx={{
                      position: 'absolute',
                      top: { xs: 8, md: 12 },
                      left: { xs: 8, md: 12 },
                      bgcolor: isPlaying ? 'rgba(34, 197, 94, 0.2)' : 'rgba(239, 68, 68, 0.2)',
                      border: `1px solid ${isPlaying ? COLORS.success : '#ef4444'}`,
                      borderRadius: '100px',
                      px: 1.5,
                      py: 0.5,
                      zIndex: 20,
                    }}
                  >
                    <Typography sx={{ fontFamily: FONTS.mono, fontSize: '9px', fontWeight: 800, color: isPlaying ? COLORS.success : '#ef4444' }}>
                      {isPlaying ? '● PLAYER ONLINE' : '○ DISCONNECTED'}
                    </Typography>
                  </Box>

                  {/* Live revenue ticker */}
                  <Box
                    sx={{
                      position: 'absolute',
                      top: { xs: 8, md: 12 },
                      right: { xs: 8, md: 12 },
                      bgcolor: 'rgba(0,0,0,0.85)',
                      border: '1px solid rgba(255,255,255,0.08)',
                      borderRadius: '8px',
                      px: 1.5,
                      py: 0.75,
                      zIndex: 20,
                    }}
                  >
                    <Typography sx={{ fontFamily: FONTS.mono, fontSize: '8px', color: '#64748b' }}>PAYOUT REVENUE</Typography>
                    <Typography sx={{ fontFamily: FONTS.mono, fontSize: '13px', fontWeight: 800, color: COLORS.success, mt: 0.25 }}>
                      ₹{earnings.toLocaleString('en-IN')}
                    </Typography>
                  </Box>

                  {/* Screen Content body */}
                  <Box sx={{ flex: 1, position: 'relative', display: 'flex' }}>
                    {isPlaying ? (
                      layoutMode === 'full' ? (
                        <Box sx={{
                          flex: 1,
                          bgcolor: '#1d4ed8',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          p: 3,
                          backgroundImage: 'radial-gradient(circle, #3b82f6 20%, #1d4ed8 100%)',
                        }}>
                          <Typography sx={{ fontFamily: FONTS.display, fontSize: { xs: '14px', md: '18px' }, fontWeight: 800, color: '#fff', textAlign: 'center' }}>
                            Full Screen Brand Commercial Video
                          </Typography>
                        </Box>
                      ) : (
                        <>
                          <Box sx={{
                            flex: 1.2,
                            bgcolor: '#1d4ed8',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            p: 2,
                            backgroundImage: 'radial-gradient(circle, #3b82f6 20%, #1d4ed8 100%)',
                            borderRight: '2px solid #070b13',
                          }}>
                            <Typography sx={{ fontFamily: FONTS.display, fontSize: { xs: '11px', md: '14px' }, fontWeight: 800, color: '#fff', textAlign: 'center' }}>
                              Primary Video (70%)
                            </Typography>
                          </Box>
                          <Box sx={{
                            flex: 0.8,
                            bgcolor: '#0f766e',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            p: 2,
                            backgroundImage: 'radial-gradient(circle, #14b8a6 20%, #0f766e 100%)',
                          }}>
                            <Typography sx={{ fontFamily: FONTS.display, fontSize: { xs: '10px', md: '12px' }, fontWeight: 800, color: '#fff', textAlign: 'center' }}>
                              Weather Panel (30%)
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
                        <OfflineBolt sx={{ color: '#ef4444', fontSize: 32 }} />
                        <Typography sx={{ fontFamily: FONTS.body, fontSize: { xs: '11px', md: '13px' }, color: '#94a3b8', fontWeight: 600 }}>
                          Connection offline. Stream paused.
                        </Typography>
                      </Box>
                    )}
                  </Box>
                </Box>
              </Grid>
            </Grid>
          </Box>
        )}
      </Container>
    </Box>
  );
}
