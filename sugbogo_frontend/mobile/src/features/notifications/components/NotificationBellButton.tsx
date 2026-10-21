import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useIsFocused, useRouter } from "expo-router";
import { useCallback, useEffect } from "react";
import { AppState } from "react-native";
import Animated, {
  cancelAnimation,
  Easing,
  ReduceMotion,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSequence,
  withTiming,
} from "react-native-reanimated";

import { theme } from "@/constants/theme";
import { useAuthStore } from "@/features/auth/store/auth.store";
import AppText from "@/shared/components/AppText";
import SafePressable from "@/shared/components/SafePressable";

import { useNotificationUnreadCount } from "../hooks/useNotifications";
import { notificationArrivalService } from "../services/notificationArrival.service";

const MAX_VISIBLE_UNREAD_COUNT = 99;

const motionConfig = {
  easing: Easing.inOut(Easing.quad),
  reduceMotion: ReduceMotion.System,
};

/**
 * Opens the shared account notification inbox and displays its live unread
 * count without blocking the surrounding header while the count is loading.
 * Gives each account one unread reminder per app session, never per route visit.
 */
export default function NotificationBellButton() {
  const router = useRouter();
  const isFocused = useIsFocused();
  const { unreadCount } = useNotificationUnreadCount();
  const userId = useAuthStore((state) => state.user?.id);
  const reducedMotion = useReducedMotion();
  const rotation = useSharedValue(0);
  const badgeScale = useSharedValue(1);
  const pressScale = useSharedValue(1);
  const visibleUnreadCount = unreadCount ?? 0;
  const hasUnreadNotifications = visibleUnreadCount > 0;
  const badgeLabel =
    visibleUnreadCount > MAX_VISIBLE_UNREAD_COUNT
      ? `${MAX_VISIBLE_UNREAD_COUNT}+`
      : String(visibleUnreadCount);

  const animateArrival = useCallback(() => {
    rotation.set(
      withSequence(
        ReduceMotion.System,
        withTiming(-10, { ...motionConfig, duration: 100 }),
        withTiming(10, { ...motionConfig, duration: 140 }),
        withTiming(-6, { ...motionConfig, duration: 130 }),
        withTiming(4, { ...motionConfig, duration: 120 }),
        withTiming(-2, { ...motionConfig, duration: 100 }),
        withTiming(0, { ...motionConfig, duration: 110 }),
      ),
    );
    badgeScale.set(
      withSequence(
        ReduceMotion.System,
        withTiming(0.85, { ...motionConfig, duration: 100 }),
        withTiming(1.1, { ...motionConfig, duration: 140 }),
        withTiming(1, { ...motionConfig, duration: 460 }),
      ),
    );
  }, [badgeScale, rotation]);

  useEffect(() => {
    if (!userId) {
      return;
    }
    return notificationArrivalService.subscribe({
      userId,
      isEligible: () =>
        isFocused && !reducedMotion && AppState.currentState === "active",
      animate: animateArrival,
    });
  }, [animateArrival, isFocused, reducedMotion, userId]);

  useEffect(() => {
    if (userId && unreadCount !== undefined && isFocused) {
      notificationArrivalService.remind(userId, unreadCount);
    }
  }, [isFocused, unreadCount, userId]);

  useEffect(() => {
    const stopMotion = () => {
      cancelAnimation(rotation);
      cancelAnimation(badgeScale);
      cancelAnimation(pressScale);
      rotation.value = 0;
      badgeScale.value = 1;
      pressScale.value = 1;
    };
    const subscription = AppState.addEventListener("change", (state) => {
      if (state !== "active") {
        stopMotion();
      }
    });

    return () => {
      subscription.remove();
      stopMotion();
    };
  }, [badgeScale, pressScale, rotation]);

  const bellStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
  }));
  const badgeStyle = useAnimatedStyle(() => ({
    transform: [{ scale: badgeScale.value }],
  }));
  const pressStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pressScale.value }],
  }));

  return (
    <Animated.View style={pressStyle}>
      <SafePressable
        testID="notification-bell"
        onPress={() => router.push("/notifications")}
        onPressIn={() => {
          if (!reducedMotion) {
            pressScale.set(
              withTiming(0.95, {
                ...motionConfig,
                duration: 90,
              }),
            );
          }
        }}
        onPressOut={() => {
          pressScale.set(withTiming(1, { ...motionConfig, duration: 120 }));
        }}
        hitSlop={4}
        accessibilityRole="button"
        accessibilityLabel={
          hasUnreadNotifications
            ? `Notifications, ${visibleUnreadCount} unread`
            : "Notifications"
        }
        accessibilityHint="Opens your notification inbox"
        className="relative h-12 w-12 cursor-pointer items-center justify-center rounded-full active:bg-background"
      >
        {/* Only the bell swings around its upper center. */}
        <Animated.View style={[bellStyle, { transformOrigin: "50% 0%" }]}>
          <MaterialCommunityIcons
            name="bell-outline"
            size={24}
            color={theme.extends.colors.text.primary}
          />
        </Animated.View>

        {/* Preserve the existing badge geometry and count presentation. */}
        {hasUnreadNotifications ? (
          <Animated.View
            style={badgeStyle}
            className="absolute right-0.5 top-0.5 min-h-5 min-w-5 items-center justify-center rounded-full border-2 border-white bg-text-error px-1"
          >
            <AppText
              weight="bold"
              numberOfLines={1}
              maxFontSizeMultiplier={1.2}
              className="text-center text-[10px] leading-4 text-white"
            >
              {badgeLabel}
            </AppText>
          </Animated.View>
        ) : null}
      </SafePressable>
    </Animated.View>
  );
}
