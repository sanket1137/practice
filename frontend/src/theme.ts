import { createTheme, type Theme } from '@mui/material/styles';

declare module '@mui/material/styles' {
  interface TypeBackground {
    elevated?: string;
    subtle?: string;
  }
}

export type ThemeMode = 'dark' | 'light';

/**
 * PixelSpot brand tokens, per mode.
 * Dark — the original cinematic black/grey (kept value-for-value).
 * Light — white & cream: warm paper ground, white surfaces, soft neutral
 * shadows; same brand blue so the product reads as one system in both.
 */
const DARK = {
  primary: '#3b6ef5',
  primaryLight: '#5c86ff',
  primaryDark: '#2f58c4',
  accentPurple: '#7a5cff',
  accentPurpleLight: '#b9a6ff',
  accentPurpleDark: '#5f45d6',
  success: '#34d27b',
  successDark: '#1f9d5b',
  warning: '#f59e0b',
  warningDark: '#92400e',
  error: '#f87171',
  errorDark: '#991b1b',
  info: '#5c86ff',
  bg: '#0a0b0f',
  paper: '#14161c',
  elevated: '#191b22',
  subtle: '#1a1c22',
  textPrimary: '#f5f6f8',
  textSecondary: '#9ca1ad',
  textTertiary: '#4d5160',
  textFaint: '#6b7080',
  border: 'rgba(255,255,255,0.06)',
  borderMid: 'rgba(255,255,255,0.08)',
  borderStrong: 'rgba(255,255,255,0.14)',
  hover: 'rgba(255,255,255,0.04)',
  hoverStrong: 'rgba(255,255,255,0.06)',
  inputBg: 'rgba(255,255,255,0.03)',
  tableHeadBg: 'rgba(255,255,255,0.02)',
  chipBg: 'rgba(255,255,255,0.06)',
  appBarBg: 'rgba(10,11,15,0.82)',
  drawerBg: '#0d0e13',
  scrollThumb: 'rgba(255,255,255,0.1)',
  scrollThumbHover: 'rgba(255,255,255,0.2)',
  backdrop: 'rgba(0,0,0,0.75)',
  skeleton: 'rgba(255,255,255,0.05)',
  progressTrack: 'rgba(255,255,255,0.06)',
  shadowSm: '0 1px 3px rgba(0,0,0,0.4), 0 1px 2px rgba(0,0,0,0.3)',
  shadowMd: '0 8px 24px rgba(0,0,0,0.5), 0 2px 8px rgba(0,0,0,0.4)',
  shadowLg: '0 24px 64px rgba(0,0,0,0.7), 0 8px 24px rgba(0,0,0,0.5)',
  shadowMenu: '0 8px 32px rgba(0,0,0,0.6)',
  glow: '0 0 0 1px rgba(59,110,245,0.3), 0 4px 16px rgba(59,110,245,0.15)',
  successSoft: 'rgba(52,210,123,0.12)',
  warningSoft: 'rgba(245,158,11,0.12)',
  errorSoft: 'rgba(248,113,113,0.12)',
  infoSoft: 'rgba(92,134,255,0.12)',
  alertSuccessBg: 'rgba(52,210,123,0.08)', alertSuccessBorder: 'rgba(52,210,123,0.2)', alertSuccessText: '#34d27b',
  alertWarningBg: 'rgba(245,158,11,0.08)', alertWarningBorder: 'rgba(245,158,11,0.2)', alertWarningText: '#f59e0b',
  alertErrorBg: 'rgba(248,113,113,0.08)', alertErrorBorder: 'rgba(248,113,113,0.2)', alertErrorText: '#f87171',
  alertInfoBg: 'rgba(92,134,255,0.08)', alertInfoBorder: 'rgba(92,134,255,0.2)', alertInfoText: '#5c86ff',
} as const;

const LIGHT: Record<keyof typeof DARK, string> = {
  primary: '#3b6ef5',
  primaryLight: '#5c86ff',
  primaryDark: '#2f58c4',
  accentPurple: '#6d4de0',
  accentPurpleLight: '#a08cf0',
  accentPurpleDark: '#5236c2',
  success: '#1f9d5b',
  successDark: '#166f41',
  warning: '#b45309',
  warningDark: '#8a3f06',
  error: '#dc2626',
  errorDark: '#a31515',
  info: '#3b6ef5',
  bg: '#f6f4ee',           // cream ground
  paper: '#ffffff',        // white surfaces
  elevated: '#ffffff',
  subtle: '#f1efe8',
  textPrimary: '#17181c',
  textSecondary: '#5c6068',
  textTertiary: '#a3a7b0',
  textFaint: '#8a8f99',
  border: 'rgba(23,24,28,0.08)',
  borderMid: 'rgba(23,24,28,0.10)',
  borderStrong: 'rgba(23,24,28,0.16)',
  hover: 'rgba(23,24,28,0.04)',
  hoverStrong: 'rgba(23,24,28,0.06)',
  inputBg: 'rgba(23,24,28,0.02)',
  tableHeadBg: 'rgba(23,24,28,0.02)',
  chipBg: 'rgba(23,24,28,0.06)',
  appBarBg: 'rgba(246,244,238,0.85)',
  drawerBg: '#faf8f2',
  scrollThumb: 'rgba(23,24,28,0.15)',
  scrollThumbHover: 'rgba(23,24,28,0.28)',
  backdrop: 'rgba(23,24,28,0.35)',
  skeleton: 'rgba(23,24,28,0.06)',
  progressTrack: 'rgba(23,24,28,0.08)',
  shadowSm: '0 1px 2px rgba(23,24,28,0.05), 0 1px 3px rgba(23,24,28,0.04)',
  shadowMd: '0 8px 24px rgba(23,24,28,0.08), 0 2px 8px rgba(23,24,28,0.05)',
  shadowLg: '0 24px 64px rgba(23,24,28,0.12), 0 8px 24px rgba(23,24,28,0.07)',
  shadowMenu: '0 8px 32px rgba(23,24,28,0.12)',
  glow: '0 0 0 1px rgba(59,110,245,0.25), 0 4px 16px rgba(59,110,245,0.12)',
  successSoft: 'rgba(31,157,91,0.10)',
  warningSoft: 'rgba(180,83,9,0.10)',
  errorSoft: 'rgba(220,38,38,0.08)',
  infoSoft: 'rgba(59,110,245,0.08)',
  alertSuccessBg: 'rgba(31,157,91,0.08)', alertSuccessBorder: 'rgba(31,157,91,0.25)', alertSuccessText: '#166f41',
  alertWarningBg: 'rgba(180,83,9,0.08)', alertWarningBorder: 'rgba(180,83,9,0.25)', alertWarningText: '#8a3f06',
  alertErrorBg: 'rgba(220,38,38,0.06)', alertErrorBorder: 'rgba(220,38,38,0.22)', alertErrorText: '#a31515',
  alertInfoBg: 'rgba(59,110,245,0.07)', alertInfoBorder: 'rgba(59,110,245,0.22)', alertInfoText: '#2f58c4',
};

export const getModeTokens = (mode: ThemeMode): Record<keyof typeof DARK, string> =>
  mode === 'light' ? LIGHT : DARK;

/**
 * Backward-compatible token surface (dark values) — kept for existing imports.
 */
export const tokens = {
  color: {
    primary: DARK.primary,
    primaryLight: DARK.primaryLight,
    primaryDark: DARK.primaryDark,
    primaryAlpha08: 'rgba(59,110,245,0.08)',
    primaryAlpha12: 'rgba(59,110,245,0.12)',
    primaryAlpha16: 'rgba(59,110,245,0.16)',
    primaryAlpha24: 'rgba(59,110,245,0.24)',
    accentPurple: DARK.accentPurple,
    accentPurpleLight: DARK.accentPurpleLight,
    success: DARK.success,
    warning: DARK.warning,
    error: DARK.error,
    info: DARK.info,
    bg: DARK.bg,
    paper: DARK.paper,
    textPrimary: DARK.textPrimary,
    textSecondary: DARK.textSecondary,
    textTertiary: DARK.textTertiary,
    border: DARK.border,
    borderMid: DARK.borderMid,
    borderStrong: DARK.borderStrong,
  },
  radius: { sm: 6, md: 10, lg: 20, xl: 32, pill: 9999 },
  shadow: { sm: DARK.shadowSm, md: DARK.shadowMd, lg: DARK.shadowLg, glow: DARK.glow },
  font: {
    sans: "'Inter', system-ui, sans-serif",
    display: "'Space Grotesk', 'Inter', system-ui, sans-serif",
    mono: "'Space Mono', 'JetBrains Mono', monospace",
  },
} as const;

export const HERO_PATTERN = {
  p: { xs: 3, md: 4 },
  mb: 4,
  borderRadius: `${tokens.radius.lg}px`,
  background:
    'radial-gradient(900px 340px at 100% -8%, rgba(59,110,245,0.12), transparent 60%), #14161c',
  border: `1px solid ${tokens.color.border}`,
  boxShadow: tokens.shadow.sm,
} as const;

export const PREMIUM_SURFACE = {
  backgroundColor: 'background.paper',
  border: `1px solid ${tokens.color.border}`,
  boxShadow: tokens.shadow.sm,
  borderRadius: `${tokens.radius.lg}px`,
} as const;

export function buildTheme(mode: ThemeMode): Theme {
  const c = getModeTokens(mode);
  return createTheme({
    spacing: 8,
    palette: {
      mode,
      primary: { main: c.primary, light: c.primaryLight, dark: c.primaryDark, contrastText: '#ffffff' },
      secondary: { main: c.accentPurple, light: c.accentPurpleLight, dark: c.accentPurpleDark, contrastText: '#ffffff' },
      success: { main: c.success, dark: c.successDark, light: c.successSoft },
      warning: { main: c.warning, dark: c.warningDark, light: c.warningSoft },
      error: { main: c.error, dark: c.errorDark, light: c.errorSoft },
      info: { main: c.info, light: c.infoSoft },
      background: { default: c.bg, paper: c.paper, elevated: c.elevated, subtle: c.subtle },
      text: { primary: c.textPrimary, secondary: c.textSecondary, disabled: c.textTertiary },
      divider: c.border,
    },
    shape: { borderRadius: tokens.radius.md },
    typography: {
      fontFamily: tokens.font.sans,
      h1: { fontFamily: tokens.font.display, fontSize: '40px', fontWeight: 700, letterSpacing: '-1.2px', lineHeight: 1.05 },
      h2: { fontFamily: tokens.font.display, fontSize: '32px', fontWeight: 700, letterSpacing: '-0.8px', lineHeight: 1.1 },
      h3: { fontFamily: tokens.font.display, fontSize: '24px', fontWeight: 600, letterSpacing: '-0.5px', lineHeight: 1.15 },
      h4: { fontFamily: tokens.font.display, fontSize: '18px', fontWeight: 600, letterSpacing: '-0.3px', lineHeight: 1.3 },
      h5: { fontSize: '14px', fontWeight: 600, letterSpacing: '0px', lineHeight: 1.4 },
      h6: { fontSize: '12px', fontWeight: 600, letterSpacing: '0.5px', lineHeight: 1.4 },
      body1: { fontSize: '14px', fontWeight: 400, lineHeight: 1.65 },
      body2: { fontSize: '13px', fontWeight: 400, lineHeight: 1.6, color: c.textSecondary },
      caption: { fontSize: '11px', fontWeight: 500, letterSpacing: '0.3px' },
      overline: { fontFamily: tokens.font.mono, fontSize: '10px', fontWeight: 700, letterSpacing: '2.5px', textTransform: 'uppercase' },
      button: { textTransform: 'none', fontWeight: 600, letterSpacing: '-0.1px' },
    },
    components: {
      MuiCssBaseline: {
        styleOverrides: {
          // Theme surface as CSS variables so plain-string sx (hero panels
          // etc.) can reference the active mode without importing the theme.
          ':root': {
            '--ps-surface': c.paper,
            '--ps-border': c.border,
            '--ps-bg': c.bg,
            colorScheme: mode,
          },
          body: {
            // !important: index.html (the standalone landing page) sets its own
            // dark body background; without this the light theme renders dark
            // text on a black ground.
            backgroundColor: `${c.bg} !important`,
            color: c.textPrimary,
            WebkitFontSmoothing: 'antialiased',
            MozOsxFontSmoothing: 'grayscale',
            scrollbarWidth: 'thin',
            scrollbarColor: `${c.scrollThumb} transparent`,
            transition: 'background-color 0.25s ease',
            '&::-webkit-scrollbar': { width: '4px', height: '4px' },
            '&::-webkit-scrollbar-track': { background: 'transparent' },
            '&::-webkit-scrollbar-thumb': { background: c.scrollThumb, borderRadius: '2px' },
            '&::-webkit-scrollbar-thumb:hover': { background: c.scrollThumbHover },
          },
          // Paint the app's own ground too — belt and braces against any
          // page-level CSS the landing document ships with.
          '#root': {
            backgroundColor: c.bg,
            minHeight: '100vh',
            transition: 'background-color 0.25s ease',
          },
          '@keyframes ps-fade-up': {
            from: { opacity: 0, transform: 'translateY(6px)' },
            to: { opacity: 1, transform: 'translateY(0)' },
          },
        },
      },
      MuiAppBar: {
        styleOverrides: {
          root: {
            backgroundColor: c.appBarBg,
            backdropFilter: 'blur(20px)',
            borderBottom: `1px solid ${c.border}`,
            boxShadow: 'none',
            backgroundImage: 'none',
            color: c.textPrimary,
          },
        },
      },
      MuiDrawer: {
        styleOverrides: {
          paper: {
            backgroundColor: c.drawerBg,
            borderRight: `1px solid ${c.border}`,
            width: '240px',
            boxShadow: 'none',
          },
        },
      },
      MuiCard: {
        styleOverrides: {
          root: {
            backgroundColor: c.paper,
            border: `1px solid ${c.border}`,
            borderRadius: '16px',
            backgroundImage: 'none',
            boxShadow: c.shadowSm,
            position: 'relative',
            overflow: 'hidden',
            animation: 'ps-fade-up 320ms cubic-bezier(0.2, 0.8, 0.2, 1) both',
            transition: 'all 0.25s cubic-bezier(0.2, 0.8, 0.2, 1)',
            '&:hover': {
              boxShadow: c.shadowMd,
              transform: 'translateY(-2px)',
              '&::after': { transform: 'translateX(100%)' },
            },
            '&::after': {
              content: '""',
              position: 'absolute',
              top: 0, left: 0, right: 0,
              height: '1px',
              background: mode === 'dark'
                ? 'linear-gradient(90deg, transparent, rgba(255,255,255,0.1), transparent)'
                : 'linear-gradient(90deg, transparent, rgba(23,24,28,0.08), transparent)',
              transform: 'translateX(-100%)',
              transition: 'transform 600ms ease-in-out',
            },
          },
        },
      },
      MuiPaper: {
        styleOverrides: {
          root: {
            backgroundColor: c.paper,
            backgroundImage: 'none',
            border: `1px solid ${c.border}`,
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
            '&:active': { transform: 'scale(0.97)' },
          },
          containedPrimary: {
            backgroundColor: c.primary,
            padding: '9px 22px',
            '&:hover': { backgroundColor: c.primaryLight, transform: 'translateY(-1px)' },
          },
          outlined: {
            padding: '8px 22px',
            borderColor: c.borderMid,
            '&:hover': { borderColor: c.borderStrong },
          },
          text: {
            color: c.textSecondary,
            '&:hover': { color: c.textPrimary, backgroundColor: c.hover },
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
            backgroundColor: c.chipBg,
            color: c.textSecondary,
          },
        },
      },
      MuiTableContainer: {
        styleOverrides: {
          root: {
            backgroundColor: c.paper,
            borderRadius: '16px',
            border: `1px solid ${c.border}`,
            boxShadow: 'none',
          },
        },
      },
      MuiTableHead: {
        styleOverrides: {
          root: {
            '& .MuiTableCell-head': {
              backgroundColor: c.tableHeadBg,
              color: c.textFaint,
              fontSize: '10px',
              fontWeight: 700,
              letterSpacing: '2px',
              textTransform: 'uppercase',
              borderBottom: `1px solid ${c.border}`,
              padding: '12px 20px',
            },
          },
        },
      },
      MuiTableCell: {
        styleOverrides: {
          root: {
            color: c.textSecondary,
            fontSize: '13px',
            borderBottom: `1px solid ${c.border}`,
            padding: '14px 20px',
          },
        },
      },
      MuiTableRow: {
        styleOverrides: {
          root: {
            transition: 'background 0.15s ease',
            '&:hover': { backgroundColor: `${c.hover} !important` },
          },
        },
      },
      MuiTextField: {
        styleOverrides: {
          root: {
            backgroundColor: c.inputBg,
            borderRadius: '10px',
            '& .MuiOutlinedInput-notchedOutline': { borderColor: c.borderMid },
            '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: c.borderStrong },
            '& .Mui-focused .MuiOutlinedInput-notchedOutline': {
              borderColor: c.primary,
              boxShadow: '0 0 0 3px rgba(59,110,245,0.15)',
            },
            '& input': { color: c.textPrimary },
            '& label': { color: c.textFaint },
            '& label.Mui-focused': { color: c.primary },
          },
        },
      },
      MuiOutlinedInput: {
        styleOverrides: {
          root: {
            backgroundColor: c.inputBg,
            borderRadius: '10px',
            '& .MuiOutlinedInput-notchedOutline': { borderColor: c.borderMid },
            '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: c.borderStrong },
            '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
              borderColor: c.primary,
              boxShadow: '0 0 0 3px rgba(59,110,245,0.15)',
            },
            '& input': { color: c.textPrimary },
          },
        },
      },
      MuiDialog: {
        styleOverrides: {
          paper: {
            backgroundColor: c.elevated,
            border: `1px solid ${c.borderMid}`,
            borderRadius: '20px',
            boxShadow: c.shadowLg,
          },
          container: {
            '& .MuiBackdrop-root': {
              backgroundColor: c.backdrop,
              backdropFilter: 'blur(8px)',
            },
          },
        },
      },
      MuiMenu: {
        styleOverrides: {
          paper: {
            backgroundColor: c.elevated,
            border: `1px solid ${c.borderMid}`,
            borderRadius: '12px',
            boxShadow: c.shadowMenu,
          },
        },
      },
      MuiPopover: {
        styleOverrides: {
          paper: {
            backgroundColor: c.elevated,
            border: `1px solid ${c.borderMid}`,
            borderRadius: '12px',
            boxShadow: c.shadowMenu,
          },
        },
      },
      MuiMenuItem: {
        styleOverrides: {
          root: {
            fontSize: '13px',
            color: c.textSecondary,
            borderRadius: '6px',
            margin: '2px 6px',
            padding: '8px 12px',
            transition: 'all 0.2s cubic-bezier(0.2,0.8,0.2,1)',
            '&:hover': { backgroundColor: c.hoverStrong, color: c.textPrimary },
          },
        },
      },
      MuiTooltip: {
        styleOverrides: {
          tooltip: {
            backgroundColor: mode === 'dark' ? c.subtle : '#25262b',
            border: `1px solid ${mode === 'dark' ? c.borderMid : 'transparent'}`,
            color: '#f5f6f8',
            fontSize: '12px',
            borderRadius: '8px',
            padding: '6px 12px',
          },
        },
      },
      MuiTabs: {
        styleOverrides: {
          indicator: { backgroundColor: c.primary, height: '1px' },
        },
      },
      MuiTab: {
        styleOverrides: {
          root: {
            textTransform: 'none',
            fontWeight: 500,
            fontSize: '13px',
            color: c.textFaint,
            minWidth: 'auto',
            padding: '10px 18px',
            transition: 'all 0.2s cubic-bezier(0.2,0.8,0.2,1)',
            '&.Mui-selected': { color: c.textPrimary },
          },
        },
      },
      MuiLinearProgress: {
        styleOverrides: {
          root: { backgroundColor: c.progressTrack },
          bar: { backgroundColor: c.primary },
        },
      },
      MuiSkeleton: {
        styleOverrides: { root: { backgroundColor: c.skeleton } },
      },
      MuiAlert: {
        styleOverrides: {
          root: { borderRadius: '12px', border: '1px solid' },
          filledSuccess: { backgroundColor: c.alertSuccessBg, borderColor: c.alertSuccessBorder, color: c.alertSuccessText },
          outlinedSuccess: { backgroundColor: c.alertSuccessBg, borderColor: c.alertSuccessBorder, color: c.alertSuccessText },
          standardSuccess: { backgroundColor: c.alertSuccessBg, borderColor: c.alertSuccessBorder, color: c.alertSuccessText },
          filledWarning: { backgroundColor: c.alertWarningBg, borderColor: c.alertWarningBorder, color: c.alertWarningText },
          outlinedWarning: { backgroundColor: c.alertWarningBg, borderColor: c.alertWarningBorder, color: c.alertWarningText },
          standardWarning: { backgroundColor: c.alertWarningBg, borderColor: c.alertWarningBorder, color: c.alertWarningText },
          filledError: { backgroundColor: c.alertErrorBg, borderColor: c.alertErrorBorder, color: c.alertErrorText },
          outlinedError: { backgroundColor: c.alertErrorBg, borderColor: c.alertErrorBorder, color: c.alertErrorText },
          standardError: { backgroundColor: c.alertErrorBg, borderColor: c.alertErrorBorder, color: c.alertErrorText },
          filledInfo: { backgroundColor: c.alertInfoBg, borderColor: c.alertInfoBorder, color: c.alertInfoText },
          outlinedInfo: { backgroundColor: c.alertInfoBg, borderColor: c.alertInfoBorder, color: c.alertInfoText },
          standardInfo: { backgroundColor: c.alertInfoBg, borderColor: c.alertInfoBorder, color: c.alertInfoText },
        },
      },
      MuiSwitch: {
        styleOverrides: {
          switchBase: { color: c.textPrimary },
          track: {
            backgroundColor: mode === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(23,24,28,0.2)',
            opacity: 1,
            '.Mui-checked + &': { backgroundColor: 'rgba(59,110,245,0.5)', opacity: 1 },
          },
        },
      },
      MuiDivider: {
        styleOverrides: { root: { borderColor: c.border } },
      },
      MuiBadge: {
        styleOverrides: { badge: { backgroundColor: c.primary, color: '#ffffff' } },
      },
    },
  });
}

const theme = buildTheme('dark');
export default theme;
