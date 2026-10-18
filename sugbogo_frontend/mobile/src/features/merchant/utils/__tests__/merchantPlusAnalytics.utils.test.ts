import {
  bucket,
  eventMetric,
} from "../../__tests__/merchantPlusAnalytics.fixtures";
import {
  analyticsBucketLabel,
  formatReplyComparison,
  formatReplyDuration,
  splitObservedSeries,
  formatOptionalAnalyticsTimestamp,
} from "../merchantPlusAnalytics.utils";

describe("Plus analytics measurement presentation", () => {
  it("keeps missing generation timestamps unavailable and dates in Manila with a year", () => {
    expect(formatOptionalAnalyticsTimestamp(null)).toBe("Unavailable");
    expect(formatOptionalAnalyticsTimestamp("2026-10-10T23:00:00Z")).toContain(
      "Oct 11, 2026",
    );
  });
  it("splits sparse daily lines without inserting or mutating observations", () => {
    const points = eventMetric().series!;
    const original = JSON.stringify(points);
    const segments = splitObservedSeries(points, "daily");
    expect(segments.map((group) => group.length)).toEqual([2, 2]);
    expect(segments.flat()).toHaveLength(4);
    expect(JSON.stringify(points)).toBe(original);
  });
  it("does not connect missing weeks and retains explicit zero buckets", () => {
    const points = ["2026-09-21", "2026-09-28", "2026-10-12"].map((date) => ({
      ...bucket(date, 7),
      value: 0,
    }));
    expect(
      splitObservedSeries(points, "weekly").map((group) => group.length),
    ).toEqual([2, 1]);
    expect(splitObservedSeries([], "daily")).toEqual([]);
  });
  it("labels clipped weeks using their real Manila boundaries", () => {
    const partial = {
      ...bucket("2026-10-05", 7),
      start: "2026-10-06T16:00:00Z",
      end_exclusive: "2026-10-08T16:00:00Z",
    };
    expect(analyticsBucketLabel(partial, "weekly")).toBe("Oct 7 – Oct 8");
  });
  it("keeps null medians distinct from a valid zero duration", () => {
    expect(formatReplyDuration(null)).toBe("Unavailable");
    expect(formatReplyDuration(0)).toBe("0 sec");
    expect(formatReplyDuration(3600)).toBe("1 hr");
  });
  it("never manufactures a comparison from null or a percent-based value", () => {
    expect(
      formatReplyComparison({
        value: null,
        unit: "percentage_points",
        direction: null,
        reason: "missing_value",
      }),
    ).toBe("Comparison unavailable");
    expect(
      formatReplyComparison({
        value: 0,
        unit: "percentage_points",
        direction: "unchanged",
        reason: null,
      }),
    ).toContain("0 percentage points");
  });
});
