import {
  needsJourneyReview,
  parseSavedJourney,
  savedJourneyKey,
} from "../savedJourney.utils";
import { snapshot } from "./savedJourney.fixture";

describe("saved journey validation", () => {
  it("round trips the selected journey and uses stable identity across repeated saves", () => {
    expect(parseSavedJourney(JSON.stringify(snapshot))).toEqual(snapshot);
    expect(
      savedJourneyKey({ ...snapshot, savedAt: "2026-10-15T01:00:00.000Z" }),
    ).toBe(savedJourneyKey(snapshot));
  });

  it.each([
    "not json",
    "null",
    JSON.stringify({ ...snapshot, formatVersion: 2 }),
    JSON.stringify({
      ...snapshot,
      origin: { ...snapshot.origin, latitude: 200 },
    }),
    JSON.stringify({
      ...snapshot,
      journey: {
        ...snapshot.journey,
        alighting_transit_point: {
          ...snapshot.journey.alighting_transit_point,
          sequence: 1,
        },
      },
    }),
  ])("rejects corrupt or incompatible data", (json) =>
    expect(parseSavedJourney(json)).toBeNull(),
  );

  it("strips unapproved fields such as tokens and does not accept oversized data", () => {
    expect(
      parseSavedJourney(
        JSON.stringify({ ...snapshot, accessToken: "private" }),
      ),
    ).not.toHaveProperty("accessToken");
    expect(parseSavedJourney(" ".repeat(1_000_001))).toBeNull();
  });

  it("marks snapshots for review at seven days without deleting them", () => {
    const start = Date.parse(snapshot.savedAt);
    expect(needsJourneyReview(snapshot.savedAt, start + 7 * 86400000 - 1)).toBe(
      false,
    );
    expect(needsJourneyReview(snapshot.savedAt, start + 7 * 86400000)).toBe(
      true,
    );
  });
});
