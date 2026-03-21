import { useState } from 'react';
import { Box, Typography, Container, Stack, Button } from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import { COLORS, FONTS, OWNER_PLANS } from './landingData';

const ADVERTISER_PLANS = [
  {
    name: 'Starter',
    price: '₹0',
    period: '/month',
    desc: 'Try your first campaign for free.',
    features: ['1 active campaign', 'Up to 5 screens', 'Basic targeting', 'Standard support'],
    featured: false,
    cta: 'Get Started',
  },
  {
    name: 'Growth',
    price: '₹2,999',
    period: '/month',
    desc: 'Scale with advanced targeting.',
    features: ['10 active campaigns', 'Unlimited screens', 'Advanced targeting', 'Analytics dashboard', 'Priority support'],
    featured: true,
    cta: 'Start Free Trial →',
  },
  {
    name: 'Agency',
    price: 'Custom',
    period: '',
    desc: 'For agencies managing multiple brands.',
    features: ['Unlimited campaigns', 'Bulk booking discounts', 'Team management', 'API access'],
    featured: false,
    cta: 'Contact Sales',
  },
];

export default function Pricing() {
  const [tab, setTab] = useState<'owners' | 'advertisers'>('owners');
  const plans = tab === 'owners' ? OWNER_PLANS : ADVERTISER_PLANS;

  return (
    <Box className="reveal-section" id="pricing" sx={{ bgcolor: COLORS.bg, py: { xs: 8, md: 12 } }}>
      <Container maxWidth="lg">
        <Box sx={{ textAlign: 'center', mb: 5 }}>
          <Typography sx={{ fontFamily: FONTS.body, color: COLORS.indigo, fontSize: '13px', letterSpacing: '0.1em', textTransform: 'uppercase', mb: 1 }}>
            Pricing
          </Typography>
          <Typography sx={{ fontFamily: FONTS.display, color: COLORS.text1, fontSize: { xs: '28px', md: '40px' }, fontWeight: 800 }}>
            Simple, transparent pricing
          </Typography>
        </Box>

        {/* Tab switcher */}
        <Stack direction="row" justifyContent="center" mb={5}>
          <Box sx={{ bgcolor: COLORS.surface, borderRadius: '12px', p: 0.5, display: 'inline-flex', border: `1px solid ${COLORS.border}` }}>
            {(['owners', 'advertisers'] as const).map(t => (
              <Button key={t} onClick={() => setTab(t)}
                sx={{
                  fontFamily: FONTS.body, textTransform: 'capitalize', fontSize: '14px', px: 3, py: 1, borderRadius: '10px',
                  color: tab === t ? COLORS.text1 : COLORS.text3,
                  bgcolor: tab === t ? COLORS.indigo : 'transparent',
                  '&:hover': { bgcolor: tab === t ? COLORS.indigo : 'rgba(255,255,255,0.05)' },
                  transition: 'all 200ms',
                }}>
                {t === 'owners' ? 'Screen Owners' : 'Advertisers'}
              </Button>
            ))}
          </Box>
        </Stack>

        <Stack direction={{ xs: 'column', md: 'row' }} gap={3} alignItems="stretch">
          {plans.map(plan => (
            <Box key={plan.name} sx={{
              flex: 1, bgcolor: COLORS.surface, borderRadius: '16px', p: 3.5, position: 'relative',
              border: `1px solid ${plan.featured ? COLORS.indigo : COLORS.border}`,
              transition: 'all 300ms', '&:hover': { transform: 'translateY(-4px)', boxShadow: `0 20px 50px rgba(0,0,0,0.3)` },
            }}>
              {plan.featured && (
                <Box sx={{
                  position: 'absolute', top: -12, left: '50%', transform: 'translateX(-50%)',
                  bgcolor: COLORS.indigo, borderRadius: '100px', px: 2, py: 0.5,
                  fontFamily: FONTS.mono, fontSize: '11px', color: '#fff', whiteSpace: 'nowrap',
                  animation: 'badgeWiggle 2s ease-in-out infinite',
                }}>
                  Most Popular
                </Box>
              )}
              <Typography sx={{ fontFamily: FONTS.display, fontWeight: 700, fontSize: '20px', color: COLORS.text1, mb: 0.5 }}>{plan.name}</Typography>
              <Stack direction="row" alignItems="baseline" gap={0.5} mb={1}>
                <Typography sx={{ fontFamily: FONTS.display, fontWeight: 800, fontSize: '36px', color: COLORS.text1 }}>{plan.price}</Typography>
                {plan.period && (
                  <Typography sx={{ fontFamily: FONTS.body, color: COLORS.text3, fontSize: '14px' }}>{plan.period}</Typography>
                )}
              </Stack>
              <Typography sx={{ fontFamily: FONTS.body, color: COLORS.text2, fontSize: '14px', mb: 2.5, lineHeight: 1.5 }}>{plan.desc}</Typography>
              <Stack gap={1.5} mb={3}>
                {plan.features.map(f => (
                  <Stack key={f} direction="row" alignItems="center" gap={1}>
                    <CheckCircleIcon sx={{ fontSize: 16, color: COLORS.green }} />
                    <Typography sx={{ fontFamily: FONTS.body, fontSize: '13px', color: COLORS.text2 }}>{f}</Typography>
                  </Stack>
                ))}
              </Stack>
              <Button fullWidth variant={plan.featured ? 'contained' : 'outlined'}
                sx={{
                  fontFamily: FONTS.body, textTransform: 'none', fontSize: '14px', borderRadius: '10px', py: 1.2,
                  ...(plan.featured
                    ? { bgcolor: COLORS.indigo, '&:hover': { bgcolor: '#5558e6' } }
                    : { borderColor: COLORS.border, color: COLORS.text2, '&:hover': { borderColor: COLORS.text3, bgcolor: 'rgba(255,255,255,0.03)' } }),
                }}>
                {plan.cta}
              </Button>
            </Box>
          ))}
        </Stack>
      </Container>
    </Box>
  );
}
