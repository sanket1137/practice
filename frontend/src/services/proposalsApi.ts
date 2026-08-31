import api from './api';

export interface Proposal {
  id: string;
  title: string;
  message: string;
  createdAt: string;
  screen?: {
    id: string;
    name: string;
    pricePerSlot?: number;
    audienceQualityScore?: number;
    location?: { city?: string; state?: string };
    primaryImageUrl?: string;
  };
}

export const proposalsApi = {
  getProposals: async (): Promise<Proposal[]> => {
    const { data } = await api.get('/proposals?status=active');
    return data.data ?? [];
  },
  dismiss: async (id: string): Promise<void> => {
    await api.put(`/proposals/${id}/dismiss`);
  },
  accept: async (id: string): Promise<{ screenId: string }> => {
    const { data } = await api.put(`/proposals/${id}/accept`);
    return data;
  },
};
