import { MaterialCommunityIcons } from "@expo/vector-icons";
import type { ComponentProps } from "react";
import { View } from "react-native";

import { theme } from "@/constants/theme";
import AppText from "@/shared/components/AppText";
import SafePressable from "@/shared/components/SafePressable";

import type { PlusDetailKind } from "../../types/merchantPlusAnalytics.types";
import AnalyticsOverviewSection from "./AnalyticsOverviewSection";

type ReportIconName = ComponentProps<typeof MaterialCommunityIcons>["name"];

type ReportItem = {
  title: string;
  description: string;
  icon: ReportIconName;
  kind: PlusDetailKind | "discovery-sources";
  requiresPlus: boolean;
};

type Props = {
  hasPlusAccess: boolean;
  onOpen: (kind: PlusDetailKind) => void;
  onOpenDiscoverySources: () => void;
};

const REPORTS: ReportItem[] = [
  {
    title: "Where visits came from",
    description: "See where explorers opened your profile",
    icon: "compass-outline",
    kind: "discovery-sources",
    requiresPlus: false,
  },
  {
    title: "Profile visit timing",
    description: "Explore profile visits by day and hour",
    icon: "clock-outline",
    kind: "timing",
    requiresPlus: true,
  },
  {
    title: "Pocket trends",
    description: "Track saves and accounts that saved your business",
    icon: "bookmark-outline",
    kind: "pocket",
    requiresPlus: true,
  },
  {
    title: "Review performance",
    description: "Review activity, replies, and sentiment",
    icon: "comment-text-outline",
    kind: "reviews",
    requiresPlus: true,
  },
  {
    title: "Review insights",
    description: "Discover common themes in customer feedback",
    icon: "text-box-outline",
    kind: "review-insights",
    requiresPlus: true,
  },
  {
    title: "Peer comparisons",
    description: "Compare activity with similar businesses",
    icon: "store-outline",
    kind: "peers",
    requiresPlus: true,
  },
  {
    title: "Business recommendations",
    description: "Suggestions based on available activity and reviews",
    icon: "lightbulb-outline",
    kind: "recommendations",
    requiresPlus: true,
  },
];

/**
 * Displays accessible merchant analytics detail reports in a
 * compact, consistently styled navigation list.
 *
 * Groups reports by relevance and hides inaccessible destinations
 * so merchants do not encounter nonfunctional navigation actions.
 */
export default function AnalyticsMoreInsights({
  hasPlusAccess,
  onOpen,
  onOpenDiscoverySources,
}: Props) {
  const availableReports = REPORTS.filter(
    (report) => !report.requiresPlus || hasPlusAccess,
  );

  const handleOpenReport = (kind: ReportItem["kind"]) => {
    if (kind === "discovery-sources") {
      onOpenDiscoverySources();
      return;
    }

    onOpen(kind);
  };

  return (
    <AnalyticsOverviewSection
      title="Detailed reports"
      description="Explore your business activity in more detail."
    >
      {/* Available analytics report destinations */}
      <View>
        {availableReports.map((report, index) => (
          <SafePressable
            key={report.kind}
            accessibilityRole="button"
            accessibilityLabel={`Open ${report.title}`}
            accessibilityHint={report.description}
            onPress={() => handleOpenReport(report.kind)}
            className={`min-h-16 flex-row cursor-pointer items-center gap-3 py-3.5 active:bg-surface-muted ${
              index > 0 ? "border-t border-border-primary/60" : ""
            }`}
          >
            {/* Neutral report icon */}
            <View className="h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-surface-muted">
              <MaterialCommunityIcons
                name={report.icon}
                size={19}
                color={theme.extends.colors.text.secondary}
                accessible={false}
              />
            </View>

            {/* Report title and supporting description */}
            <View className="min-w-0 flex-1 gap-0.5">
              <AppText
                weight="semibold"
                className="text-sm leading-5 text-text-primary"
              >
                {report.title}
              </AppText>

              <AppText className="text-xs leading-5 text-text-secondary">
                {report.description}
              </AppText>
            </View>

            {/* Navigation indicator */}
            <MaterialCommunityIcons
              name="chevron-right"
              size={20}
              color={theme.extends.colors.text.secondary}
              accessible={false}
            />
          </SafePressable>
        ))}
      </View>
    </AnalyticsOverviewSection>
  );
}
