import React, { useState } from 'react';
import {
    Box,
    Typography,
    Paper,
    List,
    ListItem,
    ListItemButton,
    ListItemText,
    Chip,
    Button,
    Pagination,
    Skeleton,
    Alert,
} from '@mui/material';
import { DoneAll as DoneAllIcon } from '@mui/icons-material';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { getNotifications, markAsRead, markAllAsRead } from '../../services/notificationApi';
import type { NotificationsResponse } from '../../types/notification';
import { useQueryClient } from '@tanstack/react-query';

const PAGE_SIZE = 20;

const typeColorMap: Record<string, 'success' | 'error' | 'warning' | 'info' | 'default'> = {
    BookingCreated: 'info',
    BookingApproved: 'success',
    BookingRejected: 'error',
    BookingCancelled: 'warning',
    PaymentReceived: 'success',
    PayoutProcessed: 'success',
    RefundProcessed: 'warning',
    SystemAlert: 'default',
    BookingUpdated: 'info',
};

const NotificationsPage: React.FC = () => {
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const [page, setPage] = useState(1);

    const { data, isLoading, error } = useQuery<NotificationsResponse>({
        queryKey: ['notifications', page],
        queryFn: () => getNotifications(page, PAGE_SIZE),
    });

    const handleMarkAsRead = async (id: string) => {
        await markAsRead(id);
        queryClient.invalidateQueries({ queryKey: ['notifications'] });
        queryClient.invalidateQueries({ queryKey: ['notifications-unread-count'] });
        queryClient.invalidateQueries({ queryKey: ['notifications-recent'] });
    };

    const handleMarkAllAsRead = async () => {
        await markAllAsRead();
        queryClient.invalidateQueries({ queryKey: ['notifications'] });
        queryClient.invalidateQueries({ queryKey: ['notifications-unread-count'] });
        queryClient.invalidateQueries({ queryKey: ['notifications-recent'] });
    };

    const totalPages = data ? Math.ceil(data.totalCount / PAGE_SIZE) : 0;

    return (
        <Box>
            <Paper
                sx={{
                    p: { xs: 2, md: 3 },
                    mb: 3,
                    borderRadius: 3,
                    background:
                        'radial-gradient(900px 340px at 100% -8%, rgba(10,102,216,0.12), transparent 60%), #ffffff',
                }}
            >
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2, flexWrap: 'wrap' }}>
                    <Box>
                        <Typography variant="h5" fontWeight="bold">
                            Notifications
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                            Action-needed updates, delivery events, and platform alerts.
                        </Typography>
                    </Box>
                    <Button
                        variant="outlined"
                        size="small"
                        startIcon={<DoneAllIcon />}
                        onClick={handleMarkAllAsRead}
                    >
                        Mark all as read
                    </Button>
                </Box>
            </Paper>

            {error && (
                <Alert severity="error" sx={{ mb: 2 }}>
                    Failed to load notifications
                </Alert>
            )}

            <Paper variant="outlined">
                {isLoading ? (
                    <Box sx={{ p: 2 }}>
                        {[...Array(5)].map((_, i) => (
                            <Skeleton key={i} height={72} sx={{ mb: 1 }} />
                        ))}
                    </Box>
                ) : !data?.items?.length ? (
                    <Box sx={{ p: 4, textAlign: 'center' }}>
                        <Typography color="text.secondary">
                            No notifications yet
                        </Typography>
                    </Box>
                ) : (
                    <List disablePadding>
                        {data.items.map((notif, index) => (
                            <React.Fragment key={notif.id}>
                                <ListItem
                                    disablePadding
                                    sx={{
                                        bgcolor: notif.isRead ? 'transparent' : 'rgba(10,102,216,0.06)',
                                        borderBottom: index < data.items.length - 1 ? '1px solid' : 'none',
                                        borderColor: 'divider',
                                    }}
                                >
                                    <ListItemButton
                                        onClick={() => {
                                            if (!notif.isRead) handleMarkAsRead(notif.id);
                                            if (notif.actionUrl) navigate(notif.actionUrl);
                                        }}
                                        sx={{ py: 2 }}
                                    >
                                        <ListItemText
                                            primary={
                                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                    <Typography
                                                        variant="body1"
                                                        fontWeight={notif.isRead ? 'normal' : 'bold'}
                                                    >
                                                        {notif.title}
                                                    </Typography>
                                                    <Chip
                                                        label={notif.type.replace(/([A-Z])/g, ' $1').trim()}
                                                        size="small"
                                                        color={typeColorMap[notif.type] || 'default'}
                                                        variant="outlined"
                                                        sx={{ height: 22, fontSize: '0.7rem' }}
                                                    />
                                                </Box>
                                            }
                                            secondary={
                                                <Box component="span">
                                                    <Typography variant="body2" color="text.secondary" component="span" display="block">
                                                        {notif.message}
                                                    </Typography>
                                                    <Typography variant="caption" color="text.disabled" component="span">
                                                        {new Date(notif.createdAt).toLocaleString()}
                                                    </Typography>
                                                </Box>
                                            }
                                        />
                                    </ListItemButton>
                                </ListItem>
                            </React.Fragment>
                        ))}
                    </List>
                )}
            </Paper>

            {totalPages > 1 && (
                <Box sx={{ display: 'flex', justifyContent: 'center', mt: 3 }}>
                    <Pagination
                        count={totalPages}
                        page={page}
                        onChange={(_e, value) => setPage(value)}
                        color="primary"
                    />
                </Box>
            )}
        </Box>
    );
};

export default NotificationsPage;
