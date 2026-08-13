import { api } from './api';
import type { NotificationsResponse, NotificationPreference, UpdateNotificationPreferenceRequest } from '../types/notification';

interface ApiResponse<T> {
    success: boolean;
    message: string;
    data: T;
}

export const getNotifications = async (page = 1, pageSize = 20): Promise<NotificationsResponse> => {
    const response = await api.get<ApiResponse<NotificationsResponse>>('/notifications', {
        params: { page, pageSize },
    });
    return response.data.data;
};

export const getUnreadCount = async (): Promise<number> => {
    const response = await api.get<ApiResponse<number>>('/notifications/unread-count');
    return response.data.data;
};

export const markAsRead = async (notificationId: string): Promise<void> => {
    await api.post(`/notifications/${notificationId}/read`);
};

export const markAllAsRead = async (): Promise<void> => {
    await api.post('/notifications/read-all');
};

export const getNotificationPreferences = async (): Promise<NotificationPreference[]> => {
    const response = await api.get<ApiResponse<NotificationPreference[]>>('/notifications/preferences');
    return response.data.data;
};

export const updateNotificationPreferences = async (
    updates: UpdateNotificationPreferenceRequest[]
): Promise<void> => {
    await api.put('/notifications/preferences', updates);
};
