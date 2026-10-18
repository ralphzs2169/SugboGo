import { MaterialCommunityIcons } from "@expo/vector-icons";
import type { ComponentProps } from "react";
import { View } from "react-native";
import { theme } from "@/constants/theme";
import AppText from "@/shared/components/AppText";
import SafePressable from "@/shared/components/SafePressable";
import type { MerchantPlusAccess } from "../../hooks/analytics/useMerchantPlusAccess";
import AnalyticsOverviewSection from "./AnalyticsOverviewSection";
import type { PlusDetailKind } from "../../types/merchantPlusAnalytics.types";

const INSIGHTS: {
  title: string;
  description: string;
  icon: ComponentProps<typeof MaterialCommunityIcons>["name"];
  kind: PlusDetailKind;
}[] = [
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

/** Keeps secondary reports behind permitted, lazy detail entry points. */
export default function AnalyticsMoreInsights({
  access,
  onOpen,
}: {
  access: MerchantPlusAccess;
  onOpen: (kind: PlusDetailKind) => void;
}) {
  return (
    <AnalyticsOverviewSection
      title="More Insights"
      accessory={
        <AppText weight="bold" className="text-sm text-brand">
          Plus
        </AppText>
      }
    >
      <View>
        {/* Detail entry points keep secondary charts out of the overview. */}
        {INSIGHTS.map((insight, index) => {
          const content = (
            <>
              <View className="h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand/10">
                <MaterialCommunityIcons
                  accessible={false}
                  name={insight.icon}
                  size={20}
                  color={theme.extends.colors.brand}
                />
              </View>
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
              <MaterialCommunityIcons
                accessible={false}
                name={
                  insight.kind && access.allowed
                    ? "chevron-right"
                    : "lock-outline"
                }
                size={20}
                color={theme.extends.colors.text.secondary}
              />
            </>
          );
          const rowClass = `min-h-16 flex-row items-center gap-3 py-4 ${index > 0 ? "border-t border-border-primary" : ""}`;
          return insight.kind && access.allowed ? (
            <SafePressable
              key={insight.title}
              accessibilityRole="button"
              accessibilityLabel={`Open ${insight.title}`}
              onPress={() => onOpen(insight.kind!)}
              className={`${rowClass} cursor-pointer active:bg-surface-muted`}
            >
              {content}
            </SafePressable>
          ) : (
            <View key={insight.title} className={rowClass}>
              {content}
            </View>
          );
        })}
      </View>
    </AnalyticsOverviewSection>
  );
}
