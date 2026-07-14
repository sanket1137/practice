import { useEffect, useRef } from 'react';
import { Box, Typography, Stack, Container, Grid } from '@mui/material';
import DashboardRounded from '@mui/icons-material/DashboardRounded';
import PublicRounded from '@mui/icons-material/PublicRounded';
import TrendingUpRounded from '@mui/icons-material/TrendingUpRounded';
import WifiOffRounded from '@mui/icons-material/WifiOffRounded';
import TimelineRounded from '@mui/icons-material/TimelineRounded';
import DescriptionRounded from '@mui/icons-material/DescriptionRounded';
import CreditCardRounded from '@mui/icons-material/CreditCardRounded';
import SearchRounded from '@mui/icons-material/SearchRounded';
import PlayCircleOutlineRounded from '@mui/icons-material/PlayCircleOutlineRounded';

const FONT = "'Inter', system-ui, sans-serif";
const ACCENT = '#5e6ad2';

const CASCADE_WORDS = [
  'Agency', 'Broker', 'Phone Call', 'WhatsApp',
  'Excel', 'Manual Reports', 'Commission', 'Negotiation',
];

const OWNER_FEATURES = [
  { icon: PublicRounded, title: 'Public Marketplace', desc: 'Your screen becomes discoverable instantly.', color: ACCENT },
  { icon: TrendingUpRounded, title: 'Dynamic Pricing', desc: 'Charge more when demand rises.', color: '#4ade80' },
  { icon: WifiOffRounded, title: 'Offline Playback', desc: "Internet goes down, your screen doesn't.", color: '#d1d5db' },
  { icon: TimelineRounded, title: 'Telemetry', desc: 'Every play recorded, automatically.', color: '#60a5fa' },
  { icon: DescriptionRounded, title: 'Automated Reports', desc: 'No spreadsheets, no manual proof.', color: '#a78bfa' },
  { icon: CreditCardRounded, title: 'Instant Settlement', desc: 'Bookings complete, payments happen.', color: '#fbbf24' },
];

/* ── Story Slide ─────────────────────────────────────────── */
function StorySlide({ children, className = '', sx = {} }: {
  children: React.ReactNode;
  className?: string;
  sx?: Record<string, unknown>;
}) {
  return (
    <Box component="section" className={`story-section ${className}`} sx={sx}>
      {children}
    </Box>
  );
}

/* ── Story Text ──────────────────────────────────────────── */
function StoryText({ children, active = false, sx = {} }: {
  children: React.ReactNode;
  active?: boolean;
  sx?: Record<string, unknown>;
}) {
  return (
    <Typography
      className={`story-text ${active ? 'active' : ''}`}
      sx={{ fontFamily: FONT, ...sx }}
    >
      {children}
    </Typography>
  );
}

/* ══════════════════════════════════════════════════════════ */
export default function CinematicNarrative() {
  const cascadeRef = useRef<HTMLDivElement>(null);
  const featureGridRef = useRef<HTMLDivElement>(null);
  const sequenceRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    /* Story text observer */
    const textObs = new IntersectionObserver(
      entries => entries.forEach(e => { if (e.isIntersecting) e.target.classList.add('active'); }),
      { threshold: 0.3 },
    );
    document.querySelectorAll('.story-text').forEach(el => textObs.observe(el));

    /* Fade-in-up observer */
    const fadeObs = new IntersectionObserver(
      entries => entries.forEach(e => { if (e.isIntersecting) e.target.classList.add('visible'); }),
      { threshold: 0.1 },
    );
    document.querySelectorAll('.fade-in-up, .dashboard-viz, .ui-element').forEach(el => fadeObs.observe(el));

    /* Cascade words — staggered reveal */
    let cascadeStarted = false;
    const cascadeObs = new IntersectionObserver(entries => {
      if (entries[0]?.isIntersecting && !cascadeStarted) {
        cascadeStarted = true;
        cascadeRef.current?.querySelectorAll('.cascade-word').forEach((w, i) => {
          setTimeout(() => w.classList.add('visible'), i * 400);
        });
      }
    }, { threshold: 0.5 });
    if (cascadeRef.current) cascadeObs.observe(cascadeRef.current);

    /* Owner feature cards — staggered reveal */
    const featureObs = new IntersectionObserver(entries => {
      if (entries[0]?.isIntersecting) {
        featureGridRef.current?.querySelectorAll('.feature-card').forEach((c, i) => {
          setTimeout(() => c.classList.add('visible'), i * 200);
        });
        featureObs.disconnect();
      }
    }, { threshold: 0.2 });
    if (featureGridRef.current) featureObs.observe(featureGridRef.current);

    /* Advertiser sequence items — staggered */
    const seqObs = new IntersectionObserver(entries => {
      if (entries[0]?.isIntersecting) {
        sequenceRef.current?.querySelectorAll('.sequence-item').forEach((s, i) => {
          setTimeout(() => s.classList.add('visible'), i * 600);
        });
        seqObs.disconnect();
      }
    }, { threshold: 0.5 });
    if (sequenceRef.current) seqObs.observe(sequenceRef.current);

    return () => {
      textObs.disconnect();
      fadeObs.disconnect();
      cascadeObs.disconnect();
      featureObs.disconnect();
      seqObs.disconnect();
    };
  }, []);

  return (
    <>
      {/* ═══════════════ HERO NARRATIVE ═══════════════ */}
      <StorySlide>
        <StoryText active>Every screen is displaying something.</StoryText>
      </StorySlide>

      <StorySlide>
        <StoryText>But very few are earning what they should.</StoryText>
      </StorySlide>

      <StorySlide className="flex-col" sx={{ flexDirection: 'column' }}>
        <StoryText sx={{ mb: 2 }}>Every day,</StoryText>
        <StoryText sx={{ color: '#9ca3af', fontSize: { xs: '1.5rem', md: '3rem' } }}>
          millions of people<br />walk past digital screens.
        </StoryText>
      </StorySlide>

      <StorySlide className="flex-col" sx={{ flexDirection: 'column' }}>
        <StoryText sx={{ mb: 2 }}>Every day,</StoryText>
        <StoryText sx={{ color: '#9ca3af', fontSize: { xs: '1.5rem', md: '3rem' } }}>
          brands spend millions<br />trying to reach them.
        </StoryText>
      </StorySlide>

      <StorySlide>
        <StoryText>
          Yet the industry still runs...<br />
          <Box component="span" sx={{ color: '#6b7280' }}>like it's twenty years behind.</Box>
        </StoryText>
      </StorySlide>

      {/* ═══════════════ INDUSTRY REALITY CASCADE ═══════════════ */}
      <StorySlide sx={{ py: 16 }}>
        <Container maxWidth="sm" sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <Box ref={cascadeRef} className="cascade-container" sx={{ width: '100%', textAlign: 'center' }}>
            {CASCADE_WORDS.map(word => (
              <Typography key={word} className="cascade-word" sx={{ fontFamily: FONT, py: 1.5 }}>
                {word}
              </Typography>
            ))}
            <Typography className="cascade-word" sx={{ fontFamily: FONT, py: 1.5, color: '#f87171 !important', fontWeight: 500 }}>
              No Transparency
            </Typography>
          </Box>

          <Box sx={{ mt: 16 }} className="fade-in-up">
            <Typography sx={{
              fontFamily: FONT, fontWeight: 300,
              fontSize: { xs: '1.75rem', md: '3rem' },
              textAlign: 'center', lineHeight: 1.3,
            }}>
              Somewhere,<br />everyone is losing.
            </Typography>
          </Box>
        </Container>
      </StorySlide>

      {/* ═══════════════ SCREEN OWNER ARC ═══════════════ */}
      <StorySlide>
        <StoryText>If you own screens, you invested.</StoryText>
      </StorySlide>

      <StorySlide className="flex-col" sx={{ flexDirection: 'column', gap: 3 }}>
        <StoryText sx={{ color: '#9ca3af', fontSize: { xs: '1.5rem', md: '3rem' } }}>
          Into hardware.<br />Electricity.<br />Maintenance.<br />Operations.
        </StoryText>
      </StorySlide>

      <StorySlide>
        <StoryText>
          But getting campaigns...<br />
          <Box component="span" sx={{ color: '#6b7280', fontSize: { xs: '1.25rem', md: '1.875rem' } }}>
            still depends on someone else.
          </Box>
        </StoryText>
      </StorySlide>

      <StorySlide className="flex-col" sx={{ flexDirection: 'column', gap: 2 }}>
        <StoryText>You wait for agencies.</StoryText>
        <StoryText sx={{ color: '#9ca3af', fontSize: { xs: '1.25rem', md: '1.875rem' } }}>
          They negotiate. They take the commission.
        </StoryText>
      </StorySlide>

      {/* Black impact slide */}
      <StorySlide sx={{ bgcolor: 'rgba(0,0,0,0.85)', zIndex: 10 }}>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, textAlign: 'center' }}>
          <StoryText sx={{ fontSize: { xs: '2rem', md: '3.5rem' }, color: '#fff' }}>
            Empty screens don't lose impressions.
          </StoryText>
          <StoryText sx={{ fontSize: { xs: '2rem', md: '3.5rem' }, color: '#ef4444', fontWeight: 500 }}>
            They lose revenue.
          </StoryText>
        </Box>
      </StorySlide>

      {/* ═══════════════ SCREEN OWNER SOLUTION ═══════════════ */}
      <Box component="section" sx={{ minHeight: '100vh', py: 16, position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', zIndex: 1 }}>
        <Container maxWidth="lg" sx={{ mb: 16 }}>
          <Box sx={{ textAlign: 'center', mb: 8 }}>
            <StoryText>
              What if brands could book you directly?<br />
              <Box component="span" sx={{ color: '#9ca3af', fontSize: { xs: '1.25rem', md: '1.875rem' } }}>
                Without brokers. Without endless calls.
              </Box>
            </StoryText>
          </Box>

          {/* Dashboard mockup */}
          <Box className="dashboard-viz" sx={{ width: '100%', aspectRatio: '16/9', p: { xs: 3, md: 4 }, display: 'flex', flexDirection: 'column', gap: 3 }}>
            <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ borderBottom: '1px solid rgba(255,255,255,0.1)', pb: 2 }}>
              <Stack direction="row" alignItems="center" gap={2}>
                <DashboardRounded sx={{ color: ACCENT, fontSize: 24 }} />
                <Typography sx={{ fontFamily: FONT, fontWeight: 500, fontSize: '1.1rem' }}>PixelSpot Dashboard</Typography>
              </Stack>
              <Box sx={{ bgcolor: 'rgba(34,197,94,0.15)', color: '#4ade80', px: 1.5, py: 0.5, borderRadius: '100px', fontSize: '0.8rem', fontFamily: FONT }}>
                Live
              </Box>
            </Stack>

            <Grid container spacing={3} sx={{ flex: 1 }}>
              <Grid size={{ xs: 8 }}>
                <Box sx={{ height: '100%', bgcolor: 'rgba(255,255,255,0.04)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.04)', position: 'relative', overflow: 'hidden' }}>
                  <Box sx={{ position: 'absolute', inset: 0, background: `linear-gradient(135deg, ${ACCENT}33 0%, transparent 100%)`, opacity: 0.5 }} />
                  <Box sx={{ p: 3, position: 'relative' }}>
                    <Typography sx={{ fontFamily: FONT, fontSize: '0.85rem', color: '#9ca3af', mb: 1 }}>Monthly Revenue</Typography>
                    <Typography sx={{ fontFamily: FONT, fontSize: { xs: '1.5rem', md: '2.5rem' }, fontWeight: 300 }}>$12,450.00</Typography>
                  </Box>
                </Box>
              </Grid>
              <Grid size={{ xs: 4 }}>
                <Box sx={{ height: '100%', bgcolor: 'rgba(255,255,255,0.04)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.04)', p: 3, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2 }}>
                  <Typography sx={{ fontFamily: FONT, fontSize: '0.85rem', color: '#9ca3af' }}>Active Campaigns</Typography>
                  <Typography sx={{ fontFamily: FONT, fontSize: { xs: '2rem', md: '3rem' }, fontWeight: 300, color: ACCENT }}>14</Typography>
                </Box>
              </Grid>
            </Grid>
          </Box>
        </Container>
      </Box>

      {/* Owner Feature Cards */}
      <Box component="section" sx={{ py: 16, px: 2, position: 'relative', zIndex: 1 }}>
        <Container maxWidth="lg">
          <Grid container spacing={3} ref={featureGridRef}>
            {OWNER_FEATURES.map(f => (
              <Grid size={{ xs: 12, sm: 6, lg: 4 }} key={f.title}>
                <Box className="feature-card">
                  <f.icon sx={{ fontSize: 32, color: f.color, mb: 3 }} />
                  <Typography sx={{ fontFamily: FONT, fontWeight: 500, fontSize: '1.2rem', mb: 1 }}>
                    {f.title}
                  </Typography>
                  <Typography sx={{ fontFamily: FONT, color: '#9ca3af', fontSize: '0.95rem' }}>
                    {f.desc}
                  </Typography>
                </Box>
              </Grid>
            ))}
          </Grid>
        </Container>
      </Box>

      {/* ═══════════════ ADVERTISER ARC ═══════════════ */}
      <StorySlide>
        <StoryText>
          If you buy advertising...
          <br />
          <Box component="span" sx={{ color: '#9ca3af', fontSize: { xs: '1.25rem', md: '1.875rem' }, display: 'block', mt: 2 }}>
            You don't buy billboards. You buy attention.
          </Box>
        </StoryText>
      </StorySlide>

      {/* Advertiser questions sequence */}
      <Box component="section" className="story-section" ref={sequenceRef} sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', position: 'relative', p: { xs: 2, md: 4 }, zIndex: 1 }}>
        <StoryText sx={{ mb: 6 }}>
          Every agency says campaign completed. But...
        </StoryText>
        <Stack alignItems="center" gap={3} sx={{ mt: 4 }}>
          <Typography className="sequence-item" sx={{ fontFamily: FONT, fontSize: { xs: '1.25rem', md: '2rem' }, color: '#9ca3af', fontWeight: 300 }}>
            Did your ad actually play?
          </Typography>
          <Typography className="sequence-item" sx={{ fontFamily: FONT, fontSize: { xs: '1.25rem', md: '2rem' }, color: '#6b7280', fontWeight: 300 }}>
            Where? When? For how long?
          </Typography>
          <Typography className="sequence-item" sx={{ fontFamily: FONT, fontSize: { xs: '1.25rem', md: '2rem' }, color: '#4b5563', fontWeight: 300 }}>
            Did anyone actually see it?
          </Typography>
        </Stack>
      </Box>

      {/* Trust impact slide */}
      <StorySlide sx={{ bgcolor: 'rgba(0,0,0,0.85)', zIndex: 10 }}>
        <StoryText sx={{ color: '#9ca3af' }}>
          Advertising without proof isn't advertising.<br />
          <Box component="span" sx={{ color: '#fff', fontWeight: 500 }}>It's trust.</Box>
        </StoryText>
      </StorySlide>

      {/* ═══════════════ ADVERTISER SOLUTION ═══════════════ */}
      <Box component="section" sx={{ py: 16, position: 'relative', zIndex: 1 }}>
        <Container maxWidth="lg">
          {/* Header */}
          <Box sx={{ textAlign: 'center', mb: 16 }}>
            <Typography className="fade-in-up" sx={{
              fontFamily: FONT, fontWeight: 300,
              fontSize: { xs: '1.75rem', md: '3.5rem' },
              lineHeight: 1.3,
            }}>
              Imagine buying outdoor media<br />
              <Box component="span" sx={{ color: '#9ca3af' }}>the way you book a flight.</Box>
            </Typography>
          </Box>

          {/* Search & Book */}
          <Grid container spacing={8} alignItems="center" sx={{ mb: 20 }}>
            <Grid size={{ xs: 12, md: 6 }}>
              <Box className="fade-in-up">
                <Typography sx={{ fontFamily: FONT, color: ACCENT, fontSize: '0.8rem', fontWeight: 500, letterSpacing: '0.15em', textTransform: 'uppercase', mb: 2 }}>
                  Search & Book
                </Typography>
                <Typography sx={{ fontFamily: FONT, fontWeight: 300, fontSize: { xs: '1.75rem', md: '3rem' }, mb: 4 }}>
                  Find your audience. Instantly.
                </Typography>
                <Stack gap={2} sx={{ fontSize: '1.2rem', color: '#9ca3af', fontWeight: 300 }}>
                  <Typography sx={{ fontFamily: FONT, fontSize: 'inherit', color: 'inherit', fontWeight: 'inherit' }}>City. Area. Budget.</Typography>
                  <Typography sx={{ fontFamily: FONT, fontSize: 'inherit', color: 'inherit', fontWeight: 'inherit' }}>Audience. Availability. Book.</Typography>
                </Stack>
              </Box>
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <Box className="ui-element fade-in-up" sx={{ position: 'relative', overflow: 'hidden' }}>
                <Box sx={{ position: 'absolute', top: 16, right: 16 }}>
                  <SearchRounded sx={{ fontSize: 24, color: '#6b7280' }} />
                </Box>
                <Stack gap={2} sx={{ p: 2 }}>
                  <Box sx={{ height: 32, width: '75%', bgcolor: 'rgba(255,255,255,0.04)', borderRadius: '6px' }} />
                  <Box sx={{ height: 32, width: '50%', bgcolor: 'rgba(255,255,255,0.04)', borderRadius: '6px' }} />
                  <Box sx={{ height: 32, width: '100%', bgcolor: 'rgba(255,255,255,0.04)', borderRadius: '6px' }} />
                </Stack>
              </Box>
            </Grid>
          </Grid>

          {/* WebRTC Live Stream */}
          <Grid container spacing={8} alignItems="center" sx={{ mb: 20 }}>
            <Grid size={{ xs: 12, md: 6 }} sx={{ order: { xs: 2, md: 1 } }}>
              <Box className="ui-element fade-in-up" sx={{ position: 'relative', overflow: 'hidden' }}>
                <Stack direction="row" gap={1} sx={{ position: 'absolute', top: 16, right: 16, alignItems: 'center' }}>
                  <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: '#ef4444' }} className="animate-pulse" />
                  <Typography sx={{ fontFamily: FONT, fontSize: '0.7rem', color: '#ef4444', textTransform: 'uppercase', letterSpacing: '0.15em' }}>Live</Typography>
                </Stack>
                <Box sx={{ aspectRatio: '16/9', bgcolor: 'rgba(0,0,0,0.5)', borderRadius: '8px', mt: 5, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid rgba(255,255,255,0.04)' }}>
                  <PlayCircleOutlineRounded sx={{ fontSize: 48, color: '#4b5563' }} />
                </Box>
              </Box>
            </Grid>
            <Grid size={{ xs: 12, md: 6 }} sx={{ order: { xs: 1, md: 2 } }}>
              <Box className="fade-in-up">
                <Typography sx={{ fontFamily: FONT, color: ACCENT, fontSize: '0.8rem', fontWeight: 500, letterSpacing: '0.15em', textTransform: 'uppercase', mb: 2 }}>
                  WebRTC Live Stream
                </Typography>
                <Typography sx={{ fontFamily: FONT, fontWeight: 300, fontSize: { xs: '1.75rem', md: '3rem' }, mb: 4 }}>
                  See exactly where your campaign runs.
                </Typography>
                <Typography sx={{ fontFamily: FONT, fontSize: '1.2rem', color: '#9ca3af', fontWeight: 300 }}>
                  Watch the actual screen. Live.
                </Typography>
              </Box>
            </Grid>
          </Grid>

          {/* Proof & ROI */}
          <Grid container spacing={8} alignItems="center">
            <Grid size={{ xs: 12, md: 6 }}>
              <Box className="fade-in-up">
                <Typography sx={{ fontFamily: FONT, color: ACCENT, fontSize: '0.8rem', fontWeight: 500, letterSpacing: '0.15em', textTransform: 'uppercase', mb: 2 }}>
                  Proof & ROI
                </Typography>
                <Typography sx={{ fontFamily: FONT, fontWeight: 300, fontSize: { xs: '1.75rem', md: '3rem' }, mb: 4 }}>
                  Every impression verified.
                </Typography>
                <Stack gap={2} sx={{ fontSize: '1.2rem', color: '#9ca3af', fontWeight: 300 }}>
                  <Typography sx={{ fontFamily: FONT, fontSize: 'inherit', color: 'inherit', fontWeight: 'inherit' }}>Telemetry. Reports.</Typography>
                  <Typography sx={{ fontFamily: FONT, fontSize: 'inherit', color: 'inherit', fontWeight: 'inherit' }}>QR scans. Conversions.</Typography>
                </Stack>
              </Box>
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <Box className="ui-element fade-in-up">
                {/* Mini bar chart */}
                <Stack direction="row" alignItems="flex-end" gap={1} sx={{ height: 128, mb: 3 }}>
                  {[40, 60, 50, 80, 100, 70].map((h, i) => (
                    <Box key={i} sx={{
                      flex: 1,
                      height: `${h}%`,
                      bgcolor: i === 4 ? 'rgba(59,130,246,0.2)' : 'rgba(255,255,255,0.04)',
                      borderRadius: '4px 4px 0 0',
                    }} />
                  ))}
                </Stack>
                <Stack direction="row" justifyContent="space-between" sx={{ borderTop: '1px solid rgba(255,255,255,0.08)', pt: 2 }}>
                  <Box sx={{ textAlign: 'center' }}>
                    <Typography sx={{ fontFamily: FONT, fontSize: '1.5rem', color: '#fff' }}>1.2M</Typography>
                    <Typography sx={{ fontFamily: FONT, fontSize: '0.65rem', color: '#6b7280', textTransform: 'uppercase' }}>Verified Plays</Typography>
                  </Box>
                </Stack>
              </Box>
            </Grid>
          </Grid>
        </Container>
      </Box>
    </>
  );
}
