import { useCallback, useEffect, useRef, useState } from "react";
import { Pressable, ScrollView, View } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

import { theme } from "@/constants/theme";
import AppText from "@/shared/components/AppText";

import type { VisibilityMetric } from "../../types/merchantPlusAnalytics.types";

type MetricOption = {
  value: VisibilityMetric;
  label: string;
};

type Props = {
  options: readonly MetricOption[];
  value: VisibilityMetric;
  onChange: (value: VisibilityMetric) => void;
};

type TabLayout = {
  x: number;
  width: number;
};

const ANIMATION_CONFIG = {
  duration: 240,
  easing: Easing.out(Easing.cubic),
};

/**
 * Displays horizontally scrollable visibility metric tabs.
 *
 * Highlights the selected label with the brand color and animates
 * a matching underline between tabs. Selected tabs scroll into view
 * when the tab row exceeds the available screen width.
 */
export default function AnalyticsVisibilityMetricTabs({
  options,
  value,
  onChange,
}: Props) {
  const scrollRef = useRef<ScrollView>(null);
  const tabLayouts = useRef<Partial<Record<VisibilityMetric, TabLayout>>>({});

  const initialized = useRef(false);
  const [viewportWidth, setViewportWidth] = useState(0);

  const indicatorX = useSharedValue(0);
  const indicatorWidth = useSharedValue(0);

  const moveIndicator = useCallback(
    (selected: VisibilityMetric, scrollIntoView = false) => {
      const layout = tabLayouts.current[selected];

      if (!layout) return;

      if (!initialized.current) {
        // First layout should appear in place without sliding in.
        indicatorX.value = layout.x;
        indicatorWidth.value = layout.width;
        initialized.current = true;
      } else {
        indicatorX.value = withTiming(layout.x, ANIMATION_CONFIG);

        indicatorWidth.value = withTiming(layout.width, ANIMATION_CONFIG);
      }

      if (scrollIntoView && viewportWidth > 0) {
        const centeredOffset = layout.x + layout.width / 2 - viewportWidth / 2;

        scrollRef.current?.scrollTo({
          x: Math.max(0, centeredOffset),
          animated: true,
        });
      }
    },
    [indicatorX, indicatorWidth, viewportWidth],
  );

  useEffect(() => {
    moveIndicator(value, true);
  }, [value, moveIndicator]);

  const indicatorStyle = useAnimatedStyle(() => ({
    width: indicatorWidth.value,
    opacity: indicatorWidth.value > 0 ? 1 : 0,
    transform: [{ translateX: indicatorX.value }],
  }));

  return (
    <View className="border-b border-border-primary/60">
      {/* Scrollable metric navigation */}
      <ScrollView
        ref={scrollRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        onLayout={(event) => {
          setViewportWidth(event.nativeEvent.layout.width);
        }}
        contentContainerStyle={{ paddingRight: 12 }}
      >
        <View className="relative flex-row items-stretch">
          {options.map((option) => {
            const selected = value === option.value;

            return (
              <Pressable
                key={option.value}
                onPress={() => onChange(option.value)}
                onLayout={(event) => {
                  const { x, width } = event.nativeEvent.layout;

                  tabLayouts.current[option.value] = {
                    x,
                    width,
                  };

                  if (selected) {
                    moveIndicator(option.value);
                  }
                }}
                accessibilityRole="tab"
                accessibilityLabel={option.label}
                accessibilityState={{ selected }}
                className="min-h-12 cursor-pointer items-center justify-center px-3 pb-3 pt-2 active:opacity-70"
              >
                <AppText
                  weight={selected ? "bold" : "medium"}
                  className={`text-sm ${
                    selected ? "text-brand" : "text-text-secondary"
                  }`}
                >
                  {option.label}
                </AppText>
              </Pressable>
            );
          })}

          {/* Animated brand underline */}
          <Animated.View
            pointerEvents="none"
            style={[
              indicatorStyle,
              {
                position: "absolute",
                bottom: 0,
                height: 3,
                backgroundColor: theme.extends.colors.brand,
                borderTopLeftRadius: 3,
                borderTopRightRadius: 3,
              },
            ]}
          />
        </View>
      </ScrollView>
    </View>
  );
}
