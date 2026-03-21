import { useRef, useEffect, useState } from 'react';
import { Box, Typography, Container, Stack } from '@mui/material';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import MapIcon from '@mui/icons-material/Map';
import SendIcon from '@mui/icons-material/Send';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CurrencyRupeeIcon from '@mui/icons-material/CurrencyRupee';
import { COLORS, FONTS, STORY_STEPS } from './landingData';

const ICON_MAP = {
  CloudUpload: CloudUploadIcon,
  Map: MapIcon,
  Send: SendIcon,
  CheckCircle: CheckCircleIcon,
  CurrencyRupee: CurrencyRupeeIcon,
} as const;

export default function ScrollStory() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const handler = () => {
      const el = containerRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const viewH = window.innerHeight;
      const totalScroll = el.offsetHeight - viewH;
      const scrolled = -rect.top;
      const pct = Math.max(0, Math.min(1, scrolled / totalScroll));
      setProgress(pct);
      const stepIdx = Math.min(STORY_STEPS.length - 1, Math.floor(pct * STORY_STEPS.length));
      setActive(stepIdx);
    };
    window.addEventListener('scroll', handler, { passive: true });
    handler();
    return () => window.removeEventListener('scroll', handler);
  }, []);

  const cur = STORY_STEPS[active];
  const CurIcon = ICON_MAP[cur.icon];

  return (
    <Box ref={containerRef} sx={{ position: 'relative', height: '220vh', bgcolor: COLORS.bg }}>
      <Box sx={{ position: 'sticky', top: 0, height: '100vh', display: 'flex', alignItems: 'center', overflow: 'hidden' }}>
        <Container maxWidth="lg">
          <Typography sx={{ fontFamily: FONTS.body, color: COLORS.indigo, fontSize: '13px', letterSpacing: '0.1em', textTransform: 'uppercase', mb: 1 }}>
            How it works
          </Typography>
          <Typography sx={{ fontFamily: FONTS.display, color: COLORS.text1, fontSize: { xs: '28px', md: '40px' }, fontWeight: 800, mb: 5 }}>
            From upload to earnings in 5 steps
          </Typography>

          <Stack direction={{ xs: 'column', md: 'row' }} gap={6} alignItems="flex-start">
            {/* Left: Steps */}
            <Box sx={{ flex: 1 }}>
              {STORY_STEPS.map((step, i) => {
                const Icon = ICON_MAP[step.icon];
                return (
                  <Box
                    key={i}
                    className={`story-step${i === active ? ' active' : ''}`}
                    sx={{ p: 2.5, mb: 1, borderRadius: '0 12px 12px 0', cursor: 'pointer' }}
                    onClick={() => setActive(i)}
                  >
                    <Stack direction="row" alignItems="center" gap={1.5} mb={0.5}>
                      <Icon sx={{ fontSize: 20, color: i === active ? COLORS.indigo : COLORS.text3 }} />
                      <Typography sx={{ fontFamily: FONTS.display, fontWeight: 700, fontSize: '18px', color: i === active ? COLORS.text1 : COLORS.text3 }}>
                        {step.title}
                      </Typography>
                    </Stack>
                    {i === active && (
                      <Typography sx={{ fontFamily: FONTS.body, color: COLORS.text2, fontSize: '14px', lineHeight: 1.6, pl: 4.5 }}>
                        {step.desc}
                      </Typography>
                    )}
                  </Box>
                );
              })}
            </Box>

            {/* Right: Visual panel */}
            <Box className="story-visual-panel" sx={{ flex: 1, display: { xs: 'none', md: 'flex' }, alignItems: 'center', justifyContent: 'center' }}>
              <Box sx={{
                width: '100%', maxWidth: 380, aspectRatio: '4/3', borderRadius: '16px',
                bgcolor: COLORS.surface, border: `1px solid ${COLORS.border}`,
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2,
                transition: 'all 500ms cubic-bezier(0.16,1,0.3,1)',
              }}>
                <Box sx={{
                  width: 64, height: 64, borderRadius: '16px',
                  bgcolor: `${COLORS.indigo}15`, display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <CurIcon sx={{ fontSize: 32, color: COLORS.indigo }} />
                </Box>
                <Typography sx={{ fontFamily: FONTS.mono, color: COLORS.text2, fontSize: '14px' }}>
                  {cur.visualLabel}
                </Typography>
                <Typography sx={{ fontFamily: FONTS.display, color: COLORS.text1, fontWeight: 800, fontSize: '32px' }}>
                  {cur.number}
                </Typography>
                {/* Progress bar */}
                <Box sx={{ width: '60%', height: 4, borderRadius: 2, bgcolor: COLORS.surface2 }}>
                  <Box sx={{ width: `${progress * 100}%`, height: '100%', borderRadius: 2, bgcolor: COLORS.indigo, transition: 'width 100ms linear' }} />
                </Box>
              </Box>
            </Box>
          </Stack>
        </Container>
      </Box>
    </Box>
  );
}
