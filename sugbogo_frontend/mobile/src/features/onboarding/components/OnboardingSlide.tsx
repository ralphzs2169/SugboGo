import { Text, View } from "react-native";

import { OnboardingItem } from "../types";
interface OnboardingSlideProps {
  item: OnboardingItem;
}

/**
 * OnboardingSlide component displays a single onboarding screen.
 * @param {OnboardingItem} item - The onboarding content to display.
 */
export default function OnboardingSlide({ item }: OnboardingSlideProps) {
  const Illustration = item.Illustration;

  return (
    <View className="flex-1 items-center justify-center px-8">
      <Illustration width={420} height={380} />

      <Text className="mt-10 text-center text-2xl font-bold text-[#1A1A1A]">
        {item.title}
      </Text>

      <Text className="mt-6 text-center text-xs leading-6 text-[#666666]">
        {item.description}
      </Text>
    </View>
  );
}
