import { MaterialCommunityIcons } from "@expo/vector-icons";
import type { BottomSheetModal } from "@gorhom/bottom-sheet";
import { useState, type RefObject } from "react";
import { View } from "react-native";
import { theme } from "@/constants/theme";
import AppText from "@/shared/components/AppText";
import SafePressable from "@/shared/components/SafePressable";
import type { PlusProfileTimingReport } from "../../types/merchantAdvancedAnalytics.types";
import AnalyticsReportSheet from "./AnalyticsReportSheet";
import { PlusReportContext } from "./AnalyticsPlusStates";

const RULES = [
  {
    icon: "eye-outline",
    title: "Online profile visits",
    text: "These are recorded business-profile openings, not physical customer arrivals.",
  },
  {
    icon: "calendar-clock",
    title: "Days and hours",
    text: "Each box combines the same weekday and hour across the selected dates, using Manila time. Included dates do not confirm complete tracking or that your business was open.",
  },
  {
    icon: "view-grid-outline",
    title: "Reading the heatmap",
    text: "Darker orange means more recorded visits on one shared count scale. Empty boxes represent recorded zeros, a dash means unavailable data, and a cross means outside the reporting period. Tap a box for exact values and partial-hour details.",
  },
  {
    icon: "account-outline",
    title: "Daily counting",
    text: "Each account contributes at most one recorded profile visit per business per UTC day. This is not a count of every opening or a recommendation for opening hours.",
  },
] as const;

/** Keeps timing definitions and source limitations available without crowding the heatmap. */
export default function AnalyticsTimingMeasurementSheet({
  sheetRef,
  report,
}: {
  sheetRef: RefObject<BottomSheetModal | null>;
  report?: PlusProfileTimingReport;
}) {
  const [showDetails, setShowDetails] = useState(false);
  return (
    <AnalyticsReportSheet
      sheetRef={sheetRef}
      title="About visit timing"
      description="Understand recorded visits by day and hour."
      closeLabel="Close visit-timing information"
      onDismiss={() => setShowDetails(false)}
    >
      {/* Neutral informational sections match the other polished measurement sheets. */}
      <View className="gap-5">
        {RULES.map((rule, index) => (
          <View
            key={rule.title}
            className={`flex-row items-start gap-3 ${index > 0 ? "border-t border-border-primary/60 pt-4" : ""}`}
          >
            <View className="h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-surface-muted">
              <MaterialCommunityIcons
                name={rule.icon}
                size={19}
                color={theme.extends.colors.text.secondary}
                accessible={false}
              />
            </View>
            <View className="min-w-0 flex-1 gap-1">
              <AppText weight="semibold" className="text-sm text-text-primary">
                {rule.title}
              </AppText>
              <AppText className="text-sm leading-6 text-text-secondary">
                {rule.text}
              </AppText>
            </View>
          </View>
        ))}
      </View>
      {/* Backend sufficiency and coverage remain authoritative and independently readable. */}
      <SafePressable
        accessibilityRole="button"
        accessibilityLabel="Detailed visit-timing measurements"
        accessibilityState={{ expanded: showDetails }}
        onPress={() => setShowDetails((current) => !current)}
        className="mt-5 min-h-12 cursor-pointer flex-row items-center justify-between gap-3 border-t border-border-primary/60 py-3"
      >
        <AppText
          weight="semibold"
          className="min-w-0 flex-1 text-sm text-text-primary"
        >
          Detailed rules and sources
        </AppText>
        <MaterialCommunityIcons
          name={showDetails ? "chevron-up" : "chevron-down"}
          size={21}
          color={theme.extends.colors.text.secondary}
          accessible={false}
        />
      </SafePressable>
      {showDetails &&
        (report ? (
          <View className="gap-4">
            {!report.sample.conclusions_available && (
              <AppText className="text-sm leading-6 text-text-secondary">
                These records cannot reliably identify your busiest hours or
                guide opening hours.
              </AppText>
            )}
            <AppText className="text-sm leading-6 text-text-secondary">
              {report.period_occurrences_note}
            </AppText>
            <PlusReportContext
              meta={report.sources.visibility}
              note={report.measurement_note}
            />
          </View>
        ) : (
          <AppText className="text-sm text-text-secondary">
            Reporting details will appear when the report loads.
          </AppText>
        ))}
    </AnalyticsReportSheet>
  );
}
