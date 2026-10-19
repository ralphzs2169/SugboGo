import { MaterialCommunityIcons } from "@expo/vector-icons";
import {
  BottomSheetBackdrop,
  BottomSheetModal,
  BottomSheetScrollView,
  type BottomSheetBackdropProps,
} from "@gorhom/bottom-sheet";
import { useCallback, useMemo, useState, type RefObject } from "react";
import { View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { theme } from "@/constants/theme";
import AppText from "@/shared/components/AppText";
import SafePressable from "@/shared/components/SafePressable";

import type { RoutePlanningAnalytics } from "../../types/routePlanningAnalytics.types";
import { formatAnalyticsTimestamp } from "../../utils/merchantAnalytics.utils";

type Props = {
  sheetRef: RefObject<BottomSheetModal | null>;
  report?: RoutePlanningAnalytics;
};

const SNAP_POINTS = ["70%", "90%"];

/**
 * Explains recorded route-planning interest through a concise
 * measurement guide and expandable technical details.
 *
 * Uses the established Gorhom sheet pattern, distinguishes route
 * requests from physical visits, and preserves tracking limitations.
 */
export default function AnalyticsRoutePlanningSheet({
  sheetRef,
  report,
}: Props) {
  const insets = useSafeAreaInsets();
  const [showDetails, setShowDetails] = useState(false);

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
      backdropComponent={renderBackdrop}
      backgroundStyle={backgroundStyle}
      handleIndicatorStyle={handleIndicatorStyle}
      onDismiss={() => setShowDetails(false)}
    >
      <BottomSheetScrollView
        contentContainerClassName="px-5 pt-2"
        contentContainerStyle={{
          paddingBottom: Math.max(insets.bottom, 20) + 16,
        }}
        showsVerticalScrollIndicator={false}
      >
        {/* Sheet header and dismissal */}
        <View className="mb-5 flex-row items-start justify-between gap-3">
          <View className="min-w-0 flex-1 pr-2">
            <AppText
              weight="bold"
              accessibilityRole="header"
              className="text-xl text-text-primary"
            >
              About route-planning activity
            </AppText>

            <AppText className="mt-1 text-sm leading-5 text-text-secondary">
              Understand what direction requests mean
            </AppText>
          </View>

          <SafePressable
            onPress={closeSheet}
            accessibilityRole="button"
            accessibilityLabel="Close route-planning information"
            className="h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-full active:bg-surface-muted"
          >
            <MaterialCommunityIcons
              name="close"
              size={23}
              color={theme.extends.colors.text.secondary}
              accessible={false}
            />
          </SafePressable>
        </View>

        {/* Primary interpretation: interest does not confirm arrivals */}
        <View className="flex-row items-start gap-3 rounded-2xl bg-surface-muted p-4">
          <View className="h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-surface">
            <MaterialCommunityIcons
              name="map-marker-path"
              size={23}
              color={theme.extends.colors.brand}
              accessible={false}
            />
          </View>

          <View className="min-w-0 flex-1 gap-1">
            <AppText weight="bold" className="text-base text-text-primary">
              Interest, not confirmed visits
            </AppText>

            <AppText className="text-sm leading-6 text-text-secondary">
              These numbers show requests for directions to your business. They
              don't confirm that someone arrived or completed a journey.
            </AppText>
          </View>
        </View>

        {/* Concise measurement concepts */}
        <View className="mt-5 gap-5">
          <View className="flex-row items-start gap-3">
            <View className="h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-surface-muted">
              <MaterialCommunityIcons
                name="routes"
                size={22}
                color={theme.extends.colors.text.secondary}
                accessible={false}
              />
            </View>

            <View className="min-w-0 flex-1 gap-1">
              <AppText weight="semibold" className="text-sm text-text-primary">
                Navigation methods
              </AppText>

              <AppText className="text-sm leading-6 text-text-secondary">
                Road Route and Jeepney guidance are counted separately when
                explorers request directions.
              </AppText>
            </View>
          </View>

          <View className="flex-row items-start gap-3">
            <View className="h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-surface-muted">
              <MaterialCommunityIcons
                name="account-multiple-outline"
                size={22}
                color={theme.extends.colors.text.secondary}
                accessible={false}
              />
            </View>

            <View className="min-w-0 flex-1 gap-1">
              <AppText weight="semibold" className="text-sm text-text-primary">
                Explorer accounts
              </AppText>

              <AppText className="text-sm leading-6 text-text-secondary">
                Each signed-in explorer is counted once across the selected
                period, even when they request both navigation methods.
              </AppText>
            </View>
          </View>

          <View className="flex-row items-start gap-3">
            <View className="h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-surface-muted">
              <MaterialCommunityIcons
                name="shield-outline"
                size={22}
                color={theme.extends.colors.text.secondary}
                accessible={false}
              />
            </View>

            <View className="min-w-0 flex-1 gap-1">
              <AppText weight="semibold" className="text-sm text-text-primary">
                Tracking coverage
              </AppText>

              <AppText className="text-sm leading-6 text-text-secondary">
                Some requests may not be recorded. These totals reflect the
                activity available to SugboGo, not every possible navigation
                request.
              </AppText>
            </View>
          </View>
        </View>

        {/* Expandable counting rules and data limitations */}
        <View className="mt-5 border-t border-border-primary pt-2">
          <SafePressable
            onPress={() => setShowDetails((current) => !current)}
            accessibilityRole="button"
            accessibilityLabel={
              showDetails
                ? "Hide detailed counting rules and data coverage"
                : "Show detailed counting rules and data coverage"
            }
            accessibilityState={{ expanded: showDetails }}
            className="min-h-12 flex-row cursor-pointer items-center justify-between gap-3 py-3 active:opacity-70"
          >
            <View className="min-w-0 flex-1 flex-row items-center gap-2">
              <MaterialCommunityIcons
                name="information-outline"
                size={20}
                color={theme.extends.colors.text.secondary}
                accessible={false}
              />

              <AppText
                weight="semibold"
                className="min-w-0 flex-1 text-sm text-text-primary"
              >
                Detailed rules and sources
              </AppText>
            </View>

            <MaterialCommunityIcons
              name={showDetails ? "chevron-up" : "chevron-down"}
              size={21}
              color={theme.extends.colors.text.secondary}
              accessible={false}
            />
          </SafePressable>

          {showDetails && (
            <View className="gap-5 pb-4 pt-3">
              {/* Event deduplication */}
              <View className="gap-1">
                <AppText
                  weight="semibold"
                  className="text-sm text-text-primary"
                >
                  How requests are counted
                </AppText>

                <AppText className="text-sm leading-6 text-text-secondary">
                  Each account can contribute one recorded request per business,
                  navigation method, and UTC day. Requesting both methods may
                  count as two requests.
                </AppText>
              </View>

              {/* Intentional interaction requirements */}
              <View className="gap-1">
                <AppText
                  weight="semibold"
                  className="text-sm text-text-primary"
                >
                  What doesn't count
                </AppText>

                <AppText className="text-sm leading-6 text-text-secondary">
                  Changing a starting point, refreshing guidance, or moving the
                  map does not create another request. Your own requests are
                  excluded.
                </AppText>
              </View>

              {/* Reporting coverage */}
              <View className="gap-1">
                <AppText
                  weight="semibold"
                  className="text-sm text-text-primary"
                >
                  Reporting and availability
                </AppText>

                <AppText className="text-sm leading-6 text-text-secondary">
                  Reporting periods use Manila time. Guest activity is not
                  counted, and network failures or older app versions may leave
                  some requests unrecorded.
                </AppText>

                <AppText className="text-sm leading-6 text-text-secondary">
                  Tracking coverage is not verified, so these counts cannot
                  reliably establish business growth.
                </AppText>
              </View>

              {/* Tracking start date, when available */}
              {report?.tracking_started_at && (
                <View className="gap-1">
                  <AppText
                    weight="semibold"
                    className="text-sm text-text-primary"
                  >
                    Tracking started
                  </AppText>

                  <AppText className="text-sm leading-6 text-text-secondary">
                    {formatAnalyticsTimestamp(report.tracking_started_at)} ·
                    Manila time
                  </AppText>

                  <AppText className="text-xs leading-5 text-text-secondary">
                    Activity before tracking began is unavailable.
                  </AppText>
                </View>
              )}
            </View>
          )}
        </View>
      </BottomSheetScrollView>
    </BottomSheetModal>
  );
}
