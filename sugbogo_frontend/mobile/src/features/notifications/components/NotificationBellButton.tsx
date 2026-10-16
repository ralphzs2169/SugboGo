import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { View } from "react-native";

import { theme } from "@/constants/theme";
import AppText from "@/shared/components/AppText";
import SafePressable from "@/shared/components/SafePressable";

import { useNotificationUnreadCount } from "../hooks/useNotifications";

const MAX_VISIBLE_UNREAD_COUNT = 99;

/**
 * Opens the shared account notification inbox and displays its live unread
 * count without blocking the surrounding header while the count is loading.
 */
export default function NotificationBellButton() {
  const router = useRouter();
  const { unreadCount } = useNotificationUnreadCount();
  const visibleUnreadCount = unreadCount ?? 0;
  const hasUnreadNotifications = visibleUnreadCount > 0;
  const badgeLabel =
    visibleUnreadCount > MAX_VISIBLE_UNREAD_COUNT
      ? `${MAX_VISIBLE_UNREAD_COUNT}+`
      : String(visibleUnreadCount);

  return (
    <SafePressable
      testID="notification-bell"
      onPress={() => router.push("/notifications")}
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
      <MaterialCommunityIcons
        name="bell-outline"
        size={24}
        color={theme.extends.colors.text.primary}
      />

      {hasUnreadNotifications ? (
        <View className="absolute right-0.5 top-0.5 min-h-5 min-w-5 items-center justify-center rounded-full border-2 border-white bg-brand px-1">
          <AppText
            weight="bold"
            numberOfLines={1}
            maxFontSizeMultiplier={1.2}
            className="text-center text-[10px] leading-4 text-white"
          >
            {badgeLabel}
          </AppText>
        </View>
      ) : null}
    </SafePressable>
  );
}
