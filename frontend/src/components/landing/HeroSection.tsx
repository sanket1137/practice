import { useRef, useEffect, useState, useMemo } from 'react';
import { Box, Typography, Button, Container, Stack } from '@mui/material';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import { useNavigate } from 'react-router-dom';
import { COLORS, FONTS, TICKER_ITEMS, MOCK_FEED_MESSAGES } from './landingData';

/* ── Ticker Bar ────────────────────────────────────────────── */
function LiveTicker() {
  const [liveNums, setLiveNums] = useState({ ads: 1247, revenue: 84200, bookings: 38, online: 15 });

  useEffect(() => {
    const id = setInterval(() => {
      setLiveNums(p => ({
        ads: p.ads + Math.floor(Math.random() * 5),
        revenue: p.revenue + Math.floor(Math.random() * 800),
        bookings: p.bookings + (Math.random() > 0.7 ? 1 : 0),
        online: p.online + (Math.random() > 0.8 ? 1 : Math.random() < 0.2 ? -1 : 0),
      }));
    }, 3000);
    return () => clearInterval(id);
  }, []);

  const rendered = TICKER_ITEMS.map(t =>
    t.replace('{ads}', String(liveNums.ads))
     .replace('{revenue}', liveNums.revenue.toLocaleString('en-IN'))
     .replace('{bookings}', String(liveNums.bookings))
     .replace('{online}', String(liveNums.online)),
  );
  const doubled = [...rendered, ...rendered];

  return (
    <Box sx={{ bgcolor: COLORS.surface, borderBottom: `1px solid ${COLORS.border}`, py: 0.75, overflow: 'hidden', position: 'relative', zIndex: 100 }}>
      <Box className="ticker-track">
        {doubled.map((msg, i) => (
          <Box key={i} component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 1, px: 3, fontFamily: FONTS.mono, fontSize: '12px', color: COLORS.text2, whiteSpace: 'nowrap' }}>
            <Box className="pulse-dot" sx={{ width: 6, height: 6 }} />
            {msg}
          </Box>
        ))}
      </Box>
    </Box>
  );
}

/* ── Navbar ─────────────────────────────────────────────────── */
function LandingNav() {
  const [scrolled, setScrolled] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 50);
    window.addEventListener('scroll', handler, { passive: true });
    return () => window.removeEventListener('scroll', handler);
  }, []);

  return (
    <Box
      component="nav"
      sx={{
        position: 'sticky', top: 0, zIndex: 1000,
        backdropFilter: scrolled ? 'blur(20px) saturate(1.5)' : 'none',
        bgcolor: scrolled ? 'rgba(8,13,24,0.85)' : 'transparent',
        borderBottom: scrolled ? `1px solid ${COLORS.border}` : '1px solid transparent',
        transition: 'all 300ms ease',
      }}
    >
      <Container maxWidth="lg">
        <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ height: 64 }}>
          <Stack direction="row" alignItems="center" gap={1.5}>
            <Box sx={{ width: 32, height: 32, borderRadius: 1, bgcolor: COLORS.indigo, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: FONTS.display, fontWeight: 800, fontSize: '14px', color: '#fff' }}>P</Box>
            <Typography sx={{ fontFamily: FONTS.display, fontWeight: 700, fontSize: '18px', color: COLORS.text1 }}>PixelSpot</Typography>
          </Stack>

          <Stack className="landing-nav-links" direction="row" gap={4} sx={{ display: { xs: 'none', md: 'flex' } }}>
            {['Features', 'Pricing', 'Screens'].map(l => (
              <Box key={l} component="span" className="landing-nav-link" sx={{ fontFamily: FONTS.body }}>{l}</Box>
            ))}
          </Stack>

          <Stack direction="row" gap={1.5}>
            <Button className="nav-ghost-btn" variant="text" onClick={() => navigate('/login')}
              sx={{ fontFamily: FONTS.body, color: COLORS.text2, textTransform: 'none', fontSize: '14px', display: { xs: 'none', sm: 'flex' }, '&:hover': { color: COLORS.text1 } }}>
              Sign in
            </Button>
            <Button variant="contained" onClick={() => navigate('/register')}
              sx={{ fontFamily: FONTS.body, bgcolor: COLORS.indigo, textTransform: 'none', fontSize: '14px', borderRadius: '8px', px: 2.5, '&:hover': { bgcolor: '#5558e6' } }}>
              Start Free →
            </Button>
          </Stack>
        </Stack>
      </Container>
    </Box>
  );
}

/* ── Particle Canvas ────────────────────────────────────────── */
function useParticleCanvas(canvasRef: React.RefObject<HTMLCanvasElement | null>) {
  const mouseRef = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId = 0;
    const nodes: { x: number; y: number; vx: number; vy: number; r: number }[] = [];
    const resize = () => { canvas.width = canvas.offsetWidth; canvas.height = canvas.offsetHeight; };
    resize();
    window.addEventListener('resize', resize);

    for (let i = 0; i < 60; i++) {
      nodes.push({ x: Math.random() * canvas.width, y: Math.random() * canvas.height, vx: (Math.random() - 0.5) * 0.4, vy: (Math.random() - 0.5) * 0.4, r: Math.random() * 2 + 1 });
    }

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const mx = mouseRef.current.x;
      const my = mouseRef.current.y;

      nodes.forEach(n => {
        n.x += n.vx; n.y += n.vy;
        if (n.x < 0 || n.x > canvas.width) n.vx *= -1;
        if (n.y < 0 || n.y > canvas.height) n.vy *= -1;
      });

      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const dx = nodes[i].x - nodes[j].x;
          const dy = nodes[i].y - nodes[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 120) {
            ctx.beginPath();
            ctx.moveTo(nodes[i].x, nodes[i].y);
            ctx.lineTo(nodes[j].x, nodes[j].y);
            ctx.strokeStyle = `rgba(99,102,241,${0.15 * (1 - dist / 120)})`;
            ctx.lineWidth = 0.5;
            ctx.stroke();
          }
        }
      }

      nodes.forEach(n => {
        const dx = n.x - mx; const dy = n.y - my;
        const md = Math.sqrt(dx * dx + dy * dy);
        if (md < 200) {
          ctx.beginPath();
          ctx.moveTo(n.x, n.y);
          ctx.lineTo(mx, my);
          ctx.strokeStyle = `rgba(236,72,153,${0.3 * (1 - md / 200)})`;
          ctx.lineWidth = 0.8;
          ctx.stroke();
        }
        ctx.beginPath();
        ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(99,102,241,0.5)';
        ctx.fill();
      });

      animId = requestAnimationFrame(draw);
    };
    draw();

    const handleMouse = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      mouseRef.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    };
    canvas.addEventListener('mousemove', handleMouse);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', resize);
      canvas.removeEventListener('mousemove', handleMouse);
    };
  }, [canvasRef]);
}

/* ── Dashboard Mockup ───────────────────────────────────────── */

const BILLBOARD_ADS = [
  [
    { brand: 'Zomato', text: '50% OFF on first order!', color: '#ef4444', bg: '#ef444415' },
    { brand: 'Swiggy', text: 'Free delivery today 🛵', color: '#f97316', bg: '#f9731615' },
    { brand: 'Lenskart', text: 'BOGO on all frames', color: '#06b6d4', bg: '#06b6d415' },
  ],
  [
    { brand: 'Flipkart', text: 'Big Billion Days Live!', color: '#3b82f6', bg: '#3b82f615' },
    { brand: 'OYO', text: 'Rooms from ₹599/night', color: '#ef4444', bg: '#ef444415' },
    { brand: 'Meesho', text: 'Summer Sale — 70% OFF', color: '#ec4899', bg: '#ec489915' },
  ],
  [
    { brand: 'BigBazaar', text: 'Mahabachat on Groceries', color: '#eab308', bg: '#eab30815' },
    { brand: 'Decathlon', text: 'Monsoon gear starts ₹299', color: '#22c55e', bg: '#22c55e15' },
    { brand: 'Zomato', text: 'Live music + dining 🎵', color: '#ef4444', bg: '#ef444415' },
  ],
];

function FloatingBillboard({ ads, delay, floatAnim, tilt, position }: {
  ads: typeof BILLBOARD_ADS[0];
  delay: number;
  floatAnim: string;
  tilt: string;
  position: { top?: string; left?: string; right?: string; bottom?: string };
}) {
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setIdx(p => (p + 1) % ads.length), 3500 + delay * 500);
    return () => clearInterval(id);
  }, [ads.length, delay]);

  const ad = ads[idx];

  return (
    <Box className="floating-card-el" sx={{
      display: { xs: 'none', lg: 'block' }, position: 'absolute', zIndex: 6,
      animation: `${floatAnim} ease-in-out infinite`,
      transform: tilt, ...position,
    }}>
      <Box sx={{
        width: 180, bgcolor: '#0a0f1a', borderRadius: '6px', overflow: 'hidden',
        border: `2px solid ${COLORS.surface2}`,
        boxShadow: `0 0 20px ${ad.color}20, 0 8px 32px rgba(0,0,0,0.4)`,
        transition: 'box-shadow 0.8s ease',
      }}>
        {/* Screen bezel top */}
        <Box sx={{ bgcolor: COLORS.surface2, px: 1, py: 0.4, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <Box className="pulse-dot" sx={{ width: 5, height: 5 }} />
            <Typography sx={{ fontFamily: FONTS.mono, fontSize: '8px', color: COLORS.text3 }}>LIVE</Typography>
          </Box>
          <Typography sx={{ fontFamily: FONTS.mono, fontSize: '8px', color: COLORS.text3 }}>SCREEN</Typography>
        </Box>
        {/* Ad content */}
        <Box sx={{
          p: 1.5, bgcolor: ad.bg, minHeight: 70,
          display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center',
          transition: 'all 0.6s cubic-bezier(0.16,1,0.3,1)',
        }}>
          <Typography sx={{ fontFamily: FONTS.display, fontWeight: 800, fontSize: '13px', color: ad.color, mb: 0.3, textAlign: 'center' }}>
            {ad.brand}
          </Typography>
          <Typography sx={{ fontFamily: FONTS.body, fontSize: '10px', color: COLORS.text2, textAlign: 'center', lineHeight: 1.3 }}>
            {ad.text}
          </Typography>
        </Box>
        {/* Screen bezel bottom */}
        <Box sx={{ bgcolor: COLORS.surface2, height: 3 }}>
          <Box sx={{
            height: '100%', bgcolor: ad.color, opacity: 0.6,
            width: '100%', animation: 'ticker 3.5s linear infinite',
          }} />
        </Box>
      </Box>
    </Box>
  );
}

function DashboardMockup() {
  const [feedIdx, setFeedIdx] = useState(0);
  const [liveViews, setLiveViews] = useState(12847);
  const [activePct, setActivePct] = useState(94);

  useEffect(() => {
    const i1 = setInterval(() => setFeedIdx(p => (p + 1) % MOCK_FEED_MESSAGES.length), 3000);
    const i2 = setInterval(() => {
      setLiveViews(p => p + Math.floor(Math.random() * 50));
      setActivePct(p => Math.min(99, Math.max(90, p + (Math.random() > 0.5 ? 1 : -1))));
    }, 4000);
    return () => { clearInterval(i1); clearInterval(i2); };
  }, []);

  const visibleFeed = useMemo(() => {
    const items: string[] = [];
    for (let i = 0; i < 3; i++) items.push(MOCK_FEED_MESSAGES[(feedIdx + i) % MOCK_FEED_MESSAGES.length]);
    return items;
  }, [feedIdx]);

  return (
    <Box sx={{ maxWidth: 540, width: '100%', mx: 'auto', mt: 5, position: 'relative', zIndex: 5 }}>
      {/* Browser chrome */}
      <Box sx={{ bgcolor: COLORS.surface, borderRadius: '12px 12px 0 0', border: `1px solid ${COLORS.border}`, borderBottom: 'none', px: 2, py: 1.2, display: 'flex', alignItems: 'center', gap: 1 }}>
        <Box sx={{ display: 'flex', gap: 0.75 }}>
          {['#ef4444', '#f59e0b', '#22c55e'].map(c => (
            <Box key={c} sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: c, opacity: 0.7 }} />
          ))}
        </Box>
        <Box sx={{ flex: 1, bgcolor: COLORS.surface2, borderRadius: '6px', py: 0.5, px: 1.5, fontFamily: FONTS.mono, fontSize: '11px', color: COLORS.text3, textAlign: 'center' }}>
          ccms.pixelspot.in/dashboard
        </Box>
      </Box>
      {/* Dashboard body */}
      <Box sx={{ bgcolor: COLORS.surface, borderRadius: '0 0 12px 12px', border: `1px solid ${COLORS.border}`, p: 2.5 }}>
        <Stack direction="row" gap={1.5} mb={2}>
          {[
            { label: 'Live Views', val: liveViews.toLocaleString('en-IN'), color: COLORS.indigo },
            { label: 'Active', val: `${activePct}%`, color: COLORS.green },
            { label: 'Revenue', val: '₹2.4L', color: COLORS.pink },
          ].map(s => (
            <Box key={s.label} sx={{ flex: 1, bgcolor: COLORS.surface2, borderRadius: '8px', p: 1.5, textAlign: 'center', border: `1px solid ${COLORS.border}` }}>
              <Typography sx={{ fontFamily: FONTS.mono, fontSize: '18px', fontWeight: 700, color: s.color }}>{s.val}</Typography>
              <Typography sx={{ fontFamily: FONTS.mono, fontSize: '10px', color: COLORS.text3, mt: 0.3 }}>{s.label}</Typography>
            </Box>
          ))}
        </Stack>
        <Box sx={{ bgcolor: COLORS.surface2, borderRadius: '8px', p: 1.5, border: `1px solid ${COLORS.border}` }}>
          <Typography sx={{ fontFamily: FONTS.mono, fontSize: '10px', color: COLORS.text3, mb: 1, letterSpacing: '0.05em' }}>LIVE FEED</Typography>
          <Stack gap={0.75}>
            {visibleFeed.map((msg, i) => (
              <Box key={`${feedIdx}-${i}`} className="mock-feed-item" sx={{ fontFamily: FONTS.mono, fontSize: '11px', color: COLORS.text2, py: 0.5, borderBottom: `1px solid ${COLORS.border}` }}>
                {msg}
              </Box>
            ))}
          </Stack>
        </Box>
      </Box>
    </Box>
  );
}

/* ── Hero Title (char-rain animation) ─────────────────────── */
function HeroTitle() {
  const words = ['Turn Every', 'Screen Into', 'Revenue'];
  return (
    <Typography component="h1" sx={{ fontFamily: FONTS.display, fontWeight: 800, fontSize: { xs: '36px', sm: '48px', md: '60px' }, lineHeight: 1.1, textAlign: 'center', color: COLORS.text1 }}>
      {words.map((word, wi) => (
        <Box key={wi} component="span" sx={{ display: 'block' }}>
          {word.split('').map((ch, ci) => (
            <Box key={ci} component="span" className="hero-char" sx={{ animationDelay: `${(wi * 10 + ci) * 0.04}s` }}>
              {ch === ' ' ? '\u00A0' : ch}
            </Box>
          ))}
        </Box>
      ))}
    </Typography>
  );
}

/* ── Main Hero Section ─────────────────────────────────────── */
export default function HeroSection() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const navigate = useNavigate();
  useParticleCanvas(canvasRef);

  return (
    <Box sx={{ bgcolor: COLORS.bg }}>
      <LiveTicker />
      <LandingNav />

      {/* Hero */}
      <Box sx={{ position: 'relative', overflow: 'hidden', pt: { xs: 8, md: 12 }, pb: { xs: 6, md: 8 } }}>
        <Box className="hero-grid-bg" />
        {/* Glow orb */}
        <Box sx={{ position: 'absolute', top: '20%', left: '50%', transform: 'translateX(-50%)', width: 500, height: 500, borderRadius: '50%', background: `radial-gradient(circle, ${COLORS.indigoGlow}, transparent 70%)`, animation: 'breathe 4s ease-in-out infinite', zIndex: 1, pointerEvents: 'none' }} />
        <canvas ref={canvasRef} style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', zIndex: 2 }} />

        <Container maxWidth="md" sx={{ position: 'relative', zIndex: 5, textAlign: 'center' }}>
          {/* Badge */}
          <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 1, bgcolor: COLORS.surface, border: `1px solid ${COLORS.border}`, borderRadius: '100px', px: 2, py: 0.75, mb: 3, position: 'relative', overflow: 'hidden' }}>
            <Box className="pulse-dot" />
            <Typography sx={{ fontFamily: FONTS.mono, fontSize: '12px', color: COLORS.text2 }}>
              <Box component="span" className="char-pulse" sx={{ color: COLORS.green }}>24/7</Box> autonomous ad delivery
            </Typography>
            <Box sx={{ position: 'absolute', top: 0, left: '-100%', width: '100%', height: '100%', background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.06), transparent)', animation: 'shimmer 3s ease-in-out infinite' }} />
          </Box>

          <HeroTitle />

          <Typography sx={{ fontFamily: FONTS.body, color: COLORS.text2, fontSize: { xs: '16px', md: '18px' }, maxWidth: 520, mx: 'auto', mt: 3, lineHeight: 1.6 }}>
            India&apos;s first <Box component="span" sx={{ color: COLORS.indigo, fontWeight: 600 }}>slot-based DOOH platform</Box>. Screen owners earn passive income. Advertisers reach real audiences. Powered by Raspberry Pi.
          </Typography>

          <Stack direction={{ xs: 'column', sm: 'row' }} gap={1.5} justifyContent="center" mt={4}>
            <Button variant="contained" onClick={() => navigate('/register')}
              sx={{ fontFamily: FONTS.body, bgcolor: COLORS.indigo, textTransform: 'none', fontSize: '16px', borderRadius: '12px', px: 4, py: 1.5, fontWeight: 600, boxShadow: `0 0 30px ${COLORS.indigoGlow}`, '&:hover': { bgcolor: '#5558e6', transform: 'translateY(-2px)', boxShadow: `0 8px 40px ${COLORS.indigoGlow}` }, transition: 'all 200ms' }}>
              Start Earning Free →
            </Button>
            <Button variant="outlined" startIcon={<PlayArrowIcon />}
              sx={{ fontFamily: FONTS.body, borderColor: COLORS.border, color: COLORS.text2, textTransform: 'none', fontSize: '16px', borderRadius: '12px', px: 4, py: 1.5, '&:hover': { borderColor: COLORS.text3, bgcolor: 'rgba(255,255,255,0.03)' } }}>
              Watch Demo
            </Button>
          </Stack>

          <DashboardMockup />

          {/* Floating billboard screens */}
          <FloatingBillboard
            ads={BILLBOARD_ADS[0]} delay={0}
            floatAnim="float-left 6s" tilt="rotate(-6deg)"
            position={{ left: '-100px', top: '30%' }}
          />
          <FloatingBillboard
            ads={BILLBOARD_ADS[1]} delay={1}
            floatAnim="float-right 5s" tilt="rotate(5deg)"
            position={{ right: '-80px', top: '25%' }}
          />
          <FloatingBillboard
            ads={BILLBOARD_ADS[2]} delay={2}
            floatAnim="float-left 7s" tilt="rotate(3deg)"
            position={{ right: '-60px', top: '55%' }}
          />
        </Container>
      </Box>
    </Box>
  );
}
