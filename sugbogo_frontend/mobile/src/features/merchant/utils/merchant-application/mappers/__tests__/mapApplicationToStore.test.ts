import type { ApplicationDetailResponse } from "@/features/merchant/types/registration/registrationApi.types";
import { mapApplicationToStore } from "../mapApplicationToStore.utils";

const application: ApplicationDetailResponse = {
  id: 1,
  status: "draft",
  highest_completed_step: 2,
  submitted_at: null,
  reviewed_at: null,
  submission_count: 0,
  latest_review: null,
  created_at: "2026-10-20T00:00:00Z",
  updated_at: "2026-10-20T00:00:00Z",
  identity: null,
  location: {
    latitude: 10.3,
    longitude: 123.9,
    province: "Cebu",
    city: "Cebu City",
    barangay: "Lahug",
    street_address: "Sample Street",
    formatted_address: "Sample Street, Cebu City",
    unit: null,
    landmarks: [],
  },
  operating_hours: [],
  photos: [],
  documents: [],
  review_sla_min_business_days: 3,
  review_sla_max_business_days: 5,
};

describe("mapApplicationToStore", () => {
  it("restores a backend-validated saved point and its editable address", () => {
    const result = mapApplicationToStore(application);
    expect(result.selectedLocation).toMatchObject({
      latitude: 10.3,
      longitude: 123.9,
      isWithinServiceArea: true,
    });
    expect(result.selectedAddress?.streetAddress).toBe("Sample Street");
  });

  it.each(["latitude", "longitude"] as const)(
    "does not mark a missing %s as validated",
    (coordinate) => {
      const result = mapApplicationToStore({
        ...application,
        location: { ...application.location!, [coordinate]: null },
      });
      expect(result.selectedLocation?.isWithinServiceArea).toBe(false);
    },
  );

  it("keeps a missing location empty", () => {
    expect(mapApplicationToStore({ ...application, location: null })).toEqual({
      selectedLocation: null,
      selectedAddress: null,
      selectedLandmarks: [],
    });
  });
});
