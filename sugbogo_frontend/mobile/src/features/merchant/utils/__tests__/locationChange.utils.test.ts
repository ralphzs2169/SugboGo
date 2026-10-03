import type { MerchantBusinessProfileResponse } from "../../types/merchantBusinessProfile.types";
import {
  buildLocationChangePayload,
  liveLandmarkSelection,
  liveLocationProposal,
  locationProposalChanged,
  selectedLocationProposal,
  toPickerLocation,
} from "../locationChange.utils";

const business = {
  id: 7,
  location: {
    address: "Flat live address",
    city: "Cebu City",
    province: "Cebu",
    postal_code: "6000",
    latitude: 10.31,
    longitude: 123.88,
    landmarks: [
      {
        id: 1,
        name: "North landmark",
        address: "North road",
        latitude: 10.32,
        longitude: 123.88,
        source: "google",
        place_id: "north-place",
      },
      {
        id: 2,
        name: "South landmark",
        address: "South road",
        latitude: 10.3,
        longitude: 123.88,
        source: "custom",
        place_id: null,
      },
    ],
  },
} as MerchantBusinessProfileResponse;

describe("Location change proposal adapters", () => {
  it("prefills the flat live address and complete owner landmark values", () => {
    const location = liveLocationProposal(business.location);
    const landmarks = liveLandmarkSelection(business.location);

    expect(location.address).toBe("Flat live address");
    expect(landmarks).toHaveLength(2);
    expect(landmarks[0]).toMatchObject({
      name: "North landmark",
      source: "google",
      placeId: "north-place",
      latitude: 10.32,
    });
    expect(toPickerLocation(location)).toMatchObject({
      formattedAddress: "Flat live address",
      streetAddress: "",
      barangay: "",
    });
  });

  it("uses search or reverse-geocode display values without fabricating a postal code", () => {
    const selected = {
      ...toPickerLocation(liveLocationProposal(business.location)),
      latitude: 10.33,
      longitude: 123.9,
      formattedAddress: "New selected address",
    };
    const proposal = selectedLocationProposal(
      selected,
      liveLocationProposal(business.location),
    );

    expect(proposal).toMatchObject({
      address: "New selected address",
      postal_code: "",
    });
  });

  it("submits a complete desired landmark set, including an empty set", () => {
    const location = liveLocationProposal(business.location);
    const empty = buildLocationChangePayload(location, []);
    const selected = buildLocationChangePayload(
      location,
      liveLandmarkSelection(business.location),
    );

    expect(empty.proposed_landmarks).toEqual([]);
    expect(selected.proposed_landmarks).toEqual([
      expect.objectContaining({ place_id: "north-place", source: "google" }),
      expect.objectContaining({ place_id: null, source: "custom" }),
    ]);
  });

  it("ignores landmark order and detects point, address, or set changes", () => {
    const unchanged = buildLocationChangePayload(
      liveLocationProposal(business.location),
      liveLandmarkSelection(business.location).reverse(),
    );
    expect(locationProposalChanged(business, unchanged)).toBe(false);
    expect(
      locationProposalChanged(business, {
        ...unchanged,
        proposed_location: {
          ...unchanged.proposed_location,
          longitude: 123.89,
        },
      }),
    ).toBe(true);
    expect(
      locationProposalChanged(business, {
        ...unchanged,
        proposed_location: {
          ...unchanged.proposed_location,
          address: "Another flat address",
        },
      }),
    ).toBe(true);
    expect(
      locationProposalChanged(business, {
        ...unchanged,
        proposed_landmarks: [],
      }),
    ).toBe(true);
  });
});
