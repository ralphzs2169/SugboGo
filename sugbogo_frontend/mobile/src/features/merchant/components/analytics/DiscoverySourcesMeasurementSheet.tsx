import { MaterialCommunityIcons } from "@expo/vector-icons";
import type { BottomSheetModal } from "@gorhom/bottom-sheet";
import type { RefObject } from "react";
import { View } from "react-native";
import AppText from "@/shared/components/AppText";
import { theme } from "@/constants/theme";
import AnalyticsReportSheet from "./AnalyticsReportSheet";

const NOTES = [
  "Each account contributes at most one recorded profile visit per business per UTC day. A new UTC day starts at 8 AM in Manila.",
  "The first successfully recorded source that day is preserved. Later openings through other sources do not replace it.",
  "Sources are reported by the app, not independently verified. Delivery may be incomplete.",
  "Historical visits and visits from unclassified entry points may appear under Source not recorded.",
  "These are online business-profile openings, not confirmed physical visits.",
];

const RULE_ICONS = [
  "calendar-today",
  "source-branch",
  "cellphone",
  "help-circle-outline",
  "eye-outline",
] as const;

/** Explains first-recorded attribution without changing the Standard access contract. */
export default function DiscoverySourcesMeasurementSheet({
  sheetRef,
}: {
  sheetRef: RefObject<BottomSheetModal | null>;
}) {
  const headings = [
    "Daily recorded visits",
    "First source of the day",
    "App-reported sources",
    "Source not recorded",
    "Online activity",
  ];
  return (
    <AnalyticsReportSheet
      sheetRef={sheetRef}
      title="About visit sources"
      description="Understand how profile openings are attributed"
      closeLabel="Close visit-source information"
    >
      <View className="gap-5">
        {NOTES.map((note, index) => (
          <View
            key={note}
            className={`flex-row items-start gap-3 ${index > 0 ? "border-t border-border-primary/60 pt-4" : ""}`}
          >
            {/* Neutral section icons follow the Pocket measurement-sheet pattern. */}
            <View className="h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-surface-muted">
              <MaterialCommunityIcons
                name={RULE_ICONS[index]}
                size={19}
                color={theme.extends.colors.text.secondary}
                accessible={false}
              />
            </View>
            <View className="min-w-0 flex-1 gap-1">
              <AppText weight="semibold" className="text-sm text-text-primary">
                {headings[index]}
              </AppText>
              <AppText className="text-sm leading-6 text-text-secondary">
                {note}
              </AppText>
            </View>
          </View>
        ))}
      </View>
    </AnalyticsReportSheet>
  );
}
