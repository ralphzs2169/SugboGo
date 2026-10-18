import type { ReactNode } from "react";
import { View } from "react-native";
import AppText from "@/shared/components/AppText";
import ErrorState from "@/shared/components/ErrorState";
import type {
  AnalyticsEventMetric,
  AnalyticsInterval,
} from "../../types/merchantPlusAnalytics.types";
import {
  formatAnalyticsCount,
  formatAnalyticsDate,
} from "../../utils/merchantAnalytics.utils";
import AnalyticsSeriesChart from "./AnalyticsSeriesChart";
import AnalyticsChartEmptyState from "./AnalyticsChartEmptyState";
import { PlusReportContext } from "./AnalyticsPlusStates";

/** Leads with the recorded total, then supporting counts, with comparisons in measurement details. */
export default function AnalyticsEventTrend({
  metric,
  label,
  interval,
  kind = "line",
  retry,
  note,
  children,
}: {
  metric: AnalyticsEventMetric;
  label: string;
  interval: AnalyticsInterval;
  kind?: "line" | "bar";
  retry: () => void;
  note?: string;
  children?: ReactNode;
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
      </View>
      {children}
      {unavailable && !chartUnavailable && (
        <ErrorState
          size="section"
          title="Some recorded activity is unavailable"
          description="Available counts are shown. Unavailable values do not mean zero activity."
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
          "For each business, each type of activity is counted once per account per UTC day. Account totals count each account once across the selected dates; adding daily or weekly account counts would count some accounts more than once."
        }
      >
        <AppText className="text-sm leading-5 text-text-secondary">
          Previous period ·{" "}
          {formatAnalyticsDate(metric.sources.previous.period.start_date)} –{" "}
          {formatAnalyticsDate(metric.sources.previous.period.end_date)}:{" "}
          {formatAnalyticsCount(metric.previous_value)}.
          {metric.previous_value === null
            ? " The previous count is unavailable."
            : ""}{" "}
          These records cannot reliably show business growth.
        </AppText>
      </PlusReportContext>
    </View>
  );
}
