import { describe, it, expect, beforeEach } from 'vitest';
import { useAuthStore } from '../store/authStore';
import type { User } from '../types/auth';

const mockUser: User = {
    id: '123',
    email: 'test@example.com',
    firstName: 'Test',
    lastName: 'User',
    role: 'Advertiser',
};

describe('authStore', () => {
    beforeEach(() => {
        // Reset store state before each test
        useAuthStore.setState({
            user: null,
            accessToken: null,
            isAuthenticated: false,
        });
    });

    it('should start with unauthenticated state', () => {
        const state = useAuthStore.getState();
        expect(state.user).toBeNull();
        expect(state.accessToken).toBeNull();
        expect(state.isAuthenticated).toBe(false);
    });

    it('setAuth should set user, access token, and isAuthenticated', () => {
        useAuthStore.getState().setAuth(mockUser, 'access-token-123');

        const state = useAuthStore.getState();
        expect(state.user).toEqual(mockUser);
        expect(state.accessToken).toBe('access-token-123');
        expect(state.isAuthenticated).toBe(true);
    });

    it('setAccessToken should update the access token without changing user', () => {
        useAuthStore.getState().setAuth(mockUser, 'old-access');
        useAuthStore.getState().setAccessToken('new-access');

        const state = useAuthStore.getState();
        expect(state.user).toEqual(mockUser);
        expect(state.accessToken).toBe('new-access');
        expect(state.isAuthenticated).toBe(true);
    });

    it('logout should clear all state', () => {
        useAuthStore.getState().setAuth(mockUser, 'access');
        useAuthStore.getState().logout();

        const state = useAuthStore.getState();
        expect(state.user).toBeNull();
        expect(state.accessToken).toBeNull();
        expect(state.isAuthenticated).toBe(false);
    });

    it('should handle multiple setAuth calls', () => {
        const user2: User = { ...mockUser, id: '456', email: 'other@test.com', role: 'ScreenOwner' };

        useAuthStore.getState().setAuth(mockUser, 'token-1');
        useAuthStore.getState().setAuth(user2, 'token-2');

        const state = useAuthStore.getState();
        expect(state.user?.id).toBe('456');
        expect(state.accessToken).toBe('token-2');
    });
});
