import { useAuthStore } from '../store/authStore';

export const useAccountVisibility = () => {
    const user = useAuthStore((state) => state.user);

    const isPrivate = user?.role === 'ScreenOwner' && user?.accountVisibility === 'Private';
    const isPublic = !isPrivate;

    return {
        isPrivate,
        isPublic,
        accountVisibility: user?.accountVisibility ?? 'Public',
    };
};
