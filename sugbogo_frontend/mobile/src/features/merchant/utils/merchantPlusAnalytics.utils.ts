import type {
  AnalyticsBucket,
  AnalyticsChange,
  AnalyticsInterval,
} from "../types/merchantPlusAnalytics.types";

export type AnalyticsPlotPoint = AnalyticsBucket & { value: number };

export type AnalyticsChartRange = Pick<
  AnalyticsBucket,
  "start" | "end_exclusive"
>;

/** Calendar positions carry observations separately so an absent count never becomes zero. */
export type AnalyticsCalendarSlot = AnalyticsBucket & {
  observation: AnalyticsPlotPoint | null;
  partial: boolean;
};

const DAY_MS = 86_400_000;
const MANILA_OFFSET_MS = 8 * 60 * 60 * 1000;

function manilaCalendarDate(timestamp: number) {
  return new Date(timestamp + MANILA_OFFSET_MS).toISOString().slice(0, 10);
}

/** Matches the backend's Manila calendar days and Monday weeks, including clipped boundaries. */
export function buildAnalyticsCalendar(
  points: AnalyticsPlotPoint[],
  interval: AnalyticsInterval,
  range?: AnalyticsChartRange,
) {
  const ordered = [...points].sort(
    (first, second) => Date.parse(first.start) - Date.parse(second.start),
  );
  if (!range && ordered.length === 0) return [];

  const start = Date.parse(range?.start ?? ordered[0].start);
  const end = Date.parse(
    range?.end_exclusive ?? ordered[ordered.length - 1].end_exclusive,
  );
  const calendarDate = manilaCalendarDate(start);
  let calendarStart = Date.parse(`${calendarDate}T00:00:00+08:00`);
  const duration = interval === "weekly" ? 7 * DAY_MS : DAY_MS;

  if (interval === "weekly") {
    const weekday = new Date(calendarStart + MANILA_OFFSET_MS).getUTCDay();
    calendarStart -= ((weekday + 6) % 7) * DAY_MS;
  }

  const observations = new Map(ordered.map((point) => [point.date, point]));
  const slots: AnalyticsCalendarSlot[] = [];

  for (let time = calendarStart; time < end; time += duration) {
    const date = manilaCalendarDate(time);
    const observation = observations.get(date) ?? null;
    const slotStart = observation
      ? Date.parse(observation.start)
      : Math.max(time, start);
    const slotEnd = observation
      ? Date.parse(observation.end_exclusive)
      : Math.min(time + duration, end);

    slots.push({
      date,
      start: new Date(slotStart).toISOString(),
      end_exclusive: new Date(slotEnd).toISOString(),
      observation,
      partial: slotStart > time || slotEnd < time + duration,
    });
  }

  return slots;
}

/** Supplies a zero-based integer scale with readable 1/2/5 steps and no fractional counts. */
export function analyticsCountTicks(maximum: number) {
  const targetStep = Math.max(1, maximum / 4);
  const magnitude = 10 ** Math.floor(Math.log10(targetStep));
  const multiplier = [1, 2, 5, 10].find(
    (candidate) => candidate * magnitude >= targetStep,
  )!;
  const step = multiplier * magnitude;
  const ceiling = Math.max(step, Math.ceil(maximum / step) * step);

  return Array.from({ length: ceiling / step + 1 }, (_, index) => index * step);
}

/** Exact-value labels use the real covered dates rather than implying complete calendar weeks. */
export function analyticsCalendarLabel(
  slot: AnalyticsCalendarSlot,
  interval: AnalyticsInterval,
) {
  const dates = analyticsBucketLabel(slot, interval);
  if (!slot.partial) return dates;
  return `${dates} · partial ${interval === "weekly" ? "week" : "day"}`;
}

/** Retains unavailable stored timestamps and includes the year for generation coverage. */
export function formatOptionalAnalyticsTimestamp(value: string | null) {
  if (value === null) return "Unavailable";
  return new Date(value).toLocaleString("en-PH", {
    year: "numeric",
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "Asia/Manila",
  });
}

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
  return `${change.value > 0 ? "+" : ""}${change.value} percentage points compared with reviews from the previous period`;
}
