import { useEffect, useRef, useState, useCallback } from 'react';
import { Box } from '@mui/material';

import '../../components/landing/landing.css';
import { COLORS } from '../../components/landing/landingData';

import HeroSection from '../../components/landing/HeroSection';
import DualRoleCards from '../../components/landing/DualRoleCards';
import FeaturesGrid from '../../components/landing/FeaturesGrid';
import ScrollStory from '../../components/landing/ScrollStory';
import WhyPixelSpot from '../../components/landing/WhyPixelSpot';
import DashboardShowcase from '../../components/landing/DashboardShowcase';
import Testimonials from '../../components/landing/Testimonials';
import { FAQ, FinalCta, LandingFooter } from '../../components/landing/FinalCta';

export default function LandingPage() {
  const rootRef = useRef<HTMLDivElement>(null);
  const glowRef = useRef<HTMLDivElement>(null);
  const progressRef = useRef<HTMLDivElement>(null);

  // Default to light theme matching the light mode screenshot preference
  const [themeMode, setThemeMode] = useState<'light' | 'dark'>('light');

  const toggleTheme = useCallback(() => {
    setThemeMode(prev => prev === 'light' ? 'dark' : 'light');
  }, []);

  /* Scroll progress bar */
  const updateProgress = useCallback(() => {
    if (!progressRef.current) return;
    const totalScroll = document.body.scrollHeight - window.innerHeight;
    const pct = totalScroll > 0 ? (window.scrollY / totalScroll) * 100 : 0;
    progressRef.current.style.width = `${pct}%`;
  }, []);

  /* Cursor glow positioning */
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
      entries => entries.forEach(e => {
        if (e.isIntersecting) {
          e.target.classList.add('visible');
        }
      }),
      { threshold: 0.05 },
    );
    document.querySelectorAll('.reveal-section').forEach(el => obs.observe(el));

    // Force update once initially
    updateProgress();

    return () => {
      window.removeEventListener('scroll', updateProgress);
      window.removeEventListener('mousemove', updateGlow);
      obs.disconnect();
    };
  }, [updateProgress, updateGlow]);

  return (
    <Box
      ref={rootRef}
      className={`landing-root theme-${themeMode}`}
      sx={{
        bgcolor: COLORS[themeMode].bg,
        color: COLORS[themeMode].text1,
        minHeight: '100vh',
        overflowX: 'hidden',
        position: 'relative',
        transition: 'background-color 0.3s ease',
      }}
    >
      {/* Global Stepper indicators */}
      <Box ref={progressRef} className="scroll-progress" />
      <Box ref={glowRef} className="cursor-glow" />

      {/* SECTION 1 & 2: Navigation & Hero — The hook */}
      <HeroSection themeMode={themeMode} toggleTheme={toggleTheme} />

      {/* SECTION 3: Problem + Solution Pitch — TOP PRIORITY */}
      <DualRoleCards themeMode={themeMode} />

      {/* SECTION 4: Platform Features Grid — Capabilities */}
      <FeaturesGrid themeMode={themeMode} />

      {/* SECTION 5: How It Works Timeline — Workflow */}
      <ScrollStory themeMode={themeMode} />

      {/* SECTION 6: Why PixelSpot (Comparison Table) */}
      <WhyPixelSpot themeMode={themeMode} />

      {/* SECTION 7: Beautiful Dashboard Showcase — Product Tour */}
      <DashboardShowcase themeMode={themeMode} />

      {/* SECTION 8: Stats + Testimonials — Social Proof */}
      <Testimonials themeMode={themeMode} />

      {/* SECTION 9: FAQ Accordion */}
      <FAQ themeMode={themeMode} />

      {/* SECTION 10: Final CTA */}
      <FinalCta themeMode={themeMode} />

      {/* Footer */}
      <LandingFooter themeMode={themeMode} />
    </Box>
  );
}
