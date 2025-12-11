import { Card, CardContent, Typography, Box, Chip, Stack, Avatar, Divider } from '@mui/material';
import {
    CalendarMonth,
    AttachMoney,
    TrendingUp,
    CheckCircle,
} from '@mui/icons-material';
import { format } from 'date-fns';

interface RecentActivity {
    id: string;
    type: 'booking' | 'campaign' | 'approval' | 'payment';
    title: string;
    subtitle: string;
    timestamp: string;
    status?: string;
    amount?: number;
}

interface RecentActivityWidgetProps {
    activities: RecentActivity[];
    maxItems?: number;
}

const activityIcons = {
    booking: <CalendarMonth />,
    campaign: <TrendingUp />,
    approval: <CheckCircle />,
    payment: <AttachMoney />,
};

const activityColors = {
    booking: 'info',
    campaign: 'primary',
    approval: 'success',
    payment: 'warning',
} as const;

export default function RecentActivityWidget({
    activities,
    maxItems = 5,
}: RecentActivityWidgetProps) {
    const displayActivities = activities.slice(0, maxItems);

    return (
        <Card>
            <CardContent>
                <Typography variant="h6" gutterBottom>
                    Recent Activity
                </Typography>
                <Stack spacing={2} divider={<Divider />}>
                    {displayActivities.length === 0 ? (
                        <Typography variant="body2" color="text.secondary" textAlign="center" py={4}>
                            No recent activity
                        </Typography>
                    ) : (
                        displayActivities.map((activity) => (
                            <Box key={activity.id} display="flex" alignItems="flex-start" gap={2}>
                                <Avatar
                                    sx={{
                                        bgcolor: `${activityColors[activity.type]}.light`,
                                        color: `${activityColors[activity.type]}.dark`,
                                        width: 40,
                                        height: 40,
                                    }}
                                >
                                    {activityIcons[activity.type]}
                                </Avatar>
                                <Box flex={1}>
                                    <Typography variant="body2" fontWeight="medium">
                                        {activity.title}
                                    </Typography>
                                    <Typography variant="caption" color="text.secondary">
                                        {activity.subtitle}
                                    </Typography>
                                    <Box display="flex" alignItems="center" gap={1} mt={0.5}>
                                        <Typography variant="caption" color="text.secondary">
                                            {format(new Date(activity.timestamp), 'MMM dd, HH:mm')}
                                        </Typography>
                                        {activity.status && (
                                            <Chip label={activity.status} size="small" />
                                        )}
                                    </Box>
                                </Box>
                                {activity.amount && (
                                    <Typography variant="body2" fontWeight="bold" color="success.main">
                                        ${activity.amount.toLocaleString()}
                                    </Typography>
                                )}
                            </Box>
                        ))
                    )}
                </Stack>
            </CardContent>
        </Card>
    );
}
