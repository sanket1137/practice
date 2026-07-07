import { useMemo } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import {
    Box, AppBar, Toolbar, Typography, IconButton, Drawer, List, ListItemButton,
    ListItemIcon, ListItemText, Divider, Avatar, Chip, useTheme, useMediaQuery,
} from '@mui/material';
import MonitorIcon from '@mui/icons-material/Monitor';
import PermMediaIcon from '@mui/icons-material/PermMedia';
import PlaylistPlayIcon from '@mui/icons-material/PlaylistPlay';
import ScheduleIcon from '@mui/icons-material/Schedule';
import GroupIcon from '@mui/icons-material/Group';
import LogoutIcon from '@mui/icons-material/Logout';
import { useAuthStore } from '../../store/authStore';

const DRAWER_WIDTH = 240;

const navItems = [
    { path: '/cms/screens', label: 'Screens', icon: <MonitorIcon /> },
    { path: '/cms/media', label: 'Media Library', icon: <PermMediaIcon /> },
    { path: '/cms/playlists', label: 'Playlists', icon: <PlaylistPlayIcon /> },
    { path: '/cms/schedule', label: 'Schedule', icon: <ScheduleIcon /> },
    { path: '/cms/groups', label: 'Screen Groups', icon: <GroupIcon /> },
];

export default function CmsLayout() {
    const navigate = useNavigate();
    const location = useLocation();
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down('md'));
    const { user, logout } = useAuthStore();

    const activePath = useMemo(() => {
        const match = navItems.find((n) => location.pathname.startsWith(n.path));
        return match?.path ?? '/cms/screens';
    }, [location.pathname]);

    const drawer = (
        <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            <Toolbar sx={{ gap: 1 }}>
                <Avatar sx={{ bgcolor: 'primary.main', width: 32, height: 32 }}>C</Avatar>
                <Box>
                    <Typography variant="subtitle2" fontWeight={700}>PixelSpot CMS</Typography>
                    <Chip size="small" color="secondary" label="CMS Mode" sx={{ height: 16, fontSize: 10 }} />
                </Box>
            </Toolbar>
            <Divider />
            <List sx={{ flex: 1 }}>
                {navItems.map((item) => (
                    <ListItemButton
                        key={item.path}
                        selected={activePath === item.path}
                        onClick={() => navigate(item.path)}
                    >
                        <ListItemIcon>{item.icon}</ListItemIcon>
                        <ListItemText primary={item.label} />
                    </ListItemButton>
                ))}
            </List>
            <Divider />
            <List>
                <ListItemButton onClick={() => { logout(); navigate('/login'); }}>
                    <ListItemIcon><LogoutIcon /></ListItemIcon>
                    <ListItemText primary="Sign out" secondary={user?.email} />
                </ListItemButton>
            </List>
        </Box>
    );

    return (
        <Box sx={{ display: 'flex', minHeight: '100vh' }}>
            <AppBar
                position="fixed"
                sx={{
                    width: { md: `calc(100% - ${DRAWER_WIDTH}px)` },
                    ml: { md: `${DRAWER_WIDTH}px` },
                    bgcolor: 'background.paper',
                    color: 'text.primary',
                    borderBottom: '1px solid',
                    borderColor: 'divider',
                }}
                elevation={0}
            >
                <Toolbar>
                    <IconButton
                        sx={{ mr: 2, display: { md: 'none' } }}
                        onClick={() => navigate('/cms/screens')}
                    >
                        <MonitorIcon />
                    </IconButton>
                    <Typography variant="h6" sx={{ flexGrow: 1 }}>
                        {navItems.find((n) => n.path === activePath)?.label ?? 'CMS'}
                    </Typography>
                </Toolbar>
            </AppBar>
            <Box component="nav" sx={{ width: { md: DRAWER_WIDTH }, flexShrink: { md: 0 } }}>
                <Drawer
                    variant={isMobile ? 'temporary' : 'permanent'}
                    open
                    sx={{ '& .MuiDrawer-paper': { width: DRAWER_WIDTH, boxSizing: 'border-box' } }}
                >
                    {drawer}
                </Drawer>
            </Box>
            <Box
                component="main"
                sx={{
                    flexGrow: 1,
                    width: { md: `calc(100% - ${DRAWER_WIDTH}px)` },
                    p: 3,
                    pt: 10,
                }}
            >
                <Outlet />
            </Box>
        </Box>
    );
}
