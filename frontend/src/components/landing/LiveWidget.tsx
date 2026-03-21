import { useState, useEffect, useRef } from 'react';
import { Box, Typography, Stack, IconButton } from '@mui/material';
import ShowChartIcon from '@mui/icons-material/ShowChart';
import CloseIcon from '@mui/icons-material/Close';
import { COLORS, FONTS, MOCK_FEED_MESSAGES } from './landingData';

export default function LiveWidget() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<string[]>([MOCK_FEED_MESSAGES[0]]);
  const idxRef = useRef(1);

  useEffect(() => {
    const id = setInterval(() => {
      const msg = MOCK_FEED_MESSAGES[idxRef.current % MOCK_FEED_MESSAGES.length];
      idxRef.current += 1;
      setItems(prev => [msg, ...prev].slice(0, 5));
    }, 5000);
    return () => clearInterval(id);
  }, []);

  return (
    <Box sx={{ position: 'fixed', bottom: 24, right: 24, zIndex: 900 }}>
      {open ? (
        <Box sx={{
          width: 300, bgcolor: COLORS.surface, borderRadius: '16px', border: `1px solid ${COLORS.border}`,
          boxShadow: '0 20px 60px rgba(0,0,0,0.5)', overflow: 'hidden',
          animation: 'widgetSlide 0.3s cubic-bezier(0.16,1,0.3,1)',
        }}>
          <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ px: 2, py: 1.5, borderBottom: `1px solid ${COLORS.border}` }}>
            <Stack direction="row" alignItems="center" gap={1}>
              <Box className="pulse-dot" />
              <Typography sx={{ fontFamily: FONTS.mono, fontSize: '12px', color: COLORS.text2 }}>Live Activity</Typography>
            </Stack>
            <IconButton size="small" onClick={() => setOpen(false)} sx={{ color: COLORS.text3 }}>
              <CloseIcon sx={{ fontSize: 16 }} />
            </IconButton>
          </Stack>
          <Box sx={{ maxHeight: 220, overflowY: 'auto', px: 2, py: 1 }}>
            {items.map((msg, i) => (
              <Box key={`${i}-${msg}`} className="widget-item" sx={{
                py: 1, borderBottom: i < items.length - 1 ? `1px solid ${COLORS.border}` : 'none',
              }}>
                <Typography sx={{ fontFamily: FONTS.mono, fontSize: '12px', color: COLORS.text2, lineHeight: 1.5 }}>{msg}</Typography>
                <Typography sx={{ fontFamily: FONTS.mono, fontSize: '10px', color: COLORS.text3, mt: 0.3 }}>just now</Typography>
              </Box>
            ))}
          </Box>
        </Box>
      ) : (
        <Box
          onClick={() => setOpen(true)}
          sx={{
            width: 48, height: 48, borderRadius: '50%', bgcolor: COLORS.indigo, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: `0 0 20px ${COLORS.indigoGlow}`,
            transition: 'all 200ms', '&:hover': { transform: 'scale(1.1)' },
            position: 'relative',
          }}
        >
          <ShowChartIcon sx={{ color: '#fff', fontSize: 22 }} />
          <Box className="pulse-dot" sx={{ position: 'absolute', top: 2, right: 2, width: 8, height: 8 }} />
        </Box>
      )}
    </Box>
  );
}
