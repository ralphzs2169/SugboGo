import { Pressable, View } from "react-native";

import AppText from "@/shared/components/AppText";

import type { NotificationFilter } from "../types/notification.types";

type Props = {
  value: NotificationFilter;
  unreadCount?: number;
  onChange: (filter: NotificationFilter) => void;
};

const OPTIONS: { value: NotificationFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "unread", label: "Unread" },
];

/** Displays the server-backed All and Unread inbox filters. */
export default function NotificationFilters({
  value,
  unreadCount,
  onChange,
}: Props) {
  return (
    <View className="flex-row flex-wrap gap-2 px-5 pb-3 pt-1">
      {/* Inbox filters */}
      {OPTIONS.map((option) => {
        const selected = option.value === value;
        const countLabel =
          option.value === "unread" && unreadCount !== undefined
            ? ` (${unreadCount})`
            : "";

        return (
          <Pressable
            key={option.value}
            onPress={() => onChange(option.value)}
            accessibilityRole="button"
            accessibilityLabel={`${option.label}${countLabel}`}
            accessibilityState={{ selected }}
            className={`min-h-11 cursor-pointer items-center justify-center rounded-full border px-4 active:opacity-70 ${
              selected
                ? "border-brand bg-brand/10"
                : "border-border-primary bg-surface"
            }`}
          >
            <AppText
              weight="semibold"
              className={`text-sm ${
                selected ? "text-brand" : "text-text-secondary"
              }`}
            >
              {option.label}
              {countLabel}
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );
}
