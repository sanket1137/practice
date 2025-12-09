import { useAuthStore } from '../store/authStore';

export const useUserRole = () => {
    const user = useAuthStore((state) => state.user);

    return {
        isAdmin: user?.role === 'Admin',
        isAdvertiser: user?.role === 'Advertiser',
        isScreenOwner: user?.role === 'ScreenOwner',
        role: user?.role,
        user,
    };
};
