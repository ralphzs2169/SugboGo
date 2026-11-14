import { create } from "zustand";
import { selectArrivalLandmark } from "../utils/selectArrivalLandmark";

import type { BusinessLandmark } from "@/shared/types/BusinessLocation.types";
import type { MerchantBusinessProfileResponse } from "../types/merchantBusinessProfile.types";
import type { LocationChangeLocation } from "../types/locationChange.types";
import {
  liveLandmarkSelection,
  liveLocationProposal,
  buildLocationChangePayload,
  locationPayloadSignature,
} from "../utils/locationChange.utils";

type LocationChangeDraftState = {
  businessId: number | null;
  baselineKey: string | null;
  location: LocationChangeLocation | null;
  landmarks: BusinessLandmark[];
  arrivalDirectionsDrafts: ReadonlyMap<string, string>;
  nearbyLandmarksLoadFailed: boolean;
  initialize: (business: MerchantBusinessProfileResponse) => void;
  setLocation: (location: LocationChangeLocation) => void;
  setLandmarks: (landmarks: BusinessLandmark[]) => void;
  setArrivalLandmark: (
    id: string | null,
    addedLandmark?: BusinessLandmark,
  ) => void;
  setNearbyLandmarksLoadFailed: (failed: boolean) => void;
  reset: () => void;
};

/** Holds only the temporary proposal across the map and custom-landmark routes. */
export const useLocationChangeDraftStore = create<LocationChangeDraftState>(
  (set, get) => ({
    businessId: null,
    baselineKey: null,
    location: null,
    landmarks: [],
    arrivalDirectionsDrafts: new Map(),
    nearbyLandmarksLoadFailed: false,
    initialize: (business) => {
      const current = get();
      if (
        current.businessId === business.id &&
        current.location &&
        locationPayloadSignature(
          buildLocationChangePayload(current.location, current.landmarks),
        ) !== current.baselineKey
      ) {
        return;
      }
      const location = liveLocationProposal(business.location);
      const landmarks = liveLandmarkSelection(business.location);
      const baselineKey = locationPayloadSignature(
        buildLocationChangePayload(location, landmarks),
      );
      if (
        current.businessId === business.id &&
        current.baselineKey === baselineKey
      )
        return;
      set({
        businessId: business.id,
        baselineKey,
        location,
        landmarks,
        arrivalDirectionsDrafts: new Map(),
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
          arrivalDirectionsDrafts: moved
            ? new Map()
            : state.arrivalDirectionsDrafts,
          nearbyLandmarksLoadFailed: moved
            ? false
            : state.nearbyLandmarksLoadFailed,
        };
      }),
    setLandmarks: (landmarks) => set({ landmarks }),
    setArrivalLandmark: (id, addedLandmark) =>
      set((state) => {
        const { selectedLandmarks, arrivalDirectionsDrafts } =
          selectArrivalLandmark(
            addedLandmark
              ? [...state.landmarks, addedLandmark]
              : state.landmarks,
            state.arrivalDirectionsDrafts,
            id,
          );
        return { landmarks: selectedLandmarks, arrivalDirectionsDrafts };
      }),
    setNearbyLandmarksLoadFailed: (nearbyLandmarksLoadFailed) =>
      set({ nearbyLandmarksLoadFailed }),
    reset: () =>
      set({
        businessId: null,
        baselineKey: null,
        location: null,
        landmarks: [],
        arrivalDirectionsDrafts: new Map(),
        nearbyLandmarksLoadFailed: false,
      }),
  }),
);
