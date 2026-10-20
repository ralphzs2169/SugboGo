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
import { PlusReportContext } from "./AnalyticsPlusStates";

/**
 * Displays a recorded activity chart with independent error handling.
 *
 * Supports a concise overview presentation while retaining existing
 * source context in other analytics reports by default.
 */
export default function AnalyticsEventTrend({
  metric,
  label,
  interval,
  retry,
  note,
  children,
  showTotal = true,
  showContext = true,
  variant = "bar",
}: {
  metric: AnalyticsEventMetric;
  label: string;
  interval: AnalyticsInterval;
  retry: () => void;
  note?: string;
  children?: ReactNode;
  showTotal?: boolean;
  showContext?: boolean;
  variant?: "bar" | "line";
}) {
  const unavailable =
    metric.value === null ||
    metric.series === null ||
    metric.sources.current.availability === "unavailable";

  const chartUnavailable =
    metric.series === null || (unavailable && metric.series.length === 0);

  return (
    <View className="gap-3">
      {/* Optional recorded total for standalone reports */}
      {showTotal && (
        <View>
          <AppText className="text-sm text-text-secondary">
            {label} · selected period
          </AppText>

          <AppText
            weight="extrabold"
            className="mt-1 text-3xl text-text-primary"
            accessibilityLabel={`${label}: ${
              metric.value === null ? "Unavailable" : metric.value
            }`}
          >
            {formatAnalyticsCount(metric.value)}
          </AppText>
        </View>
      )}

      {children}

      {/* Retain available data even when some measurements fail */}
      {unavailable && !chartUnavailable && (
        <ErrorState
          variant="analytics"
          title="Some recorded activity is unavailable"
          description="Available counts are shown. Unavailable values do not mean zero activity."
          primaryActionTitle="Retry"
          onPrimaryAction={retry}
        />
      )}

      {chartUnavailable && (
        <ErrorState
          variant="analytics"
          primaryActionTitle="Retry"
          title="Recorded activity unavailable"
          description={`${label} cannot currently be charted. Any available total remains above. Missing values are not zero activity.`}
          icon="cloud-off-outline"
          onPrimaryAction={retry}
        />
      )}

      {/* Actual recorded series, with no invented calendar values */}
      {!chartUnavailable && metric.series !== null && (
        <AnalyticsSeriesChart
          key={`${label}-${interval}`}
          label={label}
          points={metric.series}
          interval={interval}
          variant={variant}
          range={metric.sources.current.period}
          total={
            metric.sources.current.availability === "unavailable"
              ? null
              : metric.value
          }
          minimalFooter={!showContext}
        />
      )}

      {/* Existing source disclosure for standalone reports */}
      {showContext && (
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
      )}
    </View>
  );
}
