import { create } from "zustand";

import type {
  BusinessLandmark,
  BusinessLocation,
} from "@/shared/types/BusinessLocation.types";
import type {
  LocationChangeLandmark,
  LocationChangeLocation,
} from "../types/locationChange.types";

type ReviewLandmark = BusinessLandmark | LocationChangeLandmark;

type LocationChangeReviewState = {
  title: string;
  businessLocation: Omit<BusinessLocation, "isWithinServiceArea"> | null;
  landmarks: BusinessLandmark[];
  setPreview: (
    title: string,
    location: LocationChangeLocation,
    landmarks: ReviewLandmark[],
  ) => void;
  clearPreview: () => void;
};

/** Holds a read-only snapshot while the merchant inspects its map. */
export const useLocationChangeReviewStore = create<LocationChangeReviewState>(
  (set) => ({
    title: "",
    businessLocation: null,
    landmarks: [],
    setPreview: (title, location, landmarks) =>
      set({
        title,
        businessLocation: {
          latitude: location.latitude,
          longitude: location.longitude,
          formattedAddress: location.address,
          city: location.city,
          province: location.province,
          barangay: "",
          streetAddress: "",
        },
        landmarks: landmarks.map((landmark, index) => ({
          id: `snapshot-${index}`,
          name: landmark.name,
          address: landmark.address,
          latitude: landmark.latitude,
          longitude: landmark.longitude,
          source: landmark.source,
          placeId:
            "place_id" in landmark
              ? (landmark.place_id ?? undefined)
              : landmark.placeId,
        })),
      }),
    clearPreview: () =>
      set({ title: "", businessLocation: null, landmarks: [] }),
  }),
);
