import type {
  MerchantStandardAnalytics,
  StandardAnalyticsMeta,
} from "../types/merchantAnalytics.types";
import type {
  AnalyticsChange,
  PlusPocketReport,
  PlusReviewPerformanceReport,
  PlusVisibilityReport,
} from "../types/merchantPlusAnalytics.types";

export type KpiTrend = {
  value: number;
  direction: "up" | "down" | "unchanged";
  unit: "count" | "percent" | "percentage_points";
};

/** Uses an approved comparison from the same review report without matching a separate Standard response. */
export function reviewPerformanceReplyTrend(
  report: PlusReviewPerformanceReport,
) {
  if (
    report.meta.availability === "unavailable" ||
    report.current.reply_rate === null ||
    report.previous.reply_rate === null ||
    report.current.published_review_count <= 0 ||
    report.previous.published_review_count <= 0
  )
    return undefined;
  return approvedChange(report.reply_rate_change, "percentage_points");
}

/** Accepts only explicit backend comparisons with consistent units and direction. */
function approvedChange(
  change: AnalyticsChange | undefined,
  unit: KpiTrend["unit"],
): KpiTrend | undefined {
  if (
    !change ||
    change.value === null ||
    !Number.isFinite(change.value) ||
    change.reason !== null ||
    change.unit !== unit
  )
    return undefined;
  if (unit === "count" && !Number.isInteger(change.value)) return undefined;
  const direction =
    change.value > 0 ? "up" : change.value < 0 ? "down" : "unchanged";
  if (change.direction !== direction) return undefined;
  return { value: change.value, direction, unit };
}

/** Matches effective cutoffs, including partial days, rather than just preset names. */
function samePeriod(
  standard: MerchantStandardAnalytics,
  meta: StandardAnalyticsMeta,
) {
  return (
    meta.period.start === standard.meta.period.start &&
    meta.period.end_exclusive === standard.meta.period.end_exclusive &&
    meta.period.timezone === standard.meta.period.timezone
  );
}

/** Protects Standard cohort cards against later, older, or differently scoped Plus reads. */
function matchingReviews(
  standard: MerchantStandardAnalytics,
  plus: PlusReviewPerformanceReport | null | undefined,
): plus is PlusReviewPerformanceReport {
  return (
    !!plus &&
    plus.business.id === standard.business.id &&
    samePeriod(standard, plus.meta) &&
    standard.sources.domain.availability !== "unavailable" &&
    plus.meta.availability !== "unavailable" &&
    plus.meta.coverage_verified &&
    plus.current.published_review_count ===
      standard.reviews.new_published_in_period &&
    plus.current.published_review_count ===
      standard.reviews.period_eligible_published
  );
}

/** Displays absolute review differences, including comparisons with an empty prior cohort. */
export function reviewCountTrend(
  standard: MerchantStandardAnalytics,
  plus: PlusReviewPerformanceReport | null | undefined,
) {
  return matchingReviews(standard, plus)
    ? approvedChange(plus.published_review_count_change, "count")
    : undefined;
}

/** Preserves backend percentage points and Standard's original replied/eligible numerator. */
export function replyRateTrend(
  standard: MerchantStandardAnalytics,
  plus: PlusReviewPerformanceReport | null | undefined,
) {
  if (
    !matchingReviews(standard, plus) ||
    plus.reply_cutoff !== standard.reviews.reply_cutoff ||
    standard.reviews.reply_rate === null ||
    plus.current.replied_review_count !==
      standard.reviews.period_replied_published ||
    plus.current.reply_rate === null ||
    plus.previous.reply_rate === null ||
    !Number.isFinite(plus.current.reply_rate) ||
    !Number.isFinite(plus.previous.reply_rate) ||
    plus.previous.published_review_count <= 0 ||
    Math.abs(plus.current.reply_rate - standard.reviews.reply_rate) > 0.051
  )
    return undefined;
  return approvedChange(plus.reply_rate_change, "percentage_points");
}

/** Requires verified source evidence and matching totals before showing event growth. */
export function visibilityKpiTrend(
  standard: MerchantStandardAnalytics,
  plus: PlusVisibilityReport | PlusPocketReport | null | undefined,
  kind: "profile_visits" | "saves",
) {
  if (
    !plus ||
    plus.business.id !== standard.business.id ||
    !samePeriod(standard, plus.meta) ||
    standard.sources.visibility.availability === "unavailable" ||
    plus.meta.availability === "unavailable"
  )
    return undefined;
  const metric =
    kind === "saves"
      ? (plus as PlusPocketReport).metrics.saves
      : (plus as PlusVisibilityReport).metrics.profile_visits;
  const value =
    kind === "saves" ? standard.saves_in_period : standard.profile_visits;
  if (
    !metric ||
    value === null ||
    metric.value !== value ||
    !samePeriod(standard, metric.sources.current) ||
    metric.comparison_eligibility?.eligible !== true ||
    !metric.sources.current.coverage_verified ||
    !metric.sources.previous.coverage_verified ||
    metric.sources.current.availability === "unavailable" ||
    metric.sources.previous.availability === "unavailable" ||
    metric.previous_value === null ||
    metric.previous_value <= 0
  )
    return undefined;
  return approvedChange(metric.change, "percent");
}

/** Formats approved changes without computing any new analytics statistics. */
export function formatKpiTrend(trend: KpiTrend) {
  if (trend.value === 0) return "No change";
  const sign = trend.direction === "up" ? "+" : "−";
  const value = Math.abs(trend.value).toLocaleString("en-PH", {
    maximumFractionDigits: 2,
  });
  const suffix =
    trend.unit === "percentage_points"
      ? " pp"
      : trend.unit === "percent"
        ? "%"
        : "";
  return `${sign}${value}${suffix}`;
}
