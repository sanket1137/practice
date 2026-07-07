import { api } from './api';

interface Envelope<T> {
  success: boolean;
  data: T;
  message?: string;
  errors?: string[];
}

const unwrap = <T,>(res: { data: Envelope<T> }) => res.data.data;

export interface ClaimPlayerQrCmsRequest {
  token: string;
  screenName: string;
  orientation: 'Landscape' | 'Portrait';
  resolutionWidth: number;
  resolutionHeight: number;
  venue?: string;
}

export interface ClaimPlayerQrCcmsRequest {
  token: string;
  screenName: string;
  description: string;
  orientation: 'Landscape' | 'Portrait';
  resolutionWidth: number;
  resolutionHeight: number;
  street: string;
  city: string;
  state: string;
  country: string;
  postalCode: string;
  latitude: number;
  longitude: number;
  timezone: string;
  pricePerSlot: number;
  currency: string;
  timeFrameMinutes: number;
  slotsPerFrame: number;
  schedule?: unknown;
}

export interface ClaimPlayerQrResponse {
  screenId: string;
  screenName: string;
}

export const playerPairingApi = {
  claimCms: (body: ClaimPlayerQrCmsRequest) =>
    api.post<Envelope<ClaimPlayerQrResponse>>('/player/pairing/claim/cms', body).then(unwrap),

  claimCcms: (body: ClaimPlayerQrCcmsRequest) =>
    api.post<Envelope<ClaimPlayerQrResponse>>('/player/pairing/claim/ccms', body).then(unwrap),
};
