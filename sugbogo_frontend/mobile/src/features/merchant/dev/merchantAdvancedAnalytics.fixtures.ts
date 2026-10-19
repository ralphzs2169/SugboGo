// Isolated synthetic development data; never used by real report queries.
import type {
  PlusStoredInsightsReport,
  PlusProfileTimingReport,
} from "../types/merchantAdvancedAnalytics.types";
import { plusMeta } from "./merchantPlusAnalytics.fixtures";
import { standardAnalyticsReport } from "./merchantAnalytics.fixtures";

export function storedInsightsReport(): PlusStoredInsightsReport {
  return {
    business: standardAnalyticsReport().business,
    meta: plusMeta(),
    measurement_note:
      "Stored insights use their own rolling 30-day generation window, not the selected analytics period.",
    stored_summary: {
      state: "outdated",
      state_message: "Review insights are outdated and awaiting refresh.",
      content_available: true,
      narrative: "Stored narrative from eligible reviews.",
      review_count: 8,
      eligible_review_count: 8,
      minimum_eligible_review_count: 5,
      analyzed_review_count: 6,
      classified_review_count: 5,
      has_sufficient_sentiment_data: true,
      overall_vibe: "mixed",
      is_sampled: true,
      sentiment: {
        positive: { count: 3, percentage: 60 },
        neutral: { count: 1, percentage: 20 },
        negative: { count: 1, percentage: 20 },
      },
      frequent_mentions: [
        { label: "Coffee", count: 3 },
        { label: "Service", count: 4 },
      ],
      coverage_start: "2026-09-10T00:00:00Z",
      coverage_end: "2026-10-10T00:00:00Z",
      generated_at: "2026-10-10T01:00:00Z",
      sentiment_computed_at: "2026-10-10T01:00:00Z",
      updated_at: "2026-10-12T00:00:00Z",
      policy: {
        current_version: 2,
        generated_version: 1,
        provenance: "recorded",
        generation_rules_match: false,
        thresholds: {
          sentiment_min_classified_reviews: 3,
          narrative_min_eligible_reviews: 5,
          mention_min_supporting_reviews: 2,
        },
      },
    },
  };
}

export function timingReport(): PlusProfileTimingReport {
  const weekdays = [
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
    "Sunday",
  ].map((label, index) => ({ weekday: index + 1, label }));
  const hours = Array.from({ length: 24 }, (_, hour) => hour);
  return {
    business: standardAnalyticsReport().business,
    label: "Recorded profile-visit timing",
    metric: "profile_visits",
    timezone: "Asia/Manila",
    grid_version: "manila-weekday-hour-v1",
    weekdays,
    hours,
    cells: weekdays.flatMap(({ weekday }) =>
      hours.map((hour) => {
        const count =
          weekday === 1 && hour === 9
            ? 2
            : weekday === 2 && hour === 10
              ? 1
              : 0;
        return {
          id: `${weekday}:${hour}`,
          weekday,
          hour,
          profile_visits: count,
          state:
            count > 0
              ? ("recorded_visits" as const)
              : ("zero_recorded_visits" as const),
          period_occurrences: 4,
          includes_partial_hour: weekday === 7 && hour === 23,
        };
      }),
    ),
    total_profile_visits: 3,
    display_state: "recorded_visits",
    sample: {
      nonzero_cells: 2,
      in_period_cells: 168,
      outside_period_cells: 0,
      conclusions_available: false,
      reason: "no_approved_timing_inference_policy",
    },
    legend: {
      method: "linear_count",
      minimum: 0,
      maximum: 2,
      zero_range: false,
    },
    deduplication: "explorer_business_event_type_utc_day",
    measurement_note:
      "Recorded online observations are not physical arrivals or recommended opening hours.",
    period_occurrences_note:
      "Selected calendar occurrences are not verified tracking coverage.",
    sources: { visibility: plusMeta() },
    meta: plusMeta(),
  };
}
