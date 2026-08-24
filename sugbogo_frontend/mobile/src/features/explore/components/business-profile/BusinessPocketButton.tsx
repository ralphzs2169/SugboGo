import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useEffect, useRef } from "react";
import { Animated, Pressable, View } from "react-native";
import Toast from "react-native-toast-message";

import { theme } from "@/constants/theme";
import { handleSystemError } from "@/shared/utils/apiErrors";
import type { ApiResponse } from "@/shared/types/apiResponse.types";

import useBusinessPocket from "../../hooks/useBusinessPocket";

type Props = {
  businessId: number;
  isPocketed: boolean;
};

/**
 * Provides the business Pocket action with optimistic state feedback.
 *
 * Pocketing triggers a brief bookmark pop and circular pulse animation,
 * while removing a business from Pocket transitions quietly back to the
 * outlined bookmark state. Successful actions display a lightweight
 * confirmation toast, while failed requests are handled without leaving
 * the business profile in a failed state.
 */
export default function BusinessPocketButton({
  businessId,
  isPocketed,
}: Props) {
  const { pocket, isPending } = useBusinessPocket({
    businessId,
  });

  const bookmarkScale = useRef(new Animated.Value(1)).current;
  const pulseScale = useRef(new Animated.Value(1)).current;
  const pulseOpacity = useRef(new Animated.Value(0)).current;

  const previousPocketedRef = useRef(isPocketed);

  useEffect(() => {
    const justPocketed = isPocketed && !previousPocketedRef.current;

    previousPocketedRef.current = isPocketed;

    if (!justPocketed) {
      return;
    }

    // Bookmark pop animation
    bookmarkScale.setValue(1);

    Animated.sequence([
      Animated.spring(bookmarkScale, {
        toValue: 1.45,
        speed: 30,
        bounciness: 12,
        useNativeDriver: true,
      }),
      Animated.spring(bookmarkScale, {
        toValue: 1,
        speed: 20,
        bounciness: 8,
        useNativeDriver: true,
      }),
    ]).start();

    // Circular pulse animation
    pulseScale.setValue(1);
    pulseOpacity.setValue(0.45);

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
  }, [isPocketed, bookmarkScale, pulseScale, pulseOpacity]);

  const handlePress = async () => {
    if (isPending) {
      return;
    }

    try {
      await pocket({
        isPocketed,
      });

      Toast.show({
        type: "info",
        text1: isPocketed ? "Removed from Pocket" : "Added to Pocket",
        visibilityTime: 1500,
      });
    } catch (error) {
      const response = error as ApiResponse<unknown>;

      if (!response.success) {
        if (handleSystemError(response)) {
          return;
        }

        Toast.show({
          type: "error",
          text1: "Unable to update Pocket",
          text2: response.message || "Something went wrong. Please try again.",
        });
      }
    }
  };

  return (
    <Pressable
      onPress={handlePress}
      disabled={isPending}
      className="h-10 w-10 cursor-pointer items-center justify-center rounded-full bg-white/95 active:opacity-80"
      android_ripple={{
        color: "rgba(0,0,0,0.08)",
        borderless: true,
      }}
    >
      {/* Circular pulse behind the button */}
      <Animated.View
        pointerEvents="none"
        style={{
          position: "absolute",
          width: 40,
          height: 40,
          borderRadius: 20,
          backgroundColor: theme.extends.colors.brand,
          opacity: pulseOpacity,
          transform: [{ scale: pulseScale }],
        }}
      />

      {/* White circular button background */}
      <View
        pointerEvents="none"
        className="absolute h-10 w-10 rounded-full bg-white/95"
      />

      {/* Bookmark icon */}
      <Animated.View
        style={{
          transform: [{ scale: bookmarkScale }],
        }}
      >
        <MaterialCommunityIcons
          name={isPocketed ? "bookmark" : "bookmark-outline"}
          size={22}
          color={theme.extends.colors.text.primary}
        />
      </Animated.View>
    </Pressable>
  );
}
