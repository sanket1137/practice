import axios, { AxiosError } from 'axios';
import type { InternalAxiosRequestConfig, AxiosResponse } from 'axios';
import { useAuthStore } from '../store/authStore';

const API_URL = import.meta.env.VITE_API_URL || '/api/v1';

/** Error rejected by the response interceptor when the API returns 429. */
export interface RateLimitError extends Error {
    isRateLimit: true;
    retryAfter: number;
}

const api = axios.create({
    baseURL: API_URL,
    headers: {
        'Content-Type': 'application/json',
    },
    // Required so the browser sends the HttpOnly refresh-token cookie on
    // auth requests (login/refresh/revoke); harmless no-op for every other
    // same-origin request.
    withCredentials: true,
});

// Rate limiting state
let rateLimitNotificationShown = false;
let rateLimitResetTimeout: ReturnType<typeof setTimeout> | null = null;

/**
 * Shows a rate limit notification to the user
 */
const showRateLimitNotification = (retryAfter?: number) => {
    // Prevent spam - only show once per rate limit window
    if (rateLimitNotificationShown) return;
    
    rateLimitNotificationShown = true;
    
    const message = retryAfter 
        ? `Too many requests. Please wait ${retryAfter} seconds before trying again.`
        : 'Too many requests. Please slow down and try again in a moment.';
    
    // Dispatch a custom event that components can listen to
    const event = new CustomEvent('api-rate-limited', { 
        detail: { message, retryAfter } 
    });
    window.dispatchEvent(event);
    
    // Reset the notification flag after the retry period or 60 seconds
    const resetTime = (retryAfter || 60) * 1000;
    if (rateLimitResetTimeout) {
        clearTimeout(rateLimitResetTimeout);
    }
    rateLimitResetTimeout = setTimeout(() => {
        rateLimitNotificationShown = false;
    }, resetTime);
};

// Request interceptor to add token
api.interceptors.request.use(
    (config: InternalAxiosRequestConfig) => {
        const token = useAuthStore.getState().accessToken;
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }

        // Don't set Content-Type for FormData - let axios handle it
        if (config.data instanceof FormData) {
            delete config.headers['Content-Type'];
        }

        return config;
    },
    (error: AxiosError) => Promise.reject(error)
);

// Refresh token deduplication — only one refresh in-flight at a time.
// The refresh token itself is never handled here: it lives in an HttpOnly
// cookie the browser attaches automatically (see `withCredentials` above).
let refreshPromise: Promise<{ accessToken: string }> | null = null;

export const doRefresh = (): Promise<{ accessToken: string }> => {
    if (refreshPromise) return refreshPromise;

    refreshPromise = (async () => {
        const response = await axios.post(
            `${API_URL}/auth/refresh`,
            {},
            { withCredentials: true }
        );
        const { accessToken } = response.data.data;
        useAuthStore.getState().setAccessToken(accessToken);
        return { accessToken };
    })().finally(() => {
        refreshPromise = null;
    });

    return refreshPromise;
};

// Response interceptor to handle token refresh and rate limiting
api.interceptors.response.use(
    (response: AxiosResponse) => response,
    async (error: AxiosError) => {
        const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

        // Handle rate limiting (429)
        if (error.response?.status === 429) {
            const retryAfter = parseInt(error.response.headers['retry-after'] || '60', 10);
            showRateLimitNotification(retryAfter);
            
            // Create a more descriptive error
            const rateLimitError: RateLimitError = Object.assign(
                new Error(`Rate limit exceeded. Please wait ${retryAfter} seconds before retrying.`),
                { isRateLimit: true as const, retryAfter }
            );
            return Promise.reject(rateLimitError);
        }

        // If error is 401 and we haven't tried to refresh yet
        if (error.response?.status === 401 && originalRequest && !originalRequest._retry) {
            originalRequest._retry = true;

            try {
                const { accessToken } = await doRefresh();

                // Retry original request with new token
                if (originalRequest.headers) {
                    originalRequest.headers.Authorization = `Bearer ${accessToken}`;
                }
                return api(originalRequest);
            } catch (refreshError) {
                // Logout if refresh fails
                useAuthStore.getState().logout();
                return Promise.reject(refreshError);
            }
        }

        return Promise.reject(error);
    }
);

/**
 * Logs the user out everywhere: revokes the refresh token server-side (which
 * also clears the HttpOnly cookie) before clearing local auth state. Without
 * the server round-trip, the refresh cookie would outlive a client-side-only
 * logout — a real risk on a shared/public computer, since it could still be
 * used to silently re-authenticate. Best-effort: local state is always
 * cleared even if the network call fails (e.g. already offline).
 */
export const logoutAndRevoke = async (): Promise<void> => {
    try {
        await api.post('/auth/revoke', {});
    } catch {
        // Ignore — local logout must proceed regardless.
    } finally {
        useAuthStore.getState().logout();
    }
};

export { api };
export default api;
