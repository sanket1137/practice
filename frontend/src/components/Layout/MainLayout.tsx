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
    Badge,
    Popover,
    Chip,
} from '@mui/material';
import { useNavigate, Outlet, useLocation } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import { useAccountVisibility } from '../../hooks/useAccountVisibility';
import { useWebSocket } from '../../hooks/useWebSocket';
import { useNotifications } from '../../hooks/useNotifications';
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
    Payments as PayoutsIcon,
    Notifications as NotificationsIcon,
    DoneAll as DoneAllIcon,
    Settings as SettingsIcon,
    Security as SecurityIcon,
    VerifiedUser as VerifiedUserIcon,
    Visibility as VisibilityIcon,
} from '@mui/icons-material';

const drawerWidth = 240;

const MainLayout = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const { user, logout } = useAuthStore();
    const { isPrivate } = useAccountVisibility();
    const { connectionState } = useWebSocket();
    const { unreadCount, notifications: recentNotifications, markAsRead, markAllAsRead } = useNotifications();
    const [mobileOpen, setMobileOpen] = useState(false);
    const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
    const [notifAnchorEl, setNotifAnchorEl] = useState<null | HTMLElement>(null);
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
                const items = [
                    { text: 'Dashboard', icon: <DashboardIcon />, path: '/dashboard' },
                    { text: 'My Screens', icon: <ScreenIcon />, path: '/screens' },
                ];
                if (!isPrivate) {
                    items.push(
                        { text: 'Booking Requests', icon: <BookingIcon />, path: '/bookings' },
                        { text: 'Payouts', icon: <PayoutsIcon />, path: '/payouts' },
                    );
                }
                items.push(
                    { text: 'Earnings & Analytics', icon: <AnalyticsIcon />, path: '/analytics' },
                    { text: 'Settings', icon: <SettingsIcon />, path: '/profile' },
                );
                return items;
        }

        if (role === 'Advertiser') {
            return [
                { text: 'Dashboard', icon: <DashboardIcon />, path: '/dashboard' },
                { text: 'Campaigns', icon: <CampaignIcon />, path: '/campaigns' },
                { text: 'Discover Screens', icon: <ExploreIcon />, path: '/screens/discover' },
                { text: 'My Bookings', icon: <BookingIcon />, path: '/bookings' },
                { text: 'Campaign Analytics', icon: <AnalyticsIcon />, path: '/analytics' },
                { text: 'Settings', icon: <SettingsIcon />, path: '/profile' },
            ];
        }

        // Admin - full access
        return [
            { text: 'Dashboard', icon: <DashboardIcon />, path: '/dashboard' },
            { text: 'All Campaigns', icon: <CampaignIcon />, path: '/campaigns' },
            { text: 'All Screens', icon: <ScreenIcon />, path: '/screens' },
            { text: 'All Bookings', icon: <BookingIcon />, path: '/bookings' },
            { text: 'Payouts', icon: <PayoutsIcon />, path: '/admin/payouts' },
            { text: 'Machines', icon: <SecurityIcon />, path: '/admin/machines' },
            { text: 'Verifications', icon: <VerifiedUserIcon />, path: '/admin/verifications' },
            { text: 'Visibility Requests', icon: <VisibilityIcon />, path: '/admin/visibility-requests' },
            { text: 'Platform Analytics', icon: <AnalyticsIcon />, path: '/analytics' },
            { text: 'Settings', icon: <SettingsIcon />, path: '/profile' },
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

                        {/* Notification Bell */}
                        <IconButton
                            color="inherit"
                            onClick={(e) => setNotifAnchorEl(e.currentTarget)}
                        >
                            <Badge badgeContent={unreadCount} color="error" max={99}>
                                <NotificationsIcon />
                            </Badge>
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

            {/* Notification Popover */}
            <Popover
                open={Boolean(notifAnchorEl)}
                anchorEl={notifAnchorEl}
                onClose={() => setNotifAnchorEl(null)}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                transformOrigin={{ vertical: 'top', horizontal: 'right' }}
                slotProps={{
                    paper: {
                        sx: { width: 360, maxHeight: 480 },
                    },
                }}
            >
                <Box sx={{ p: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Typography variant="subtitle1" fontWeight="bold">
                        Notifications
                    </Typography>
                    {unreadCount > 0 && (
                        <IconButton
                            size="small"
                            onClick={() => { markAllAsRead(); }}
                            title="Mark all as read"
                        >
                            <DoneAllIcon fontSize="small" />
                        </IconButton>
                    )}
                </Box>
                <Divider />
                {recentNotifications.length === 0 ? (
                    <Box sx={{ p: 3, textAlign: 'center' }}>
                        <Typography variant="body2" color="text.secondary">
                            No notifications yet
                        </Typography>
                    </Box>
                ) : (
                    <List disablePadding sx={{ maxHeight: 340, overflow: 'auto' }}>
                        {recentNotifications.map((notif) => (
                            <ListItem
                                key={notif.id}
                                disablePadding
                                sx={{
                                    bgcolor: notif.isRead ? 'transparent' : 'action.hover',
                                }}
                            >
                                <ListItemButton
                                    onClick={() => {
                                        if (!notif.isRead) markAsRead(notif.id);
                                        setNotifAnchorEl(null);
                                        if (notif.actionUrl) navigate(notif.actionUrl);
                                    }}
                                    sx={{ py: 1.5 }}
                                >
                                    <ListItemText
                                        primary={notif.title}
                                        secondary={
                                            <Box component="span">
                                                <Typography variant="caption" component="span" display="block" color="text.secondary">
                                                    {notif.message}
                                                </Typography>
                                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
                                                    <Chip
                                                        label={notif.type.replace(/([A-Z])/g, ' $1').trim()}
                                                        size="small"
                                                        variant="outlined"
                                                        sx={{ height: 20, fontSize: '0.65rem' }}
                                                    />
                                                    <Typography variant="caption" color="text.disabled">
                                                        {new Date(notif.createdAt).toLocaleDateString()}
                                                    </Typography>
                                                </Box>
                                            </Box>
                                        }
                                        primaryTypographyProps={{
                                            variant: 'body2',
                                            fontWeight: notif.isRead ? 'normal' : 'bold',
                                        }}
                                    />
                                </ListItemButton>
                            </ListItem>
                        ))}
                    </List>
                )}
                <Divider />
                <Box sx={{ p: 1, textAlign: 'center' }}>
                    <ListItemButton
                        onClick={() => {
                            setNotifAnchorEl(null);
                            navigate('/notifications');
                        }}
                        sx={{ justifyContent: 'center', borderRadius: 1 }}
                    >
                        <Typography variant="body2" color="primary">
                            View All Notifications
                        </Typography>
                    </ListItemButton>
                </Box>
            </Popover>

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
