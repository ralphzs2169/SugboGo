import { MaterialCommunityIcons } from "@expo/vector-icons";
import {
  BottomSheetBackdrop,
  BottomSheetModal,
  BottomSheetScrollView,
  type BottomSheetBackdropProps,
} from "@gorhom/bottom-sheet";
import { useCallback, type RefObject } from "react";
import { View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { theme } from "@/constants/theme";
import AppText from "@/shared/components/AppText";
import SafePressable from "@/shared/components/SafePressable";
import type { RoutePlanningAnalytics } from "../../types/routePlanningAnalytics.types";
import { formatAnalyticsTimestamp } from "../../utils/merchantAnalytics.utils";

/** Explains route intent using the established analytics measurement-sheet pattern. */
export default function AnalyticsRoutePlanningSheet({
  sheetRef,
  report,
}: {
  sheetRef: RefObject<BottomSheetModal | null>;
  report?: RoutePlanningAnalytics;
}) {
  const insets = useSafeAreaInsets();
  const backdrop = useCallback(
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

  return (
    <BottomSheetModal
      ref={sheetRef}
      snapPoints={["65%"]}
      topInset={insets.top}
      enableDynamicSizing={false}
      enablePanDownToClose
      backdropComponent={backdrop}
      backgroundStyle={{
        backgroundColor: theme.extends.colors.surface,
        borderRadius: 24,
      }}
      handleIndicatorStyle={{
        backgroundColor: theme.extends.colors.text.disabled,
        width: 40,
      }}
    >
      <BottomSheetScrollView
        contentContainerClassName="px-5 pt-2"
        contentContainerStyle={{
          paddingBottom: Math.max(insets.bottom, 20) + 16,
        }}
      >
        {/* Measurement identity and dismissal */}
        <View className="mb-5 flex-row items-start justify-between gap-3">
          <AppText
            weight="bold"
            accessibilityRole="header"
            className="min-w-0 flex-1 text-xl text-text-primary"
          >
            About route-planning activity
          </AppText>
          <SafePressable
            onPress={() => sheetRef.current?.dismiss()}
            accessibilityRole="button"
            accessibilityLabel="Close route-planning information"
            className="h-11 w-11 items-center justify-center rounded-full active:bg-surface-muted"
          >
            <MaterialCommunityIcons
              accessible={false}
              name="close"
              size={23}
              color={theme.extends.colors.text.secondary}
            />
          </SafePressable>
        </View>
        {/* Plain-language definitions retain the backend measurement limits. */}
        <View className="gap-4">
          <AppText className="text-sm leading-6 text-text-secondary">
            These are requests to open Road Route or Jeepney guidance. They do
            not confirm that someone visited your business or completed a
            journey.
          </AppText>
          <AppText className="text-sm leading-6 text-text-secondary">
            Each signed-in account can count once per business, navigation
            method and UTC day. Using both methods can count as two requests,
            but the account is counted only once in Explorer accounts.
          </AppText>
          <AppText className="text-sm leading-6 text-text-secondary">
            Reporting dates use Manila time. Your own requests are excluded.
            Guest activity is not counted, and network failures or older app
            versions can leave requests unrecorded.
          </AppText>
          <AppText className="text-sm leading-6 text-text-secondary">
            Changing a starting point, refreshing guidance or moving the map
            does not add a request. Counts describe recorded activity; tracking
            coverage is not verified and no growth comparison is available.
          </AppText>
          {report?.tracking_started_at ? (
            <AppText className="text-sm leading-6 text-text-secondary">
              Collection began{" "}
              {formatAnalyticsTimestamp(report.tracking_started_at)} Manila
              time. Earlier activity is unavailable.
            </AppText>
          ) : null}
        </View>
      </BottomSheetScrollView>
    </BottomSheetModal>
  );
}
