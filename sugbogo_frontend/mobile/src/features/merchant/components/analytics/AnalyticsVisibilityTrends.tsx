import { BottomSheetModal } from "@gorhom/bottom-sheet";
import { useIsFocused } from "expo-router";
import { useRef, useState } from "react";
import {
  ActivityIndicator,
  View,
  useWindowDimensions,
} from "react-native";

import { theme } from "@/constants/theme";
import AppText from "@/shared/components/AppText";
import ErrorState from "@/shared/components/ErrorState";
import SegmentedControl from "@/shared/components/SegmentedControl";
import useQueryErrorNotification from "@/shared/hooks/useQueryErrorNotification";

import { useMerchantPlusVisibility } from "../../hooks/analytics/useMerchantPlusAnalytics";
import type { MerchantAnalyticsPeriod } from "../../types/merchantAnalytics.types";
import type {
  AnalyticsInterval,
  VisibilityMetric,
} from "../../types/merchantPlusAnalytics.types";
import { formatAnalyticsCount } from "../../utils/merchantAnalytics.utils";

import AnalyticsEventTrend from "./AnalyticsEventTrend";
import AnalyticsHeaderControls from "./AnalyticsHeaderControls";
import AnalyticsOverviewSection from "./AnalyticsOverviewSection";
import AnalyticsVisibilityMeasurementSheet from "./AnalyticsVisibilityMeasurementSheet";
import AnalyticsVisibilityMetricTabs from "./AnalyticsVisibilityMetricTabs";

const METRICS = [
  { value: "profile_visits", label: "Profile visits" },
  { value: "impressions", label: "Impressions" },
  {
    value: "distinct_profile_visitors",
    label: "Visitor accounts",
  },
] as const;

const INTERVAL_OPTIONS = [
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
] as const;

/**
 * Presents recorded visibility trends in a focused chart dashboard.
 *
 * Keeps metric selection and grouping accessible, preserves report
 * accuracy, and moves detailed explanations into a measurement sheet.
 */
export default function AnalyticsVisibilityTrends({
  period,
  onOpenPeriod,
}: {
  period: MerchantAnalyticsPeriod;
  onOpenPeriod: () => void;
}) {
  const focused = useIsFocused();
  const { fontScale } = useWindowDimensions();

  const measurementSheetRef = useRef<BottomSheetModal>(null);

  const [metric, setMetric] = useState<VisibilityMetric>("profile_visits");

  const [intervalSelections, setIntervalSelections] = useState<
    Partial<Record<MerchantAnalyticsPeriod, AnalyticsInterval>>
  >({});

  // Use weekly grouping for longer reporting periods.
  const interval =
    intervalSelections[period] ?? (period === "7" ? "daily" : "weekly");

  const query = useMerchantPlusVisibility({ period }, interval, focused);

  useQueryErrorNotification({
    error: focused ? query.error : null,
    toastId: "merchant-visibility-error",
    title: "Unable to load visibility",
    fallbackMessage: "Please retry this section.",
  });

  const selectedMetric = METRICS.find((option) => option.value === metric)!;

  const currentMetric = query.data?.metrics[metric];

  const selectMetric = (selected: VisibilityMetric) => {
    setMetric(selected);
  };

  const selectInterval = (selected: AnalyticsInterval) => {
    setIntervalSelections((current) => ({
      ...current,
      [period]: selected,
    }));
  };

  return (
    <>
      <AnalyticsOverviewSection
        title="Visibility trends"

        description="See how explorers interact with your business over time."
        accessory={
          <AnalyticsHeaderControls
            period={period}
            onOpenPeriod={onOpenPeriod}
            onOpenInformation={() => measurementSheetRef.current?.present()}
            informationLabel="About visibility trends"
            informationHint="Opens information about recorded activity and chart measurements"
          />
        }
      >
        <View className="gap-4">
          {/* Metric navigation with a clear selected indicator */}
          <View className="border-b border-border-primary/60">
            {/* Animated visibility metric navigation */}
            <AnalyticsVisibilityMetricTabs
              options={METRICS}
              value={metric}
              onChange={selectMetric}
            />
          </View>

          {/* Unified chart surface */}
          <View className="gap-4 rounded-2xl border border-border-primary/60 bg-surface p-4">
            {/* Recorded total and chart grouping */}
            <View className="flex-row flex-wrap items-end justify-between gap-3">
              <View className="min-w-0 flex-1 gap-1">
                <AppText className="text-sm text-text-secondary">
                  {selectedMetric.label}
                </AppText>

                <AppText
                  weight="extrabold"
                  className="text-3xl text-text-primary"
                  accessibilityLabel={`Recorded ${selectedMetric.label.toLowerCase()} in the selected period: ${
                    currentMetric?.value == null
                      ? "Unavailable"
                      : currentMetric.value
                  }`}
                >
                  {formatAnalyticsCount(currentMetric?.value ?? null)}
                </AppText>
              </View>

              <View
                style={{
                  width: 150 * Math.max(1, fontScale),
                  maxWidth: "100%",
                }}
              >
                <SegmentedControl
                  options={INTERVAL_OPTIONS.map((option) => ({
                    ...option,
                    accessibilityLabel: `Group by ${option.label.toLowerCase()}`,
                  }))}
                  value={interval}
                  onChange={selectInterval}
                  variant="sm"
                />
              </View>
            </View>

            {/* Independent chart loading and recovery */}
            {query.isPending && !query.data && (
              <View className="min-h-44 items-center justify-center gap-3">
                <ActivityIndicator color={theme.extends.colors.brand} />
                <AppText className="text-sm text-text-secondary">
                  Loading visibility activity…
                </AppText>
              </View>
            )}

            {query.error && (
              <ErrorState
                size="section"
                title={
                  query.data
                    ? "Unable to refresh visibility"
                    : "Visibility activity unavailable"
                }
                description={
                  query.data
                    ? "Previously loaded values are still shown."
                    : "The visibility report couldn't be loaded."
                }
                primaryActionTitle="Retry"
                onPrimaryAction={() => void query.refetch()}
              />
            )}

            {/* Calendar chart and compact chart footer */}
            {query.data && (
              <AnalyticsEventTrend
                metric={query.data.metrics[metric]}
                label={`Recorded ${selectedMetric.label.toLowerCase()}`}
                interval={query.data.interval}
                note={query.data.measurement_note}
                retry={() => void query.refetch()}
                showTotal={false}
                showContext={false}
              />
            )}
          </View>
        </View>
      </AnalyticsOverviewSection>

      {/* Shared Gorhom sheet pattern; mounted outside chart scrolling */}
      <AnalyticsVisibilityMeasurementSheet
        sheetRef={measurementSheetRef}
        metric={query.data?.metrics[metric]}
        metricKey={metric}
        metricLabel={selectedMetric.label}
        interval={interval}
        note={query.data?.measurement_note}
      />
    </>
  );
}
