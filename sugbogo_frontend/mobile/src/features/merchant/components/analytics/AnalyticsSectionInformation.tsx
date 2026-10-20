import { MaterialCommunityIcons } from "@expo/vector-icons";
import type { BottomSheetModal } from "@gorhom/bottom-sheet";
import { useRef } from "react";
import { View } from "react-native";

import { theme } from "@/constants/theme";
import AppText from "@/shared/components/AppText";
import SafePressable from "@/shared/components/SafePressable";

import AnalyticsReportSheet from "./AnalyticsReportSheet";

const INFORMATION = {
  specialties: {
    title: "About specialty vouches",
    description: "Understand your current specialty support.",
    rules: [
      {
        title: "Current support",
        icon: "heart-outline",
        text: "These counts show valid vouches for your active specialties now. They are not limited to a reporting period.",
      },
      {
        title: "Reading the ranking",
        icon: "chart-bar",
        text: "Specialties are ranked by valid vouches. Bar lengths compare counts; they are not percentages or quality scores. Supporting accounts are counted separately for each specialty.",
      },
      {
        title: "Changes over time",
        icon: "history",
        text: "Counts can change when vouches are removed or invalidated, or specialties become inactive. Open Specialty trends to explore activity by reporting period.",
      },
    ],
  },
  reviews: {
    title: "About review summary",
    description: "Understand how to read this summary.",
    rules: [
      {
        title: "A stored AI summary",
        icon: "creation",
        text: "This is an AI-generated summary of qualifying customer reviews. It may contain mistakes; use the original reviews for context.",
      },
      {
        title: "Its own coverage and date",
        icon: "calendar-range",
        text: "The summary keeps its original coverage and generation date. Changing another section's reporting period does not regenerate it. The analyzed review count may differ from your total reviews.",
      },
      {
        title: "More context",
        icon: "comment-text-multiple-outline",
        text: "A summary marked as needing an update may not reflect recent changes. Open Review insights for the full stored summary, common mentions, and coverage details. Review performance shows review and reply activity separately.",
      },
    ],
  },
} as const;

/** Explains snapshot and stored-summary sections without navigating away from Analytics. */
export default function AnalyticsSectionInformation({
  section,
}: {
  section: keyof typeof INFORMATION;
}) {
  const sheetRef = useRef<BottomSheetModal>(null);
  const information = INFORMATION[section];

  return (
    <>
      {/* Match the information action used by period-based sections. */}
      <SafePressable
        accessibilityRole="button"
        accessibilityLabel={information.title}
        accessibilityHint="Opens an explanation of this section's measurements"
        onPress={() => sheetRef.current?.present()}
        className="-mr-2.5 h-11 w-11 cursor-pointer items-center justify-center rounded-full active:bg-surface-muted"
      >
        <MaterialCommunityIcons
          name="information-outline"
          size={22}
          color={theme.extends.colors.text.secondary}
          accessible={false}
        />
      </SafePressable>
      <AnalyticsReportSheet
        sheetRef={sheetRef}
        title={information.title}
        description={information.description}
        closeLabel={`Close ${section === "specialties" ? "specialty vouches" : "review summary"} information`}
      >
        {/* Plain-language definitions and interpretation limits. */}
        <View className="gap-5">
          {information.rules.map((rule) => (
            <View key={rule.title} className="flex-row items-start gap-3">
              <View className="h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-surface-muted">
                <MaterialCommunityIcons
                  name={rule.icon}
                  size={19}
                  color={theme.extends.colors.text.secondary}
                  accessible={false}
                />
              </View>
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
        </View>
      </AnalyticsReportSheet>
    </>
  );
}
