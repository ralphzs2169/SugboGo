import { MaterialCommunityIcons } from "@expo/vector-icons";
import type { BottomSheetModal } from "@gorhom/bottom-sheet";
import {
  useState,
  type ComponentProps,
  type ReactNode,
  type RefObject,
} from "react";
import { View } from "react-native";

import { theme } from "@/constants/theme";
import AppText from "@/shared/components/AppText";
import SafePressable from "@/shared/components/SafePressable";

import type { PlusPocketReport } from "../../types/merchantPlusAnalytics.types";
import {
  formatAnalyticsCount,
  formatAnalyticsDate,
} from "../../utils/merchantAnalytics.utils";

import AnalyticsReportSheet from "./AnalyticsReportSheet";
import { PlusReportContext } from "./AnalyticsPlusStates";

type Props = {
  sheetRef: RefObject<BottomSheetModal | null>;
  report?: PlusPocketReport;
};

type RuleIcon = ComponentProps<typeof MaterialCommunityIcons>["name"];

type MeasurementRuleProps = {
  icon: RuleIcon;
  title: string;
  children: ReactNode;
};

/**
 * Presents one measurement definition with a subtle icon
 * and readable supporting explanation.
 */
function MeasurementRule({ icon, title, children }: MeasurementRuleProps) {
  return (
    <View className="flex-row items-start gap-3">
      {/* Neutral icon matching other Analytics information sheets */}
      <View className="h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-surface-muted">
        <MaterialCommunityIcons
          name={icon}
          size={19}
          color={theme.extends.colors.text.secondary}
          accessible={false}
        />
      </View>

      {/* Measurement title and description */}
      <View className="min-w-0 flex-1 gap-1">
        <AppText weight="semibold" className="text-sm text-text-primary">
          {title}
        </AppText>

        <AppText className="text-sm leading-6 text-text-secondary">
          {children}
        </AppText>
      </View>
    </View>
  );
}

/**
 * Explains recorded Pocket saves, saving-account counts,
 * and weekly chart behavior through a consistent analytics sheet.
 *
 * Keeps reporting boundaries, coverage details, and historical
 * limitations accessible in a collapsible technical section.
 */
export default function AnalyticsPocketMeasurementSheet({
  sheetRef,
  report,
}: Props) {
  const [showDetails, setShowDetails] = useState(false);

  const saves = report?.metrics.saves;

  return (
    <AnalyticsReportSheet
      sheetRef={sheetRef}
      title="About Pocket activity"
      description="Understand how saves are measured."
      closeLabel="Close Pocket information"
      onDismiss={() => setShowDetails(false)}
    >
      {/* Main measurement definitions */}
      <View className="gap-5">
        <MeasurementRule icon="bookmark-outline" title="Recorded saves">
          Each explorer account can contribute one recorded save per business
          per UTC day. Saving on another day can add another recorded save.
        </MeasurementRule>

        <View className="h-px bg-border-primary/60" />

        <MeasurementRule
          icon="account-multiple-outline"
          title="Saving accounts"
        >
          Counts distinct explorer accounts that saved your business during the
          selected dates. Each account is counted once for the entire period.
        </MeasurementRule>

        <View className="h-px bg-border-primary/60" />

        <MeasurementRule icon="chart-line" title="Reading the chart">
          Each point represents recorded saves for its reporting interval. Lines
          connect consecutive intervals with recorded data; missing intervals
          remain gaps. A recorded zero is different from missing data. Partial
          intervals may cover less time. When there are too few points for a
          useful trend, exact recorded counts are shown instead.
        </MeasurementRule>
      </View>

      {/* Expandable reporting rules and source coverage details */}
      <View className="mt-6 border-t border-border-primary/60 pt-2">
        <SafePressable
          accessibilityRole="button"
          accessibilityLabel="Detailed Pocket measurement information"
          accessibilityState={{ expanded: showDetails }}
          onPress={() => setShowDetails((current) => !current)}
          className="min-h-12 flex-row cursor-pointer items-center justify-between gap-3 py-3 active:opacity-70"
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

        {showDetails && (
          <View className="gap-5 pb-4 pt-2">
            {/* Exact reporting dates require a loaded report; static definitions remain available. */}
            {saves && report && (
              <>
                <View className="gap-1">
                  <AppText
                    weight="semibold"
                    className="text-sm text-text-primary"
                  >
                    Reporting dates
                  </AppText>

                  <AppText className="text-sm leading-6 text-text-secondary">
                    {formatAnalyticsDate(
                      saves.sources.current.period.start_date,
                    )}{" "}
                    –{" "}
                    {formatAnalyticsDate(saves.sources.current.period.end_date)}{" "}
                    · Manila time
                  </AppText>
                </View>

                {/* Existing coverage and measurement disclosures */}
                <View className="gap-2">
                  <AppText
                    weight="semibold"
                    className="text-sm text-text-primary"
                  >
                    Measurement information
                  </AppText>

                  <PlusReportContext
                    meta={saves.sources.current}
                    note={report.measurement_note}
                  >
                    <AppText className="text-sm leading-6 text-text-secondary">
                      Previous period:{" "}
                      {formatAnalyticsDate(
                        saves.sources.previous.period.start_date,
                      )}{" "}
                      –{" "}
                      {formatAnalyticsDate(
                        saves.sources.previous.period.end_date,
                      )}
                      . Recorded saves:{" "}
                      {formatAnalyticsCount(saves.previous_value)}
                      {saves.previous_value === null
                        ? ". The previous count is unavailable."
                        : "."}{" "}
                      These records cannot reliably establish business growth.
                    </AppText>
                  </PlusReportContext>
                </View>
              </>
            )}

            {/* Clarification of historical saves versus current holders */}
            <View className="gap-1">
              <AppText weight="semibold" className="text-sm text-text-primary">
                Current Pocket holders
              </AppText>

              <AppText className="text-sm leading-6 text-text-secondary">
                These metrics describe recorded saving activity, not how many
                accounts currently have your business saved. Removing a business
                from a Pocket does not erase an earlier recorded save.
              </AppText>
            </View>
          </View>
        )}
      </View>
    </AnalyticsReportSheet>
  );
}
