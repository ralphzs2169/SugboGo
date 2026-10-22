import { fireEvent, render } from "@testing-library/react-native";
import { AppState } from "react-native";
import { useReducedMotion, withSequence } from "react-native-reanimated";

import { useAppModeStore } from "@/features/app-mode/store/appMode.store";

import { notificationArrivalService } from "../../services/notificationArrival.service";
import { useNotificationUnreadCount } from "../../hooks/useNotifications";
import NotificationBellButton from "../NotificationBellButton";
jest.mock("react-native-reanimated", () => ({
  __esModule: true,
  default: { View: jest.requireActual("react-native").View },
  cancelAnimation: jest.fn(),
  Easing: { inOut: () => undefined, quad: undefined },
  ReduceMotion: { System: "system" },
  useAnimatedStyle: () => ({}),
  useReducedMotion: jest.fn(() => false),
  useSharedValue: (initial: number) => {
    const value = jest.requireActual("react").useRef({
      value: initial,
      set: jest.fn(),
    });
    return value.current;
  },
  withSequence: jest.fn(() => 0),
  withTiming: jest.fn((value: number) => value),
}));

const mockPush = jest.fn();
let mockUserId = 100;

jest.mock("@/features/auth/store/auth.store", () => ({
  useAuthStore: (selector: (state: unknown) => unknown) =>
    selector({ user: { id: mockUserId } }),
}));

jest.mock("expo-router", () => ({
  useRouter: () => ({ push: mockPush }),
  useIsFocused: () => true,
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
    mockUserId += 1;
    notificationArrivalService.setContext(true, false);
    Object.defineProperty(AppState, "currentState", {
      configurable: true,
      writable: true,
      value: "active",
    });
    jest.mocked(useReducedMotion).mockReturnValue(false);
    useAppModeStore.setState({ activeMode: "explorer" });
    (useNotificationUnreadCount as jest.Mock).mockReturnValue(unreadResult(3));
  });

  it("rings once across rerenders, count changes, and route remounts", async () => {
    const screen = await render(<NotificationBellButton />);
    expect(withSequence).toHaveBeenCalledTimes(2);

    await screen.rerender(<NotificationBellButton />);
    (useNotificationUnreadCount as jest.Mock).mockReturnValue(unreadResult(4));
    await screen.rerender(<NotificationBellButton />);
    await screen.unmount();
    await render(<NotificationBellButton />);

    expect(withSequence).toHaveBeenCalledTimes(2);
  });

  it("does not infer new arrivals from unread-count increases", async () => {
    (useNotificationUnreadCount as jest.Mock).mockReturnValue(unreadResult(0));
    const screen = await render(<NotificationBellButton />);
    (useNotificationUnreadCount as jest.Mock).mockReturnValue(unreadResult(2));
    await screen.rerender(<NotificationBellButton />);
    expect(withSequence).not.toHaveBeenCalled();
  });

  it("plays the existing animation for a live arrival while preserving badge updates", async () => {
    jest.useFakeTimers();
    (useNotificationUnreadCount as jest.Mock).mockReturnValue(unreadResult(0));
    const screen = await render(<NotificationBellButton />);
    notificationArrivalService.created(mockUserId, 1);
    expect(withSequence).toHaveBeenCalledTimes(2);
    (useNotificationUnreadCount as jest.Mock).mockReturnValue(unreadResult(2));
    await screen.rerender(<NotificationBellButton />);
    notificationArrivalService.created(mockUserId, 2);
    expect(screen.getByText("2")).toBeTruthy();
    expect(withSequence).toHaveBeenCalledTimes(2);
    jest.advanceTimersByTime(3000);
    notificationArrivalService.created(mockUserId, 3);
    expect(withSequence).toHaveBeenCalledTimes(4);
    jest.useRealTimers();
  });

  it("suppresses the reminder for reduced motion or an inactive app", async () => {
    jest.mocked(useReducedMotion).mockReturnValue(true);
    const screen = await render(<NotificationBellButton />);
    expect(withSequence).not.toHaveBeenCalled();
    notificationArrivalService.created(mockUserId, 9001);
    expect(withSequence).not.toHaveBeenCalled();
    await screen.unmount();
    mockUserId += 1;
    notificationArrivalService.setContext(true, false);
    jest.mocked(useReducedMotion).mockReturnValue(false);
    Object.defineProperty(AppState, "currentState", {
      configurable: true,
      writable: true,
      value: "background",
    });
    await render(<NotificationBellButton />);
    expect(withSequence).not.toHaveBeenCalled();
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
