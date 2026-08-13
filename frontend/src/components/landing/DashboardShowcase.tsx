import { useState } from 'react';
import { Box, Typography, Container, Stack, Button, Grid, Table, TableBody, TableCell, TableHead, TableRow } from '@mui/material';
import PlaylistPlay from '@mui/icons-material/PlaylistPlay';
import ViewQuilt from '@mui/icons-material/ViewQuilt';
import CalendarMonth from '@mui/icons-material/CalendarMonth';
import ShowChart from '@mui/icons-material/ShowChart';
import LaptopMac from '@mui/icons-material/LaptopMac';
import PhotoLibrary from '@mui/icons-material/PhotoLibrary';

import { COLORS, FONTS } from './landingData';

type TabKey = 'playlist' | 'layout' | 'calendar' | 'analytics' | 'monitoring' | 'media';

interface SectionProps {
  themeMode: 'light' | 'dark';
}

export default function DashboardShowcase({ themeMode }: SectionProps) {
  const c = COLORS[themeMode];
  const [activeTab, setActiveTab] = useState<TabKey>('playlist');

  const tabs = [
    { key: 'playlist', label: 'Playlist Builder', icon: PlaylistPlay },
    { key: 'layout', label: 'Layout Designer', icon: ViewQuilt },
    { key: 'calendar', label: 'Campaign Calendar', icon: CalendarMonth },
    { key: 'analytics', label: 'Analytics', icon: ShowChart },
    { key: 'monitoring', label: 'Device Monitoring', icon: LaptopMac },
    { key: 'media', label: 'Media Library', icon: PhotoLibrary },
  ] as const;

  const renderContent = () => {
    switch (activeTab) {
      case 'playlist':
        return (
          <Box sx={{ p: { xs: 2.5, md: 4 } }}>
            <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ sm: 'center' }} gap={1} mb={3}>
              <Typography sx={{ fontFamily: FONTS.display, fontWeight: 700, fontSize: { xs: '15px', md: '18px' }, color: c.text1 }}>
                Store Lobby A — Afternoon Channel
              </Typography>
              <Box sx={{ bgcolor: 'rgba(34, 197, 94, 0.1)', border: `1px solid ${COLORS.success}`, color: COLORS.success, borderRadius: '100px', px: 1.5, py: 0.5, fontSize: '12px', fontFamily: FONTS.mono, whiteSpace: 'nowrap', alignSelf: { xs: 'flex-start', sm: 'auto' } }}>
                Active (10 min loop)
              </Box>
            </Stack>
            <Stack gap={2}>
              {[
                { name: '1. Pepsi_Summer_Campaign.mp4', dur: '30s', aspect: '16:9 Vertical', size: '18.4 MB' },
                { name: '2. Fallback_Promo_Lifestyle.mp4', dur: '45s', aspect: '16:9 Vertical', size: '24.1 MB' },
                { name: '3. Nike_AirMax_Launch.webp', dur: '15s', aspect: '16:9 Vertical', size: '2.8 MB' },
                { name: '4. Dominoes_CheesyPizza.mp4', dur: '20s', aspect: '16:9 Vertical', size: '12.9 MB' },
              ].map((item, idx) => (
                <Box key={idx} sx={{ bgcolor: c.surfaceCard, border: `1px solid ${c.border}`, borderRadius: '12px', p: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between', transition: 'all 0.2s', '&:hover': { borderColor: COLORS.primaryPurple } }}>
                  <Stack direction="row" alignItems="center" gap={2} sx={{ minWidth: 0, flex: 1 }}>
                    <Box sx={{ width: 8, height: 16, display: 'flex', flexDirection: 'column', gap: 0.25, justifyContent: 'center', opacity: 0.3, flexShrink: 0 }}>
                      {[1, 2, 3, 4, 5, 6].map(x => <Box key={x} sx={{ width: 2, height: 2, bgcolor: c.text1, borderRadius: '50%' }} />)}
                    </Box>
                    <Box sx={{ minWidth: 0 }}>
                      <Typography sx={{ fontFamily: FONTS.body, fontWeight: 600, color: c.text1, fontSize: { xs: '12px', md: '14px' }, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.name}</Typography>
                      <Typography sx={{ fontFamily: FONTS.mono, fontSize: { xs: '9px', md: '11px' }, color: c.text3, mt: 0.25 }}>Aspect: {item.aspect} | Size: {item.size}</Typography>
                    </Box>
                  </Stack>
                  <Typography sx={{ fontFamily: FONTS.mono, fontWeight: 600, color: COLORS.primaryPurple, fontSize: { xs: '12px', md: '14px' }, flexShrink: 0, ml: 1 }}>{item.dur}</Typography>
                </Box>
              ))}
            </Stack>
          </Box>
        );

      case 'layout':
        return (
          <Box sx={{ p: { xs: 2.5, md: 4 }, height: '100%' }}>
            <Typography sx={{ fontFamily: FONTS.display, fontWeight: 700, fontSize: { xs: '15px', md: '18px' }, color: c.text1, mb: 3 }}>
              Split-Zone Canvas (Standard Portrait 1080x1920)
            </Typography>
            <Grid container spacing={3} sx={{ height: { xs: 200, md: 320 } }}>
              <Grid size={{ xs: 8 }} sx={{ height: '100%' }}>
                <Box sx={{ height: '100%', border: `2px dashed ${COLORS.primaryPurple}`, borderRadius: '12px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', bgcolor: 'rgba(99, 102, 241, 0.05)' }}>
                  <Typography sx={{ fontFamily: FONTS.display, fontWeight: 700, color: COLORS.primaryPurple, fontSize: { xs: '12px', md: '16px' } }}>Zone A (Primary Video)</Typography>
                  <Typography sx={{ fontFamily: FONTS.mono, fontSize: { xs: '9px', md: '11px' }, color: c.text3, mt: 0.5 }}>1080 x 1440 | 3:4 Aspect</Typography>
                </Box>
              </Grid>
              <Grid size={{ xs: 4 }} sx={{ height: '100%' }}>
                <Stack spacing={2} sx={{ height: '100%' }}>
                  <Box sx={{ flex: 1, border: `2px dashed ${c.border}`, borderRadius: '12px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', bgcolor: 'rgba(255,255,255,0.01)' }}>
                    <Typography sx={{ fontFamily: FONTS.body, fontWeight: 600, color: c.text1, fontSize: { xs: '10px', md: '12px' } }}>Zone B (Weather)</Typography>
                    <Typography sx={{ fontFamily: FONTS.mono, fontSize: { xs: '8px', md: '10px' }, color: c.text3 }}>1080 x 240</Typography>
                  </Box>
                  <Box sx={{ flex: 1, border: `2px dashed ${c.border}`, borderRadius: '12px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', bgcolor: 'rgba(255,255,255,0.01)' }}>
                    <Typography sx={{ fontFamily: FONTS.body, fontWeight: 600, color: c.text1, fontSize: { xs: '10px', md: '12px' } }}>Zone C (News Ticker)</Typography>
                    <Typography sx={{ fontFamily: FONTS.mono, fontSize: { xs: '8px', md: '10px' }, color: c.text3 }}>1080 x 240</Typography>
                  </Box>
                </Stack>
              </Grid>
            </Grid>
          </Box>
        );

      case 'calendar':
        return (
          <Box sx={{ p: { xs: 2.5, md: 4 } }}>
            <Typography sx={{ fontFamily: FONTS.display, fontWeight: 700, fontSize: { xs: '15px', md: '18px' }, color: c.text1, mb: 3 }}>
              Weekly Slot Bookings (Connaught Place Screen B)
            </Typography>
            <Box sx={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
              <Table sx={{ minWidth: 500 }}>
                <TableHead>
                  <TableRow>
                    {['Hour', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri'].map(day => (
                      <TableCell key={day} sx={{ fontFamily: FONTS.mono, fontSize: '12px', color: c.text3, borderBottom: `1px solid ${c.border}`, py: 1.5 }}>
                        {day}
                      </TableCell>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {['09:00 AM', '12:00 PM', '03:00 PM', '06:00 PM'].map((hour, idx) => (
                    <TableRow key={idx}>
                      <TableCell sx={{ fontFamily: FONTS.mono, fontSize: '11px', color: c.text2, borderBottom: `1px solid ${c.border}`, py: 1.5 }}>{hour}</TableCell>
                      {[1, 2, 3, 4, 5].map(d => {
                        const isBooked = (idx + d) % 3 === 0;
                        return (
                          <TableCell key={d} sx={{ borderBottom: `1px solid ${c.border}`, py: 1.5 }}>
                            {isBooked ? (
                              <Box sx={{ bgcolor: 'rgba(99, 102, 241, 0.1)', border: `1px solid ${COLORS.primaryPurple}`, borderRadius: '6px', py: 0.5, px: 1, textAlign: 'center' }}>
                                <Typography sx={{ fontFamily: FONTS.body, fontSize: '10px', color: COLORS.primaryPurple, fontWeight: 700 }}>Booked</Typography>
                              </Box>
                            ) : (
                              <Typography sx={{ fontFamily: FONTS.body, fontSize: '11px', color: c.text3, textAlign: 'center' }}>-</Typography>
                            )}
                          </TableCell>
                        );
                      })}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Box>
          </Box>
        );

      case 'analytics':
        return (
          <Box sx={{ p: { xs: 2.5, md: 4 } }}>
            <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ sm: 'center' }} gap={1} mb={4}>
              <Typography sx={{ fontFamily: FONTS.display, fontWeight: 700, fontSize: { xs: '15px', md: '18px' }, color: c.text1 }}>
                Audience Impression Metrics
              </Typography>
              <Typography sx={{ fontFamily: FONTS.mono, fontSize: '12px', color: c.text3 }}>Real-Time Feed</Typography>
            </Stack>
            <Grid container spacing={{ xs: 2, md: 3 }}>
              {[
                { title: 'Total Impressions', value: '4,520,290', chg: '+14.2% vs last week' },
                { title: 'Avg Playback Success', value: '99.94%', chg: '0 errors flagged' },
                { title: 'Unique Audience Reach', value: '824,190', chg: 'across 42 zip codes' },
              ].map((card, i) => (
                <Grid size={{ xs: 12, sm: 4 }} key={i}>
                  <Box sx={{ bgcolor: c.surfaceCard, border: `1px solid ${c.border}`, borderRadius: '12px', p: { xs: 2, md: 3 } }}>
                    <Typography sx={{ fontFamily: FONTS.body, fontSize: '12px', color: c.text3, mb: 1 }}>{card.title}</Typography>
                    <Typography sx={{ fontFamily: FONTS.mono, fontSize: { xs: '18px', md: '22px' }, fontWeight: 800, color: c.text1, mb: 0.5 }}>{card.value}</Typography>
                    <Typography sx={{ fontFamily: FONTS.body, fontSize: '11px', color: COLORS.success, fontWeight: 600 }}>{card.chg}</Typography>
                  </Box>
                </Grid>
              ))}
            </Grid>
          </Box>
        );

      case 'monitoring':
        return (
          <Box sx={{ p: { xs: 2.5, md: 4 } }}>
            <Typography sx={{ fontFamily: FONTS.display, fontWeight: 700, fontSize: { xs: '15px', md: '18px' }, color: c.text1, mb: 3 }}>
              Device Hardware Telemetry
            </Typography>
            <Stack gap={2}>
              {[
                { label: 'Airport Lobby Player B', device: 'Raspberry Pi 4', status: 'Online', temp: '42°C', cpu: '18%' },
                { label: 'Phoenix Mall Entrance 1', device: 'Android Box Pro', status: 'Online', temp: '54°C', cpu: '35%' },
                { label: 'Connaught Place Stand 3', device: 'Intel NUC Mini', status: 'Offline', temp: '0°C', cpu: '0%' },
              ].map((item, idx) => (
                <Box key={idx} sx={{ bgcolor: c.surfaceCard, border: `1px solid ${c.border}`, borderRadius: '12px', p: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: { xs: 'wrap', sm: 'nowrap' }, gap: 1 }}>
                  <Stack direction="row" alignItems="center" gap={2} sx={{ minWidth: 0 }}>
                    <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: item.status === 'Online' ? COLORS.success : '#ef4444', flexShrink: 0 }} />
                    <Box sx={{ minWidth: 0 }}>
                      <Typography sx={{ fontFamily: FONTS.body, fontWeight: 600, color: c.text1, fontSize: { xs: '12px', md: '14px' }, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.label}</Typography>
                      <Typography sx={{ fontFamily: FONTS.body, fontSize: '11px', color: c.text3, mt: 0.25 }}>Model: {item.device}</Typography>
                    </Box>
                  </Stack>
                  <Stack direction="row" gap={3} sx={{ flexShrink: 0 }}>
                    <Box>
                      <Typography sx={{ fontFamily: FONTS.mono, fontSize: '10px', color: c.text3 }}>Temp</Typography>
                      <Typography sx={{ fontFamily: FONTS.mono, fontSize: '12px', fontWeight: 700, color: c.text1, mt: 0.25 }}>{item.temp}</Typography>
                    </Box>
                    <Box>
                      <Typography sx={{ fontFamily: FONTS.mono, fontSize: '10px', color: c.text3 }}>CPU</Typography>
                      <Typography sx={{ fontFamily: FONTS.mono, fontSize: '12px', fontWeight: 700, color: c.text1, mt: 0.25 }}>{item.cpu}</Typography>
                    </Box>
                  </Stack>
                </Box>
              ))}
            </Stack>
          </Box>
        );

      case 'media':
        return (
          <Box sx={{ p: { xs: 2.5, md: 4 } }}>
            <Typography sx={{ fontFamily: FONTS.display, fontWeight: 700, fontSize: { xs: '15px', md: '18px' }, color: c.text1, mb: 3 }}>
              Asset Storage & Transcoding Cloud
            </Typography>
            <Grid container spacing={2}>
              {[
                { name: 'Pepsi_Ad_Summer_1080p.mp4', size: '18.4 MB', type: 'video/mp4' },
                { name: 'Nike_Lobby_Banner.png', size: '4.2 MB', type: 'image/png' },
                { name: 'Dominoes_Offer_30s.mp4', size: '12.9 MB', type: 'video/mp4' },
                { name: 'CP_Standee_Interactive.html', size: '1.8 MB', type: 'text/html' },
              ].map((asset, idx) => (
                <Grid size={{ xs: 6, sm: 3 }} key={idx}>
                  <Box sx={{ bgcolor: c.surfaceCard, border: `1px solid ${c.border}`, borderRadius: '12px', p: 2, display: 'flex', flexDirection: 'column', height: { xs: 110, md: 130 }, justifyContent: 'space-between' }}>
                    <Box sx={{ width: 32, height: 32, borderRadius: '8px', bgcolor: 'rgba(99, 102, 241, 0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: COLORS.primaryPurple }}>
                      📁
                    </Box>
                    <Box>
                      <Typography sx={{ fontFamily: FONTS.body, fontSize: { xs: '10px', md: '12px' }, fontWeight: 700, color: c.text1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{asset.name}</Typography>
                      <Typography sx={{ fontFamily: FONTS.mono, fontSize: '10px', color: c.text3, mt: 0.25 }}>{asset.size}</Typography>
                    </Box>
                  </Box>
                </Grid>
              ))}
            </Grid>
          </Box>
        );
    }
  };

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
            Dashboard Tour
          </Typography>
          <Typography
            variant="h2"
            sx={{
              fontFamily: FONTS.display,
              fontWeight: 800,
              fontSize: { xs: '26px', sm: '32px', md: '42px' },
              color: c.text1,
              mb: 2,
            }}
          >
            Manage everything in one central hub
          </Typography>
        </Box>

        <Grid container spacing={{ xs: 2, md: 4 }}>
          {/* Tab Selector - Sidebar on desktop, horizontal scroll on mobile */}
          <Grid size={{ xs: 12, md: 3 }}>
            <Stack className="dashboard-tab-container" gap={1} sx={{ flexDirection: { xs: 'row', md: 'column' }, overflowX: { xs: 'auto', md: 'visible' }, pb: { xs: 1, md: 0 } }}>
              {tabs.map(tab => {
                const TabIcon = tab.icon;
                const isSelected = activeTab === tab.key;
                return (
                  <Button
                    key={tab.key}
                    onClick={() => setActiveTab(tab.key)}
                    startIcon={<TabIcon />}
                    sx={{
                      fontFamily: FONTS.body,
                      textTransform: 'none',
                      justifyContent: { xs: 'center', md: 'flex-start' },
                      fontSize: '13.5px',
                      fontWeight: isSelected ? 700 : 500,
                      color: isSelected ? COLORS.primaryPurple : c.text2,
                      bgcolor: isSelected ? 'rgba(99, 102, 241, 0.08)' : 'transparent',
                      borderRadius: '10px',
                      px: 2.5,
                      py: 1.5,
                      border: isSelected ? `1px solid rgba(99, 102, 241, 0.2)` : '1px solid transparent',
                      whiteSpace: 'nowrap',
                      minWidth: 'auto',
                      flexShrink: 0,
                      '&:hover': {
                        bgcolor: isSelected ? 'rgba(99, 102, 241, 0.12)' : 'rgba(255, 255, 255, 0.02)',
                      },
                    }}
                  >
                    {tab.label}
                  </Button>
                );
              })}
            </Stack>
          </Grid>

          {/* Browser Mockup Window Panel */}
          <Grid size={{ xs: 12, md: 9 }}>
            <Box
              sx={{
                bgcolor: c.surfaceCard,
                border: `1px solid ${c.border}`,
                borderRadius: '16px',
                boxShadow: themeMode === 'light' ? '0 15px 35px rgba(0,0,0,0.02)' : 'none',
                overflow: 'hidden',
                minHeight: { xs: 350, md: 480 },
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              {/* Browser Header Bar */}
              <Box sx={{ bgcolor: themeMode === 'light' ? '#F1F5F9' : '#0F172A', borderBottom: `1px solid ${c.border}`, px: 2.5, py: 1.5, display: 'flex', alignItems: 'center', gap: 1 }}>
                {['#ef4444', '#f59e0b', '#22c55e'].map(color => (
                  <Box key={color} sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: color }} />
                ))}
                <Box sx={{ ml: 2, bgcolor: themeMode === 'light' ? '#FFFFFF' : '#1E293B', borderRadius: '6px', px: 2, py: 0.25, fontSize: '10px', fontFamily: FONTS.mono, color: c.text3, flex: 0.8, maxWidth: 320, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  ccms.pixelspot.in/dashboard
                </Box>
              </Box>

              {/* Dynamic Page content */}
              <Box sx={{ flex: 1, overflowY: 'auto' }}>
                {renderContent()}
              </Box>
            </Box>
          </Grid>
        </Grid>
      </Container>
    </Box>
  );
}
