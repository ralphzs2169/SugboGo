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
};

type Props = {
  hasPlusAccess?: boolean;
  onOpen: (kind: PlusDetailKind) => void;
  onOpenDiscoverySources?: () => void;
  group?:
    "visibility" | "reviews" | "review-insights" | "specialties" | "further";
};

const REPORTS: ReportItem[] = [
  {
    title: "Specialty trends",
    description: "Explore specialty vouch activity over time",
    icon: "heart-outline",
    kind: "specialties",
  },
  {
    title: "Review insights",
    description: "Read the full summary and common review themes",
    icon: "comment-text-multiple-outline",
    kind: "review-insights",
  },
  {
    title: "Where visits came from",
    description: "See where explorers opened your profile",
    icon: "compass-outline",
    kind: "discovery-sources",
  },
  {
    title: "Profile visit timing",
    description: "Explore profile visits by day and hour",
    icon: "clock-outline",
    kind: "timing",
  },
  {
    title: "Review performance",
    description: "Review activity, replies, and sentiment",
    icon: "comment-text-outline",
    kind: "reviews",
  },
  {
    title: "Peer comparisons",
    description: "Compare activity with similar businesses",
    icon: "store-outline",
    kind: "peers",
  },
  {
    title: "Business recommendations",
    description: "Suggestions based on available activity and reviews",
    icon: "lightbulb-outline",
    kind: "recommendations",
  },
];

/** Places report destinations beside the measurements they explain. */
export function AnalyticsReportLinks({
  onOpen,
  onOpenDiscoverySources,
  group = "further",
}: Props) {
  const handleOpenReport = (kind: ReportItem["kind"]) => {
    if (kind === "discovery-sources") {
      onOpenDiscoverySources?.();
      return;
    }

    onOpen(kind);
  };

  const reports = REPORTS.filter((report) => {
    if (group === "visibility") {
      return report.kind === "discovery-sources" || report.kind === "timing";
    }
    if (group === "specialties" || group === "review-insights") {
      return report.kind === group;
    }
    if (group === "reviews") {
      return report.kind === "reviews";
    }
    return report.kind === "peers" || report.kind === "recommendations";
  });
  return (
    <View>
      {reports.map((report, index) => (
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
  );
}

/** Groups broader comparison and recommendation tools. */
export default function AnalyticsMoreInsights(props: Props) {
  return (
    <AnalyticsOverviewSection
      title="Further insights"
      description="Compare your business and explore suggested improvements."
    >
      <AnalyticsReportLinks {...props} group="further" />
    </AnalyticsOverviewSection>
  );
}
