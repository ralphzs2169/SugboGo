import { MaterialCommunityIcons } from "@expo/vector-icons";
import { View, useWindowDimensions } from "react-native";

import { theme } from "@/constants/theme";
import AppText from "@/shared/components/AppText";
import { shadows } from "@/shared/styles/shadows";

import type { MerchantStandardAnalytics } from "../../types/merchantAnalytics.types";
import type {
  PlusPocketReport,
  PlusReviewPerformanceReport,
  PlusVisibilityReport,
} from "../../types/merchantPlusAnalytics.types";

import { formatAnalyticsCount } from "../../utils/merchantAnalytics.utils";
import {
  formatKpiTrend,
  replyRateTrend,
  reviewCountTrend,
  visibilityKpiTrend,
  type KpiTrend,
} from "../../utils/merchantKpiComparisons.utils";

export type AnalyticsActivityOverviewProps = {
  report: MerchantStandardAnalytics;
  plusReviews?: PlusReviewPerformanceReport | null;
  plusVisibility?: PlusVisibilityReport | null;
  plusPocket?: PlusPocketReport | null;
};

type MetricCardProps = {
  label: string;
  value: string;
  detail?: string;
  unavailable?: boolean;
  stacked: boolean;
  trend?: KpiTrend;
  progress?: number | null;
  fullWidth?: boolean;
};

type TrendTone = "increase" | "decrease" | "stable";

/** Identifies a comparison direction without assuming unknown formats. */
function getTrendTone(text: string): TrendTone {
  const normalized = text.trim();

  if (/^\+(?!0(?:\.0+)?(?:\s|$))/.test(normalized)) {
    return "increase";
  }

  if (/^[-−](?!0(?:\.0+)?(?:\s|$))/.test(normalized)) {
    return "decrease";
  }

  return "stable";
}

/** Shows approved previous-period comparisons as understated text. */
function TrendComparison({
  trend,
  compact = false,
}: {
  trend: KpiTrend;
  compact?: boolean;
}) {
  const text = formatKpiTrend(trend);
  const tone = getTrendTone(text);

  const toneClass =
    tone === "increase"
      ? "text-emerald-700"
      : tone === "decrease"
        ? "text-red-500"
        : "text-text-secondary";

  return (
    <View className="mt-2">
      <AppText className="text-xs leading-5 text-text-secondary">
        <AppText weight="semibold" className={`text-xs ${toneClass}`}>
          {text}
        </AppText>
        {compact ? " vs previous" : " vs previous period"}
      </AppText>
    </View>
  );
}

/**
 * Displays a business metric with supporting context,
 * optional progress, and previous-period comparison.
 */
function MetricCard({
  label,
  value,
  detail,
  unavailable,
  stacked,
  trend,
  progress,
  fullWidth = false,
}: MetricCardProps) {
  const trendText = trend ? formatKpiTrend(trend) : null;

  const showProgress =
    typeof progress === "number" &&
    Number.isFinite(progress) &&
    progress >= 0 &&
    progress <= 100;

  const accessibilityDescription = [
    `${label}: ${unavailable ? "Unavailable" : value}`,
    detail,
    trendText ? `${trendText} compared with the previous period` : null,
  ]
    .filter(Boolean)
    .join(". ");

  return (
    <View
      accessible
      testID={fullWidth ? "analytics-reply-card" : undefined}
      accessibilityLabel={accessibilityDescription}
      className={`min-w-0 rounded-card border border-border-primary/60 bg-surface p-4 ${
        stacked ? "w-full" : "flex-1"
      }`}
      style={shadows.subtle}
    >
      {/* Metric heading */}
      <AppText
        weight="medium"
        className="text-sm leading-5 text-text-secondary"
      >
        {label}
      </AppText>

      {/* Primary value and supporting count */}
      <View className="mt-2 gap-1">
        <AppText
          weight="semibold"
          className={`${
            value.length > 7 && !stacked ? "text-2xl" : "text-3xl"
          } ${unavailable ? "text-text-secondary" : "text-text-primary"}`}
        >
          {value}
        </AppText>

        {detail && (
          <AppText className="text-sm leading-5 text-text-secondary">
            {detail}
          </AppText>
        )}
      </View>

      {/* Reply-rate progress */}
      {showProgress && (
        <View
          testID="analytics-reply-progress"
          accessible={false}
          className="mt-3 h-1.5 overflow-hidden rounded-full bg-surface-muted"
        >
          <View
            testID="analytics-reply-progress-fill"
            className="h-full rounded-full bg-brand"
            style={{ width: `${progress}%` }}
          />
        </View>
      )}

      {/* Previous-period comparison */}
      {trend && <TrendComparison trend={trend} compact={!fullWidth} />}
    </View>
  );
}

/**
 * Presents selected-period business metrics alongside current
 * vouch support and review-reply performance.
 *
 * Includes a non-interactive period-selector preview above
 * the existing KPI layout.
 */
export default function AnalyticsActivityOverview({
  report,
  plusReviews,
  plusVisibility,
  plusPocket,
}: AnalyticsActivityOverviewProps) {
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

  const vouches = domainAvailable
    ? (report.current_valid_vouches ?? null)
    : null;

  let replyDetail: string;

  if (!domainAvailable) {
    replyDetail = "Reply information unavailable";
  } else if (reviews.period_eligible_published === 0) {
    replyDetail = "No published reviews from these dates";
  } else {
    replyDetail = `${formatAnalyticsCount(
      reviews.period_replied_published,
    )} of ${formatAnalyticsCount(reviews.period_eligible_published)} reviews`;
  }

  const rowClassName = useSingleColumn ? "gap-3" : "flex-row gap-3";

  return (
    <View className="gap-4">
      {/* Four compact business overview metrics */}
      <View testID="business-overview-grid" className="gap-3">
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
            trend={visibilityKpiTrend(report, plusVisibility, "profile_visits")}
          />

          <MetricCard
            stacked={useSingleColumn}
            label="Recorded saves"
            value={formatAnalyticsCount(saves)}
            unavailable={saves === null}
            trend={visibilityKpiTrend(report, plusPocket, "saves")}
          />
        </View>

        <View className={rowClassName}>
          <MetricCard
            stacked={useSingleColumn}
            label="New reviews"
            value={formatAnalyticsCount(
              domainAvailable ? reviews.new_published_in_period : null,
            )}
            unavailable={!domainAvailable}
            trend={reviewCountTrend(report, plusReviews)}
          />

          <MetricCard
            stacked={useSingleColumn}
            label="Total vouches"
            value={formatAnalyticsCount(vouches)}
            unavailable={vouches === null}
            detail="Current"
          />
        </View>
      </View>

      {/* Full-width review response performance */}
      <MetricCard
        stacked
        fullWidth
        label="Reviews replied to"
        value={replyRate === null ? "—" : `${replyRate}%`}
        unavailable={replyRate === null}
        detail={replyDetail}
        trend={replyRateTrend(report, plusReviews)}
        progress={replyRate}
      />
    </View>
  );
}
