import { create } from "zustand";

import type { JourneyOrigin } from "../types/journeyOrigin.types";

type JourneyOriginState = {
  businessId: number | null;
  confirmedOrigin: JourneyOrigin | null;
  confirmOrigin: (businessId: number, origin: JourneyOrigin) => void;
  clearOrigin: () => void;
};

/** Keeps one confirmed Explorer journey origin across the related routes. */
export const useJourneyOriginStore = create<JourneyOriginState>((set) => ({
  businessId: null,
  confirmedOrigin: null,
  confirmOrigin: (businessId, confirmedOrigin) =>
    set({
      businessId,
      confirmedOrigin,
    }),
  clearOrigin: () =>
    set({
      businessId: null,
      confirmedOrigin: null,
    }),
}));
