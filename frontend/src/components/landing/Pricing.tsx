import { Box, Typography, Container, Grid, Button, Stack } from '@mui/material';
import CheckCircle from '@mui/icons-material/CheckCircle';
import { PRICING_PLANS, COLORS, FONTS } from './landingData';

interface SectionProps {
  themeMode: 'light' | 'dark';
}

export default function Pricing({ themeMode }: SectionProps) {
  const c = COLORS[themeMode];

  return (
    <Box className="reveal-section" sx={{ py: { xs: 10, md: 14 }, bgcolor: c.bg, position: 'relative', overflow: 'hidden' }}>
      <Container maxWidth="lg" sx={{ position: 'relative', zIndex: 10 }}>
        {/* Section Header */}
        <Box sx={{ textAlign: 'center', mb: { xs: 8, md: 10 } }}>
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
            Simple Pricing
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
            Sized for any network size
          </Typography>
        </Box>

        {/* Pricing Cards Grid */}
        <Grid container spacing={4} alignItems="stretch" justifyContent="center">
          {PRICING_PLANS.map((plan, idx) => (
            <Grid size={{ xs: 12, md: 4 }} key={idx}>
              <Box
                className="glass-card"
                sx={{
                  p: { xs: 4, md: 5 },
                  height: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  borderRadius: '24px',
                  border: plan.featured ? `2px solid ${COLORS.primaryPurple}` : `1px solid ${c.border}`,
                  position: 'relative',
                  overflow: 'hidden',
                  background: plan.featured
                    ? (themeMode === 'light' ? 'rgba(99, 102, 241, 0.03)' : 'rgba(15, 23, 42, 0.95)')
                    : c.surfaceCard,
                  boxShadow: plan.featured
                    ? `0 20px 50px rgba(99, 102, 241, 0.15)`
                    : 'none',
                }}
              >
                {/* Featured Badge */}
                {plan.featured && (
                  <Box
                    sx={{
                      position: 'absolute',
                      top: 16,
                      right: 16,
                      bgcolor: COLORS.primaryPurple,
                      color: '#ffffff',
                      fontSize: '10px',
                      fontFamily: FONTS.mono,
                      fontWeight: 700,
                      borderRadius: '100px',
                      px: 2,
                      py: 0.5,
                      textTransform: 'uppercase',
                    }}
                  >
                    POPULAR
                  </Box>
                )}

                <Box>
                  {/* Plan Name */}
                  <Typography
                    sx={{
                      fontFamily: FONTS.display,
                      fontWeight: 800,
                      fontSize: '20px',
                      color: plan.featured ? COLORS.primaryPurple : c.text1,
                      mb: 2,
                    }}
                  >
                    {plan.name}
                  </Typography>

                  {/* Price */}
                  <Stack direction="row" alignItems="baseline" gap={1} mb={2.5}>
                    <Typography
                      sx={{
                        fontFamily: FONTS.display,
                        fontWeight: 800,
                        fontSize: { xs: '38px', md: '44px' },
                        color: c.text1,
                      }}
                    >
                      {plan.price}
                    </Typography>
                    {plan.period && (
                      <Typography sx={{ fontFamily: FONTS.body, color: c.text3, fontSize: '14px' }}>
                        / {plan.period}
                      </Typography>
                    )}
                  </Stack>

                  {/* Plan Description */}
                  <Typography sx={{ fontFamily: FONTS.body, color: c.text2, fontSize: '14px', lineHeight: 1.5, mb: 4 }}>
                    {plan.desc}
                  </Typography>

                  {/* Divider */}
                  <Box sx={{ borderBottom: `1px solid ${c.border}`, mb: 4 }} />

                  {/* Plan Features */}
                  <Stack gap={2} mb={5}>
                    {plan.features.map((feat, fidx) => (
                      <Box key={fidx} sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                        <CheckCircle sx={{ color: plan.featured ? COLORS.primaryPurple : COLORS.success, fontSize: 18, flexShrink: 0 }} />
                        <Typography sx={{ fontFamily: FONTS.body, color: c.text2, fontSize: '13.5px' }}>
                          {feat}
                        </Typography>
                      </Box>
                    ))}
                  </Stack>
                </Box>

                {/* Plan CTA */}
                <Button
                  variant={plan.featured ? 'contained' : 'outlined'}
                  fullWidth
                  sx={{
                    fontFamily: FONTS.body,
                    bgcolor: plan.featured ? COLORS.primaryPurple : 'transparent',
                    color: plan.featured ? '#ffffff' : c.text1,
                    borderColor: plan.featured ? 'transparent' : c.border,
                    textTransform: 'none',
                    fontSize: '14px',
                    fontWeight: 700,
                    borderRadius: '12px',
                    py: 1.5,
                    '&:hover': {
                      bgcolor: plan.featured ? COLORS.primaryPurpleHover : 'rgba(255, 255, 255, 0.02)',
                      borderColor: plan.featured ? 'transparent' : c.text2,
                    },
                    transition: 'all 0.2s ease',
                  }}
                >
                  {plan.cta}
                </Button>
              </Box>
            </Grid>
          ))}
        </Grid>
      </Container>
    </Box>
  );
}
