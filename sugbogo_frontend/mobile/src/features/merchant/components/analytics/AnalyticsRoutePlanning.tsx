import { MaterialCommunityIcons } from "@expo/vector-icons";
import type { BottomSheetModal } from "@gorhom/bottom-sheet";
import { useRef } from "react";
import { View, useWindowDimensions, type TextStyle } from "react-native";
import Svg, { Circle, G } from "react-native-svg";

import { theme } from "@/constants/theme";
import AppText from "@/shared/components/AppText";
import ErrorState from "@/shared/components/ErrorState";
import Skeleton from "@/shared/components/Skeleton";

import type { MerchantAnalyticsPeriod } from "../../types/merchantAnalytics.types";
import type { RoutePlanningAnalytics } from "../../types/routePlanningAnalytics.types";
import { formatAnalyticsCount } from "../../utils/merchantAnalytics.utils";

import AnalyticsChartEmptyState from "./AnalyticsChartEmptyState";
import AnalyticsHeaderControls from "./AnalyticsHeaderControls";
import AnalyticsOverviewSection from "./AnalyticsOverviewSection";
import AnalyticsRoutePlanningSheet from "./AnalyticsRoutePlanningSheet";

type Props = {
  period: MerchantAnalyticsPeriod;
  onOpenPeriod: () => void;
  data?: RoutePlanningAnalytics;
  loading: boolean;
  error: unknown;
  onRetry: () => void;
};

const DONUT_SIZE = 132;
const DONUT_STROKE = 14;
const DONUT_GAP = 4;

const METHOD_COLORS = {
  road: theme.extends.colors.brand,
  jeepney: "#698CAD",
} as const;

const PANEL_SHADOW = {
  shadowColor: "#000",
  shadowOpacity: 0.05,
  shadowRadius: 10,
  shadowOffset: { width: 0, height: 2 },
  elevation: 1,
} as const;

const TABULAR_NUMBERS: TextStyle = {
  fontVariant: ["tabular-nums"],
};

function formatPercent(value: number) {
  return `${value.toFixed(1)}%`;
}

type RoutePlanningDonutProps = {
  total: number;
  roadCount: number;
  jeepneyCount: number;
};

/**
 * Displays the distribution of recorded route requests as a donut.
 *
 * Uses consistent method colors, proportional segments, and a
 * centered total. Separates segments only when both methods
 * contain recorded requests.
 */
function RoutePlanningDonut({
  total,
  roadCount,
  jeepneyCount,
}: RoutePlanningDonutProps) {
  const center = DONUT_SIZE / 2;
  const radius = (DONUT_SIZE - DONUT_STROKE) / 2;
  const circumference = 2 * Math.PI * radius;

  const roadLength = total > 0 ? circumference * (roadCount / total) : 0;

  const jeepneyLength = total > 0 ? circumference * (jeepneyCount / total) : 0;

  const gap = roadLength > 0 && jeepneyLength > 0 ? DONUT_GAP : 0;

  const trackColor = theme.extends.colors.surfaceMuted ?? "#F3F4F6";

  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={`Route-planning breakdown. ${roadCount} Road Route requests and ${jeepneyCount} Jeepney guidance requests out of ${total} total recorded requests.`}
      className="items-center justify-center"
      style={{
        width: DONUT_SIZE,
        height: DONUT_SIZE,
      }}
    >
      {/* Donut track and colored navigation-method segments */}
      <Svg width={DONUT_SIZE} height={DONUT_SIZE} accessible={false}>
        <G rotation="-90" origin={`${center}, ${center}`}>
          <Circle
            cx={center}
            cy={center}
            r={radius}
            stroke={trackColor}
            strokeWidth={DONUT_STROKE}
            fill="none"
          />

          {roadLength > 0 ? (
            <Circle
              cx={center}
              cy={center}
              r={radius}
              stroke={METHOD_COLORS.road}
              strokeWidth={DONUT_STROKE}
              fill="none"
              strokeDasharray={`${Math.max(
                roadLength - gap,
                0,
              )} ${circumference}`}
            />
          ) : null}

          {jeepneyLength > 0 ? (
            <Circle
              cx={center}
              cy={center}
              r={radius}
              stroke={METHOD_COLORS.jeepney}
              strokeWidth={DONUT_STROKE}
              fill="none"
              strokeDasharray={`${Math.max(
                jeepneyLength - gap,
                0,
              )} ${circumference}`}
              strokeDashoffset={-roadLength}
            />
          ) : null}
        </G>
      </Svg>

      {/* Centered total recorded requests */}
      <View className="absolute items-center px-6">
        <AppText
          weight="semibold"
          className="text-2xl text-text-primary"
          style={TABULAR_NUMBERS}
        >
          {formatAnalyticsCount(total)}
        </AppText>

        <AppText className="text-xs text-text-secondary">Requests</AppText>
      </View>
    </View>
  );
}

type MethodLegendRowProps = {
  label: string;
  count: number | null;
  color: string;
  percent?: number | null;
  divider?: boolean;
};

/**
 * Identifies a donut segment using a clearly visible color
 * swatch, method label, exact count, and optional percentage.
 *
 * Uses explicit React Native dimensions for reliable swatch
 * rendering on Android and iOS.
 */

/**
 * Displays a compact navigation-method legend with a small
 * matching color indicator, exact count, and percentage.
 *
 * Keeps values right-aligned beside the donut chart.
 */
function MethodLegendRow({
  label,
  count,
  color,
  percent = null,
  divider = false,
}: MethodLegendRowProps) {
  return (
    <View
      accessible
      accessibilityLabel={`${label}: ${
        count ?? "Unavailable"
      } recorded requests${
        percent !== null ? `, ${formatPercent(percent)}` : ""
      }`}
      className={`flex-row items-center justify-between gap-2 py-2.5 ${
        divider ? "border-t border-border-primary/60" : ""
      }`}
    >
      {/* Compact legend indicator and method label */}
      <View className="min-w-0 flex-1 flex-row items-center gap-2">
        <View
          accessible={false}
          style={{
            width: 10,
            height: 10,
            borderRadius: 3,
            backgroundColor: color,
            flexShrink: 0,
          }}
        />

        <AppText className="min-w-0 flex-1 text-sm text-text-secondary">
          {label}
        </AppText>
      </View>

      {/* Right-aligned count and percentage */}
      <View className="shrink-0 items-end">
        <AppText
          weight="semibold"
          className="text-sm text-text-primary"
          style={TABULAR_NUMBERS}
        >
          {formatAnalyticsCount(count)}
        </AppText>

        {percent !== null && (
          <AppText
            className="text-xs text-text-secondary"
            style={TABULAR_NUMBERS}
          >
            {formatPercent(percent)}
          </AppText>
        )}
      </View>
    </View>
  );
}

type SupportingMetricRowProps = {
  label: string;
  count: number | null;
  divider?: boolean;
};

/**
 * Displays a supporting analytics count separately from the
 * donut's navigation-method distribution.
 */
function SupportingMetricRow({
  label,
  count,
  divider = false,
}: SupportingMetricRowProps) {
  return (
    <View
      accessible
      accessibilityLabel={`${label}: ${count ?? "Unavailable"}`}
      className={`flex-row items-center justify-between gap-3 py-3 ${
        divider ? "border-t border-border-primary/60" : ""
      }`}
    >
      {/* Supporting metric name */}
      <AppText className="min-w-0 flex-1 text-sm text-text-secondary">
        {label}
      </AppText>

      {/* Exact supporting count */}
      <AppText
        weight="semibold"
        className="text-sm text-text-primary"
        style={TABULAR_NUMBERS}
      >
        {formatAnalyticsCount(count)}
      </AppText>
    </View>
  );
}

/**
 * Presents recorded route-planning activity for a merchant.
 *
 * Shows a proportional donut with a matching, accessible method
 * legend and distinct explorer accounts. Preserves independent
 * loading, retry, unavailable, partial-coverage, and zero states.
 */
export default function AnalyticsRoutePlanning({
  period,
  onOpenPeriod,
  data,
  loading,
  error,
  onRetry,
}: Props) {
  const sheetRef = useRef<BottomSheetModal>(null);

  const { width, fontScale } = useWindowDimensions();

  const stacked = width < 360 || fontScale >= 1.3;

  const unavailable = data?.meta.availability === "unavailable";

  const reasons = data?.meta.partial_reasons ?? [];

  const uninitialized = reasons.some((reason) =>
    [
      "route_intent_collection_missing",
      "route_tracking_not_initialized",
    ].includes(reason),
  );

  const beforeTracking = reasons.includes("tracking_not_started_in_period");

  const partialCounts =
    !!data &&
    !unavailable &&
    [
      data.total_requests,
      data.distinct_explorer_accounts,
      data.road_route_requests,
      data.jeepney_requests,
    ].some((value) => value === null);

  const canRenderDonut =
    !!data &&
    !unavailable &&
    data.total_requests !== null &&
    data.total_requests > 0 &&
    data.road_route_requests !== null &&
    data.jeepney_requests !== null;

  const totalRequests = data?.total_requests ?? null;
  const roadCount = data?.road_route_requests ?? null;
  const jeepneyCount = data?.jeepney_requests ?? null;

  const roadPercent =
    canRenderDonut && totalRequests ? (roadCount! / totalRequests) * 100 : null;

  const jeepneyPercent =
    canRenderDonut && totalRequests
      ? (jeepneyCount! / totalRequests) * 100
      : null;

  return (
    <>
      <AnalyticsOverviewSection
        title="Route-planning activity"
        description="How explorers requested directions"
        accessory={
          <AnalyticsHeaderControls
            period={period}
            onOpenPeriod={onOpenPeriod}
            onOpenInformation={() => sheetRef.current?.present()}
            informationLabel="About route-planning activity"
            informationHint="Opens measurement definitions and limitations"
          />
        }
      >
        {/* Initial loading state */}
        {loading && !data && !error ? (
          <View
            accessibilityLabel="Loading route-planning activity"
            accessibilityState={{ busy: true }}
            className="gap-4"
          >
            <Skeleton className="h-44 w-full rounded-card" />
            <Skeleton className="h-12 w-full rounded-card" />
          </View>
        ) : null}

        {/* Independent request recovery */}
        {error ? (
          <ErrorState
            size="section"
            title={
              data
                ? "Unable to refresh route-planning activity"
                : "Unable to load route-planning activity"
            }
            description={
              data
                ? "Previously loaded activity is still shown."
                : "Please try this section again."
            }
            primaryActionTitle="Retry"
            onPrimaryAction={onRetry}
          />
        ) : null}

        {/* Route-planning report and its availability states */}
        {data ? (
          <View className="gap-3">
            {unavailable && !uninitialized && !beforeTracking ? (
              /* Temporary source failure */
              <ErrorState
                size="section"
                title="Route-planning data unavailable"
                description="We couldn't read recorded guidance activity. Please try again."
                primaryActionTitle="Retry"
                onPrimaryAction={onRetry}
              />
            ) : unavailable ? (
              /* Tracking unavailable for the requested period */
              <AnalyticsChartEmptyState
                compact
                icon="map-marker-path"
                title={
                  uninitialized
                    ? "Route tracking hasn't been initialized yet"
                    : "No tracking history for these dates"
                }
                description={
                  uninitialized
                    ? "Route-planning activity will be available after tracking is set up on the server."
                    : "Tracking had not started during these dates."
                }
              />
            ) : data.total_requests === 0 ? (
              /* Known zero activity without a misleading donut */
              <View
                className="rounded-card border border-border-primary/60 bg-surface px-4 py-4"
                style={PANEL_SHADOW}
              >
                <AppText className="text-sm text-text-secondary">
                  Recorded route requests
                </AppText>

                <AppText
                  weight="semibold"
                  className="mt-1 text-4xl text-text-primary"
                  style={TABULAR_NUMBERS}
                  accessibilityLabel={`Recorded route requests: ${data.total_requests}`}
                >
                  {formatAnalyticsCount(data.total_requests)}
                </AppText>

                <AppText className="mb-3 mt-1 text-sm leading-5 text-text-secondary">
                  No recorded route requests for the available tracking dates.
                </AppText>

                {/* Both navigation methods retain their color keys */}
                <View className="border-t border-border-primary/60">
                  <MethodLegendRow
                    label="Road Route"
                    count={data.road_route_requests}
                    color={METHOD_COLORS.road}
                  />

                  <MethodLegendRow
                    divider
                    label="Jeepney guidance"
                    count={data.jeepney_requests}
                    color={METHOD_COLORS.jeepney}
                  />
                </View>

                {/* Account count is not part of the method distribution */}
                <SupportingMetricRow
                  divider
                  label="Distinct explorer accounts"
                  count={data.distinct_explorer_accounts}
                />
              </View>
            ) : (
              /* Main donut chart and its breakdown panel */
              <View
                className="rounded-card border border-border-primary/60 bg-surface"
                style={PANEL_SHADOW}
              >
                {canRenderDonut ? (
                  <View
                    className={`p-4 ${
                      stacked
                        ? "items-center gap-4"
                        : "flex-row items-center gap-5"
                    }`}
                  >
                    {/* Proportional recorded-request donut */}
                    <RoutePlanningDonut
                      total={data.total_requests!}
                      roadCount={data.road_route_requests!}
                      jeepneyCount={data.jeepney_requests!}
                    />

                    {/* Visible legend matching each chart segment */}
                    <View className={stacked ? "w-full" : "min-w-0 flex-1"}>
                      <MethodLegendRow
                        label="Road Route"
                        count={data.road_route_requests}
                        percent={roadPercent}
                        color={METHOD_COLORS.road}
                      />

                      <MethodLegendRow
                        divider
                        label="Jeepney guidance"
                        count={data.jeepney_requests}
                        percent={jeepneyPercent}
                        color={METHOD_COLORS.jeepney}
                      />
                    </View>
                  </View>
                ) : (
                  /* Incomplete method data cannot form a valid donut */
                  <View className="px-4 pb-3 pt-4">
                    <AppText className="text-sm text-text-secondary">
                      Recorded route requests
                    </AppText>

                    <AppText
                      weight="semibold"
                      className="mb-3 mt-1 text-4xl text-text-primary"
                      style={TABULAR_NUMBERS}
                      accessibilityLabel={`Recorded route requests: ${
                        data.total_requests ?? "Unavailable"
                      }`}
                    >
                      {formatAnalyticsCount(data.total_requests)}
                    </AppText>

                    {/* Method counts remain readable without a chart */}
                    <View className="border-t border-border-primary/60">
                      <MethodLegendRow
                        label="Road Route"
                        count={data.road_route_requests}
                        color={METHOD_COLORS.road}
                      />

                      <MethodLegendRow
                        divider
                        label="Jeepney guidance"
                        count={data.jeepney_requests}
                        color={METHOD_COLORS.jeepney}
                      />
                    </View>

                    <AppText className="pt-2 text-sm leading-5 text-text-secondary">
                      Some route-planning counts are unavailable, so the method
                      breakdown cannot be charted.
                    </AppText>
                  </View>
                )}

                {/* Distinct explorers are separate from method shares */}
                <View className="border-t border-border-primary/60 px-4">
                  <SupportingMetricRow
                    label="Distinct explorer accounts"
                    count={data.distinct_explorer_accounts}
                  />
                </View>
              </View>
            )}

            {/* Incomplete-count notice for otherwise valid charts */}
            {!unavailable && partialCounts && canRenderDonut ? (
              <View className="flex-row items-center gap-2 px-1">
                <MaterialCommunityIcons
                  name="information-outline"
                  size={16}
                  color={theme.extends.colors.text.secondary}
                  accessible={false}
                />

                <AppText className="min-w-0 flex-1 text-xs text-text-secondary">
                  Some route-planning counts are unavailable.
                </AppText>
              </View>
            ) : null}
          </View>
        ) : null}
      </AnalyticsOverviewSection>

      {/* Measurement definitions and reporting limitations */}
      <AnalyticsRoutePlanningSheet sheetRef={sheetRef} report={data} />
    </>
  );
}
