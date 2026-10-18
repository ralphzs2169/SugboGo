import { useState } from "react";
import { Pressable, ScrollView, View, useWindowDimensions } from "react-native";
import Svg, { Circle, G, Line, Rect, Text as SvgText } from "react-native-svg";
import { theme } from "@/constants/theme";
import AppText from "@/shared/components/AppText";
import AnalyticsChartEmptyState from "./AnalyticsChartEmptyState";
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

/**
 * Plots counts on Manila calendar positions using columns and distinct missing/zero marks.
 * Sparse reports show exact counts directly; larger charts retain expandable calendar values.
 */
export default function AnalyticsSeriesChart({
  points,
  interval,
  label,
  color = theme.extends.colors.brand,
  range,
  total,
  emptyTitle = "No recorded activity in this period",
  emptyDescription = "No activity was recorded for this metric during the selected dates.",
}: {
  points: AnalyticsPlotPoint[];
  interval: AnalyticsInterval;
  label: string;
  color?: string;
  range?: AnalyticsChartRange;
  total?: number | null;
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
  const knownZero =
    total === 0 && !observed.some((slot) => slot.observation!.value > 0);
  const compact = observed.length <= 2;
  const scale = Math.max(1, fontScale);
  const fontSize = 12 * scale;
  const ticks = analyticsCountTicks(
    Math.max(0, ...observed.map((slot) => slot.observation!.value)),
  );
  const countFormatter = new Intl.NumberFormat("en-PH", {
    notation: "compact",
    maximumFractionDigits: 1,
  });
  const tickLabels = ticks.map((tick) => countFormatter.format(tick));
  const chartWidth = Math.max(160, measuredWidth || windowWidth - 40);
  // Reserve only the space needed by the count labels, including font scaling.
  const axisWidth = Math.max(
    24 * scale,
    Math.ceil(
      Math.max(...tickLabels.map((text) => text.length)) * fontSize * 0.65,
    ) +
      8 * scale,
  );
  const slotMinimum = (interval === "weekly" ? 56 : 28) * scale;
  const plotWidth = Math.max(
    chartWidth - axisWidth,
    slots.length * slotMinimum,
  );
  const stepWidth = plotWidth / Math.max(1, slots.length);
  const barWidth = Math.min(26 * scale, stepWidth * 0.6);
  const maximum = ticks[ticks.length - 1];
  const top = Math.max(16, fontSize);
  const bottom = top + Math.max(144, fontSize * 4);
  const height = bottom + fontSize * 3 + 16;
  const labelEvery = Math.max(1, Math.ceil((72 * scale) / stepWidth));
  const y = (value: number) => bottom - (value / maximum) * (bottom - top);

  const renderValue = (slot: AnalyticsCalendarSlot) => {
    const dates = analyticsCalendarLabel(slot, interval);
    const value = slot.observation?.value;
    return (
      <View
        key={slot.date}
        accessible
        accessibilityLabel={`${label}, ${dates}: ${value === undefined ? "No data" : value}`}
        className="min-h-12 flex-row items-center justify-between gap-4 border-b border-border-primary/60 py-2"
      >
        <AppText className="min-w-0 flex-1 text-sm text-text-secondary">
          {dates}
        </AppText>
        <AppText weight="bold" className="text-base text-text-primary">
          {value === undefined ? "No data" : value.toLocaleString("en-PH")}
        </AppText>
      </View>
    );
  };
  const exactValues = <View className="gap-1">{slots.map(renderValue)}</View>;
  const valuesToggle = (
    <Pressable
      onPress={() => setShowValues(!showValues)}
      accessibilityRole="button"
      accessibilityLabel={`${showValues ? "Hide" : "Show"} ${label} values`}
      accessibilityState={{ expanded: showValues }}
      className="min-h-12 cursor-pointer justify-center self-start py-2 active:opacity-70"
    >
      <AppText weight="semibold" className="text-sm text-text-info">
        {showValues ? "Hide values" : "View exact values"}
      </AppText>
    </Pressable>
  );
  const partialNote = hasPartial ? (
    <AppText className="text-sm leading-5 text-text-secondary">
      {interval === "weekly"
        ? "Partial weeks cover less time than full weeks. Counts are not adjusted."
        : "Partial days cover less time than full days. Counts are not adjusted."}
    </AppText>
  ) : null;

  // Only a supplied total can establish recorded zero activity across the reporting period.
  if (knownZero) {
    return (
      <View className="gap-2">
        <AnalyticsChartEmptyState
          compact
          title={emptyTitle}
          description={emptyDescription}
        />
        {observed.length > 0 && valuesToggle}
        {showValues && exactValues}
      </View>
    );
  }
  if (observed.length === 0) {
    return (
      <AnalyticsChartEmptyState
        compact
        title="Dated counts are unavailable"
        description="Any available total is shown above. Dates without data do not necessarily mean no activity."
      />
    );
  }
  if (compact) {
    return (
      <View className="gap-2">
        {/* Available counts are useful information, even without a full chart. */}
        <AppText weight="semibold" className="text-sm text-text-primary">
          Recorded counts
        </AppText>
        {observed.map(renderValue)}
        {hasMissing && (
          <AppText className="text-sm leading-5 text-text-secondary">
            Only available counts are shown. Dates without data do not
            necessarily mean no activity.
          </AppText>
        )}
        {partialNote}
      </View>
    );
  }

  return (
    <View
      onLayout={(event) => setMeasuredWidth(event.nativeEvent.layout.width)}
      className="gap-2"
    >
      <AppText className="text-sm text-text-secondary">
        Count · {interval === "weekly" ? "weeks starting Monday" : "days"} ·
        Manila time
      </AppText>

      {/* The count axis stays visible while the calendar columns scroll. */}
      <View
        accessible
        accessibilityRole="image"
        accessibilityLabel={`${label}. ${observed.length} recorded ${interval} counts. ${slots.length - observed.length} calendar positions have no data. View exact values expands the dates and counts below.`}
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
          style={{ height, flex: 1 }}
          contentContainerStyle={{ height }}
          showsHorizontalScrollIndicator={plotWidth > chartWidth - axisWidth}
        >
          <Svg
            width={plotWidth}
            height={height}
            accessible={false}
            fontFamily="NunitoSans_400Regular"
          >
            {ticks.map((tick) => (
              <Line
                key={tick}
                x1={0}
                x2={plotWidth}
                y1={y(tick)}
                y2={y(tick)}
                stroke={theme.extends.colors.border.primary}
                strokeDasharray="3 4"
              />
            ))}
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
                  {/* Missing marks carry no magnitude; a hollow circle means a reported zero. */}
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
                  ) : (
                    <Rect
                      testID={`analytics-column-${slot.date}`}
                      x={center - barWidth / 2}
                      y={y(value)}
                      width={barWidth}
                      height={bottom - y(value)}
                      rx={3}
                      fill={color}
                    />
                  )}
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

      {/* Shapes and text distinguish absent observations from confirmed zeros. */}
      {(hasMissing || hasZero) && (
        <View className="flex-row flex-wrap gap-4">
          {hasZero && (
            <View className="flex-row items-center gap-2">
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
              <AppText className="text-sm text-text-secondary">
                Recorded zero
              </AppText>
            </View>
          )}
          {hasMissing && (
            <View className="flex-row items-center gap-2">
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
              <AppText className="text-sm text-text-secondary">No data</AppText>
            </View>
          )}
        </View>
      )}
      {plotWidth > chartWidth - axisWidth && (
        <AppText className="text-sm text-text-secondary">
          Swipe to view all {interval === "weekly" ? "weeks" : "dates"}.
        </AppText>
      )}
      {hasMissing && (
        <AppText className="text-sm leading-5 text-text-secondary">
          Dates without data do not necessarily mean no activity.
        </AppText>
      )}
      {partialNote}
      {valuesToggle}
      {showValues && exactValues}
    </View>
  );
}
