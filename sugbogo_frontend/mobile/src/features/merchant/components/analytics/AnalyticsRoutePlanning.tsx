import { MaterialCommunityIcons } from "@expo/vector-icons";
import type { BottomSheetModal } from "@gorhom/bottom-sheet";
import { useRef } from "react";
import { View, useWindowDimensions, type TextStyle } from "react-native";
import Svg, { Circle, G } from "react-native-svg";

import { theme } from "@/constants/theme";
import AppText from "@/shared/components/AppText";
import ErrorState from "@/shared/components/ErrorState";
import Skeleton from "@/shared/components/Skeleton";

import type { RoutePlanningAnalytics } from "../../types/routePlanningAnalytics.types";
import type { MerchantAnalyticsPeriod } from "../../types/merchantAnalytics.types";
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
/** Visible gap between the two arcs, in px along the circle. */
const DONUT_GAP = 4;

/** Soft, low-contrast elevation shared with the other Analytics panels. */
const PANEL_SHADOW = {
  shadowColor: "#000",
  shadowOpacity: 0.05,
  shadowRadius: 10,
  shadowOffset: { width: 0, height: 2 },
  elevation: 1,
} as const;

/** Keeps digits the same width so counts line up across rows. */
const TABULAR_NUMBERS: TextStyle = {
  fontVariant: ["tabular-nums"],
};

function withAlpha(color: string, alpha: number) {
  if (!color.startsWith("#")) return color;
  const hex = color.replace("#", "");

  if (hex.length !== 6) return color;

  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);

  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function formatPercent(value: number) {
  return `${value.toFixed(1)}%`;
}

function RoutePlanningDonut({
  total,
  roadCount,
  jeepneyCount,
}: {
  total: number;
  roadCount: number;
  jeepneyCount: number;
}) {
  const radius = (DONUT_SIZE - DONUT_STROKE) / 2;
  const circumference = 2 * Math.PI * radius;
  const center = DONUT_SIZE / 2;

  const roadLength = total > 0 ? circumference * (roadCount / total) : 0;
  const jeepneyLength = total > 0 ? circumference * (jeepneyCount / total) : 0;

  // Only separate the arcs when both exist; a lone arc fills the ring.
  const gap = roadLength > 0 && jeepneyLength > 0 ? DONUT_GAP : 0;

  const roadColor = theme.extends.colors.brand;
  const jeepneyColor = withAlpha(theme.extends.colors.brand, 0.4);
  const trackColor = theme.extends.colors.surfaceMuted ?? "#F3F4F6";

  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={`Route-planning method breakdown. ${roadCount} Road Route requests and ${jeepneyCount} Jeepney guidance requests out of ${total} total recorded requests.`}
      className="items-center justify-center"
      style={{ width: DONUT_SIZE, height: DONUT_SIZE }}
    >
      <Svg width={DONUT_SIZE} height={DONUT_SIZE} accessible={false}>
        <G rotation="-90" origin={`${center}, ${center}`}>
          {/* Track */}
          <Circle
            cx={center}
            cy={center}
            r={radius}
            stroke={trackColor}
            strokeWidth={DONUT_STROKE}
            fill="none"
          />

          {/* Butt caps keep arc lengths exactly proportional to the counts. */}
          {roadLength > 0 ? (
            <Circle
              cx={center}
              cy={center}
              r={radius}
              stroke={roadColor}
              strokeWidth={DONUT_STROKE}
              fill="none"
              strokeDasharray={`${Math.max(roadLength - gap, 0)} ${circumference}`}
            />
          ) : null}

          {jeepneyLength > 0 ? (
            <Circle
              cx={center}
              cy={center}
              r={radius}
              stroke={jeepneyColor}
              strokeWidth={DONUT_STROKE}
              fill="none"
              strokeDasharray={`${Math.max(jeepneyLength - gap, 0)} ${circumference}`}
              strokeDashoffset={-roadLength}
            />
          ) : null}
        </G>
      </Svg>

      {/* Center total */}
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

type MetricRowProps = {
  label: string;
  count: number | null;
  /** Share of total requests, shown under the count when known. */
  percent?: number | null;
  dotColor?: string;
  accessibilityLabel: string;
  /** Draws a hairline above the row. */
  divider?: boolean;
};

/** One label/value line, used for the method legend and the supporting counts. */
function MetricRow({
  label,
  count,
  percent = null,
  dotColor,
  accessibilityLabel,
  divider,
}: MetricRowProps) {
  return (
    <View
      accessible
      accessibilityLabel={accessibilityLabel}
      className={`flex-row items-center justify-between gap-3 py-2.5 ${
        divider ? "border-t border-border-primary/60" : ""
      }`}
    >
      <View className="min-w-0 flex-1 flex-row items-center gap-2.5">
        {dotColor ? (
          <View
            accessible={false}
            className="h-2.5 w-2.5 rounded-full"
            style={{ backgroundColor: dotColor }}
          />
        ) : null}
        <AppText className="min-w-0 flex-1 text-sm text-text-secondary">
          {label}
        </AppText>
      </View>

      <View className="items-end">
        <AppText
          weight="semibold"
          className="text-sm text-text-primary"
          style={TABULAR_NUMBERS}
        >
          {formatAnalyticsCount(count)}
        </AppText>
        {percent !== null ? (
          <AppText
            className="text-xs text-text-secondary"
            style={TABULAR_NUMBERS}
          >
            {formatPercent(percent)}
          </AppText>
        ) : null}
      </View>
    </View>
  );
}

/** Presents method-level recorded guidance interest without implying completed visits. */
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
    data &&
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

  const roadCount = data?.road_route_requests ?? null;
  const jeepneyCount = data?.jeepney_requests ?? null;
  const totalRequests = data?.total_requests ?? null;

  const roadPercent =
    canRenderDonut && totalRequests ? (roadCount! / totalRequests) * 100 : null;

  const jeepneyPercent =
    canRenderDonut && totalRequests
      ? (jeepneyCount! / totalRequests) * 100
      : null;

  const methods = data
    ? [
        {
          key: "road",
          label: "Road Route",
          count: data.road_route_requests,
          percent: roadPercent,
          dotColor: theme.extends.colors.brand,
        },
        {
          key: "jeepney",
          label: "Jeepney guidance",
          count: data.jeepney_requests,
          percent: jeepneyPercent,
          dotColor: withAlpha(theme.extends.colors.brand, 0.4),
        },
      ]
    : [];

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
        {/* Independent loading and persistent request recovery */}
        {loading && !data ? (
          <View
            accessibilityLabel="Loading route-planning activity"
            accessibilityState={{ busy: true }}
            className="gap-4"
          >
            <Skeleton className="h-44 w-full rounded-card" />
            <Skeleton className="h-12 w-full rounded-card" />
          </View>
        ) : null}

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

        {data ? (
          <View className="gap-3">
            {unavailable && !uninitialized && !beforeTracking ? (
              <ErrorState
                size="section"
                title="Route-planning data unavailable"
                description="We couldn't read recorded guidance activity. Please try again."
                primaryActionTitle="Retry"
                onPrimaryAction={onRetry}
              />
            ) : unavailable ? (
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
              /* Known zeros remain visible without drawing an empty chart. */
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

                {[
                  { label: "Road Route", count: data.road_route_requests },
                  { label: "Jeepney guidance", count: data.jeepney_requests },
                  {
                    label: "Distinct explorer accounts",
                    count: data.distinct_explorer_accounts,
                  },
                ].map(({ label, count }) => (
                  <MetricRow
                    key={label}
                    divider
                    label={label}
                    count={count}
                    accessibilityLabel={`${label}: ${count ?? "Unavailable"}`}
                  />
                ))}
              </View>
            ) : (
              <View
                className="rounded-card border border-border-primary/60 bg-surface"
                style={PANEL_SHADOW}
              >
                {canRenderDonut ? (
                  /* Donut beside its legend; stacks on narrow screens or large text. */
                  <View
                    className={`p-4 ${
                      stacked
                        ? "items-center gap-4"
                        : "flex-row items-center gap-5"
                    }`}
                  >
                    <RoutePlanningDonut
                      total={data.total_requests!}
                      roadCount={data.road_route_requests!}
                      jeepneyCount={data.jeepney_requests!}
                    />

                    <View className={stacked ? "w-full" : "min-w-0 flex-1"}>
                      {methods.map((method, index) => (
                        <MetricRow
                          key={method.key}
                          divider={index > 0}
                          label={method.label}
                          count={method.count}
                          percent={method.percent}
                          dotColor={method.dotColor}
                          accessibilityLabel={`${method.label}: ${
                            method.count ?? "Unavailable"
                          } requests${
                            method.percent !== null
                              ? `, ${formatPercent(method.percent)}`
                              : ""
                          }`}
                        />
                      ))}
                    </View>
                  </View>
                ) : (
                  /* Fallback when totals exist but the method split is incomplete */
                  <View className="px-4 pb-2 pt-4">
                    <AppText className="text-sm text-text-secondary">
                      Recorded route requests
                    </AppText>
                    <AppText
                      weight="semibold"
                      className="mb-2 mt-1 text-4xl text-text-primary"
                      style={TABULAR_NUMBERS}
                      accessibilityLabel={`Recorded route requests: ${
                        data.total_requests ?? "Unavailable"
                      }`}
                    >
                      {formatAnalyticsCount(data.total_requests)}
                    </AppText>

                    {methods.map((method, index) => (
                      <MetricRow
                        key={method.key}
                        divider={index > 0}
                        label={method.label}
                        count={method.count}
                        accessibilityLabel={`${method.label}: ${
                          method.count ?? "Unavailable"
                        } recorded requests`}
                      />
                    ))}

                    <AppText className="pb-2 pt-1 text-sm leading-5 text-text-secondary">
                      Some route-planning counts are unavailable, so the method
                      breakdown cannot be charted.
                    </AppText>
                  </View>
                )}

                {/* Distinct explorer accounts stays separate from the method split */}
                <View className="border-t border-border-primary/60 px-4">
                  <MetricRow
                    label="Distinct explorer accounts"
                    count={data.distinct_explorer_accounts}
                    accessibilityLabel={`Distinct explorer accounts: ${
                      data.distinct_explorer_accounts ?? "Unavailable"
                    }`}
                  />
                </View>
              </View>
            )}

            {/* Surface incomplete counts without repeating measurement details */}
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

      {/* Measurement details stay out of the compact overview. */}
      <AnalyticsRoutePlanningSheet sheetRef={sheetRef} report={data} />
    </>
  );
}
