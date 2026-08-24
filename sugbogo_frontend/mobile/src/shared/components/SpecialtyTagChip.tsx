import { useEffect, useRef } from "react";
import { Animated, Pressable, Text, View } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";

import { getSpecialtyTagColor } from "@/shared/constants/specialtyTagColors";
import type { SpecialtyTagColor } from "@/shared/types/specialtyTag.types";

type SpecialtyTagChipProps = {
  tag: {
    name: string;
    color: SpecialtyTagColor;
  };
  size?: "default" | "small";
  isSelected?: boolean;
  isDisabled?: boolean;
  onPress?: () => void;
  showCheckIcon?: boolean;
  showDisabledStyle?: boolean;
  count?: number;
  scaleOnPress?: boolean;
  showVouchCount?: boolean;
  showVouchIndicator?: boolean;
};

/**
 * Renders a specialty tag as a reusable visual chip.
 *
 * The chip is presentation-focused and does not manage selection state.
 * Parent components control selection, disabled state, interaction, and
 * optional vouch indicators or counts.
 *
 * When used in a vouch context, newly vouching a specialty triggers a brief
 * pop + pulse animation on the heart icon. The animation is enabled by
 * either `showVouchIndicator` or `showVouchCount`.
 */
export default function SpecialtyTagChip({
  tag,
  size = "default",
  isSelected = false,
  isDisabled = false,
  onPress,
  showCheckIcon = false,
  showDisabledStyle = true,
  count,
  scaleOnPress = false,
  showVouchCount = false,
  showVouchIndicator = false,
}: SpecialtyTagChipProps) {
  const styles = getSpecialtyTagColor(tag.color);

  const isInteractive = Boolean(onPress);
  const isSmall = size === "small";
  const isVouchContext = showVouchIndicator || showVouchCount;

  // Heart pop + pulse animation — vouch context only.
  const heartScale = useRef(new Animated.Value(1)).current;
  const pulseScale = useRef(new Animated.Value(1)).current;
  const pulseOpacity = useRef(new Animated.Value(0)).current;

  const previousSelectedRef = useRef(isSelected);

  useEffect(() => {
    // Outside a vouch context, never animate.
    if (!isVouchContext) {
      previousSelectedRef.current = isSelected;
      return;
    }

    const justVouched = isSelected && !previousSelectedRef.current;
    previousSelectedRef.current = isSelected;

    if (!justVouched) {
      return;
    }

    heartScale.setValue(1);

    Animated.sequence([
      Animated.spring(heartScale, {
        toValue: 1.5,
        speed: 30,
        bounciness: 12,
        useNativeDriver: true,
      }),
      Animated.spring(heartScale, {
        toValue: 1,
        speed: 20,
        bounciness: 8,
        useNativeDriver: true,
      }),
    ]).start();

    pulseScale.setValue(1);
    pulseOpacity.setValue(0.5);

    Animated.parallel([
      Animated.timing(pulseScale, {
        toValue: 2.2,
        duration: 420,
        useNativeDriver: true,
      }),
      Animated.timing(pulseOpacity, {
        toValue: 0,
        duration: 420,
        useNativeDriver: true,
      }),
    ]).start();
  }, [isSelected, isVouchContext]);

  const heartSize = isSmall ? 13 : 16;

  return (
    <Pressable
      onPress={onPress}
      disabled={!isInteractive || isDisabled}
      style={({ pressed }) => ({
        transform: [
          {
            scale: scaleOnPress && pressed ? 1.05 : 1,
          },
        ],
      })}
      className={`mb-2 mr-2 flex-row items-center rounded-full ${
        isSmall ? "px-2.5 py-1" : "px-3.5 py-2"
      } ${styles.background} ${
        isSelected && !isVouchContext && !scaleOnPress
          ? `border ${styles.selectedBorder} border-2`
          : ""
      } ${isDisabled && showDisabledStyle ? "opacity-50" : ""}`}
    >
      {showCheckIcon && isSelected && !isVouchContext && (
        <MaterialCommunityIcons
          name="check"
          size={isSmall ? 12 : 16}
          color={styles.icon}
          style={{ marginRight: 4 }}
        />
      )}

      {/* Specialty name */}
      <Text
        className={`font-semibold uppercase ${
          isSmall ? "text-[10px]" : "text-sm"
        } ${styles.text}`}
      >
        {tag.name}
      </Text>

      {/* Vouch indicator */}
      {/* Vouch indicator */}
      {showVouchCount && count !== undefined && (
        <View
          className={`ml-2 flex-row items-center ${
            isSmall ? "pl-1.5" : "pl-2"
          }`}
        >
          <View
            className={`mr-1 ${isSmall ? "h-3" : "h-4"} w-px bg-black/10`}
          />

          <View
            style={{
              width: heartSize,
              height: heartSize,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {/* Pulse burst */}
            <Animated.View
              pointerEvents="none"
              style={{
                position: "absolute",
                width: heartSize,
                height: heartSize,
                borderRadius: heartSize,
                backgroundColor: styles.icon,
                opacity: pulseOpacity,
                transform: [{ scale: pulseScale }],
              }}
            />

            <Animated.View style={{ transform: [{ scale: heartScale }] }}>
              <MaterialCommunityIcons
                name={isSelected ? "heart" : "heart-outline"}
                size={heartSize}
                color={styles.icon}
              />
            </Animated.View>
          </View>

          <Text
            className={`ml-1 font-bold ${
              isSmall ? "text-[10px]" : "text-xs"
            } ${styles.text}`}
          >
            {count}
          </Text>
        </View>
      )}

      {showVouchIndicator && isSelected && (
        <MaterialCommunityIcons
          name="heart"
          size={heartSize}
          color={styles.icon}
          style={{ marginLeft: 5 }}
        />
      )}
    </Pressable>
  );
}
