import { MERCHANT_REGISTRATION_DEFAULT_VALUES } from "../../constants/registration/defaultValues.constants";
import { buildLocationPayload } from "../../utils/merchant-application/builders/buildLocationPayload.utils";
import { hasLocationChanged } from "../../utils/merchant-application/comparisons/hasLocationChanged.utils";
import { mapApplicationToForm } from "../../utils/merchant-application/mappers/mapApplicationToForm.utils";
import { mapApplicationToStore } from "../../utils/merchant-application/mappers/mapApplicationToStore.utils";
import { normalizeLocation } from "../../utils/merchant-application/normalizers/normalizeLocation.utils";
import type { ApplicationDetailResponse } from "../../types/registration/registrationApi.types";
import { merchantRegistrationSchema } from "../merchantRegistration.schema";

const arrival = {
  id: "1",
  name: "Bakery",
  address: "Cebu City",
  latitude: 10.31,
  longitude: 123.9,
  source: "custom" as const,
  is_arrival_point: true,
  access_directions: "Enter the green gate beside the bakery.",
};

describe("arrival landmarks during registration", () => {
  it("keeps ordinary landmarks optional and requires directions only for the arrival point", () => {
    const schema = merchantRegistrationSchema.shape.landmarks;
    expect(schema.safeParse([]).success).toBe(true);
    expect(
      schema.safeParse([
        { ...arrival, is_arrival_point: false, access_directions: "" },
      ]).success,
    ).toBe(true);
    expect(schema.safeParse([arrival]).success).toBe(true);
    expect(
      schema.safeParse([{ ...arrival, access_directions: "  " }]).success,
    ).toBe(false);
    expect(schema.safeParse([arrival, { ...arrival, id: "2" }]).success).toBe(
      false,
    );
  });

  it("sends trimmed arrival details and detects edits affecting only the notes", () => {
    const values = {
      ...MERCHANT_REGISTRATION_DEFAULT_VALUES,
      latitude: 10.31,
      longitude: 123.9,
      landmarks: [
        { ...arrival, access_directions: `  ${arrival.access_directions}  ` },
      ],
    };
    expect(buildLocationPayload(values).landmarks?.[0]).toMatchObject({
      is_arrival_point: true,
      access_directions: arrival.access_directions,
    });
    const previous = normalizeLocation(values);
    expect(hasLocationChanged(previous, normalizeLocation(values))).toBe(false);
    expect(
      hasLocationChanged(
        previous,
        normalizeLocation({
          ...values,
          landmarks: [
            { ...arrival, access_directions: "Enter the blue gate." },
          ],
        }),
      ),
    ).toBe(true);
    expect(
      hasLocationChanged(
        previous,
        normalizeLocation({
          ...values,
          landmarks: [{ ...arrival, is_arrival_point: false }],
        }),
      ),
    ).toBe(true);
  });

  it("restores the arrival selection and notes when resuming a saved application", () => {
    const application: ApplicationDetailResponse = {
      id: 1,
      status: "draft",
      highest_completed_step: 2,
      submitted_at: null,
      reviewed_at: null,
      submission_count: 0,
      latest_review: null,
      created_at: "2026-11-09T00:00:00Z",
      updated_at: "2026-11-09T00:00:00Z",
      review_sla_min_business_days: 3,
      review_sla_max_business_days: 5,
      identity: null,
      location: {
        province: "Cebu",
        city: "Cebu City",
        barangay: "Lahug",
        street_address: "Sample Street",
        formatted_address: "Sample Street, Cebu City",
        unit: null,
        latitude: 10.31,
        longitude: 123.9,
        landmarks: [{ ...arrival, id: 1, place_id: null }],
      },
      operating_hours: [],
      photos: [],
      documents: [],
    };
    expect(mapApplicationToForm(application).landmarks[0]).toMatchObject(
      arrival,
    );
    expect(
      mapApplicationToStore(application).selectedLandmarks[0],
    ).toMatchObject(arrival);
  });
});
