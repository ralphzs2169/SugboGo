import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { View } from "react-native";

import { theme } from "@/constants/theme";
import AppText from "@/shared/components/AppText";

const MERCHANT_PORTAL_ILLUSTRATION = require("../../assets/illustrations/merchant-portal-hero2.webp");

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
 * Introduces the Merchant Portal and explains what to expect before applying.
 */
export default function MerchantHero() {
  return (
    <View className="items-center bg-surface px-8 pb-8 pt-2">
      {/* Merchant portal illustration */}
      <Image
        source={MERCHANT_PORTAL_ILLUSTRATION}
        style={{
          width: 310,
          height: 310,
        }}
        contentFit="contain"
        transition={150}
      />

      {/* Hero message */}
      <View className="mt-4 items-center">
        <AppText
          weight="superbold"
          className="text-center text-4xl tracking-tight text-text-primary"
        >
          Become a SugboGo Merchant
        </AppText>

        <AppText className="mt-3 max-w-80 text-center text-md leading-6 text-text-secondary">
          Turn your business into a destination explorers discover, visit, and
          come back to.
        </AppText>
      </View>

      {/* Application highlights */}
      <View className="mt-6 flex-row flex-wrap justify-center gap-2">
        {HIGHLIGHTS.map((item) => (
          <View
            key={item.label}
            className="flex-row items-center gap-1.5 rounded-full bg-brand/10 px-3 py-1.5"
          >
            <MaterialCommunityIcons
              name={item.icon}
              size={14}
              color={theme.extends.colors.brand}
            />

            <AppText weight="semibold" className="text-xs text-brand">
              {item.label}
            </AppText>
          </View>
        ))}
      </View>
    </View>
  );
}
