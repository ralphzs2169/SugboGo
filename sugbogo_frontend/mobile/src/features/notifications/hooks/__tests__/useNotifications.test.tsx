import type { PropsWithChildren } from "react";
import { act, renderHook, waitFor } from "@testing-library/react-native";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { useAuthStore } from "@/features/auth/store/auth.store";

import {
  getNotifications,
  getNotificationUnreadCount,
} from "../../api/notification.service";
import type {
  NotificationItem,
  NotificationPage,
} from "../../types/notification.types";
import {
  useNotifications,
  useNotificationUnreadCount,
} from "../useNotifications";

jest.mock("../../api/notification.service", () => ({
  getNotifications: jest.fn(),
  getNotificationUnreadCount: jest.fn(),
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

function notification(id: number): NotificationItem {
  return {
    id,
    type: "review_rejected",
    title: `Notification ${id}`,
    body: "Body",
    target_type: "",
    target_id: null,
    is_read: false,
    read_at: null,
    created_at: "2026-10-14T10:00:00Z",
  };
}

function page(
  ids: number[],
  pageNumber: number,
  hasNext: boolean,
): NotificationPage {
  return {
    items: ids.map(notification),
    pagination: {
      page: pageNumber,
      page_size: 20,
      total_items: 3,
      total_pages: 2,
      has_next: hasNext,
      has_previous: pageNumber > 1,
    },
  };
}

describe("notification queries", () => {
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

  it("paginates in backend order and keeps unread filtering server-side", async () => {
    (getNotifications as jest.Mock)
      .mockResolvedValueOnce({ success: true, data: page([3, 2], 1, true) })
      .mockResolvedValueOnce({ success: true, data: page([1], 2, false) });
    const { client, Wrapper } = setupClient();
    const { result, unmount } = await renderHook(
      () => useNotifications("unread"),
      {
        wrapper: Wrapper,
      },
    );

    await waitFor(() =>
      expect(result.current.notifications.map((item) => item.id)).toEqual([
        3, 2,
      ]),
    );
    expect(getNotifications).toHaveBeenCalledWith({
      page: 1,
      pageSize: 20,
      isRead: false,
    });

    await act(async () => {
      await result.current.fetchNextPage();
    });

    await waitFor(() =>
      expect(result.current.notifications.map((item) => item.id)).toEqual([
        3, 2, 1,
      ]),
    );
    expect(getNotifications).toHaveBeenLastCalledWith({
      page: 2,
      pageSize: 20,
      isRead: false,
    });
    expect(result.current.hasNextPage).toBe(false);

    unmount();
    client.clear();
  });

  it("loads All and Unread from distinct query caches", async () => {
    (getNotifications as jest.Mock)
      .mockResolvedValueOnce({ success: true, data: page([3], 1, false) })
      .mockResolvedValueOnce({ success: true, data: page([2], 1, false) });
    const { client, Wrapper } = setupClient();
    const { result, rerender, unmount } = await renderHook(
      ({ filter }: { filter: "all" | "unread" }) => useNotifications(filter),
      { initialProps: { filter: "all" as const }, wrapper: Wrapper },
    );

    await waitFor(() => expect(result.current.notifications[0]?.id).toBe(3));
    await act(async () => {
      rerender({ filter: "unread" });
    });
    await waitFor(() => expect(result.current.notifications[0]?.id).toBe(2));

    expect(getNotifications).toHaveBeenNthCalledWith(1, {
      page: 1,
      pageSize: 20,
      isRead: undefined,
    });
    expect(getNotifications).toHaveBeenNthCalledWith(2, {
      page: 1,
      pageSize: 20,
      isRead: false,
    });

    unmount();
    client.clear();
  });

  it("keeps the list query independent from unread-count failures", async () => {
    (getNotifications as jest.Mock).mockResolvedValue({
      success: true,
      data: page([3], 1, false),
    });
    (getNotificationUnreadCount as jest.Mock).mockResolvedValue({
      success: false,
      code: "COUNT_UNAVAILABLE",
      message: "Unavailable",
    });
    const { client, Wrapper } = setupClient();
    const list = await renderHook(() => useNotifications("all"), {
      wrapper: Wrapper,
    });
    const count = await renderHook(() => useNotificationUnreadCount(), {
      wrapper: Wrapper,
    });

    await waitFor(() =>
      expect(list.result.current.notifications).toHaveLength(1),
    );
    await waitFor(() => expect(count.result.current.error).toBeTruthy());
    expect(list.result.current.error).toBeNull();

    list.unmount();
    count.unmount();
    client.clear();
  });
});
