import api from './api';
import type {
    Profile,
    UpdateProfileRequest,
    UpdateBankAccountRequest,
    ChangePasswordRequest,
    UpdateVisibilityRequest,
    AdminMachine,
    MachineStatusResponse,
    DeliverySummary,
    PendingPayout,
    SelfReserveSlotRequest,
} from '../types/profile';
import type { Booking } from '../types/booking';
import type { Payout } from '../types/payment';

// ─── Profile ────────────────────────────────────────
export const getProfile = async (): Promise<Profile> => {
    const { data } = await api.get('/profile');
    return data.data;
};

export const updateProfile = async (req: UpdateProfileRequest): Promise<Profile> => {
    const { data } = await api.put('/profile', req);
    return data.data;
};

export const updateVisibility = async (req: UpdateVisibilityRequest): Promise<void> => {
    await api.put('/profile/visibility', req);
};

export const updateBankAccount = async (req: UpdateBankAccountRequest): Promise<void> => {
    await api.put('/profile/bank-account', req);
};

export const deleteBankAccount = async (): Promise<void> => {
    await api.delete('/profile/bank-account');
};

export const changePassword = async (req: ChangePasswordRequest): Promise<void> => {
    await api.post('/profile/change-password', req);
};

export const uploadProfileImage = async (file: File): Promise<string> => {
    const formData = new FormData();
    formData.append('file', file);
    const { data } = await api.post('/profile/profile-image', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
    });
    return data.data;
};

// ─── Self-Reserve ───────────────────────────────────
export const selfReserveSlot = async (req: SelfReserveSlotRequest): Promise<Booking> => {
    const { data } = await api.post('/bookings/self-reserve', req);
    return data.data;
};

export const getSelfReservedBookings = async (screenId?: string): Promise<Booking[]> => {
    const params = screenId ? { screenId } : {};
    const { data } = await api.get('/bookings/self-reserved', { params });
    return data.data;
};

// ─── Admin Machines ─────────────────────────────────
export const getAllMachines = async (): Promise<AdminMachine[]> => {
    const { data } = await api.get('/admin/machines');
    return data.data;
};

export const getMyMachines = async (): Promise<AdminMachine[]> => {
    const { data } = await api.get('/admin/machines/my');
    return data.data;
};

export const authorizeMachine = async (fingerprint: string, name: string, details?: string): Promise<AdminMachine> => {
    const { data } = await api.post('/admin/machines/authorize', {
        machineFingerprint: fingerprint,
        machineName: name,
        machineDetails: details,
    });
    return data.data;
};

export const revokeMachine = async (id: string): Promise<void> => {
    await api.post(`/admin/machines/revoke/${id}`);
};

export const checkMachineStatus = async (fingerprint: string): Promise<MachineStatusResponse> => {
    const { data } = await api.get('/admin/machines/status', { params: { machineFingerprint: fingerprint } });
    return data.data;
};

// ─── Admin Payouts ──────────────────────────────────
export const getPendingPayouts = async (): Promise<PendingPayout[]> => {
    const { data } = await api.get('/payouts/pending');
    return data.data;
};

export const processPayout = async (id: string, fingerprint: string, notes?: string): Promise<void> => {
    await api.post(`/payouts/${id}/process`, 
        notes ? { transactionReference: notes } : {},
        { headers: { 'X-Machine-Fingerprint': fingerprint } }
    );
};

export const failPayout = async (id: string, fingerprint: string, reason: string): Promise<void> => {
    await api.post(`/payouts/${id}/fail`,
        { reason },
        { headers: { 'X-Machine-Fingerprint': fingerprint } }
    );
};

export const releaseFinalPayout = async (bookingId: string, fingerprint: string, adjustedAmount?: number, notes?: string): Promise<void> => {
    await api.post(`/payouts/bookings/${bookingId}/release-final`,
        { adjustedFinalAmount: adjustedAmount, adminNotes: notes },
        { headers: { 'X-Machine-Fingerprint': fingerprint } }
    );
};

export const getDeliverySummary = async (bookingId: string): Promise<DeliverySummary> => {
    const { data } = await api.get(`/reports/bookings/${bookingId}/delivery-summary`);
    return data.data;
};

// ─── Payout History (updated) ───────────────────────
export const getAdminPayoutHistory = async (): Promise<Payout[]> => {
    const { data } = await api.get('/payouts/history');
    return data.data;
};
