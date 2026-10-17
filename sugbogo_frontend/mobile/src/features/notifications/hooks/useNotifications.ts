import { useInfiniteQuery, useQuery } from "@tanstack/react-query";

import { useAuthStore } from "@/features/auth/store/auth.store";
import { throwOnApiError } from "@/shared/utils/throwOnApiError";

import {
  getNotifications,
  getNotificationUnreadCount,
} from "../api/notification.service";
import type { NotificationFilter } from "../types/notification.types";
import { notificationKeys } from "./notificationQueryKeys";

export const NOTIFICATION_PAGE_SIZE = 20;

/** Loads an independently cached, server-filtered notification collection. */
export function useNotifications(filter: NotificationFilter) {
  const userId = useAuthStore((state) => state.user?.id);

  const query = useInfiniteQuery({
    queryKey: notificationKeys.list(userId, filter),
    enabled: Boolean(userId),
    initialPageParam: 1,
    queryFn: async ({ pageParam }) =>
      throwOnApiError(
        await getNotifications({
          page: pageParam,
          pageSize: NOTIFICATION_PAGE_SIZE,
          isRead: filter === "unread" ? false : undefined,
        }),
      ),
    getNextPageParam: (lastPage) =>
      lastPage.pagination.has_next ? lastPage.pagination.page + 1 : undefined,
    staleTime: 30 * 1000,
  });

  return {
    notifications: query.data?.pages.flatMap((page) => page.items) ?? [],
    totalItems: query.data?.pages[0]?.pagination.total_items ?? 0,
    hasData: query.data !== undefined,
    hasNextPage: query.hasNextPage,
    fetchNextPage: query.fetchNextPage,
    isFetchingNextPage: query.isFetchingNextPage,
    isFetchNextPageError: query.isFetchNextPageError,
    isLoading: query.isLoading,
    isInitialLoading: query.isLoading && query.data === undefined,
    isFetching: query.isFetching,
    isRefetching: query.isRefetching,
    error: query.error,
    refetch: query.refetch,
  };
}

/** Loads unread totals separately so count failures never block the inbox. */
export function useNotificationUnreadCount() {
  const userId = useAuthStore((state) => state.user?.id);
  const query = useQuery({
    queryKey: notificationKeys.unreadCount(userId),
    enabled: Boolean(userId),
    queryFn: async () => throwOnApiError(await getNotificationUnreadCount()),
    staleTime: 30 * 1000,
  });

  return {
    unreadCount: query.data?.unread_count,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    isRefetching: query.isRefetching,
    error: query.error,
    refetch: query.refetch,
  };
}
