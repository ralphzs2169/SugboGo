import { useState } from "react";
import { Pressable, View } from "react-native";

import AppText from "@/shared/components/AppText";
import ErrorState from "@/shared/components/ErrorState";

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
      <View className="gap-2">
        <AppText className="text-sm leading-5 text-text-secondary">
          {!visibility.coverage_verified
            ? "Some activity may not be recorded."
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
              For each business, visits and saves are each counted once per
              account per UTC day. Visitor accounts are counted once across the
              selected period. Replies are checked when this report is prepared,
              including replies made after the selected dates.
            </AppText>
            <AppText className="text-sm leading-5 text-text-secondary">
              {visibility.data_through
                ? `Visit and save data available through ${formatAnalyticsTimestamp(visibility.data_through)} · Manila time.`
                : "The latest visit and save data time could not be verified."}
            </AppText>
            <AppText className="text-sm leading-5 text-text-secondary">
              Reviews, replies and vouches reflect records that still qualify
              today. Earlier counts can change when records are removed or their
              status changes.
            </AppText>
            <AppText className="text-sm leading-5 text-text-secondary">
              Replies checked through{" "}
              {formatAnalyticsTimestamp(report.reviews.reply_cutoff)} Manila
              time. A dash means a reply percentage is unavailable; it does not
              mean 0%.
            </AppText>
            {report.reviews.excluded_reply_timestamp_count > 0 && (
              <AppText className="text-sm leading-5 text-text-secondary">
                Replies with unusable timing data are excluded from reply
                counts.
              </AppText>
            )}
          </View>
        )}
      </View>
    </View>
  );
}
