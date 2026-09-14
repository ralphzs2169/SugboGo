import { useRouter } from "expo-router";
import { useRef, useState } from "react";
import {
  FlatList,
  NativeScrollEvent,
  NativeSyntheticEvent,
  View,
  useWindowDimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import * as onboardingStorage from "@/shared/api/onboardingStorage.service";

import OnboardingFooter from "./components/OnboardingFooter";
import OnboardingSlide from "./components/OnboardingSlide";
import { onboardingData } from "./constants/onboardingData";
import type { OnboardingItem } from "./types";

/**
 * Displays the swipeable onboarding experience and manages onboarding completion.
 *
 * Persists completion before entering authentication and prevents repeated
 * completion attempts while the transition is in progress.
 */
export default function OnboardingScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();

  const flatListRef = useRef<FlatList<OnboardingItem>>(null);

  const [currentIndex, setCurrentIndex] = useState(0);
  const [isCompleting, setIsCompleting] = useState(false);

  /**
   * Persists onboarding completion and enters the authentication flow.
   */
  const completeOnboarding = async () => {
    if (isCompleting) {
      return;
    }

    setIsCompleting(true);

    try {
      await onboardingStorage.completeOnboarding();
      router.replace("/(auth)/login");
    } catch {
      setIsCompleting(false);
    }
  };

  /**
   * Skips the remaining onboarding screens.
   */
  const handleSkip = async () => {
    await completeOnboarding();
  };

  /**
   * Advances to the next onboarding screen or finishes onboarding.
   */
  const handleNext = async () => {
    if (isCompleting) {
      return;
    }

    if (currentIndex < onboardingData.length - 1) {
      flatListRef.current?.scrollToIndex({
        index: currentIndex + 1,
        animated: true,
      });
      return;
    }

    await completeOnboarding();
  };

  /**
   * Updates the active onboarding page when scrolling ends.
   */
  const handleMomentumScrollEnd = (
    event: NativeSyntheticEvent<NativeScrollEvent>,
  ) => {
    const index = Math.round(event.nativeEvent.contentOffset.x / width);
    setCurrentIndex(index);
  };

  const isLastPage = currentIndex === onboardingData.length - 1;

  return (
    <SafeAreaView edges={["bottom"]} className="flex-1 bg-background">
      <View className="flex-1 bg-white">
        {/* Swipeable onboarding slides */}
        <FlatList
          ref={flatListRef}
          data={onboardingData}
          keyExtractor={(item) => item.id.toString()}
          renderItem={({ item }) => (
            <View style={{ width }}>
              <OnboardingSlide item={item} />
            </View>
          )}
          horizontal
          pagingEnabled
          scrollEnabled={!isCompleting}
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={handleMomentumScrollEnd}
        />

        {/* Onboarding navigation */}
        <OnboardingFooter
          isLastPage={isLastPage}
          isCompleting={isCompleting}
          total={onboardingData.length}
          currentIndex={currentIndex}
          onSkip={handleSkip}
          onNext={handleNext}
        />
      </View>
    </SafeAreaView>
  );
}
