import { api } from './api';
import type {
    Payment,
    CreateOrderResponse,
    VerifyPaymentRequest,
    BookingPaymentStatus,
    Payout,
    PayoutSummary,
} from '../types/payment';

interface ApiResponse<T> {
    success: boolean;
    message: string;
    data: T;
}

// ============================================
// WALLET TYPES
// ============================================

export interface Wallet {
    id: string;
    balance: number;
    currency: string;
    lastTopUpAt?: string;
}

export interface WalletTransaction {
    id: string;
    type: 'TopUp' | 'Debit' | 'Refund' | 'Payout';
    amount: number;
    description?: string;
    referenceId?: string;
    referenceType?: string;
    balanceBefore: number;
    balanceAfter: number;
    createdAt: string;
}

// ============================================
// WALLET
// ============================================

export const getWallet = async (): Promise<Wallet> => {
    const response = await api.get<ApiResponse<Wallet>>('/wallet');
    return response.data.data;
};

export const getWalletTransactions = async (page = 1, pageSize = 20): Promise<WalletTransaction[]> => {
    const response = await api.get<ApiResponse<WalletTransaction[]>>('/wallet/transactions', {
        params: { page, pageSize },
    });
    return response.data.data;
};

export const createWalletTopUp = async (amount: number): Promise<CreateOrderResponse> => {
    const response = await api.post<ApiResponse<CreateOrderResponse>>('/wallet/topup', { amount });
    return response.data.data;
};

export const confirmWalletTopUp = async (
    razorpayOrderId: string,
    razorpayPaymentId: string,
    razorpaySignature: string,
    amount: number,
): Promise<Wallet> => {
    const response = await api.post<ApiResponse<Wallet>>('/wallet/topup/confirm', {
        razorpayOrderId,
        razorpayPaymentId,
        razorpaySignature,
        amount,
    });
    return response.data.data;
};

// ============================================
// PAYMENTS
// ============================================

export const createPaymentOrder = async (bookingId: string): Promise<CreateOrderResponse> => {
    const response = await api.post<ApiResponse<CreateOrderResponse>>('/payments/create-order', { bookingId });
    return response.data.data;
};

export const verifyPayment = async (request: VerifyPaymentRequest): Promise<Payment> => {
    const response = await api.post<ApiResponse<Payment>>('/payments/verify', request);
    return response.data.data;
};

export const getPaymentsByBooking = async (bookingId: string): Promise<Payment[]> => {
    const response = await api.get<ApiResponse<Payment[]>>(`/payments/booking/${bookingId}`);
    return response.data.data;
};

export const getPaymentStatus = async (bookingId: string): Promise<BookingPaymentStatus> => {
    const response = await api.get<ApiResponse<BookingPaymentStatus>>(`/payments/booking/${bookingId}/status`);
    return response.data.data;
};

export const refundPayment = async (paymentId: string, amount?: number, reason?: string): Promise<Payment> => {
    const response = await api.post<ApiResponse<Payment>>('/payments/refund', { paymentId, amount, reason });
    return response.data.data;
};

// ============================================
// PAYOUTS
// ============================================

export const getPayoutSummary = async (): Promise<PayoutSummary> => {
    const response = await api.get<ApiResponse<PayoutSummary>>('/payouts/summary');
    return response.data.data;
};

export const getPayoutHistory = async (page = 1, pageSize = 20): Promise<Payout[]> => {
    const response = await api.get<ApiResponse<Payout[]>>('/payouts/history', {
        params: { page, pageSize },
    });
    return response.data.data;
};

export const requestPayout = async (periodStart: string, periodEnd: string): Promise<Payout> => {
    const response = await api.post<ApiResponse<Payout>>('/payouts/request', { periodStart, periodEnd });
    return response.data.data;
};

// ============================================
// RAZORPAY CHECKOUT HELPER
// ============================================

const RAZORPAY_SCRIPT_URL = 'https://checkout.razorpay.com/v1/checkout.js';

let razorpayScriptLoaded = false;

export const loadRazorpayScript = (): Promise<boolean> => {
    if (razorpayScriptLoaded && window.Razorpay) return Promise.resolve(true);

    return new Promise((resolve) => {
        const script = document.createElement('script');
        script.src = RAZORPAY_SCRIPT_URL;
        script.onload = () => {
            razorpayScriptLoaded = true;
            resolve(true);
        };
        script.onerror = () => resolve(false);
        document.body.appendChild(script);
    });
};
