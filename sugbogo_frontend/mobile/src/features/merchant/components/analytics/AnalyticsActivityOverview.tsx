import MetricCard from "../MerchantMetricCard";
import { View, useWindowDimensions } from "react-native";

import type { MerchantStandardAnalytics } from "../../types/merchantAnalytics.types";
import type {
  PlusPocketReport,
  PlusReviewPerformanceReport,
  PlusSpecialtyReport,
  PlusVisibilityReport,
} from "../../types/merchantPlusAnalytics.types";

import { formatAnalyticsCount } from "../../utils/merchantAnalytics.utils";
import {
  replyRateTrend,
  reviewCountTrend,
  visibilityKpiTrend,
  vouchCountTrend,
} from "../../utils/merchantKpiComparisons.utils";

export type AnalyticsActivityOverviewProps = {
  report: MerchantStandardAnalytics;
  plusReviews?: PlusReviewPerformanceReport | null;
  plusVisibility?: PlusVisibilityReport | null;
  plusPocket?: PlusPocketReport | null;
  plusSpecialties?: PlusSpecialtyReport | null;
};

/**
 * Presents selected-period business metrics, retained vouch
 * additions, and review-reply performance.
 *
 * Keeps unavailable values distinct from zero and adapts
 * the KPI grid for narrow screens and larger font scales.
 */
export default function AnalyticsActivityOverview({
  report,
  plusReviews,
  plusVisibility,
  plusPocket,
  plusSpecialties,
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
    ? (report.vouches_added_and_still_valid ?? null)
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
            icon="eye-outline"
            stacked={useSingleColumn}
            label="Profile visits"
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
            icon="bookmark-outline"
            stacked={useSingleColumn}
            label="Saves"
            value={formatAnalyticsCount(saves)}
            unavailable={saves === null}
            trend={visibilityKpiTrend(report, plusPocket, "saves")}
          />
        </View>

        <View className={rowClassName}>
          <MetricCard
            icon="message-text-outline"
            stacked={useSingleColumn}
            label="New reviews"
            value={formatAnalyticsCount(
              domainAvailable ? reviews.new_published_in_period : null,
            )}
            unavailable={!domainAvailable}
            trend={reviewCountTrend(report, plusReviews)}
          />

          <MetricCard
            icon="thumb-up-outline"
            stacked={useSingleColumn}
            label="Vouches added"
            value={formatAnalyticsCount(vouches)}
            unavailable={vouches === null}
            accessibilityDetail="Still valid today"
            trend={vouchCountTrend(report, plusSpecialties)}
          />
        </View>
      </View>

      {/* Full-width review response performance */}
      <MetricCard
        icon="reply"
        stacked
        fullWidth
        label="Review reply rate"
        value={replyRate === null ? "—" : `${replyRate}%`}
        unavailable={replyRate === null}
        detail={replyDetail}
        trend={replyRateTrend(report, plusReviews)}
        progress={replyRate}
      />
    </View>
  );
}

/** Uses the real KPI card shell so fixed labels, icons, and row sizing stay identical. */
export function AnalyticsActivitySkeleton() {
  const { width, fontScale } = useWindowDimensions();
  const stacked = width < 340 || fontScale >= 1.5;
  const rowClassName = stacked ? "gap-3" : "flex-row gap-3";
  return (
    <View
      accessibilityLabel="Loading business overview"
      accessibilityState={{ busy: true }}
      className="gap-4"
    >
      <View className="gap-3">
        <View className={rowClassName}>
          <MetricCard
            icon="eye-outline"
            label="Profile visits"
            value=""
            stacked={stacked}
            loading
            loadingDetail
          />
          <MetricCard
            icon="bookmark-outline"
            label="Saves"
            value=""
            stacked={stacked}
            loading
          />
        </View>
        <View className={rowClassName}>
          <MetricCard
            icon="message-text-outline"
            label="New reviews"
            value=""
            stacked={stacked}
            loading
          />
          <MetricCard
            icon="thumb-up-outline"
            label="Vouches added"
            value=""
            accessibilityDetail="Still valid today"
            stacked={stacked}
            loading
          />
        </View>
      </View>
      <MetricCard
        icon="reply"
        label="Review reply rate"
        value=""
        stacked
        fullWidth
        loading
        loadingDetail
      />
    </View>
  );
}
