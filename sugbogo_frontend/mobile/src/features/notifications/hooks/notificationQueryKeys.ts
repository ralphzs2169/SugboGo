import type { NotificationFilter } from "../types/notification.types";

export const NOTIFICATIONS_QUERY_KEY = ["notifications"] as const;

/** Builds account-aware notification keys so cached inboxes never cross users. */
export const notificationKeys = {
  all: NOTIFICATIONS_QUERY_KEY,
  account: (userId: number | undefined) =>
    [...NOTIFICATIONS_QUERY_KEY, userId ?? "anonymous"] as const,
  lists: (userId: number | undefined) =>
    [...notificationKeys.account(userId), "list"] as const,
  list: (userId: number | undefined, filter: NotificationFilter) =>
    [...notificationKeys.lists(userId), filter] as const,
  unreadCount: (userId: number | undefined) =>
    [...notificationKeys.account(userId), "unread-count"] as const,
};
