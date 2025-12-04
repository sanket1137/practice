export interface User {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    role: 'Admin' | 'ScreenOwner' | 'Advertiser';
    profileImageUrl?: string;
}

export interface AuthResponse {
    accessToken: string;
    refreshToken: string;
    expiresAt: string;
    user: User;
}
