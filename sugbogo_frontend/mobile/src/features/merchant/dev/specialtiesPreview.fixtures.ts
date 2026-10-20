import type { MerchantAnalyticsPeriod } from "../types/merchantAnalytics.types";
import type { PlusSpecialtyReport } from "../types/merchantPlusAnalytics.types";
import { buildAnalyticsCalendar } from "../utils/merchantPlusAnalytics.utils";

export type SpecialtyPreviewState =
  | "populated"
  | "sparse"
  | "zero"
  | "missing"
  | "empty"
  | "unavailable"
  | "error"
  | "loading";

/** Synthetic calendar-aligned fixtures; no API, database, or provider access. */
export function specialtyPreviewReport(
  period: MerchantAnalyticsPeriod,
  state: SpecialtyPreviewState,
): PlusSpecialtyReport {
  const end = new Date("2026-10-20T04:00:00Z");
  const start = new Date("2026-10-19T16:00:00Z");
  start.setUTCDate(start.getUTCDate() - Number(period) + 1);
  const range = {
    start: start.toISOString(),
    end_exclusive: end.toISOString(),
  };
  const calendar = buildAnalyticsCalendar([], "weekly", range);
  const values = [
    [2, 4, 1, 6, 3],
    [1, 2, 4, 2, 1],
    [0, 1, 2, 1, 3],
  ];
  return {
    business: { id: 0, name: "Synthetic preview business", status: "active" },
    interval: "weekly",
    label: "Added and still valid",
    snapshot_as_of: end.toISOString(),
    specialties:
      state === "empty" || state === "unavailable"
        ? []
        : ["Friendly service", "Food quality", "Atmosphere"].map(
            (name, specialtyIndex) => {
              const series = calendar
                .filter((_, index) =>
                  state === "sparse"
                    ? index === calendar.length - 1
                    : state === "missing"
                      ? index !== 1
                      : true,
                )
                .map((slot, index) => {
                  const value =
                    state === "zero" ? 0 : values[specialtyIndex][index % 5];
                  return {
                    date: slot.date,
                    start: slot.start,
                    end_exclusive: slot.end_exclusive,
                    added_and_still_valid: value,
                    distinct_supporters: value,
                  };
                });
              const total = series.reduce(
                (sum, bucket) => sum + bucket.added_and_still_valid,
                0,
              );
              return {
                specialty_id: specialtyIndex + 1,
                specialty_name: name,
                added_and_still_valid: total,
                distinct_supporters:
                  total === 0 ? 0 : Math.max(1, Math.ceil(total * 0.7)),
                series,
              };
            },
          ),
    meta: {
      period: {
        ...range,
        timezone: "Asia/Manila",
        start_date: new Date(start.getTime() + 8 * 3600000)
          .toISOString()
          .slice(0, 10),
        end_date: "2026-10-20",
        previous_start: new Date(
          start.getTime() - (end.getTime() - start.getTime()),
        ).toISOString(),
        previous_end_exclusive: start.toISOString(),
      },
      data_through: end.toISOString(),
      generated_at: end.toISOString(),
      availability: state === "unavailable" ? "unavailable" : "partial",
      is_partial: true,
      partial_reason: "retained_valid_vouches_only",
      partial_reasons: ["retained_valid_vouches_only"],
      coverage_verified: false,
    },
  };
}
