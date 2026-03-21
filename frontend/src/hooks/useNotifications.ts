import { useEffect, useCallback, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import * as signalR from '@microsoft/signalr';
import { useAuthStore } from '../store/authStore';
import { getUnreadCount, getNotifications, markAsRead, markAllAsRead } from '../services/notificationApi';
import type { Notification, NotificationsResponse } from '../types/notification';

const API_URL = import.meta.env.VITE_API_URL || '/api/v1';
const BASE_URL = API_URL.replace(/\/api(\/v\d+)?/, '');

export function useNotifications() {
    const queryClient = useQueryClient();
    const { accessToken, isAuthenticated } = useAuthStore();
    const connectionRef = useRef<signalR.HubConnection | null>(null);

    // Fetch unread count (polls every 30s as fallback)
    const { data: unreadCount = 0 } = useQuery({
        queryKey: ['notifications-unread-count'],
        queryFn: getUnreadCount,
        enabled: isAuthenticated,
        refetchInterval: 30000,
    });

    // Fetch recent notifications
    const { data: notificationsData } = useQuery<NotificationsResponse>({
        queryKey: ['notifications-recent'],
        queryFn: () => getNotifications(1, 10),
        enabled: isAuthenticated,
        refetchInterval: 30000,
    });

    // SignalR connection for real-time push
    useEffect(() => {
        if (!isAuthenticated || !accessToken) return;

        const connection = new signalR.HubConnectionBuilder()
            .withUrl(`${BASE_URL}/hubs/notifications`, {
                accessTokenFactory: () => accessToken,
                transport: signalR.HttpTransportType.WebSockets | signalR.HttpTransportType.LongPolling,
            })
            .withAutomaticReconnect()
            .configureLogging(signalR.LogLevel.Warning)
            .build();

        connection.on('NotificationReceived', (_notification: Notification) => {
            // Invalidate queries to refresh UI
            queryClient.invalidateQueries({ queryKey: ['notifications-unread-count'] });
            queryClient.invalidateQueries({ queryKey: ['notifications-recent'] });
            queryClient.invalidateQueries({ queryKey: ['notifications'] });
        });

        connection.start().catch((err) => {
            console.warn('[NotificationHub] Connection failed:', err);
        });

        connectionRef.current = connection;

        return () => {
            connection.stop();
            connectionRef.current = null;
        };
    }, [isAuthenticated, accessToken, queryClient]);

    const handleMarkAsRead = useCallback(async (notificationId: string) => {
        await markAsRead(notificationId);
        queryClient.invalidateQueries({ queryKey: ['notifications-unread-count'] });
        queryClient.invalidateQueries({ queryKey: ['notifications-recent'] });
        queryClient.invalidateQueries({ queryKey: ['notifications'] });
    }, [queryClient]);

    const handleMarkAllAsRead = useCallback(async () => {
        await markAllAsRead();
        queryClient.invalidateQueries({ queryKey: ['notifications-unread-count'] });
        queryClient.invalidateQueries({ queryKey: ['notifications-recent'] });
        queryClient.invalidateQueries({ queryKey: ['notifications'] });
    }, [queryClient]);

    return {
        unreadCount,
        notifications: notificationsData?.items ?? [],
        markAsRead: handleMarkAsRead,
        markAllAsRead: handleMarkAllAsRead,
    };
}
