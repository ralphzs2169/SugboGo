import { Image } from "expo-image";
import { View } from "react-native";
import AppText from "@/shared/components/AppText";

import type { OnboardingItem } from "../types";

interface OnboardingSlideProps {
  item: OnboardingItem;
}

/**
 * Displays a single onboarding screen with its illustration and supporting copy.
 */
export default function OnboardingSlide({ item }: OnboardingSlideProps) {
  return (
    <View className="flex-1 items-center justify-center bg-white px-8">
      {/* Onboarding illustration */}
      <Image
        source={item.imageSource}
        style={{
          width: 320,
          height: 320,
        }}
        contentFit="contain"
      />

      {/* Onboarding message */}
      <AppText
        weight="bold"
        className="mt-8 text-left text-4xl  text-text-primary"
      >
        {item.title}
      </AppText>

      <AppText className="mt-4 text-left text-[14px] leading-6 text-text-secondary">
        {item.description}
      </AppText>
    </View>
  );
}
