import { Box, Container, Typography, Grid, Stack } from '@mui/material';
import CloseRounded from '@mui/icons-material/CloseRounded';
import CheckRounded from '@mui/icons-material/CheckRounded';

const FONT = "'Inter', system-ui, sans-serif";
const ACCENT = '#5e6ad2';

const OLD_WAY = [
  'Opaque pricing & hidden commissions',
  'Endless emails to book a screen',
  'No proof if ads actually played',
  'Zero connection between physical and digital',
];

const NEW_WAY = [
  '100% transparent marketplace pricing',
  'Self-serve booking in minutes',
  'Live WebRTC stream verification',
  'QR conversion tracking & ROI metrics',
];

export default function ComparisonSection() {
  return (
    <Box component="section" sx={{
      py: { xs: 10, md: 16 },
      position: 'relative',
      zIndex: 1,
      bgcolor: 'rgba(0,0,0,0.5)',
      backdropFilter: 'blur(12px)',
    }}>
      <Container maxWidth="lg">
        {/* Header */}
        <Box sx={{ textAlign: 'center', mb: { xs: 8, md: 10 } }} className="fade-in-up">
          <Typography sx={{
            fontFamily: FONT,
            fontWeight: 300,
            fontSize: { xs: '1.75rem', md: '3rem' },
            mb: 2,
          }}>
            The Old Way vs The PixelSpot Way
          </Typography>
        </Box>

        <Grid container spacing={4}>
          {/* Old Way */}
          <Grid size={{ xs: 12, md: 6 }}>
            <Box className="comparison-old fade-in-up">
              <Typography sx={{ fontFamily: FONT, fontSize: '1.5rem', fontWeight: 500, color: '#9ca3af', mb: 4 }}>
                The Industry Standard
              </Typography>
              <Stack gap={3}>
                {OLD_WAY.map(item => (
                  <Stack key={item} direction="row" gap={2} alignItems="flex-start">
                    <CloseRounded sx={{ fontSize: 20, color: 'rgba(239,68,68,0.5)', mt: 0.3 }} />
                    <Typography sx={{ fontFamily: FONT, color: '#6b7280', fontSize: '0.95rem' }}>
                      {item}
                    </Typography>
                  </Stack>
                ))}
              </Stack>
            </Box>
          </Grid>

          {/* PixelSpot Way */}
          <Grid size={{ xs: 12, md: 6 }}>
            <Box className="comparison-new fade-in-up" sx={{ transitionDelay: '100ms' }}>
              <Typography sx={{ fontFamily: FONT, fontSize: '1.5rem', fontWeight: 500, color: '#fff', mb: 4 }}>
                The PixelSpot Standard
              </Typography>
              <Stack gap={3}>
                {NEW_WAY.map(item => (
                  <Stack key={item} direction="row" gap={2} alignItems="flex-start">
                    <CheckRounded sx={{ fontSize: 20, color: ACCENT, mt: 0.3 }} />
                    <Typography sx={{ fontFamily: FONT, color: '#d1d5db', fontSize: '0.95rem' }}>
                      {item}
                    </Typography>
                  </Stack>
                ))}
              </Stack>
            </Box>
          </Grid>
        </Grid>
      </Container>
    </Box>
  );
}
