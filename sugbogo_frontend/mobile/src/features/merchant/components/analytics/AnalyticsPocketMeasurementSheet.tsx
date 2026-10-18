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

import type { PlusPocketReport } from "../../types/merchantPlusAnalytics.types";
import {
  formatAnalyticsCount,
  formatAnalyticsDate,
} from "../../utils/merchantAnalytics.utils";

import { PlusReportContext } from "./AnalyticsPlusStates";

type Props = {
  sheetRef: RefObject<BottomSheetModal | null>;
  report: PlusPocketReport;
};

const SNAP_POINTS = ["70%", "90%"];

/**
 * Explains Pocket activity measurements using SugboGo's shared
 * bottom-sheet interaction pattern.
 *
 * Prioritizes the difference between save events and unique accounts,
 * with detailed reporting limitations available on demand.
 */
export default function AnalyticsPocketMeasurementSheet({
  sheetRef,
  report,
}: Props) {
  const insets = useSafeAreaInsets();
  const [showDetails, setShowDetails] = useState(false);

  const saves = report.metrics.saves;

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
      onDismiss={() => setShowDetails(false)}
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
              About Pocket activity
            </AppText>

            <AppText className="mt-1 text-sm leading-5 text-text-secondary">
              Understand what your save activity means
            </AppText>
          </View>

          <Pressable
            onPress={closeSheet}
            accessibilityRole="button"
            accessibilityLabel="Close Pocket information"
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

        {/* Simple distinction between saves and saving accounts */}
        <View className="gap-2 rounded-2xl bg-surface-muted p-4">
          <AppText weight="semibold" className="text-base text-text-primary">
            Saves vs. saving accounts
          </AppText>

          <AppText className="text-sm leading-6 text-text-secondary">
            Recorded saves count eligible save activity. Unique saving accounts
            count how many different explorer accounts saved your business
            during the selected dates.
          </AppText>
        </View>

        {/* Merchant-friendly measurement explanations */}
        <View className="mt-5 gap-5">
          <View className="flex-row items-start gap-3">
            <View className="h-10 w-10 items-center justify-center rounded-xl bg-surface-muted">
              <MaterialCommunityIcons
                name="bookmark-outline"
                size={21}
                color={theme.extends.colors.text.secondary}
                accessible={false}
              />
            </View>

            <View className="min-w-0 flex-1 gap-1">
              <AppText weight="semibold" className="text-sm text-text-primary">
                Recorded saves
              </AppText>

              <AppText className="text-sm leading-6 text-text-secondary">
                An account's save activity is recorded at most once per business
                per UTC day. Saving again on another day can add another
                recorded save.
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
                Unique saving accounts
              </AppText>

              <AppText className="text-sm leading-6 text-text-secondary">
                Each account is counted once across the selected period, even if
                it later removes the business from a Pocket.
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
                The bars compare recorded saves by week. A recorded zero is
                different from a week with missing data. Partial weeks may cover
                fewer days.
              </AppText>
            </View>
          </View>
        </View>

        {/* Source coverage and comparison rules on demand */}
        <View className="mt-5 border-t border-border-primary pt-2">
          <Pressable
            onPress={() => setShowDetails((current) => !current)}
            accessibilityRole="button"
            accessibilityLabel="Detailed Pocket measurement information"
            accessibilityState={{
              expanded: showDetails,
            }}
            className="min-h-12 flex-row cursor-pointer items-center justify-between gap-3 py-3 active:opacity-70"
          >
            <AppText
              weight="semibold"
              className="min-w-0 flex-1 text-sm text-text-primary"
            >
              Detailed rules and sources
            </AppText>

            <MaterialCommunityIcons
              name={showDetails ? "chevron-up" : "chevron-down"}
              size={21}
              color={theme.extends.colors.text.secondary}
              accessible={false}
            />
          </Pressable>

          {showDetails && (
            <View className="gap-5 pb-4 pt-2">
              {/* Reporting period */}
              <View className="gap-1">
                <AppText
                  weight="semibold"
                  className="text-sm text-text-primary"
                >
                  Reporting dates
                </AppText>

                <AppText className="text-sm leading-6 text-text-secondary">
                  {formatAnalyticsDate(saves.sources.current.period.start_date)}{" "}
                  – {formatAnalyticsDate(saves.sources.current.period.end_date)}{" "}
                  · Manila time
                </AppText>
              </View>

              {/* Source details and existing measurement limitations */}
              <View className="gap-2">
                <AppText
                  weight="semibold"
                  className="text-sm text-text-primary"
                >
                  Measurement information
                </AppText>

                <PlusReportContext
                  meta={saves.sources.current}
                  note={report.measurement_note}
                >
                  <AppText className="text-sm leading-6 text-text-secondary">
                    Previous period:{" "}
                    {formatAnalyticsDate(
                      saves.sources.previous.period.start_date,
                    )}{" "}
                    –{" "}
                    {formatAnalyticsDate(
                      saves.sources.previous.period.end_date,
                    )}
                    . Recorded saves:{" "}
                    {formatAnalyticsCount(saves.previous_value)}.
                    {saves.previous_value === null
                      ? " The previous count is unavailable."
                      : ""}{" "}
                    These records cannot reliably establish business growth.
                  </AppText>
                </PlusReportContext>
              </View>

              {/* Clarifies that recorded activity is not current Pocket ownership */}
              <View className="gap-1">
                <AppText
                  weight="semibold"
                  className="text-sm text-text-primary"
                >
                  Current Pocket holders
                </AppText>

                <AppText className="text-sm leading-6 text-text-secondary">
                  These measurements describe activity during the selected
                  dates. They do not show how many accounts currently have your
                  business saved.
                </AppText>
              </View>
            </View>
          )}
        </View>
      </BottomSheetScrollView>
    </BottomSheetModal>
  );
}
