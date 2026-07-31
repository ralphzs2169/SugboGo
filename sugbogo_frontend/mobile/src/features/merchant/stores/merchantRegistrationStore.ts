import { create } from "zustand";

import { BusinessLocation } from "@/shared/types/BusinessLocation.types";

/**
 * Stores the selected business location for the merchant registration flow.
 *
 * The location remains available across registration screens and is only
 * committed to the registration form after the merchant confirms it.
 */
type MerchantRegistrationState = {
  /** The currently selected business location, or null if none is selected. */
  selectedLocation: BusinessLocation | null;

  /** Sets the currently selected business location. */
  setSelectedLocation: (location: BusinessLocation) => void;

  /** Clears the currently selected business location. */
  clearSelectedLocation: () => void;
};

// Zustand store for managing merchant registration state.
export const useMerchantRegistrationStore = create<MerchantRegistrationState>(
  (set) => ({
    selectedLocation: null,

    setSelectedLocation: (location) =>
      set({
        selectedLocation: location,
      }),

    clearSelectedLocation: () =>
      set({
        selectedLocation: null,
      }),
  }),
);
