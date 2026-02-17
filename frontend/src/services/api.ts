import axios, { AxiosError } from 'axios';
import type { InternalAxiosRequestConfig, AxiosResponse } from 'axios';
import { useAuthStore } from '../store/authStore';

const API_URL = import.meta.env.VITE_API_URL || '/api';

const api = axios.create({
    baseURL: API_URL,
    headers: {
        'Content-Type': 'application/json',
    },
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
            const rateLimitError = new Error(
                `Rate limit exceeded. Please wait ${retryAfter} seconds before retrying.`
            );
            (rateLimitError as any).isRateLimit = true;
            (rateLimitError as any).retryAfter = retryAfter;
            return Promise.reject(rateLimitError);
        }

        // If error is 401 and we haven't tried to refresh yet
        if (error.response?.status === 401 && originalRequest && !originalRequest._retry) {
            originalRequest._retry = true;

            try {
                const refreshToken = useAuthStore.getState().refreshToken;
                if (!refreshToken) {
                    throw new Error('No refresh token');
                }

                // Call refresh endpoint directly to avoid infinite loop
                const response = await axios.post(`${API_URL}/auth/refresh`, {
                    refreshToken,
                });

                const { accessToken, refreshToken: newRefreshToken } = response.data.data;

                // Update store
                useAuthStore.getState().setTokens(accessToken, newRefreshToken);

                // Retry original request
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

export { api };
export default api;
