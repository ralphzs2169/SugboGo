import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Text, View } from "react-native";
import { theme } from "@/constants/theme";
import MerchantPortalIllustration from "../../assets/illustrations/merchant-portal.svg";

// Trust indicators displayed in the merchant portal hero section.
const HIGHLIGHTS = [
  {
    icon: "cash-remove",
    label: "Free to apply",
  },
  {
    icon: "shield-check-outline",
    label: "Admin reviewed",
  },
  {
    icon: "map-marker-outline",
    label: "For Cebu businesses",
  },
] as const;

/**
 * Displays the introductory hero section of the merchant portal.
 *
 * Highlights the benefits of becoming a SugboGo merchant,
 * including key trust indicators and a visual introduction
 * before the user begins the registration process.
 */
export default function MerchantHero() {
  return (
    <View className="relative  items-center bg-surface pb-8 px-8 pt-2">
      <MerchantPortalIllustration width={280} height={280} />

      <Text className="mt-6 text-center text-4xl font-bold tracking-tight text-text-primary">
        Become a SugboGo Merchant
      </Text>

      <Text className="mt-3 text-center text-md text-text-secondary">
        Turn your business into a destination explorers discover, visit, and
        come back to.
      </Text>

      <View className="mt-8 flex-row flex-wrap justify-center gap-3">
        {HIGHLIGHTS.map((item) => (
          <View
            key={item.label}
            className="flex-row items-center rounded-full border border-border-primary bg-card px-4 py-2"
          >
            <MaterialCommunityIcons
              name={item.icon}
              size={16}
              color={theme.extends.colors.brand}
            />

            <Text className="ml-2 text-xs font-semibold text-text-primary">
              {item.label}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}
