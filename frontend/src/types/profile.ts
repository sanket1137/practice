export interface Profile {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    phone?: string;
    role: string;
    companyName?: string;
    gstNumber?: string;
    themePreference: string;
    accountVisibility: 'Public' | 'Private';
    profileImageUrl?: string;
    bankAccount?: BankAccount;
    accountType: 'MediaOwner' | 'CmsOwner' | 'Advertiser';
}

export interface ScreenUpgradeRequired {
    id: string;
    name: string;
    needsPricing: boolean;
    needsAddress: boolean;
    needsSchedule: boolean;
}

export interface AccountTypeSwitchPreflight {
    targetAccountType: string;
    canSwitchNow: boolean;
    screensRequiringUpgrade: ScreenUpgradeRequired[];
}

export interface BankAccount {
    id: string;
    beneficiaryName: string;
    accountNumberMasked: string;
    ifscCode: string;
    bankName: string;
    isVerified: boolean;
}

export interface UpdateProfileRequest {
    firstName: string;
    lastName: string;
    phone?: string;
    companyName?: string;
    gstNumber?: string;
    themePreference?: string;
}

export interface UpdateBankAccountRequest {
    beneficiaryName: string;
    accountNumber: string;
    ifscCode: string;
    bankName: string;
}

export interface ChangePasswordRequest {
    currentPassword: string;
    newPassword: string;
}

export interface UpdateVisibilityRequest {
    visibility: string;
}

export interface SelfReserveSlotRequest {
    screenId: string;
    creativeId: string;
    startDate: string;
    endDate: string;
    slotNumber?: number;
    clientName?: string;
    clientContact?: string;
    internalNotes?: string;
    price?: number;
}

export interface AdminMachine {
    id: string;
    adminUserId: string;
    adminName: string;
    machineName: string;
    machineDetails?: string;
    status: string;
    authorizedByUserId: string;
    authorizedByName: string;
    createdAt: string;
    lastUsedAt?: string;
    revokedAt?: string;
}

export interface MachineStatusResponse {
    isAuthorized: boolean;
    machineName?: string;
    lastUsedAt?: string;
}

export interface DeliverySummary {
    bookingId: string;
    screenName: string;
    campaignName?: string;
    startDate: string;
    endDate: string;
    expectedImpressions: number;
    deliveredImpressions: number;
    verifiedImpressions: number;
    deliveryRate: number;
    totalDays: number;
    activeDays: number;
    totalPrice: number;
    currency: string;
    advancePaid: number;
    remainingAmount: number;
    dailyBreakdown: DailyDeliveryEntry[];
}

export interface DailyDeliveryEntry {
    date: string;
    impressions: number;
    verifiedImpressions: number;
    hasData: boolean;
}

export interface PendingPayout {
    id: string;
    bookingId?: string;
    type: string;
    screenOwnerId: string;
    ownerName: string;
    screenName: string;
    grossAmount: number;
    commissionAmount: number;
    netAmount: number;
    currency: string;
    advancePercentage: number;
    createdAt: string;
    bankAccountOnFile: boolean;
}

// ─── Visibility Requests ─────────────────────────────

export type VisibilityRequestStatus = 'Pending' | 'Approved' | 'Rejected';

export interface VisibilityRequestDto {
    id: string;
    requestedVisibility: string;
    status: VisibilityRequestStatus;
    requestMessage?: string;
    requestedAt: string;
    adminReviewedAt?: string;
    rejectionReason?: string;
}

export interface VisibilityRequestDetailDto extends VisibilityRequestDto {
    userId: string;
    userName: string;
    userEmail: string;
    screensCount: number;
    adminReviewedByName?: string;
}
