import { MaterialCommunityIcons } from "@expo/vector-icons";
import type { ComponentProps } from "react";
import { useEffect, useRef, useState } from "react";
import { Animated, Easing, View } from "react-native";

import { theme } from "@/constants/theme";
import { shadows } from "@/shared/styles/shadows";

import AppText from "./AppText";
import SafePressable from "./SafePressable";

export type SegmentedControlOption<T extends string> = {
  value: T;
  label: string;
  icon?: ComponentProps<typeof MaterialCommunityIcons>["name"];
  accessibilityLabel?: string;
};

type SegmentedControlProps<T extends string> = {
  options: readonly SegmentedControlOption<T>[];
  value: T;
  onChange: (value: T) => void;
  variant?: "default" | "sm";
  className?: string;
};

/**
 * Reusable animated segmented control for single-choice selection.
 *
 * Supports dynamic options, optional icons, and compact sizing
 * while preserving the animated sliding selection indicator.
 */
export default function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  variant = "default",
  className = "",
}: SegmentedControlProps<T>) {
  const [trackWidth, setTrackWidth] = useState(0);
  const thumbX = useRef(new Animated.Value(0)).current;

  const isSmall = variant === "sm";
  const trackPadding = isSmall ? 3 : 4;

  const selectedIndex = options.findIndex((option) => option.value === value);

  const segmentWidth =
    options.length > 0
      ? Math.max((trackWidth - trackPadding * 2) / options.length, 0)
      : 0;

  // Animate the thumb when selection or dimensions change.
  useEffect(() => {
    if (selectedIndex < 0 || segmentWidth <= 0) return;

    const animation = Animated.timing(thumbX, {
      toValue: selectedIndex * segmentWidth,
      duration: 180,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    });

    animation.start();

    return () => animation.stop();
  }, [selectedIndex, segmentWidth, thumbX]);

  return (
    <View
      className={`flex-row rounded-full bg-surface-muted ${className}`}
      style={{ padding: trackPadding }}
      onLayout={(event) => setTrackWidth(event.nativeEvent.layout.width)}
    >
      {/* Animated selection indicator */}
      {segmentWidth > 0 && selectedIndex >= 0 && (
        <Animated.View
          pointerEvents="none"
          style={[
            shadows.subtle,
            {
              position: "absolute",
              top: trackPadding,
              bottom: trackPadding,
              left: trackPadding,
              width: segmentWidth,
              borderRadius: 999,
              backgroundColor: theme.extends.colors.brand,
              transform: [{ translateX: thumbX }],
            },
          ]}
        />
      )}

      {/* Selectable segments */}
      {options.map((option) => {
        const selected = value === option.value;

        return (
          <SafePressable
            key={option.value}
            onPress={() => onChange(option.value)}
            accessibilityLabel={option.accessibilityLabel ?? option.label}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            hitSlop={{ top: 4, bottom: 4 }}
            className={`min-w-0 flex-1 cursor-pointer flex-row items-center justify-center rounded-full active:opacity-75 ${
              isSmall
                ? "min-h-[32px] gap-1 px-2 py-1"
                : "min-h-[40px] gap-xs px-sm py-sm"
            }`}
          >
            {option.icon && (
              <MaterialCommunityIcons
                name={option.icon}
                size={isSmall ? 14 : 16}
                color={
                  selected
                    ? theme.extends.colors.surface
                    : theme.extends.colors.text.secondary
                }
                accessibilityElementsHidden
                importantForAccessibility="no"
              />
            )}

            <AppText
              weight={selected ? "semibold" : "medium"}
              className={`${isSmall ? "text-xs" : "text-small"} ${
                selected ? "text-white" : "text-text-secondary"
              }`}
              numberOfLines={1}
            >
              {option.label}
            </AppText>
          </SafePressable>
        );
      })}
    </View>
  );
}
