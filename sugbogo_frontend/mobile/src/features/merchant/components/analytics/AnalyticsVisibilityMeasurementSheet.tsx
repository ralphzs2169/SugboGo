import { MaterialCommunityIcons } from "@expo/vector-icons";
import {
  BottomSheetBackdrop,
  BottomSheetModal,
  BottomSheetScrollView,
  type BottomSheetBackdropProps,
} from "@gorhom/bottom-sheet";
import { useCallback, useMemo, useState } from "react";
import type { RefObject } from "react";
import { Pressable, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { theme } from "@/constants/theme";
import AppText from "@/shared/components/AppText";

import type {
  AnalyticsEventMetric,
  AnalyticsInterval,
  VisibilityMetric,
} from "../../types/merchantPlusAnalytics.types";
import {
  formatAnalyticsCount,
  formatAnalyticsDate,
} from "../../utils/merchantAnalytics.utils";

import { PlusReportContext } from "./AnalyticsPlusStates";

type Props = {
  sheetRef: RefObject<BottomSheetModal | null>;
  metric?: AnalyticsEventMetric;
  metricKey: VisibilityMetric;
  metricLabel: string;
  interval: AnalyticsInterval;
  note?: string;
};

const SNAP_POINTS = ["76%", "90%"];

const METRIC_DESCRIPTIONS: Record<VisibilityMetric, string> = {
  profile_visits:
    "Recorded visits to your business profile during the selected dates.",
  impressions:
    "Recorded occasions when your business appeared in discovery activity.",
  distinct_profile_visitors:
    "Distinct accounts that visited your business profile during the selected dates.",
};

/**
 * Explains visibility measurements using SugboGo's bottom-sheet
 * interaction pattern.
 *
 * Prioritizes a short interpretation guide, while preserving
 * source information and previous-period reporting on demand.
 */
export default function AnalyticsVisibilityMeasurementSheet({
  sheetRef,
  metric,
  metricKey,
  metricLabel,
  interval,
  note,
}: Props) {
  const insets = useSafeAreaInsets();
  const [showRules, setShowRules] = useState(false);

  const backgroundStyle = useMemo(
    () => ({
      backgroundColor: theme.extends.colors.surface,
      borderRadius: 24,
    }),
    [],
  );

  const handleIndicatorStyle = useMemo(
    () => ({
      backgroundColor: theme.extends.colors.text.disabled,
      width: 40,
    }),
    [],
  );

  const renderBackdrop = useCallback(
    (props: BottomSheetBackdropProps) => (
      <BottomSheetBackdrop
        {...props}
        appearsOnIndex={0}
        disappearsOnIndex={-1}
        opacity={0.5}
        pressBehavior="close"
      />
    ),
    [],
  );

  const closeSheet = useCallback(() => {
    sheetRef.current?.dismiss();
  }, [sheetRef]);

  const groupingDescription =
    interval === "weekly"
      ? "Weekly counts start on Monday. The first and last weeks may cover fewer days, and their counts are not adjusted."
      : "Daily counts follow Manila calendar dates. A partial day contains less than a full day's activity.";

  return (
    <BottomSheetModal
      ref={sheetRef}
      snapPoints={SNAP_POINTS}
      topInset={insets.top}
      enableDynamicSizing={false}
      enablePanDownToClose
      backgroundStyle={backgroundStyle}
      handleIndicatorStyle={handleIndicatorStyle}
      backdropComponent={renderBackdrop}
      onDismiss={() => setShowRules(false)}
    >
      <BottomSheetScrollView
        contentContainerClassName="px-5 pt-2"
        contentContainerStyle={{
          paddingBottom: Math.max(insets.bottom, 20) + 16,
        }}
        showsVerticalScrollIndicator={false}
      >
        {/* Sheet header */}
        <View className="mb-5 flex-row items-start justify-between">
          <View className="min-w-0 flex-1 pr-3">
            <AppText
              weight="bold"
              accessibilityRole="header"
              className="text-xl text-text-primary"
            >
              About visibility trends
            </AppText>

            <AppText className="mt-1 text-sm text-text-secondary">
              Understand your recorded activity
            </AppText>
          </View>

          <Pressable
            onPress={closeSheet}
            accessibilityRole="button"
            accessibilityLabel="Close visibility information"
            className="h-11 w-11 cursor-pointer items-center justify-center rounded-full active:bg-surface-muted"
          >
            <MaterialCommunityIcons
              name="close"
              size={23}
              color={theme.extends.colors.text.secondary}
              accessible={false}
            />
          </Pressable>
        </View>

        {/* Focused explanation of the selected metric */}
        <View className="gap-2 rounded-2xl bg-surface-muted p-4">
          <AppText className="text-xs text-text-secondary">
            SELECTED METRIC
          </AppText>

          <AppText weight="bold" className="text-lg text-text-primary">
            {metricLabel}
          </AppText>

          <AppText className="text-sm leading-6 text-text-secondary">
            {METRIC_DESCRIPTIONS[metricKey]}
          </AppText>
        </View>

        {/* Concise chart interpretation */}
        <View className="mt-5 gap-5">
          <View className="flex-row items-start gap-3">
            <View className="h-10 w-10 items-center justify-center rounded-xl bg-surface-muted">
              <MaterialCommunityIcons
                name="calendar-month-outline"
                size={21}
                color={theme.extends.colors.text.secondary}
                accessible={false}
              />
            </View>

            <View className="min-w-0 flex-1 gap-1">
              <AppText weight="semibold" className="text-sm text-text-primary">
                {interval === "weekly" ? "Weekly grouping" : "Daily grouping"}
              </AppText>

              <AppText className="text-sm leading-6 text-text-secondary">
                {groupingDescription}
              </AppText>
            </View>
          </View>

          <View className="flex-row items-start gap-3">
            <View className="h-10 w-10 items-center justify-center rounded-xl bg-surface-muted">
              <MaterialCommunityIcons
                name="chart-bar"
                size={21}
                color={theme.extends.colors.text.secondary}
                accessible={false}
              />
            </View>

            <View className="min-w-0 flex-1 gap-1">
              <AppText weight="semibold" className="text-sm text-text-primary">
                Reading the chart
              </AppText>

              <AppText className="text-sm leading-6 text-text-secondary">
                Orange bars show recorded counts. A hollow circle marks a
                recorded zero. A dash means data is missing, not confirmed zero
                activity.
              </AppText>
            </View>
          </View>

          <View className="flex-row items-start gap-3">
            <View className="h-10 w-10 items-center justify-center rounded-xl bg-surface-muted">
              <MaterialCommunityIcons
                name="account-multiple-outline"
                size={21}
                color={theme.extends.colors.text.secondary}
                accessible={false}
              />
            </View>

            <View className="min-w-0 flex-1 gap-1">
              <AppText weight="semibold" className="text-sm text-text-primary">
                Understanding totals
              </AppText>

              <AppText className="text-sm leading-6 text-text-secondary">
                Unique account totals cover the entire selected period. Adding
                daily or weekly unique-account counts may count the same account
                more than once.
              </AppText>
            </View>
          </View>
        </View>

        {/* Optional source and counting documentation */}
        <View className="mt-5 border-t border-border-primary pt-2">
          <Pressable
            onPress={() => setShowRules((current) => !current)}
            accessibilityRole="button"
            accessibilityLabel="Detailed measurement rules and sources"
            accessibilityState={{
              expanded: showRules,
            }}
            className="min-h-12 flex-row cursor-pointer items-center justify-between gap-3 py-3 active:opacity-70"
          >
            <View className="min-w-0 flex-1 flex-row items-center gap-2">
              <MaterialCommunityIcons
                name="information-outline"
                size={20}
                color={theme.extends.colors.text.secondary}
                accessible={false}
              />

              <AppText weight="semibold" className="text-sm text-text-primary">
                Detailed rules and sources
              </AppText>
            </View>

            <MaterialCommunityIcons
              name={showRules ? "chevron-up" : "chevron-down"}
              size={21}
              color={theme.extends.colors.text.secondary}
              accessible={false}
            />
          </Pressable>

          {showRules && (
            <View className="gap-5 pb-4 pt-2">
              {/* Date range and measurement rules */}
              {metric && (
                <View className="gap-2">
                  <AppText
                    weight="semibold"
                    className="text-sm text-text-primary"
                  >
                    Reporting dates
                  </AppText>

                  <AppText className="text-sm leading-6 text-text-secondary">
                    {formatAnalyticsDate(
                      metric.sources.current.period.start_date,
                    )}{" "}
                    –{" "}
                    {formatAnalyticsDate(
                      metric.sources.current.period.end_date,
                    )}{" "}
                    · Manila time
                  </AppText>
                </View>
              )}

              <View className="gap-2">
                <AppText
                  weight="semibold"
                  className="text-sm text-text-primary"
                >
                  How activity is counted
                </AppText>

                <AppText className="text-sm leading-6 text-text-secondary">
                  {note ??
                    "Recorded activity is counted once per account, per business, per event type and UTC day. Unique account totals count each account once across the selected reporting period."}
                </AppText>
              </View>

              {/* Existing source context and previous-period limitations */}
              {metric && (
                <View className="gap-2">
                  <AppText
                    weight="semibold"
                    className="text-sm text-text-primary"
                  >
                    Source and comparison information
                  </AppText>

                  <PlusReportContext
                    meta={metric.sources.current}
                    note={
                      note ??
                      "Recorded activity may be incomplete. Missing dates are not confirmed zero activity."
                    }
                  >
                    <AppText className="text-sm leading-6 text-text-secondary">
                      Previous period:{" "}
                      {formatAnalyticsDate(
                        metric.sources.previous.period.start_date,
                      )}{" "}
                      –{" "}
                      {formatAnalyticsDate(
                        metric.sources.previous.period.end_date,
                      )}
                      . Recorded count:{" "}
                      {formatAnalyticsCount(metric.previous_value)}.
                      {metric.previous_value === null
                        ? " The previous count is unavailable."
                        : ""}{" "}
                      These records cannot reliably establish business growth.
                    </AppText>
                  </PlusReportContext>
                </View>
              )}
            </View>
          )}
        </View>
      </BottomSheetScrollView>
    </BottomSheetModal>
  );
}
