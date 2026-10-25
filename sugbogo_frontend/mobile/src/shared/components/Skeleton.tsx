import { LinearGradient } from "expo-linear-gradient";
import { useEffect, useState } from "react";
import {
  AccessibilityInfo,
  Animated,
  AppState,
  Easing,
  StyleSheet,
  View,
} from "react-native";

import { theme } from "@/constants/theme";

type Props = {
  className?: string;
};

/**
 * Displays a neutral placeholder with a soft left-to-right loading shimmer.
 *
 * Moves a broad highlight using the native driver without moving the layout.
 * Keeps placeholders static for reduced motion and pauses in the background.
 */
export default function Skeleton({ className = "" }: Props) {
  const [progress] = useState(() => new Animated.Value(0));
  const [width, setWidth] = useState(0);
  const [reduceMotion, setReduceMotion] = useState(true);
  const [isActive, setIsActive] = useState(AppState.currentState === "active");

  useEffect(() => {
    let mounted = true;
    let receivedChange = false;
    const motionSubscription = AccessibilityInfo.addEventListener(
      "reduceMotionChanged",
      (enabled) => {
        receivedChange = true;
        setReduceMotion(enabled);
      },
    );
    const appSubscription = AppState.addEventListener("change", (state) => {
      setIsActive(state === "active");
    });

    void AccessibilityInfo.isReduceMotionEnabled()
      .then((enabled) => {
        if (mounted && !receivedChange) {
          setReduceMotion(enabled);
        }
      })
      .catch(() => {
        // Keep a static placeholder if the accessibility preference is unavailable.
      });

    return () => {
      mounted = false;
      motionSubscription.remove();
      appSubscription.remove();
    };
  }, []);

  useEffect(() => {
    if (reduceMotion || !isActive || width === 0) {
      return;
    }

    progress.setValue(0);
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(progress, {
          toValue: 1,
          duration: 1800,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
          isInteraction: false,
        }),
        Animated.delay(300),
      ]),
    );

    animation.start();

    return () => {
      animation.stop();
    };
  }, [isActive, progress, reduceMotion, width]);

  // A wide, feathered highlight avoids a sharp stripe on large photo placeholders.
  const highlightWidth = width * 1.4;

  return (
    <View
      className={`bg-border-primary ${className}`}
      style={styles.container}
      onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
      accessible={false}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      pointerEvents="none"
    >
      {/* The highlight starts and ends outside the clipped placeholder. */}
      {!reduceMotion && isActive && width > 0 && (
        <Animated.View
          style={[
            styles.highlight,
            {
              width: highlightWidth,
              opacity: progress.interpolate({
                inputRange: [0, 0.15, 0.85, 1],
                outputRange: [0, 1, 1, 0],
              }),
              transform: [
                {
                  translateX: progress.interpolate({
                    inputRange: [0, 1],
                    outputRange: [-highlightWidth, width],
                  }),
                },
              ],
            },
          ]}
        >
          <LinearGradient
            colors={[
              `${theme.extends.colors.surface}00`,
              `${theme.extends.colors.surface}20`,
              `${theme.extends.colors.surface}80`,
              `${theme.extends.colors.surface}20`,
              `${theme.extends.colors.surface}00`,
            ]}
            locations={[0, 0.25, 0.5, 0.75, 1]}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={StyleSheet.absoluteFill}
          />
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    overflow: "hidden",
  },
  highlight: {
    position: "absolute",
    top: 0,
    bottom: 0,
    left: 0,
  },
});
