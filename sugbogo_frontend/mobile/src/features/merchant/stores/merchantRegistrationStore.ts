import { create } from "zustand";

import {
  BusinessLandmark,
  BusinessLocation,
} from "@/shared/types/BusinessLocation.types";

type BusinessAddress = {
  province: string;
  city: string;
  barangay: string;
  streetAddress: string;
  unit: string;
};

type AddressLoadFailures = {
  province: boolean;
  city: boolean;
  barangay: boolean;
  streetAddress: boolean;
};
/**
 * Stores temporary selections for the merchant registration flow.
 *
 * These values remain available while navigating between the
 * registration form and dedicated picker screens.
 */
type MerchantRegistrationState = {
  /** The currently selected business location, or null if none is selected. */
  selectedLocation: BusinessLocation | null;

  /**
   * Editable business address displayed in the registration form.
   *
   * Initialized from the reverse-geocoded location when a business
   * location is confirmed, then updated as the merchant edits the
   * address fields.
   *
   * Stored separately from `selectedLocation` so manual edits are
   * not lost when the registration screen is revisited.
   */
  selectedAddress: BusinessAddress | null;

  /** Nearby landmarks currently selected for the business. */
  selectedLandmarks: BusinessLandmark[];

  nearbyLandmarksLoadFailed: boolean;
  addressLoadFailed: boolean;
  addressLoadFailures: AddressLoadFailures;

  reset: () => void;

  setSelectedLocation: (location: BusinessLocation) => void;

  /**
   * Replaces the editable business address.
   *
   * Typically called after confirming a new business location to
   * initialize the form with the latest reverse-geocoded address.
   */
  setSelectedAddress: (address: BusinessAddress) => void;

  /** Sets the currently selected nearby landmarks. */
  setSelectedLandmarks: (landmarks: BusinessLandmark[]) => void;

  setAddressLoadFailed: (failed: boolean) => void;

  setNearbyLandmarksLoadFailed: (failed: boolean) => void;
  setAddressLoadFailures: (failures: AddressLoadFailures) => void;

  /** Clears the currently selected business location. */
  clearSelectedLocation: () => void;
  clearSelectedAddress: () => void;

  /** Clears all currently selected nearby landmarks. */
  clearSelectedLandmarks: () => void;
};

// Zustand store for managing merchant registration state.
export const useMerchantRegistrationStore = create<MerchantRegistrationState>(
  (set) => ({
    selectedLocation: null,
    selectedAddress: null,
    selectedLandmarks: [],
    nearbyLandmarksLoadFailed: false,
    addressLoadFailed: false,

    addressLoadFailures: {
      province: false,
      city: false,
      barangay: false,
      streetAddress: false,
    },

    setSelectedLocation: (location) =>
      set({
        selectedLocation: location,
      }),

    setSelectedLandmarks: (landmarks) =>
      set({
        selectedLandmarks: landmarks,
      }),

    setSelectedAddress: (address: BusinessAddress) =>
      set({
        selectedAddress: address,
      }),

    setAddressLoadFailures: (failures: AddressLoadFailures) =>
      set({
        addressLoadFailures: failures,
      }),

    clearSelectedLocation: () =>
      set({
        selectedLocation: null,
      }),
    clearSelectedAddress: () =>
      set({
        selectedAddress: null,
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

    reset: () =>
      set({
        selectedLocation: null,
        selectedAddress: null,
        selectedLandmarks: [],
        nearbyLandmarksLoadFailed: false,
        addressLoadFailed: false,
        addressLoadFailures: {
          province: false,
          city: false,
          barangay: false,
          streetAddress: false,
        },
      }),
  }),
);
