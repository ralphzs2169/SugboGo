import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useState } from "react";
import { Pressable, ScrollView, View, useWindowDimensions } from "react-native";
import Svg, {
  Circle,
  Defs,
  G,
  Line,
  LinearGradient,
  Path,
  Rect,
  Stop,
  Text as SvgText,
} from "react-native-svg";

import { theme } from "@/constants/theme";
import AppText from "@/shared/components/AppText";

import type { AnalyticsInterval } from "../../types/merchantPlusAnalytics.types";
import {
  analyticsCalendarLabel,
  analyticsCountTicks,
  buildAnalyticsCalendar,
  shortAnalyticsDate,
  type AnalyticsCalendarSlot,
  type AnalyticsChartRange,
  type AnalyticsPlotPoint,
} from "../../utils/merchantPlusAnalytics.utils";

import AnalyticsChartEmptyState from "./AnalyticsChartEmptyState";

/**
 * Draws calendar-aligned recorded counts with a linear Y-axis.
 *
 * Distinguishes missing observations from recorded zeros, preserves
 * partial intervals, and provides an accessible exact-values view.
 * The compact footer is used when context lives in a separate sheet.
 */
export default function AnalyticsSeriesChart({
  points,
  interval,
  label,
  color = theme.extends.colors.brand,
  range,
  total,
  variant = "bar",
  minimalFooter = false,
  emptyTitle = "No recorded activity in this period",
  emptyDescription = "No activity was recorded for this metric during the selected dates.",
}: {
  points: AnalyticsPlotPoint[];
  interval: AnalyticsInterval;
  label: string;
  color?: string;
  range?: AnalyticsChartRange;
  total?: number | null;
  variant?: "bar" | "line";
  minimalFooter?: boolean;
  emptyTitle?: string;
  emptyDescription?: string;
}) {
  const { width: windowWidth, fontScale } = useWindowDimensions();

  const [measuredWidth, setMeasuredWidth] = useState(0);
  const [showValues, setShowValues] = useState(false);

  const slots = buildAnalyticsCalendar(points, interval, range);

  const observed = slots.filter((slot) => slot.observation !== null);

  const hasMissing = slots.some((slot) => slot.observation === null);

  const hasZero = observed.some((slot) => slot.observation?.value === 0);

  const hasPartial = slots.some((slot) => slot.partial);

  // Only a supplied total can establish a period-wide zero.
  const knownZero =
    total === 0 && !observed.some((slot) => (slot.observation?.value ?? 0) > 0);

  const compact = observed.length <= 2;

  // Responsive axis labels and chart measurements.
  const scale = Math.max(1, fontScale);
  const fontSize = 11 * scale;

  const maximumObserved = Math.max(
    0,
    ...observed.map((slot) => slot.observation?.value ?? 0),
  );

  const ticks = analyticsCountTicks(maximumObserved);

  const formatter = new Intl.NumberFormat("en-PH", {
    notation: "compact",
    maximumFractionDigits: 1,
  });

  const tickLabels = ticks.map((tick) => formatter.format(tick));

  const chartWidth = Math.max(160, measuredWidth || windowWidth - 72);

  const axisWidth = Math.max(
    25 * scale,
    Math.ceil(
      Math.max(...tickLabels.map((text) => text.length)) * fontSize * 0.65,
    ) +
      9 * scale,
  );

  // Five weekly bars should usually fit on a mobile viewport.
  // Longer calendars still scroll horizontally.
  const slotMinimum = (interval === "weekly" ? 48 : 30) * scale;

  const plotWidth = Math.max(
    chartWidth - axisWidth,
    slots.length * slotMinimum,
  );

  const stepWidth = plotWidth / Math.max(1, slots.length);

  const barWidth = Math.min(26 * scale, stepWidth * 0.56);

  const maximum = Math.max(1, ticks[ticks.length - 1] ?? 1);

  const top = Math.max(16, fontSize * 1.25);

  const plotHeight = Math.max(152, 152 * Math.min(scale, 1.3));

  const bottom = top + plotHeight;
  const height = bottom + fontSize * 3.2 + 8;

  const labelEvery = Math.max(1, Math.ceil((74 * scale) / stepWidth));

  // All dates use the same linear scale, including off-screen dates.
  const y = (value: number) => bottom - (value / maximum) * plotHeight;

  const canScroll = plotWidth > chartWidth - axisWidth + 1;

  const renderValue = (slot: AnalyticsCalendarSlot) => {
    const dates = analyticsCalendarLabel(slot, interval);

    const value = slot.observation?.value;

    return (
      <View
        key={slot.date}
        accessible
        accessibilityLabel={`${label}, ${dates}: ${
          value === undefined ? "No data" : value
        }`}
        className="min-h-12 flex-row items-center justify-between gap-4 border-b border-border-primary/60 py-2"
      >
        <AppText className="min-w-0 flex-1 text-sm text-text-secondary">
          {dates}
        </AppText>

        <AppText weight="semibold" className="text-sm text-text-primary">
          {value === undefined ? "No data" : value.toLocaleString("en-PH")}
        </AppText>
      </View>
    );
  };

  const exactValues = <View className="gap-1">{slots.map(renderValue)}</View>;

  const valuesToggle = (
    <Pressable
      onPress={() => setShowValues((current) => !current)}
      accessibilityRole="button"
      accessibilityLabel={`${
        showValues ? "Hide" : "View"
      } ${label} exact values`}
      accessibilityState={{ expanded: showValues }}
      className="min-h-12 flex-row cursor-pointer items-center justify-between gap-3 py-2 active:opacity-70"
    >
      <View className="flex-row items-center gap-2">
        <MaterialCommunityIcons
          name="format-list-bulleted"
          size={19}
          color={theme.extends.colors.text.secondary}
          accessible={false}
        />

        <AppText weight="semibold" className="text-sm text-text-primary">
          {showValues ? "Hide exact values" : "View exact values"}
        </AppText>
      </View>

      <MaterialCommunityIcons
        name={showValues ? "chevron-up" : "chevron-down"}
        size={21}
        color={theme.extends.colors.text.secondary}
        accessible={false}
      />
    </Pressable>
  );

  const partialNote = hasPartial ? (
    <AppText className="text-xs leading-5 text-text-secondary">
      {interval === "weekly"
        ? "Partial weeks cover fewer days. Counts are not adjusted."
        : "Partial days cover less time. Counts are not adjusted."}
    </AppText>
  ) : null;

  // Confirmed period-wide zero state.
  if (knownZero) {
    return (
      <View className="gap-2">
        <AnalyticsChartEmptyState
          title={emptyTitle}
          description={emptyDescription}
        />

        {observed.length > 0 && valuesToggle}
        {showValues && exactValues}
      </View>
    );
  }

  // Missing dated observations remain unavailable, not zero.
  if (observed.length === 0) {
    return (
      <AnalyticsChartEmptyState
        title="Dated counts are unavailable"
        description="Any available total is shown above. Missing dates do not necessarily mean no activity."
      />
    );
  }

  // Sparse reporting favors exact values over a mostly empty graph.
  if (compact) {
    return (
      <View className="gap-2">
        {variant === "line" ? (
          <AnalyticsChartEmptyState
            title="Not enough data for a trend yet"
            description="More recorded dates are needed."
          />
        ) : (
          <AppText weight="semibold" className="text-sm text-text-primary">
            Recorded counts
          </AppText>
        )}

        {observed.map(renderValue)}

        {hasMissing && !(variant === "line" && minimalFooter) && (
          <AppText className="text-xs leading-5 text-text-secondary">
            Only available dates are shown. Missing data is not the same as zero
            activity.
          </AppText>
        )}

        {!minimalFooter && partialNote}
      </View>
    );
  }

  return (
    <View
      className="gap-2"
      onLayout={(event) => {
        const nextWidth = event.nativeEvent.layout.width;

        if (nextWidth !== measuredWidth) {
          setMeasuredWidth(nextWidth);
        }
      }}
    >
      {/* Both presentations use the same fixed axis and calendar-aligned positions. */}
      <View
        accessible
        accessibilityRole="image"
        accessibilityLabel={`${variant === "line" ? "Line chart. " : ""}${label}. ${
          observed.length
        } recorded ${interval} counts. ${
          slots.length - observed.length
        } calendar positions have no data. View exact values for individual dates.`}
        className="flex-row"
      >
        <Svg width={axisWidth} height={height} accessible={false}>
          {ticks.map((tick, index) => (
            <SvgText
              key={tick}
              x={axisWidth - 6 * scale}
              y={y(tick) + fontSize / 3}
              fontFamily="NunitoSans_400Regular"
              fontSize={fontSize}
              fill={theme.extends.colors.text.secondary}
              textAnchor="end"
            >
              {tickLabels[index]}
            </SvgText>
          ))}
        </Svg>

        <ScrollView
          testID="analytics-chart-viewport"
          horizontal
          style={{
            height,
            flex: 1,
          }}
          contentContainerStyle={{ height }}
          showsHorizontalScrollIndicator={canScroll}
        >
          <Svg
            width={plotWidth}
            height={height}
            accessible={false}
            fontFamily="NunitoSans_400Regular"
          >
            {variant === "line" && (
              <Defs>
                <LinearGradient
                  id="analytics-line-fill"
                  x1={0}
                  y1={top}
                  x2={0}
                  y2={bottom}
                  gradientUnits="userSpaceOnUse"
                >
                  <Stop offset="0" stopColor={color} stopOpacity={0.2} />
                  <Stop offset="1" stopColor={color} stopOpacity={0} />
                </LinearGradient>
              </Defs>
            )}

            {/* Full-period count grid */}
            {ticks.map((tick) => (
              <Line
                key={tick}
                x1={0}
                x2={plotWidth}
                y1={y(tick)}
                y2={y(tick)}
                stroke={theme.extends.colors.border.primary}
                strokeOpacity={tick === 0 ? 0.8 : 0.5}
                strokeDasharray="3 4"
              />
            ))}

            {/* Join only adjacent observed intervals; a missing bucket always breaks the line. */}
            {variant === "line" &&
              slots.map((slot, index) => {
                const previous = slots[index - 1];
                const value = slot.observation?.value;
                const previousValue = previous?.observation?.value;
                if (value === undefined || previousValue === undefined) {
                  return null;
                }

                const startX = (index - 0.5) * stepWidth;
                const endX = (index + 0.5) * stepWidth;

                return (
                  <G key={`${previous.date}-${slot.date}`}>
                    <Path
                      testID={`analytics-area-${previous.date}-${slot.date}`}
                      d={`M ${startX} ${bottom} L ${startX} ${y(previousValue)} L ${endX} ${y(value)} L ${endX} ${bottom} Z`}
                      fill="url(#analytics-line-fill)"
                    />
                    <Line
                      testID={`analytics-line-${previous.date}-${slot.date}`}
                      x1={startX}
                      y1={y(previousValue)}
                      x2={endX}
                      y2={y(value)}
                      stroke={color}
                      strokeWidth={2}
                      strokeLinecap="round"
                    />
                  </G>
                );
              })}

            {/* Columns, reported zeros, and missing-data marks */}
            {slots.map((slot, index) => {
              const center = (index + 0.5) * stepWidth;

              const value = slot.observation?.value;

              const showDate =
                index === slots.length - 1 ||
                (index % labelEvery === 0 &&
                  slots.length - 1 - index >= labelEvery);

              const labelX =
                index === 0
                  ? 2
                  : index === slots.length - 1
                    ? plotWidth - 2
                    : center;

              const textAnchor =
                index === 0
                  ? "start"
                  : index === slots.length - 1
                    ? "end"
                    : "middle";

              return (
                <G key={slot.date}>
                  {value === undefined ? (
                    <Line
                      testID={`analytics-missing-${slot.date}`}
                      x1={center - 4}
                      x2={center + 4}
                      y1={bottom}
                      y2={bottom}
                      stroke={theme.extends.colors.text.secondary}
                      strokeWidth={2}
                    />
                  ) : value === 0 ? (
                    <Circle
                      testID={`analytics-zero-${slot.date}`}
                      cx={center}
                      cy={bottom}
                      r={3}
                      fill={theme.extends.colors.surface}
                      stroke={theme.extends.colors.text.secondary}
                      strokeWidth={1.5}
                    />
                  ) : variant === "line" ? (
                    <Circle
                      testID={`analytics-point-${slot.date}`}
                      cx={center}
                      cy={y(value)}
                      r={3.5}
                      fill={color}
                    />
                  ) : (
                    <Rect
                      testID={`analytics-column-${slot.date}`}
                      x={center - barWidth / 2}
                      y={y(value)}
                      width={barWidth}
                      height={bottom - y(value)}
                      rx={4}
                      fill={color}
                      fillOpacity={value === maximumObserved ? 1 : 0.5}
                    />
                  )}

                  {/* Calendar ticks and partial-interval markers */}
                  {showDate && (
                    <>
                      <SvgText
                        x={labelX}
                        y={bottom + fontSize * 1.7}
                        textAnchor={textAnchor}
                        fontSize={fontSize}
                        fill={theme.extends.colors.text.secondary}
                      >
                        {shortAnalyticsDate(`${slot.date}T00:00:00+08:00`)}
                      </SvgText>

                      {slot.partial && (
                        <SvgText
                          x={labelX}
                          y={bottom + fontSize * 2.9}
                          textAnchor={textAnchor}
                          fontSize={fontSize}
                          fill={theme.extends.colors.text.secondary}
                        >
                          Partial
                        </SvgText>
                      )}
                    </>
                  )}
                </G>
              );
            })}
          </Svg>
        </ScrollView>
      </View>

      {/* Essential chart legend and horizontal navigation cue */}
      {(hasMissing || hasZero || canScroll) && (
        <View className="flex-row flex-wrap items-center justify-between gap-x-3 gap-y-2">
          <View className="flex-row flex-wrap items-center gap-x-3 gap-y-2">
            {hasZero && (
              <View className="flex-row items-center gap-1.5">
                <Svg width={12} height={14} accessible={false}>
                  <Circle
                    cx={6}
                    cy={7}
                    r={3}
                    fill={theme.extends.colors.surface}
                    stroke={theme.extends.colors.text.secondary}
                    strokeWidth={1.5}
                  />
                </Svg>

                <AppText className="text-xs text-text-secondary">Zero</AppText>
              </View>
            )}

            {hasMissing && (
              <View className="flex-row items-center gap-1.5">
                <Svg width={12} height={14} accessible={false}>
                  <Line
                    x1={2}
                    x2={10}
                    y1={7}
                    y2={7}
                    stroke={theme.extends.colors.text.secondary}
                    strokeWidth={2}
                  />
                </Svg>

                <AppText className="text-xs text-text-secondary">
                  No data
                </AppText>
              </View>
            )}
          </View>

          {canScroll && (
            <View className="flex-row items-center gap-1">
              <AppText className="text-xs text-text-secondary">
                Swipe for more
              </AppText>

              <MaterialCommunityIcons
                name="arrow-right"
                size={16}
                color={theme.extends.colors.text.secondary}
                accessible={false}
              />
            </View>
          )}
        </View>
      )}

      {/* Other reports retain their existing partial-period explanation */}
      {!minimalFooter && partialNote}

      {/* Exact values are grouped into the chart's own footer */}
      <View className="mt-1 border-t border-border-primary/60 pt-1">
        {valuesToggle}

        {showValues && <View className="pb-2">{exactValues}</View>}
      </View>
    </View>
  );
}
