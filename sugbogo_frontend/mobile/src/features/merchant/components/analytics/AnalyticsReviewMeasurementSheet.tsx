import { MaterialCommunityIcons } from "@expo/vector-icons";
import type { BottomSheetModal } from "@gorhom/bottom-sheet";
import { useState, type RefObject } from "react";
import { View } from "react-native";
import { theme } from "@/constants/theme";
import AppText from "@/shared/components/AppText";
import SafePressable from "@/shared/components/SafePressable";
import type { PlusReviewPerformanceReport } from "../../types/merchantPlusAnalytics.types";
import AnalyticsReportSheet from "./AnalyticsReportSheet";
import { PlusReportContext } from "./AnalyticsPlusStates";

const RULES = [
  {
    icon: "comment-text-outline",
    title: "New reviews",
    text: "Counts reviews created during the selected dates that are still published when the report is prepared. It is not a record of every past publication or removal.",
  },
  {
    icon: "message-reply-text-outline",
    title: "Your replies",
    text: "The reply rate is the share of this period’s published reviews with a valid merchant reply at the reporting cutoff. Comparisons use percentage points (pp). Recent reviews have had less time to receive replies.",
  },
  {
    icon: "clock-outline",
    title: "Typical reply time",
    text: "Uses the median: the middle time after reply times are ordered from shortest to longest. Only replies with valid timestamps are included. One reply does not establish a typical response time. Deleted and recreated replies do not preserve the original reply history.",
  },
] as const;

/** Makes review definitions and sample limitations available without overwhelming the report. */
export default function AnalyticsReviewMeasurementSheet({
  sheetRef,
  report,
}: {
  sheetRef: RefObject<BottomSheetModal | null>;
  report?: PlusReviewPerformanceReport;
}) {
  const [details, setDetails] = useState(false);
  return (
    <AnalyticsReportSheet
      sheetRef={sheetRef}
      title="About review activity"
      description="Understand customer feedback and your responses."
      closeLabel="Close review activity information"
      onDismiss={() => setDetails(false)}
    >
      {/* Familiar neutral section icons and concise metric explanations. */}
      <View className="gap-5">
        {RULES.map((rule, index) => (
          <View
            key={rule.title}
            className={`flex-row items-start gap-3 ${index ? "border-t border-border-primary/60 pt-4" : ""}`}
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
      {/* Reporting dates, backend notes, and excluded timings remain in the sheet. */}
      <SafePressable
        accessibilityRole="button"
        accessibilityState={{ expanded: details }}
        onPress={() => setDetails((current) => !current)}
        className="mt-5 min-h-12 cursor-pointer flex-row items-center justify-between gap-3 border-t border-border-primary/60 py-3"
      >
        <AppText
          weight="semibold"
          className="min-w-0 flex-1 text-sm text-text-primary"
        >
          Detailed rules and sources
        </AppText>
        <MaterialCommunityIcons
          name={details ? "chevron-up" : "chevron-down"}
          size={21}
          color={theme.extends.colors.text.secondary}
          accessible={false}
        />
      </SafePressable>
      {details &&
        (report ? (
          <View className="gap-3">
            {report.excluded_reply_timestamp_count > 0 && (
              <AppText className="text-sm leading-6 text-text-secondary">
                {report.excluded_reply_timestamp_count} replies with unusable
                timing data were excluded.
              </AppText>
            )}
            <PlusReportContext
              meta={report.meta}
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
