import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useEffect, useRef } from "react";
import { Animated, Pressable, View } from "react-native";

import AppText from "@/shared/components/AppText";
import { getSpecialtyTagColor } from "@/shared/constants/specialtyTagColors";
import { getSpecialtyTagIcon } from "@/shared/constants/specialtyTagIcons";
import type {
  SpecialtyTagColor,
  SpecialtyTagIcon,
} from "@/shared/types/specialtyTag.types";

type Props = {
  name: string;
  color: SpecialtyTagColor;
  icon?: SpecialtyTagIcon | null;
  vouchCount: number;
  isVouched: boolean;
  onPress: () => void;
  disabled?: boolean;
};

const REACTION_SIZE = 54;
const REACTION_WRAPPER_SIZE = 62;

/**
 * Displays a compact specialty vouch reaction.
 *
 * Keeps inactive and vouched states visually distinct while preserving a
 * lightweight social-reaction feel and animated feedback.
 */
export default function BusinessSpecialtyVouchCard({
  name,
  color,
  icon,
  vouchCount,
  isVouched,
  onPress,
  disabled = false,
}: Props) {
  const styles = getSpecialtyTagColor(color);
  const iconName = getSpecialtyTagIcon(icon);

  const reactionScale = useRef(new Animated.Value(1)).current;
  const heartScale = useRef(new Animated.Value(1)).current;
  const pulseScale = useRef(new Animated.Value(1)).current;
  const pulseOpacity = useRef(new Animated.Value(0)).current;
  const previousVouched = useRef(isVouched);

  const foregroundColor = isVouched ? "#FFFFFF" : styles.borderColor;

  useEffect(() => {
    const justVouched = isVouched && !previousVouched.current;

    previousVouched.current = isVouched;

    if (!justVouched) {
      return;
    }

    reactionScale.setValue(1);
    heartScale.setValue(1);
    pulseScale.setValue(1);
    pulseOpacity.setValue(0.24);

    Animated.parallel([
      Animated.sequence([
        Animated.spring(reactionScale, {
          toValue: 1.1,
          speed: 24,
          bounciness: 8,
          useNativeDriver: true,
        }),
        Animated.spring(reactionScale, {
          toValue: 1,
          speed: 20,
          bounciness: 6,
          useNativeDriver: true,
        }),
      ]),

      Animated.sequence([
        Animated.spring(heartScale, {
          toValue: 1.25,
          speed: 25,
          bounciness: 9,
          useNativeDriver: true,
        }),
        Animated.spring(heartScale, {
          toValue: 1,
          speed: 20,
          bounciness: 7,
          useNativeDriver: true,
        }),
      ]),

      Animated.parallel([
        Animated.timing(pulseScale, {
          toValue: 1.5,
          duration: 360,
          useNativeDriver: true,
        }),
        Animated.timing(pulseOpacity, {
          toValue: 0,
          duration: 360,
          useNativeDriver: true,
        }),
      ]),
    ]).start();
  }, [heartScale, isVouched, pulseOpacity, pulseScale, reactionScale]);

  return (
    <Pressable
      onPress={disabled ? undefined : onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={`${name}, ${vouchCount} ${
        vouchCount === 1 ? "vouch" : "vouches"
      }`}
      accessibilityState={{
        disabled,
        selected: isVouched,
      }}
      className="flex-1 cursor-pointer items-center px-0.5 py-1 active:opacity-75 disabled:opacity-50"
    >
      {/* Specialty reaction */}
      <View
        className="relative items-center justify-center"
        style={{
          width: REACTION_WRAPPER_SIZE,
          height: REACTION_WRAPPER_SIZE,
        }}
      >
        {isVouched && (
          <View
            pointerEvents="none"
            className="absolute rounded-full"
            style={{
              width: REACTION_SIZE + 8,
              height: REACTION_SIZE + 8,
              backgroundColor: styles.borderColor,
              opacity: 0.1,
            }}
          />
        )}

        <Animated.View
          pointerEvents="none"
          className="absolute rounded-full"
          style={{
            width: REACTION_SIZE,
            height: REACTION_SIZE,
            borderWidth: 2,
            borderColor: styles.borderColor,
            opacity: pulseOpacity,
            transform: [{ scale: pulseScale }],
          }}
        />

        <Animated.View
          className="items-center justify-center rounded-full"
          style={{
            width: REACTION_SIZE,
            height: REACTION_SIZE,
            borderWidth: isVouched ? 0 : 1.5,
            borderColor: isVouched ? "transparent" : styles.borderColor,
            backgroundColor: isVouched ? styles.borderColor : "#FFFFFF",
            transform: [{ scale: reactionScale }],
          }}
        >
          <MaterialCommunityIcons
            name={iconName}
            size={24}
            color={foregroundColor}
            accessibilityElementsHidden
            importantForAccessibility="no"
          />
        </Animated.View>
      </View>

      {/* Specialty label */}
      <View className="h-8 w-full items-center justify-center px-1">
        <AppText
          weight="semibold"
          className="w-full text-center text-[11px] leading-[14px] text-text-primary"
          numberOfLines={2}
        >
          {name}
        </AppText>
      </View>

      {/* Vouch state */}
      <View
        className="mt-0.5 flex-row items-center justify-center rounded-full px-2 py-0.5"
        style={{
          backgroundColor: isVouched
            ? styles.borderColor
            : `${styles.borderColor}14`,
        }}
      >
        <Animated.View
          style={{
            transform: [{ scale: heartScale }],
          }}
        >
          <MaterialCommunityIcons
            name={isVouched ? "heart" : "heart-outline"}
            size={14}
            color={isVouched ? "#FFFFFF" : styles.borderColor}
          />
        </Animated.View>

        <AppText
          weight="bold"
          className="ml-1 text-[10px]"
          style={{
            color: isVouched ? "#FFFFFF" : styles.borderColor,
          }}
        >
          {vouchCount}
        </AppText>
      </View>
    </Pressable>
  );
}
