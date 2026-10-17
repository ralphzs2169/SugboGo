import { View } from "react-native";
import AppText from "@/shared/components/AppText";
import InfoBanner from "@/shared/components/InfoBanner";
import type {
  PlusReviewPerformanceReport,
  SentimentLabel,
} from "../../types/merchantPlusAnalytics.types";
import {
  formatReplyComparison,
  formatReplyDuration,
} from "../../utils/merchantPlusAnalytics.utils";
import AnalyticsSeriesChart from "./AnalyticsSeriesChart";
import { PlusReportContext } from "./AnalyticsPlusStates";

const SENTIMENTS: { key: SentimentLabel; label: string; color: string }[] = [
  { key: "positive", label: "Positive", color: "bg-success" },
  { key: "neutral", label: "Neutral", color: "bg-text-secondary" },
  { key: "negative", label: "Negative", color: "bg-text-error" },
];

/** Presents backend sentiment shares and reply measures with their actual cohort samples. */
export default function AnalyticsReviewPerformance({
  report,
}: {
  report: PlusReviewPerformanceReport;
}) {
  const cohort = report.current;
  const maximum = Math.max(
    1,
    ...SENTIMENTS.map(({ key }) => cohort.sentiment[key].count),
  );
  const showShares =
    cohort.has_sufficient_sentiment_data && cohort.classified_review_count > 0;
  return (
    <View className="gap-6">
      {/* Classified counts stay visible; percentages are withheld for insufficient samples. */}
      <View className="gap-3">
        <AppText weight="bold" className="text-base text-text-primary">
          Review sentiment
        </AppText>
        <AppText className="text-sm leading-5 text-text-secondary">
          {cohort.classified_review_count} classified ·{" "}
          {cohort.unclassified_review_count} unclassified ·{" "}
          {cohort.published_review_count} currently published reviews created in
          this period
        </AppText>
        {!showShares && (
          <InfoBanner title="Insufficient sentiment data">
            <AppText className="text-sm leading-5 text-text-secondary">
              Counts are shown, but sentiment shares are withheld until the
              backend reports a sufficient classified sample.
            </AppText>
          </InfoBanner>
        )}
        {SENTIMENTS.map(({ key, label, color }) => {
          const sentiment = cohort.sentiment[key];
          return (
            <View
              key={key}
              accessible
              accessibilityLabel={`${label}: ${sentiment.count} reviews${showShares && sentiment.percentage !== null ? `, ${sentiment.percentage}% of classified reviews` : ""}`}
              className="gap-2 py-2"
            >
              <View className="flex-row flex-wrap justify-between gap-2">
                <AppText
                  weight="semibold"
                  className="text-sm text-text-primary"
                >
                  {label}
                </AppText>
                <AppText className="text-sm text-text-secondary">
                  {sentiment.count} reviews
                  {showShares
                    ? sentiment.percentage === null
                      ? " · Share unavailable"
                      : ` · ${sentiment.percentage}%`
                    : ""}
                </AppText>
              </View>
              <View
                accessible={false}
                className="h-2 overflow-hidden rounded-full bg-surface-muted"
              >
                <View
                  className={`h-full rounded-full ${color}`}
                  style={{ width: `${(sentiment.count / maximum) * 100}%` }}
                />
              </View>
            </View>
          );
        })}
        <AppText className="text-sm leading-5 text-text-secondary">
          Bars compare classified review counts. Shares, when available, exclude
          unclassified reviews.
        </AppText>
      </View>
      {/* Server-computed rates, comparisons and medians retain zero/null distinctions. */}
      <View className="gap-3 border-t border-border-primary pt-5">
        <AppText weight="bold" className="text-base text-text-primary">
          Reply performance
        </AppText>
        <View className="rounded-card bg-background p-4">
          <AppText className="text-sm text-text-secondary">Reply rate</AppText>
          <AppText
            accessibilityLabel={`Plus reply rate: ${cohort.reply_rate === null ? "Unavailable" : `${cohort.reply_rate}%`}`}
            weight="bold"
            className="mt-1 text-2xl text-text-primary"
          >
            {cohort.reply_rate === null ? "—" : `${cohort.reply_rate}%`}
          </AppText>
          <AppText className="mt-2 text-sm leading-5 text-text-secondary">
            {cohort.replied_review_count} of {cohort.published_review_count}{" "}
            eligible reviews replied to.{" "}
            {cohort.published_review_count === 0
              ? "No eligible reviews in this period."
              : ""}
          </AppText>
          <AppText className="mt-2 text-sm leading-5 text-text-secondary">
            {formatReplyComparison(report.reply_rate_change)}
          </AppText>
        </View>
        <View className="rounded-card bg-background p-4">
          <AppText className="text-sm text-text-secondary">
            Median reply time
          </AppText>
          <AppText weight="bold" className="mt-1 text-2xl text-text-primary">
            {formatReplyDuration(cohort.median_first_reply_seconds)}
          </AppText>
          <AppText className="mt-2 text-sm leading-5 text-text-secondary">
            Based on {cohort.median_replied_sample_size} retained replies with
            valid timestamps.
          </AppText>
        </View>
        {report.excluded_reply_timestamp_count > 0 && (
          <AppText className="text-sm leading-5 text-text-secondary">
            Some invalid reply timestamps were excluded.
          </AppText>
        )}
      </View>
      {/* Weekly volume uses returned current-published creation cohorts, including explicit zeros. */}
      <View className="gap-3 border-t border-border-primary pt-5">
        <AppText weight="bold" className="text-base text-text-primary">
          Weekly published-review volume
        </AppText>
        <AnalyticsSeriesChart
          label="Published reviews"
          interval="weekly"
          kind="bar"
          points={report.series.map((bucket) => ({
            ...bucket,
            value: bucket.published_review_count,
          }))}
        />
      </View>
      <PlusReportContext meta={report.meta} note={report.measurement_note} />
    </View>
  );
}
