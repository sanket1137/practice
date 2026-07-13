import { Box, Typography, Container, Grid, Stack } from '@mui/material';
import CloudUpload from '@mui/icons-material/CloudUpload';
import LibraryBooks from '@mui/icons-material/LibraryBooks';
import Place from '@mui/icons-material/Place';
import PlayCircleOutline from '@mui/icons-material/PlayCircleOutline';

import { COLORS, FONTS, TIMELINE_STEPS } from './landingData';

interface SectionProps {
  themeMode: 'light' | 'dark';
}

const STEP_ICONS = [
  CloudUpload,
  LibraryBooks,
  Place,
  PlayCircleOutline,
];

export default function ScrollStory({ themeMode }: SectionProps) {
  const c = COLORS[themeMode];

  return (
    <Box className="reveal-section" sx={{ py: { xs: 8, sm: 10, md: 16 }, bgcolor: c.bg, position: 'relative', overflow: 'hidden' }}>
      <Container maxWidth="lg">
        {/* Section Header */}
        <Box sx={{ textAlign: 'center', mb: { xs: 6, md: 10 } }}>
          <Typography
            sx={{
              fontFamily: FONTS.mono,
              color: COLORS.primaryPurple,
              fontSize: '12px',
              fontWeight: 700,
              letterSpacing: '0.15em',
              textTransform: 'uppercase',
              mb: 2,
            }}
          >
            Workflow Story
          </Typography>
          <Typography
            variant="h2"
            sx={{
              fontFamily: FONTS.display,
              fontWeight: 900,
              fontSize: { xs: '26px', sm: '34px', md: '48px' },
              color: c.text1,
              mb: 2.5,
              letterSpacing: '-0.02em',
            }}
          >
            From content to audience in 4 simple steps
          </Typography>
        </Box>

        {/* Desktop: Horizontal Timeline */}
        <Box sx={{ position: 'relative', display: { xs: 'none', md: 'block' } }}>
          {/* Connector Line in Background */}
          <Box
            className="story-connector-line"
            sx={{
              top: '26px',
              height: '3px',
            }}
          />

          <Grid container spacing={4}>
            {TIMELINE_STEPS.map((step, idx) => {
              const Icon = STEP_ICONS[idx] || CloudUpload;
              return (
                <Grid size={{ xs: 12, md: 3 }} key={idx}>
                  <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', position: 'relative', zIndex: 10 }}>
                    {/* Glowing Node Circle */}
                    <Box
                      className="glowing-timeline-node"
                      sx={{
                        width: 54,
                        height: 54,
                        bgcolor: themeMode === 'light' ? '#FFFFFF' : '#0F172A',
                        border: `3px solid ${COLORS.primaryPurple}`,
                        color: COLORS.primaryPurple,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        mb: 3,
                        boxShadow: '0 0 20px var(--accent-glow)',
                      }}
                    >
                      <Icon sx={{ fontSize: 24 }} />
                    </Box>

                    {/* Step tag */}
                    <Box
                      sx={{
                        bgcolor: COLORS.primaryPurple,
                        color: '#ffffff',
                        fontSize: '9.5px',
                        fontFamily: FONTS.mono,
                        fontWeight: 800,
                        borderRadius: '100px',
                        px: 1.5,
                        py: 0.25,
                        mb: 2.5,
                      }}
                    >
                      Step {step.step}
                    </Box>

                    {/* Title & Desc */}
                    <Typography sx={{ fontFamily: FONTS.display, fontWeight: 800, fontSize: '16px', color: c.text1, mb: 1 }}>
                      {step.title}
                    </Typography>
                    <Typography sx={{ fontFamily: FONTS.body, color: c.text2, fontSize: '13.5px', lineHeight: 1.5, maxWidth: 220 }}>
                      {step.desc}
                    </Typography>
                  </Box>
                </Grid>
              );
            })}
          </Grid>
        </Box>

        {/* Mobile: Vertical Timeline */}
        <Box sx={{ position: 'relative', display: { xs: 'block', md: 'none' } }}>
          {/* Vertical Connector Line */}
          <Box className="story-connector-line-vertical" />

          <Stack gap={4}>
            {TIMELINE_STEPS.map((step, idx) => {
              const Icon = STEP_ICONS[idx] || CloudUpload;
              return (
                <Stack key={idx} direction="row" gap={3} alignItems="flex-start" sx={{ position: 'relative', zIndex: 10 }}>
                  {/* Node Circle */}
                  <Box
                    className="glowing-timeline-node"
                    sx={{
                      width: 54,
                      height: 54,
                      minWidth: 54,
                      bgcolor: themeMode === 'light' ? '#FFFFFF' : '#0F172A',
                      border: `3px solid ${COLORS.primaryPurple}`,
                      color: COLORS.primaryPurple,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      boxShadow: '0 0 20px var(--accent-glow)',
                    }}
                  >
                    <Icon sx={{ fontSize: 24 }} />
                  </Box>

                  {/* Content */}
                  <Box sx={{ pt: 0.5 }}>
                    <Box
                      sx={{
                        display: 'inline-block',
                        bgcolor: COLORS.primaryPurple,
                        color: '#ffffff',
                        fontSize: '9.5px',
                        fontFamily: FONTS.mono,
                        fontWeight: 800,
                        borderRadius: '100px',
                        px: 1.5,
                        py: 0.25,
                        mb: 1.5,
                      }}
                    >
                      Step {step.step}
                    </Box>
                    <Typography sx={{ fontFamily: FONTS.display, fontWeight: 800, fontSize: '16px', color: c.text1, mb: 0.75 }}>
                      {step.title}
                    </Typography>
                    <Typography sx={{ fontFamily: FONTS.body, color: c.text2, fontSize: '13.5px', lineHeight: 1.5 }}>
                      {step.desc}
                    </Typography>
                  </Box>
                </Stack>
              );
            })}
          </Stack>
        </Box>
      </Container>
    </Box>
  );
}
