// Screen verification types — mirrors backend DTOs from VerificationDtos.cs

export type ScreenVerificationStatus =
  | 'Unverified'
  | 'QrDisplayed'
  | 'PendingReview'
  | 'Verified'
  | 'Rejected'
  | 'ReVerificationRequired';

// ── Player-facing DTOs ──

export interface QrChallengeResponse {
  code: string;
  expiresAt: string;
  qrContent: string;
}

export interface ScreenVerificationStatusResponse {
  status: ScreenVerificationStatus;
  canPlay: boolean;
}

// ── Owner-facing DTOs ──

export interface ScanQrRequest {
  challengeCode: string;
  gpsLatitude: number;
  gpsLongitude: number;
}

export interface ScanQrResponse {
  verificationId: string;
  message: string;
}

export interface VerificationHistoryItem {
  id: string;
  status: string;
  deviceType: string | null;
  rejectionReason: string | null;
  createdAt: string;
  adminReviewedAt: string | null;
}

// ── Admin-facing DTOs ──

export interface AdminVerificationListItem {
  id: string;
  screenId: string;
  screenName: string;
  ownerName: string;
  ownerEmail: string;
  deviceType: string | null;
  status: string;
  scanGpsLatitude: number | null;
  scanGpsLongitude: number | null;
  screenLatitude: number;
  screenLongitude: number;
  createdAt: string;
  hasVideo: boolean;
}

export interface AdminVerificationDetail {
  id: string;
  screenId: string;
  screenName: string;
  screenAddress: string;
  ownerName: string;
  ownerEmail: string;
  videoUrl: string | null;
  deviceType: string | null;
  deviceFingerprintPrefix: string | null;
  qrChallengeCode: string;
  scanGpsLatitude: number | null;
  scanGpsLongitude: number | null;
  screenLatitude: number;
  screenLongitude: number;
  gpsDistanceMeters: number | null;
  playerIpAddress: string | null;
  status: string;
  rejectionReason: string | null;
  createdAt: string;
  adminReviewedAt: string | null;
  adminReviewedByName: string | null;
}

export interface AdminVerificationListParams {
  status?: string;
  deviceType?: string;
  search?: string;
  page: number;
  pageSize: number;
}

export interface AdminRejectVerificationRequest {
  reason: string;
}
