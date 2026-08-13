export interface Payment {
    id: string;
    bookingId: string;
    userId: string;
    razorpayOrderId: string;
    razorpayPaymentId?: string;
    amount: number;
    currency: string;
    status: string;
    createdAt: string;
    refundedAt?: string;
    refundAmount?: number;
}

export interface CreateOrderResponse {
    orderId: string;
    amount: number;
    currency: string;
    keyId: string;
    bookingId: string;
    virtualAccountNumber?: string;
    virtualAccountIfsc?: string;
    paymentExpiresAt?: string;
}

export interface VerifyPaymentRequest {
    razorpayOrderId: string;
    razorpayPaymentId: string;
    razorpaySignature: string;
    bookingId: string;
}

export interface BookingPaymentStatus {
    bookingId: string;
    paymentStatus: string;
    paymentMethod?: string;
    paymentExpiresAt?: string;
    razorpayOrderId?: string;
}

export interface Payout {
    id: string;
    screenOwnerId: string;
    bookingId?: string;
    type?: string; // Advance, Final, Full
    advancePercentage?: number;
    grossAmount: number;
    commissionPercentage: number;
    commissionAmount: number;
    netAmount: number;
    currency: string;
    status: string;
    periodStart?: string;
    periodEnd?: string;
    adminNotes?: string;
    createdAt: string;
    processedAt?: string;
}

export interface PayoutSummary {
    totalGrossEarnings: number;
    totalCommission: number;
    totalNetEarnings: number;
    pendingPayoutAmount: number;
    completedPayoutAmount: number;
    currency: string;
}

// Razorpay Checkout types
export interface RazorpayOptions {
    key: string;
    amount: number;
    currency: string;
    order_id: string;
    name: string;
    description: string;
    handler: (response: RazorpayResponse) => void;
    prefill?: {
        name?: string;
        email?: string;
        contact?: string;
    };
    theme?: {
        color?: string;
    };
    modal?: {
        ondismiss?: () => void;
    };
}

export interface RazorpayResponse {
    razorpay_order_id: string;
    razorpay_payment_id: string;
    razorpay_signature: string;
}

declare global {
    interface Window {
        Razorpay: new (options: RazorpayOptions) => {
            open: () => void;
            close: () => void;
        };
    }
}
