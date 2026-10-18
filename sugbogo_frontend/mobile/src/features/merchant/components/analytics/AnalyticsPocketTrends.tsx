import { MaterialCommunityIcons } from "@expo/vector-icons";
import { BottomSheetModal } from "@gorhom/bottom-sheet";
import { useRef } from "react";
import { View } from "react-native";

import { theme } from "@/constants/theme";
import AppText from "@/shared/components/AppText";
import ErrorState from "@/shared/components/ErrorState";
import SafePressable from "@/shared/components/SafePressable";

import type { PlusPocketReport } from "../../types/merchantPlusAnalytics.types";
import { formatAnalyticsCount } from "../../utils/merchantAnalytics.utils";

import AnalyticsEventTrend from "./AnalyticsEventTrend";
import AnalyticsPocketMeasurementSheet from "./AnalyticsPocketMeasurementSheet";

type Props = {
  report: PlusPocketReport;
  retry: () => void;
};

/**
 * Displays recorded Pocket saves as the primary metric, with unique
 * saving accounts as supporting context and weekly chart activity.
 *
 * Uses a flat section layout while preserving the existing metric
 * hierarchy and on-demand measurement explanations.
 */
export default function AnalyticsPocketTrends({ report, retry }: Props) {
  const measurementSheetRef = useRef<BottomSheetModal>(null);

  const saves = report.metrics.saves;
  const distinct = report.metrics.distinct_savers;

  return (
    <>
      <View className="gap-4">
        {/* Primary recorded saves and measurement information */}
        <View className="flex-row items-start justify-between gap-3">
          <View className="min-w-0 flex-1 gap-1">
            <AppText className="text-sm text-text-secondary">
              Recorded saves
            </AppText>

            <AppText
              weight="extrabold"
              className="text-3xl text-text-primary"
              accessibilityLabel={`Recorded saves: ${
                saves.value === null ? "Unavailable" : saves.value
              }`}
            >
              {formatAnalyticsCount(saves.value)}
            </AppText>

            <AppText className="text-xs text-text-secondary">
              During the selected period
            </AppText>
          </View>

          <SafePressable
            onPress={() => measurementSheetRef.current?.present()}
            accessibilityRole="button"
            accessibilityLabel="About Pocket activity"
            accessibilityHint="Opens explanations about recorded saves and saving accounts"
            className="h-11 w-11 cursor-pointer items-center justify-center rounded-full active:bg-surface-muted"
          >
            <MaterialCommunityIcons
              name="information-outline"
              size={22}
              color={theme.extends.colors.text.secondary}
              accessible={false}
            />
          </SafePressable>
        </View>

        {/* Secondary unique saving-account metric */}
        <View className="flex-row items-center gap-3 rounded-xl bg-surface-muted px-3 py-3">
          <View className="h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-surface">
            <MaterialCommunityIcons
              name="account-multiple-outline"
              size={20}
              color={theme.extends.colors.text.secondary}
              accessible={false}
            />
          </View>

          <View className="min-w-0 flex-1">
            <View className="flex-row flex-wrap items-baseline gap-x-2 gap-y-0.5">
              <AppText
                weight="bold"
                className="text-xl text-text-primary"
                accessibilityLabel={`Unique saving accounts: ${
                  distinct.value === null ? "Unavailable" : distinct.value
                }`}
              >
                {formatAnalyticsCount(distinct.value)}
              </AppText>

              <AppText className="text-sm ml-2 leading-5 text-text-secondary">
                Unique saving accounts
              </AppText>
            </View>
          </View>
        </View>

        {/* Independent recovery for saving-account data */}
        {distinct.value === null && (
          <ErrorState
            size="section"
            title="Saving accounts unavailable"
            description="Recorded save activity may still be available."
            primaryActionTitle="Retry"
            onPrimaryAction={retry}
          />
        )}

        {/* Weekly save activity */}
        <View className="gap-3 border-t border-border-primary/60 pt-4">
          <View className="flex-row items-center justify-between gap-3">
            <AppText weight="semibold" className="text-base text-text-primary">
              Save activity
            </AppText>

            <View className="rounded-lg bg-surface-muted px-2.5 py-1">
              <AppText weight="medium" className="text-xs text-text-secondary">
                Weekly
              </AppText>
            </View>
          </View>

          <AnalyticsEventTrend
            metric={saves}
            label="Recorded saves"
            interval="weekly"
            note={report.measurement_note}
            retry={retry}
            showTotal={false}
            showContext={false}
          />
        </View>
      </View>

      {/* On-demand measurement information */}
      <AnalyticsPocketMeasurementSheet
        sheetRef={measurementSheetRef}
        report={report}
      />
    </>
  );
}
