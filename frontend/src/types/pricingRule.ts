export interface PricingRuleDto {
  id: string;
  screenId: string;
  name: string;
  ruleType: string;
  regularSlotPrice: number | null;
  isActive: boolean;
  startDate: string | null;
  endDate: string | null;
  daysOfWeek: string | null;
  createdAt: string;
}

export interface CreatePricingRuleRequest {
  name: string;
  ruleType: string;
  regularSlotPrice?: number;
  isActive: boolean;
  startDate?: string;
  endDate?: string;
  daysOfWeek?: string;
}
