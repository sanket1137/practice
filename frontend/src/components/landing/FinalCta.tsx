import { useState, useCallback } from 'react';
import { Box, Typography, Container, Stack, Button, IconButton } from '@mui/material';
import TwitterIcon from '@mui/icons-material/Twitter';
import LinkedInIcon from '@mui/icons-material/LinkedIn';
import InstagramIcon from '@mui/icons-material/Instagram';
import { COLORS, FONTS } from './landingData';

/* ── Confetti Burst ───────────────────────────────────────── */
function Confetti({ active }: { active: boolean }) {
  if (!active) return null;
  const pieces = Array.from({ length: 20 }).map((_, i) => ({
    color: [COLORS.indigo, COLORS.pink, COLORS.cyan, COLORS.green, COLORS.amber][i % 5],
    x: `${(Math.random() - 0.5) * 300}px`,
    delay: `${Math.random() * 0.3}s`,
    dur: `${0.8 + Math.random() * 0.5}s`,
  }));
  return (
    <Box sx={{ position: 'absolute', top: '50%', left: '50%', pointerEvents: 'none', zIndex: 10 }}>
      {pieces.map((p, i) => (
        <Box key={i} sx={{
          position: 'absolute', width: 8, height: 8, borderRadius: '2px', bgcolor: p.color,
          animation: `confettiFall ${p.dur} ease-out ${p.delay} forwards`,
          '--x': p.x,
        } as React.CSSProperties} />
      ))}
    </Box>
  );
}

/* ── Final CTA ────────────────────────────────────────────── */
export function FinalCta() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [confetti, setConfetti] = useState(false);

  const handleSubmit = useCallback(() => {
    if (!email.trim()) return;
    setConfetti(true);
    setSent(true);
    setTimeout(() => setConfetti(false), 2000);
  }, [email]);

  return (
    <Box sx={{ position: 'relative', overflow: 'hidden', py: { xs: 10, md: 14 } }}>
      {/* Rotating gradient background */}
      <Box sx={{ position: 'absolute', inset: 0, zIndex: 0 }}>
        <Box sx={{ position: 'absolute', top: '50%', left: '50%', width: '150%', height: '150%', transform: 'translate(-50%, -50%)', background: `conic-gradient(from 0deg, ${COLORS.indigo}15, ${COLORS.pink}10, ${COLORS.cyan}08, ${COLORS.indigo}15)`, animation: 'rotate 20s linear infinite', opacity: 0.5 }} />
        <Box sx={{ position: 'absolute', top: '30%', left: '20%', width: 300, height: 300, borderRadius: '50%', bgcolor: `${COLORS.indigo}10`, filter: 'blur(80px)', animation: 'drift 15s ease-in-out infinite' }} />
        <Box sx={{ position: 'absolute', bottom: '20%', right: '20%', width: 200, height: 200, borderRadius: '50%', bgcolor: `${COLORS.pink}10`, filter: 'blur(60px)', animation: 'drift 12s ease-in-out infinite reverse' }} />
      </Box>

      <Container maxWidth="sm" sx={{ position: 'relative', zIndex: 5, textAlign: 'center' }}>
        <Typography sx={{ fontFamily: FONTS.display, fontWeight: 800, fontSize: { xs: '32px', md: '48px' }, color: COLORS.text1, lineHeight: 1.15, mb: 2 }}>
          Ready to turn screens into revenue?
        </Typography>
        <Typography sx={{ fontFamily: FONTS.body, color: COLORS.text2, fontSize: '16px', mb: 4, lineHeight: 1.6 }}>
          Join 500+ screen owners and 200+ advertisers already on PixelSpot. Get started for free — no credit card required.
        </Typography>

        {sent ? (
          <Box sx={{ animation: 'successPop 0.4s cubic-bezier(0.34,1.56,0.64,1)' }}>
            <Typography sx={{ fontFamily: FONTS.display, fontWeight: 700, color: COLORS.green, fontSize: '20px' }}>🎉 You&apos;re in!</Typography>
            <Typography sx={{ fontFamily: FONTS.body, color: COLORS.text2, fontSize: '14px', mt: 1 }}>Check your inbox for next steps.</Typography>
          </Box>
        ) : (
          <Box sx={{ position: 'relative' }}>
            <Stack direction={{ xs: 'column', sm: 'row' }} gap={1.5} justifyContent="center">
              <Box component="input" value={email} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEmail(e.target.value)}
                placeholder="name@company.com" type="email"
                sx={{
                  flex: 1, maxWidth: 360, bgcolor: COLORS.surface, border: `1px solid ${COLORS.border}`,
                  borderRadius: '12px', px: 2.5, py: 1.5, fontFamily: FONTS.body, fontSize: '14px',
                  color: COLORS.text1, outline: 'none',
                  '&:focus': { borderColor: COLORS.indigo, boxShadow: `0 0 0 3px ${COLORS.indigoGlow}` },
                  '&::placeholder': { color: COLORS.text3 },
                }}
              />
              <Button variant="contained" onClick={handleSubmit}
                sx={{
                  fontFamily: FONTS.body, bgcolor: COLORS.indigo, textTransform: 'none', fontSize: '14px',
                  borderRadius: '12px', px: 3, py: 1.5, fontWeight: 600,
                  '&:hover': { bgcolor: '#5558e6' },
                }}>
                Get Early Access →
              </Button>
            </Stack>
            <Confetti active={confetti} />
          </Box>
        )}

        <Stack direction="row" justifyContent="center" gap={3} mt={3}>
          {['No credit card', 'Free forever plan', 'Cancel anytime'].map(t => (
            <Typography key={t} sx={{ fontFamily: FONTS.body, fontSize: '12px', color: COLORS.text3 }}>✓ {t}</Typography>
          ))}
        </Stack>
      </Container>
    </Box>
  );
}

/* ── Footer ───────────────────────────────────────────────── */
export function LandingFooter() {
  const cols = [
    { title: 'Product', links: ['Features', 'Pricing', 'Screen Map', 'API Docs'] },
    { title: 'Company', links: ['About', 'Blog', 'Careers', 'Contact'] },
    { title: 'Legal', links: ['Privacy Policy', 'Terms of Service', 'Cookie Policy'] },
  ];

  return (
    <Box component="footer" sx={{ bgcolor: COLORS.surface, borderTop: `1px solid ${COLORS.border}`, py: 6 }}>
      <Container maxWidth="lg">
        <Stack direction={{ xs: 'column', md: 'row' }} gap={6} mb={5}>
          {/* Brand */}
          <Box sx={{ flex: 1.2 }}>
            <Stack direction="row" alignItems="center" gap={1.5} mb={2}>
              <Box sx={{ width: 32, height: 32, borderRadius: 1, bgcolor: COLORS.indigo, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: FONTS.display, fontWeight: 800, fontSize: '14px', color: '#fff' }}>P</Box>
              <Typography sx={{ fontFamily: FONTS.display, fontWeight: 700, fontSize: '18px', color: COLORS.text1 }}>PixelSpot</Typography>
            </Stack>
            <Typography sx={{ fontFamily: FONTS.body, color: COLORS.text3, fontSize: '14px', lineHeight: 1.6, maxWidth: 260 }}>
              India&apos;s first slot-based Digital Out-of-Home advertising marketplace.
            </Typography>
            <Stack direction="row" gap={1} mt={2}>
              {[TwitterIcon, LinkedInIcon, InstagramIcon].map((Icon, i) => (
                <IconButton key={i} size="small" sx={{ color: COLORS.text3, '&:hover': { color: COLORS.text1, bgcolor: 'rgba(255,255,255,0.05)' } }}>
                  <Icon sx={{ fontSize: 18 }} />
                </IconButton>
              ))}
            </Stack>
          </Box>

          {cols.map(col => (
            <Box key={col.title} sx={{ flex: 1 }}>
              <Typography sx={{ fontFamily: FONTS.body, fontWeight: 600, fontSize: '14px', color: COLORS.text1, mb: 2 }}>{col.title}</Typography>
              <Stack gap={1.5}>
                {col.links.map(l => (
                  <Typography key={l} component="a" href="#" sx={{
                    fontFamily: FONTS.body, fontSize: '13px', color: COLORS.text3, textDecoration: 'none',
                    transition: 'color 200ms', '&:hover': { color: COLORS.text2 },
                  }}>{l}</Typography>
                ))}
              </Stack>
            </Box>
          ))}
        </Stack>

        <Box sx={{ borderTop: `1px solid ${COLORS.border}`, pt: 3, display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 1 }}>
          <Typography sx={{ fontFamily: FONTS.body, fontSize: '12px', color: COLORS.text3 }}>
            © 2025 PixelSpot Technologies Pvt. Ltd. All rights reserved.
          </Typography>
          <Typography sx={{ fontFamily: FONTS.body, fontSize: '12px', color: COLORS.text3 }}>
            Made with ❤️ in India <Box component="span" className="flag-wave">🇮🇳</Box>
          </Typography>
        </Box>
      </Container>
    </Box>
  );
}
