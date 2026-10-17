import { fireEvent, render } from "@testing-library/react-native";

import { useAppModeStore } from "@/features/app-mode/store/appMode.store";

import { useNotificationUnreadCount } from "../../hooks/useNotifications";
import NotificationBellButton from "../NotificationBellButton";

const mockPush = jest.fn();

jest.mock("expo-router", () => ({
  useRouter: () => ({ push: mockPush }),
  useNavigation: () => ({ isFocused: () => true }),
}));

jest.mock("../../hooks/useNotifications", () => ({
  useNotificationUnreadCount: jest.fn(),
}));

function unreadResult(unreadCount: number | undefined, error: unknown = null) {
  return {
    unreadCount,
    isLoading: unreadCount === undefined && !error,
    isFetching: false,
    isRefetching: false,
    error,
    refetch: jest.fn(),
  };
}

describe("NotificationBellButton", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useAppModeStore.setState({ activeMode: "explorer" });
    (useNotificationUnreadCount as jest.Mock).mockReturnValue(unreadResult(3));
  });

  it("opens the shared inbox without changing the active app mode", async () => {
    const screen = await render(<NotificationBellButton />);

    fireEvent.press(
      screen.getByRole("button", { name: "Notifications, 3 unread" }),
    );

    expect(mockPush).toHaveBeenCalledWith("/notifications");
    expect(useAppModeStore.getState().activeMode).toBe("explorer");
  });

  it("hides the badge for zero, loading, and failed count queries", async () => {
    (useNotificationUnreadCount as jest.Mock).mockReturnValue(unreadResult(0));
    const screen = await render(<NotificationBellButton />);
    expect(screen.queryByText("0")).toBeNull();
    expect(screen.getByRole("button", { name: "Notifications" })).toBeTruthy();

    (useNotificationUnreadCount as jest.Mock).mockReturnValue(
      unreadResult(undefined),
    );
    await screen.rerender(<NotificationBellButton />);
    expect(screen.queryByText("0")).toBeNull();

    (useNotificationUnreadCount as jest.Mock).mockReturnValue(
      unreadResult(undefined, new Error("Unavailable")),
    );
    await screen.rerender(<NotificationBellButton />);
    expect(screen.getByTestId("notification-bell")).toBeTruthy();
  });

  it("updates compact badge content when the shared unread count changes", async () => {
    const screen = await render(<NotificationBellButton />);
    expect(screen.getByText("3")).toBeTruthy();

    (useNotificationUnreadCount as jest.Mock).mockReturnValue(
      unreadResult(120),
    );
    await screen.rerender(<NotificationBellButton />);

    expect(screen.queryByText("3")).toBeNull();
    expect(screen.getByText("99+")).toBeTruthy();
  });
});
