import type { BusinessChangeRequestEligibility } from "./businessChangeRequestEligibility.types";

export type LocationChangeStatus =
  "pending" | "approved" | "rejected" | "withdrawn";

export type LocationChangeLocation = {
  id?: number;
  latitude: number;
  longitude: number;
  address: string;
  city: string;
  province: string;
  postal_code: string | null;
};

export type LocationChangeLandmark = {
  id: number | null;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  source: "google" | "custom";
  place_id: string | null;
};

export type LocationChangeSnapshot = {
  location: LocationChangeLocation;
  landmarks: LocationChangeLandmark[];
};

export type LocationChangeRequest = {
  id: number;
  request_type: "location";
  status: LocationChangeStatus;
  previous: LocationChangeSnapshot;
  proposed: LocationChangeSnapshot;
  submitted_at: string;
  resolved_at: string | null;
  rejection_reason: string | null;
  reason: string | null;
};

export type LocationChangeRequestPage = {
  items: LocationChangeRequest[];
  eligibility: BusinessChangeRequestEligibility;
  pagination: {
    page: number;
    page_size: number;
    total_items: number;
    total_pages: number;
    has_next: boolean;
    has_previous: boolean;
  };
};

export type SubmitLocationChangePayload = {
  proposed_location: Omit<LocationChangeLocation, "id">;
  proposed_landmarks: Omit<LocationChangeLandmark, "id">[];
  reason: string;
};
