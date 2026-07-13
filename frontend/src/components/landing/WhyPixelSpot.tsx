import { Box, Typography, Container, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper } from '@mui/material';
import CheckCircle from '@mui/icons-material/CheckCircle';
import Cancel from '@mui/icons-material/Cancel';
import { WHY_PIXELSPOT, COLORS, FONTS } from './landingData';

interface SectionProps {
  themeMode: 'light' | 'dark';
}

export default function WhyPixelSpot({ themeMode }: SectionProps) {
  const c = COLORS[themeMode];

  return (
    <Box className="reveal-section" sx={{ py: { xs: 8, sm: 10, md: 16 }, bgcolor: c.bg, position: 'relative', overflow: 'hidden' }}>
      <Container maxWidth="lg">
        {/* Section Header */}
        <Box sx={{ textAlign: 'center', mb: { xs: 5, md: 10 } }}>
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
            Why PixelSpot
          </Typography>
          <Typography
            variant="h2"
            sx={{
              fontFamily: FONTS.display,
              fontWeight: 800,
              fontSize: { xs: '26px', sm: '32px', md: '42px' },
              mb: 3,
              color: c.text1,
            }}
          >
            The evolution of digital signage
          </Typography>
          <Typography
            sx={{
              fontFamily: FONTS.body,
              color: c.text2,
              fontSize: { xs: '14px', sm: '15px', md: '17px' },
              maxWidth: 600,
              mx: 'auto',
              lineHeight: 1.6,
            }}
          >
            How PixelSpot compares to traditional content management systems. We bridge the gap between static management and active monetization.
          </Typography>
        </Box>

        {/* Comparison Table */}
        <Box className="compare-table-wrapper" sx={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
          <TableContainer
            component={Paper}
            sx={{
              background: c.surfaceCard,
              border: `1px solid ${c.border}`,
              borderRadius: '16px',
              overflow: 'hidden',
              boxShadow: themeMode === 'light' ? '0 10px 30px rgba(0,0,0,0.03)' : 'none',
              minWidth: 600,
            }}
          >
            <Table className="compare-table" aria-label="comparison table">
              <TableHead sx={{ bgcolor: themeMode === 'light' ? 'rgba(0,0,0,0.02)' : 'rgba(255, 255, 255, 0.02)' }}>
                <TableRow>
                  {WHY_PIXELSPOT.headers.map((hdr, idx) => (
                    <TableCell
                      key={idx}
                      className="compare-th"
                      sx={{
                        fontFamily: FONTS.display,
                        color: idx === 2 ? COLORS.primaryPurple : idx === 1 ? c.text3 : c.text1,
                        borderBottom: `2px solid ${c.border}`,
                        fontSize: { xs: '13px', md: '15px' },
                        fontWeight: 700,
                        py: 2.5,
                        px: { xs: 2, md: 3 },
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {hdr}
                    </TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {WHY_PIXELSPOT.rows.map((row, idx) => (
                  <TableRow key={idx} className="compare-row">
                    <TableCell
                      className="compare-td"
                      sx={{
                        fontFamily: FONTS.display,
                        color: c.text1,
                        fontWeight: 600,
                        borderBottom: `1px solid ${c.border}`,
                        py: 2,
                        px: { xs: 2, md: 3 },
                        whiteSpace: 'nowrap',
                        fontSize: { xs: '13px', md: '14px' },
                      }}
                    >
                      {row.name}
                    </TableCell>
                    <TableCell
                      className="compare-td"
                      sx={{
                        fontFamily: FONTS.body,
                        color: c.text2,
                        borderBottom: `1px solid ${c.border}`,
                        py: 2,
                        px: { xs: 2, md: 3 },
                        fontSize: { xs: '12px', md: '14px' },
                      }}
                    >
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        {row.trad.startsWith('❌') ? (
                          <Cancel sx={{ color: c.border, fontSize: 18, flexShrink: 0 }} />
                        ) : null}
                        {row.trad.replace('❌ ', '')}
                      </Box>
                    </TableCell>
                    <TableCell
                      className="compare-td"
                      sx={{
                        fontFamily: FONTS.body,
                        color: c.text1,
                        fontWeight: 500,
                        borderBottom: `1px solid ${c.border}`,
                        py: 2,
                        px: { xs: 2, md: 3 },
                        fontSize: { xs: '12px', md: '14px' },
                      }}
                    >
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        {row.pixel.startsWith('✅') ? (
                          <CheckCircle sx={{ color: COLORS.success, fontSize: 18, flexShrink: 0 }} />
                        ) : null}
                        {row.pixel.replace('✅ ', '')}
                      </Box>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Box>
      </Container>
    </Box>
  );
}
