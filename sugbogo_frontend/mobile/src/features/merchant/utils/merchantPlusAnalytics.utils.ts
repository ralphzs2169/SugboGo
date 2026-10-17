import type {
  AnalyticsBucket,
  AnalyticsChange,
  AnalyticsInterval,
} from "../types/merchantPlusAnalytics.types";

export type AnalyticsPlotPoint = AnalyticsBucket & { value: number };

/** Splits actual observations at missing calendar buckets; never inserts zero points. */
export function splitObservedSeries(
  points: AnalyticsPlotPoint[],
  interval: AnalyticsInterval,
) {
  const ordered = [...points].sort(
    (a, b) => Date.parse(a.start) - Date.parse(b.start),
  );
  const groups: AnalyticsPlotPoint[][] = [];
  const expectedDays = interval === "weekly" ? 7 : 1;
  for (const point of ordered) {
    const last = groups.at(-1);
    const previous = last?.at(-1);
    const adjacent =
      previous &&
      Date.parse(point.date) - Date.parse(previous.date) ===
        expectedDays * 86_400_000;
    if (last && adjacent) last.push(point);
    else groups.push([point]);
  }
  return groups;
}

/** Formats reporting timestamps in Manila without changing their calendar bucket. */
export function shortAnalyticsDate(timestamp: string) {
  return new Date(timestamp).toLocaleDateString("en-PH", {
    day: "numeric",
    month: "short",
    timeZone: "Asia/Manila",
  });
}

/** Shows the actual clipped range rather than implying an entire partial week. */
export function analyticsBucketLabel(
  bucket: AnalyticsBucket,
  interval: AnalyticsInterval,
) {
  const first = shortAnalyticsDate(bucket.start);
  if (interval === "daily") return first;
  const last = shortAnalyticsDate(
    new Date(Date.parse(bucket.end_exclusive) - 1).toISOString(),
  );
  return first === last ? first : `${first} – ${last}`;
}

/** Preserves a legitimate zero duration and makes unavailable reply timing explicit. */
export function formatReplyDuration(seconds: number | null) {
  if (seconds === null) return "Unavailable";
  if (seconds < 60) return `${Math.round(seconds)} sec`;
  const [divisor, unit] =
    seconds < 3600
      ? [60, "min"]
      : seconds < 86400
        ? [3600, "hr"]
        : [86400, "days"];
  return `${Number((seconds / divisor).toFixed(1))} ${unit}`;
}

/** Displays only a supplied percentage-point comparison, never a computed growth rate. */
export function formatReplyComparison(change: AnalyticsChange) {
  if (change.value === null || change.unit !== "percentage_points")
    return "Comparison unavailable";
  return `${change.value > 0 ? "+" : ""}${change.value} percentage points vs previous review cohort`;
}
