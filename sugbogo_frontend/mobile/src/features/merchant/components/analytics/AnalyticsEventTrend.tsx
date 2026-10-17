import { View } from "react-native";
import AppText from "@/shared/components/AppText";
import ErrorState from "@/shared/components/ErrorState";
import type {
  AnalyticsEventMetric,
  AnalyticsInterval,
} from "../../types/merchantPlusAnalytics.types";
import { formatAnalyticsCount } from "../../utils/merchantAnalytics.utils";
import AnalyticsSeriesChart from "./AnalyticsSeriesChart";
import { PlusReportContext } from "./AnalyticsPlusStates";

/** Keeps totals, series and comparison availability independent within an event report. */
export default function AnalyticsEventTrend({
  metric,
  label,
  interval,
  kind = "line",
  retry,
  note,
}: {
  metric: AnalyticsEventMetric;
  label: string;
  interval: AnalyticsInterval;
  kind?: "line" | "bar";
  retry: () => void;
  note?: string;
}) {
  const unavailable = metric.value === null || metric.series === null;
  return (
    <View className="gap-4">
      {/* Totals are never reconstructed by summing bucket-level account counts. */}
      <View>
        <AppText className="text-sm text-text-secondary">
          {label} · selected period
        </AppText>
        <AppText
          accessibilityLabel={`${label}: ${metric.value === null ? "Unavailable" : metric.value}`}
          weight="extrabold"
          className="mt-1 text-3xl text-text-primary"
        >
          {formatAnalyticsCount(metric.value)}
        </AppText>
        <AppText className="mt-1 text-sm leading-5 text-text-secondary">
          Previous recorded total: {formatAnalyticsCount(metric.previous_value)}
          .{" "}
          {metric.change.value === null
            ? "Growth comparison unavailable."
            : "Tracking observations do not establish business growth."}
        </AppText>
      </View>
      {unavailable && (
        <ErrorState
          size="section"
          title="Some recorded activity is unavailable"
          description="Available totals or buckets are still shown. Missing values are not zero."
          primaryActionTitle="Retry"
          onPrimaryAction={retry}
        />
      )}
      {metric.series !== null && (
        <AnalyticsSeriesChart
          key={`${label}-${interval}`}
          label={label}
          points={metric.series}
          interval={interval}
          kind={kind}
          range={metric.sources.current.period}
        />
      )}
      <PlusReportContext
        meta={metric.sources.current}
        note={
          note ??
          "Observations are deduplicated per account, business and event type each UTC day. Period-wide distinct accounts are not sums of daily or weekly distinct accounts."
        }
      />
    </View>
  );
}
