import { Breadcrumbs, Link, Typography, Box } from '@mui/material';
import { NavigateNext as NavigateNextIcon, Home as HomeIcon } from '@mui/icons-material';
import { useNavigate, useLocation } from 'react-router-dom';

interface BreadcrumbItem {
    label: string;
    path?: string;
}

interface BreadcrumbNavigationProps {
    items?: BreadcrumbItem[];
}

// Route-based breadcrumb generation
const generateBreadcrumbs = (pathname: string): BreadcrumbItem[] => {
    const paths = pathname.split('/').filter(Boolean);
    const breadcrumbs: BreadcrumbItem[] = [{ label: 'Dashboard', path: '/dashboard' }];

    // Map routes to readable names
    const routeLabels: Record<string, string> = {
        campaigns: 'Campaigns',
        screens: 'Screens',
        bookings: 'Bookings',
        analytics: 'Analytics',
        creatives: 'Creatives',
        new: 'Create New',
        edit: 'Edit',
    };

    let currentPath = '';
    paths.forEach((path, index) => {
        currentPath += `/${path}`;

        // Skip certain paths like 'new' or 'edit' if not last
        if ((path === 'new' || path === 'edit') && index < paths.length - 1) {
            return;
        }

        // If it's a GUID/ID, show as "Details"
        const isId = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(path);

        breadcrumbs.push({
            label: isId ? 'Details' : (routeLabels[path] || path),
            path: index === paths.length - 1 ? undefined : currentPath,
        });
    });

    return breadcrumbs;
};

export default function BreadcrumbNavigation({ items }: BreadcrumbNavigationProps) {
    const navigate = useNavigate();
    const location = useLocation();

    const breadcrumbs = items || generateBreadcrumbs(location.pathname);

    if (breadcrumbs.length <= 1) {
        return null; // Don't show breadcrumbs if only on dashboard
    }

    return (
        <Box mb={3}>
            <Breadcrumbs
                separator={<NavigateNextIcon fontSize="small" />}
                aria-label="breadcrumb"
            >
                {breadcrumbs.map((crumb, index) => {
                    const isLast = index === breadcrumbs.length - 1;

                    if (isLast || !crumb.path) {
                        return (
                            <Typography
                                key={index}
                                color="text.primary"
                                fontWeight="medium"
                            >
                                {crumb.label}
                            </Typography>
                        );
                    }

                    return (
                        <Link
                            key={index}
                            underline="hover"
                            color="inherit"
                            onClick={() => navigate(crumb.path!)}
                            sx={{
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: 0.5,
                            }}
                        >
                            {index === 0 && <HomeIcon fontSize="small" />}
                            {crumb.label}
                        </Link>
                    );
                })}
            </Breadcrumbs>
        </Box>
    );
}
