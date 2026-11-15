import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useWindowDimensions, View } from "react-native";
import AppText from "@/shared/components/AppText";
import { theme } from "@/constants/theme";

const PLUS_FEATURES = [
  {
    title: "Peer comparisons",
    icon: "store-outline",
    detail: "Compare activity with similar businesses.",
  },
  {
    title: "Specialty trends",
    icon: "heart-outline",
    detail: "Track how specialty support changes over time.",
  },
  {
    title: "Visit timing",
    icon: "clock-outline",
    detail: "See when explorers are most interested.",
  },
  {
    title: "Business recommendations",
    compactTitle: "Recommendations",
    shortTitle: "Business tips",
    icon: "lightbulb-outline",
    detail: "Get suggestions based on your business activity.",
  },
] as const;

/** Presents the same benefits as a discovery grid or a grouped offer section. */
export default function MerchantPlusFeatures({
  compact = false,
}: {
  compact?: boolean;
}) {
  const { width, fontScale } = useWindowDimensions();
  const useShortLabel = width < 360 && fontScale > 1.1;

  if (compact) {
    return (
      <View className="gap-2">
        {[PLUS_FEATURES.slice(0, 2), PLUS_FEATURES.slice(2)].map((row) => (
          <View key={row[0].title} className="flex-row items-start gap-2">
            {row.map((feature) => (
              <View
                key={feature.title}
                accessibilityLabel={
                  "shortTitle" in feature ? feature.title : undefined
                }
                className="min-w-0 flex-1 flex-row items-start gap-1.5"
              >
                <View className="mt-0.5 shrink-0">
                  <MaterialCommunityIcons
                    name={feature.icon}
                    size={15}
                    color={theme.extends.colors.text.secondary}
                    accessible={false}
                  />
                </View>
                <AppText
                  weight="semibold"
                  className="min-w-0 flex-1 text-small text-text-primary"
                >
                  {"compactTitle" in feature
                    ? useShortLabel
                      ? feature.shortTitle
                      : feature.compactTitle
                    : feature.title}
                </AppText>
              </View>
            ))}
          </View>
        ))}
      </View>
    );
  }

  return (
    <View className="rounded-card border border-border-primary bg-background px-3">
      {PLUS_FEATURES.map((feature, index) => (
        <View
          key={feature.title}
          className={`flex-row items-start gap-3 py-3 ${index > 0 ? "border-t border-border-primary" : ""}`}
        >
          <View className="h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand/10">
            <MaterialCommunityIcons
              name={feature.icon}
              size={19}
              color={theme.extends.colors.text.primary}
              accessible={false}
            />
          </View>
          <View className="min-w-0 flex-1 gap-0.5">
            <AppText weight="bold" className="text-sm text-text-primary">
              {feature.title}
            </AppText>
            <AppText className="text-sm leading-5 text-text-secondary">
              {feature.detail}
            </AppText>
          </View>
        </View>
      ))}
    </View>
  );
}
