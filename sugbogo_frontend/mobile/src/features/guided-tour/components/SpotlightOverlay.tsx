import { useEffect, useState, type ComponentProps } from "react";
import { AccessibilityInfo, BackHandler, StyleSheet, View } from "react-native";
import Animated, {
  Easing,
  ReduceMotion,
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Path } from "react-native-svg";

import type { SpotlightRect } from "../hooks/useSpotlightTargets";
import SpotlightTooltip, {
  MASCOT_OVERLAP,
  POINTER_WIDTH,
} from "./SpotlightTooltip";

const SPOTLIGHT_PADDING = 4;
const TOOLTIP_GUTTER = 16;
const TOOLTIP_GAP = 18;
const TOOLTIP_MAX_WIDTH = 360;
const POINTER_INSET = 22;
const AnimatedPath = Animated.createAnimatedComponent(Path);

type Props = Pick<
  ComponentProps<typeof SpotlightTooltip>,
  | "title"
  | "description"
  | "step"
  | "total"
  | "onBack"
  | "onNext"
  | "onSkip"
  | "onDismiss"
> & {
  target: SpotlightRect;
  viewport: Pick<SpotlightRect, "width" | "height">;
};

/** Dims the underlying screen and shields it from touches while a step is visible. */
export default function SpotlightOverlay({
  target,
  viewport,
  onDismiss,
  ...tooltip
}: Props) {
  const insets = useSafeAreaInsets();
  const [reduceMotion, setReduceMotion] = useState(true);
  const left = Math.max(0, target.x - SPOTLIGHT_PADDING);
  const top = Math.max(0, target.y - SPOTLIGHT_PADDING);
  const right = Math.min(
    viewport.width,
    target.x + target.width + SPOTLIGHT_PADDING,
  );
  const bottom = Math.min(
    viewport.height,
    target.y + target.height + SPOTLIGHT_PADDING,
  );
  const targetCenter = target.x + target.width / 2;
  const tooltipMinX = insets.left + TOOLTIP_GUTTER;
  const tooltipMaxX = viewport.width - insets.right - TOOLTIP_GUTTER;
  const tooltipWidth = Math.min(TOOLTIP_MAX_WIDTH, tooltipMaxX - tooltipMinX);
  const tooltipLeft = Math.max(
    tooltipMinX,
    Math.min(targetCenter - tooltipWidth / 2, tooltipMaxX - tooltipWidth),
  );
  const pointerCenter = Math.max(
    POINTER_INSET,
    Math.min(targetCenter - tooltipLeft, tooltipWidth - POINTER_INSET),
  );
  const pointerLeft = pointerCenter - POINTER_WIDTH / 2;
  const tooltipBottom = Math.max(
    viewport.height - top + TOOLTIP_GAP,
    insets.bottom + TOOLTIP_GUTTER,
  );
  const tooltipHeight =
    viewport.height -
    tooltipBottom -
    insets.top -
    TOOLTIP_GUTTER -
    MASCOT_OVERLAP;
  const belowTop = bottom + TOOLTIP_GAP + MASCOT_OVERLAP;
  const belowHeight =
    viewport.height - belowTop - insets.bottom - TOOLTIP_GUTTER;
  const pointerUp = tooltip.step === undefined && belowHeight > tooltipHeight;
  const maxHeight = pointerUp ? belowHeight : tooltipHeight;
  const canShowTooltip = tooltipWidth > 0 && maxHeight >= 72;

  const geometry = useSharedValue({
    left,
    top,
    right,
    bottom,
    tooltipLeft,
    pointerLeft,
  });
  const opacity = useSharedValue(1);

  useEffect(() => {
    let current = true;
    let receivedChange = false;
    const listener = AccessibilityInfo.addEventListener(
      "reduceMotionChanged",
      (enabled) => {
        receivedChange = true;
        setReduceMotion(enabled);
      },
    );

    void AccessibilityInfo.isReduceMotionEnabled()
      .then((enabled) => {
        if (current && !receivedChange) setReduceMotion(enabled);
      })
      .catch(() => {
        // Keep the tour static if the platform preference is unavailable.
      });

    return () => {
      current = false;
      listener.remove();
    };
  }, []);

  useEffect(() => {
    const next = { left, top, right, bottom, tooltipLeft, pointerLeft };
    geometry.set(
      reduceMotion
        ? next
        : withTiming(next, {
            duration: 220,
            easing: Easing.out(Easing.cubic),
            reduceMotion: ReduceMotion.Never,
          }),
    );
  }, [
    bottom,
    geometry,
    left,
    pointerLeft,
    reduceMotion,
    right,
    tooltipLeft,
    top,
  ]);

  const { step } = tooltip;
  useEffect(() => {
    if (reduceMotion) {
      opacity.set(1);
      return;
    }

    opacity.set(0.72);
    opacity.set(
      withTiming(1, {
        duration: 180,
        easing: Easing.out(Easing.quad),
        reduceMotion: ReduceMotion.Never,
      }),
    );
  }, [opacity, reduceMotion, step]);

  const maskProps = useAnimatedProps(() => {
    const { left, top, right, bottom } = geometry.get();
    const radius = Math.min(12, (right - left) / 2, (bottom - top) / 2);
    return {
      d: [
        `M 0 0 H ${viewport.width} V ${viewport.height} H 0 Z`,
        `M ${left + radius} ${top} H ${right - radius}`,
        `Q ${right} ${top} ${right} ${top + radius} V ${bottom - radius}`,
        `Q ${right} ${bottom} ${right - radius} ${bottom} H ${left + radius}`,
        `Q ${left} ${bottom} ${left} ${bottom - radius} V ${top + radius}`,
        `Q ${left} ${top} ${left + radius} ${top} Z`,
      ].join(" "),
    };
  });
  const bubbleMotion = useAnimatedStyle(() => ({
    opacity: opacity.get(),
    transform: [{ translateX: geometry.get().tooltipLeft }],
  }));
  const pointerMotion = useAnimatedStyle(() => ({
    transform: [{ translateX: geometry.get().pointerLeft }],
  }));

  useEffect(() => {
    if (!canShowTooltip) {
      onDismiss();
      return;
    }

    const listener = BackHandler.addEventListener("hardwareBackPress", () => {
      onDismiss();
      return true;
    });
    return () => listener.remove();
  }, [canShowTooltip, onDismiss]);

  if (!canShowTooltip) return null;

  return (
    <View style={[StyleSheet.absoluteFill, styles.overlay]}>
      {/* Transparent spotlight and dimmed surroundings */}
      <Svg
        pointerEvents="none"
        width={viewport.width}
        height={viewport.height}
        viewBox={`0 0 ${viewport.width} ${viewport.height}`}
      >
        <AnimatedPath
          animatedProps={maskProps}
          fill="rgba(0, 0, 0, 0.65)"
          fillRule="evenodd"
        />
      </Svg>

      {/* Instructions anchored above the spotlight */}
      <Animated.View
        style={[
          styles.tooltip,
          pointerUp
            ? { top: belowTop, width: tooltipWidth }
            : { bottom: tooltipBottom, width: tooltipWidth },
          bubbleMotion,
        ]}
      >
        <SpotlightTooltip
          {...tooltip}
          maxHeight={maxHeight}
          pointerUp={pointerUp}
          pointerMotion={pointerMotion}
          onDismiss={onDismiss}
        />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: { zIndex: 1 },
  tooltip: { position: "absolute", left: 0 },
});
