import { useEffect, useRef, useCallback } from 'react';
import { Box } from '@mui/material';
import '../../components/landing/landing.css';
import { COLORS } from '../../components/landing/landingData';
import HeroSection from '../../components/landing/HeroSection';
import SocialProof from '../../components/landing/SocialProof';
import ScrollStory from '../../components/landing/ScrollStory';
import DualRoleCards from '../../components/landing/DualRoleCards';
import Testimonials from '../../components/landing/Testimonials';
import Pricing from '../../components/landing/Pricing';
import LiveWidget from '../../components/landing/LiveWidget';
import { FinalCta, LandingFooter } from '../../components/landing/FinalCta';

export default function LandingPage() {
  const rootRef = useRef<HTMLDivElement>(null);
  const glowRef = useRef<HTMLDivElement>(null);
  const progressRef = useRef<HTMLDivElement>(null);

  /* Scroll progress bar */
  const updateProgress = useCallback(() => {
    if (!progressRef.current) return;
    const pct = (window.scrollY / (document.body.scrollHeight - window.innerHeight)) * 100;
    progressRef.current.style.width = `${pct}%`;
  }, []);

  /* Cursor glow */
  const updateGlow = useCallback((e: MouseEvent) => {
    if (!glowRef.current) return;
    glowRef.current.style.left = `${e.clientX}px`;
    glowRef.current.style.top = `${e.clientY}px`;
  }, []);

  /* Section reveal observer */
  useEffect(() => {
    window.addEventListener('scroll', updateProgress, { passive: true });
    window.addEventListener('mousemove', updateGlow);

    const obs = new IntersectionObserver(
      entries => entries.forEach(e => { if (e.isIntersecting) e.target.classList.add('visible'); }),
      { threshold: 0.15 },
    );
    document.querySelectorAll('.reveal-section').forEach(el => obs.observe(el));

    return () => {
      window.removeEventListener('scroll', updateProgress);
      window.removeEventListener('mousemove', updateGlow);
      obs.disconnect();
    };
  }, [updateProgress, updateGlow]);

  return (
    <Box ref={rootRef} className="landing-root" sx={{ bgcolor: COLORS.bg, color: COLORS.text1, minHeight: '100vh', overflow: 'hidden' }}>
      <Box ref={progressRef} className="scroll-progress" />
      <Box ref={glowRef} className="cursor-glow" />

      <HeroSection />
      <SocialProof />
      <ScrollStory />
      <DualRoleCards />
      <Testimonials />
      <Pricing />
      <FinalCta />
      <LandingFooter />
      <LiveWidget />
    </Box>
  );
}

