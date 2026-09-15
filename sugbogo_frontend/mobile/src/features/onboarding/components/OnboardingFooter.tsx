import { Ionicons } from "@expo/vector-icons";
import { ActivityIndicator, TouchableOpacity, View } from "react-native";
import AppText from "@/shared/components/AppText";
import PaginationDots from "./PaginationDots";

interface OnboardingFooterProps {
  isLastPage: boolean;
  isCompleting: boolean;
  total: number;
  currentIndex: number;
  onSkip: () => void;
  onNext: () => void;
}

/**
 * Displays the navigation controls for the onboarding flow.
 *
 * Shows Skip, pagination, and Next on regular slides, then switches to a
 * full-width Get Started action with loading feedback on the final slide.
 */
export default function OnboardingFooter({
  isLastPage,
  isCompleting,
  total,
  currentIndex,
  onSkip,
  onNext,
}: OnboardingFooterProps) {
  if (isLastPage) {
    return (
      <View className="px-6 pb-2">
        {/* Final onboarding action */}
        <TouchableOpacity
          onPress={onNext}
          disabled={isCompleting}
          activeOpacity={0.8}
          className={`h-12 cursor-pointer flex-row items-center justify-center rounded-full bg-brand px-5 ${
            isCompleting ? "opacity-80" : ""
          }`}
          accessibilityRole="button"
          accessibilityState={{
            disabled: isCompleting,
            busy: isCompleting,
          }}
        >
          {isCompleting ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <View className="flex-row items-center gap-2">
              <AppText weight="bold" className="text-base  text-white">
                Get Started
              </AppText>

              <Ionicons name="arrow-forward" size={18} color="#FFFFFF" />
            </View>
          )}
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View className="flex-row items-center justify-between px-6 pb-2">
      {/* Skip action */}
      <TouchableOpacity
        onPress={onSkip}
        activeOpacity={0.7}
        className="cursor-pointer px-4 py-3"
        accessibilityRole="button"
      >
        <AppText className="text-base font-semibold text-[#666666]">
          Skip
        </AppText>
      </TouchableOpacity>

      {/* Onboarding progress */}
      <PaginationDots total={total} currentIndex={currentIndex} />

      {/* Next slide action */}
      <TouchableOpacity
        onPress={onNext}
        activeOpacity={0.8}
        className="h-12 cursor-pointer flex-row items-center justify-center rounded-full bg-brand px-5"
        accessibilityRole="button"
      >
        <View className="flex-row items-center gap-2">
          <AppText className="text-base font-semibold text-white">Next</AppText>

          <Ionicons name="arrow-forward" size={18} color="#FFFFFF" />
        </View>
      </TouchableOpacity>
    </View>
  );
}
