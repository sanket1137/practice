import { useState } from 'react';
import { Box, Typography, Button, Container, Stack, IconButton, Grid, Drawer } from '@mui/material';
import LightMode from '@mui/icons-material/LightMode';
import DarkMode from '@mui/icons-material/DarkMode';
import KeyboardArrowDown from '@mui/icons-material/KeyboardArrowDown';
import Check from '@mui/icons-material/Check';
import Map from '@mui/icons-material/Map';
import InsertChart from '@mui/icons-material/InsertChart';
import PhotoLibrary from '@mui/icons-material/PhotoLibrary';
import Receipt from '@mui/icons-material/Receipt';
import MenuRounded from '@mui/icons-material/MenuRounded';
import CloseRounded from '@mui/icons-material/CloseRounded';

import { COLORS, FONTS, TRUSTED_LOGOS, HERO_CHECKLIST } from './landingData';
import { useNavigate } from 'react-router-dom';

interface HeroSectionProps {
  themeMode: 'light' | 'dark';
  toggleTheme: () => void;
}

/* ── Section 1: Sticky Navigation ────────────────────────────── */
function LandingNav({ themeMode, toggleTheme }: HeroSectionProps) {
  const navigate = useNavigate();
  const c = COLORS[themeMode];
  const [mobileOpen, setMobileOpen] = useState(false);

  const navLinks = ['Product', 'Solutions', 'Resources', 'Company'];

  return (
    <>
      <Box component="nav" className="glass-navbar">
        <Container maxWidth="lg">
          <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ height: 76 }}>
            {/* Logo */}
            <Stack direction="row" alignItems="center" gap={1.2} sx={{ cursor: 'pointer' }} onClick={() => navigate('/')}>
              <Box sx={{
                width: 34,
                height: 34,
                borderRadius: '8px',
                background: `linear-gradient(135deg, ${COLORS.primaryPurple} 0%, ${COLORS.primaryPurpleHover} 100%)`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontFamily: FONTS.display,
                fontWeight: 800,
                fontSize: '16px',
                color: '#ffffff',
              }}>
                P
              </Box>
              <Typography sx={{ fontFamily: FONTS.display, fontWeight: 800, fontSize: '20px', color: c.text1, letterSpacing: '-0.02em' }}>
                PixelSpot
              </Typography>
            </Stack>

            {/* Desktop Links */}
            <Stack direction="row" gap={4} sx={{ display: { xs: 'none', md: 'flex' } }}>
              {navLinks.map(link => (
                <Stack
                  key={link}
                  direction="row"
                  alignItems="center"
                  gap={0.5}
                  sx={{
                    fontFamily: FONTS.body,
                    fontSize: '14.5px',
                    fontWeight: 600,
                    color: c.text2,
                    cursor: 'pointer',
                    '&:hover': { color: c.text1 }
                  }}
                >
                  {link}
                  <KeyboardArrowDown sx={{ fontSize: 16, color: c.text3 }} />
                </Stack>
              ))}
            </Stack>

            {/* CTAs */}
            <Stack direction="row" gap={1.5} alignItems="center">
              <IconButton onClick={toggleTheme} sx={{ color: c.text2, '&:hover': { color: c.text1 } }}>
                {themeMode === 'light' ? <DarkMode sx={{ fontSize: 20 }} /> : <LightMode sx={{ fontSize: 20 }} />}
              </IconButton>

              <Button
                variant="text"
                onClick={() => navigate('/login')}
                sx={{
                  fontFamily: FONTS.body,
                  color: c.text1,
                  textTransform: 'none',
                  fontSize: '14.5px',
                  fontWeight: 600,
                  display: { xs: 'none', sm: 'inline-flex' },
                }}
              >
                Login
              </Button>
              <Button
                variant="contained"
                onClick={() => navigate('/register')}
                sx={{
                  fontFamily: FONTS.body,
                  bgcolor: COLORS.primaryPurple,
                  color: '#ffffff',
                  textTransform: 'none',
                  fontSize: '14px',
                  fontWeight: 700,
                  borderRadius: '8px',
                  px: 3,
                  py: 1.2,
                  boxShadow: 'none',
                  display: { xs: 'none', sm: 'inline-flex' },
                  '&:hover': {
                    bgcolor: COLORS.primaryPurpleHover,
                    boxShadow: 'none',
                  }
                }}
              >
                Get Started Free
              </Button>

              {/* Mobile Hamburger */}
              <IconButton
                className="mobile-menu-btn"
                onClick={() => setMobileOpen(true)}
                sx={{ color: c.text1, display: { md: 'none' } }}
              >
                <MenuRounded />
              </IconButton>
            </Stack>
          </Stack>
        </Container>
      </Box>

      {/* Mobile Drawer */}
      <Drawer
        anchor="right"
        open={mobileOpen}
        onClose={() => setMobileOpen(false)}
        PaperProps={{
          sx: {
            width: 280,
            bgcolor: c.bg,
            borderLeft: `1px solid ${c.border}`,
          }
        }}
      >
        <Box className="mobile-nav-drawer" sx={{ p: 3 }}>
          <Stack direction="row" justifyContent="space-between" alignItems="center" mb={4}>
            <Typography sx={{ fontFamily: FONTS.display, fontWeight: 800, fontSize: '18px', color: c.text1 }}>
              Menu
            </Typography>
            <IconButton onClick={() => setMobileOpen(false)} sx={{ color: c.text2 }}>
              <CloseRounded />
            </IconButton>
          </Stack>

          <Stack gap={0}>
            {navLinks.map(link => (
              <Box
                key={link}
                className="nav-link"
                sx={{
                  fontFamily: FONTS.body,
                  fontSize: '16px',
                  fontWeight: 600,
                  py: 1.8,
                  borderBottom: `1px solid ${c.border}`,
                  cursor: 'pointer',
                  color: c.text1,
                  '&:hover': { color: COLORS.primaryPurple }
                }}
              >
                {link}
              </Box>
            ))}
          </Stack>

          <Stack gap={1.5} mt={4}>
            <Button
              variant="outlined"
              fullWidth
              onClick={() => { navigate('/login'); setMobileOpen(false); }}
              sx={{
                fontFamily: FONTS.body,
                borderColor: c.border,
                color: c.text1,
                textTransform: 'none',
                fontSize: '15px',
                fontWeight: 600,
                borderRadius: '8px',
                py: 1.4,
              }}
            >
              Login
            </Button>
            <Button
              variant="contained"
              fullWidth
              onClick={() => { navigate('/register'); setMobileOpen(false); }}
              sx={{
                fontFamily: FONTS.body,
                bgcolor: COLORS.primaryPurple,
                color: '#ffffff',
                textTransform: 'none',
                fontSize: '15px',
                fontWeight: 700,
                borderRadius: '8px',
                py: 1.4,
                boxShadow: 'none',
                '&:hover': { bgcolor: COLORS.primaryPurpleHover },
              }}
            >
              Get Started Free
            </Button>
          </Stack>
        </Box>
      </Drawer>
    </>
  );
}

/* ── Section 2: 3D Composition Mockups ───────────────────────── */
function DashboardComposition3D({ themeMode }: { themeMode: 'light' | 'dark' }) {
  const c = COLORS[themeMode];

  return (
    <Box className="perspective-container">
      <Box className="perspective-3d-wrapper">
        {/* Widget 1: Analytics Panel */}
        <Box className="floating-glass-panel panel-analytics" sx={{ p: 2.5 }}>
          <Stack direction="row" alignItems="center" gap={1} mb={2}>
            <InsertChart sx={{ color: COLORS.primaryPurple, fontSize: 16 }} />
            <Typography sx={{ fontFamily: FONTS.display, fontSize: '12px', fontWeight: 800, color: c.text1 }}>
              Real-Time Reach
            </Typography>
          </Stack>
          <Typography sx={{ fontFamily: FONTS.mono, fontSize: '26px', fontWeight: 900, color: c.text1, mb: 0.5 }}>
            6.8M
          </Typography>
          <Typography sx={{ fontFamily: FONTS.body, fontSize: '10px', color: COLORS.success, fontWeight: 700 }}>
            ▲ +11.4% impressions
          </Typography>
        </Box>

        {/* Widget 2: Media Assets Panel */}
        <Box className="floating-glass-panel panel-media" sx={{ p: 2 }}>
          <Stack direction="row" alignItems="center" gap={1} mb={1.5}>
            <PhotoLibrary sx={{ color: COLORS.electricBlue, fontSize: 16 }} />
            <Typography sx={{ fontFamily: FONTS.display, fontSize: '11px', fontWeight: 800, color: c.text1 }}>
              Media Library
            </Typography>
          </Stack>
          <Stack gap={1}>
            {[
              { name: 'Pepsi_Ad.mp4', size: '18 MB' },
              { name: 'Promo_CP.png', size: '4 MB' },
            ].map((media, idx) => (
              <Box key={idx} sx={{ bgcolor: themeMode === 'light' ? 'rgba(0,0,0,0.03)' : 'rgba(255,255,255,0.03)', p: 1, borderRadius: '6px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Typography sx={{ fontFamily: FONTS.body, fontSize: '10px', fontWeight: 600, color: c.text1 }}>{media.name}</Typography>
                <Typography sx={{ fontFamily: FONTS.mono, fontSize: '8px', color: c.text3 }}>{media.size}</Typography>
              </Box>
            ))}
          </Stack>
        </Box>

        {/* Widget 3: Location Map Panel */}
        <Box className="floating-glass-panel panel-map" sx={{ p: 2 }}>
          <Stack direction="row" alignItems="center" gap={1} mb={1.5}>
            <Map sx={{ color: COLORS.success, fontSize: 16 }} />
            <Typography sx={{ fontFamily: FONTS.display, fontSize: '12px', fontWeight: 800, color: c.text1 }}>
              Active Displays Map
            </Typography>
          </Stack>
          <Box sx={{
            height: 120,
            bgcolor: themeMode === 'light' ? 'rgba(0,0,0,0.02)' : 'rgba(255,255,255,0.01)',
            borderRadius: '8px',
            border: `1px solid ${c.border}`,
            position: 'relative',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <Typography sx={{ fontFamily: FONTS.body, fontSize: '9px', color: c.text3 }}>India Network</Typography>
            {/* Pulsing screen markers */}
            <Box sx={{ position: 'absolute', top: '30%', left: '40%', width: 8, height: 8, borderRadius: '50%', bgcolor: COLORS.success, boxShadow: '0 0 10px #22c55e' }} />
            <Box sx={{ position: 'absolute', bottom: '25%', right: '35%', width: 8, height: 8, borderRadius: '50%', bgcolor: COLORS.success, boxShadow: '0 0 10px #22c55e' }} />
          </Box>
        </Box>

        {/* Widget 4: Live Payouts Panel */}
        <Box className="floating-glass-panel panel-payouts" sx={{ p: 2 }}>
          <Stack direction="row" alignItems="center" gap={1} mb={1.5}>
            <Receipt sx={{ color: COLORS.warning, fontSize: 16 }} />
            <Typography sx={{ fontFamily: FONTS.display, fontSize: '11px', fontWeight: 800, color: c.text1 }}>
              Earnings Log
            </Typography>
          </Stack>
          <Stack gap={1}>
            {[
              { desc: 'Phoenix Screen B Payout', val: '+₹4,200', active: true },
              { desc: 'Airport Standee B Booking', val: '+₹8,900', active: false },
            ].map((payout, idx) => (
              <Stack key={idx} direction="row" justifyContent="space-between" alignItems="center" sx={{ borderBottom: idx === 0 ? `1px solid ${c.border}` : 'none', pb: idx === 0 ? 0.75 : 0 }}>
                <Typography sx={{ fontFamily: FONTS.body, fontSize: '9px', color: c.text2 }}>{payout.desc}</Typography>
                <Typography sx={{ fontFamily: FONTS.mono, fontSize: '10px', color: COLORS.success, fontWeight: 800 }}>{payout.val}</Typography>
              </Stack>
            ))}
          </Stack>
        </Box>
      </Box>
    </Box>
  );
}

/* ── Hero Section Layout ─────────────────────────────────────── */
export default function HeroSection({ themeMode, toggleTheme }: HeroSectionProps) {
  const navigate = useNavigate();
  const c = COLORS[themeMode];

  return (
    <Box sx={{ bgcolor: c.bg, position: 'relative', overflow: 'hidden' }}>
      <LandingNav themeMode={themeMode} toggleTheme={toggleTheme} />

      {/* Grid overlay */}
      <Box className="hero-grid-bg" />

      {/* Soft gradient lighting */}
      <Box className="ambient-glow-orb" sx={{ top: '-10%', left: '50%', transform: 'translateX(-50%)' }} />

      <Container maxWidth="lg" sx={{ position: 'relative', zIndex: 10, pt: { xs: 6, sm: 8, md: 12 }, pb: { xs: 6, sm: 8, md: 14 } }}>
        <Grid container spacing={5} alignItems="center">
          {/* Left: Typography Column */}
          <Grid size={{ xs: 12, md: 6 }}>
            <Box sx={{ textAlign: { xs: 'center', md: 'left' } }}>
              {/* Badge announcement pill */}
              <Box sx={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 1,
                bgcolor: themeMode === 'light' ? 'rgba(34, 197, 94, 0.06)' : 'rgba(34, 197, 94, 0.06)',
                border: `1px solid ${themeMode === 'light' ? 'rgba(34, 197, 94, 0.2)' : 'rgba(34, 197, 94, 0.15)'}`,
                borderRadius: '100px',
                px: 2,
                py: 0.75,
                mb: 4,
              }}
                className="free-badge"
              >
                <Box className="pulse-dot" sx={{ bgcolor: COLORS.success, width: 6, height: 6 }} />
                <Typography sx={{ fontFamily: FONTS.mono, fontSize: '11px', color: COLORS.success, fontWeight: 700, letterSpacing: '0.02em' }}>
                  100% Free DOOH Platform — No Strings Attached
                </Typography>
              </Box>

              {/* Title */}
              <Typography
                variant="h1"
                sx={{
                  fontFamily: FONTS.display,
                  fontWeight: 900,
                  fontSize: { xs: '32px', sm: '42px', md: '56px', lg: '68px' },
                  lineHeight: 1.05,
                  letterSpacing: '-0.03em',
                  color: c.text1,
                  mb: 3.5,
                }}
              >
                Your Screens<br />
                Deserve to{' '}
                <Box component="span" sx={{
                  background: `linear-gradient(135deg, ${COLORS.primaryPurple} 0%, #818cf8 50%, ${COLORS.electricBlue} 100%)`,
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                }}>
                  Earn.
                </Box>
              </Typography>

              {/* Subtext */}
              <Typography
                sx={{
                  fontFamily: FONTS.body,
                  color: c.text2,
                  fontSize: { xs: '15px', sm: '16px', md: '18px' },
                  lineHeight: 1.65,
                  maxWidth: 520,
                  mx: { xs: 'auto', md: '0' },
                  mb: 5,
                }}
              >
                India's fragmented DOOH market leaves screens idle and advertisers guessing. PixelSpot bridges the gap — a <strong>free, all-in-one platform</strong> to manage screens, deliver content, and connect advertisers with the right audiences.
              </Typography>

              {/* Action Buttons */}
              <Stack direction={{ xs: 'column', sm: 'row' }} gap={2} justifyContent={{ xs: 'center', md: 'flex-start' }} mb={5.5}>
                <Button
                  variant="contained"
                  onClick={() => navigate('/register')}
                  sx={{
                    fontFamily: FONTS.body,
                    bgcolor: COLORS.primaryPurple,
                    color: '#ffffff',
                    textTransform: 'none',
                    fontSize: '15px',
                    fontWeight: 700,
                    borderRadius: '10px',
                    px: 4.5,
                    py: 1.6,
                    boxShadow: `0 8px 24px rgba(99, 102, 241, 0.25)`,
                    '&:hover': {
                      bgcolor: COLORS.primaryPurpleHover,
                      boxShadow: `0 12px 32px rgba(99, 102, 241, 0.35)`,
                    },
                  }}
                >
                  Get Started — It's Free
                </Button>
                <Button
                  variant="outlined"
                  onClick={() => navigate('/explore')}
                  sx={{
                    fontFamily: FONTS.body,
                    borderColor: c.border,
                    color: c.text1,
                    bgcolor: themeMode === 'light' ? '#FFFFFF' : 'transparent',
                    textTransform: 'none',
                    fontSize: '15px',
                    fontWeight: 600,
                    borderRadius: '10px',
                    px: 4.5,
                    py: 1.6,
                    boxShadow: themeMode === 'light' ? '0 2px 8px rgba(0,0,0,0.02)' : 'none',
                    '&:hover': {
                      borderColor: c.text2,
                      bgcolor: 'rgba(255, 255, 255, 0.03)',
                    },
                  }}
                >
                  Explore Screens
                </Button>
              </Stack>

              {/* Checklist */}
              <Stack direction="row" gap={{ xs: 2, sm: 3 }} justifyContent={{ xs: 'center', md: 'flex-start' }} flexWrap="wrap">
                {HERO_CHECKLIST.map(item => (
                  <Box key={item} sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                    <Box sx={{ width: 16, height: 16, borderRadius: '50%', bgcolor: 'rgba(34, 197, 94, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Check sx={{ color: COLORS.success, fontSize: 10 }} />
                    </Box>
                    <Typography sx={{ fontFamily: FONTS.mono, fontSize: '11px', color: c.text3, fontWeight: 600 }}>{item}</Typography>
                  </Box>
                ))}
              </Stack>
            </Box>
          </Grid>

          {/* Right: 3D Floating Mockup Composition — visible from md */}
          <Grid size={{ xs: 12, md: 6 }} sx={{ display: { xs: 'none', md: 'block' } }}>
            <DashboardComposition3D themeMode={themeMode} />
          </Grid>
        </Grid>

        {/* Brand logo clouds */}
        <Box sx={{ borderTop: `1px solid ${c.border}`, pt: 6, mt: { xs: 6, sm: 8, lg: 12 } }}>
          <Typography sx={{ fontFamily: FONTS.body, fontSize: '12.5px', color: c.text3, letterSpacing: '0.02em', mb: 4, textAlign: 'center' }}>
            Trusted by 2,000+ businesses worldwide
          </Typography>
          <Stack direction="row" gap={{ xs: 3, sm: 4, md: 8 }} flexWrap="wrap" justifyContent="center" alignItems="center">
            {TRUSTED_LOGOS.map((name, i) => (
              <Typography
                key={i}
                sx={{
                  fontFamily: FONTS.display,
                  fontWeight: 800,
                  fontSize: { xs: '14px', sm: '16px', md: '19px' },
                  color: c.text1,
                  opacity: c.logoOpacity,
                  letterSpacing: '0.05em',
                  transition: 'opacity 0.2s',
                  '&:hover': { opacity: 1 }
                }}
              >
                {name}
              </Typography>
            ))}
          </Stack>
        </Box>
      </Container>
    </Box>
  );
}
