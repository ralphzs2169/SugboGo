import { AnalyticsSpecialtyTrendsSkeleton } from "./AnalyticsLoadingSkeletons";
import { useRef, useState, type ComponentProps } from "react";
import { ScrollView, View, useWindowDimensions } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import type { BottomSheetModal } from "@gorhom/bottom-sheet";
import Svg, { Circle, Line, Text as SvgText } from "react-native-svg";
import { theme } from "@/constants/theme";
import AppText from "@/shared/components/AppText";
import SafePressable from "@/shared/components/SafePressable";
import FilterChip from "@/shared/components/FilterChip";
import ErrorState from "@/shared/components/ErrorState";
import SelectionBottomSheet from "@/shared/components/bottom-sheets/SelectionBottomSheet";
import { getSpecialtyTagColor } from "@/shared/constants/specialtyTagColors";
import { getSpecialtyTagIcon } from "@/shared/constants/specialtyTagIcons";
import type { MerchantBusinessSpecialty } from "../../types/merchantBusinessProfile.types";
import type { PlusSpecialtyReport } from "../../types/merchantPlusAnalytics.types";
import type { MerchantAnalyticsPeriod } from "../../types/merchantAnalytics.types";
import {
  formatOptionalAnalyticsTimestamp,
  analyticsCalendarLabel,
  analyticsCountTicks,
  buildAnalyticsCalendar,
  shortAnalyticsDate,
} from "../../utils/merchantPlusAnalytics.utils";
import AnalyticsHeaderControls from "./AnalyticsHeaderControls";
import AnalyticsChartEmptyState from "./AnalyticsChartEmptyState";
import AnalyticsReportSheet from "./AnalyticsReportSheet";
import { PlusReportContext } from "./AnalyticsPlusStates";

const OPTIONS = [
  { label: "Last 7 days", value: "7" },
  { label: "Last 30 days", value: "30" },
  { label: "Last 90 days", value: "90" },
];
const DASHES = [undefined, "6 3", "2 3"];

/** Shared-scale weekly comparison; missing buckets break lines rather than becoming zeros. */
export default function AnalyticsSpecialtyTrends({
  report,
  tags,
  period = "30",
  onPeriodChange,
  loading = false,
  error,
  retry = () => {},
}: {
  report?: PlusSpecialtyReport;
  tags: MerchantBusinessSpecialty[];
  period?: MerchantAnalyticsPeriod;
  onPeriodChange?: (value: MerchantAnalyticsPeriod) => void;
  loading?: boolean;
  error?: unknown;
  retry?: () => void;
}) {
  const periodRef = useRef<BottomSheetModal>(null);
  const informationRef = useRef<BottomSheetModal>(null);
  const [hiddenIds, setHiddenIds] = useState<number[]>([]);
  const [showValues, setShowValues] = useState(false);
  const { width, fontScale } = useWindowDimensions();
  const pending = loading && !report;
  const unavailable = report?.meta.availability === "unavailable";
  const rows = (report?.specialties ?? []).map((specialty, index) => {
    const tag = tags.find((item) => item.id === specialty.specialty_id);
    return {
      ...specialty,
      color: tag
        ? getSpecialtyTagColor(tag.color).softIcon
        : theme.extends.colors.brand,
      icon: getSpecialtyTagIcon(tag?.icon),
      dash: DASHES[index % DASHES.length],
      slots: buildAnalyticsCalendar(
        specialty.series.map((bucket) => ({
          ...bucket,
          value: bucket.added_and_still_valid,
        })),
        "weekly",
        report?.meta.period,
      ),
    };
  });
  const visible = rows.filter((row) => !hiddenIds.includes(row.specialty_id));
  const slots = rows[0]?.slots ?? [];
  const total = rows.reduce((sum, row) => sum + row.added_and_still_valid, 0);
  const observedWeeks = slots.filter((_, index) =>
    visible.some((row) => row.slots[index]?.observation !== null),
  ).length;
  const sparse = observedWeeks < 3;
  const tickFormatter = new Intl.NumberFormat("en-PH", {
    notation: "compact",
    maximumFractionDigits: 1,
  });
  const scale = Math.max(1, fontScale);
  const chartWidth = Math.max(width - 84, slots.length * 60 * scale);
  const edgeInset = 12 * scale;
  const step = (chartWidth - edgeInset * 2) / Math.max(1, slots.length - 1);
  const ticks = analyticsCountTicks(
    Math.max(
      0,
      ...rows.flatMap((row) =>
        row.slots.map((slot) => slot.observation?.value ?? 0),
      ),
    ),
  );
  const maximum = Math.max(1, ticks.at(-1) ?? 1);
  const axisWidth = Math.max(
    32,
    ...ticks.map((tick) => tickFormatter.format(tick).length * 8 * scale + 8),
  );
  const y = (value: number) => 176 - (value / maximum) * 148;
  const chartHeight = 210 + 18 * scale;
  const exactValues = (
    <View className="gap-4">
      {slots.map((slot, index) => (
        <View key={slot.date} className="gap-3 rounded-xl bg-surface-muted p-3">
          <View className="flex-row items-center gap-2">
            <MaterialCommunityIcons
              name="calendar-week"
              size={17}
              color={theme.extends.colors.text.secondary}
              accessible={false}
            />
            <AppText
              weight="semibold"
              className="min-w-0 flex-1 text-xs text-text-secondary"
            >
              {analyticsCalendarLabel(slot, "weekly")}
            </AppText>
          </View>
          {visible.map((row) => (
            <View
              key={row.specialty_id}
              accessible
              accessibilityLabel={`${row.specialty_name}, ${analyticsCalendarLabel(slot, "weekly")}: ${row.slots[index]?.observation?.value ?? "No data"}`}
              className="flex-row items-center justify-between gap-3"
            >
              <View
                className="h-2 w-2 rounded-full"
                style={{ backgroundColor: row.color }}
                accessible={false}
              />
              <AppText className="min-w-0 flex-1 text-sm text-text-primary">
                {row.specialty_name}
              </AppText>
              <AppText
                weight="semibold"
                className="text-sm tabular-nums text-text-primary"
              >
                {row.slots[index]?.observation?.value?.toLocaleString(
                  "en-PH",
                ) ?? "No data"}
              </AppText>
            </View>
          ))}
        </View>
      ))}
    </View>
  );

  return (
    <>
      <View className="gap-5">
        <View className="flex-row items-center justify-between gap-3">
          <AppText
            accessibilityRole="header"
            weight="bold"
            className="min-w-0 flex-1 text-base text-text-primary"
          >
            Specialty activity
          </AppText>
          <AnalyticsHeaderControls
            period={period}
            onOpenPeriod={() => periodRef.current?.present()}
            onOpenInformation={() => informationRef.current?.present()}
            informationLabel="About specialty vouch trends"
            informationHint="Explains eligible vouches, weekly counts, and reporting dates"
          />
        </View>
        {Boolean(error) && (
          <ErrorState
            variant="analytics"
            title={
              report
                ? "Unable to refresh specialty activity"
                : "Unable to load specialty activity"
            }
            description={
              report
                ? "Previously loaded counts are still shown."
                : "Please try this report again."
            }
            primaryActionTitle="Retry"
            onPrimaryAction={retry}
          />
        )}
        {pending ? (
          <AnalyticsSpecialtyTrendsSkeleton />
        ) : unavailable ? (
          !error && (
            <ErrorState
              variant="analytics"
              primaryActionTitle="Retry"
              title="Specialty activity unavailable"
              description="Missing counts do not mean zero vouches."
              icon="cloud-off-outline"
              onPrimaryAction={retry}
            />
          )
        ) : (
          report &&
          (rows.length === 0 ? (
            <AnalyticsChartEmptyState
              title="No active specialties to report"
              description="Activity will appear when your business has active specialties."
              icon="tag-outline"
            />
          ) : (
            <>
              <View className="flex-row flex-wrap gap-2">
                {rows.map((row) => {
                  const selected = !hiddenIds.includes(row.specialty_id);
                  return (
                    <FilterChip
                      key={row.specialty_id}
                      label={row.specialty_name}
                      selected={selected}
                      icon={row.icon}
                      accentColor={row.color}
                      compact
                      showSelectedCheck
                      accessibilityLabel={`${row.specialty_name}, ${selected ? "hide" : "show"} line`}
                      onPress={() =>
                        setHiddenIds((ids) =>
                          selected
                            ? [...ids, row.specialty_id]
                            : ids.filter((id) => id !== row.specialty_id),
                        )
                      }
                    />
                  );
                })}
              </View>
              <View className="gap-4 border-t border-border-primary/60 pt-5">
                <View className="gap-1">
                  <AppText
                    accessibilityRole="header"
                    weight="bold"
                    className="text-base text-text-primary"
                  >
                    Vouches over time
                  </AppText>
                  <AppText className="text-sm text-text-secondary">
                    Weekly additions that still count
                  </AppText>
                </View>
                {total === 0 ? (
                  <AnalyticsChartEmptyState
                    compact
                    title="No qualifying vouches from these dates"
                    description="Current total support is shown separately in Analytics."
                    icon="thumb-up-outline"
                  />
                ) : visible.length === 0 ? (
                  <AnalyticsChartEmptyState
                    compact
                    title="Choose a specialty to compare"
                    description="Tap a specialty above to show its weekly activity."
                    icon="tag-outline"
                  />
                ) : sparse ? (
                  <>
                    <AnalyticsChartEmptyState
                      title="Not enough weeks to show a trend yet"
                      description={
                        observedWeeks === 0
                          ? "Dated counts are unavailable; missing weeks are not zero."
                          : "Available weekly counts are shown below."
                      }
                    />
                    {exactValues}
                  </>
                ) : (
                  <>
                    <View
                      className="flex-row"
                      accessible
                      accessibilityRole="image"
                      accessibilityLabel="Weekly specialty vouches. Lines share the same count scale. Solid, dashed, and dotted lines distinguish specialties in the order shown. Open exact values for counts."
                    >
                      <Svg
                        width={axisWidth}
                        height={chartHeight}
                        accessible={false}
                      >
                        {ticks.map((tick) => (
                          <SvgText
                            key={tick}
                            x={axisWidth - 6}
                            y={y(tick) + 4}
                            textAnchor="end"
                            fontSize={11 * scale}
                            fontFamily="NunitoSans_400Regular"
                            fill={theme.extends.colors.text.secondary}
                          >
                            {tickFormatter.format(tick)}
                          </SvgText>
                        ))}
                      </Svg>
                      <ScrollView
                        horizontal
                        style={{ flex: 1 }}
                        showsHorizontalScrollIndicator
                        contentContainerStyle={{ height: chartHeight }}
                      >
                        <Svg
                          width={chartWidth}
                          height={chartHeight}
                          accessible={false}
                        >
                          {ticks.map((tick) => (
                            <Line
                              key={tick}
                              x1={0}
                              x2={chartWidth}
                              y1={y(tick)}
                              y2={y(tick)}
                              stroke={theme.extends.colors.border.primary}
                              strokeDasharray="3 4"
                            />
                          ))}
                          {visible.map((row) => (
                            <SvgSeries
                              key={row.specialty_id}
                              row={row}
                              step={step}
                              inset={edgeInset}
                              y={y}
                            />
                          ))}
                          {slots.map((slot, index) => (
                            <SvgText
                              key={slot.date}
                              x={edgeInset + index * step}
                              y={201}
                              textAnchor={
                                index === 0
                                  ? "start"
                                  : index === slots.length - 1
                                    ? "end"
                                    : "middle"
                              }
                              fontSize={11 * scale}
                              fontFamily="NunitoSans_400Regular"
                              fill={theme.extends.colors.text.secondary}
                            >
                              {shortAnalyticsDate(
                                `${slot.date}T00:00:00+08:00`,
                              )}
                            </SvgText>
                          ))}
                        </Svg>
                      </ScrollView>
                    </View>
                    <View className="gap-2">
                      {visible.map((row) => (
                        <View
                          key={row.specialty_id}
                          className="flex-row items-center gap-2"
                        >
                          <Svg width={26} height={12} accessible={false}>
                            <Line
                              x1={0}
                              x2={26}
                              y1={6}
                              y2={6}
                              stroke={row.color}
                              strokeWidth={2}
                              strokeDasharray={row.dash}
                            />
                          </Svg>
                          <AppText className="min-w-0 flex-1 text-xs text-text-secondary">
                            {row.specialty_name}
                          </AppText>
                        </View>
                      ))}
                    </View>
                    <SafePressable
                      accessibilityRole="button"
                      accessibilityState={{ expanded: showValues }}
                      onPress={() => setShowValues((value) => !value)}
                      className="min-h-11 cursor-pointer flex-row items-center justify-between"
                    >
                      <View className="min-w-0 flex-1 flex-row items-center gap-2">
                        <MaterialCommunityIcons
                          name="format-list-bulleted"
                          size={19}
                          color={theme.extends.colors.text.secondary}
                          accessible={false}
                        />
                        <AppText
                          weight="semibold"
                          className="min-w-0 flex-1 text-sm text-text-primary"
                        >
                          {showValues
                            ? "Hide exact values"
                            : "View exact values"}
                        </AppText>
                      </View>
                      <MaterialCommunityIcons
                        name={showValues ? "chevron-up" : "chevron-down"}
                        size={20}
                        color={theme.extends.colors.text.secondary}
                        accessible={false}
                      />
                    </SafePressable>
                    {showValues && exactValues}
                  </>
                )}
              </View>
              <View className="gap-4 border-t border-border-primary/60 pt-5">
                <AppText
                  accessibilityRole="header"
                  weight="bold"
                  className="text-base text-text-primary"
                >
                  Specialty breakdown
                </AppText>
                <AppText className="text-sm text-text-secondary">
                  Share of vouches added during these dates that still count
                </AppText>
                {total > 0 ? (
                  <View className="items-center py-2">
                    <View
                      accessible
                      accessibilityRole="image"
                      accessibilityLabel={`Specialty vouch distribution, ${total} qualifying vouches. ${rows.map((row) => `${row.specialty_name}: ${row.added_and_still_valid}`).join(". ")}`}
                      style={{ width: 200, height: 200 }}
                    >
                      <Svg width={200} height={200} accessible={false}>
                        {rows.map((row, index) => {
                          const circumference = 2 * Math.PI * 80;
                          const offset =
                            rows
                              .slice(0, index)
                              .reduce(
                                (sum, item) => sum + item.added_and_still_valid,
                                0,
                              ) / total;
                          const segment =
                            (row.added_and_still_valid / total) * circumference;
                          if (segment === 0) return null;
                          return (
                            <Circle
                              key={row.specialty_id}
                              cx={100}
                              cy={100}
                              r={80}
                              fill="none"
                              stroke={row.color}
                              strokeWidth={22}
                              strokeDasharray={`${segment} ${circumference - segment}`}
                              strokeDashoffset={-offset * circumference}
                              rotation={-90}
                              origin="100, 100"
                            />
                          );
                        })}
                      </Svg>
                      <View
                        pointerEvents="none"
                        accessible={false}
                        className="absolute inset-0 items-center justify-center px-10"
                      >
                        <AppText
                          weight="bold"
                          className="text-2xl tabular-nums text-text-primary"
                          style={{ textAlign: "center" }}
                        >
                          {total.toLocaleString("en-PH")}
                        </AppText>
                        <AppText className="text-xs text-text-secondary">
                          Vouches
                        </AppText>
                      </View>
                    </View>
                  </View>
                ) : (
                  <AppText className="text-sm text-text-secondary">
                    No qualifying vouches to show as a distribution.
                  </AppText>
                )}
                {rows.map((row) => (
                  <View
                    key={row.specialty_id}
                    className="flex-row items-start gap-3 border-b border-border-primary/60 pb-4"
                  >
                    <MaterialCommunityIcons
                      name={row.icon}
                      size={21}
                      color={row.color}
                      accessible={false}
                    />
                    <View className="min-w-0 flex-1 gap-1">
                      <AppText
                        weight="semibold"
                        className="text-sm text-text-primary"
                      >
                        {row.specialty_name}
                      </AppText>
                      <AppText className="text-xs text-text-secondary">
                        {row.distinct_supporters.toLocaleString("en-PH")}{" "}
                        supporting accounts
                      </AppText>
                    </View>
                    <View className="items-end gap-1">
                      <AppText
                        weight="bold"
                        className="text-base tabular-nums text-text-primary"
                      >
                        {row.added_and_still_valid.toLocaleString("en-PH")}
                      </AppText>
                      {total > 0 && (
                        <AppText className="text-xs tabular-nums text-text-secondary">
                          {(
                            (row.added_and_still_valid / total) *
                            100
                          ).toLocaleString("en-PH", {
                            maximumFractionDigits: 1,
                          })}
                          %
                        </AppText>
                      )}
                    </View>
                  </View>
                ))}
              </View>
            </>
          ))
        )}
      </View>
      <SelectionBottomSheet
        sheetRef={periodRef}
        title="Reporting period"
        options={OPTIONS}
        selectedValue={period}
        onSelect={(value) => {
          if (value === "7" || value === "30" || value === "90")
            onPeriodChange?.(value);
        }}
        snapPoints={["50%"]}
      />
      <AnalyticsReportSheet
        sheetRef={informationRef}
        title="About specialty vouch trends"
        closeLabel="Close specialty trend information"
      >
        <View className="gap-5">
          {[
            {
              icon: "thumb-up-outline",
              title: "What counts",
              text: "Counts vouches added during the reporting dates that still qualify today on active specialties. One account may vouch for more than one specialty, so supporting account counts cannot be added together.",
            },
            {
              icon: "calendar-range",
              title: "Weekly activity",
              text: "Weeks use local reporting dates. First and last weeks may cover fewer days. Exact values identify partial weeks. Missing observations are not replaced with zeros or connected across gaps.",
            },
            {
              icon: "information-outline",
              title: "Not historical growth",
              text: "These are weekly additions that remain valid, not historical support totals or net growth. Removed vouches and inactive specialties can change earlier counts. The total and breakdown include all specialties even when a chart line is hidden.",
            },
          ].map((rule) => (
            <View key={rule.title} className="flex-row items-start gap-3">
              <MaterialCommunityIcons
                name={
                  rule.icon as ComponentProps<
                    typeof MaterialCommunityIcons
                  >["name"]
                }
                size={20}
                color={theme.extends.colors.text.secondary}
                accessible={false}
              />
              <View className="min-w-0 flex-1 gap-1">
                <AppText
                  weight="semibold"
                  className="text-sm text-text-primary"
                >
                  {rule.title}
                </AppText>
                <AppText className="text-sm leading-6 text-text-secondary">
                  {rule.text}
                </AppText>
              </View>
            </View>
          ))}
          {report && (
            <PlusReportContext
              meta={report.meta}
              note={`Valid as of ${formatOptionalAnalyticsTimestamp(report.snapshot_as_of)}. Earlier counts may change when eligibility changes.`}
            />
          )}
        </View>
      </AnalyticsReportSheet>
    </>
  );
}

type SeriesRow = {
  slots: ReturnType<typeof buildAnalyticsCalendar>;
  color: string;
  dash: string | undefined;
};
function SvgSeries({
  row,
  step,
  inset,
  y,
}: {
  row: SeriesRow;
  step: number;
  inset: number;
  y: (value: number) => number;
}) {
  return (
    <>
      {row.slots.map((slot, index) => {
        const value = slot.observation?.value;
        if (value === undefined) return null;
        return (
          <Circle
            key={slot.date}
            cx={inset + index * step}
            cy={y(value)}
            r={3}
            fill={row.color}
          />
        );
      })}
      {row.slots.map((slot, index) => {
        const value = slot.observation?.value;
        const previous = row.slots[index - 1]?.observation?.value;
        if (value === undefined || previous === undefined) return null;
        return (
          <Line
            key={slot.date}
            x1={inset + (index - 1) * step}
            x2={inset + index * step}
            y1={y(previous)}
            y2={y(value)}
            stroke={row.color}
            strokeWidth={2}
            strokeDasharray={row.dash}
          />
        );
      })}
    </>
  );
}
