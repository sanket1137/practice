import api from './api';

export interface FestivalEntry {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  year: number;
  region: string;
  suggestedMultiplier: number;
}

export const festivalsApi = {
  getFestivals: async (year = 2026): Promise<FestivalEntry[]> => {
    const { data } = await api.get(`/festivals?year=${year}`);
    return data ?? [];
  },
};
