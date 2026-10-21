import { View } from "react-native";

import FilterChip from "@/shared/components/FilterChip";

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
          <FilterChip
            key={option.value}
            label={option.label}
            count={option.value === "unread" ? unreadCount : undefined}
            selected={selected}
            showSelectedCheck
            onPress={() => onChange(option.value)}
            accessibilityLabel={option.label + countLabel}
          />
        );
      })}
    </View>
  );
}
