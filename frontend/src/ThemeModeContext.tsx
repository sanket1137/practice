import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import DarkModeIcon from '@mui/icons-material/DarkModeOutlined';
import LightModeIcon from '@mui/icons-material/LightModeOutlined';
import { buildTheme, type ThemeMode } from './theme';

const STORAGE_KEY = 'ps-theme-mode';

const ThemeModeContext = createContext<{ mode: ThemeMode; toggle: () => void }>({
    mode: 'dark',
    toggle: () => { },
});

export const useThemeMode = () => useContext(ThemeModeContext);

const readStored = (): ThemeMode => {
    try {
        const v = localStorage.getItem(STORAGE_KEY);
        return v === 'light' ? 'light' : 'dark';
    } catch {
        return 'dark';
    }
};

/**
 * App-wide theme mode: black & grey (dark) or white & cream (light), toggled
 * by the user and persisted per browser. Wraps MUI's ThemeProvider so every
 * component re-themes from a single source of truth.
 */
export function ThemeModeProvider({ children }: { children: ReactNode }) {
    const [mode, setMode] = useState<ThemeMode>(readStored);

    const toggle = useCallback(() => {
        setMode((prev) => {
            const next = prev === 'dark' ? 'light' : 'dark';
            try { localStorage.setItem(STORAGE_KEY, next); } catch { /* private mode */ }
            return next;
        });
    }, []);

    const theme = useMemo(() => buildTheme(mode), [mode]);
    const ctx = useMemo(() => ({ mode, toggle }), [mode, toggle]);

    return (
        <ThemeModeContext.Provider value={ctx}>
            <ThemeProvider theme={theme}>
                <CssBaseline />
                {children}
            </ThemeProvider>
        </ThemeModeContext.Provider>
    );
}

/** Sun/moon toggle for the app bar. */
export function ThemeToggle() {
    const { mode, toggle } = useThemeMode();
    return (
        <Tooltip title={mode === 'dark' ? 'Switch to light (white & cream)' : 'Switch to dark (black & grey)'} arrow>
            <IconButton onClick={toggle} size="small" sx={{ color: 'text.secondary' }}>
                {mode === 'dark' ? <LightModeIcon fontSize="small" /> : <DarkModeIcon fontSize="small" />}
            </IconButton>
        </Tooltip>
    );
}
