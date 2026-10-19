import {
  standardAnalyticsReport,
  unansweredReviewsSummary,
} from "./merchantAnalytics.fixtures";
import {
  visibilityReport,
  pocketReport,
  reviewReport,
} from "./merchantPlusAnalytics.fixtures";
import {
  timingReport,
  storedInsightsReport,
} from "./merchantAdvancedAnalytics.fixtures";
import { routePlanningReport } from "./routePlanningAnalytics.fixtures";
import { discoverySourcesReport } from "./discoverySources.fixtures";
import type {
  MerchantAnalyticsPeriod,
  StandardAnalyticsMeta,
} from "../types/merchantAnalytics.types";
import { buildAnalyticsCalendar } from "../utils/merchantPlusAnalytics.utils";

export type PreviewState =
  | "populated"
  | "zero"
  | "sparse"
  | "partial"
  | "unavailable"
  | "error"
  | "loading"
  | "uninitialized"
  | "outdated"
  | "insufficient";
export function previewReports(
  period: MerchantAnalyticsPeriod,
  state: PreviewState,
  interval: "daily" | "weekly",
) {
  const standard = standardAnalyticsReport();
  const visibility = visibilityReport(interval);
  const pocket = pocketReport();
  const reviews = reviewReport();
  const timing = timingReport();
  const insights = storedInsightsReport();
  const routes = routePlanningReport();
  const discovery = discoverySourcesReport();
  const unanswered = unansweredReviewsSummary();
  const end = new Date("2026-10-20T04:00:00Z");
  const start = new Date("2026-10-19T16:00:00Z");
  start.setUTCDate(start.getUTCDate() - Number(period) + 1);
  const range = {
    start: start.toISOString(),
    end_exclusive: end.toISOString(),
  };
  const meta: StandardAnalyticsMeta = {
    period: {
      ...range,
      timezone: "Asia/Manila",
      start_date: new Date(start.getTime() + 8 * 3600000)
        .toISOString()
        .slice(0, 10),
      end_date: "2026-10-20",
    },
    generated_at: end.toISOString(),
    data_through: end.toISOString(),
    availability:
      state === "unavailable" || state === "uninitialized"
        ? "unavailable"
        : "partial",
    is_partial: true,
    partial_reason: "coverage_unverified",
    partial_reasons: ["coverage_unverified"],
    coverage_verified: false,
  };
  const plusMeta = {
    ...meta,
    period: {
      ...meta.period,
      previous_start: new Date(
        start.getTime() - (end.getTime() - start.getTime()),
      ).toISOString(),
      previous_end_exclusive: start.toISOString(),
    },
  };
  const points = (grouping: "daily" | "weekly") =>
    buildAnalyticsCalendar([], grouping, range)
      .filter((_, index) => state !== "sparse" || index === 0)
      .map((slot, index) => ({
        date: slot.date,
        start: slot.start,
        end_exclusive: slot.end_exclusive,
        value: state === "zero" ? 0 : [2, 6, 3, 5, 1][index % 5],
      }));
  for (const metric of Object.values(visibility.metrics)) {
    metric.series = points(interval);
    metric.value = metric.series.reduce((sum, point) => sum + point.value, 0);
    metric.sources.current = plusMeta;
    if (state === "unavailable") {
      metric.value = null;
      metric.series = null;
    }
  }
  visibility.metrics.distinct_profile_visitors.value =
    state === "unavailable"
      ? null
      : Math.min(12, visibility.metrics.profile_visits.value ?? 0);
  visibility.meta = plusMeta;
  for (const metric of Object.values(pocket.metrics)) {
    metric.series = points("weekly");
    metric.value = metric.series.reduce((sum, point) => sum + point.value, 0);
    metric.sources.current = plusMeta;
    if (state === "unavailable") {
      metric.value = null;
      metric.series = null;
    }
  }
  pocket.metrics.distinct_savers.value =
    state === "unavailable"
      ? null
      : Math.min(8, pocket.metrics.saves.value ?? 0);
  pocket.meta = plusMeta;
  standard.profile_visits = visibility.metrics.profile_visits.value;
  standard.distinct_profile_visitors =
    visibility.metrics.distinct_profile_visitors.value;
  standard.saves_in_period = pocket.metrics.saves.value;
  standard.meta = meta;
  standard.sources = { domain: meta, visibility: meta };
  if (state === "zero") {
    standard.current_pocket_holders = 0;
    standard.current_valid_vouches = 0;
    standard.specialty_support = [];
    standard.reviews = {
      ...standard.reviews,
      new_published_in_period: 0,
      current_published_total: 0,
      current_unanswered_published: 0,
      period_eligible_published: 0,
      period_replied_published: 0,
      reply_rate: null,
    };
    Object.assign(unanswered, {
      total_unanswered: 0,
      under_3_days: 0,
      days_3_to_6: 0,
      days_7_plus: 0,
    });
    Object.assign(routes, {
      total_requests: 0,
      distinct_explorer_accounts: 0,
      road_route_requests: 0,
      jeepney_requests: 0,
    });
    discovery.profile_visits = 0;
    discovery.sources = discovery.sources!.map((row) => ({ ...row, count: 0 }));
    discovery.attribution_complete = true;
  }
  routes.meta = meta;
  if (state === "partial") {
    routes.tracking_started_at = "2026-10-18T00:00:00Z";
    routes.meta = {
      ...meta,
      partial_reason: "tracking_started_during_period",
      partial_reasons: ["tracking_started_during_period"],
    };
  }
  if (state === "unavailable" || state === "uninitialized") {
    Object.assign(routes, {
      total_requests: null,
      distinct_explorer_accounts: null,
      road_route_requests: null,
      jeepney_requests: null,
    });
    routes.meta = {
      ...meta,
      partial_reason:
        state === "uninitialized"
          ? "route_intent_collection_missing"
          : "route_intent_source_unavailable",
      partial_reasons: [
        state === "uninitialized"
          ? "route_intent_collection_missing"
          : "route_intent_source_unavailable",
      ],
    };
    if (state === "uninitialized") routes.tracking_started_at = null;
    discovery.profile_visits = null;
    discovery.sources = null;
  }
  discovery.meta = meta;
  reviews.meta = plusMeta;
  if (state === "zero") {
    reviews.current = {
      ...reviews.current,
      published_review_count: 0,
      replied_review_count: 0,
      unanswered_cohort_count: 0,
      reply_rate: null,
      classified_review_count: 0,
      unclassified_review_count: 0,
      has_sufficient_sentiment_data: false,
      overall_vibe: undefined,
      median_first_reply_seconds: null,
      median_replied_sample_size: 0,
      sentiment: {
        positive: { count: 0, percentage: null },
        neutral: { count: 0, percentage: null },
        negative: { count: 0, percentage: null },
      },
    };
  }
  reviews.series = points("weekly").map((point) => ({
    date: point.date,
    start: point.start,
    end_exclusive: point.end_exclusive,
    ...reviews.current,
  }));
  const weeks = reviews.series.length;
  if (state !== "zero") {
    reviews.current = {
      ...reviews.current,
      published_review_count: 4 * weeks,
      replied_review_count: weeks,
      unanswered_cohort_count: 3 * weeks,
      classified_review_count: 3 * weeks,
      unclassified_review_count: weeks,
      median_replied_sample_size: weeks,
      sentiment: {
        positive: { count: 2 * weeks, percentage: 66.67 },
        neutral: { count: weeks, percentage: 33.33 },
        negative: { count: 0, percentage: 0 },
      },
    };
  }
  if (state === "insufficient") {
    reviews.current.has_sufficient_sentiment_data = false;
    reviews.current.overall_vibe = undefined;
    reviews.current.classified_review_count = 1;
    reviews.current.unclassified_review_count =
      reviews.current.published_review_count - 1;
    reviews.current.sentiment = {
      positive: { count: 1, percentage: null },
      neutral: { count: 0, percentage: null },
      negative: { count: 0, percentage: null },
    };
  }
  reviews.reply_rate_change = {
    value: null,
    direction: null,
    unit: "percentage_points",
    reason: "preview_no_comparison",
  };
  timing.meta = plusMeta;
  timing.sources.visibility = plusMeta;
  const occurrences = new Map<string, number>();
  for (let time = start.getTime(); time < end.getTime(); time += 3600000) {
    const local = new Date(time + 8 * 3600000);
    const weekday = ((local.getUTCDay() + 6) % 7) + 1;
    const key = `${weekday}:${local.getUTCHours()}`;
    occurrences.set(key, (occurrences.get(key) ?? 0) + 1);
  }
  timing.cells = timing.cells.map((cell) => {
    const available = occurrences.get(cell.id) ?? 0;
    const count =
      available === 0
        ? null
        : state === "sparse"
          ? cell.profile_visits
          : cell.hour >= 8 && cell.hour <= 19
            ? (cell.weekday + cell.hour) % 6
            : 0;
    return {
      ...cell,
      period_occurrences: available,
      profile_visits: count,
      state:
        available === 0
          ? "outside_period"
          : (count ?? 0) > 0
            ? "recorded_visits"
            : "zero_recorded_visits",
    };
  });
  timing.total_profile_visits = timing.cells.reduce(
    (sum, cell) => sum + (cell.profile_visits ?? 0),
    0,
  );
  timing.sample.in_period_cells = timing.cells.filter(
    (cell) => cell.period_occurrences > 0,
  ).length;
  timing.sample.outside_period_cells =
    timing.cells.length - timing.sample.in_period_cells;

  if (state === "zero" || state === "unavailable") {
    timing.total_profile_visits = state === "zero" ? 0 : null;
    timing.cells = timing.cells.map((cell) => ({
      ...cell,
      profile_visits: state === "zero" ? 0 : null,
      state:
        state === "zero" ? "zero_recorded_visits" : "visibility_unavailable",
    }));
    timing.display_state =
      state === "zero" ? "zero_recorded_visits" : "visibility_unavailable";
  }
  timing.sample.nonzero_cells = timing.cells.filter(
    (cell) => (cell.profile_visits ?? 0) > 0,
  ).length;
  timing.legend.maximum = Math.max(
    0,
    ...timing.cells.map((cell) => cell.profile_visits ?? 0),
  );
  timing.legend.zero_range = timing.legend.maximum === 0;
  insights.meta = plusMeta;
  if (insights.stored_summary) {
    insights.stored_summary.state = state === "outdated" ? "outdated" : "ready";
    insights.stored_summary.state_message =
      state === "outdated"
        ? "Review insights need updating."
        : "Review insights are ready.";
    insights.stored_summary.policy.generation_rules_match =
      state !== "outdated";
    insights.stored_summary.policy.generated_version =
      state === "outdated" ? 1 : insights.stored_summary.policy.current_version;
    if (state === "insufficient") {
      insights.stored_summary.state = "insufficient_reviews";
      insights.stored_summary.content_available = false;
      insights.stored_summary.narrative = null;
      insights.stored_summary.frequent_mentions = [];
    }
    if (state === "zero" || state === "unavailable")
      insights.stored_summary = null;
  }
  return {
    standard,
    visibility,
    pocket,
    reviews,
    timing,
    insights,
    routes,
    discovery,
    unanswered,
  };
}
