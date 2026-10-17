import { View } from "react-native";
import AppText from "@/shared/components/AppText";
import ErrorState from "@/shared/components/ErrorState";
import type {
  AnalyticsEventMetric,
  AnalyticsInterval,
} from "../../types/merchantPlusAnalytics.types";
import { formatAnalyticsCount } from "../../utils/merchantAnalytics.utils";
import AnalyticsSeriesChart from "./AnalyticsSeriesChart";
import AnalyticsChartEmptyState from "./AnalyticsChartEmptyState";
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
  const unavailable =
    metric.value === null ||
    metric.series === null ||
    metric.sources.current.availability === "unavailable";
  const chartUnavailable =
    metric.series === null || (unavailable && metric.series.length === 0);
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
      {unavailable && !chartUnavailable && (
        <ErrorState
          size="section"
          title="Some recorded activity is unavailable"
          description="Available totals or buckets are still shown. Missing values are not zero."
          primaryActionTitle="Retry"
          onPrimaryAction={retry}
        />
      )}
      {chartUnavailable && (
        <AnalyticsChartEmptyState
          title="Recorded activity unavailable"
          description={`${label} cannot currently be charted. Any available total remains above. Missing values are not zero activity.`}
          icon="cloud-off-outline"
          onRetry={retry}
        />
      )}
      {!chartUnavailable && metric.series !== null && (
        <AnalyticsSeriesChart
          key={`${label}-${interval}`}
          label={label}
          points={metric.series}
          interval={interval}
          kind={kind}
          range={metric.sources.current.period}
          total={
            metric.sources.current.availability === "unavailable"
              ? null
              : metric.value
          }
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
