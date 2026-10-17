import type {
  AnalyticsBucket,
  AnalyticsEventMetric,
  MerchantPlusStatus,
  PlusAnalyticsMeta,
  PlusPocketReport,
  PlusReviewPerformanceReport,
  PlusSpecialtyReport,
  PlusVisibilityReport,
  ReviewMeasures,
} from "../types/merchantPlusAnalytics.types";
import {
  standardAnalyticsMeta,
  standardAnalyticsReport,
} from "./merchantAnalytics.fixtures";

export function plusMeta(): PlusAnalyticsMeta {
  const meta = standardAnalyticsMeta();
  return {
    ...meta,
    period: {
      ...meta.period,
      previous_start: "2026-08-19T16:00:00+00:00",
      previous_end_exclusive: meta.period.start,
    },
  };
}

export function plusStatus(allowed = true): MerchantPlusStatus {
  return {
    business: standardAnalyticsReport().business,
    stored_demo_state: "not_created",
    effective_tier: allowed ? "plus" : "standard",
    has_plus_access: allowed,
    access_source: allowed ? "preview" : "none",
    enforcement_enabled: !allowed,
    mock_enabled: false,
    is_simulation: true,
    activated_at: null,
    reset_at: null,
    updated_at: null,
  };
}

export function bucket(date: string, days = 1): AnalyticsBucket {
  const start = new Date(`${date}T00:00:00+08:00`);
  return {
    date,
    start: start.toISOString(),
    end_exclusive: new Date(start.getTime() + days * 86_400_000).toISOString(),
  };
}

export function eventMetric(values = [2, 6, 7, 9]): AnalyticsEventMetric {
  return {
    value: 24,
    previous_value: 0,
    change: {
      value: null,
      direction: null,
      unit: "percent",
      reason: "coverage_unverified",
    },
    series: ["2026-09-20", "2026-09-21", "2026-09-23", "2026-09-24"].map(
      (date, index) => ({ ...bucket(date), value: values[index] }),
    ),
    series_is_sparse: true,
    sources: { current: plusMeta(), previous: plusMeta() },
  };
}

export function visibilityReport(
  interval: "daily" | "weekly" = "daily",
): PlusVisibilityReport {
  const metric = eventMetric();
  if (interval === "weekly") {
    metric.series = [
      "2026-09-21",
      "2026-09-28",
      "2026-10-05",
      "2026-10-12",
    ].map((date, index) => ({
      ...bucket(date, 7),
      value: [2, 6, 7, 9][index],
    }));
  }
  return {
    business: standardAnalyticsReport().business,
    interval,
    meta: plusMeta(),
    measurement_note:
      "Recorded events retain UTC-day deduplication. Period uniques are not sums of bucket uniques.",
    metrics: {
      profile_visits: metric,
      impressions: {
        ...metric,
        value: 39,
        series: metric.series!.map((point, index) => ({
          ...point,
          value: [5, 10, 11, 13][index],
        })),
      },
      distinct_profile_visitors: {
        ...metric,
        value: 12,
        series: metric.series!.map((point, index) => ({
          ...point,
          value: [2, 3, 4, 5][index],
        })),
      },
    },
  };
}

export function pocketReport(): PlusPocketReport {
  const saves = {
    ...eventMetric(),
    value: 5,
    series: [2, 0, 3].map((value, index) => ({
      ...bucket(["2026-09-21", "2026-09-28", "2026-10-12"][index], 7),
      value,
    })),
  };
  return {
    business: standardAnalyticsReport().business,
    interval: "weekly",
    meta: plusMeta(),
    measurement_note:
      "Recorded saves are independent of current Pocket holders.",
    metrics: { saves, distinct_savers: { ...saves, value: 3 } },
  };
}

export function specialtyReport(): PlusSpecialtyReport {
  return {
    business: standardAnalyticsReport().business,
    interval: "weekly",
    label: "Added and still valid",
    snapshot_as_of: plusMeta().generated_at,
    meta: {
      ...plusMeta(),
      coverage_verified: true,
      partial_reasons: [
        "current_state_reporting",
        "retained_valid_vouches_only",
        "vouch_removal_history_unavailable",
      ],
    },
    specialties: [
      {
        specialty_id: 1,
        specialty_name: "Coffee",
        added_and_still_valid: 2,
        distinct_supporters: 2,
        series: [0, 2].map((value, index) => ({
          ...bucket(index ? "2026-10-05" : "2026-09-28", 7),
          added_and_still_valid: value,
          distinct_supporters: value,
        })),
      },
      {
        specialty_id: 2,
        specialty_name: "Friendly service",
        added_and_still_valid: 1,
        distinct_supporters: 1,
        series: [
          {
            ...bucket("2026-10-05", 7),
            added_and_still_valid: 1,
            distinct_supporters: 1,
          },
        ],
      },
    ],
  };
}

export function reviewReport(): PlusReviewPerformanceReport {
  const measures: ReviewMeasures = {
    published_review_count: 4,
    replied_review_count: 1,
    unanswered_cohort_count: 3,
    reply_rate: 25,
    classified_review_count: 3,
    unclassified_review_count: 1,
    has_sufficient_sentiment_data: true,
    sentiment: {
      positive: { count: 2, percentage: 66.67 },
      neutral: { count: 1, percentage: 33.33 },
      negative: { count: 0, percentage: 0 },
    },
  };
  return {
    business: standardAnalyticsReport().business,
    interval: "weekly",
    policy_version: 1,
    meta: {
      ...plusMeta(),
      coverage_verified: true,
      partial_reasons: [
        "current_state_reporting",
        "review_status_history_unavailable",
      ],
    },
    current: {
      ...measures,
      median_first_reply_seconds: 3600,
      median_replied_sample_size: 1,
    },
    previous: {
      ...measures,
      replied_review_count: 0,
      reply_rate: 0,
      unanswered_cohort_count: 4,
      median_first_reply_seconds: null,
      median_replied_sample_size: 0,
    },
    reply_rate_change: {
      value: 25,
      direction: "up",
      unit: "percentage_points",
      reason: null,
    },
    series: [{ ...bucket("2026-10-05", 7), ...measures }],
    current_unanswered_published: 3,
    reply_cutoff: plusMeta().generated_at,
    excluded_reply_timestamp_count: 0,
    measurement_note:
      "Recent cohorts have less time to receive replies. Retained reply creation timestamps are not a full first-reply history.",
  };
}

export const plusSuccess = <T>(data: T) => ({
  success: true as const,
  message: "Analytics retrieved.",
  data,
});
