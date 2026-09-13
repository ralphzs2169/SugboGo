import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { View } from "react-native";

import { theme } from "@/constants/theme";
import AppText from "@/shared/components/AppText";

const MASCOT_YOUR_INTERESTS = require("@/shared/assets/mascot/mascot-your-interests.webp");

/**
 * Introduces interest personalization and explains how the user's selections
 * contribute to their personalized Explore recommendations.
 */
export default function InterestsIntroCard() {
  return (
    <View className="flex-row items-center rounded-xl border border-brand/15 bg-brand/5 px-5 py-4">
      {/* Personalization guidance */}
      <View className=" min-w-0 flex-1">
        <View className="mb-1.5 flex-row items-center">
          <MaterialCommunityIcons
            name="creation-outline"
            size={14}
            color={theme.extends.colors.brand}
          />

          <AppText
            weight="semibold"
            className="ml-1.5 text-xs uppercase tracking-wide text-brand"
          >
            Personalization
          </AppText>
        </View>

        <AppText
          weight="bold"
          className="text-[17px] leading-6 text-text-primary"
        >
          Shape your recommendations
        </AppText>

        <AppText className="mt-1.5 text-sm leading-5 text-text-secondary">
          Choose what you enjoy to improve your personalized recommendations.
        </AppText>
      </View>
      {/* Personalization mascot */}
      <View className="h-[84px] w-[84px] shrink-0 items-center justify-center">
        <Image
          source={MASCOT_YOUR_INTERESTS}
          style={{
            width: 104,
            height: 104,
          }}
          contentFit="contain"
          accessible={false}
        />
      </View>
    </View>
  );
}
