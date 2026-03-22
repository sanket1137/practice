import { api } from './api';
import type {
  ScanQrRequest,
  ScanQrResponse,
  ScreenVerificationStatusResponse,
  VerificationHistoryItem,
  AdminVerificationListItem,
  AdminVerificationDetail,
  AdminVerificationListParams,
} from '../types/verification';

// ── Owner / Player endpoints ──

export const scanQr = async (
  screenId: string,
  request: ScanQrRequest
): Promise<ScanQrResponse> => {
  const response = await api.post(
    `/screens/${screenId}/verification/scan`,
    request
  );
  return response.data.data;
};

export const uploadVerificationVideo = async (
  screenId: string,
  verificationId: string,
  file: File,
  onUploadProgress?: (progress: number) => void
): Promise<string> => {
  const formData = new FormData();
  formData.append('video', file);

  const response = await api.post(
    `/screens/${screenId}/verification/${verificationId}/upload-video`,
    formData,
    {
      headers: { 'Content-Type': 'multipart/form-data' },
      onUploadProgress: (event) => {
        if (event.total && onUploadProgress) {
          onUploadProgress(Math.round((event.loaded * 100) / event.total));
        }
      },
    }
  );
  return response.data.data;
};

export const getVerificationStatus = async (
  screenId: string
): Promise<ScreenVerificationStatusResponse> => {
  const response = await api.get(
    `/screens/${screenId}/verification/status`
  );
  return response.data.data;
};

export const getVerificationHistory = async (
  screenId: string
): Promise<VerificationHistoryItem[]> => {
  const response = await api.get(
    `/screens/${screenId}/verification/history`
  );
  return response.data.data;
};

// ── Admin endpoints ──

interface PagedResult<T> {
  items: T[];
  totalCount: number;
  pageNumber: number;
  pageSize: number;
}

export const adminGetVerifications = async (
  params: AdminVerificationListParams
): Promise<PagedResult<AdminVerificationListItem>> => {
  const response = await api.get('/admin/verifications', { params });
  return response.data.data;
};

export const adminGetVerificationDetail = async (
  id: string
): Promise<AdminVerificationDetail> => {
  const response = await api.get(`/admin/verifications/${id}`);
  return response.data.data;
};

export const adminApproveVerification = async (
  id: string
): Promise<string> => {
  const response = await api.post(`/admin/verifications/${id}/approve`);
  return response.data.data;
};

export const adminRejectVerification = async (
  id: string,
  reason: string
): Promise<string> => {
  const response = await api.post(`/admin/verifications/${id}/reject`, {
    reason,
  });
  return response.data.data;
};
