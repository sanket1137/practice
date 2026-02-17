import React, { useState } from 'react';
import {
    Box,
    AppBar,
    Toolbar,
    Typography,
    IconButton,
    Drawer,
    List,
    ListItem,
    ListItemButton,
    ListItemIcon,
    ListItemText,
    Divider,
    Avatar,
    Menu,
    MenuItem,
} from '@mui/material';
import { useNavigate, Outlet, useLocation } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import { useWebSocket } from '../../hooks/useWebSocket';
import ConnectionStatus from '../common/ConnectionStatus';
import MobileBottomNav from './MobileBottomNav';
import BreadcrumbNavigation from '../common/BreadcrumbNavigation';
import GlobalSearch, { useGlobalSearch } from '../common/GlobalSearch';
import QuickActions from '../common/QuickActions';
import KeyboardShortcutsPanel, { useKeyboardShortcuts } from '../common/KeyboardShortcutsPanel';
import {
    Menu as MenuIcon,
    Dashboard as DashboardIcon,
    Campaign as CampaignIcon,
    Tv as ScreenIcon,
    BookOnline as BookingIcon,
    BarChart as AnalyticsIcon,
    AccountCircle as AccountIcon,
    Logout as LogoutIcon,
    Search as SearchIcon,
    Explore as ExploreIcon,
} from '@mui/icons-material';

const drawerWidth = 240;

const MainLayout = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const { user, logout } = useAuthStore();
    const { connectionState } = useWebSocket();
    const [mobileOpen, setMobileOpen] = useState(false);
    const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
    const { open: searchOpen, setOpen: setSearchOpen } = useGlobalSearch();
    const { open: shortcutsOpen, setOpen: setShortcutsOpen } = useKeyboardShortcuts();

    const handleDrawerToggle = () => {
        setMobileOpen(!mobileOpen);
    };

    const handleProfileMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
        setAnchorEl(event.currentTarget);
    };

    const handleProfileMenuClose = () => {
        setAnchorEl(null);
    };

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    // Role-specific menu items with appropriate labels
    const getMenuItems = () => {
        const role = user?.role;

        if (role === 'ScreenOwner') {
            return [
                { text: 'Dashboard', icon: <DashboardIcon />, path: '/dashboard' },
                { text: 'My Screens', icon: <ScreenIcon />, path: '/screens' },
                { text: 'Booking Requests', icon: <BookingIcon />, path: '/bookings' },
                { text: 'Earnings & Analytics', icon: <AnalyticsIcon />, path: '/analytics' },
            ];
        }

        if (role === 'Advertiser') {
            return [
                { text: 'Dashboard', icon: <DashboardIcon />, path: '/dashboard' },
                { text: 'Campaigns', icon: <CampaignIcon />, path: '/campaigns' },
                { text: 'Discover Screens', icon: <ExploreIcon />, path: '/screens/discover' },
                { text: 'My Bookings', icon: <BookingIcon />, path: '/bookings' },
                { text: 'Campaign Analytics', icon: <AnalyticsIcon />, path: '/analytics' },
            ];
        }

        // Admin - full access
        return [
            { text: 'Dashboard', icon: <DashboardIcon />, path: '/dashboard' },
            { text: 'All Campaigns', icon: <CampaignIcon />, path: '/campaigns' },
            { text: 'All Screens', icon: <ScreenIcon />, path: '/screens' },
            { text: 'All Bookings', icon: <BookingIcon />, path: '/bookings' },
            { text: 'Platform Analytics', icon: <AnalyticsIcon />, path: '/analytics' },
        ];
    };

    const menuItems = getMenuItems();

    const drawer = (
        <Box>
            <Toolbar>
                <Typography variant="h6" noWrap component="div">
                    CCMS
                </Typography>
            </Toolbar>
            <Divider />
            <List>
                {menuItems.map((item) => (
                    <ListItem key={item.text} disablePadding>
                        <ListItemButton
                            selected={location.pathname === item.path}
                            onClick={() => {
                                navigate(item.path);
                                setMobileOpen(false);
                            }}
                        >
                            <ListItemIcon>{item.icon}</ListItemIcon>
                            <ListItemText primary={item.text} />
                        </ListItemButton>
                    </ListItem>
                ))}
            </List>
        </Box>
    );

    return (
        <Box sx={{ display: 'flex' }}>
            <AppBar
                position="fixed"
                sx={{
                    width: { sm: `calc(100% - ${drawerWidth}px)` },
                    ml: { sm: `${drawerWidth}px` },
                }}
            >
                <Toolbar>
                    <IconButton
                        color="inherit"
                        aria-label="open drawer"
                        edge="start"
                        onClick={handleDrawerToggle}
                        sx={{ mr: 2, display: { sm: 'none' } }}
                    >
                        <MenuIcon />
                    </IconButton>

                    <Typography variant="h6" noWrap component="div" sx={{ flexGrow: 1 }}>
                        {menuItems.find((item) => item.path === location.pathname)?.text || 'CCMS'}
                    </Typography>

                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        {/* WebSocket Connection Status */}
                        <ConnectionStatus status={connectionState} />

                        {/* Global Search Trigger */}
                        <IconButton
                            color="inherit"
                            onClick={() => setSearchOpen(true)}
                            sx={{ display: { xs: 'none', md: 'inline-flex' } }}
                        >
                            <SearchIcon />
                        </IconButton>

                        <Typography variant="body2" sx={{ display: { xs: 'none', sm: 'block' } }}>
                            {user?.firstName} {user?.lastName}
                        </Typography>
                        <IconButton onClick={handleProfileMenuOpen} color="inherit">
                            <Avatar sx={{ width: 32, height: 32, bgcolor: 'secondary.main' }}>
                                {user?.firstName?.charAt(0)}
                            </Avatar>
                        </IconButton>
                    </Box>
                </Toolbar>
            </AppBar>

            <Menu
                anchorEl={anchorEl}
                open={Boolean(anchorEl)}
                onClose={handleProfileMenuClose}
                anchorOrigin={{
                    vertical: 'bottom',
                    horizontal: 'right',
                }}
                transformOrigin={{
                    vertical: 'top',
                    horizontal: 'right',
                }}
            >
                <MenuItem onClick={handleProfileMenuClose}>
                    <ListItemIcon>
                        <AccountIcon fontSize="small" />
                    </ListItemIcon>
                    Profile
                </MenuItem>
                <MenuItem disabled>
                    <ListItemText
                        primary="Role"
                        secondary={user?.role}
                        primaryTypographyProps={{ variant: 'body2', color: 'textSecondary' }}
                        secondaryTypographyProps={{ variant: 'body2', fontWeight: 'bold' }}
                    />
                </MenuItem>
                <Divider />
                <MenuItem onClick={handleLogout}>
                    <ListItemIcon>
                        <LogoutIcon fontSize="small" />
                    </ListItemIcon>
                    Logout
                </MenuItem>
            </Menu>

            <Box
                component="nav"
                sx={{ width: { sm: drawerWidth }, flexShrink: { sm: 0 } }}
            >
                <Drawer
                    variant="temporary"
                    open={mobileOpen}
                    onClose={handleDrawerToggle}
                    ModalProps={{
                        keepMounted: true,
                    }}
                    sx={{
                        display: { xs: 'block', sm: 'none' },
                        '& .MuiDrawer-paper': { boxSizing: 'border-box', width: drawerWidth },
                    }}
                >
                    {drawer}
                </Drawer>
                <Drawer
                    variant="permanent"
                    sx={{
                        display: { xs: 'none', sm: 'block' },
                        '& .MuiDrawer-paper': { boxSizing: 'border-box', width: drawerWidth },
                    }}
                    open
                >
                    {drawer}
                </Drawer>
            </Box>

            <Box
                component="main"
                sx={{
                    flexGrow: 1,
                    p: 3,
                    width: { sm: `calc(100% - ${drawerWidth}px)` },
                    mt: 8,
                    mb: { xs: 8, md: 0 }, // Add bottom margin for mobile bottom nav
                    bgcolor: 'background.default',
                    minHeight: '100vh',
                }}
            >
                {/* Breadcrumb Navigation */}
                <BreadcrumbNavigation />

                <Outlet />
            </Box>

            {/* Mobile bottom navigation */}
            <MobileBottomNav />

            {/* Global Search Dialog */}
            <GlobalSearch open={searchOpen} onClose={() => setSearchOpen(false)} />

            {/* Keyboard Shortcuts Panel */}
            <KeyboardShortcutsPanel open={shortcutsOpen} onClose={() => setShortcutsOpen(false)} />

            {/* Quick Actions Speed Dial */}
            <QuickActions />
        </Box>
    );
};

export default MainLayout;
