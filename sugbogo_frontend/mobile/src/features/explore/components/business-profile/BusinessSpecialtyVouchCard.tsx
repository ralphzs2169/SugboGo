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

/**
 * Displays a merchant-defined specialty as an Explorer-vouchable tile.
 *
 * Uses a bordered specialty treatment when inactive and switches to a solid
 * specialty color with reversed white content when the Explorer has vouched.
 * A short heart pulse reinforces successful vouch interactions.
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

    heartScale.setValue(1);
    pulseScale.setValue(1);
    pulseOpacity.setValue(0.45);

    Animated.sequence([
      Animated.spring(heartScale, {
        toValue: 1.35,
        speed: 25,
        bounciness: 10,
        useNativeDriver: true,
      }),
      Animated.spring(heartScale, {
        toValue: 1,
        speed: 20,
        bounciness: 8,
        useNativeDriver: true,
      }),
    ]).start();

    Animated.parallel([
      Animated.timing(pulseScale, {
        toValue: 2.2,
        duration: 400,
        useNativeDriver: true,
      }),
      Animated.timing(pulseOpacity, {
        toValue: 0,
        duration: 400,
        useNativeDriver: true,
      }),
    ]).start();
  }, [heartScale, isVouched, pulseOpacity, pulseScale]);

  return (
    <Pressable
      onPress={disabled ? undefined : onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={`${name}, ${vouchCount} vouches`}
      accessibilityState={{
        disabled,
        selected: isVouched,
      }}
      className="relative flex-1 cursor-pointer overflow-hidden rounded-xl px-3 py-2.5 active:opacity-80 disabled:opacity-60"
      style={{
        borderWidth: 1.5,
        borderColor: styles.borderColor,
        backgroundColor: isVouched ? styles.borderColor : "#FFFFFF",
      }}
    >
      {/* Specialty identity */}
      <View className="items-center">
        <MaterialCommunityIcons
          name={iconName}
          size={20}
          color={foregroundColor}
          accessibilityElementsHidden
          importantForAccessibility="no"
        />

        <AppText
          weight={isVouched ? "bold" : "regular"}
          className={`mt-1 text-center text-xs ${
            isVouched ? "text-white" : styles.accentText
          }`}
          numberOfLines={2}
        >
          {name}
        </AppText>
      </View>

      {/* Vouch interaction */}
      <View className="mt-1.5 flex-row items-center justify-center">
        <View className="h-5 w-5 items-center justify-center">
          {/* Vouch pulse */}
          <Animated.View
            pointerEvents="none"
            className="absolute h-5 w-5 rounded-full"
            style={{
              backgroundColor: foregroundColor,
              opacity: pulseOpacity,
              transform: [{ scale: pulseScale }],
            }}
          />

          {/* Vouch heart */}
          <Animated.View
            style={{
              transform: [{ scale: heartScale }],
            }}
          >
            <MaterialCommunityIcons
              name={isVouched ? "heart" : "heart-outline"}
              size={19}
              color={foregroundColor}
            />
          </Animated.View>
        </View>

        {/* Vouch count */}
        <AppText
          weight="bold"
          className={`ml-1 text-xs ${
            isVouched ? "text-white" : styles.accentText
          }`}
        >
          {vouchCount}
        </AppText>
      </View>
    </Pressable>
  );
}
