import {
  decodeGooglePolyline,
  formatRoadRouteDuration,
} from "../roadRoute.utils";

describe("road route utilities", () => {
  it("decodes Google's encoded road polyline into map coordinates", () => {
    expect(decodeGooglePolyline("_p~iF~ps|U_ulLnnqC_mqNvxq`@"))
      .toEqual([
        {
          latitude: 38.5,
          longitude: -120.2,
        },
        {
          latitude: 40.7,
          longitude: -120.95,
        },
        {
          latitude: 43.252,
          longitude: -126.453,
        },
      ]);
  });

  it("formats approximate minute and hour durations", () => {
    expect(formatRoadRouteDuration(480)).toBe("8 min");
    expect(formatRoadRouteDuration(4320)).toBe("1 hr 12 min");
  });
});
