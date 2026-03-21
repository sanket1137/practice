import { useState, useMemo } from 'react';
import { Box, Typography, Container, Stack } from '@mui/material';
import MonitorIcon from '@mui/icons-material/Monitor';
import PublicIcon from '@mui/icons-material/Public';
import { COLORS, FONTS, OWNER_FEATURES, ADVERTISER_FEATURES } from './landingData';

function OwnerCalculator() {
  const [screens, setScreens] = useState(3);
  const [hours, setHours] = useState(12);
  const monthly = useMemo(() => screens * hours * 200 * 30, [screens, hours]);

  return (
    <Box sx={{ mt: 3 }}>
      <Stack gap={2}>
        <Box>
          <Stack direction="row" justifyContent="space-between" mb={0.5}>
            <Typography sx={{ fontFamily: FONTS.mono, fontSize: '12px', color: COLORS.text3 }}>Screens</Typography>
            <Typography sx={{ fontFamily: FONTS.mono, fontSize: '12px', color: COLORS.indigo }}>{screens}</Typography>
          </Stack>
          <input type="range" min={1} max={20} value={screens} onChange={e => setScreens(Number(e.target.value))} className="landing-slider" />
        </Box>
        <Box>
          <Stack direction="row" justifyContent="space-between" mb={0.5}>
            <Typography sx={{ fontFamily: FONTS.mono, fontSize: '12px', color: COLORS.text3 }}>Hours/day</Typography>
            <Typography sx={{ fontFamily: FONTS.mono, fontSize: '12px', color: COLORS.indigo }}>{hours}</Typography>
          </Stack>
          <input type="range" min={1} max={24} value={hours} onChange={e => setHours(Number(e.target.value))} className="landing-slider" />
        </Box>
      </Stack>
      <Box sx={{ mt: 2.5, p: 2, bgcolor: `${COLORS.indigo}10`, borderRadius: '12px', textAlign: 'center' }}>
        <Typography sx={{ fontFamily: FONTS.mono, fontSize: '10px', color: COLORS.text3, mb: 0.5 }}>Estimated monthly earnings</Typography>
        <Typography sx={{ fontFamily: FONTS.display, fontWeight: 800, fontSize: '28px', color: COLORS.indigo }}>
          ₹{monthly.toLocaleString('en-IN')}
        </Typography>
      </Box>
    </Box>
  );
}

function AdvertiserCalculator() {
  const [budget, setBudget] = useState(25000);
  const [days, setDays] = useState(14);
  const reach = useMemo(() => Math.round(budget * 2.5 * (days / 7)), [budget, days]);

  return (
    <Box sx={{ mt: 3 }}>
      <Stack gap={2}>
        <Box>
          <Stack direction="row" justifyContent="space-between" mb={0.5}>
            <Typography sx={{ fontFamily: FONTS.mono, fontSize: '12px', color: COLORS.text3 }}>Budget</Typography>
            <Typography sx={{ fontFamily: FONTS.mono, fontSize: '12px', color: COLORS.pink }}>₹{budget.toLocaleString('en-IN')}</Typography>
          </Stack>
          <input type="range" min={5000} max={100000} step={5000} value={budget} onChange={e => setBudget(Number(e.target.value))} className="landing-slider pink" />
        </Box>
        <Box>
          <Stack direction="row" justifyContent="space-between" mb={0.5}>
            <Typography sx={{ fontFamily: FONTS.mono, fontSize: '12px', color: COLORS.text3 }}>Duration (days)</Typography>
            <Typography sx={{ fontFamily: FONTS.mono, fontSize: '12px', color: COLORS.pink }}>{days}</Typography>
          </Stack>
          <input type="range" min={1} max={30} value={days} onChange={e => setDays(Number(e.target.value))} className="landing-slider pink" />
        </Box>
      </Stack>
      <Box sx={{ mt: 2.5, p: 2, bgcolor: `${COLORS.pink}10`, borderRadius: '12px', textAlign: 'center' }}>
        <Typography sx={{ fontFamily: FONTS.mono, fontSize: '10px', color: COLORS.text3, mb: 0.5 }}>Estimated impressions</Typography>
        <Typography sx={{ fontFamily: FONTS.display, fontWeight: 800, fontSize: '28px', color: COLORS.pink }}>
          {reach.toLocaleString('en-IN')}
        </Typography>
      </Box>
    </Box>
  );
}

export default function DualRoleCards() {
  return (
    <Box className="reveal-section" sx={{ bgcolor: COLORS.bg, py: { xs: 8, md: 12 } }}>
      <Container maxWidth="lg">
        <Box sx={{ textAlign: 'center', mb: 6 }}>
          <Typography sx={{ fontFamily: FONTS.body, color: COLORS.indigo, fontSize: '13px', letterSpacing: '0.1em', textTransform: 'uppercase', mb: 1 }}>
            Two sides, one platform
          </Typography>
          <Typography sx={{ fontFamily: FONTS.display, color: COLORS.text1, fontSize: { xs: '28px', md: '40px' }, fontWeight: 800 }}>
            Built for both sides of DOOH
          </Typography>
        </Box>

        <Stack direction={{ xs: 'column', md: 'row' }} gap={3} alignItems="stretch">
          {/* Screen Owners */}
          <Box sx={{
            flex: 1, bgcolor: COLORS.surface, borderRadius: '16px', p: 3.5,
            border: `1px solid ${COLORS.border}`, position: 'relative', overflow: 'hidden',
            transition: 'all 400ms', '&:hover': { borderColor: `${COLORS.indigo}50`, transform: 'translateY(-4px)', boxShadow: `0 20px 60px ${COLORS.indigoGlow}` },
          }}>
            <Stack direction="row" alignItems="center" gap={1.5} mb={2}>
              <Box sx={{ width: 44, height: 44, borderRadius: '12px', bgcolor: `${COLORS.indigo}15`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <MonitorIcon sx={{ color: COLORS.indigo, fontSize: 22 }} />
              </Box>
              <Box>
                <Typography sx={{ fontFamily: FONTS.display, fontWeight: 700, fontSize: '20px', color: COLORS.text1 }}>Screen Owners</Typography>
                <Typography sx={{ fontFamily: FONTS.body, color: COLORS.text3, fontSize: '13px' }}>Monetize your displays</Typography>
              </Box>
            </Stack>
            <Typography sx={{ fontFamily: FONTS.body, color: COLORS.text2, fontSize: '14px', lineHeight: 1.7, mb: 2 }}>
              Turn idle screens into revenue machines. List your screens in minutes and start earning from day one. Approve only the ads you like.
            </Typography>
            <Stack gap={1}>
              {OWNER_FEATURES.map(f => (
                <Stack key={f} direction="row" alignItems="center" gap={1}>
                  <Box sx={{ width: 5, height: 5, borderRadius: '50%', bgcolor: COLORS.indigo, flexShrink: 0 }} />
                  <Typography sx={{ fontFamily: FONTS.body, color: COLORS.text2, fontSize: '13px' }}>{f}</Typography>
                </Stack>
              ))}
            </Stack>
            <OwnerCalculator />
          </Box>

          {/* Advertisers */}
          <Box sx={{
            flex: 1, bgcolor: COLORS.surface, borderRadius: '16px', p: 3.5,
            border: `1px solid ${COLORS.border}`, position: 'relative', overflow: 'hidden',
            transition: 'all 400ms', '&:hover': { borderColor: `${COLORS.pink}50`, transform: 'translateY(-4px)', boxShadow: `0 20px 60px ${COLORS.pinkGlow}` },
          }}>
            <Stack direction="row" alignItems="center" gap={1.5} mb={2}>
              <Box sx={{ width: 44, height: 44, borderRadius: '12px', bgcolor: `${COLORS.pink}15`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <PublicIcon sx={{ color: COLORS.pink, fontSize: 22 }} />
              </Box>
              <Box>
                <Typography sx={{ fontFamily: FONTS.display, fontWeight: 700, fontSize: '20px', color: COLORS.text1 }}>Advertisers</Typography>
                <Typography sx={{ fontFamily: FONTS.body, color: COLORS.text3, fontSize: '13px' }}>Reach real audiences</Typography>
              </Box>
            </Stack>
            <Typography sx={{ fontFamily: FONTS.body, color: COLORS.text2, fontSize: '14px', lineHeight: 1.7, mb: 2 }}>
              500+ verified screens across India. Book by location, footfall, and price. Upload your creative, pick your slots, and go live within 24 hours.
            </Typography>
            <Stack gap={1}>
              {ADVERTISER_FEATURES.map(f => (
                <Stack key={f} direction="row" alignItems="center" gap={1}>
                  <Box sx={{ width: 5, height: 5, borderRadius: '50%', bgcolor: COLORS.pink, flexShrink: 0 }} />
                  <Typography sx={{ fontFamily: FONTS.body, color: COLORS.text2, fontSize: '13px' }}>{f}</Typography>
                </Stack>
              ))}
            </Stack>
            <AdvertiserCalculator />
          </Box>
        </Stack>
      </Container>
    </Box>
  );
}
