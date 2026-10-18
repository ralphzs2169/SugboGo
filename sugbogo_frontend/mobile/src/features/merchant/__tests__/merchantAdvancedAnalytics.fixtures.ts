import type {
  PlusPeerReport,
  PlusStoredInsightsReport,
  PlusProfileTimingReport,
  PlusRecommendationsReport,
  RecommendationState,
  RecommendationRefreshResult,
} from "../types/merchantAdvancedAnalytics.types";
import { plusMeta } from "./merchantPlusAnalytics.fixtures";
import { standardAnalyticsReport } from "./merchantAnalytics.fixtures";

export function peerReport(): PlusPeerReport {
  return {
    business: standardAnalyticsReport().business,
    status: "partial",
    reason: "see_metric_statuses",
    group: {
      scope: "cluster",
      size: 6,
      minimum_size: 5,
      policy_version: 1,
      positive_share_min_classified_reviews: 5,
      fallback_reason: "category_group_too_small",
      eligibility:
        "Current active businesses in the same cluster; merchant excluded.",
    },
    metrics: {
      profile_visits: {
        label: "Recorded profile visits",
        unit: "events",
        status: "partial",
        reason: "coverage_unverified",
        merchant_value: 0,
        peer_median: 2,
        position: "below_median",
        eligible_peer_sample_size: 6,
        merchant_classified_review_count: null,
      },
      saves: {
        label: "Recorded Pocket SAVE events",
        unit: "events",
        status: "partial",
        reason: "coverage_unverified",
        merchant_value: 2,
        peer_median: 0,
        position: "above_median",
        eligible_peer_sample_size: 6,
        merchant_classified_review_count: null,
      },
      specialty_support: {
        label: "Vouches added and still valid",
        unit: "endorsements",
        status: "available",
        reason: null,
        merchant_value: 1,
        peer_median: 1,
        position: "at_median",
        eligible_peer_sample_size: 6,
        merchant_classified_review_count: null,
      },
      positive_review_share: {
        label: "Positive share of classified published reviews",
        unit: "percent",
        status: "insufficient_data",
        reason: "merchant_sentiment_sample_too_small",
        merchant_value: null,
        peer_median: null,
        position: null,
        eligible_peer_sample_size: 2,
        merchant_classified_review_count: null,
      },
    },
    sources: { visibility: plusMeta(), domain: plusMeta() },
    meta: plusMeta(),
  };
}

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

export function recommendationsReport(
  state: RecommendationState = "not_requested",
): PlusRecommendationsReport {
  return {
    business: standardAnalyticsReport().business,
    state,
    stored_state: state === "not_requested" ? null : state,
    request_id:
      state === "not_requested" ? null : "00000000-0000-4000-8000-000000000001",
    source_period:
      state === "not_requested"
        ? null
        : {
            ...plusMeta().period,
            snapshot_as_of: plusMeta().generated_at,
            includes_partial_day: true,
          },
    requested_selection: {
      start_date: plusMeta().period.start_date,
      end_date: plusMeta().period.end_date,
    },
    requested_at: state === "not_requested" ? null : plusMeta().generated_at,
    generated_at: state === "ready" ? plusMeta().generated_at : null,
    checked_at: plusMeta().generated_at,
    evidence_matches: state !== "invalidated" && state !== "not_requested",
    snapshot_only: true,
    content_available: state === "ready",
    ai_recommendations:
      state === "ready"
        ? [
            {
              action_code: "UNANSWERED_REVIEWS",
              evidence_codes: ["UNANSWERED_REVIEWS"],
              explanation_code: "review_backlog",
              message:
                "Review the unanswered published-review backlog and respond where appropriate.",
            },
          ]
        : [],
    generation_policy:
      state === "not_requested"
        ? null
        : {
            original_version: 1,
            current_version: 1,
            relevant_rules_match: true,
            original_rules: {},
          },
    provenance:
      state === "not_requested"
        ? null
        : {
            provider: "gemini",
            model: "test-model",
            prompt_version: "restricted-actions-1",
            schema_version: "merchant-recommendations-1",
            mode: "restricted_selection",
          },
    error_code: state === "failed" ? "queue_unavailable" : null,
    key_findings: [
      {
        code: "UNANSWERED_REVIEWS",
        message: "Published reviews are awaiting a reply.",
      },
    ],
    recommended_actions: [
      {
        code: "UNANSWERED_REVIEWS",
        message: "Review unanswered feedback where appropriate.",
      },
    ],
    meta: plusMeta(),
    measurement_note:
      "Stored recommendations cover their exact source snapshot, not later activity. Fallback findings use current retained evidence within those bounds.",
  };
}

export function refreshAcknowledgement(): RecommendationRefreshResult {
  const pending = recommendationsReport("pending");
  return {
    request_id: pending.request_id!,
    state: "pending",
    created: true,
    source_period: pending.source_period!,
  };
}
