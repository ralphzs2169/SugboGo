import { fireEvent, render, waitFor } from "@testing-library/react-native";

import NotificationsScreen from "../NotificationsScreen";

const mockUseNotifications = jest.fn();
const mockUseUnreadCount = jest.fn();
const mockUseMutations = jest.fn();

jest.mock("../../hooks/useNotifications", () => ({
  useNotifications: (filter: "all" | "unread") => mockUseNotifications(filter),
  useNotificationUnreadCount: () => mockUseUnreadCount(),
}));
jest.mock("../../hooks/useNotificationMutations", () => ({
  useNotificationMutations: () => mockUseMutations(),
}));
jest.mock("../../hooks/useNotificationRefreshLifecycle", () => ({
  useNotificationRefreshLifecycle: jest.fn(),
}));
jest.mock("@/shared/hooks/useTabBarSpacing", () => ({
  useTabBarSpacing: () => 88,
}));
jest.mock("@/shared/hooks/useQueryErrorNotification", () => jest.fn());
jest.mock("lottie-react-native", () => "LottieView");

const refetch = jest.fn().mockResolvedValue(undefined);
const fetchNextPage = jest.fn().mockResolvedValue(undefined);
const markRead = jest.fn().mockResolvedValue(undefined);
const markAllRead = jest.fn().mockResolvedValue(undefined);

const baseInbox = {
  notifications: [],
  totalItems: 0,
  hasData: true,
  hasNextPage: false,
  fetchNextPage,
  isFetchingNextPage: false,
  isFetchNextPageError: false,
  isLoading: false,
  isInitialLoading: false,
  isFetching: false,
  isRefetching: false,
  error: null,
  refetch,
};

describe("NotificationsScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseNotifications.mockReturnValue(baseInbox);
    mockUseUnreadCount.mockReturnValue({
      unreadCount: 0,
      isLoading: false,
      isFetching: false,
      isRefetching: false,
      error: null,
      refetch,
    });
    mockUseMutations.mockReturnValue({
      markRead,
      markAllRead,
      pendingNotificationId: null,
      isMarkingOneRead: false,
      isMarkingAllRead: false,
    });
  });

  it("shows a row-shaped initial loading state", async () => {
    mockUseNotifications.mockReturnValue({
      ...baseInbox,
      hasData: false,
      isLoading: true,
      isInitialLoading: true,
    });

    const screen = await render(<NotificationsScreen />);

    expect(screen.getByTestId("notification-list-skeleton")).toBeTruthy();
  });

  it("shows a persistent error with a query retry", async () => {
    mockUseNotifications.mockReturnValue({
      ...baseInbox,
      hasData: false,
      error: { success: false, message: "Offline", code: "OFFLINE" },
    });

    const screen = await render(<NotificationsScreen />);
    fireEvent.press(screen.getByRole("button", { name: "Retry" }));

    expect(screen.getByText("Unable to load notifications")).toBeTruthy();
    expect(refetch).toHaveBeenCalledTimes(1);
  });

  it("switches to the separately queried unread empty state", async () => {
    mockUseUnreadCount.mockReturnValue({
      unreadCount: 3,
      isLoading: false,
      isFetching: false,
      isRefetching: false,
      error: null,
      refetch,
    });
    mockUseNotifications.mockImplementation((filter) => ({
      ...baseInbox,
      totalItems: filter === "unread" ? 0 : 2,
    }));

    const screen = await render(<NotificationsScreen />);
    fireEvent.press(screen.getByRole("button", { name: "Unread (3)" }));

    await waitFor(() => {
      expect(mockUseNotifications).toHaveBeenLastCalledWith("unread");
      expect(screen.getByText("No unread notifications")).toBeTruthy();
    });
  });

  it("marks unread rows and all notifications without adding navigation", async () => {
    mockUseNotifications.mockReturnValue({
      ...baseInbox,
      totalItems: 1,
      notifications: [
        {
          id: 8,
          type: "future_event",
          title: "A long but readable account update",
          body: "This message stays available in the notification inbox.",
          target_type: "",
          target_id: null,
          is_read: false,
          read_at: null,
          created_at: "2026-10-14T10:00:00Z",
        },
      ],
    });
    mockUseUnreadCount.mockReturnValue({
      unreadCount: 1,
      isLoading: false,
      isFetching: false,
      isRefetching: false,
      error: null,
      refetch,
    });

    const screen = await render(<NotificationsScreen />);
    fireEvent.press(
      screen.getByRole("button", {
        name: /Unread notification\. A long but readable account update/,
      }),
    );
    fireEvent.press(
      screen.getByRole("button", {
        name: "Mark all notifications as read",
      }),
    );

    await waitFor(() => {
      expect(markRead).toHaveBeenCalledWith(8);
      expect(markAllRead).toHaveBeenCalledTimes(1);
    });
  });
});
