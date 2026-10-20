import { MaterialCommunityIcons } from "@expo/vector-icons";
import type { BottomSheetModal } from "@gorhom/bottom-sheet";
import { useRef, useState } from "react";
import { ScrollView, View, useWindowDimensions } from "react-native";
import AppText from "@/shared/components/AppText";
import SafePressable from "@/shared/components/SafePressable";
import { theme } from "@/constants/theme";
import AnalyticsReportSheet from "./AnalyticsReportSheet";
import type {
  PlusProfileTimingReport,
  ProfileTimingCell,
} from "../../types/merchantAdvancedAnalytics.types";

function cellValue(cell?: ProfileTimingCell) {
  if (cell?.state === "outside_period") return "Outside period";
  if (
    !cell ||
    cell.state === "visibility_unavailable" ||
    cell.profile_visits === null
  )
    return "Unavailable";
  return cell.profile_visits.toLocaleString("en-PH");
}

function hourLabel(hour: number) {
  return `${String(hour).padStart(2, "0")}:00–${String((hour + 1) % 24).padStart(2, "0")}:00`;
}

/** Shows the backend's weekday/hour distribution on one shared scale without inferring busy hours. */
export default function AnalyticsTimingHeatmap({
  report,
}: {
  report: PlusProfileTimingReport;
}) {
  const { fontScale } = useWindowDimensions();
  const size = 44 * Math.max(1, Math.min(fontScale, 1.5));
  const [selection, setSelection] = useState<{
    weekday: number;
    hour: number;
  } | null>(null);
  const detailSheetRef = useRef<BottomSheetModal>(null);
  const cells = new Map(
    report.cells.map((cell) => [`${cell.weekday}:${cell.hour}`, cell]),
  );
  const hasUnavailable = report.weekdays.some((day) =>
    report.hours.some(
      (hour) =>
        cellValue(cells.get(`${day.weekday}:${hour}`)) === "Unavailable",
    ),
  );
  const hasOutsidePeriod = report.cells.some(
    (cell) => cell.state === "outside_period",
  );
  const selected = selection
    ? cells.get(`${selection.weekday}:${selection.hour}`)
    : undefined;
  const selectedDay = report.weekdays.find(
    (day) => day.weekday === selection?.weekday,
  );
  const maximum = report.legend.maximum;
  const selectedHasCount =
    selected != null &&
    selected.state !== "outside_period" &&
    selected.state !== "visibility_unavailable" &&
    selected.profile_visits !== null;

  return (
    <View className="gap-3">
      {/* Weekday labels stay fixed while all 24 hourly columns scroll together. */}
      <View className="flex-row">
        <View style={{ width: 48 * Math.max(1, fontScale) }}>
          <View style={{ height: size }} />
          {report.weekdays.map((day) => (
            <View
              key={day.weekday}
              style={{ height: size }}
              className="justify-center"
            >
              <AppText className="text-xs text-text-secondary">
                {day.label.slice(0, 3)}
              </AppText>
            </View>
          ))}
        </View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator
          testID="timing-heatmap-scroll"
          style={{ flex: 1 }}
        >
          <View>
            <View className="flex-row">
              {report.hours.map((hour, index) => (
                <View
                  key={hour}
                  style={{ width: size, height: size }}
                  className="justify-center"
                >
                  {index % 3 === 0 && (
                    <AppText className="text-xs text-text-secondary">
                      {hour % 12 || 12}
                      {hour < 12 ? " AM" : " PM"}
                    </AppText>
                  )}
                </View>
              ))}
            </View>
            {report.weekdays.map((day) => (
              <View key={day.weekday} className="flex-row">
                {report.hours.map((hour) => {
                  const cell = cells.get(`${day.weekday}:${hour}`);
                  const value = cellValue(cell);
                  const unavailable =
                    value === "Unavailable" || value === "Outside period";
                  const count = unavailable ? null : cell?.profile_visits;
                  const active =
                    selection?.weekday === day.weekday &&
                    selection.hour === hour;
                  return (
                    <SafePressable
                      key={hour}
                      accessibilityRole="button"
                      accessibilityLabel={`${day.label}, ${hourLabel(hour)}: ${value}${cell?.includes_partial_hour ? ", includes a partial hour" : ""}`}
                      accessibilityHint="Opens hourly visit details in a bottom sheet"
                      accessibilityState={{ selected: active }}
                      onPress={() => {
                        setSelection({ weekday: day.weekday, hour });
                        detailSheetRef.current?.present();
                      }}
                      style={{ width: size, height: size }}
                      className={`cursor-pointer rounded-lg p-1 ${active ? "border-2 border-text-info" : "border-2 border-transparent"}`}
                    >
                      <View className="flex-1 items-center justify-center overflow-hidden rounded bg-surface-muted">
                        {count != null && count > 0 && (
                          <View
                            className="absolute inset-0 bg-brand"
                            style={{
                              opacity:
                                maximum != null && maximum > 0
                                  ? Math.min(1, count / maximum)
                                  : 0.18,
                            }}
                          />
                        )}
                        {unavailable && (
                          <AppText
                            accessible={false}
                            className="text-xs text-text-secondary"
                          >
                            {value === "Outside period" ? "×" : "—"}
                          </AppText>
                        )}
                      </View>
                    </SafePressable>
                  );
                })}
              </View>
            ))}
          </View>
        </ScrollView>
      </View>

      {/* A single legend applies to every weekday and hour. */}
      <View className="flex-row flex-wrap items-center justify-between gap-3">
        <View
          className="flex-row items-center gap-1.5"
          accessible
          accessibilityLabel={`Shared count scale: zero to ${maximum ?? "unavailable"} recorded visits.`}
        >
          <AppText className="text-xs text-text-secondary">0</AppText>
          <View className="h-3 w-3 rounded-sm bg-surface-muted" />
          {[0.25, 0.5, 0.75, 1].map((opacity) => (
            <View
              key={opacity}
              className="h-3 w-3 rounded-sm bg-brand"
              style={{ opacity }}
            />
          ))}
          <AppText className="text-xs text-text-secondary">
            {maximum ?? "—"}
          </AppText>
        </View>
        <AppText className="text-xs text-text-secondary">
          Swipe for more →
        </AppText>
      </View>
      {(hasUnavailable || hasOutsidePeriod) && (
        <View className="flex-row flex-wrap gap-x-4 gap-y-2">
          {hasUnavailable && (
            <AppText
              accessibilityLabel="Dash: data unavailable"
              className="text-xs text-text-secondary"
            >
              — Data unavailable
            </AppText>
          )}
          {hasOutsidePeriod && (
            <AppText
              accessibilityLabel="Cross: outside selected dates"
              className="text-xs text-text-secondary"
            >
              × Outside selected dates
            </AppText>
          )}
        </View>
      )}

      <AppText className="text-sm text-text-secondary">
        Tap a box for its exact count.
      </AppText>

      {/* Compact cell details reuse report-sheet dismissal and Android back handling. */}
      <AnalyticsReportSheet
        sheetRef={detailSheetRef}
        title={selectedDay?.label ?? "Hourly visits"}
        description={
          selection
            ? `${hourLabel(selection.hour)} · Philippine time`
            : undefined
        }
        closeLabel="Close hourly visit details"
        snapPoints={["40%", "65%"]}
        stackBehavior="replace"
        onDismiss={() => setSelection(null)}
      >
        {selection && (
          <View className="gap-5">
            <View className="gap-2">
              <View className="flex-row items-center gap-2">
                <MaterialCommunityIcons
                  name="eye-outline"
                  size={18}
                  color={theme.extends.colors.text.secondary}
                  accessible={false}
                />
                <AppText className="text-sm text-text-secondary">
                  Recorded profile visits
                </AppText>
              </View>
              <AppText
                weight="bold"
                className={`tabular-nums text-text-primary ${selectedHasCount ? "text-4xl" : "text-xl"}`}
                accessibilityLabel={`Hourly recorded profile visits: ${cellValue(selected)}`}
              >
                {cellValue(selected)}
              </AppText>
            </View>
            {selected && selectedHasCount ? (
              <View className="gap-3 border-t border-border-primary/60 pt-4">
                <View className="flex-row items-start gap-2">
                  <MaterialCommunityIcons
                    name="calendar-outline"
                    size={18}
                    color={theme.extends.colors.text.secondary}
                    accessible={false}
                  />
                  <AppText className="min-w-0 flex-1 text-sm leading-5 text-text-secondary">
                    Across this hour on {selected.period_occurrences} dates
                  </AppText>
                </View>
                {selected.includes_partial_hour && (
                  <View className="flex-row items-start gap-2">
                    <MaterialCommunityIcons
                      name="clock-outline"
                      size={18}
                      color={theme.extends.colors.text.secondary}
                      accessible={false}
                    />
                    <AppText className="min-w-0 flex-1 text-sm leading-5 text-text-secondary">
                      Includes a partial hour
                    </AppText>
                  </View>
                )}
              </View>
            ) : (
              <AppText className="text-sm leading-6 text-text-secondary">
                {selected?.state === "outside_period"
                  ? "This weekday and hour fall outside the selected reporting period."
                  : "The count for this hour is unavailable. This does not mean zero visits."}
              </AppText>
            )}
          </View>
        )}
      </AnalyticsReportSheet>
    </View>
  );
}
