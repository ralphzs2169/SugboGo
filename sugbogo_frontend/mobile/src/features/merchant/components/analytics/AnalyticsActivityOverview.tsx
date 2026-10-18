import { View, useWindowDimensions } from "react-native";

import AppText from "@/shared/components/AppText";
import { shadows } from "@/shared/styles/shadows";

import type { MerchantStandardAnalytics } from "../../types/merchantAnalytics.types";
import type { PlusReviewPerformanceReport } from "../../types/merchantPlusAnalytics.types";
import { formatAnalyticsCount } from "../../utils/merchantAnalytics.utils";

type MetricCardProps = {
  label: string;
  value: string;
  detail: string;
  unavailable?: boolean;
  stacked: boolean;
  trend?: { value: number; direction: "up" | "down" | "unchanged" };
  progress?: number | null;
};

/** Accept only a server-approved comparison for the exact Standard review cohort. */
function supportedReplyTrend(
  standard: MerchantStandardAnalytics,
  plus: PlusReviewPerformanceReport | null | undefined,
): MetricCardProps["trend"] {
  if (!plus || standard.reviews.reply_rate === null) return undefined;

  const change = plus.reply_rate_change;
  const sameCohort =
    plus.business.id === standard.business.id &&
    plus.meta.period.start === standard.meta.period.start &&
    plus.meta.period.end_exclusive === standard.meta.period.end_exclusive &&
    plus.current.published_review_count ===
      standard.reviews.period_eligible_published &&
    plus.current.replied_review_count ===
      standard.reviews.period_replied_published;
  const comparisonAvailable =
    plus.meta.availability !== "unavailable" &&
    plus.meta.coverage_verified &&
    plus.previous.published_review_count > 0 &&
    plus.current.reply_rate !== null &&
    plus.previous.reply_rate !== null &&
    // Standard rounds to one decimal; Plus retains two for the same cohort.
    Math.abs(plus.current.reply_rate - standard.reviews.reply_rate) <= 0.051 &&
    change.reason === null &&
    change.unit === "percentage_points" &&
    change.value !== null &&
    Number.isFinite(change.value);

  if (!sameCohort || !comparisonAvailable || change.value === null) {
    return undefined;
  }

  const direction =
    change.value > 0 ? "up" : change.value < 0 ? "down" : "unchanged";
  if (change.direction !== direction) return undefined;

  return { value: change.value, direction };
}

/** Presents one metric and its denominator or measurement context as a readable unit. */
function MetricCard({
  label,
  value,
  detail,
  unavailable,
  stacked,
  trend,
  progress,
}: MetricCardProps) {
  const trendText = trend
    ? `${trend.direction === "up" ? "+" : trend.direction === "down" ? "−" : ""}${Math.abs(trend.value).toLocaleString("en-PH", { maximumFractionDigits: 2 })} pp`
    : null;

  return (
    <View
      accessible
      accessibilityLabel={`${label}: ${unavailable ? "Unavailable" : value}. ${detail}${trendText ? `. ${trendText} versus the previous period` : ""}`}
      className={`min-w-0 rounded-2xl border border-border-primary bg-surface p-4 ${
        stacked ? "w-full" : "flex-1"
      }`}
      style={shadows.subtle}
    >
      {/* Metric identity and the optional server-approved comparison. */}
      <View className="flex-row flex-wrap items-start justify-between gap-2">
        <AppText
          weight="semibold"
          className="min-w-0 flex-1 text-sm leading-5 text-text-secondary"
        >
          {label}
        </AppText>
        {trendText && (
          <View className="rounded-full bg-brand/10 px-2 py-1">
            <AppText weight="bold" className="text-xs text-brand">
              {trendText}
            </AppText>
          </View>
        )}
      </View>

      {/* The reported number remains primary, including at larger font scales. */}
      <AppText
        weight="extrabold"
        className={`mt-1 ${value.length > 7 && !stacked ? "text-2xl" : "text-3xl"} ${
          unavailable ? "text-text-secondary" : "text-text-primary"
        }`}
      >
        {value}
      </AppText>

      {/* Measurement context */}
      <View className="mt-3 flex-1 justify-end">
        <View className="gap-2 border-t border-border-primary/60 pt-3">
          {progress !== undefined &&
            progress !== null &&
            Number.isFinite(progress) &&
            progress >= 0 &&
            progress <= 100 && (
              <View
                testID="analytics-reply-progress"
                accessible={false}
                className="h-1.5 overflow-hidden rounded-full bg-surface-muted"
              >
                <View
                  className="h-full rounded-full bg-brand"
                  style={{ width: `${progress}%` }}
                />
              </View>
            )}
          <AppText className="text-xs leading-5 text-text-secondary">
            {detail}
          </AppText>
          {trendText && (
            <AppText className="text-xs leading-4 text-text-secondary">
              vs previous period
            </AppText>
          )}
        </View>
      </View>
    </View>
  );
}

/** Shows period activity without treating missing tracking or empty cohorts as zero. */
export default function AnalyticsActivityOverview({
  report,
  plusReviews,
}: {
  report: MerchantStandardAnalytics;
  plusReviews?: PlusReviewPerformanceReport | null;
}) {
  const { fontScale, width } = useWindowDimensions();
  const useSingleColumn = fontScale >= 1.5 || width < 340;
  const visibilityAvailable =
    report.sources.visibility.availability !== "unavailable";
  const domainAvailable = report.sources.domain.availability !== "unavailable";
  const visits = visibilityAvailable ? report.profile_visits : null;
  const visitors = visibilityAvailable
    ? report.distinct_profile_visitors
    : null;
  const saves = visibilityAvailable ? report.saves_in_period : null;
  const reviews = report.reviews;
  const replyRate = domainAvailable ? reviews.reply_rate : null;
  const replyTrend = domainAvailable
    ? supportedReplyTrend(report, plusReviews)
    : undefined;
  let replyDetail = "Reply percentage unavailable";

  if (domainAvailable && reviews.period_eligible_published === 0) {
    replyDetail = "No published reviews from these dates";
  } else if (domainAvailable) {
    replyDetail = `${formatAnalyticsCount(reviews.period_replied_published)} of ${formatAnalyticsCount(reviews.period_eligible_published)} published reviews replied to`;
  }

  const rowClassName = useSingleColumn ? "gap-3" : "flex-row gap-3";

  return (
    <View className="gap-3">
      {/* Visibility and expressed interest */}
      <View className={rowClassName}>
        <MetricCard
          stacked={useSingleColumn}
          label="Recorded profile visits"
          value={formatAnalyticsCount(visits)}
          unavailable={visits === null}
          detail={
            visitors === null
              ? "Visitor accounts unavailable"
              : `${formatAnalyticsCount(visitors)} visitor accounts`
          }
        />
        <MetricCard
          stacked={useSingleColumn}
          label="Recorded saves"
          value={formatAnalyticsCount(saves)}
          unavailable={saves === null}
          detail={
            saves === null
              ? "Save activity unavailable"
              : "Recorded in this period"
          }
        />
      </View>

      {/* Published review creation cohort and backend reply rate */}
      <View className={rowClassName}>
        <MetricCard
          stacked={useSingleColumn}
          label="New reviews"
          value={formatAnalyticsCount(
            domainAvailable ? reviews.new_published_in_period : null,
          )}
          unavailable={!domainAvailable}
          detail="Added during these dates and still published"
        />
        <MetricCard
          stacked={useSingleColumn}
          label="Reviews replied to"
          value={replyRate === null ? "—" : `${replyRate}%`}
          unavailable={replyRate === null}
          detail={replyDetail}
          trend={replyTrend}
          progress={replyRate}
        />
      </View>
    </View>
  );
}
