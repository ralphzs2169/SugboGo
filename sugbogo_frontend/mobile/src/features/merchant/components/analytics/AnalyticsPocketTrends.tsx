import { View } from "react-native";
import AppText from "@/shared/components/AppText";
import ErrorState from "@/shared/components/ErrorState";
import type { PlusPocketReport } from "../../types/merchantPlusAnalytics.types";
import { formatAnalyticsCount } from "../../utils/merchantAnalytics.utils";
import AnalyticsEventTrend from "./AnalyticsEventTrend";

/** Leads with recorded saves and keeps the unique saving-account count before the chart. */
export default function AnalyticsPocketTrends({
  report,
  retry,
}: {
  report: PlusPocketReport;
  retry: () => void;
}) {
  const distinct = report.metrics.distinct_savers;
  return (
    <AnalyticsEventTrend
      metric={report.metrics.saves}
      label="Recorded saves"
      interval="weekly"
      kind="bar"
      note={report.measurement_note}
      retry={retry}
    >
      {/* This account count comes from the period-wide backend aggregate. */}
      <View className="rounded-card bg-background p-4">
        <AppText weight="semibold" className="text-base text-text-primary">
          Accounts that saved your business
        </AppText>
        <AppText
          accessibilityLabel={`Accounts that saved your business: ${distinct.value === null ? "Unavailable" : distinct.value}`}
          weight="bold"
          className="mt-1 text-2xl text-text-primary"
        >
          {formatAnalyticsCount(distinct.value)}
        </AppText>
        <AppText className="mt-2 text-sm leading-5 text-text-secondary">
          Each account is counted once during these dates, even if it later
          removes your business from a Pocket.
        </AppText>
      </View>
      {distinct.value === null && (
        <ErrorState
          size="section"
          title="Saving accounts unavailable"
          description="Recorded save totals may still be available."
          primaryActionTitle="Retry"
          onPrimaryAction={retry}
        />
      )}
    </AnalyticsEventTrend>
  );
}
