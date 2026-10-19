import { MaterialCommunityIcons } from "@expo/vector-icons";
import type { ComponentProps } from "react";
import { View } from "react-native";

import { theme } from "@/constants/theme";
import AppText from "@/shared/components/AppText";
import SafePressable from "@/shared/components/SafePressable";

import AnalyticsOverviewSection from "./AnalyticsOverviewSection";
import type { PlusDetailKind } from "../../types/merchantPlusAnalytics.types";

const INSIGHTS: {
  title: string;
  description: string;
  icon: ComponentProps<typeof MaterialCommunityIcons>["name"];
  kind: PlusDetailKind | "discovery-sources";
}[] = [
  {
    title: "Where visits came from",
    description: "Sources of recorded business profile visits.",
    icon: "compass-outline",
    kind: "discovery-sources",
  },
  {
    title: "Pocket Trends",
    description: "Recorded saves and accounts that saved your business",
    icon: "bookmark-outline",
    kind: "pocket",
  },
  {
    title: "Review Performance",
    description: "Sentiment, weekly reviews and replies",
    icon: "comment-text-outline",
    kind: "reviews",
  },
  {
    title: "Peer Comparisons",
    description: "Recorded activity compared with similar businesses",
    icon: "store-outline",
    kind: "peers",
  },
  {
    title: "Review Insights",
    description: "Review summaries and common mentions",
    icon: "text-box-outline",
    kind: "review-insights",
  },
  {
    title: "Profile-Visit Timing",
    description: "Recorded online visits by day and hour",
    icon: "clock-outline",
    kind: "timing",
  },
  {
    title: "Business Recommendations",
    description: "Suggestions based on available activity and reviews",
    icon: "lightbulb-outline",
    kind: "recommendations",
  },
];

/**
 * Displays additional merchant analytics reports as accessible
 * navigation entries without subscription labels or locked states.
 */
export default function AnalyticsMoreInsights({
  onOpen,
  onOpenDiscoverySources,
}: {
  onOpen: (kind: PlusDetailKind) => void;
  onOpenDiscoverySources: () => void;
}) {
  return (
    <AnalyticsOverviewSection title="More insights">
      <View>
        {/* Navigable analytics reports */}
        {INSIGHTS.map((insight, index) => (
          <SafePressable
            key={insight.kind}
            accessibilityRole="button"
            accessibilityLabel={`Open ${insight.title}`}
            onPress={() =>
              insight.kind === "discovery-sources"
                ? onOpenDiscoverySources()
                : onOpen(insight.kind)
            }
            className={`min-h-16 flex-row cursor-pointer items-center gap-3 py-4 active:bg-surface-muted ${
              index > 0 ? "border-t border-border-primary" : ""
            }`}
          >
            {/* Report identity */}
            <View className="h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand/10">
              <MaterialCommunityIcons
                accessible={false}
                name={insight.icon}
                size={20}
                color={theme.extends.colors.brand}
              />
            </View>

            {/* Report title and description */}
            <View className="min-w-0 flex-1">
              <AppText
                weight="semibold"
                className="text-sm leading-5 text-text-primary"
              >
                {insight.title}
              </AppText>

              <AppText className="mt-0.5 text-xs leading-5 text-text-secondary">
                {insight.description}
              </AppText>
            </View>

            {/* Navigation indicator */}
            <MaterialCommunityIcons
              accessible={false}
              name="chevron-right"
              size={20}
              color={theme.extends.colors.text.secondary}
            />
          </SafePressable>
        ))}
      </View>
    </AnalyticsOverviewSection>
  );
}
