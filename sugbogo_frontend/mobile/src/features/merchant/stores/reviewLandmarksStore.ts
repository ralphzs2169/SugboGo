import { create } from "zustand";

import type {
  BusinessLocation,
  BusinessLandmark,
} from "@/shared/types/BusinessLocation.types";

type ReviewLandmarksStore = {
  businessLocation: BusinessLocation | null;
  selectedLandmarks: BusinessLandmark[];
  returnTo: "application-summary" | "registration-review";

  setPreview: (
    businessLocation: BusinessLocation,
    selectedLandmarks: BusinessLandmark[],
    returnTo: "application-summary" | "registration-review",
  ) => void;

  clearPreview: () => void;
};

export const useReviewLandmarksStore = create<ReviewLandmarksStore>((set) => ({
  businessLocation: null,
  selectedLandmarks: [],
  returnTo: "registration-review",

  setPreview: (businessLocation, selectedLandmarks, returnTo) =>
    set({
      businessLocation,
      selectedLandmarks,
      returnTo,
    }),

  clearPreview: () =>
    set({
      businessLocation: null,
      selectedLandmarks: [],
      returnTo: "registration-review",
    }),
}));
