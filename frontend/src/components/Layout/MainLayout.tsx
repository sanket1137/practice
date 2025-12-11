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
    useMediaQuery,
    useTheme,
} from '@mui/material';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
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
    ChevronLeft as ChevronLeftIcon,
    Search as SearchIcon,
} from '@mui/icons-material';

const drawerWidth = 240;
const miniDrawerWidth = 60;

const MainLayout = () => {
    const theme = useTheme();
    const navigate = useNavigate();
    const location = useLocation();
    const { user, logout } = useAuthStore();
    const [mobileOpen, setMobileOpen] = useState(false);
    const [desktopOpen, setDesktopOpen] = useState(true);
    const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
    const isMobile = useMediaQuery(theme.breakpoints.down('md'));
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

    const menuItems = [
        { text: 'Dashboard', icon: <DashboardIcon />, path: '/dashboard', roles: ['Admin', 'ScreenOwner', 'Advertiser'] },
        { text: 'Campaigns', icon: <CampaignIcon />, path: '/campaigns', roles: ['Admin', 'Advertiser'] },
        { text: 'Screens', icon: <ScreenIcon />, path: '/screens', roles: ['Admin', 'ScreenOwner', 'Advertiser'] },
        { text: 'Bookings', icon: <BookingIcon />, path: '/bookings', roles: ['Admin', 'ScreenOwner', 'Advertiser'] },
        { text: 'Analytics', icon: <AnalyticsIcon />, path: '/analytics', roles: ['Admin', 'ScreenOwner', 'Advertiser'] },
    ];

    const filteredMenuItems = menuItems.filter(item =>
        user?.role && item.roles.includes(user.role)
    );

    const drawer = (
        <Box>
            <Toolbar>
                <Typography variant="h6" noWrap component="div">
                    CCMS
                </Typography>
            </Toolbar>
            <Divider />
            <List>
                {filteredMenuItems.map((item) => (
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
                        {filteredMenuItems.find((item) => item.path === location.pathname)?.text || 'CCMS'}
                    </Typography>

                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
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
