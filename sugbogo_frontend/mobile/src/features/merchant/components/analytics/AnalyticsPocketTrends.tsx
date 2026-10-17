import { View } from "react-native";
import AppText from "@/shared/components/AppText";
import ErrorState from "@/shared/components/ErrorState";
import type { PlusPocketReport } from "../../types/merchantPlusAnalytics.types";
import { formatAnalyticsCount } from "../../utils/merchantAnalytics.utils";
import AnalyticsEventTrend from "./AnalyticsEventTrend";

/** Presents recorded weekly saves independently of current saved relationships. */
export default function AnalyticsPocketTrends({
  report,
  retry,
}: {
  report: PlusPocketReport;
  retry: () => void;
}) {
  const distinct = report.metrics.distinct_savers;
  return (
    <View className="gap-4">
      {/* This account count comes from the period-wide backend aggregate. */}
      <View className="rounded-card bg-background p-4">
        <AppText weight="semibold" className="text-base text-text-primary">
          Distinct saver accounts
        </AppText>
        <AppText
          accessibilityLabel={`Distinct saver accounts: ${distinct.value === null ? "Unavailable" : distinct.value}`}
          weight="bold"
          className="mt-1 text-2xl text-text-primary"
        >
          {formatAnalyticsCount(distinct.value)}
        </AppText>
        <AppText className="mt-2 text-sm leading-5 text-text-secondary">
          Recorded SAVE activity in this period. These are not current Pocket
          holders. Removing a saved business does not erase recorded saves.
        </AppText>
      </View>
      {distinct.value === null && (
        <ErrorState
          size="section"
          title="Distinct savers unavailable"
          description="Recorded save totals may still be available."
          primaryActionTitle="Retry"
          onPrimaryAction={retry}
        />
      )}
      <AnalyticsEventTrend
        metric={report.metrics.saves}
        label="Recorded saves"
        interval="weekly"
        kind="bar"
        note={report.measurement_note}
        retry={retry}
      />
    </View>
  );
}
