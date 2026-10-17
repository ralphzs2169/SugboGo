import type { AnalyticsSpecialtySupport } from "../types/merchantAnalytics.types";

/** Keeps unavailable counts distinct from healthy zero activity. */
export function formatAnalyticsCount(value: number | null) {
  return value === null ? "—" : value.toLocaleString("en-PH");
}

/** Formats API calendar dates without shifting them through the device timezone. */
export function formatAnalyticsDate(value: string) {
  return new Date(`${value}T00:00:00Z`).toLocaleDateString("en-PH", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

/** Displays snapshot clocks in the same timezone as the reporting period. */
export function formatAnalyticsTimestamp(value: string) {
  return new Date(value).toLocaleString("en-PH", {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "Asia/Manila",
  });
}

/** Ranks the complete, bounded specialty response without mutating cached data. */
export function rankSpecialtySupport(specialties: AnalyticsSpecialtySupport[]) {
  return [...specialties].sort((first, second) => {
    return (
      second.valid_vouches - first.valid_vouches ||
      second.distinct_supporters - first.distinct_supporters ||
      first.specialty_name.localeCompare(second.specialty_name) ||
      first.specialty_id - second.specialty_id
    );
  });
}
