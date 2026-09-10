import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useEffect, useRef } from "react";
import { Animated, Pressable, View } from "react-native";

import { getSpecialtyTagColor } from "@/shared/constants/specialtyTagColors";
import AppText from "@/shared/components/AppText";
import type { SpecialtyTagColor } from "@/shared/types/specialtyTag.types";

type Props = {
  name: string;
  color: SpecialtyTagColor;
  vouchCount: number;
  isVouched: boolean;
  onPress: () => void;
  disabled?: boolean;
};

/**
 * Displays a merchant-defined specialty as an Explorer-vouchable tile.
 *
 * Unvouched specialties use a white background with a colored outline and
 * accent content, while vouched specialties use the specialty color as the
 * background with white foreground content.
 *
 * Vouching triggers a brief heart pop and pulse animation.
 */
export default function BusinessSpecialtyVouchCard({
  name,
  color,
  vouchCount,
  isVouched,
  onPress,
  disabled = false,
}: Props) {
  const styles = getSpecialtyTagColor(color);

  const heartScale = useRef(new Animated.Value(1)).current;
  const pulseScale = useRef(new Animated.Value(1)).current;
  const pulseOpacity = useRef(new Animated.Value(0)).current;
  const previousVouched = useRef(isVouched);

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

  const foregroundColor = isVouched ? styles.icon : styles.borderColor;

  return (
    <Pressable
      onPress={disabled ? undefined : onPress}
      accessibilityState={{ disabled }}
      className={`flex-1 cursor-pointer rounded-xl px-3 py-2.5 active:opacity-80 ${
        isVouched ? styles.background : "bg-white"
      }`}
      style={
        !isVouched
          ? {
              borderWidth: 1.5,
              borderColor: styles.borderColor,
            }
          : undefined
      }
    >
      {/* Specialty identity */}
      <AppText
        weight={isVouched ? "bold" : "regular"}
        className={`text-center text-xs ${
          isVouched ? styles.text : styles.accentText
        }`}
        numberOfLines={2}
      >
        {name}
      </AppText>

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
            isVouched ? styles.text : styles.accentText
          }`}
        >
          {vouchCount}
        </AppText>
      </View>
    </Pressable>
  );
}
