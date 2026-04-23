import { useState, useEffect } from 'react';
import {
    BottomNavigation,
    BottomNavigationAction,
    Paper,
    useMediaQuery,
    useTheme,
} from '@mui/material';
import { useNavigate, useLocation } from 'react-router-dom';
import {
    Dashboard as DashboardIcon,
    Campaign as CampaignIcon,
    Tv as ScreenIcon,
    BookOnline as BookingIcon,
    BarChart as AnalyticsIcon,
} from '@mui/icons-material';
import { useUserRole } from '../../hooks/useUserRole';
import { useAccountVisibility } from '../../hooks/useAccountVisibility';

export default function MobileBottomNav() {
    const theme = useTheme();
    const navigate = useNavigate();
    const location = useLocation();
    const { isAdvertiser, isScreenOwner } = useUserRole();
    const { isPrivate } = useAccountVisibility();
    const isMobile = useMediaQuery(theme.breakpoints.down('md'));
    const [value, setValue] = useState(0);

    // Define navigation items based on role
    const navItems = [
        { label: 'Dashboard', icon: <DashboardIcon />, path: '/dashboard', roles: ['all'] },
        { label: 'Campaigns', icon: <CampaignIcon />, path: '/campaigns', roles: ['Advertiser'] },
        { label: 'Screens', icon: <ScreenIcon />, path: '/screens', roles: ['all'] },
        { label: 'Bookings', icon: <BookingIcon />, path: '/bookings', roles: ['all'], hideForPrivate: true },
        { label: 'Analytics', icon: <AnalyticsIcon />, path: '/analytics', roles: ['all'] },
    ];

    // Filter items based on role and visibility
    const filteredItems = navItems.filter(item => {
        if (isPrivate && isScreenOwner && item.hideForPrivate) return false;
        if (item.roles.includes('all')) return true;
        if (isAdvertiser && item.roles.includes('Advertiser')) return true;
        if (isScreenOwner && item.roles.includes('ScreenOwner')) return true;
        return false;
    });

    // Update selected value based on current path
    useEffect(() => {
        const currentIndex = filteredItems.findIndex(item =>
            location.pathname.startsWith(item.path)
        );
        if (currentIndex !== -1) {
            setValue(currentIndex);
        }
    }, [location.pathname, filteredItems]);

    // Only show on mobile devices
    if (!isMobile) {
        return null;
    }

    return (
        <Paper
            sx={{
                position: 'fixed',
                bottom: 0,
                left: 0,
                right: 0,
                zIndex: theme.zIndex.appBar,
            }}
            elevation={3}
        >
            <BottomNavigation
                value={value}
                onChange={(_event, newValue) => {
                    setValue(newValue);
                    navigate(filteredItems[newValue].path);
                }}
                showLabels
            >
                {filteredItems.map((item) => (
                    <BottomNavigationAction
                        key={item.path}
                        label={item.label}
                        icon={item.icon}
                    />
                ))}
            </BottomNavigation>
        </Paper>
    );
}
