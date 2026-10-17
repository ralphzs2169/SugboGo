import { MaterialCommunityIcons } from "@expo/vector-icons";
import type { ComponentProps } from "react";
import { View } from "react-native";

import { theme } from "@/constants/theme";
import AppText from "@/shared/components/AppText";
import MerchantContentSection from "../../layout/MerchantContentSection";

const INSIGHTS: {
  title: string;
  description: string;
  icon: ComponentProps<typeof MaterialCommunityIcons>["name"];
}[] = [
  {
    title: "Review Performance",
    description: "Sentiment and reply trends",
    icon: "comment-text-outline",
  },
  {
    title: "Peer Comparisons",
    description: "Anonymous business benchmarks",
    icon: "store-outline",
  },
  {
    title: "Customer Activity Times",
    description: "Recorded profile-visit timing",
    icon: "clock-outline",
  },
  {
    title: "Business Recommendations",
    description: "Suggestions grounded in your analytics",
    icon: "lightbulb-outline",
  },
];

/** Labels future Plus surfaces without implying an active subscription or available action. */
function PlusBadge() {
  return (
    <View className="flex-row items-center gap-1 rounded-full bg-brand/10 px-3 py-1">
      <MaterialCommunityIcons
        accessible={false}
        name="lock-outline"
        size={13}
        color={theme.extends.colors.brand}
      />
      <AppText weight="semibold" className="text-sm text-text-primary">
        Plus
      </AppText>
    </View>
  );
}

/** Reserves the wireframe's trend section without fabricated charts or disabled navigation. */
export function AnalyticsVisibilityPreview() {
  return (
    <MerchantContentSection title="Visibility Trends" accessory={<PlusBadge />}>
      <View className="rounded-card bg-background p-4">
        {/* Future visibility analysis */}
        <View className="flex-row items-start gap-3">
          <MaterialCommunityIcons
            accessible={false}
            name="chart-line"
            size={24}
            color={theme.extends.colors.brand}
          />
          <View className="min-w-0 flex-1">
            <AppText weight="semibold" className="text-base text-text-primary">
              See recorded activity over time
            </AppText>
            <AppText className="mt-1 text-sm leading-5 text-text-secondary">
              A Plus feature planned for a future update. Charts are not
              available in this version.
            </AppText>
          </View>
          <MaterialCommunityIcons
            accessible={false}
            name="lock-outline"
            size={18}
            color={theme.extends.colors.text.secondary}
          />
        </View>
      </View>
    </MerchantContentSection>
  );
}

/** Shows non-interactive Plus entry previews in the established merchant visual language. */
export function AnalyticsMoreInsightsPreview() {
  return (
    <MerchantContentSection title="More Insights" accessory={<PlusBadge />}>
      <View>
        {/* Upcoming Plus analysis areas */}
        {INSIGHTS.map((insight, index) => (
          <View
            key={insight.title}
            className={`flex-row items-start gap-3 py-4 ${index > 0 ? "border-t border-border-primary" : ""}`}
          >
            <View className="h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-background">
              <MaterialCommunityIcons
                accessible={false}
                name={insight.icon}
                size={22}
                color={theme.extends.colors.brand}
              />
            </View>
            <View className="min-w-0 flex-1">
              <AppText
                weight="semibold"
                className="text-base text-text-primary"
              >
                {insight.title}
              </AppText>
              <AppText className="mt-1 text-sm leading-5 text-text-secondary">
                {insight.description}
              </AppText>
            </View>
          </View>
        ))}
        <AppText className="border-t border-border-primary py-3 text-sm text-text-secondary">
          Plus previews · Available in a future update
        </AppText>
      </View>
    </MerchantContentSection>
  );
}
