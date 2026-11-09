import {
  fetchNotifications,
  fetchNotificationUnreadCount,
} from "../services/notificationService";

export const notificationKeys = {
  account: (userId) => ["admin", "notifications", userId],
  list: (userId, params) => [...notificationKeys.account(userId), "list", params],
  unreadCount: (userId) => [...notificationKeys.account(userId), "unread-count"],
};

/** Keep each account, read filter, and requested page in a separate cache. */
export function notificationListOptions(userId, params) {
  return {
    queryKey: notificationKeys.list(userId, params),
    queryFn: ({ signal }) => fetchNotifications(params, { signal }),
    staleTime: 30_000,
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
  };
}

/** Poll only the lightweight badge query, using React Query's visibility handling. */
export function notificationCountOptions(userId, { poll = false } = {}) {
  return {
    queryKey: notificationKeys.unreadCount(userId),
    queryFn: ({ signal }) => fetchNotificationUnreadCount({ signal }),
    staleTime: 30_000,
    refetchInterval: poll ? 60_000 : false,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: "always",
    refetchOnReconnect: "always",
  };
}
