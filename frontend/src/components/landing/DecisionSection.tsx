import { Box, Container, Typography, Grid, Stack } from '@mui/material';
import MonitorRounded from '@mui/icons-material/MonitorRounded';
import CampaignRounded from '@mui/icons-material/CampaignRounded';
import ArrowForwardRounded from '@mui/icons-material/ArrowForwardRounded';
import { useNavigate } from 'react-router-dom';

const FONT = "'Inter', system-ui, sans-serif";

/* ── Decision Card ───────────────────────────────────────── */
function DecisionCard({ icon: Icon, title, subtitle, cta, onClick, delay = 0 }: {
  icon: typeof MonitorRounded;
  title: string;
  subtitle: string;
  cta: string;
  onClick: () => void;
  delay?: number;
}) {
  return (
    <Box
      className="decision-card fade-in-up"
      onClick={onClick}
      sx={{ transitionDelay: `${delay}ms` }}
    >
      <Box sx={{
        mb: 4,
        p: 2,
        bgcolor: 'rgba(255,255,255,0.04)',
        borderRadius: '16px',
        width: 64,
        height: 64,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        transition: 'transform 0.5s ease',
        '.decision-card:hover &': { transform: 'scale(1.1)' },
      }}>
        <Icon sx={{ fontSize: 28, color: '#d1d5db' }} />
      </Box>
      <Typography sx={{ fontFamily: FONT, fontWeight: 500, fontSize: { xs: '1.5rem', md: '1.85rem' }, mb: 2, color: '#fff' }}>
        {title}
      </Typography>
      <Typography sx={{ fontFamily: FONT, color: '#9ca3af', fontSize: '1.1rem', mb: 4 }}>
        {subtitle}
      </Typography>
      <Stack direction="row" alignItems="center" gap={1} sx={{
        fontFamily: FONT,
        fontSize: '0.85rem',
        fontWeight: 500,
        letterSpacing: '0.08em',
        textTransform: 'uppercase',
        color: '#6b7280',
        transition: 'color 0.3s ease',
        '.decision-card:hover &': { color: '#fff' },
      }}>
        <span>{cta}</span>
        <ArrowForwardRounded sx={{
          fontSize: 18,
          transition: 'transform 0.3s ease',
          '.decision-card:hover &': { transform: 'translateX(8px)' },
        }} />
      </Stack>
    </Box>
  );
}

/* ══════════════════════════════════════════════════════════ */
export default function DecisionSection() {
  const navigate = useNavigate();

  return (
    <>
      {/* PixelSpot Brand Reveal */}
      <Box component="section" className="story-section" sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
        zIndex: 1,
        p: { xs: 2, md: 4 },
      }}>
        <Container maxWidth="md" sx={{ textAlign: 'center' }}>
          <Box className="fade-in-up">
            <Typography sx={{
              fontFamily: FONT,
              fontWeight: 700,
              fontSize: { xs: '2.5rem', md: '4.5rem' },
              letterSpacing: '-0.02em',
              mb: 4,
              background: 'linear-gradient(180deg, #ffffff 0%, #6b7280 100%)',
              backgroundClip: 'text',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}>
              PixelSpot
            </Typography>
            <Typography sx={{
              fontFamily: FONT,
              fontWeight: 300,
              fontSize: { xs: '1.5rem', md: '2.25rem' },
              color: '#d1d5db',
              mb: 8,
              lineHeight: 1.4,
            }}>
              The Operating System<br />
              for Digital Out-of-Home Advertising.
            </Typography>
            <Typography sx={{ fontFamily: FONT, fontSize: { xs: '1rem', md: '1.25rem' }, color: '#9ca3af', fontWeight: 300 }}>
              One platform. For screen owners. For advertisers.
            </Typography>
          </Box>
        </Container>
      </Box>

      {/* Decision Point */}
      <Box component="section" sx={{
        minHeight: '100vh',
        py: { xs: 10, md: 12 },
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
        zIndex: 1,
        bgcolor: 'rgba(0,0,0,0.9)',
        backdropFilter: 'blur(12px)',
      }}>
        <Container maxWidth="lg">
          <Box sx={{ textAlign: 'center', mb: { xs: 8, md: 10 } }} className="fade-in-up">
            <Typography sx={{ fontFamily: FONT, fontWeight: 300, fontSize: { xs: '1.75rem', md: '3rem' }, mb: 2 }}>
              Ready to change the way you work?
            </Typography>
            <Typography sx={{ fontFamily: FONT, color: '#9ca3af', fontSize: '1rem' }}>
              Choose your path.
            </Typography>
          </Box>

          <Grid container spacing={4}>
            <Grid size={{ xs: 12, md: 6 }}>
              <DecisionCard
                icon={MonitorRounded}
                title="I own digital screens"
                subtitle="Monetize. Manage. Grow."
                cta="See Platform"
                onClick={() => navigate('/register')}
                delay={100}
              />
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <DecisionCard
                icon={CampaignRounded}
                title="I buy advertising"
                subtitle="Reach. Measure. Verify."
                cta="Explore Network"
                onClick={() => navigate('/register')}
                delay={200}
              />
            </Grid>
          </Grid>
        </Container>
      </Box>

      {/* Minimal Footer */}
      <Box component="footer" className="cinematic-footer" sx={{ position: 'relative', zIndex: 1, bgcolor: 'var(--bg-color)' }}>
        <Container maxWidth="lg">
          <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" alignItems="center" gap={2}>
            <Typography sx={{ fontFamily: FONT, fontSize: '0.8rem', color: '#6b7280' }}>
              © 2026 PixelSpot. All rights reserved.
            </Typography>
            <Stack direction="row" gap={3}>
              <Typography component="a" href="/privacy" sx={{ fontFamily: FONT, fontSize: '0.8rem' }}>Privacy</Typography>
              <Typography component="a" href="/terms" sx={{ fontFamily: FONT, fontSize: '0.8rem' }}>Terms</Typography>
              <Typography component="a" href="/contact" sx={{ fontFamily: FONT, fontSize: '0.8rem' }}>Contact</Typography>
            </Stack>
          </Stack>
        </Container>
      </Box>
    </>
  );
}
