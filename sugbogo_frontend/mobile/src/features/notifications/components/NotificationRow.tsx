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
  onMarkRead: (notificationId: number) => void;
};

/** Renders one compact inbox row and makes only unread items actionable. */
export default function NotificationRow({
  notification,
  isPending = false,
  disabled = false,
  onMarkRead,
}: Props) {
  const { icon } = getNotificationPresentation(notification.type);
  const timestamp = formatNotificationTime(notification.created_at);
  const isActionable = !notification.is_read;

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

          {isPending ? (
            <ActivityIndicator
              size="small"
              color={theme.extends.colors.brand}
              accessibilityLabel="Marking notification as read"
            />
          ) : !notification.is_read ? (
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
      onPress={() => onMarkRead(notification.id)}
      disabled={disabled || isPending}
      accessibilityRole="button"
      accessibilityLabel={`Unread notification. ${notification.title}. ${notification.body}`}
      accessibilityHint="Marks this notification as read"
      accessibilityState={{ disabled: disabled || isPending, busy: isPending }}
      className="cursor-pointer active:opacity-75"
    >
      {content}
    </Pressable>
  );
}
