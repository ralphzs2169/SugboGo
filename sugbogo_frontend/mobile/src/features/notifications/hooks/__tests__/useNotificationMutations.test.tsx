import type { PropsWithChildren } from "react";
import { act, renderHook, waitFor } from "@testing-library/react-native";
import {
  type InfiniteData,
  QueryClient,
  QueryClientProvider,
} from "@tanstack/react-query";

import { useAuthStore } from "@/features/auth/store/auth.store";

import {
  markAllNotificationsRead,
  markNotificationRead,
} from "../../api/notification.service";
import type {
  NotificationItem,
  NotificationPage,
  NotificationUnreadCount,
} from "../../types/notification.types";
import { notificationKeys } from "../notificationQueryKeys";
import { useNotificationMutations } from "../useNotificationMutations";

jest.mock("../../api/notification.service", () => ({
  markNotificationRead: jest.fn(),
  markAllNotificationsRead: jest.fn(),
}));

function setupClient() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

  function Wrapper({ children }: PropsWithChildren) {
    return (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
  }

  return { client, Wrapper };
}

function item(id: number, isRead = false): NotificationItem {
  return {
    id,
    type: "review_rejected",
    title: `Notification ${id}`,
    body: "Body",
    target_type: "",
    target_id: null,
    is_read: isRead,
    read_at: isRead ? "2026-10-14T10:00:00Z" : null,
    created_at: "2026-10-14T09:00:00Z",
  };
}

function data(items: NotificationItem[]): InfiniteData<NotificationPage> {
  return {
    pages: [
      {
        items,
        pagination: {
          page: 1,
          page_size: 20,
          total_items: items.length,
          total_pages: items.length ? 1 : 0,
          has_next: false,
          has_previous: false,
        },
      },
    ],
    pageParams: [1],
  };
}

describe("notification read mutations", () => {
  beforeEach(() => {
    jest.resetAllMocks();
    useAuthStore.setState({
      user: {
        id: 7,
        first_name: "Test",
        last_name: "User",
        gender: null,
        email: "test@example.com",
        role: "merchant",
        status: "active",
        has_completed_interest_selection: true,
        has_custom_profile_picture: false,
        has_oauth_accounts: false,
      },
      isAuthenticated: true,
    });
  });

  afterEach(() => {
    useAuthStore.setState({ user: null, isAuthenticated: false });
  });

  it("synchronizes All, Unread, and unread-count after marking one read", async () => {
    const updated = {
      ...item(1),
      is_read: true,
      read_at: "2026-10-14T12:00:00Z",
    };
    (markNotificationRead as jest.Mock).mockResolvedValue({
      success: true,
      data: updated,
    });
    const { client, Wrapper } = setupClient();
    client.setQueryData(
      notificationKeys.list(7, "all"),
      data([item(1), item(2)]),
    );
    client.setQueryData(
      notificationKeys.list(7, "unread"),
      data([item(1), item(2)]),
    );
    client.setQueryData<NotificationUnreadCount>(
      notificationKeys.unreadCount(7),
      { unread_count: 2 },
    );
    const { result, unmount } = await renderHook(
      () => useNotificationMutations(),
      {
        wrapper: Wrapper,
      },
    );

    await act(async () => {
      await result.current.markRead(1);
    });

    const all = client.getQueryData<InfiniteData<NotificationPage>>(
      notificationKeys.list(7, "all"),
    );
    const unread = client.getQueryData<InfiniteData<NotificationPage>>(
      notificationKeys.list(7, "unread"),
    );
    expect(all?.pages[0].items[0]).toEqual(updated);
    expect(
      unread?.pages[0].items.map((notification) => notification.id),
    ).toEqual([2]);
    expect(
      client.getQueryData<NotificationUnreadCount>(
        notificationKeys.unreadCount(7),
      ),
    ).toEqual({ unread_count: 1 });

    unmount();
    client.clear();
  });

  it("optimistically clears unread state for bulk read and restores it on failure", async () => {
    let rejectRequest!: (error: unknown) => void;
    (markAllNotificationsRead as jest.Mock).mockReturnValue(
      new Promise((_resolve, reject) => {
        rejectRequest = reject;
      }),
    );
    const { client, Wrapper } = setupClient();
    const allKey = notificationKeys.list(7, "all");
    const unreadKey = notificationKeys.list(7, "unread");
    client.setQueryData(allKey, data([item(1), item(2)]));
    client.setQueryData(unreadKey, data([item(1), item(2)]));
    client.setQueryData<NotificationUnreadCount>(
      notificationKeys.unreadCount(7),
      { unread_count: 2 },
    );
    const { result, unmount } = await renderHook(
      () => useNotificationMutations(),
      {
        wrapper: Wrapper,
      },
    );

    let request!: Promise<unknown>;
    await act(async () => {
      request = result.current.markAllRead();
    });

    await waitFor(() => {
      const unread =
        client.getQueryData<InfiniteData<NotificationPage>>(unreadKey);
      expect(unread?.pages[0].items).toEqual([]);
      expect(
        client.getQueryData<NotificationUnreadCount>(
          notificationKeys.unreadCount(7),
        ),
      ).toEqual({ unread_count: 0 });
    });

    await act(async () => {
      rejectRequest({ success: false, message: "Offline", code: "OFFLINE" });
      await expect(request).rejects.toEqual({
        success: false,
        message: "Offline",
        code: "OFFLINE",
      });
    });

    expect(
      client
        .getQueryData<InfiniteData<NotificationPage>>(allKey)
        ?.pages[0].items.every((notification) => !notification.is_read),
    ).toBe(true);
    expect(
      client.getQueryData<InfiniteData<NotificationPage>>(unreadKey)?.pages[0]
        .items,
    ).toHaveLength(2);
    expect(
      client.getQueryData<NotificationUnreadCount>(
        notificationKeys.unreadCount(7),
      ),
    ).toEqual({ unread_count: 2 });

    unmount();
    client.clear();
  });
});
