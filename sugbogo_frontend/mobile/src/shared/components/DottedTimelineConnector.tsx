import { useState } from "react";
import { type LayoutChangeEvent, View } from "react-native";
import Svg, { Circle } from "react-native-svg";

import { theme } from "@/constants/theme";

type Props = {
  className?: string;
};

const DOT_RADIUS = 1.5;
const DOT_SPACING = 9;

/**
 * Displays a dynamic vertical sequence of circular dots for timeline-style UI.
 *
 * Adjusts the number of dots to the available connector height while keeping
 * each dot perfectly circular and evenly distributed.
 */
export default function DottedTimelineConnector({ className = "" }: Props) {
  const [height, setHeight] = useState(0);

  const handleLayout = (event: LayoutChangeEvent) => {
    setHeight(event.nativeEvent.layout.height);
  };

  const usableHeight = Math.max(0, height - DOT_RADIUS * 2);

  const dotCount =
    height > 0 ? Math.max(2, Math.floor(usableHeight / DOT_SPACING) + 1) : 0;

  return (
    <View className={`items-center ${className}`} onLayout={handleLayout}>
      {/* Dynamic circular timeline dots */}
      {height > 0 && (
        <Svg width={DOT_RADIUS * 2} height={height}>
          {Array.from({ length: dotCount }).map((_, index) => {
            const y =
              dotCount === 1
                ? height / 2
                : DOT_RADIUS + (usableHeight * index) / (dotCount - 1);

            return (
              <Circle
                key={index}
                cx={DOT_RADIUS}
                cy={y}
                r={DOT_RADIUS}
                fill={theme.extends.colors.text.tertiary}
              />
            );
          })}
        </Svg>
      )}
    </View>
  );
}
