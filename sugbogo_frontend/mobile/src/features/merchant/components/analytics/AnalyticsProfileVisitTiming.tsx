import { AnalyticsHeatmapSkeleton } from "./AnalyticsLoadingSkeletons";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import type { BottomSheetModal } from "@gorhom/bottom-sheet";
import { useRef } from "react";
import { View } from "react-native";
import { theme } from "@/constants/theme";
import AppText from "@/shared/components/AppText";
import ErrorState from "@/shared/components/ErrorState";
import Skeleton from "@/shared/components/Skeleton";
import SelectionBottomSheet from "@/shared/components/bottom-sheets/SelectionBottomSheet";
import type { MerchantAnalyticsPeriod } from "../../types/merchantAnalytics.types";
import type { PlusProfileTimingReport } from "../../types/merchantAdvancedAnalytics.types";
import { formatAnalyticsCount } from "../../utils/merchantAnalytics.utils";
import AnalyticsHeaderControls from "./AnalyticsHeaderControls";
import AnalyticsChartEmptyState from "./AnalyticsChartEmptyState";
import AnalyticsTimingHeatmap from "./AnalyticsTimingHeatmap";
import AnalyticsTimingMeasurementSheet from "./AnalyticsTimingMeasurementSheet";

const PERIOD_OPTIONS = [
  { label: "Last 7 days", value: "7" },
  { label: "Last 30 days", value: "30" },
  { label: "Last 90 days", value: "90" },
];

/** Keeps timing controls and report structure visible while the selected period loads. */
export default function AnalyticsProfileVisitTiming({
  report,
  retry,
  period = "30",
  onPeriodChange,
  loading = false,
  error,
}: {
  report?: PlusProfileTimingReport;
  retry: () => void;
  period?: MerchantAnalyticsPeriod;
  onPeriodChange?: (period: MerchantAnalyticsPeriod) => void;
  loading?: boolean;
  error?: unknown;
}) {
  const periodSheetRef = useRef<BottomSheetModal>(null);
  const measurementSheetRef = useRef<BottomSheetModal>(null);
  const pending = loading && !report;
  return (
    <>
      {/* Compact controls follow Pocket trends and stay available through transitions. */}
      <View className="gap-5">
        <View className="gap-1">
          <View className="flex-row items-center justify-between gap-3">
            <AppText
              weight="bold"
              accessibilityRole="header"
              className="min-w-0 flex-1 text-base text-text-primary"
            >
              Visit timing
            </AppText>
            <AnalyticsHeaderControls
              period={period}
              onOpenPeriod={() => periodSheetRef.current?.present()}
              onOpenInformation={() => measurementSheetRef.current?.present()}
              informationLabel="About visit timing"
              informationHint="Opens information about recorded profile visits by day and hour"
            />
          </View>
          <AppText className="text-sm leading-5 text-text-secondary">
            When explorers opened your profile
          </AppText>
        </View>
        <View className="min-w-0 rounded-card bg-surface-muted p-4">
          <View className="flex-row items-start justify-between gap-2">
            <AppText
              weight="medium"
              className="min-w-0 flex-1 text-sm leading-5 text-text-secondary"
            >
              Recorded profile visits
            </AppText>
            <MaterialCommunityIcons
              name="clock-outline"
              size={18}
              color={theme.extends.colors.text.secondary}
              accessible={false}
            />
          </View>
          <View className="mt-2 gap-1">
            {pending ? (
              <Skeleton className="h-9 w-24 rounded" />
            ) : (
              <AppText
                accessibilityLabel={`Timing profile visits: ${report?.total_profile_visits ?? "Unavailable"}`}
                weight="semibold"
                className={`text-3xl tabular-nums ${report?.total_profile_visits == null ? "text-text-secondary" : "text-text-primary"}`}
              >
                {formatAnalyticsCount(report?.total_profile_visits ?? null)}
              </AppText>
            )}
            <AppText className="text-xs leading-5 text-text-secondary">
              During selected dates
            </AppText>
          </View>
        </View>

        {/* One heatmap replaces repeated weekday filtering and long hourly rows. */}
        <View className="gap-3 border-t border-border-primary/60 pt-5">
          <AppText weight="bold" className="text-base text-text-primary">
            Visits by day and hour
          </AppText>
          <AppText className="text-sm text-text-secondary">
            Philippine time
          </AppText>
          {pending && <AnalyticsHeatmapSkeleton />}
          {Boolean(error) && (
            <ErrorState
              variant="analytics"
              title={
                report
                  ? "Unable to refresh visit timing"
                  : "Unable to load visit timing"
              }
              description={
                report
                  ? "Previously loaded values are still shown."
                  : "Please try this report again."
              }
              primaryActionTitle="Retry"
              onPrimaryAction={retry}
            />
          )}
          {report &&
            (report.display_state === "visibility_unavailable" ? (
              <ErrorState
                variant="analytics"
                primaryActionTitle="Retry"
                title="Profile-visit timing unavailable"
                description="Recorded visit data could not be loaded."
                icon="cloud-off-outline"
                onPrimaryAction={retry}
              />
            ) : report.display_state === "zero_recorded_visits" ? (
              <AnalyticsChartEmptyState
                title="No recorded profile visits in this period"
                description="No online profile visits were recorded during these dates."
                icon="clock-outline"
              />
            ) : (
              <AnalyticsTimingHeatmap
                key={`${report.business.id}-${period}`}
                report={report}
              />
            ))}
        </View>
      </View>
      {/* Both sheets remain mounted independently of report availability. */}
      <SelectionBottomSheet
        sheetRef={periodSheetRef}
        title="Reporting period"
        description="Choose a time range for this section."
        options={PERIOD_OPTIONS}
        selectedValue={period}
        onSelect={(value) => {
          if (value === "7" || value === "30" || value === "90")
            onPeriodChange?.(value);
        }}
        snapPoints={["50%"]}
      />
      <AnalyticsTimingMeasurementSheet
        sheetRef={measurementSheetRef}
        report={report}
      />
    </>
  );
}
