import { useEffect, useRef } from "react";
import { Animated, View } from "react-native";

interface PaginationDotsProps {
  total: number;
  currentIndex: number;
}

/**
 * PaginationDots displays the onboarding progress using animated page indicators.
 * The active indicator expands into a pill while inactive indicators remain circular.
 *
 * @param {number} total - The total number of onboarding screens.
 * @param {number} currentIndex - The index of the currently active onboarding screen.
 */

export default function PaginationDots({
  total,
  currentIndex,
}: PaginationDotsProps) {
  const animations = useRef(
    Array.from(
      { length: total },
      (_, index) => new Animated.Value(index === currentIndex ? 1 : 0),
    ),
  ).current;

  /**
   * Animates the pagination indicators whenever the active page changes.
   */
  useEffect(() => {
    animations.forEach((animation, index) => {
      Animated.timing(animation, {
        toValue: index === currentIndex ? 1 : 0,
        duration: 250,
        useNativeDriver: false, // width cannot use native driver
      }).start();
    });
  }, [currentIndex]);

  return (
    <View className="flex-row items-center justify-center">
      {animations.map((animation, index) => {
        const width = animation.interpolate({
          inputRange: [0, 1],
          outputRange: [8, 24],
        });

        const backgroundColor = animation.interpolate({
          inputRange: [0, 1],
          outputRange: ["#D1D5DB", "#F27F0D"],
        });

        return (
          <Animated.View
            key={index}
            style={{
              width,
              height: 8,
              borderRadius: 999,
              backgroundColor,
              marginHorizontal: 4,
            }}
          />
        );
      })}
    </View>
  );
}
