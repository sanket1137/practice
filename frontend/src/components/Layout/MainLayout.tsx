import React, { useState } from 'react';
import { LanguageSwitcher } from '../common/LanguageSwitcher';
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
    Stack,
    Button,
} from '@mui/material';
import { useNavigate, Outlet, useLocation } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import { logoutAndRevoke } from '../../services/api';
import { useAccountVisibility } from '../../hooks/useAccountVisibility';
import { getSidebarNavigation } from '../../constants/roleRouteMatrix';
import { useWebSocket } from '../../hooks/useWebSocket';
import { useNotifications } from '../../hooks/useNotifications';
import ConnectionStatus from '../common/ConnectionStatus';
import MobileBottomNav from './MobileBottomNav';
import BreadcrumbNavigation from '../common/BreadcrumbNavigation';
import GlobalSearch from '../common/GlobalSearch';
import { useGlobalSearch } from '../../hooks/useGlobalSearch';
import QuickActions from '../common/QuickActions';
import KeyboardShortcutsPanel from '../common/KeyboardShortcutsPanel';
import { useKeyboardShortcuts } from '../../hooks/useKeyboardShortcuts';
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
    PermMedia as MediaIcon,
} from '@mui/icons-material';

const drawerWidth = 240;

const MainLayout = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const { user } = useAuthStore();
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
        void logoutAndRevoke();
        navigate('/login');
    };

    const iconMap = {
        dashboard: <DashboardIcon sx={{ fontSize: 16 }} />,
        campaigns: <CampaignIcon sx={{ fontSize: 16 }} />,
        screens: <ScreenIcon sx={{ fontSize: 16 }} />,
        bookings: <BookingIcon sx={{ fontSize: 16 }} />,
        analytics: <AnalyticsIcon sx={{ fontSize: 16 }} />,
        settings: <SettingsIcon sx={{ fontSize: 16 }} />,
        discover: <ExploreIcon sx={{ fontSize: 16 }} />,
        payouts: <PayoutsIcon sx={{ fontSize: 16 }} />,
        machines: <SecurityIcon sx={{ fontSize: 16 }} />,
        verifications: <VerifiedUserIcon sx={{ fontSize: 16 }} />,
        visibility: <VisibilityIcon sx={{ fontSize: 16 }} />,
        media: <MediaIcon sx={{ fontSize: 16 }} />,
    };

    const menuItems = getSidebarNavigation({
        role: user?.role,
        isPrivate,
        accountType: user?.accountType,
    }).map((item) => ({
        ...item,
        icon: iconMap[item.iconKey],
    }));

    // Grouping helper
    const getGroup = (text: string) => {
        if (['Dashboard', 'My Screens', 'Booking Requests', 'Campaigns', 'Media', 'Discover Screens', 'My Bookings', 'All Campaigns', 'All Screens', 'All Bookings'].includes(text)) {
            return 'MAIN';
        }
        if (['Payouts', 'Machines', 'Verifications', 'Visibility Requests'].includes(text)) {
            return 'ADMIN';
        }
        if (['Earnings & Analytics', 'Screen Analytics', 'Campaign Analytics', 'Platform Analytics', 'Analytics'].includes(text)) {
            return 'ANALYTICS';
        }
        if (['Settings'].includes(text)) {
            return 'SYSTEM';
        }
        return 'MAIN';
    };

    // Group items
    const groupedItems: Record<string, typeof menuItems> = {};
    menuItems.forEach((item) => {
        const grp = getGroup(item.text);
        if (!groupedItems[grp]) groupedItems[grp] = [];
        groupedItems[grp].push(item);
    });

    const groupsOrder = ['MAIN', 'ADMIN', 'ANALYTICS', 'SYSTEM'];

    const drawer = (
        <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            {/* Logo area */}
            <Toolbar sx={{ height: 56, minHeight: '56px !important', px: '20px !important', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                <Stack direction="row" alignItems="center" gap={1.5}>
                    <Box sx={{
                        width: 28,
                        height: 28,
                        borderRadius: '6px',
                        backgroundColor: 'primary.main',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#ffffff',
                        fontWeight: 'bold',
                        fontSize: '12px',
                        letterSpacing: '-0.5px'
                    }}>
                        PS
                    </Box>
                    <Typography sx={{
                        fontFamily: "'Inter', system-ui, sans-serif",
                        fontWeight: 500,
                        fontSize: '15px',
                        letterSpacing: '0.05em',
                        color: '#f0f0f0'
                    }}>
                        PixelSpot
                    </Typography>
                </Stack>
            </Toolbar>

            {/* Sidebar list items */}
            <Box sx={{ flexGrow: 1, overflowY: 'auto', py: 2 }}>
                {groupsOrder.map((group) => {
                    const items = groupedItems[group];
                    if (!items || items.length === 0) return null;

                    return (
                        <Box key={group} sx={{ mb: 2 }}>
                            <Typography sx={{
                                fontSize: '10px',
                                fontWeight: 700,
                                letterSpacing: '2.5px',
                                textTransform: 'uppercase',
                                color: '#333333',
                                px: '24px',
                                py: '8px'
                            }}>
                                {group}
                            </Typography>
                            <List disablePadding>
                                {items.map((item) => {
                                    const isActive = location.pathname === item.path;
                                    return (
                                        <ListItem key={item.text} disablePadding sx={{ px: 1, py: 0.25 }}>
                                            <ListItemButton
                                                onClick={() => {
                                                    navigate(item.path);
                                                    setMobileOpen(false);
                                                }}
                                                sx={{
                                                    height: 36,
                                                    px: '12px',
                                                    borderRadius: '8px',
                                                    backgroundColor: isActive ? 'rgba(94,106,210,0.12) !important' : 'transparent',
                                                    borderLeft: isActive ? '2px solid #5e6ad2' : 'none',
                                                    '&:hover': {
                                                        backgroundColor: isActive ? 'rgba(94,106,210,0.12)' : 'rgba(255,255,255,0.04)',
                                                        '& .MuiListItemText-primary': {
                                                            color: isActive ? '#f0f0f0' : '#888888',
                                                        }
                                                    },
                                                    transition: 'all 0.15s ease'
                                                }}
                                            >
                                                <ListItemIcon sx={{
                                                    minWidth: 28,
                                                    color: isActive ? '#f0f0f0' : '#555555',
                                                    opacity: isActive ? 1 : 0.5,
                                                    transition: 'all 0.15s ease'
                                                }}>
                                                    {item.icon}
                                                </ListItemIcon>
                                                <ListItemText
                                                    primary={item.text}
                                                    primaryTypographyProps={{
                                                        sx: {
                                                            fontSize: '13px',
                                                            fontWeight: 500,
                                                            color: isActive ? '#f0f0f0' : '#555555',
                                                            fontFamily: "'Inter', system-ui, sans-serif"
                                                        }
                                                    }}
                                                />
                                            </ListItemButton>
                                        </ListItem>
                                    );
                                })}
                            </List>
                        </Box>
                    );
                })}
            </Box>

            {/* Sidebar Bottom Details */}
            <Box sx={{ p: 2, borderTop: '1px solid rgba(255,255,255,0.05)', backgroundColor: 'rgba(0,0,0,0.2)' }}>
                <Stack direction="row" alignItems="center" spacing={1.5} sx={{ mb: 2 }}>
                    <Avatar sx={{ width: 28, height: 28, bgcolor: 'primary.main', fontSize: '12px' }}>
                        {user?.firstName?.charAt(0)}
                    </Avatar>
                    <Box sx={{ overflow: 'hidden' }}>
                        <Typography noWrap sx={{ fontSize: '13px', fontWeight: 500, color: '#f0f0f0' }}>
                            {user?.firstName} {user?.lastName}
                        </Typography>
                        <Typography noWrap sx={{ fontSize: '10px', color: '#555555', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                            {user?.role}
                        </Typography>
                    </Box>
                </Stack>
                <Button
                    onClick={handleLogout}
                    startIcon={<LogoutIcon sx={{ fontSize: 14 }} />}
                    fullWidth
                    sx={{
                        height: 32,
                        fontSize: '12px',
                        color: '#888888',
                        justifyContent: 'flex-start',
                        px: 1.5,
                        backgroundColor: 'transparent',
                        borderRadius: '6px',
                        '&:hover': {
                            backgroundColor: 'rgba(255,255,255,0.04)',
                            color: '#f0f0f0'
                        }
                    }}
                >
                    Logout
                </Button>
            </Box>
        </Box>
    );

    return (
        <Box sx={{ display: 'flex', bgcolor: '#050505', minHeight: '100vh' }}>
            <AppBar
                position="fixed"
                sx={{
                    width: { sm: `calc(100% - ${drawerWidth}px)` },
                    ml: { sm: `${drawerWidth}px` },
                    height: 56,
                }}
            >
                <Toolbar sx={{ height: 56, minHeight: '56px !important', px: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Stack direction="row" alignItems="center" spacing={2} sx={{ flex: 1 }}>
                        <IconButton
                            color="inherit"
                            aria-label="open drawer"
                            edge="start"
                            onClick={handleDrawerToggle}
                            sx={{ display: { sm: 'none' } }}
                        >
                            <MenuIcon sx={{ fontSize: 20 }} />
                        </IconButton>
                        
                        {/* Centered BreadcrumbNavigation inside AppBar */}
                        <Box sx={{ display: { xs: 'none', sm: 'block' } }}>
                            <BreadcrumbNavigation inAppBar />
                        </Box>
                    </Stack>

                    <Stack direction="row" alignItems="center" spacing={2.5}>
                        <Box sx={{ display: { xs: 'none', md: 'block' } }}>
                            <LanguageSwitcher />
                        </Box>
                        
                        {/* Connection status pill */}
                        <ConnectionStatus status={connectionState} />

                        {/* Global Search Trigger */}
                        <IconButton
                            color="inherit"
                            onClick={() => setSearchOpen(true)}
                            sx={{ color: '#555555', '&:hover': { color: '#f0f0f0' } }}
                        >
                            <SearchIcon sx={{ fontSize: 20 }} />
                        </IconButton>

                        {/* Notification Bell */}
                        <IconButton
                            color="inherit"
                            onClick={(e) => setNotifAnchorEl(e.currentTarget)}
                            sx={{ color: '#555555', '&:hover': { color: '#f0f0f0' } }}
                        >
                            <Badge badgeContent={unreadCount} max={99}>
                                <NotificationsIcon sx={{ fontSize: 20 }} />
                            </Badge>
                        </IconButton>

                        <IconButton onClick={handleProfileMenuOpen} color="inherit" sx={{ p: 0.5 }}>
                            <Avatar sx={{ width: 28, height: 28, bgcolor: 'primary.main', fontSize: '12px' }}>
                                {user?.firstName?.charAt(0)}
                            </Avatar>
                        </IconButton>
                    </Stack>
                </Toolbar>
            </AppBar>

            {/* Profile Dropdown Menu */}
            <Menu
                anchorEl={anchorEl}
                open={Boolean(anchorEl)}
                onClose={handleProfileMenuClose}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                transformOrigin={{ vertical: 'top', horizontal: 'right' }}
            >
                <MenuItem onClick={() => { handleProfileMenuClose(); navigate('/profile'); }}>
                    <ListItemIcon>
                        <AccountIcon fontSize="small" sx={{ color: 'inherit' }} />
                    </ListItemIcon>
                    Profile
                </MenuItem>
                <MenuItem disabled>
                    <ListItemText
                        primary="Role"
                        secondary={user?.role}
                        primaryTypographyProps={{ sx: { fontSize: '11px', color: '#555555', textTransform: 'uppercase', letterSpacing: '0.5px' } }}
                        secondaryTypographyProps={{ sx: { fontSize: '13px', color: '#f0f0f0', fontWeight: 500 } }}
                    />
                </MenuItem>
                <Divider />
                <MenuItem onClick={handleLogout}>
                    <ListItemIcon>
                        <LogoutIcon fontSize="small" sx={{ color: 'inherit' }} />
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
                    <Typography variant="subtitle1" sx={{ fontWeight: 600, fontSize: '14px', color: '#f0f0f0' }}>
                        Notifications
                    </Typography>
                    {unreadCount > 0 && (
                        <IconButton
                            size="small"
                            onClick={() => { markAllAsRead(); }}
                            title="Mark all as read"
                            sx={{ color: '#555555', '&:hover': { color: '#f0f0f0' } }}
                        >
                            <DoneAllIcon fontSize="small" />
                        </IconButton>
                    )}
                </Box>
                <Divider />
                {recentNotifications.length === 0 ? (
                    <Box sx={{ p: 3, textAlign: 'center' }}>
                        <Typography sx={{ fontSize: '13px', color: '#555555' }}>
                            No notifications yet
                        </Typography>
                    </Box>
                ) : (
                    <List disablePadding sx={{ maxHeight: 340, overflowY: 'auto' }}>
                        {recentNotifications.map((notif) => (
                            <ListItem
                                key={notif.id}
                                disablePadding
                                sx={{
                                    borderLeft: notif.isRead ? 'none' : '2px solid #5e6ad2',
                                    bgcolor: notif.isRead ? 'transparent' : 'rgba(94,106,210,0.05)',
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
                                                <Typography sx={{ fontSize: '12px', color: '#888888', mt: 0.5 }}>
                                                    {notif.message}
                                                </Typography>
                                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 1 }}>
                                                    <Chip
                                                        label={notif.type.replace(/([A-Z])/g, ' $1').trim()}
                                                        size="small"
                                                        sx={{ height: 18, fontSize: '9px', fontWeight: 600 }}
                                                    />
                                                    <Typography sx={{ fontSize: '11px', color: '#444444' }}>
                                                        {new Date(notif.createdAt).toLocaleDateString()}
                                                    </Typography>
                                                </Box>
                                            </Box>
                                        }
                                        primaryTypographyProps={{
                                            sx: {
                                                fontSize: '13px',
                                                fontWeight: notif.isRead ? 400 : 600,
                                                color: '#f0f0f0'
                                            }
                                        }}
                                    />
                                </ListItemButton>
                            </ListItem>
                        ))}
                    </List>
                )}
                <Divider />
                <Box sx={{ p: 1, display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                    <ListItemButton
                        onClick={() => {
                            setNotifAnchorEl(null);
                            navigate('/notifications');
                        }}
                        sx={{ justifyContent: 'center', borderRadius: 1 }}
                    >
                        <Typography sx={{ fontSize: '13px', color: '#5e6ad2', fontWeight: 500 }}>
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
                    p: { xs: 3, md: 5 }, // maps to 32px & 40px padding scale
                    width: { sm: `calc(100% - ${drawerWidth}px)` },
                    mt: '56px',
                    mb: { xs: 8, md: 0 },
                    bgcolor: '#050505',
                    minHeight: '100vh',
                }}
            >
                {/* Route Page transition wrap */}
                <div className="anim-fade-in-up">
                    <Outlet />
                </div>
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
