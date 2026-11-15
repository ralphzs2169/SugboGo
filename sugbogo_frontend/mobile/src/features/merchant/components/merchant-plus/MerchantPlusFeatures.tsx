import { MaterialCommunityIcons } from "@expo/vector-icons";
import { View } from "react-native";
import AppText from "@/shared/components/AppText";
import { theme } from "@/constants/theme";

export const PLUS_FEATURES = [
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
    icon: "lightbulb-outline",
    detail: "Get suggestions based on your business activity.",
  },
] as const;

/** Presents the four paid benefits using the merchant feature's quiet icon rows. */
export default function MerchantPlusFeatures({
  compact = false,
}: {
  compact?: boolean;
}) {
  return (
    <View className={compact ? "gap-2.5" : "gap-6"}>
      {PLUS_FEATURES.map((feature) => (
        <View key={feature.title} className="flex-row items-start gap-3">
          <MaterialCommunityIcons
            name={feature.icon}
            size={compact ? 17 : 22}
            color={theme.extends.colors.text.secondary}
            accessible={false}
          />
          <View className="min-w-0 flex-1 gap-1">
            <AppText weight="semibold" className="text-sm text-text-primary">
              {feature.title}
            </AppText>
            {!compact && (
              <AppText className="text-sm leading-5 text-text-secondary">
                {feature.detail}
              </AppText>
            )}
          </View>
        </View>
      ))}
    </View>
  );
}
