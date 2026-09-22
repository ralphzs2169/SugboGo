import { create } from "zustand";

import type {
  BusinessLandmark,
  BusinessLocation,
} from "@/shared/types/BusinessLocation.types";

type ReviewBusinessLocation = Omit<BusinessLocation, "isWithinServiceArea">;

type ReviewLandmarksStore = {
  businessLocation: ReviewBusinessLocation | null;
  selectedLandmarks: BusinessLandmark[];
  returnTo: "application-summary" | "registration-review";

  setPreview: (
    businessLocation: ReviewBusinessLocation,
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
