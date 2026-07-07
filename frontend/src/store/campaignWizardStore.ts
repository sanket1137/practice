import { create } from 'zustand';
import type {
  Step1Values,
  Step2Values,
  Step3Values,
  Step4Values,
  Step5Values,
} from '../types/campaignWizard';
import type { Screen } from '../types/screen';

interface CampaignWizardStore {
  activeStep: number;
  step1: Step1Values | null;
  step2: Step2Values | null;
  step3: Step3Values | null;
  step4: Step4Values | null;
  step5: Step5Values | null;
  /** Full Screen objects matching step4.selectedScreenIds — cached so Step5/Step6
   *  can show specs/auto-fit/preview without round-tripping to the backend. */
  selectedScreens: Screen[];
  createdCampaignId: string | null;
  createdBookingIds: string[];
  totalBookingCost: number;

  setActiveStep: (step: number) => void;
  setStep1: (data: Step1Values) => void;
  setStep2: (data: Step2Values) => void;
  setStep3: (data: Step3Values) => void;
  setStep4: (data: Step4Values) => void;
  setStep5: (data: Step5Values) => void;
  setSelectedScreens: (screens: Screen[]) => void;
  setCreatedCampaign: (id: string) => void;
  setCreatedBookings: (ids: string[], totalCost: number) => void;
  reset: () => void;
}

const initialState = {
  activeStep: 0,
  step1: null,
  step2: null,
  step3: null,
  step4: null,
  step5: null,
  selectedScreens: [],
  createdCampaignId: null,
  createdBookingIds: [],
  totalBookingCost: 0,
};

export const useCampaignWizardStore = create<CampaignWizardStore>((set) => ({
  ...initialState,

  setActiveStep: (step) => set({ activeStep: step }),
  setStep1: (data) => set({ step1: data }),
  setStep2: (data) => set({ step2: data }),
  setStep3: (data) => set({ step3: data }),
  setStep4: (data) => set({ step4: data }),
  setStep5: (data) => set({ step5: data }),
  setSelectedScreens: (screens) => set({ selectedScreens: screens }),
  setCreatedCampaign: (id) => set({ createdCampaignId: id }),
  setCreatedBookings: (ids, totalCost) =>
    set({ createdBookingIds: ids, totalBookingCost: totalCost }),
  reset: () => set(initialState),
}));
