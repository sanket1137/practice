import { z } from 'zod';

// -- Step schemas ------------------------------------------------------------

export const step1Schema = z.object({
  name: z.string().min(1, 'Campaign name is required').max(200),
  objective: z.enum(['brand_awareness', 'footfall', 'sales', 'engagement'], {
    errorMap: () => ({ message: 'Please select an objective' }),
  }),
  description: z.string().max(500).optional(),
});

export const step2Schema = z.object({
  city: z.string().optional(),
  state: z.string().optional(),
  country: z.string().optional(),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  radiusKm: z.number().min(0.1).max(100).optional(),
  /** Selected tag IDs the screen must carry (e.g. "near metro", "shopping mall"). */
  tagIds: z.array(z.string()).optional(),
  /** Display environment filter: "Indoor" | "Outdoor" | "SemiIndoor". */
  displayType: z.string().optional(),
  /** Screen orientation filter: "Landscape" | "Portrait". */
  orientation: z.string().optional(),
  /** Minimum daily impressions across all screens. */
  minDailyImpressions: z.number().int().nonnegative().optional(),
  /** Operating-at hour-of-day filter (0-23) for time-of-day targeting. */
  operatingAtHour: z.number().int().min(0).max(23).optional(),
  /** Only currently-online screens. */
  onlineOnly: z.boolean().optional(),
});

export const step3Schema = z.object({
  budget: z.number().positive('Budget must be positive'),
  currency: z.string().default('INR'),
  startDate: z.string().min(1, 'Start date is required'), // YYYY-MM-DD
  endDate: z.string().min(1, 'End date is required'),
}).refine(
  (data) => data.startDate <= data.endDate,
  { message: 'End date must be after start date', path: ['endDate'] }
);

export const step4Schema = z.object({
  selectedScreenIds: z.array(z.string()).min(1, 'Select at least one screen'),
});

export const step5Schema = z.object({
  screenCreativeMap: z.record(z.string(), z.string()), // screenId -> creativeId
});

export const step6Schema = z.object({
  confirmedPayment: z.literal(true, { errorMap: () => ({ message: 'Please confirm payment' }) }),
});

// -- Inferred types ----------------------------------------------------------

export type Step1Values = z.infer<typeof step1Schema>;
export type Step2Values = z.infer<typeof step2Schema>;
export type Step3Values = z.infer<typeof step3Schema>;
export type Step4Values = z.infer<typeof step4Schema>;
export type Step5Values = z.infer<typeof step5Schema>;
export type Step6Values = z.infer<typeof step6Schema>;

// -- Wizard state ------------------------------------------------------------

export interface CampaignWizardState {
  step1: Step1Values | null;
  step2: Step2Values | null;
  step3: Step3Values | null;
  step4: Step4Values | null;
  step5: Step5Values | null;
  // Result after campaign + bookings are created
  createdCampaignId: string | null;
  createdBookingIds: string[];
  totalBookingCost: number;
}

// -- Campaign wizard API types -----------------------------------------------

export interface WizardCampaignPayload {
  name: string;
  description?: string;
  budget: number;
  currency: string;
  startDate: string;
  endDate: string;
}

export interface WizardBookingPayload {
  campaignId: string;
  screenId: string;
  creativeId: string;
  startDate: string;
  endDate: string;
}

export interface WizardCreatedCampaign {
  id: string;
  name: string;
}

export interface WizardCreatedBooking {
  id: string;
  screenId: string;
  totalPrice: number;
  currency: string;
  bookedDates?: string[];
}

// ── Atomic wizard types ──────────────────────────────────────────────────────

export interface AtomicWizardBookingRequest {
  screenId: string;
  creativeId: string;
}

export interface AtomicWizardRequest {
  name: string;
  objective?: string;
  description?: string;
  budget: number;
  currency: string;
  startDate: string; // YYYY-MM-DD
  endDate: string;   // YYYY-MM-DD
  bookings: AtomicWizardBookingRequest[];
}

export interface AtomicWizardBookingResult {
  bookingId: string;
  screenId: string;
  totalPrice: number;
  currency: string;
}

export interface AtomicWizardResult {
  campaignId: string;
  campaignName: string;
  bookings: AtomicWizardBookingResult[];
  totalCharged: number;
  currency: string;
}


export const CAMPAIGN_OBJECTIVES = [
  { value: 'brand_awareness', label: 'Brand Awareness', icon: 'TrendingUp' },
  { value: 'footfall', label: 'Drive Footfall', icon: 'DirectionsWalk' },
  { value: 'sales', label: 'Boost Sales', icon: 'ShoppingCart' },
  { value: 'engagement', label: 'Audience Engagement', icon: 'People' },
] as const;
