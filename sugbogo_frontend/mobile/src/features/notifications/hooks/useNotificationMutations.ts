import {
  type InfiniteData,
  type QueryKey,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";

import { useAuthStore } from "@/features/auth/store/auth.store";
import { throwOnApiError } from "@/shared/utils/throwOnApiError";

import {
  markAllNotificationsRead,
  markNotificationRead,
} from "../api/notification.service";
import type {
  NotificationFilter,
  NotificationItem,
  NotificationPage,
  NotificationUnreadCount,
} from "../types/notification.types";
import { notificationKeys } from "./notificationQueryKeys";

type NotificationListSnapshot = [
  QueryKey,
  InfiniteData<NotificationPage> | undefined,
][];

type MutationSnapshot = {
  lists: NotificationListSnapshot;
  unreadCount: NotificationUnreadCount | undefined;
};

function updatedPagination(page: NotificationPage, removedCount: number) {
  const totalItems = Math.max(0, page.pagination.total_items - removedCount);
  const totalPages =
    totalItems === 0 ? 0 : Math.ceil(totalItems / page.pagination.page_size);

  return {
    ...page.pagination,
    total_items: totalItems,
    total_pages: totalPages,
    has_next: page.pagination.page < totalPages,
  };
}

function markOneReadInCache(
  data: InfiniteData<NotificationPage>,
  filter: NotificationFilter,
  updated: NotificationItem,
): InfiniteData<NotificationPage> {
  const containsItem = data.pages.some((page) =>
    page.items.some((item) => item.id === updated.id),
  );

  if (!containsItem) {
    return data;
  }

  return {
    ...data,
    pages: data.pages.map((page) => {
      if (filter === "unread") {
        return {
          ...page,
          items: page.items.filter((item) => item.id !== updated.id),
          pagination: updatedPagination(page, 1),
        };
      }

      return {
        ...page,
        items: page.items.map((item) =>
          item.id === updated.id ? updated : item,
        ),
      };
    }),
  };
}

function markAllReadInCache(
  data: InfiniteData<NotificationPage>,
  filter: NotificationFilter,
  readAt: string,
): InfiniteData<NotificationPage> {
  return {
    ...data,
    pages: data.pages.map((page) => {
      if (filter === "unread") {
        return {
          ...page,
          items: [],
          pagination: {
            ...page.pagination,
            total_items: 0,
            total_pages: 0,
            has_next: false,
          },
        };
      }

      return {
        ...page,
        items: page.items.map((item) =>
          item.is_read ? item : { ...item, is_read: true, read_at: readAt },
        ),
      };
    }),
  };
}

function restoreSnapshot(
  queryClient: ReturnType<typeof useQueryClient>,
  userId: number | undefined,
  snapshot: MutationSnapshot | undefined,
) {
  if (!snapshot) {
    return;
  }

  snapshot.lists.forEach(([key, data]) => queryClient.setQueryData(key, data));
  queryClient.setQueryData(
    notificationKeys.unreadCount(userId),
    snapshot.unreadCount,
  );
}

/** Provides optimistic read mutations while reconciling every inbox cache. */
export function useNotificationMutations() {
  const userId = useAuthStore((state) => state.user?.id);
  const queryClient = useQueryClient();

  async function snapshotAndCancel(): Promise<MutationSnapshot> {
    await queryClient.cancelQueries({
      queryKey: notificationKeys.account(userId),
    });

    return {
      lists: queryClient.getQueriesData<InfiniteData<NotificationPage>>({
        queryKey: notificationKeys.lists(userId),
      }),
      unreadCount: queryClient.getQueryData<NotificationUnreadCount>(
        notificationKeys.unreadCount(userId),
      ),
    };
  }

  async function reconcile() {
    await queryClient.invalidateQueries({
      queryKey: notificationKeys.account(userId),
      refetchType: "active",
    });
  }

  const markRead = useMutation({
    mutationFn: async (notificationId: number) =>
      throwOnApiError(await markNotificationRead(notificationId)),
    onMutate: async (notificationId): Promise<MutationSnapshot> => {
      const snapshot = await snapshotAndCancel();
      const readAt = new Date().toISOString();
      const optimisticItem = snapshot.lists
        .flatMap(([, data]) => data?.pages ?? [])
        .flatMap((page) => page.items)
        .find((item) => item.id === notificationId);

      if (optimisticItem) {
        snapshot.lists.forEach(([key, data]) => {
          if (!data) {
            return;
          }

          const filter = key[key.length - 1] as NotificationFilter;
          queryClient.setQueryData(
            key,
            markOneReadInCache(data, filter, {
              ...optimisticItem,
              is_read: true,
              read_at: readAt,
            }),
          );
        });

        queryClient.setQueryData<NotificationUnreadCount>(
          notificationKeys.unreadCount(userId),
          (current) =>
            current
              ? { unread_count: Math.max(0, current.unread_count - 1) }
              : current,
        );
      }

      return snapshot;
    },
    onSuccess: (updated) => {
      const lists = queryClient.getQueriesData<InfiniteData<NotificationPage>>({
        queryKey: notificationKeys.lists(userId),
      });

      lists.forEach(([key, data]) => {
        if (!data) {
          return;
        }

        queryClient.setQueryData(
          key,
          markOneReadInCache(
            data,
            key[key.length - 1] as NotificationFilter,
            updated,
          ),
        );
      });
    },
    onError: (_error, _notificationId, snapshot) => {
      restoreSnapshot(queryClient, userId, snapshot);
    },
    onSettled: reconcile,
  });

  const markAllRead = useMutation({
    mutationFn: async () => throwOnApiError(await markAllNotificationsRead()),
    onMutate: async (): Promise<MutationSnapshot> => {
      const snapshot = await snapshotAndCancel();
      const readAt = new Date().toISOString();

      snapshot.lists.forEach(([key, data]) => {
        if (!data) {
          return;
        }

        queryClient.setQueryData(
          key,
          markAllReadInCache(
            data,
            key[key.length - 1] as NotificationFilter,
            readAt,
          ),
        );
      });
      queryClient.setQueryData<NotificationUnreadCount>(
        notificationKeys.unreadCount(userId),
        { unread_count: 0 },
      );

      return snapshot;
    },
    onError: (_error, _variables, snapshot) => {
      restoreSnapshot(queryClient, userId, snapshot);
    },
    onSettled: reconcile,
  });

  return {
    markRead: markRead.mutateAsync,
    markAllRead: markAllRead.mutateAsync,
    pendingNotificationId: markRead.isPending ? markRead.variables : null,
    isMarkingOneRead: markRead.isPending,
    isMarkingAllRead: markAllRead.isPending,
  };
}
