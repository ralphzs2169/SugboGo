import { create } from "zustand";

import {
  BusinessLocation,
  BusinessLandmark,
} from "@/shared/types/BusinessLocation.types";

/**
 * Stores temporary selections for the merchant registration flow.
 *
 * These values remain available while navigating between the
 * registration form and dedicated picker screens.
 */
type MerchantRegistrationState = {
  /** The currently selected business location, or null if none is selected. */
  selectedLocation: BusinessLocation | null;

  /** Nearby landmarks currently selected for the business. */
  selectedLandmarks: BusinessLandmark[];

  /** Sets the currently selected business location. */
  setSelectedLocation: (location: BusinessLocation) => void;

  nearbyLandmarksLoadFailed: boolean;
  addressLoadFailed: boolean;

  /** Sets the currently selected nearby landmarks. */
  setSelectedLandmarks: (landmarks: BusinessLandmark[]) => void;

  /** Clears the currently selected business location. */
  clearSelectedLocation: () => void;

  /** Clears all currently selected nearby landmarks. */
  clearSelectedLandmarks: () => void;

  setAddressLoadFailed: (failed: boolean) => void;
  setNearbyLandmarksLoadFailed: (failed: boolean) => void;
};

// Zustand store for managing merchant registration state.
export const useMerchantRegistrationStore = create<MerchantRegistrationState>(
  (set) => ({
    selectedLocation: null,
    selectedLandmarks: [],
    nearbyLandmarksLoadFailed: false,
    addressLoadFailed: false,

    setSelectedLocation: (location) =>
      set({
        selectedLocation: location,
      }),

    setSelectedLandmarks: (landmarks) =>
      set({
        selectedLandmarks: landmarks,
      }),

    clearSelectedLocation: () =>
      set({
        selectedLocation: null,
      }),

    clearSelectedLandmarks: () =>
      set({
        selectedLandmarks: [],
      }),

    setAddressLoadFailed: (failed) =>
      set({
        addressLoadFailed: failed,
      }),

    setNearbyLandmarksLoadFailed: (failed) =>
      set({
        nearbyLandmarksLoadFailed: failed,
      }),
  }),
);
