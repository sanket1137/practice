import api from './api';

export interface ScreenRecommendationRequest {
  objective?: string;
  targetCity?: string;
  targetLat?: number;
  targetLng?: number;
  targetRadius?: number;
  categories?: string[];
  budget?: number;
  dateFrom?: string;
  dateTo?: string;
}

export interface RecommendedScreen {
  screen: {
    id: string;
    name: string;
    description?: string;
    latitude: number;
    longitude: number;
    location?: { city?: string; state?: string };
    pricePerSlot?: number;
    currency?: string;
    audienceQualityScore?: number;
    status: string;
    primaryImageUrl?: string;
    scoreBreakdown?: {
      categoryScore: number;
      locationScore: number;
      budgetScore: number;
      aqsScore: number;
      historyScore: number;
    };
  };
  matchScore: number;
  matchReasons: string[];
}

export const recommendationsApi = {
  getRecommendations: async (request: ScreenRecommendationRequest): Promise<RecommendedScreen[]> => {
    const { data } = await api.post('/recommendations/screens', request);
    return data.data?.screens ?? [];
  },
};
