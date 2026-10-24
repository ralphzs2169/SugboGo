import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { onlineManager } from "@tanstack/react-query";
import { Animated, Pressable, View } from "react-native";

import { theme } from "@/constants/theme";
import { usePocketPicker } from "@/features/pockets/providers/PocketPickerContext";

type Props = {
  businessId: number;
  isPocketed: boolean | null;
  disabled?: boolean;
};

/**
 * Opens the shared Pocket picker from either business-profile placement.
 *
 * A confirmed saved state triggers the existing bookmark pop and pulse.
 */
export default function BusinessPocketButton({
  businessId,
  isPocketed,
  disabled = false,
}: Props) {
  if (disabled || isPocketed === null) {
    return (
      <Pressable
        disabled
        accessibilityRole="button"
        accessibilityLabel="Pocket unavailable offline"
        accessibilityState={{ disabled: true }}
        className="h-10 w-10 items-center justify-center rounded-full bg-white/95 opacity-50"
      >
        <MaterialCommunityIcons
          name="bookmark-outline"
          size={22}
          color={theme.extends.colors.text.secondary}
        />
      </Pressable>
    );
  }
  return (
    <LiveBusinessPocketButton businessId={businessId} isPocketed={isPocketed} />
  );
}

/** Mounts the shared picker binding only for authoritative live membership. */
function LiveBusinessPocketButton({
  businessId,
  isPocketed,
}: {
  businessId: number;
  isPocketed: boolean;
}) {
  const picker = usePocketPicker();
  const active = useRef(true);
  useLayoutEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
    };
  }, []);

  const [bookmarkScale] = useState(() => new Animated.Value(1));
  const [pulseScale] = useState(() => new Animated.Value(1));
  const [pulseOpacity] = useState(() => new Animated.Value(0));

  const previousPocketedRef = useRef(isPocketed);

  useEffect(() => {
    const justPocketed = isPocketed && !previousPocketedRef.current;

    previousPocketedRef.current = isPocketed;

    if (!justPocketed) {
      return;
    }

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

  return (
    <Pressable
      onPress={() => {
        if (active.current && onlineManager.isOnline())
          picker?.openPocketPicker(businessId);
      }}
      disabled={!picker || picker.isOpen}
      hitSlop={4}
      accessibilityRole="button"
      accessibilityLabel={
        isPocketed ? "Edit Pocket collections" : "Save business to Pockets"
      }
      className="relative h-10 w-10 cursor-pointer items-center justify-center rounded-full bg-white/95 active:opacity-80"
      android_ripple={{
        color: "rgba(0,0,0,0.08)",
        borderless: true,
      }}
    >
      {/* Pocket pulse */}
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

      {/* White button surface */}
      <View
        pointerEvents="none"
        className="absolute h-10 w-10 rounded-full bg-white/95"
      />

      {/* Bookmark */}
      <Animated.View
        style={{
          transform: [{ scale: bookmarkScale }],
        }}
      >
        <MaterialCommunityIcons
          name={isPocketed ? "bookmark" : "bookmark-outline"}
          size={22}
          color={isPocketed ? theme.extends.colors.brand : undefined}
        />
      </Animated.View>
    </Pressable>
  );
}
