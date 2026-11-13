import { BackHandler, StyleSheet, View } from "react-native";
import { useEffect, type ComponentProps } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Path } from "react-native-svg";

import type { SpotlightRect } from "../hooks/useSpotlightTargets";
import SpotlightTooltip from "./SpotlightTooltip";

const SPOTLIGHT_PADDING = 4;
const TOOLTIP_GUTTER = 16;
const TOOLTIP_GAP = 12;
const TOOLTIP_MAX_WIDTH = 360;

type Props = Pick<
  ComponentProps<typeof SpotlightTooltip>,
  "title" | "description" | "step" | "total" | "onBack" | "onNext" | "onSkip" | "onDismiss"
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
  const radius = Math.min(12, (right - left) / 2, (bottom - top) / 2);

  const tooltipMinX = insets.left + TOOLTIP_GUTTER;
  const tooltipMaxX = viewport.width - insets.right - TOOLTIP_GUTTER;
  const tooltipWidth = Math.min(TOOLTIP_MAX_WIDTH, tooltipMaxX - tooltipMinX);
  const tooltipLeft = Math.max(
    tooltipMinX,
    Math.min((left + right - tooltipWidth) / 2, tooltipMaxX - tooltipWidth),
  );
  const tooltipBottom = Math.max(
    viewport.height - top + TOOLTIP_GAP,
    insets.bottom + TOOLTIP_GUTTER,
  );
  const tooltipHeight =
    viewport.height - tooltipBottom - insets.top - TOOLTIP_GUTTER;
  const canShowTooltip = tooltipWidth > 0 && tooltipHeight >= 72;

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

  const dimmerPath = [
    `M 0 0 H ${viewport.width} V ${viewport.height} H 0 Z`,
    `M ${left + radius} ${top} H ${right - radius}`,
    `Q ${right} ${top} ${right} ${top + radius} V ${bottom - radius}`,
    `Q ${right} ${bottom} ${right - radius} ${bottom} H ${left + radius}`,
    `Q ${left} ${bottom} ${left} ${bottom - radius} V ${top + radius}`,
    `Q ${left} ${top} ${left + radius} ${top} Z`,
  ].join(" ");

  return (
    <View style={[StyleSheet.absoluteFill, styles.overlay]}>
      {/* Transparent spotlight and dimmed surroundings */}
      <Svg
        pointerEvents="none"
        width={viewport.width}
        height={viewport.height}
        viewBox={`0 0 ${viewport.width} ${viewport.height}`}
      >
        <Path d={dimmerPath} fill="rgba(0, 0, 0, 0.65)" fillRule="evenodd" />
      </Svg>

      {/* Instructions anchored above the spotlight */}
      <SpotlightTooltip
        {...tooltip}
        left={tooltipLeft}
        width={tooltipWidth}
        bottom={tooltipBottom}
        maxHeight={tooltipHeight}
        onDismiss={onDismiss}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: { zIndex: 1 },
});
