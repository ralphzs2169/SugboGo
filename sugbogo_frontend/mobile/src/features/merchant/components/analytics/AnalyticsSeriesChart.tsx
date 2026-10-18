import { useState } from "react";
import { Pressable, ScrollView, View, useWindowDimensions } from "react-native";
import Svg, {
  Circle,
  Line,
  Path,
  Rect,
  Text as SvgText,
} from "react-native-svg";
import { theme } from "@/constants/theme";
import AppText from "@/shared/components/AppText";
import AnalyticsChartEmptyState from "./AnalyticsChartEmptyState";
import type { AnalyticsInterval } from "../../types/merchantPlusAnalytics.types";
import {
  analyticsBucketLabel,
  shortAnalyticsDate,
  splitObservedSeries,
  type AnalyticsPlotPoint,
} from "../../utils/merchantPlusAnalytics.utils";

/** Plots only returned buckets, with gap-safe lines and an accessible exact-value list. */
export default function AnalyticsSeriesChart({
  points,
  interval,
  label,
  kind = "line",
  color = theme.extends.colors.brand,
  range,
  total,
  emptyTitle = "No recorded activity in this period",
  emptyDescription = "No activity was recorded for this metric during the selected dates.",
}: {
  points: AnalyticsPlotPoint[];
  interval: AnalyticsInterval;
  label: string;
  kind?: "line" | "bar";
  color?: string;
  range?: { start: string; end_exclusive: string };
  total?: number | null;
  emptyTitle?: string;
  emptyDescription?: string;
}) {
  const { width: windowWidth } = useWindowDimensions();
  const [measuredWidth, setMeasuredWidth] = useState(0);
  const [showValues, setShowValues] = useState(false);
  const groups = splitObservedSeries(points, interval);
  const ordered = groups.flat();
  const activeBuckets = ordered.filter((point) => point.value > 0);
  // Lines need temporal continuity; bars need activity in multiple comparison buckets.
  // These are presentation rules, not statistical sample-sufficiency claims.
  const compact =
    kind === "line"
      ? ordered.length < 3 || !groups.some((group) => group.length > 1)
      : activeBuckets.length < 2;
  const visibleValues = compact && !showValues ? ordered.slice(-4) : ordered;
  const chartWidth = Math.max(240, measuredWidth || windowWidth - 40);
  const width =
    kind === "bar"
      ? Math.max(chartWidth, ordered.length * 52 + 44)
      : chartWidth;
  const height = 196;
  const left = 36;
  const right = width - 18;
  const top = 18;
  const bottom = height - 34;
  const maximum = Math.max(1, ...ordered.map((point) => point.value));
  const firstTime = Date.parse(
    range?.start ?? ordered[0]?.start ?? "1970-01-01",
  );
  const lastTime = range
    ? Date.parse(range.end_exclusive) - 1
    : Date.parse(ordered.at(-1)?.start ?? "1970-01-01");
  const x = (point: AnalyticsPlotPoint, index: number) =>
    kind === "bar"
      ? left + ((index + 0.5) / ordered.length) * (right - left)
      : left +
        ((Date.parse(point.start) - firstTime) /
          Math.max(1, lastTime - firstTime)) *
          (right - left);
  const y = (value: number) => bottom - (value / maximum) * (bottom - top);
  const values = (
    <View className="gap-1">
      {visibleValues.map((point) => (
        <View
          key={point.start}
          accessible
          accessibilityLabel={`${label}, ${analyticsBucketLabel(point, interval)}: ${point.value}`}
          className="min-h-12 flex-row items-center justify-between gap-4 border-b border-border-primary/60 py-2"
        >
          <AppText className="min-w-0 flex-1 text-sm text-text-secondary">
            {analyticsBucketLabel(point, interval)}
          </AppText>
          <AppText weight="bold" className="text-base text-text-primary">
            {point.value.toLocaleString("en-PH")}
          </AppText>
        </View>
      ))}
    </View>
  );

  // Only a supplied period total can establish zero activity across the reporting range.
  if (total === 0 && activeBuckets.length === 0) {
    return (
      <AnalyticsChartEmptyState
        title={emptyTitle}
        description={emptyDescription}
      />
    );
  }
  if (ordered.length === 0) {
    return (
      <AnalyticsChartEmptyState
        title="Dated counts are unavailable"
        description={`Dated counts for ${label.toLowerCase()} are unavailable. Any available total is shown above. Dates without data do not necessarily mean no activity.`}
      />
    );
  }
  if (compact) {
    return (
      <View className="gap-3">
        <AnalyticsChartEmptyState
          title="Not enough data for a trend yet"
          description={
            kind === "line"
              ? `There are too few connected dates to show a ${label.toLowerCase()} trend. Exact counts are shown below.`
              : `There are too few active weeks to compare ${label.toLowerCase()}. Exact counts are shown below.`
          }
        />
        {/* Returned values remain available without implying a continuous trend. */}
        <AppText className="text-sm leading-5 text-text-secondary">
          {ordered.length > 4 && !showValues
            ? `Showing the latest four recorded ${interval === "daily" ? "dates" : "weeks"}. `
            : ""}
          Dates without data do not necessarily mean no activity.
        </AppText>
        {values}
        {ordered.length > 4 && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${showValues ? "Show fewer" : "Show all"} ${label} values`}
            accessibilityState={{ expanded: showValues }}
            onPress={() => setShowValues(!showValues)}
            className="min-h-12 justify-center self-start py-2 active:opacity-70"
          >
            <AppText weight="semibold" className="text-sm text-text-info">
              {showValues ? "Show fewer values" : "View all dated values"}
            </AppText>
          </Pressable>
        )}
      </View>
    );
  }
  return (
    <View
      onLayout={(event) => setMeasuredWidth(event.nativeEvent.layout.width)}
      className="gap-2"
    >
      {/* SVG lines stop at missing buckets; columns retain only server-supplied values. */}
      <ScrollView
        testID="analytics-chart-viewport"
        horizontal
        style={{ height, flexGrow: 0 }}
        contentContainerStyle={{ height }}
        scrollEnabled={width > chartWidth}
        showsHorizontalScrollIndicator={width > chartWidth}
      >
        <View
          style={{ width, height }}
          accessible
          accessibilityRole="image"
          accessibilityLabel={`${label}. ${ordered.length} recorded ${interval} counts. Use View exact values to read the counts.`}
        >
          <Svg
            width={width}
            height={height}
            accessible={false}
            fontFamily="NunitoSans_400Regular"
          >
            {[0, maximum].map((tick) => (
              <Line
                key={`grid-${tick}`}
                x1={left}
                x2={right}
                y1={y(tick)}
                y2={y(tick)}
                stroke={theme.extends.colors.border.primary}
                strokeDasharray="3 4"
              />
            ))}
            <SvgText
              x={left - 8}
              y={top + 4}
              fontSize={12}
              fill={theme.extends.colors.text.secondary}
              textAnchor="end"
            >
              {new Intl.NumberFormat("en-PH", {
                notation: "compact",
                maximumFractionDigits: 1,
              }).format(maximum)}
            </SvgText>
            <SvgText
              x={left - 8}
              y={bottom + 4}
              fontSize={12}
              fill={theme.extends.colors.text.secondary}
              textAnchor="end"
            >
              0
            </SvgText>
            {kind === "line" &&
              groups
                .filter((group) => group.length > 1)
                .map((group) => (
                  <Path
                    key={group[0].start}
                    testID="analytics-line-segment"
                    d={group
                      .map(
                        (point, index) =>
                          `${index === 0 ? "M" : "L"} ${x(point, 0)} ${y(point.value)}`,
                      )
                      .join(" ")}
                    stroke={color}
                    strokeWidth={2.5}
                    fill="none"
                  />
                ))}
            {ordered.map((point, index) =>
              kind === "line" ? (
                <Circle
                  key={point.start}
                  testID="analytics-observed-point"
                  cx={x(point, index)}
                  cy={y(point.value)}
                  r={3}
                  fill={color}
                />
              ) : (
                <Rect
                  key={point.start}
                  x={x(point, index) - 13}
                  y={y(point.value)}
                  width={26}
                  height={bottom - y(point.value)}
                  rx={4}
                  fill={color}
                />
              ),
            )}
            {kind === "line" &&
              [0, 0.5, 1].map((fraction) => (
                <SvgText
                  key={`time-${fraction}`}
                  x={left + fraction * (right - left)}
                  y={height - 10}
                  textAnchor={
                    fraction === 0 ? "start" : fraction === 1 ? "end" : "middle"
                  }
                  fontSize={12}
                  fill={theme.extends.colors.text.secondary}
                >
                  {shortAnalyticsDate(
                    new Date(
                      firstTime + fraction * (lastTime - firstTime),
                    ).toISOString(),
                  )}
                </SvgText>
              ))}
            {kind === "bar" &&
              ordered.map((point, index) => (
                <SvgText
                  key={`label-${point.start}`}
                  x={x(point, index)}
                  y={height - 10}
                  textAnchor="middle"
                  fontSize={12}
                  fill={theme.extends.colors.text.secondary}
                >
                  {shortAnalyticsDate(point.start)}
                </SvgText>
              ))}
          </Svg>
        </View>
      </ScrollView>
      {width > chartWidth && (
        <AppText className="text-sm text-text-secondary">
          Swipe to view all weeks.
        </AppText>
      )}
      {/* Text values provide precise counts and a screen-reader alternative. */}
      <AppText className="text-sm leading-5 text-text-secondary">
        {kind === "line"
          ? "Gaps show dates without data, not necessarily zero activity."
          : "Only weeks with available counts are shown. Missing weeks do not necessarily mean no activity."}
      </AppText>
      <Pressable
        onPress={() => setShowValues(!showValues)}
        accessibilityRole="button"
        accessibilityLabel={`${showValues ? "Hide" : "Show"} ${label} values`}
        accessibilityState={{ expanded: showValues }}
        className="min-h-12 justify-center self-start py-2 active:opacity-70"
      >
        <AppText weight="semibold" className="text-sm text-text-info">
          {showValues ? "Hide values" : "View exact values"}
        </AppText>
      </Pressable>
      {showValues && values}
    </View>
  );
}
