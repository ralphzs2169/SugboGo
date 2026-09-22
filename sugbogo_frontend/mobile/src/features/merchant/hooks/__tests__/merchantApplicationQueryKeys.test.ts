import { merchantApplicationKeys } from "../merchantApplicationQueryKeys";

describe("merchantApplicationKeys", () => {
  it("returns stable keys for merchant application resources", () => {
    expect(merchantApplicationKeys.current(12)).toEqual([
      "merchant-application",
      "current",
      12,
    ]);
    expect(merchantApplicationKeys.current(12)).toEqual(
      merchantApplicationKeys.current(12),
    );
    expect(merchantApplicationKeys.clusters()).toEqual([
      "merchant-application",
      "options",
      "clusters",
    ]);
    expect(merchantApplicationKeys.categories()).toEqual([
      "merchant-application",
      "options",
      "categories",
    ]);
    expect(merchantApplicationKeys.specialtyTags()).toEqual([
      "merchant-application",
      "options",
      "specialty-tags",
    ]);
  });

  it("preserves the existing application status key", () => {
    expect(merchantApplicationKeys.status(12)).toEqual([
      "merchant-application-status",
      12,
    ]);
  });

  it("scopes nearby landmarks by the exact registration coordinates", () => {
    expect(merchantApplicationKeys.nearbyLandmarks(10.3157, 123.8854)).toEqual(
      [
        "merchant-application",
        "nearby-landmarks",
        10.3157,
        123.8854,
      ],
    );
    expect(merchantApplicationKeys.nearbyLandmarks(10.3157, 123.8854)).toEqual(
      merchantApplicationKeys.nearbyLandmarks(10.3157, 123.8854),
    );
    expect(
      merchantApplicationKeys.nearbyLandmarks(10.31571, 123.8854),
    ).not.toEqual(
      merchantApplicationKeys.nearbyLandmarks(10.3157, 123.8854),
    );
  });

  it("keys registration location reads by normalized input, place ID, and coordinates", () => {
    expect(merchantApplicationKeys.placeSearch("  Cebu  ")).toEqual([
      "merchant-application",
      "place-search",
      "Cebu",
    ]);
    expect(merchantApplicationKeys.placeDetails("place-1")).toEqual([
      "merchant-application",
      "place-details",
      "place-1",
    ]);
    expect(merchantApplicationKeys.reverseGeocode(10.3157, 123.8854)).toEqual(
      ["merchant-application", "reverse-geocode", 10.3157, 123.8854],
    );
  });
});
