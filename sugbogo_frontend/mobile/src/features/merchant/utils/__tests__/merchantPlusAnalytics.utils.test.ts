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
  buildAnalyticsCalendar,
  analyticsCalendarLabel,
  analyticsCountTicks,
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

describe("analytics calendar positions", () => {
  it("preserves missing days separately from reported zero without mutating observations", () => {
    const points = [
      { ...bucket("2026-10-01"), value: 0 },
      { ...bucket("2026-10-03"), value: 7 },
    ];
    const original = JSON.stringify(points);
    const slots = buildAnalyticsCalendar(
      points,
      "daily",
      bucket("2026-09-30", 5),
    );

    expect(slots.map((slot) => slot.date)).toEqual([
      "2026-09-30",
      "2026-10-01",
      "2026-10-02",
      "2026-10-03",
      "2026-10-04",
    ]);
    expect(slots.map((slot) => slot.observation?.value ?? null)).toEqual([
      null,
      0,
      null,
      7,
      null,
    ]);
    expect(slots[1].observation).toBe(points[0]);
    expect(JSON.stringify(points)).toBe(original);
  });

  it("retains Monday spacing for missing weeks and zero weeks", () => {
    const slots = buildAnalyticsCalendar(
      [
        { ...bucket("2026-09-21", 7), value: 2 },
        { ...bucket("2026-09-28", 7), value: 0 },
        { ...bucket("2026-10-12", 7), value: 3 },
      ],
      "weekly",
    );

    expect(slots.map((slot) => slot.date)).toEqual([
      "2026-09-21",
      "2026-09-28",
      "2026-10-05",
      "2026-10-12",
    ]);
    expect(slots.map((slot) => slot.observation?.value ?? null)).toEqual([
      2,
      0,
      null,
      3,
    ]);
  });

  it("clips partial first and last Monday weeks to the actual reporting bounds", () => {
    const range = {
      start: "2026-09-24T00:00:00+08:00",
      end_exclusive: "2026-10-06T12:00:00+08:00",
    };
    const slots = buildAnalyticsCalendar([], "weekly", range);

    expect(slots.map((slot) => slot.date)).toEqual([
      "2026-09-21",
      "2026-09-28",
      "2026-10-05",
    ]);
    expect(slots.map((slot) => slot.partial)).toEqual([true, false, true]);
    expect(analyticsCalendarLabel(slots[0], "weekly")).toBe(
      "Sep 24 – Sep 27 · partial week",
    );
    expect(analyticsCalendarLabel(slots[2], "weekly")).toBe(
      "Oct 5 – Oct 6 · partial week",
    );
    expect(slots.every((slot) => slot.observation === null)).toBe(true);
  });

  it("uses Manila dates for UTC bounds and treats an exclusive midnight as the next boundary", () => {
    const slots = buildAnalyticsCalendar([], "daily", {
      start: "2026-09-30T16:00:00Z",
      end_exclusive: "2026-10-02T16:00:00Z",
    });
    expect(slots.map((slot) => slot.date)).toEqual([
      "2026-10-01",
      "2026-10-02",
    ]);
    expect(slots.every((slot) => !slot.partial)).toBe(true);
    expect(buildAnalyticsCalendar([], "daily")).toEqual([]);
  });

  it("marks a current partial day without adding future dates", () => {
    const slots = buildAnalyticsCalendar([], "daily", {
      start: "2026-10-01T00:00:00+08:00",
      end_exclusive: "2026-10-02T12:00:00+08:00",
    });
    expect(slots).toHaveLength(2);
    expect(analyticsCalendarLabel(slots[1], "daily")).toBe(
      "Oct 2 · partial day",
    );
  });

  it.each([0, 1, 2, 3, 9, 101, 250_000])(
    "uses distinct integer count ticks for a maximum of %i",
    (maximum) => {
      const ticks = analyticsCountTicks(maximum);
      expect(ticks[0]).toBe(0);
      expect(ticks[ticks.length - 1]).toBeGreaterThanOrEqual(maximum);
      expect(ticks.every(Number.isInteger)).toBe(true);
      expect(new Set(ticks).size).toBe(ticks.length);
      expect(ticks.length).toBeLessThanOrEqual(5);
    },
  );
});
