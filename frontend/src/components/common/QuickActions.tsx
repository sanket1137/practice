import { useState } from 'react';
import {
    SpeedDial,
    SpeedDialAction,
    SpeedDialIcon,
} from '@mui/material';
import {
    Add as AddIcon,
    Campaign as CampaignIcon,
    Tv as ScreenIcon,
    BookOnline as BookingIcon,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useUserRole } from '../../hooks/useUserRole';

export default function QuickActions() {
    const [open, setOpen] = useState(false);
    const navigate = useNavigate();
    const { isAdvertiser, isScreenOwner } = useUserRole();

    const actions = [
        {
            icon: <CampaignIcon />,
            name: 'New Campaign',
            onClick: () => navigate('/campaigns/new'),
            roles: ['Advertiser'],
        },
        {
            icon: <BookingIcon />,
            name: 'New Booking',
            onClick: () => navigate('/bookings/new'),
            roles: ['Advertiser'],
        },
        {
            icon: <ScreenIcon />,
            name: 'Add Screen',
            onClick: () => navigate('/screens/new'),
            roles: ['ScreenOwner'],
        },
    ];

    const filteredActions = actions.filter((action) => {
        if (action.roles.includes('Advertiser') && isAdvertiser) return true;
        if (action.roles.includes('ScreenOwner') && isScreenOwner) return true;
        return false;
    });

    if (filteredActions.length === 0) {
        return null;
    }

    return (
        <SpeedDial
            ariaLabel="Quick actions"
            sx={{
                position: 'fixed',
                bottom: { xs: 72, md: 16 }, // Higher on mobile to avoid bottom nav
                right: 16,
            }}
            icon={<SpeedDialIcon openIcon={<AddIcon />} />}
            onClose={() => setOpen(false)}
            onOpen={() => setOpen(true)}
            open={open}
        >
            {filteredActions.map((action) => (
                <SpeedDialAction
                    key={action.name}
                    icon={action.icon}
                    tooltipTitle={action.name}
                    tooltipOpen
                    onClick={() => {
                        action.onClick();
                        setOpen(false);
                    }}
                />
            ))}
        </SpeedDial>
    );
}
