import { MaterialCommunityIcons } from "@expo/vector-icons";
import { ActivityIndicator, Pressable, View } from "react-native";

import { theme } from "@/constants/theme";
import AppText from "@/shared/components/AppText";

import type { NotificationItem } from "../types/notification.types";
import {
  formatNotificationTime,
  getNotificationPresentation,
} from "../utils/notificationPresentation";

type Props = {
  notification: NotificationItem;
  isPending?: boolean;
  disabled?: boolean;
  isNavigable?: boolean;
  isUnavailable?: boolean;
  destinationLabel?: string;
  onPress: (notification: NotificationItem) => void;
};

/** Renders one compact inbox row with truthful read and destination affordances. */
export default function NotificationRow({
  notification,
  isPending = false,
  disabled = false,
  isNavigable = false,
  isUnavailable = false,
  destinationLabel,
  onPress,
}: Props) {
  const { icon } = getNotificationPresentation(notification.type);
  const timestamp = formatNotificationTime(notification.created_at);
  const isActionable = !notification.is_read || isNavigable || isUnavailable;

  const content = (
    <View
      className={`flex-row gap-3 px-5 py-4 ${
        notification.is_read ? "bg-surface" : "bg-background"
      }`}
    >
      {/* Notification category */}
      <View className="h-10 w-10 shrink-0 items-center justify-center rounded-full bg-surface-muted">
        <MaterialCommunityIcons
          name={icon}
          size={20}
          color={theme.extends.colors.text.secondary}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        />
      </View>

      {/* Notification content */}
      <View className="min-w-0 flex-1">
        <View className="flex-row items-start gap-2">
          <AppText
            weight={notification.is_read ? "medium" : "bold"}
            className="min-w-0 flex-1 text-base leading-5 text-text-primary"
          >
            {notification.title}
          </AppText>

          {!notification.is_read ? (
            <View
              testID="notification-unread-indicator"
              className="mt-1.5 h-2 w-2 rounded-full bg-brand"
              accessibilityLabel="Unread"
            />
          ) : null}
        </View>

        <AppText className="mt-1 text-sm leading-5 text-text-secondary">
          {notification.body}
        </AppText>

        {timestamp ? (
          <AppText className="mt-1.5 text-xs text-text-tertiary">
            {timestamp}
          </AppText>
        ) : null}
      </View>

      {isPending ? (
        <ActivityIndicator
          size="small"
          color={theme.extends.colors.brand}
          accessibilityLabel="Opening notification"
        />
      ) : isNavigable ? (
        <MaterialCommunityIcons
          testID="notification-destination-indicator"
          name="chevron-right"
          size={20}
          color={theme.extends.colors.text.tertiary}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        />
      ) : null}
    </View>
  );

  if (!isActionable) {
    return (
      <View
        accessible
        accessibilityLabel={`Read notification. ${notification.title}. ${notification.body}${timestamp ? `. ${timestamp}` : ""}`}
      >
        {content}
      </View>
    );
  }

  return (
    <Pressable
      onPress={() => onPress(notification)}
      disabled={disabled || isPending}
      accessibilityRole="button"
      accessibilityLabel={`${notification.is_read ? "Read" : "Unread"} notification. ${notification.title}. ${notification.body}`}
      accessibilityHint={
        isNavigable
          ? `Opens the ${destinationLabel ?? "notification destination"}`
          : isUnavailable
            ? "Shows why the notification destination is unavailable"
            : "Marks this notification as read"
      }
      accessibilityState={{ disabled: disabled || isPending, busy: isPending }}
      className="cursor-pointer active:opacity-75"
    >
      {content}
    </Pressable>
  );
}
