import api from './api';
import type { SearchScreensRequest, SearchScreensResult, LocationSuggestion, MasterTag } from '../types/screen';
import type {
  WizardCampaignPayload,
  WizardBookingPayload,
  WizardCreatedCampaign,
  WizardCreatedBooking,
  AtomicWizardRequest,
  AtomicWizardResult,
} from '../types/campaignWizard';

export interface Creative {
  id: string;
  campaignId?: string;
  name: string;
  fileName: string;
  fileUrl: string;
  thumbnailUrl?: string;
  mimeType: string;
  fileSize: number;
  width?: number;
  height?: number;
  duration?: number;
  status: string;
  createdAt: string;
}

export interface WalletBalance {
  id: string;
  balance: number;
  currency: string;
  lastTopUpAt?: string;
}

export interface CampaignPaymentResult {
  balance: number;
  currency: string;
  message: string;
}

const campaignWizardApi = {
  searchScreens: async (req: SearchScreensRequest): Promise<SearchScreensResult> => {
    const res = await api.post('/screens/search', req);
    return res.data.data;
  },

  /**
   * Lightweight location autocomplete powered by GET /api/v1/screens/locations.
   * Returns the cities or states (with active marketplace screen counts) matching the query.
   */
  getLocationSuggestions: async (
    q: string,
    kind: 'city' | 'state' = 'city',
    limit = 20,
  ): Promise<LocationSuggestion[]> => {
    const res = await api.get('/screens/locations', { params: { q, kind, limit } });
    return res.data.data ?? [];
  },

  /**
   * Master tag catalog. Pass includeScreenCounts to receive the marketplace screen
   * count carrying each tag — used by Step 2 tag chooser to show "(N screens)".
   */
  getTagCatalog: async (includeScreenCounts = false): Promise<MasterTag[]> => {
    const res = await api.get('/screens/tags', {
      params: includeScreenCounts ? { includeScreenCounts: true } : undefined,
    });
    return res.data.data ?? [];
  },

  getCreatives: async (): Promise<Creative[]> => {
    const res = await api.get('/creatives/library');
    return res.data.data ?? [];
  },

  getWalletBalance: async (): Promise<WalletBalance> => {
    // Calls the canonical wallet endpoint which returns WalletDto { id, balance, currency, lastTopUpAt }
    const res = await api.get('/wallet');
    return res.data.data;
  },

  createCampaign: async (payload: WizardCampaignPayload): Promise<WizardCreatedCampaign> => {
    const res = await api.post('/campaigns', payload);
    return res.data.data;
  },

  createBooking: async (payload: WizardBookingPayload): Promise<WizardCreatedBooking> => {
    const res = await api.post('/bookings', payload);
    return res.data.data;
  },

  payForCampaign: async (campaignId: string): Promise<CampaignPaymentResult> => {
    const res = await api.post('/wallet/pay-for-campaign', { campaignId });
    return res.data.data;
  },

  createCampaignAtomic: async (payload: AtomicWizardRequest): Promise<AtomicWizardResult> => {
    const res = await api.post('/campaigns/wizard', payload);
    return res.data.data;
  },
};

export default campaignWizardApi;
