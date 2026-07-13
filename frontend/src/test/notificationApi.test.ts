import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getNotifications, getUnreadCount, markAsRead, markAllAsRead } from '../services/notificationApi';
import { api } from '../services/api';

vi.mock('../services/api', () => ({
    api: {
        get: vi.fn(),
        post: vi.fn(),
    },
}));

const mockedApi = api as any;

describe('notificationApi', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('getNotifications', () => {
        it('should fetch paginated notifications', async () => {
            const mockData = {
                items: [{ id: '1', title: 'Test', message: 'msg', type: 'BookingCreated', isRead: false, createdAt: '2026-01-01' }],
                totalCount: 1,
                page: 1,
                pageSize: 20,
            };
            mockedApi.get.mockResolvedValueOnce({ data: { success: true, data: mockData } });

            const result = await getNotifications(1, 20);

            expect(mockedApi.get).toHaveBeenCalledWith('/notifications', { params: { page: 1, pageSize: 20 } });
            expect(result).toEqual(mockData);
        });

        it('should use default page and pageSize', async () => {
            mockedApi.get.mockResolvedValueOnce({ data: { success: true, data: { items: [], totalCount: 0, page: 1, pageSize: 20 } } });

            await getNotifications();

            expect(mockedApi.get).toHaveBeenCalledWith('/notifications', { params: { page: 1, pageSize: 20 } });
        });
    });

    describe('getUnreadCount', () => {
        it('should fetch unread count', async () => {
            mockedApi.get.mockResolvedValueOnce({ data: { success: true, data: 5 } });

            const result = await getUnreadCount();

            expect(mockedApi.get).toHaveBeenCalledWith('/notifications/unread-count');
            expect(result).toBe(5);
        });
    });

    describe('markAsRead', () => {
        it('should post to mark notification as read', async () => {
            mockedApi.post.mockResolvedValueOnce({});

            await markAsRead('notif-123');

            expect(mockedApi.post).toHaveBeenCalledWith('/notifications/notif-123/read');
        });
    });

    describe('markAllAsRead', () => {
        it('should post to mark all notifications as read', async () => {
            mockedApi.post.mockResolvedValueOnce({});

            await markAllAsRead();

            expect(mockedApi.post).toHaveBeenCalledWith('/notifications/read-all');
        });
    });
});
