import { createTheme } from '@mui/material/styles';

declare module '@mui/material/styles' {
  interface TypeBackground {
    elevated?: string;
    subtle?: string;
  }
}

/**
 * PixelSpot Premium Cinematic Dark Theme tokens.
 */
export const tokens = {
  color: {
    primary: '#5e6ad2',
    primaryLight: '#7b85e0',
    primaryDark: '#4a54b8',
    primaryAlpha08: 'rgba(94,106,210,0.08)',
    primaryAlpha12: 'rgba(94,106,210,0.12)',
    primaryAlpha16: 'rgba(94,106,210,0.16)',
    primaryAlpha24: 'rgba(94,106,210,0.24)',
    success: '#4ade80',
    warning: '#f59e0b',
    error: '#f87171',
    info: '#60a5fa',
    bg: '#050505',
    paper: '#0f0f0f',
    textPrimary: '#f0f0f0',
    textSecondary: '#888888',
    textTertiary: '#444444',
    border: 'rgba(255,255,255,0.06)',
    borderMid: 'rgba(255,255,255,0.08)',
    borderStrong: 'rgba(255,255,255,0.14)',
  },
  radius: { sm: 6, md: 10, lg: 16, xl: 22, pill: 9999 },
  shadow: {
    sm: '0 1px 3px rgba(0,0,0,0.4), 0 1px 2px rgba(0,0,0,0.3)',
    md: '0 8px 24px rgba(0,0,0,0.5), 0 2px 8px rgba(0,0,0,0.4)',
    lg: '0 24px 64px rgba(0,0,0,0.7), 0 8px 24px rgba(0,0,0,0.5)',
    glow: '0 0 0 1px rgba(94,106,210,0.3), 0 4px 16px rgba(94,106,210,0.15)',
  },
  font: {
    sans: "'Inter', system-ui, sans-serif",
    mono: "'JetBrains Mono', 'Fira Code', monospace",
  },
} as const;

/** Premium hero pattern — updated for dark cinematic theme */
export const HERO_PATTERN = {
  p: { xs: 3, md: 4 },
  mb: 4,
  borderRadius: `${tokens.radius.lg}px`,
  background:
    'radial-gradient(900px 340px at 100% -8%, rgba(94,106,210,0.12), transparent 60%), #0f0f0f',
  border: `1px solid ${tokens.color.border}`,
  boxShadow: tokens.shadow.sm,
} as const;

/** Premium surface — cards, dialogs, inner panels */
export const PREMIUM_SURFACE = {
  backgroundColor: 'background.paper',
  border: `1px solid ${tokens.color.border}`,
  boxShadow: tokens.shadow.sm,
  borderRadius: `${tokens.radius.lg}px`,
} as const;

const theme = createTheme({
  spacing: 8, // maps spacing(1) = 8px
  palette: {
    mode: 'dark',
    primary: {
      main: tokens.color.primary,
      light: tokens.color.primaryLight,
      dark: tokens.color.primaryDark,
      contrastText: '#ffffff',
    },
    success: {
      main: tokens.color.success,
      dark: '#166534',
      light: 'rgba(74,222,128,0.12)',
    },
    warning: {
      main: tokens.color.warning,
      dark: '#92400e',
      light: 'rgba(245,158,11,0.12)',
    },
    error: {
      main: tokens.color.error,
      dark: '#991b1b',
      light: 'rgba(248,113,113,0.12)',
    },
    info: {
      main: tokens.color.info,
      light: 'rgba(96,165,250,0.12)',
    },
    background: {
      default: tokens.color.bg,
      paper: tokens.color.paper,
      elevated: '#161616',
      subtle: '#1a1a1a',
    },
    text: {
      primary: tokens.color.textPrimary,
      secondary: tokens.color.textSecondary,
      disabled: tokens.color.textTertiary,
    },
    divider: tokens.color.border,
  },
  shape: {
    borderRadius: tokens.radius.md,
  },
  typography: {
    fontFamily: tokens.font.sans,
    h1: { fontSize: '40px', fontWeight: 300, letterSpacing: '-1.5px', lineHeight: 1.1 },
    h2: { fontSize: '32px', fontWeight: 300, letterSpacing: '-1px', lineHeight: 1.15 },
    h3: { fontSize: '24px', fontWeight: 400, letterSpacing: '-0.5px', lineHeight: 1.2 },
    h4: { fontSize: '18px', fontWeight: 500, letterSpacing: '-0.3px', lineHeight: 1.3 },
    h5: { fontSize: '14px', fontWeight: 600, letterSpacing: '0px', lineHeight: 1.4 },
    h6: { fontSize: '12px', fontWeight: 600, letterSpacing: '0.5px', lineHeight: 1.4 },
    body1: { fontSize: '14px', fontWeight: 400, lineHeight: 1.65 },
    body2: { fontSize: '13px', fontWeight: 400, lineHeight: 1.6, color: tokens.color.textSecondary },
    caption: { fontSize: '11px', fontWeight: 500, letterSpacing: '0.3px' },
    overline: { fontSize: '10px', fontWeight: 700, letterSpacing: '2px', textTransform: 'uppercase' },
    button: { textTransform: 'none', fontWeight: 500, letterSpacing: '-0.1px' },
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          backgroundColor: '#050505',
          color: '#f0f0f0',
          WebkitFontSmoothing: 'antialiased',
          MozOsxFontSmoothing: 'grayscale',
          scrollbarWidth: 'thin',
          scrollbarColor: 'rgba(255,255,255,0.1) transparent',
          '&::-webkit-scrollbar': {
            width: '4px',
            height: '4px',
          },
          '&::-webkit-scrollbar-track': {
            background: 'transparent',
          },
          '&::-webkit-scrollbar-thumb': {
            background: 'rgba(255,255,255,0.1)',
            borderRadius: '2px',
          },
          '&::-webkit-scrollbar-thumb:hover': {
            background: 'rgba(255,255,255,0.2)',
          },
        },
      },
    },
    MuiAppBar: {
      styleOverrides: {
        root: {
          backgroundColor: 'rgba(5,5,5,0.88)',
          backdropFilter: 'blur(20px)',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
          boxShadow: 'none',
          backgroundImage: 'none',
        },
      },
    },
    MuiDrawer: {
      styleOverrides: {
        paper: {
          backgroundColor: '#0a0a0a',
          borderRight: '1px solid rgba(255,255,255,0.05)',
          width: '240px',
          boxShadow: 'none',
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          backgroundColor: '#0f0f0f',
          border: '1px solid rgba(255,255,255,0.06)',
          borderRadius: '16px',
          backgroundImage: 'none',
          boxShadow: '0 1px 3px rgba(0,0,0,0.4)',
          position: 'relative',
          overflow: 'hidden',
          transition: 'all 0.25s cubic-bezier(0.2, 0.8, 0.2, 1)',
          '&:hover': {
            boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
            transform: 'translateY(-2px)',
            '&::after': {
              transform: 'translateX(100%)',
            },
          },
          // Card shimmer effect on hover
          '&::after': {
            content: '""',
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: '1px',
            background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.1), transparent)',
            transform: 'translateX(-100%)',
            transition: 'transform 600ms ease-in-out',
          },
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundColor: '#0f0f0f',
          backgroundImage: 'none',
          border: '1px solid rgba(255,255,255,0.06)',
          borderRadius: '16px',
          boxShadow: 'none',
        },
      },
    },
    MuiButton: {
      defaultProps: { disableElevation: true },
      styleOverrides: {
        root: {
          textTransform: 'none',
          borderRadius: '9999px',
          fontWeight: 500,
          letterSpacing: '-0.1px',
          transition: 'all 0.2s cubic-bezier(0.2,0.8,0.2,1)',
          '&:active': {
            transform: 'scale(0.97)',
          },
        },
        containedPrimary: {
          backgroundColor: '#5e6ad2',
          padding: '9px 22px',
          '&:hover': {
            backgroundColor: '#4a54b8',
            transform: 'translateY(-1px)',
          },
        },
        outlined: {
          padding: '8px 22px',
          borderColor: 'rgba(255,255,255,0.12)',
          '&:hover': {
            borderColor: 'rgba(255,255,255,0.24)',
          },
        },
        text: {
          color: '#888888',
          '&:hover': {
            color: '#f0f0f0',
            backgroundColor: 'rgba(255,255,255,0.04)',
          },
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          borderRadius: '6px',
          fontWeight: 500,
          fontSize: '11px',
          letterSpacing: '0.2px',
          backgroundColor: 'rgba(255,255,255,0.06)',
          color: '#888888',
        },
      },
    },
    MuiTableContainer: {
      styleOverrides: {
        root: {
          backgroundColor: '#0f0f0f',
          borderRadius: '16px',
          border: '1px solid rgba(255,255,255,0.06)',
          boxShadow: 'none',
        },
      },
    },
    MuiTableHead: {
      styleOverrides: {
        root: {
          '& .MuiTableCell-head': {
            backgroundColor: 'rgba(255,255,255,0.02)',
            color: '#555555',
            fontSize: '10px',
            fontWeight: 700,
            letterSpacing: '2px',
            textTransform: 'uppercase',
            borderBottom: '1px solid rgba(255,255,255,0.06)',
            padding: '12px 20px',
          },
        },
      },
    },
    MuiTableCell: {
      styleOverrides: {
        root: {
          color: '#888888',
          fontSize: '13px',
          borderBottom: '1px solid rgba(255,255,255,0.04)',
          padding: '14px 20px',
        },
      },
    },
    MuiTableRow: {
      styleOverrides: {
        root: {
          transition: 'background 0.15s ease',
          '&:hover': {
            backgroundColor: 'rgba(255,255,255,0.02) !important',
          },
        },
      },
    },
    MuiTextField: {
      styleOverrides: {
        root: {
          backgroundColor: 'rgba(255,255,255,0.03)',
          borderRadius: '10px',
          '& .MuiOutlinedInput-notchedOutline': {
            borderColor: 'rgba(255,255,255,0.08)',
          },
          '&:hover .MuiOutlinedInput-notchedOutline': {
            borderColor: 'rgba(255,255,255,0.16)',
          },
          '& .Mui-focused .MuiOutlinedInput-notchedOutline': {
            borderColor: '#5e6ad2',
            boxShadow: '0 0 0 3px rgba(94,106,210,0.15)',
          },
          '& input': {
            color: '#f0f0f0',
          },
          '& label': {
            color: '#555555',
          },
          '& label.Mui-focused': {
            color: '#5e6ad2',
          },
        },
      },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          backgroundColor: 'rgba(255,255,255,0.03)',
          borderRadius: '10px',
          '& .MuiOutlinedInput-notchedOutline': {
            borderColor: 'rgba(255,255,255,0.08)',
          },
          '&:hover .MuiOutlinedInput-notchedOutline': {
            borderColor: 'rgba(255,255,255,0.16)',
          },
          '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
            borderColor: '#5e6ad2',
            boxShadow: '0 0 0 3px rgba(94,106,210,0.15)',
          },
          '& input': {
            color: '#f0f0f0',
          },
        },
      },
    },
    MuiDialog: {
      styleOverrides: {
        paper: {
          backgroundColor: '#161616',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: '20px',
          boxShadow: '0 24px 64px rgba(0,0,0,0.7)',
        },
        container: {
          '& .MuiBackdrop-root': {
            backgroundColor: 'rgba(0,0,0,0.75)',
            backdropFilter: 'blur(8px)',
          },
        },
      },
    },
    MuiMenu: {
      styleOverrides: {
        paper: {
          backgroundColor: '#161616',
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: '12px',
          boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
        },
      },
    },
    MuiPopover: {
      styleOverrides: {
        paper: {
          backgroundColor: '#161616',
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: '12px',
          boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
        },
      },
    },
    MuiMenuItem: {
      styleOverrides: {
        root: {
          fontSize: '13px',
          color: '#888888',
          borderRadius: '6px',
          margin: '2px 6px',
          padding: '8px 12px',
          transition: 'all 0.2s cubic-bezier(0.2,0.8,0.2,1)',
          '&:hover': {
            backgroundColor: 'rgba(255,255,255,0.05)',
            color: '#f0f0f0',
          },
        },
      },
    },
    MuiTooltip: {
      styleOverrides: {
        tooltip: {
          backgroundColor: '#1a1a1a',
          border: '1px solid rgba(255,255,255,0.1)',
          color: '#f0f0f0',
          fontSize: '12px',
          borderRadius: '8px',
          padding: '6px 12px',
        },
      },
    },
    MuiTabs: {
      styleOverrides: {
        indicator: {
          backgroundColor: '#5e6ad2',
          height: '1px',
        },
      },
    },
    MuiTab: {
      styleOverrides: {
        root: {
          textTransform: 'none',
          fontWeight: 500,
          fontSize: '13px',
          color: '#555555',
          minWidth: 'auto',
          padding: '10px 18px',
          transition: 'all 0.2s cubic-bezier(0.2,0.8,0.2,1)',
          '&.Mui-selected': {
            color: '#f0f0f0',
          },
        },
      },
    },
    MuiLinearProgress: {
      styleOverrides: {
        root: {
          backgroundColor: 'rgba(255,255,255,0.06)',
        },
        bar: {
          backgroundColor: '#5e6ad2',
        },
      },
    },
    MuiSkeleton: {
      styleOverrides: {
        root: {
          backgroundColor: 'rgba(255,255,255,0.05)',
        },
      },
    },
    MuiAlert: {
      styleOverrides: {
        root: {
          borderRadius: '12px',
          border: '1px solid',
        },
        filledSuccess: {
          backgroundColor: 'rgba(74,222,128,0.08)',
          borderColor: 'rgba(74,222,128,0.2)',
          color: '#4ade80',
        },
        outlinedSuccess: {
          backgroundColor: 'rgba(74,222,128,0.08)',
          borderColor: 'rgba(74,222,128,0.2)',
          color: '#4ade80',
        },
        standardSuccess: {
          backgroundColor: 'rgba(74,222,128,0.08)',
          borderColor: 'rgba(74,222,128,0.2)',
          color: '#4ade80',
        },
        filledWarning: {
          backgroundColor: 'rgba(245,158,11,0.08)',
          borderColor: 'rgba(245,158,11,0.2)',
          color: '#f59e0b',
        },
        outlinedWarning: {
          backgroundColor: 'rgba(245,158,11,0.08)',
          borderColor: 'rgba(245,158,11,0.2)',
          color: '#f59e0b',
        },
        standardWarning: {
          backgroundColor: 'rgba(245,158,11,0.08)',
          borderColor: 'rgba(245,158,11,0.2)',
          color: '#f59e0b',
        },
        filledError: {
          backgroundColor: 'rgba(248,113,113,0.08)',
          borderColor: 'rgba(248,113,113,0.2)',
          color: '#f87171',
        },
        outlinedError: {
          backgroundColor: 'rgba(248,113,113,0.08)',
          borderColor: 'rgba(248,113,113,0.2)',
          color: '#f87171',
        },
        standardError: {
          backgroundColor: 'rgba(248,113,113,0.08)',
          borderColor: 'rgba(248,113,113,0.2)',
          color: '#f87171',
        },
        filledInfo: {
          backgroundColor: 'rgba(96,165,250,0.08)',
          borderColor: 'rgba(96,165,250,0.2)',
          color: '#60a5fa',
        },
        outlinedInfo: {
          backgroundColor: 'rgba(96,165,250,0.08)',
          borderColor: 'rgba(96,165,250,0.2)',
          color: '#60a5fa',
        },
        standardInfo: {
          backgroundColor: 'rgba(96,165,250,0.08)',
          borderColor: 'rgba(96,165,250,0.2)',
          color: '#60a5fa',
        },
      },
    },
    MuiSwitch: {
      styleOverrides: {
        switchBase: {
          color: '#f0f0f0',
        },
        track: {
          backgroundColor: 'rgba(255,255,255,0.1)',
          opacity: 1,
          '.Mui-checked + &': {
            backgroundColor: 'rgba(94,106,210,0.5)',
            opacity: 1,
          },
        },
      },
    },
    MuiDivider: {
      styleOverrides: {
        root: {
          borderColor: 'rgba(255,255,255,0.06)',
        },
      },
    },
    MuiBadge: {
      styleOverrides: {
        badge: {
          backgroundColor: '#5e6ad2',
          color: '#ffffff',
        },
      },
    },
  },
});

export default theme;
