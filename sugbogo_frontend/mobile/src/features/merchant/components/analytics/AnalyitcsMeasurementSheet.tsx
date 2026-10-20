import {
  BottomSheetBackdrop,
  BottomSheetModal,
  BottomSheetScrollView,
  type BottomSheetBackdropProps,
} from "@gorhom/bottom-sheet";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useCallback, useMemo, useState } from "react";
import { Pressable, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { theme } from "@/constants/theme";
import AppText from "@/shared/components/AppText";

import type { MerchantStandardAnalytics } from "../../types/merchantAnalytics.types";
import { formatAnalyticsTimestamp } from "../../utils/merchantAnalytics.utils";

type Props = {
  sheetRef: React.RefObject<BottomSheetModal | null>;
  report?: MerchantStandardAnalytics | null;
};

/**
 * Helps merchants understand which analytics follow the date filter,
 * which represent current totals, and how reporting limitations work.
 * Detailed counting rules remain collapsed until requested.
 */
export default function AnalyticsMeasurementSheet({ sheetRef, report }: Props) {
  const insets = useSafeAreaInsets();
  const [showRules, setShowRules] = useState(false);

  const visibility = report?.sources.visibility;
  const currentDayIncomplete = report?.meta.partial_reasons.includes(
    "current_day_incomplete",
  );

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
      snapPoints={["78%"]}
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
        {/* Sheet heading */}
        <View className="mb-5 flex-row items-start justify-between">
          <View className="min-w-0 flex-1 pr-3">
            <AppText
              weight="bold"
              accessibilityRole="header"
              className="text-xl text-text-primary"
            >
              Understanding your analytics
            </AppText>

            <AppText className="mt-1 text-sm leading-5 text-text-secondary">
              What your business numbers mean
            </AppText>
          </View>

          <Pressable
            onPress={closeSheet}
            accessibilityRole="button"
            accessibilityLabel="Close analytics information"
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

        {/* Explanation of date-filtered metrics */}
        <View className="flex-row items-start gap-3 pb-5">
          <View className="h-10 w-10 items-center justify-center rounded-xl bg-surface-muted">
            <MaterialCommunityIcons
              name="calendar-month-outline"
              size={22}
              color={theme.extends.colors.text.secondary}
              accessible={false}
            />
          </View>

          <View className="min-w-0 flex-1 gap-2">
            <AppText weight="bold" className="text-base text-text-primary">
              Activity during selected dates
            </AppText>

            <AppText className="text-sm leading-6 text-text-secondary">
              Profile visits, saves, new reviews, vouches added, and reply rates
              follow your selected 7, 30, or 90 days.
            </AppText>
          </View>
        </View>

        <View className="border-t border-border-primary" />

        {/* Explanation of metrics that do not change with the date filter */}
        <View className="flex-row items-start gap-3 py-5">
          <View className="h-10 w-10 items-center justify-center rounded-xl bg-surface-muted">
            <MaterialCommunityIcons
              name="chart-box-outline"
              size={22}
              color={theme.extends.colors.text.secondary}
              accessible={false}
            />
          </View>

          <View className="min-w-0 flex-1 gap-2">
            <AppText weight="bold" className="text-base text-text-primary">
              Current business totals
            </AppText>

            <AppText className="text-sm leading-6 text-text-secondary">
              Specialty support, Pocket holders, and total published reviews
              reflect your business&apos;s current records, regardless of the
              selected dates.
            </AppText>
          </View>
        </View>

        <View className="border-t border-border-primary" />

        {/* Data interpretation and availability */}
        <View className="flex-row items-start gap-3 py-5">
          <View className="h-10 w-10 items-center justify-center rounded-xl bg-surface-muted">
            <MaterialCommunityIcons
              name="information-outline"
              size={22}
              color={theme.extends.colors.text.secondary}
              accessible={false}
            />
          </View>

          <View className="min-w-0 flex-1 gap-2">
            <AppText weight="bold" className="text-base text-text-primary">
              Data accuracy
            </AppText>

            <AppText className="text-sm leading-6 text-text-secondary">
              {!visibility
                ? "Report-specific availability information will appear once your analytics load."
                : visibility.coverage_verified
                  ? visibility.is_partial
                    ? "Some activity may be incomplete or delayed."
                    : "Recorded activity is shown for the selected dates."
                  : "Some activity may not be recorded. Your displayed totals reflect the available records."}
            </AppText>

            {currentDayIncomplete && (
              <AppText className="text-sm leading-6 text-text-secondary">
                Today&apos;s reporting period is still in progress.
              </AppText>
            )}

            <AppText className="text-sm leading-6 text-text-secondary">
              An unavailable value does not mean zero activity.
            </AppText>
          </View>
        </View>

        {/* Optional technical measurement rules */}
        <View className="border-t border-border-primary pt-2">
          <Pressable
            onPress={() => setShowRules((current) => !current)}
            accessibilityRole="button"
            accessibilityLabel="Detailed counting rules and data dates"
            accessibilityState={{ expanded: showRules }}
            className="min-h-12 flex-row cursor-pointer items-center justify-between gap-3 py-3 active:opacity-70"
          >
            <AppText
              weight="semibold"
              className="flex-1 text-sm text-text-info"
            >
              Detailed counting rules and data dates
            </AppText>

            <MaterialCommunityIcons
              name={showRules ? "chevron-up" : "chevron-down"}
              size={22}
              color={theme.extends.colors.text.secondary}
              accessible={false}
            />
          </Pressable>

          {showRules && (
            <View className="gap-4 pb-4 pt-2">
              <View className="gap-1">
                <AppText
                  weight="semibold"
                  className="text-sm text-text-primary"
                >
                  Visits and saves
                </AppText>

                <AppText className="text-sm leading-6 text-text-secondary">
                  Each account&apos;s visits and saves are each recorded at most
                  once per business per UTC day. Visitor accounts are counted
                  once across the selected period.
                </AppText>
              </View>

              <View className="gap-1">
                <AppText
                  weight="semibold"
                  className="text-sm text-text-primary"
                >
                  Reviews and replies
                </AppText>

                <AppText className="text-sm leading-6 text-text-secondary">
                  New reviews were created during the selected dates and are
                  still published. Replies are counted through the report
                  cutoff, even if they were made after those dates. Earlier
                  counts can change when records no longer qualify.
                </AppText>

                {report && (
                  <AppText className="text-xs leading-5 text-text-secondary">
                    Replies checked through{" "}
                    {formatAnalyticsTimestamp(report.reviews.reply_cutoff)} ·
                    Manila time.
                  </AppText>
                )}

                {report &&
                  report.reviews.excluded_reply_timestamp_count > 0 && (
                    <AppText className="text-xs leading-5 text-text-secondary">
                      Replies with unusable timing data are excluded from reply
                      counts.
                    </AppText>
                  )}

                <AppText className="text-xs leading-5 text-text-secondary">
                  A dash indicates an unavailable reply percentage, not 0%.
                </AppText>
              </View>

              <View className="gap-1">
                <AppText
                  weight="semibold"
                  className="text-sm text-text-primary"
                >
                  Vouches
                </AppText>

                <AppText className="text-sm leading-6 text-text-secondary">
                  Vouches added counts vouches created during the selected dates
                  that still count for currently active specialties. The badge
                  shows the absolute difference from the previous equal-duration
                  period, using the same reporting cutoff. Both counts can
                  change after removal, invalidation, or specialty deactivation.
                  One account may vouch for multiple specialties; these are
                  vouches, not distinct supporters or net growth.
                </AppText>
              </View>

              <View className="gap-1">
                <AppText
                  weight="semibold"
                  className="text-sm text-text-primary"
                >
                  Latest recorded activity
                </AppText>

                <AppText className="text-sm leading-6 text-text-secondary">
                  {visibility?.data_through
                    ? `Visit and save data available through ${formatAnalyticsTimestamp(
                        visibility.data_through,
                      )} · Manila time.`
                    : "The latest visit and save data time could not be verified."}
                </AppText>
              </View>
            </View>
          )}
        </View>
      </BottomSheetScrollView>
    </BottomSheetModal>
  );
}
