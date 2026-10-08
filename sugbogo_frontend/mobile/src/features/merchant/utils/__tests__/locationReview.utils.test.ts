import { getLocationReviewChanges } from "../locationReview.utils";

const current = {
  latitude: 10.31,
  longitude: 123.88,
  address: "Old address",
  city: "Cebu City",
  province: "Cebu",
  postal_code: "6000",
};

describe("location request review changes", () => {
  it("keeps an address-only edit separate from the business pin", () => {
    const changes = getLocationReviewChanges(
      current,
      { ...current, address: "New address" },
      [],
      [],
    );

    expect(changes.pinMoved).toBe(false);
    expect(changes.addressChanges).toEqual([
      {
        label: "Address",
        previous: "Old address",
        requested: "New address",
      },
    ]);
    expect(changes.addedLandmarks).toEqual([]);
    expect(changes.removedLandmarks).toEqual([]);
  });

  it("identifies a moved pin and added landmark independently", () => {
    const landmark = {
      id: "new-landmark",
      name: "Nearby cafe",
      address: "Cebu City",
      latitude: 10.32,
      longitude: 123.89,
      source: "google" as const,
      placeId: "place-1",
    };
    const changes = getLocationReviewChanges(
      current,
      { ...current, latitude: 10.33 },
      [],
      [landmark],
    );

    expect(changes.pinMoved).toBe(true);
    expect(changes.addressChanges).toEqual([]);
    expect(changes.addedLandmarks).toEqual([landmark]);
  });
});
