import { activityDayKey, activityDayLabel } from "../activityTimeline.utils";

describe("activity calendar groups", () => {
  it("uses local calendar days across month boundaries", () => {
    const now = new Date(2026, 10, 1, 0, 10);
    expect(
      activityDayLabel(new Date(2026, 10, 1, 0, 1).toISOString(), now),
    ).toBe("Today");
    expect(
      activityDayLabel(new Date(2026, 9, 31, 23, 59).toISOString(), now),
    ).toBe("Yesterday");
    expect(activityDayKey(new Date(2026, 9, 31, 23, 59).toISOString())).toBe(
      "2026-9-31",
    );
    expect(activityDayLabel(new Date(2025, 9, 1).toISOString(), now)).toContain(
      "2025",
    );
  });
});
