export interface User {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    role: 'Admin' | 'ScreenOwner' | 'Advertiser';
    accountType?: 'MediaOwner' | 'CmsOwner' | 'Advertiser';
    profileImageUrl?: string;
    isEmailVerified?: boolean;
    isPhoneVerified?: boolean;
    accountVisibility?: 'Public' | 'Private';
}

export interface AuthResponse {
    accessToken: string;
    refreshToken: string;
    expiresAt: string;
    user: User;
    requiresVerification?: boolean;
    verificationMessage?: string;
    isEmailVerified?: boolean;
    isPhoneVerified?: boolean;
    email?: string;
    phoneNumber?: string;
}

export interface VerificationStatus {
    email: string;
    isEmailVerified: boolean;
    isPhoneVerified: boolean;
    phoneNumber?: string;
    isFullyVerified: boolean;
}

export interface SendOtpResult {
    success: boolean;
    message?: string;
    expiresAt?: string;
    remainingAttempts?: number;
}

export interface VerifyOtpResult {
    success: boolean;
    message?: string;
    phoneNumber?: string;
    remainingAttempts?: number;
    isFullyVerified?: boolean;
    isEmailVerified?: boolean;
    isPhoneVerified?: boolean;
}
