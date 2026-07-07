import { createTheme } from '@mui/material/styles';

/**
 * PixelSpot Design System v2.0 — Light Premium
 * Single source of visual truth. Aligned with /Learnings/pixelspot_design_system.html.
 * Never override these tokens at component level — extend the theme instead.
 */

// ─── Design tokens (mirror of CSS custom properties in the reference DS) ───
export const tokens = {
  color: {
    primary: '#0a66d8',
    primaryDark: '#084fa8',
    primaryLight: '#3b82f6',
    primaryAlpha08: 'rgba(10,102,216,0.08)',
    primaryAlpha12: 'rgba(10,102,216,0.12)',
    primaryAlpha16: 'rgba(10,102,216,0.16)',
    primaryAlpha24: 'rgba(10,102,216,0.24)',
    success: '#16a34a',
    warning: '#d97706',
    error: '#dc2626',
    info: '#0ea5e9',
    bg: '#f5f6f8',
    paper: '#ffffff',
    textPrimary: '#101828',
    textSecondary: '#667085',
    textTertiary: '#98a2b3',
    border: 'rgba(16,24,40,0.08)',
    borderMid: 'rgba(16,24,40,0.12)',
    borderStrong: 'rgba(16,24,40,0.18)',
  },
  radius: { sm: 8, md: 10, lg: 14, xl: 20 },
  shadow: {
    sm: '0 1px 3px rgba(16,24,40,0.05), 0 1px 2px rgba(16,24,40,0.04)',
    md: '0 4px 16px rgba(16,24,40,0.06), 0 1px 4px rgba(16,24,40,0.04)',
    lg: '0 10px 28px rgba(16,24,40,0.08), 0 2px 8px rgba(16,24,40,0.04)',
    xl: '0 20px 48px rgba(16,24,40,0.10), 0 4px 12px rgba(16,24,40,0.06)',
  },
  font: {
    sans: '"Manrope", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    mono: '"JetBrains Mono", "SF Mono", Menlo, Consolas, monospace',
  },
} as const;

/** Premium hero pattern — apply to top of every page */
export const HERO_PATTERN = {
  p: { xs: 2.5, md: 3.5 },
  mb: 3,
  borderRadius: 3,
  background:
    'radial-gradient(900px 340px at 100% -8%, rgba(10,102,216,0.12), transparent 60%), #ffffff',
  border: `1px solid ${tokens.color.border}`,
  boxShadow: tokens.shadow.md,
} as const;

/** Premium surface — cards, dialogs, inner panels */
export const PREMIUM_SURFACE = {
  backgroundColor: 'background.paper',
  border: `1px solid ${tokens.color.border}`,
  boxShadow: tokens.shadow.lg,
  borderRadius: 3,
} as const;

const theme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: tokens.color.primary,
      light: tokens.color.primaryLight,
      dark: tokens.color.primaryDark,
      contrastText: '#ffffff',
    },
    secondary: {
      main: '#f3f5f9',
      light: '#fafbfc',
      dark: '#dde3ed',
      contrastText: tokens.color.textPrimary,
    },
    success: { main: tokens.color.success },
    warning: { main: tokens.color.warning },
    error: { main: tokens.color.error },
    info: { main: tokens.color.info },
    background: {
      default: tokens.color.bg,
      paper: tokens.color.paper,
    },
    text: {
      primary: tokens.color.textPrimary,
      secondary: tokens.color.textSecondary,
    },
    divider: tokens.color.border,
  },
  shape: {
    borderRadius: tokens.radius.lg,
  },
  typography: {
    fontFamily: tokens.font.sans,
    h1: { fontWeight: 700, fontSize: '2.5rem', letterSpacing: '-0.02em', lineHeight: 1.15 },
    h2: { fontWeight: 700, fontSize: '2rem', letterSpacing: '-0.018em', lineHeight: 1.2 },
    h3: { fontWeight: 700, fontSize: '1.625rem', letterSpacing: '-0.015em', lineHeight: 1.25 },
    h4: { fontWeight: 700, fontSize: '1.375rem', letterSpacing: '-0.012em', lineHeight: 1.3 },
    h5: { fontWeight: 700, fontSize: '1.125rem', letterSpacing: '-0.008em', lineHeight: 1.35 },
    h6: { fontWeight: 700, fontSize: '0.9375rem', letterSpacing: '-0.005em', lineHeight: 1.4 },
    body1: { fontSize: '0.875rem', lineHeight: 1.6 },
    body2: { fontSize: '0.8125rem', lineHeight: 1.55 },
    button: { textTransform: 'none', fontWeight: 600, letterSpacing: '0.1px' },
    caption: { fontSize: '0.75rem', color: tokens.color.textSecondary },
    overline: {
      fontSize: '0.6875rem',
      fontWeight: 700,
      letterSpacing: '1px',
      textTransform: 'uppercase',
    },
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          WebkitFontSmoothing: 'antialiased',
          MozOsxFontSmoothing: 'grayscale',
        },
      },
    },
    MuiButton: {
      defaultProps: { disableElevation: true },
      styleOverrides: {
        root: {
          textTransform: 'none',
          borderRadius: tokens.radius.md,
          fontWeight: 600,
          padding: '8px 18px',
        },
        sizeSmall: { padding: '6px 12px', fontSize: '0.8125rem', borderRadius: 8 },
        sizeLarge: { padding: '12px 24px', fontSize: '0.9375rem', borderRadius: tokens.radius.lg },
        containedPrimary: {
          boxShadow: '0 1px 2px rgba(10,102,216,0.3)',
          '&:hover': { boxShadow: '0 2px 8px rgba(10,102,216,0.35)' },
        },
        outlined: {
          borderColor: tokens.color.borderMid,
          '&:hover': {
            borderColor: tokens.color.primaryAlpha24,
            backgroundColor: tokens.color.primaryAlpha08,
          },
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
          border: `1px solid ${tokens.color.border}`,
          boxShadow: tokens.shadow.md,
        },
        rounded: { borderRadius: tokens.radius.lg },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: tokens.radius.lg,
          border: `1px solid ${tokens.color.border}`,
          backgroundColor: tokens.color.paper,
          boxShadow: tokens.shadow.sm,
          transition: 'box-shadow 150ms ease, transform 150ms ease',
        },
      },
    },
    MuiAppBar: {
      styleOverrides: {
        root: {
          backgroundColor: 'rgba(255, 255, 255, 0.9)',
          backdropFilter: 'blur(12px)',
          borderBottom: `1px solid ${tokens.color.border}`,
          color: tokens.color.textPrimary,
          boxShadow: 'none',
        },
      },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          backgroundColor: tokens.color.paper,
          borderRadius: tokens.radius.md,
          '& .MuiOutlinedInput-notchedOutline': { borderColor: tokens.color.borderMid },
          '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: tokens.color.borderStrong },
          '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
            borderWidth: 1,
            borderColor: tokens.color.primary,
            boxShadow: `0 0 0 3px ${tokens.color.primaryAlpha08}`,
          },
        },
        input: { padding: '10px 12px', fontSize: '0.875rem' },
      },
    },
    MuiInputLabel: {
      styleOverrides: { root: { fontSize: '0.875rem' } },
    },
    MuiChip: {
      styleOverrides: {
        root: { borderRadius: 999, fontWeight: 600, height: 26 },
        sizeSmall: { height: 22, fontSize: '0.6875rem' },
      },
    },
    MuiTableHead: {
      styleOverrides: {
        root: {
          '& .MuiTableCell-head': {
            backgroundColor: tokens.color.bg,
            color: tokens.color.textSecondary,
            fontSize: '0.6875rem',
            fontWeight: 700,
            letterSpacing: '0.8px',
            textTransform: 'uppercase',
            borderBottom: `1px solid ${tokens.color.border}`,
          },
        },
      },
    },
    MuiTableRow: {
      styleOverrides: {
        root: {
          '&:hover': { backgroundColor: 'rgba(10,102,216,0.025)' },
        },
      },
    },
    MuiTableCell: {
      styleOverrides: {
        root: { borderBottom: `1px solid ${tokens.color.border}`, fontSize: '0.8125rem' },
      },
    },
    MuiTab: {
      styleOverrides: {
        root: {
          textTransform: 'none',
          fontWeight: 600,
          fontSize: '0.8125rem',
          minHeight: 40,
        },
      },
    },
    MuiTabs: {
      styleOverrides: {
        indicator: { height: 2 },
      },
    },
    MuiDialog: {
      styleOverrides: {
        paper: {
          borderRadius: tokens.radius.xl,
          border: `1px solid ${tokens.color.border}`,
          boxShadow: tokens.shadow.xl,
        },
      },
    },
    MuiTooltip: {
      styleOverrides: {
        tooltip: {
          backgroundColor: tokens.color.textPrimary,
          fontSize: '0.6875rem',
          padding: '6px 10px',
          borderRadius: tokens.radius.sm,
        },
      },
    },
    MuiContainer: {
      styleOverrides: { root: { paddingTop: 8 } },
    },
  },
});

export default theme;
