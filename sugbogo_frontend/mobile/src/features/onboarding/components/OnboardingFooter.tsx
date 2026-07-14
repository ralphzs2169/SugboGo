import { View } from "react-native";
import NextButton from "./NextButton";
import PaginationDots from "./PaginationDots";
import SkipButton from "./SkipButton";

interface OnboardingFooterProps {
  isLastPage: boolean;
  total: number;
  currentIndex: number;
  onSkip: () => void;
  onNext: () => void;
}

/**
 * OnboardingFooter displays the navigation controls for the onboarding flow.
 * It shows Skip, pagination dots, and Next on intermediate screens,
 * then transitions to a single Get Started button on the final screen.
 *
 * @param {boolean} isLastPage - Whether the current onboarding screen is the last.
 * @param {number} total - The total number of onboarding screens.
 * @param {number} currentIndex - The index of the current onboarding screen.
 * @param {() => void} onSkip - Called when the Skip button is pressed.
 * @param {() => void} onNext - Called when the Next or Get Started button is pressed.
 */
export default function OnboardingFooter({
  isLastPage,
  total,
  currentIndex,
  onSkip,
  onNext,
}: OnboardingFooterProps) {
  if (isLastPage) {
    return (
      <View className="px-6 pb-10">
        <NextButton title="Get Started" onPress={onNext} />
      </View>
    );
  }

  return (
    <View className="flex-row items-center justify-between px-6 pb-10">
      <SkipButton onPress={onSkip} />

      <PaginationDots total={total} currentIndex={currentIndex} />

      <NextButton title="Next" onPress={onNext} />
    </View>
  );
}
