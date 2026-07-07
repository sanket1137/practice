import axios from 'axios';

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
    const { data } = await axios.get('/api/v1/proposals?status=active');
    return data.data ?? [];
  },
  dismiss: async (id: string): Promise<void> => {
    await axios.put(`/api/v1/proposals/${id}/dismiss`);
  },
  accept: async (id: string): Promise<{ screenId: string }> => {
    const { data } = await axios.put(`/api/v1/proposals/${id}/accept`);
    return data;
  },
};
