import { Box, Typography, Container, Grid, Stack, Avatar } from '@mui/material';
import ScreenShare from '@mui/icons-material/ScreenShare';
import SentimentSatisfiedAlt from '@mui/icons-material/SentimentSatisfiedAlt';
import ShowChart from '@mui/icons-material/ShowChart';
import Security from '@mui/icons-material/Security';

import { COLORS, FONTS, STATS, TESTIMONIALS } from './landingData';

interface SectionProps {
  themeMode: 'light' | 'dark';
}

const STAT_ICONS = [
  ScreenShare,
  SentimentSatisfiedAlt,
  ShowChart,
  Security,
];

export default function Testimonials({ themeMode }: SectionProps) {
  const c = COLORS[themeMode];

  return (
    <Box className="reveal-section" sx={{ py: { xs: 8, sm: 10, md: 14 }, bgcolor: c.bg, position: 'relative' }}>
      <Container maxWidth="lg">
        {/* --- Part A: Statistics Row --- */}
        <Grid container spacing={{ xs: 2, md: 3 }} sx={{ mb: { xs: 8, md: 14 } }}>
          {STATS.map((stat, idx) => {
            const Icon = STAT_ICONS[idx] || ScreenShare;
            return (
              <Grid size={{ xs: 6, md: 3 }} key={idx}>
                <Box
                  sx={{
                    p: { xs: 2, md: 3 },
                    borderRadius: '16px',
                    border: `1px solid ${c.border}`,
                    bgcolor: c.surfaceCard,
                    textAlign: 'center',
                    boxShadow: themeMode === 'light' ? '0 10px 20px rgba(0,0,0,0.02)' : 'none',
                  }}
                >
                  {/* Icon */}
                  <Box
                    sx={{
                      width: 40,
                      height: 40,
                      borderRadius: '10px',
                      bgcolor: 'rgba(99, 102, 241, 0.06)',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      mb: 2,
                      color: COLORS.primaryPurple,
                    }}
                  >
                    <Icon sx={{ fontSize: 20 }} />
                  </Box>
                  {/* Value & Label */}
                  <Typography
                    sx={{
                      fontFamily: FONTS.display,
                      fontWeight: 800,
                      fontSize: { xs: '20px', sm: '24px', md: '30px' },
                      color: COLORS.primaryPurple,
                      mb: 0.5,
                    }}
                  >
                    {stat.val}
                  </Typography>
                  <Typography sx={{ fontFamily: FONTS.body, color: c.text2, fontSize: { xs: '11px', md: '13px' }, fontWeight: 500 }}>
                    {stat.label}
                  </Typography>
                </Box>
              </Grid>
            );
          })}
        </Grid>

        {/* --- Part B: Testimonials --- */}
        <Box sx={{ textAlign: 'center', mb: { xs: 5, md: 8 } }}>
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
            Loved by businesses. Trusted every day.
          </Typography>
        </Box>

        {/* Testimonial Cards */}
        <Grid container spacing={{ xs: 2, md: 4 }}>
          {TESTIMONIALS.map((t, idx) => (
            <Grid size={{ xs: 12, md: 4 }} key={idx}>
              <Box
                className="glass-card"
                sx={{
                  p: { xs: 3, md: 4.5 },
                  height: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  borderRadius: '20px',
                  border: `1px solid ${c.border}`,
                  bgcolor: c.surfaceCard,
                  boxShadow: themeMode === 'light' ? '0 10px 25px rgba(0,0,0,0.03)' : '0 15px 35px rgba(0,0,0,0.3)',
                }}
              >
                {/* Quote Text */}
                <Typography
                  sx={{
                    fontFamily: FONTS.body,
                    color: c.text2,
                    fontSize: { xs: '13px', md: '14.5px' },
                    lineHeight: 1.6,
                    fontStyle: 'italic',
                    mb: 4,
                  }}
                >
                  &ldquo;{t.text}&rdquo;
                </Typography>

                {/* Profile Footer */}
                <Stack direction="row" alignItems="center" gap={2} sx={{ borderTop: `1px solid ${c.border}`, pt: 3 }}>
                  <Avatar
                    sx={{
                      bgcolor: COLORS.primaryPurple,
                      fontFamily: FONTS.display,
                      fontWeight: 700,
                      fontSize: '13px',
                      color: '#ffffff',
                      width: 38,
                      height: 38,
                    }}
                  >
                    {t.name.split(' ').map(n => n[0]).join('')}
                  </Avatar>
                  <Box>
                    <Typography sx={{ fontFamily: FONTS.body, fontWeight: 700, fontSize: '13.5px', color: c.text1 }}>
                      {t.name}
                    </Typography>
                    <Typography sx={{ fontFamily: FONTS.body, fontSize: '11px', color: c.text3 }}>
                      {t.role}
                    </Typography>
                  </Box>
                </Stack>
              </Box>
            </Grid>
          ))}
        </Grid>
      </Container>
    </Box>
  );
}
