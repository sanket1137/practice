import { useRef, useEffect, useState } from 'react';
import { Box, Typography, Container, Stack } from '@mui/material';
import { COLORS, FONTS, LOGO_BRANDS } from './landingData';

/* ── Logo Marquee ───────────────────────────────────────────── */
function LogoMarquee() {
  const doubled = [...LOGO_BRANDS, ...LOGO_BRANDS];
  return (
    <Box sx={{ overflow: 'hidden', py: 4, borderBottom: `1px solid ${COLORS.border}` }}>
      <Box className="marquee-track">
        {doubled.map((b, i) => (
          <Box key={i} sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexShrink: 0 }}>
            <Box sx={{ width: 36, height: 36, borderRadius: '8px', bgcolor: `${b.color}20`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: FONTS.display, fontWeight: 800, fontSize: '16px', color: b.color }}>
              {b.initial}
            </Box>
            <Typography sx={{ fontFamily: FONTS.body, color: COLORS.text3, fontSize: '14px', fontWeight: 500, whiteSpace: 'nowrap' }}>
              {b.name}
            </Typography>
          </Box>
        ))}
      </Box>
    </Box>
  );
}

/* ── Stat Counter ───────────────────────────────────────────── */
interface StatProps {
  end: number;
  suffix: string;
  label: string;
  color: string;
}

function StatCounter({ end, suffix, label, color }: StatProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [val, setVal] = useState(0);
  const [started, setStarted] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting && !started) setStarted(true); },
      { threshold: 0.5 },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [started]);

  useEffect(() => {
    if (!started) return;
    const dur = 2000;
    const step = Math.ceil(end / (dur / 16));
    let current = 0;
    const id = setInterval(() => {
      current = Math.min(current + step, end);
      setVal(current);
      if (current >= end) clearInterval(id);
    }, 16);
    return () => clearInterval(id);
  }, [started, end]);

  return (
    <Box ref={ref} sx={{ textAlign: 'center' }}>
      <Typography sx={{ fontFamily: FONTS.mono, fontSize: { xs: '32px', md: '48px' }, fontWeight: 800, color, lineHeight: 1 }}>
        {val.toLocaleString('en-IN')}{suffix}
      </Typography>
      <Typography sx={{ fontFamily: FONTS.body, color: COLORS.text3, fontSize: '14px', mt: 1 }}>
        {label}
      </Typography>
    </Box>
  );
}

/* ── Main Export ─────────────────────────────────────────────── */
export default function SocialProof() {
  return (
    <Box sx={{ bgcolor: COLORS.bg, py: { xs: 6, md: 8 } }}>
      <Container maxWidth="lg">
        <Typography sx={{ fontFamily: FONTS.body, color: COLORS.text3, fontSize: '13px', textAlign: 'center', letterSpacing: '0.1em', textTransform: 'uppercase', mb: 2 }}>
          Trusted by India&apos;s fastest-growing brands
        </Typography>
        <LogoMarquee />

        <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="center" gap={{ xs: 4, md: 8 }} mt={6}>
          <StatCounter end={500} suffix="+" label="Screens Listed" color={COLORS.indigo} />
          <StatCounter end={12} suffix="L+" label="Impressions Delivered" color={COLORS.pink} />
          <StatCounter end={50} suffix="+" label="Cities Covered" color={COLORS.cyan} />
          <StatCounter end={98} suffix="%" label="Uptime" color={COLORS.green} />
        </Stack>
      </Container>
    </Box>
  );
}
