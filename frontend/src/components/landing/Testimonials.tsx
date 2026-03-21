import { Box, Typography, Container, Stack } from '@mui/material';
import StarIcon from '@mui/icons-material/Star';
import { COLORS, FONTS, TESTIMONIALS_ROW_1, TESTIMONIALS_ROW_2 } from './landingData';
import type { TestimonialData } from './landingData';

function TestimonialCard({ t }: { t: TestimonialData }) {
  return (
    <Box sx={{
      minWidth: 320, maxWidth: 320, bgcolor: COLORS.surface, borderRadius: '16px', p: 3,
      border: `1px solid ${COLORS.border}`, flexShrink: 0,
      transition: 'all 300ms', '&:hover': { borderColor: `${COLORS.indigo}40`, transform: 'translateY(-2px)' },
    }}>
      <Stack direction="row" gap={0.25} mb={1.5}>
        {Array.from({ length: t.stars }).map((_, i) => (
          <StarIcon key={i} sx={{ fontSize: 14, color: COLORS.amber }} />
        ))}
      </Stack>
      <Typography sx={{ fontFamily: FONTS.body, color: COLORS.text2, fontSize: '14px', lineHeight: 1.7, mb: 2 }}>
        {t.text}
      </Typography>
      <Stack direction="row" alignItems="center" gap={1.5}>
        <Box sx={{ width: 36, height: 36, borderRadius: '50%', bgcolor: `${COLORS.indigo}20`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: FONTS.display, fontWeight: 700, fontSize: '13px', color: COLORS.indigo }}>
          {t.initials}
        </Box>
        <Box>
          <Typography sx={{ fontFamily: FONTS.body, fontWeight: 600, fontSize: '13px', color: COLORS.text1 }}>{t.name}</Typography>
          <Typography sx={{ fontFamily: FONTS.body, fontSize: '12px', color: COLORS.text3 }}>{t.role}</Typography>
        </Box>
      </Stack>
    </Box>
  );
}

export default function Testimonials() {
  const row1 = [...TESTIMONIALS_ROW_1, ...TESTIMONIALS_ROW_1];
  const row2 = [...TESTIMONIALS_ROW_2, ...TESTIMONIALS_ROW_2];

  return (
    <Box className="reveal-section" sx={{ bgcolor: COLORS.bg, py: { xs: 8, md: 12 }, overflow: 'hidden' }}>
      <Container maxWidth="lg" sx={{ mb: 5 }}>
        <Box sx={{ textAlign: 'center' }}>
          <Typography sx={{ fontFamily: FONTS.body, color: COLORS.indigo, fontSize: '13px', letterSpacing: '0.1em', textTransform: 'uppercase', mb: 1 }}>
            Testimonials
          </Typography>
          <Typography sx={{ fontFamily: FONTS.display, color: COLORS.text1, fontSize: { xs: '28px', md: '40px' }, fontWeight: 800 }}>
            Loved by screen owners & advertisers
          </Typography>
        </Box>
      </Container>

      <Box className="testimonial-rows" sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        <Box className="testimonial-row">
          {row1.map((t, i) => <TestimonialCard key={i} t={t} />)}
        </Box>
        <Box className="testimonial-row reverse">
          {row2.map((t, i) => <TestimonialCard key={i} t={t} />)}
        </Box>
      </Box>
    </Box>
  );
}
