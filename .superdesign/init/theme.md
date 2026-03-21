# Theme — PixelSpot CCMS

Framework: React 19 + MUI 7 (Material UI). No Tailwind CSS. No CSS modules. All styling via MUI `sx` prop.

## Full theme.ts

```typescript
import { createTheme } from '@mui/material/styles';

const theme = createTheme({
  palette: {
    mode: 'dark',
    primary: {
      main: '#6366f1', // Indigo
      light: '#818cf8',
      dark: '#4f46e5',
      contrastText: '#ffffff',
    },
    secondary: {
      main: '#ec4899', // Pink
      light: '#f472b6',
      dark: '#db2777',
      contrastText: '#ffffff',
    },
    background: {
      default: '#0f172a', // Slate 900
      paper: '#1e293b',   // Slate 800
    },
    text: {
      primary: '#f8fafc',   // Slate 50
      secondary: '#94a3b8', // Slate 400
    },
  },
  typography: {
    fontFamily: '"Inter", "Roboto", "Helvetica", "Arial", sans-serif',
    h1: { fontWeight: 700, fontSize: '2.5rem' },
    h2: { fontWeight: 600, fontSize: '2rem' },
    h3: { fontWeight: 600, fontSize: '1.75rem' },
    h4: { fontWeight: 600, fontSize: '1.5rem' },
    h5: { fontWeight: 600, fontSize: '1.25rem' },
    h6: { fontWeight: 600, fontSize: '1rem' },
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: 'none',
          borderRadius: 8,
          fontWeight: 600,
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: { backgroundImage: 'none' },
        rounded: { borderRadius: 12 },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: 12,
          border: '1px solid rgba(255, 255, 255, 0.1)',
        },
      },
    },
    MuiAppBar: {
      styleOverrides: {
        root: {
          backgroundColor: 'rgba(15, 23, 42, 0.8)',
          backdropFilter: 'blur(8px)',
          borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
        },
      },
    },
  },
});

export default theme;
```

## Design Tokens Summary

| Token | Value | Use |
|-------|-------|-----|
| primary.main | `#6366f1` | Buttons, links, active states, accents |
| primary.light | `#818cf8` | Hover states, lighter accents |
| primary.dark | `#4f46e5` | Pressed states |
| secondary.main | `#ec4899` | Secondary accents, tags, highlights |
| background.default | `#0f172a` | Page backgrounds |
| background.paper | `#1e293b` | Cards, drawers, dialogs, panels |
| text.primary | `#f8fafc` | Headings, body text |
| text.secondary | `#94a3b8` | Labels, captions, metadata |
| Border | `rgba(255,255,255,0.1)` | Card borders, dividers |
| success | MUI default green | Active, running |
| warning | MUI default amber | Pending, review |
| error | MUI default red | Rejected, failed |
| info | MUI default blue | Approved, informational |

## Glassmorphism Pattern (AppBar)
```css
background-color: rgba(15, 23, 42, 0.8);
backdrop-filter: blur(8px);
border-bottom: 1px solid rgba(255, 255, 255, 0.1);
```

## Typography
- Font: Inter (Google Fonts)
- h1: 2.5rem bold (700)
- h2-h6: fontWeight 600
- Body: MUI defaults

## Responsive Grid Constants
```typescript
RESPONSIVE_GRID = {
  stats: { xs: 12, sm: 6, md: 4, lg: 3 },  // stat cards
  cards: { xs: 12, md: 6, lg: 4 },           // content cards
  half:  { xs: 12, md: 6 },
  third: { xs: 12, sm: 6, md: 4 },
  full:  { xs: 12 },
}
SPACING = { xs: 0.5, sm: 1, md: 2, lg: 3, xl: 4 }
```
