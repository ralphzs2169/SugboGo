import { useState } from "react";
import { View } from "react-native";
import AppText from "@/shared/components/AppText";
import type { PlusProfileTimingReport } from "../../types/merchantAdvancedAnalytics.types";
import AnalyticsChoiceChips from "./AnalyticsChoiceChips";
import AnalyticsChartEmptyState from "./AnalyticsChartEmptyState";
import { PlusReportContext } from "./AnalyticsPlusStates";

/** Focuses one backend-ordered weekday at a time so every hourly value remains readable. */
export default function AnalyticsProfileVisitTiming({
  report,
  retry,
}: {
  report: PlusProfileTimingReport;
  retry: () => void;
}) {
  const [weekday, setWeekday] = useState("");
  const selected =
    report.weekdays.find((day) => String(day.weekday) === weekday) ??
    report.weekdays[0];
  const maximum = report.legend.maximum;
  return (
    <View className="gap-5">
      {/* Online observations are never interpreted as arrivals or operating-hour advice. */}
      <View>
        <AppText className="text-sm text-text-secondary">
          Recorded online profile visits · selected period
        </AppText>
        <AppText
          accessibilityLabel={`Timing profile visits: ${report.total_profile_visits ?? "Unavailable"}`}
          weight="bold"
          className="mt-1 text-3xl text-text-primary"
        >
          {report.total_profile_visits?.toLocaleString("en-PH") ?? "—"}
        </AppText>
        <AppText className="mt-2 text-sm leading-5 text-text-secondary">
          Recorded online visits, not physical customer arrivals ·{" "}
          {report.timezone}.
          {!report.sample.conclusions_available
            ? " These records cannot reliably identify your busiest hours or guide opening hours."
            : ""}
        </AppText>
      </View>
      {report.display_state === "visibility_unavailable" ? (
        <AnalyticsChartEmptyState
          title="Profile-visit timing unavailable"
          description="Recorded visit data could not be loaded. Unavailable counts do not mean zero visits."
          icon="cloud-off-outline"
          onRetry={retry}
        />
      ) : report.display_state === "zero_recorded_visits" ? (
        <AnalyticsChartEmptyState
          title="No recorded profile visits in this period"
          description="No online profile visits were recorded during these dates. Some activity may not be recorded."
          icon="clock-outline"
        />
      ) : (
        <View className="gap-3">
          <AnalyticsChoiceChips
            label="Day of week"
            options={report.weekdays.map((day) => ({
              value: String(day.weekday),
              label: day.label,
            }))}
            value={String(selected?.weekday ?? "")}
            onChange={setWeekday}
          />
          <AppText weight="semibold" className="text-base text-text-primary">
            {selected?.label} · hours in {report.timezone}
          </AppText>
          {/* Backend ordering and explicit cell states are preserved, including nulls. */}
          {report.hours.map((hour) => {
            const cell = report.cells.find(
              (item) =>
                item.weekday === selected?.weekday && item.hour === hour,
            );
            const count =
              cell?.state === "outside_period" ||
              cell?.state === "visibility_unavailable"
                ? null
                : cell?.profile_visits;
            const value =
              cell?.state === "outside_period"
                ? "Outside period"
                : count === null || count === undefined
                  ? "Unavailable"
                  : String(count);
            const hourLabel = `${String(hour).padStart(2, "0")}:00–${String((hour + 1) % 24).padStart(2, "0")}:00`;
            return (
              <View
                key={hour}
                accessible
                accessibilityLabel={`${selected?.label}, ${hourLabel}: ${value}${cell?.includes_partial_hour ? ", includes a partial hour" : ""}`}
                className="min-h-12 gap-1 border-b border-border-primary py-2"
              >
                <View className="flex-row items-center gap-3">
                  <AppText className="w-28 text-sm text-text-secondary">
                    {hourLabel}
                  </AppText>
                  <View
                    accessible={false}
                    className="h-2 min-w-0 flex-1 overflow-hidden rounded-full bg-surface-muted"
                  >
                    {count !== null &&
                      count !== undefined &&
                      count > 0 &&
                      maximum !== null &&
                      maximum > 0 && (
                        <View
                          className="h-full rounded-full bg-brand"
                          style={{
                            width: `${Math.min(100, (count / maximum) * 100)}%`,
                          }}
                        />
                      )}
                  </View>
                  <AppText
                    weight="semibold"
                    className="text-sm text-text-primary"
                  >
                    {value}
                  </AppText>
                </View>
                {cell && (
                  <AppText className="text-xs text-text-secondary">
                    Includes this hour on {cell.period_occurrences} dates
                    {cell.includes_partial_hour
                      ? " · includes a partial hour"
                      : ""}
                  </AppText>
                )}
              </View>
            );
          })}
        </View>
      )}
      <PlusReportContext
        meta={report.sources.visibility}
        note={report.measurement_note}
      >
        <AppText className="text-sm leading-5 text-text-secondary">
          Each row combines the same weekday and hour across the selected dates.
          The number of included dates does not confirm that tracking was
          complete or that your business was open.
        </AppText>
        <AppText className="text-sm leading-5 text-text-secondary">
          {report.period_occurrences_note}
        </AppText>
        <AppText className="text-sm leading-5 text-text-secondary">
          {report.sample.nonzero_cells ?? "Unavailable"} weekday and hour
          combinations have recorded visits.
        </AppText>
      </PlusReportContext>
    </View>
  );
}
