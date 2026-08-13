import type { ReactNode } from 'react';
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
    Explore as ExploreIcon,
} from '@mui/icons-material';
import { useUserRole } from '../../hooks/useUserRole';
import { useAccountVisibility } from '../../hooks/useAccountVisibility';
import { getMobileNavigation } from '../../constants/roleRouteMatrix';
import type { NavIconKey } from '../../constants/roleRouteMatrix';

export default function MobileBottomNav() {
    const theme = useTheme();
    const navigate = useNavigate();
    const location = useLocation();
    const { role } = useUserRole();
    const { isPrivate } = useAccountVisibility();
    const isMobile = useMediaQuery(theme.breakpoints.down('md'));
    const iconMap: Partial<Record<NavIconKey, ReactNode>> = {
        dashboard: <DashboardIcon />,
        campaigns: <CampaignIcon />,
        screens: <ScreenIcon />,
        bookings: <BookingIcon />,
        analytics: <AnalyticsIcon />,
        discover: <ExploreIcon />,
    };

    const filteredItems = getMobileNavigation({ role, isPrivate }).map((item) => ({
        ...item,
        label: item.text,
        icon: iconMap[item.iconKey] ?? <DashboardIcon />,
    }));

    // Selected tab is purely derived from the current path — compute it during
    // render instead of syncing it into state via an effect.
    const derivedIndex = filteredItems.findIndex(item => location.pathname.startsWith(item.path));
    const value = derivedIndex !== -1 ? derivedIndex : 0;

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
