import {
  formatJourneyDistance,
  getNoDirectJourneyContent,
} from "../directJourney.utils";

describe("direct journey presentation utilities", () => {
  it("formats backend meter distances without false precision", () => {
    expect(formatJourneyDistance(180.45)).toBe("180 m");
    expect(formatJourneyDistance(3438.7291)).toBe("3.4 km");
  });

  it("maps backend no-route reasons to user-facing guidance", () => {
    expect(
      getNoDirectJourneyContent("no_nearby_boarding_point").title,
    ).toBe("No boarding point nearby");
    expect(
      getNoDirectJourneyContent("no_nearby_alighting_point").title,
    ).toBe("No direct route close to this destination");
    expect(getNoDirectJourneyContent("no_direct_route_match").title).toBe(
      "No convenient direct route found",
    );
  });
});
