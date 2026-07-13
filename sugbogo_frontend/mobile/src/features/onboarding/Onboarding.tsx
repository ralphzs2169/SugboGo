import { useRouter } from "expo-router";
import { useRef, useState } from "react";
import {
  FlatList,
  NativeScrollEvent,
  NativeSyntheticEvent,
  View,
  useWindowDimensions,
} from "react-native";

import NextButton from "./components/NextButton";
import OnboardingSlide from "./components/OnboardingSlide";
import PaginationDots from "./components/PaginationDots";
import SkipButton from "./components/SkipButton";
import { onboardingData } from "./constants/onboardingData";
import { OnboardingItem } from "./types";

/**
 * Onboarding displays the onboarding flow with swipeable slides.
 */
export default function Onboarding() {
  const router = useRouter();

  const { width } = useWindowDimensions();

  const flatListRef = useRef<FlatList<OnboardingItem>>(null);

  const [currentIndex, setCurrentIndex] = useState(0);

  /**
   * Navigates to the authentication flow.
   */
  const handleSkip = () => {
    router.replace("/(auth)/login");
  };

  /**
   * Advances to the next onboarding screen or finishes onboarding.
   */
  const handleNext = () => {
    if (currentIndex < onboardingData.length - 1) {
      flatListRef.current?.scrollToIndex({
        index: currentIndex + 1,
        animated: true,
      });
    } else {
      router.replace("/(auth)/login");
    }
  };

  /**
   * Updates the active onboarding page when scrolling ends.
   * @param {NativeSyntheticEvent<NativeScrollEvent>} event - The scroll event.
   */
  const handleMomentumScrollEnd = (
    event: NativeSyntheticEvent<NativeScrollEvent>,
  ) => {
    const index = Math.round(event.nativeEvent.contentOffset.x / width);
    setCurrentIndex(index);
  };

  return (
    <View className="flex-1 bg-white">
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
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={handleMomentumScrollEnd}
      />

      <View className="pb-10">
        <SkipButton onPress={handleSkip} />

        <PaginationDots
          total={onboardingData.length}
          currentIndex={currentIndex}
        />

        <NextButton
          title={
            currentIndex === onboardingData.length - 1 ? "Get Started" : "Next"
          }
          onPress={handleNext}
        />
      </View>
    </View>
  );
}
