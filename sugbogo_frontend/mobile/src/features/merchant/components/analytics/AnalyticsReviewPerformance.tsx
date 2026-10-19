import { MaterialCommunityIcons } from "@expo/vector-icons";
import type { BottomSheetModal } from "@gorhom/bottom-sheet";
import { useRef } from "react";
import { ActivityIndicator, View } from "react-native";
import { theme } from "@/constants/theme";
import AppText from "@/shared/components/AppText";
import ErrorState from "@/shared/components/ErrorState";
import Skeleton from "@/shared/components/Skeleton";
import SelectionBottomSheet from "@/shared/components/bottom-sheets/SelectionBottomSheet";
import ReviewFeedbackDistribution from "@/shared/components/reviews/ReviewFeedbackDistribution";
import ReviewVibeBadge from "@/shared/components/reviews/ReviewVibeBadge";
import { shadows } from "@/shared/styles/shadows";
import type { MerchantAnalyticsPeriod } from "../../types/merchantAnalytics.types";
import type { PlusReviewPerformanceReport } from "../../types/merchantPlusAnalytics.types";
import { formatAnalyticsCount } from "../../utils/merchantAnalytics.utils";
import { formatReplyDuration } from "../../utils/merchantPlusAnalytics.utils";
import { reviewPerformanceReplyTrend } from "../../utils/merchantKpiComparisons.utils";
import AnalyticsChartEmptyState from "./AnalyticsChartEmptyState";
import AnalyticsHeaderControls from "./AnalyticsHeaderControls";
import AnalyticsReviewMeasurementSheet from "./AnalyticsReviewMeasurementSheet";
import AnalyticsSeriesChart from "./AnalyticsSeriesChart";
import TrendComparison from "./TrendComparison";

const PERIOD_OPTIONS = [
  { label: "Last 7 days", value: "7" },
  { label: "Last 30 days", value: "30" },
  { label: "Last 90 days", value: "90" },
];

/** Presents selected-period feedback and responses with persistent controls and localized recovery. */
export default function AnalyticsReviewPerformance({
  report,
  period,
  onPeriodChange,
  loading = false,
  error,
  retry,
}: {
  report?: PlusReviewPerformanceReport;
  period: MerchantAnalyticsPeriod;
  onPeriodChange: (period: MerchantAnalyticsPeriod) => void;
  loading?: boolean;
  error?: unknown;
  retry: () => void;
}) {
  const periodSheetRef = useRef<BottomSheetModal>(null);
  const measurementSheetRef = useRef<BottomSheetModal>(null);
  const pending = loading && !report;
  const unavailable = report?.meta.availability === "unavailable";
  const cohort = unavailable ? undefined : report?.current;
  const showShares =
    !!cohort &&
    cohort.has_sufficient_sentiment_data &&
    cohort.classified_review_count > 0;
  const replyRate = cohort?.reply_rate;
  const validRate =
    replyRate != null &&
    Number.isFinite(replyRate) &&
    replyRate >= 0 &&
    replyRate <= 100
      ? replyRate
      : null;
  const replySeconds =
    cohort &&
    cohort.median_replied_sample_size > 0 &&
    cohort.median_first_reply_seconds != null &&
    Number.isFinite(cohort.median_first_reply_seconds) &&
    cohort.median_first_reply_seconds >= 0
      ? cohort.median_first_reply_seconds
      : null;

  return (
    <>
      <View className="gap-5">
        {/* Compact period and measurement controls stay available through every request state. */}
        <View className="gap-1">
          <View className="flex-row items-center justify-between gap-3">
            <AppText
              weight="bold"
              accessibilityRole="header"
              className="min-w-0 flex-1 text-base text-text-primary"
            >
              Review activity
            </AppText>
            <AnalyticsHeaderControls
              period={period}
              onOpenPeriod={() => periodSheetRef.current?.present()}
              onOpenInformation={() => measurementSheetRef.current?.present()}
              informationLabel="About review activity"
              informationHint="Opens information about reviews, feedback, and replies"
            />
          </View>
          <AppText className="text-sm leading-5 text-text-secondary">
            New reviews and your responses
          </AppText>
        </View>
        <View
          className="min-w-0 rounded-card border border-border-primary/60 bg-surface p-4"
          style={shadows.subtle}
        >
          <View className="flex-row items-start justify-between gap-2">
            <AppText
              weight="medium"
              className="min-w-0 flex-1 text-sm text-text-secondary"
            >
              New reviews
            </AppText>
            <MaterialCommunityIcons
              name="comment-text-outline"
              size={18}
              color={theme.extends.colors.text.secondary}
              accessible={false}
            />
          </View>
          <View className="mt-3 gap-1">
            {pending ? (
              <Skeleton className="h-9 w-24 rounded" />
            ) : (
              <AppText
                weight="semibold"
                accessibilityLabel={`New reviews: ${cohort?.published_review_count ?? "Unavailable"}`}
                className={`text-3xl tabular-nums ${cohort ? "text-text-primary" : "text-text-secondary"}`}
              >
                {formatAnalyticsCount(cohort?.published_review_count ?? null)}
              </AppText>
            )}
            <AppText className="text-xs leading-5 text-text-secondary">
              During selected dates
            </AppText>
          </View>
        </View>
        {Boolean(error) && (
          <ErrorState
            size="section"
            title={
              report
                ? "Unable to refresh review activity"
                : "Unable to load review activity"
            }
            description={
              report
                ? "Previously loaded values are still shown."
                : "Please try this report again."
            }
            primaryActionTitle="Retry"
            onPrimaryAction={retry}
          />
        )}
        {unavailable && !error && (
          <ErrorState
            size="section"
            title="Review activity unavailable"
            description="Review data could not be loaded."
            primaryActionTitle="Retry"
            onPrimaryAction={retry}
          />
        )}

        {/* Familiar faces and category counts preserve the backend's sample eligibility. */}
        <View className="gap-3">
          <View className="flex-row flex-wrap items-center justify-between gap-3">
            <AppText weight="bold" className="text-base text-text-primary">
              Customer feedback
            </AppText>
            {showShares && (
              <ReviewVibeBadge
                vibe={cohort?.overall_vibe}
                testID="analytics-review-vibe"
              />
            )}
          </View>
          {pending ? (
            <Skeleton className="h-36 w-full rounded-lg" />
          ) : (
            cohort &&
            (cohort.published_review_count === 0 ? (
              <AnalyticsChartEmptyState
                compact
                title="No reviews in this period"
                description="Customer feedback will appear here when reviews are available."
                icon="comment-text-outline"
              />
            ) : (
              <>
                {!showShares && (
                  <AppText className="text-sm text-text-secondary">
                    More reviews are needed to show percentages.
                  </AppText>
                )}
                <ReviewFeedbackDistribution
                  sentiment={cohort.sentiment}
                  showPercentages={showShares}
                />
                <View className="gap-1">
                  <AppText className="text-xs leading-5 text-text-secondary">
                    Based on {cohort.classified_review_count} of{" "}
                    {cohort.published_review_count} reviews
                  </AppText>
                  {cohort.unclassified_review_count > 0 && (
                    <AppText className="text-xs leading-5 text-text-secondary">
                      {cohort.unclassified_review_count} not categorized
                    </AppText>
                  )}
                </View>
              </>
            ))
          )}
        </View>

        {/* Reply-rate progress uses the supplied percentage, never an inferred score. */}
        <View className="gap-3 border-t border-border-primary/60 pt-5">
          <AppText weight="bold" className="text-base text-text-primary">
            Your replies
          </AppText>
          <View
            className="gap-2 rounded-card border border-border-primary/60 bg-surface p-4"
            style={shadows.subtle}
          >
            <AppText weight="medium" className="text-sm text-text-secondary">
              Reviews replied to
            </AppText>
            {pending ? (
              <Skeleton className="h-9 w-24 rounded" />
            ) : (
              <View className="flex-row flex-wrap items-center justify-between gap-2">
                <AppText
                  weight="semibold"
                  className="text-3xl tabular-nums text-text-primary"
                  accessibilityLabel={`Reviews replied to: ${validRate === null ? "Unavailable" : `${validRate}%`}`}
                >
                  {validRate === null ? "—" : `${validRate}%`}
                </AppText>
                {report && (
                  <TrendComparison
                    trend={reviewPerformanceReplyTrend(report)}
                  />
                )}
              </View>
            )}
            {validRate !== null && (
              <View
                accessible
                accessibilityRole="progressbar"
                accessibilityLabel="Review reply rate"
                accessibilityValue={{ min: 0, max: 100, now: validRate }}
                className="h-2 overflow-hidden rounded-full bg-surface-muted"
              >
                <View
                  testID="review-reply-progress"
                  className="h-full rounded-full bg-brand"
                  style={{ width: `${validRate}%` }}
                />
              </View>
            )}
            {cohort && (
              <AppText className="text-xs leading-5 text-text-secondary">
                {cohort.replied_review_count} of {cohort.published_review_count}{" "}
                reviews
                {cohort.published_review_count === 1
                  ? " · Based on 1 review"
                  : ""}
              </AppText>
            )}
          </View>
          <View className="flex-row flex-wrap items-start justify-between gap-x-4 gap-y-1 py-2">
            <AppText className="text-sm text-text-primary">
              {cohort?.median_replied_sample_size === 1
                ? "Reply time"
                : "Typical reply time"}
            </AppText>
            <View className="min-w-0 gap-1">
              {pending ? (
                <Skeleton className="h-6 w-24 rounded" />
              ) : (
                <AppText
                  weight="semibold"
                  className="text-base tabular-nums text-text-primary"
                >
                  {replySeconds === null
                    ? "—"
                    : formatReplyDuration(replySeconds)}
                </AppText>
              )}
              {cohort && (
                <AppText className="text-xs text-text-secondary">
                  {replySeconds === null
                    ? "No usable reply times"
                    : `Based on ${cohort.median_replied_sample_size} ${cohort.median_replied_sample_size === 1 ? "reply" : "replies"}`}
                </AppText>
              )}
            </View>
          </View>
        </View>

        {/* Existing weekly calendar bars retain their exact counts and zero/missing semantics. */}
        <View className="gap-3 border-t border-border-primary/60 pt-5">
          <View className="gap-1">
            <AppText weight="bold" className="text-base text-text-primary">
              Reviews over time
            </AppText>
            <AppText className="text-sm text-text-secondary">
              New reviews by week
            </AppText>
          </View>
          {pending && (
            <View
              accessibilityRole="progressbar"
              accessibilityLabel="Loading review activity"
              className="min-h-44 items-center justify-center gap-3"
            >
              <ActivityIndicator color={theme.extends.colors.brand} />
              <AppText className="text-sm text-text-secondary">
                Loading review activity…
              </AppText>
            </View>
          )}
          {cohort && report && (
            <AnalyticsSeriesChart
              label="New reviews"
              interval={report.interval}
              range={report.meta.period}
              total={cohort.published_review_count}
              minimalFooter
              emptyTitle="No new reviews in this period"
              emptyDescription="No currently published reviews were created during these dates."
              points={report.series.map((bucket) => ({
                ...bucket,
                value: bucket.published_review_count,
              }))}
            />
          )}
        </View>
      </View>
      {/* Static explanations remain usable while the report loads. */}
      <SelectionBottomSheet
        sheetRef={periodSheetRef}
        title="Reporting period"
        description="Choose a time range for this section."
        options={PERIOD_OPTIONS}
        selectedValue={period}
        onSelect={(value) => {
          if (value === "7" || value === "30" || value === "90")
            onPeriodChange(value);
        }}
        snapPoints={["50%"]}
      />
      <AnalyticsReviewMeasurementSheet
        sheetRef={measurementSheetRef}
        report={report}
      />
    </>
  );
}
