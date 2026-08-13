import { useState } from 'react';
import { Box, Typography, Container, Stack, Button, IconButton, Accordion, AccordionSummary, AccordionDetails, Grid } from '@mui/material';
import ExpandMore from '@mui/icons-material/ExpandMore';
import Twitter from '@mui/icons-material/Twitter';
import LinkedIn from '@mui/icons-material/LinkedIn';
import Instagram from '@mui/icons-material/Instagram';
import Language from '@mui/icons-material/Language';

import { FAQS, COLORS, FONTS } from './landingData';
import { useNavigate } from 'react-router-dom';

interface SectionProps {
  themeMode: 'light' | 'dark';
}

/* ── Section 12: FAQ Accordion ─────────────────────────────── */
export function FAQ({ themeMode }: SectionProps) {
  const c = COLORS[themeMode];
  const [expanded, setExpanded] = useState<string | false>(false);

  const handleChange = (panel: string) => (_event: React.SyntheticEvent, isExpanded: boolean) => {
    setExpanded(isExpanded ? panel : false);
  };

  return (
    <Box className="reveal-section" sx={{ py: { xs: 8, sm: 10, md: 14 }, bgcolor: c.bg, position: 'relative' }}>
      <Container maxWidth="md">
        <Box sx={{ textAlign: 'center', mb: { xs: 5, md: 8 } }}>
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
            Got Questions?
          </Typography>
          <Typography
            variant="h2"
            sx={{
              fontFamily: FONTS.display,
              fontWeight: 800,
              fontSize: { xs: '26px', sm: '32px', md: '42px' },
              color: c.text1,
              mb: 2,
            }}
          >
            Frequently Asked Questions
          </Typography>
        </Box>

        <Box>
          {FAQS.map((faq, idx) => {
            const panelId = `panel-${idx}`;
            return (
              <Accordion
                key={idx}
                expanded={expanded === panelId}
                onChange={handleChange(panelId)}
                className={`faq-accordion ${expanded === panelId ? 'faq-accordion-expanded' : ''}`}
                sx={{
                  bgcolor: c.surfaceCard,
                  border: `1px solid ${c.border}`,
                  borderRadius: '12px !important',
                  mb: 2,
                  boxShadow: 'none',
                  '&:before': { display: 'none' },
                  transition: 'border-color 0.3s ease',
                  '&:hover': { borderColor: 'var(--border-focus)' },
                }}
              >
                <AccordionSummary
                  expandIcon={<ExpandMore sx={{ color: c.text2 }} />}
                  sx={{ px: { xs: 2, md: 3 }, py: 1.5 }}
                >
                  <Typography
                    sx={{
                      fontFamily: FONTS.display,
                      fontWeight: 700,
                      fontSize: { xs: '14px', md: '15px' },
                      color: expanded === panelId ? COLORS.primaryPurple : c.text1,
                    }}
                  >
                    {faq.q}
                  </Typography>
                </AccordionSummary>
                <AccordionDetails sx={{ px: { xs: 2, md: 3 }, pb: 3, pt: 0 }}>
                  <Typography sx={{ fontFamily: FONTS.body, color: c.text2, fontSize: '13.5px', lineHeight: 1.6 }}>
                    {faq.a}
                  </Typography>
                </AccordionDetails>
              </Accordion>
            );
          })}
        </Box>
      </Container>
    </Box>
  );
}

/* ── Section 13: Massive CTA ────────────────────────────────── */
export function FinalCta({ themeMode }: SectionProps) {
  const c = COLORS[themeMode];
  const navigate = useNavigate();

  return (
    <Box className="reveal-section" sx={{ py: { xs: 8, sm: 10, md: 14 }, bgcolor: c.bg, position: 'relative', overflow: 'hidden' }}>
      {/* Gradient Background Glow */}
      <Box className="cta-gradient-bg" />

      <Container maxWidth="md" sx={{ textAlign: 'center', position: 'relative', zIndex: 10 }}>
        {/* Free badge */}
        <Box sx={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 1,
          bgcolor: 'rgba(34, 197, 94, 0.06)',
          border: '1px solid rgba(34, 197, 94, 0.2)',
          borderRadius: '100px',
          px: 2.5,
          py: 0.75,
          mb: 4,
        }}
          className="free-badge"
        >
          <Box className="pulse-dot" sx={{ bgcolor: COLORS.success, width: 6, height: 6 }} />
          <Typography sx={{ fontFamily: FONTS.mono, fontSize: '11px', color: COLORS.success, fontWeight: 700 }}>
            Free for Everyone — No Credit Card Required
          </Typography>
        </Box>

        <Typography
          variant="h2"
          sx={{
            fontFamily: FONTS.display,
            fontWeight: 800,
            fontSize: { xs: '28px', sm: '36px', md: '48px' },
            lineHeight: 1.2,
            mb: 2.5,
            color: c.text1,
          }}
        >
          Ready to turn your screens into<br />impact and revenue?
        </Typography>
        <Typography
          sx={{
            fontFamily: FONTS.body,
            color: c.text2,
            fontSize: { xs: '14px', sm: '15px', md: '17px' },
            mb: 5,
            lineHeight: 1.6,
          }}
        >
          Join thousands of businesses already growing with PixelSpot. Get started in under 2 minutes — completely free.
        </Typography>

        {/* Buttons */}
        <Stack direction={{ xs: 'column', sm: 'row' }} gap={2} justifyContent="center" alignItems="center">
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
              '&:hover': {
                borderColor: c.text2,
                bgcolor: 'rgba(255, 255, 255, 0.02)',
              },
            }}
          >
            Explore Screens
          </Button>
        </Stack>
      </Container>
    </Box>
  );
}

/* ── Footer ─────────────────────────────────────────────────── */
export function LandingFooter({ themeMode }: SectionProps) {
  const c = COLORS[themeMode];

  const cols = [
    {
      title: 'Product',
      links: ['Features', 'Solutions', 'Integrations', 'API Docs'],
    },
    {
      title: 'Resources',
      links: ['Documentation', 'Blog', 'Help Center', 'Webinars'],
    },
    {
      title: 'Company',
      links: ['About Us', 'Careers', 'Contact Us', 'Partners'],
    },
    {
      title: 'Legal',
      links: ['Privacy Policy', 'Terms of Service', 'Security'],
    },
  ];

  return (
    <Box component="footer" sx={{ bgcolor: c.bg, borderTop: `1px solid ${c.border}`, pt: { xs: 6, md: 10 }, pb: 6 }}>
      <Container maxWidth="lg">
        <Grid container spacing={4} sx={{ mb: { xs: 6, md: 8 } }}>
          {/* Brand Info */}
          <Grid size={{ xs: 12, md: 4 }}>
            <Stack direction="row" alignItems="center" gap={1.5} mb={2.5}>
              <Box sx={{
                width: 32,
                height: 32,
                borderRadius: '8px',
                background: `linear-gradient(135deg, ${COLORS.primaryPurple}, ${COLORS.primaryPurpleHover})`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontFamily: FONTS.display,
                fontWeight: 800,
                fontSize: '14px',
                color: '#fff',
              }}>
                P
              </Box>
              <Typography sx={{ fontFamily: FONTS.display, fontWeight: 800, fontSize: '18px', color: c.text1 }}>
                PixelSpot
              </Typography>
            </Stack>
            <Typography sx={{ fontFamily: FONTS.body, color: c.text2, fontSize: '14px', lineHeight: 1.6, mb: 3, maxWidth: 280 }}>
              The free, all-in-one digital signage CMS to manage, automate and monetize your screen network.
            </Typography>
            {/* Social Icons */}
            <Stack direction="row" gap={1.5}>
              {[Twitter, LinkedIn, Instagram].map((Icon, idx) => (
                <IconButton key={idx} size="small" sx={{ color: c.text3, '&:hover': { color: c.text1, bgcolor: 'rgba(255,255,255,0.03)' } }}>
                  <Icon sx={{ fontSize: 18 }} />
                </IconButton>
              ))}
            </Stack>
          </Grid>

          {/* Links Columns */}
          {cols.map(col => (
            <Grid size={{ xs: 6, sm: 3, md: 2 }} key={col.title}>
              <Typography sx={{ fontFamily: FONTS.display, fontWeight: 700, fontSize: '14px', color: c.text1, mb: 2.5 }}>
                {col.title}
              </Typography>
              <Stack gap={1.5}>
                {col.links.map(l => (
                  <Typography
                    key={l}
                    component="a"
                    href="#"
                    className="footer-link"
                    sx={{ fontFamily: FONTS.body, fontSize: '13px' }}
                  >
                    {l}
                  </Typography>
                ))}
              </Stack>
            </Grid>
          ))}
        </Grid>

        {/* Bottom row */}
        <Box sx={{ borderTop: `1px solid ${c.border}`, pt: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2 }}>
          <Typography sx={{ fontFamily: FONTS.body, fontSize: '13px', color: c.text3 }}>
            © 2026 PixelSpot. All rights reserved.
          </Typography>

          {/* Language Selector Dropdown Mockup */}
          <Stack direction="row" alignItems="center" gap={0.5} sx={{ cursor: 'pointer', color: c.text3, '&:hover': { color: c.text1 } }}>
            <Language sx={{ fontSize: 16 }} />
            <Typography sx={{ fontFamily: FONTS.body, fontSize: '13px', fontWeight: 500 }}>
              English
            </Typography>
            <ExpandMore sx={{ fontSize: 16 }} />
          </Stack>
        </Box>
      </Container>
    </Box>
  );
}
