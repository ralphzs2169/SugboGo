import { create } from "zustand";

import type { BusinessLandmark } from "@/shared/types/BusinessLocation.types";
import type { MerchantBusinessProfileResponse } from "../types/merchantBusinessProfile.types";
import type { LocationChangeLocation } from "../types/locationChange.types";
import {
  liveLandmarkSelection,
  liveLocationProposal,
} from "../utils/locationChange.utils";

type LocationChangeDraftState = {
  businessId: number | null;
  location: LocationChangeLocation | null;
  landmarks: BusinessLandmark[];
  nearbyLandmarksLoadFailed: boolean;
  initialize: (business: MerchantBusinessProfileResponse) => void;
  setLocation: (location: LocationChangeLocation) => void;
  setLandmarks: (landmarks: BusinessLandmark[]) => void;
  setNearbyLandmarksLoadFailed: (failed: boolean) => void;
  reset: () => void;
};

/** Holds only the temporary proposal across the map and custom-landmark routes. */
export const useLocationChangeDraftStore = create<LocationChangeDraftState>(
  (set, get) => ({
    businessId: null,
    location: null,
    landmarks: [],
    nearbyLandmarksLoadFailed: false,
    initialize: (business) => {
      if (get().businessId === business.id && get().location) {
        return;
      }
      set({
        businessId: business.id,
        location: liveLocationProposal(business.location),
        landmarks: liveLandmarkSelection(business.location),
        nearbyLandmarksLoadFailed: false,
      });
    },
    setLocation: (location) =>
      set((state) => {
        const moved =
          state.location?.latitude !== location.latitude ||
          state.location?.longitude !== location.longitude;
        return {
          location,
          landmarks: moved ? [] : state.landmarks,
          nearbyLandmarksLoadFailed: moved
            ? false
            : state.nearbyLandmarksLoadFailed,
        };
      }),
    setLandmarks: (landmarks) => set({ landmarks }),
    setNearbyLandmarksLoadFailed: (nearbyLandmarksLoadFailed) =>
      set({ nearbyLandmarksLoadFailed }),
    reset: () =>
      set({
        businessId: null,
        location: null,
        landmarks: [],
        nearbyLandmarksLoadFailed: false,
      }),
  }),
);
