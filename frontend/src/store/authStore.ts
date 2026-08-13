import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { User } from '../types/auth';

interface AuthState {
    user: User | null;
    accessToken: string | null;
    isAuthenticated: boolean;

    // The refresh token is never stored here — the backend sets it as an
    // HttpOnly cookie (see AuthController.SetRefreshTokenCookie), so it is
    // inaccessible to JavaScript and can't be exfiltrated via XSS. Silent
    // refresh (src/services/api.ts doRefresh) relies on the browser sending
    // that cookie automatically; this store only ever sees the access token.
    setAuth: (user: User, accessToken: string) => void;
    setAccessToken: (accessToken: string) => void;
    updateUser: (partial: Partial<User>) => void;
    logout: () => void;
}

export const useAuthStore = create<AuthState>()(
    persist(
        (set) => ({
            user: null,
            accessToken: null,
            isAuthenticated: false,

            setAuth: (user, accessToken) =>
                set({ user, accessToken, isAuthenticated: true }),

            setAccessToken: (accessToken) =>
                set({ accessToken }),

            updateUser: (partial) =>
                set((state) => ({ user: state.user ? { ...state.user, ...partial } : state.user })),

            logout: () =>
                set({ user: null, accessToken: null, isAuthenticated: false }),
        }),
        {
            name: 'auth-storage',
        }
    )
);
