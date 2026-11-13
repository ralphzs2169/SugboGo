import { Image } from "expo-image";
import { useEffect, useRef } from "react";
import {
  AccessibilityInfo,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  type ViewStyle,
} from "react-native";
import Animated, { type AnimatedStyle } from "react-native-reanimated";
import Svg, { Path } from "react-native-svg";

import { theme } from "@/constants/theme";
import AppText from "@/shared/components/AppText";
import Button from "@/shared/components/Button";
import { shadows } from "@/shared/styles/shadows";

const MASCOT = require("@/features/explore/assets/mascot-onboarding-tour.webp");
const MASCOT_WIDTH = 88;
export const MASCOT_OVERLAP = 20;
export const POINTER_WIDTH = 30;
const POINTER_HEIGHT = 14;

type Props = {
  title: string;
  description: string;
  step?: number;
  total?: number;
  maxHeight: number;
  pointerUp: boolean;
  pointerMotion: AnimatedStyle<ViewStyle>;
  onBack?: () => void;
  onNext: () => void;
  onSkip?: () => void;
  onDismiss: () => void;
};

/** Shows a mascot-led speech bubble with a pointer aimed at the spotlight. */
export default function SpotlightTooltip({
  title,
  description,
  step,
  total,
  maxHeight,
  pointerUp,
  pointerMotion,
  onBack,
  onNext,
  onSkip,
  onDismiss,
}: Props) {
  const announcement = useRef<View>(null);
  const progress = step !== undefined ? `Step ${step} of ${total}` : null;
  const isLastStep = step === total;

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      if (announcement.current) {
        AccessibilityInfo.sendAccessibilityEvent(announcement.current, "focus");
      }
    });
    return () => cancelAnimationFrame(frame);
  }, [step]);

  return (
    <View accessibilityViewIsModal onAccessibilityEscape={onDismiss}>
      {/* The pointer joins the surface and follows the current tab. */}
      <Animated.View
        pointerEvents="none"
        style={[styles.pointer, pointerUp && styles.pointerUp, pointerMotion]}
      >
        <Svg width={POINTER_WIDTH} height={POINTER_HEIGHT} viewBox="0 0 30 14">
          <Path
            d={
              pointerUp
                ? "M 0 14 H 30 Q 26 14 23 10 L 17 2 Q 15 0 13 2 L 7 10 Q 4 14 0 14 Z"
                : "M 0 0 H 30 Q 26 0 23 4 L 17 12 Q 15 14 13 12 L 7 4 Q 4 0 0 0 Z"
            }
            fill={theme.extends.colors.surface}
          />
        </Svg>
      </Animated.View>

      {/* The heading reserves space for the mascot above the scrollable copy. */}
      <ScrollView
        bounces={false}
        className="rounded-3xl border border-border-primary bg-surface"
        style={[shadows.floating, { flexGrow: 0, maxHeight }]}
        contentContainerClassName="gap-3 p-4"
      >
        {/* Step instructions */}

        <View
          ref={announcement}
          accessible
          accessibilityRole="header"
          accessibilityLabel={
            progress
              ? `${progress}. ${title} ${description}`
              : `${title} ${description}`
          }
          onAccessibilityEscape={onDismiss}
          className="gap-1.5"
        >
          {/* Step indicator */}
          <View className="min-h-[48px] flex-row items-start justify-end">
            {progress && (
              <AppText
                weight="bold"
                className="rounded-full bg-brand/15 px-2.5 py-1 text-xs text-text-primary"
              >
                {progress}
              </AppText>
            )}
          </View>

          {/* Tour content */}
          <AppText weight="bold" className="text-lg text-text-primary">
            {title}
          </AppText>

          <AppText className="text-sm text-text-secondary">
            {description}
          </AppText>
        </View>

        {/* Tour controls */}
        <View
          className={
            onSkip
              ? "flex-row flex-wrap items-center justify-between gap-2"
              : "flex-row justify-end"
          }
        >
          {onSkip && (
            <Pressable
              onPress={onSkip}
              accessibilityRole="button"
              className="min-h-[48px] cursor-pointer justify-center px-2 active:opacity-70"
            >
              <AppText
                weight="semibold"
                className="text-sm text-text-secondary"
              >
                Skip
              </AppText>
            </Pressable>
          )}
          <View className="flex-row flex-wrap items-center gap-2">
            {onBack && (
              <Button
                title="Back"
                onPress={onBack}
                disabled={step === 1}
                size="sm"
                variant="outline"
                rounded="full"
                className="min-h-[48px]"
              />
            )}
            <Button
              title={isLastStep ? "Got it!" : "Next"}
              onPress={onNext}
              size="sm"
              variant="primary"
              rounded="full"
              className="min-h-[48px]"
            />
          </View>
        </View>
      </ScrollView>

      {/* The transparent asset overlaps the edge without capturing gestures. */}
      <View
        pointerEvents="none"
        style={[styles.mascot, pointerUp && styles.mascotBelow]}
      >
        <Image
          source={MASCOT}
          testID="spotlight-mascot"
          contentFit="contain"
          accessible={false}
          style={styles.mascotImage}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  pointer: {
    position: "absolute",
    left: 0,
    top: "100%",
    marginTop: -1,
    zIndex: 1,
  },
  pointerUp: {
    top: -POINTER_HEIGHT,
    marginTop: 1,
  },
  mascot: {
    position: "absolute",
    top: -MASCOT_OVERLAP,
    left: -2,
    zIndex: 1,
  },
  mascotImage: {
    width: MASCOT_WIDTH,
    aspectRatio: 1312 / 1199,
  },
  mascotBelow: {
    top: 0,
  },
});
