import { useState } from "react";
import { Pressable, View } from "react-native";

import AppText from "@/shared/components/AppText";
import ErrorState from "@/shared/components/ErrorState";
import InfoBanner from "@/shared/components/InfoBanner";

import type { MerchantStandardAnalytics } from "../../types/merchantAnalytics.types";
import { formatAnalyticsTimestamp } from "../../utils/merchantAnalytics.utils";

type Props = {
  report: MerchantStandardAnalytics;
  onRetry: () => void;
};

/** Separates source failure from ordinary coverage limits and preserves partial success. */
export default function AnalyticsSourceNotice({ report, onRetry }: Props) {
  const [showDetails, setShowDetails] = useState(false);
  const visibility = report.sources.visibility;
  const hasUnavailableMetrics =
    visibility.availability === "unavailable" ||
    report.profile_visits === null ||
    report.distinct_profile_visitors === null ||
    report.saves_in_period === null;

  return (
    <View className="gap-3">
      {/* Source failures do not hide successful domain or visibility metrics */}
      {hasUnavailableMetrics && (
        <ErrorState
          size="section"
          title={
            visibility.availability === "unavailable"
              ? "Recorded activity unavailable"
              : "Some activity is unavailable"
          }
          description="Unavailable values aren't zero. Your other available metrics are still shown."
          primaryActionTitle="Retry"
          onPrimaryAction={onRetry}
        />
      )}

      {/* One consistent notice keeps the overview scannable */}
      <InfoBanner title="About these numbers">
        <AppText className="text-sm leading-5 text-text-secondary">
          {!visibility.coverage_verified
            ? "Tracking coverage is unverified. These are recorded events, not every interaction."
            : visibility.is_partial
              ? "Some recorded activity is incomplete or delayed."
              : "Recorded activity follows the selected reporting period."}
          {report.meta.partial_reasons.includes("current_day_incomplete")
            ? " Today is still in progress."
            : ""}
        </AppText>
        <Pressable
          onPress={() => setShowDetails((current) => !current)}
          accessibilityRole="button"
          accessibilityState={{ expanded: showDetails }}
          className="min-h-12 cursor-pointer justify-center self-start active:opacity-70"
        >
          <AppText weight="semibold" className="text-sm text-text-info">
            {showDetails
              ? "Hide measurement details"
              : "How these numbers are measured"}
          </AppText>
        </Pressable>
        {showDetails && (
          <View className="gap-2 border-t border-border-info pt-3">
            <AppText className="text-sm leading-5 text-text-secondary">
              Visits and saves are counted once per account, business and event
              type each UTC day. Replies are assessed at report time, including
              replies made after the selected period.
            </AppText>
            <AppText className="text-sm leading-5 text-text-secondary">
              Report status: {report.meta.availability}.
              {report.meta.is_partial
                ? " Some measures have coverage or current-state limitations."
                : ""}
            </AppText>
            <AppText className="text-sm leading-5 text-text-secondary">
              Visibility source: {visibility.availability}.
              {visibility.data_through
                ? ` Data through ${formatAnalyticsTimestamp(visibility.data_through)} Manila time.`
                : " Data freshness is unverified."}
            </AppText>
            <AppText className="text-sm leading-5 text-text-secondary">
              Business records: {report.sources.domain.availability}. Reviews,
              replies and specialty support reflect records that remain eligible
              now. Deletions and moderation can revise earlier results.
            </AppText>
            <AppText className="text-sm leading-5 text-text-secondary">
              Reply cutoff:{" "}
              {formatAnalyticsTimestamp(report.reviews.reply_cutoff)} Manila
              time. A missing reply rate means no valid rate is available, not a
              0% rate.
            </AppText>
            {report.reviews.excluded_reply_timestamp_count > 0 && (
              <AppText className="text-sm leading-5 text-text-secondary">
                Some reply timestamps were excluded from reply counts.
              </AppText>
            )}
          </View>
        )}
      </InfoBanner>
    </View>
  );
}
