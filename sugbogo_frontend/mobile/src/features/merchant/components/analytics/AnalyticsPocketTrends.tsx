import { AnalyticsChartSkeleton } from "./AnalyticsLoadingSkeletons";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import type { BottomSheetModal } from "@gorhom/bottom-sheet";
import type { ComponentProps } from "react";
import { useRef } from "react";
import { View, useWindowDimensions } from "react-native";

import { theme } from "@/constants/theme";
import AppText from "@/shared/components/AppText";
import ErrorState from "@/shared/components/ErrorState";
import Skeleton from "@/shared/components/Skeleton";
import SelectionBottomSheet from "@/shared/components/bottom-sheets/SelectionBottomSheet";

import type { MerchantAnalyticsPeriod } from "../../types/merchantAnalytics.types";
import type { PlusPocketReport } from "../../types/merchantPlusAnalytics.types";
import { formatAnalyticsCount } from "../../utils/merchantAnalytics.utils";

import AnalyticsHeaderControls from "./AnalyticsHeaderControls";
import AnalyticsEventTrend from "./AnalyticsEventTrend";
import AnalyticsPocketMeasurementSheet from "./AnalyticsPocketMeasurementSheet";

type Props = {
  report?: PlusPocketReport;
  retry: () => void;
  loading?: boolean;
};

type PocketMetricCardProps = {
  icon: ComponentProps<typeof MaterialCommunityIcons>["name"];
  label: string;
  value: number | null;
  detail: string;
  stacked: boolean;
  loading?: boolean;
};

/**
 * Displays a Pocket activity metric using the same compact
 * card styling and number hierarchy as Business Overview.
 *
 * Distinguishes unavailable measurements from recorded zero.
 */
function PocketMetricCard({
  icon,
  label,
  value,
  detail,
  stacked,
  loading = false,
}: PocketMetricCardProps) {
  return (
    <View
      accessible
      accessibilityLabel={`${label}: ${
        loading
          ? "Loading"
          : value === null
            ? "Unavailable"
            : formatAnalyticsCount(value)
      }. ${detail}`}
      className={`min-w-0 rounded-card bg-surface-muted p-4 ${
        stacked ? "w-full" : "flex-1"
      }`}
    >
      {/* Metric heading and supporting icon */}
      <View className="flex-row items-start justify-between gap-2">
        <AppText
          weight="medium"
          className="min-w-0 flex-1 text-sm leading-5 text-text-secondary"
        >
          {label}
        </AppText>

        <MaterialCommunityIcons
          name={icon}
          size={18}
          color={theme.extends.colors.text.secondary}
          accessible={false}
        />
      </View>

      {/* Primary count and brief definition */}
      <View className="mt-2 gap-1">
        {loading ? (
          <Skeleton className="h-9 w-16 rounded" />
        ) : (
          <AppText
            weight="semibold"
            className={`text-3xl tabular-nums ${
              value === null ? "text-text-secondary" : "text-text-primary"
            }`}
          >
            {formatAnalyticsCount(value)}
          </AppText>
        )}

        <AppText className="text-xs leading-5 text-text-secondary">
          {detail}
        </AppText>
      </View>
    </View>
  );
}

/**
 * Presents recorded Pocket save activity through two independent
 * KPI cards and a calendar-aware weekly activity chart.
 *
 * Preserves existing analytics values, coverage notices,
 * unavailable states, and on-demand measurement explanations.
 */
export default function AnalyticsPocketTrends({
  report,
  retry,
  loading = false,
}: Props) {
  const { width, fontScale } = useWindowDimensions();
  const stacked = width < 360 || fontScale >= 1.35;

  const pending = loading && !report;
  const saves = report?.metrics.saves;
  const distinct = report?.metrics.distinct_savers;

  const currentSource = saves?.sources.current;

  const hasReadLimitations = currentSource?.partial_reasons.some((reason) =>
    [
      "total_read_unavailable",
      "series_read_unavailable",
      "visibility_read_unavailable",
    ].includes(reason),
  );

  return (
    <>
      <View className="gap-5">
        {/* Two KPI cards matching the main Business Overview style */}
        <View className="gap-3">
          <View className={stacked ? "gap-3" : "flex-row gap-3"}>
            <PocketMetricCard
              icon="bookmark-outline"
              label="Recorded saves"
              value={saves?.value ?? null}
              loading={pending}
              detail="During selected dates"
              stacked={stacked}
            />

            <PocketMetricCard
              icon="account-multiple-outline"
              label="Saving accounts"
              value={distinct?.value ?? null}
              loading={pending}
              detail="Distinct explorer accounts"
              stacked={stacked}
            />
          </View>
        </View>

        {/* Independent recovery for the saving-accounts metric */}
        {!pending && distinct?.value === null ? (
          <ErrorState
            variant="analytics"
            title="Saving accounts unavailable"
            description="Recorded save activity may still be available."
            primaryActionTitle="Retry"
            onPrimaryAction={retry}
          />
        ) : null}

        {/* Weekly save activity and chart */}
        <View className="gap-3 border-t border-border-primary/60 pt-5">
          <View className="gap-1">
            <AppText weight="bold" className="text-base text-text-primary">
              Saves over time
            </AppText>

            <AppText className="text-sm leading-5 text-text-secondary">
              Recorded save activity by{" "}
              {report?.interval === "daily" ? "day" : "week"}
            </AppText>
          </View>

          {pending ? (
            <AnalyticsChartSkeleton />
          ) : saves && report ? (
            <AnalyticsEventTrend
              metric={saves}
              label="Recorded saves"
              interval={report.interval}
              variant="line"
              retry={retry}
              showTotal={false}
              showContext={false}
            />
          ) : null}
        </View>

        {/* Read failures stay visible; routine coverage details live in the information sheet. */}
        {hasReadLimitations && (
          <View className="flex-row items-start gap-2">
            <MaterialCommunityIcons
              name="information-outline"
              size={17}
              color={theme.extends.colors.text.secondary}
              accessible={false}
            />

            <View className="min-w-0 flex-1 gap-1">
              {hasReadLimitations && (
                <AppText className="text-xs leading-5 text-text-secondary">
                  Some figures could not be loaded. Available measurements are
                  shown.
                </AppText>
              )}
            </View>
          </View>
        )}
      </View>
    </>
  );
}

const POCKET_PERIOD_OPTIONS = [
  { label: "Last 7 days", value: "7" },
  { label: "Last 30 days", value: "30" },
  { label: "Last 90 days", value: "90" },
];

/** Keeps the overview's compact period and information actions usable throughout report loading. */
export function AnalyticsPocketHeader({
  period,
  onPeriodChange,
  report,
  title = "Save activity",
}: {
  period: MerchantAnalyticsPeriod;
  onPeriodChange: (period: MerchantAnalyticsPeriod) => void;
  report?: PlusPocketReport;
  title?: string;
}) {
  const periodSheetRef = useRef<BottomSheetModal>(null);
  const measurementSheetRef = useRef<BottomSheetModal>(null);
  return (
    <>
      <View className="gap-1">
        <View className="flex-row items-center justify-between gap-3">
          <AppText
            weight="bold"
            accessibilityRole="header"
            className="min-w-0 flex-1 text-base text-text-primary"
          >
            {title}
          </AppText>
          <AnalyticsHeaderControls
            period={period}
            onOpenPeriod={() => periodSheetRef.current?.present()}
            onOpenInformation={() => measurementSheetRef.current?.present()}
            informationLabel="About Pocket activity"
            informationHint="Opens measurement definitions for saves and saving accounts"
          />
        </View>
        <AppText className="text-sm leading-5 text-text-secondary">
          How explorers saved your business
        </AppText>
      </View>
      {/* Reuse the exact overview selection sheet and its own dismissal behavior. */}
      <SelectionBottomSheet
        sheetRef={periodSheetRef}
        title="Reporting period"
        description="Choose a time range for this section."
        options={POCKET_PERIOD_OPTIONS}
        selectedValue={period}
        onSelect={(value) => {
          if (value === "7" || value === "30" || value === "90")
            onPeriodChange(value);
        }}
        snapPoints={["50%"]}
      />
      <AnalyticsPocketMeasurementSheet
        sheetRef={measurementSheetRef}
        report={report}
      />
    </>
  );
}
