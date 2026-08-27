import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Animated, Pressable, Text, View } from "react-native";
import { useEffect, useRef } from "react";

import { getSpecialtyTagColor } from "@/shared/constants/specialtyTagColors";
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
 * The specialty name represents the merchant's identity, while the heart and
 * count communicate community endorsement. Vouching triggers a brief heart
 * pop and pulse animation.
 *
 * When disabled (the business owner viewing their own listing), the tile
 * is visually identical to the interactive state — it simply doesn't
 * respond to taps, since a merchant vouching for their own specialty
 * isn't a real action, not a state worth calling out visually.
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
  }, [isVouched]);

  return (
    <Pressable
      onPress={disabled ? undefined : onPress}
      accessibilityState={{ disabled }}
      className={`flex-1 rounded-xl px-3 py-2.5 cursor-pointer active:opacity-80 ${styles.background}`}
    >
      {/* Specialty identity */}
      <Text
        className={`text-center text-xs font-bold ${styles.text}`}
        numberOfLines={2}
      >
        {name}
      </Text>

      {/* Vouch interaction */}
      <View className="mt-1.5 flex-row items-center justify-center">
        <View className="h-5 w-5 items-center justify-center">
          {/* Vouch pulse */}
          <Animated.View
            pointerEvents="none"
            className="absolute h-5 w-5 rounded-full"
            style={{
              backgroundColor: styles.icon,
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
              color={styles.icon}
            />
          </Animated.View>
        </View>

        <Text className={`ml-1 text-xs font-bold ${styles.text}`}>
          {vouchCount}
        </Text>
      </View>
    </Pressable>
  );
}
