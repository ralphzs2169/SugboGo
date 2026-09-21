import { useEffect, useRef } from "react";
import { Animated, Easing } from "react-native";

type Props = {
  className?: string;
};

/**
 * Displays a softly pulsing placeholder while content is loading.
 *
 * Uses a restrained native-driven opacity animation to provide visible loading
 * feedback without introducing shimmer or layout movement.
 */
export default function Skeleton({ className = "" }: Props) {
  const opacity = useRef(new Animated.Value(0.45)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 0.9,
          duration: 850,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
          isInteraction: false,
        }),
        Animated.timing(opacity, {
          toValue: 0.45,
          duration: 850,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
          isInteraction: false,
        }),
      ]),
    );

    animation.start();

    return () => {
      animation.stop();
    };
  }, [opacity]);

  return (
    <Animated.View
      className={`bg-border-primary ${className}`}
      style={{ opacity }}
    />
  );
}
