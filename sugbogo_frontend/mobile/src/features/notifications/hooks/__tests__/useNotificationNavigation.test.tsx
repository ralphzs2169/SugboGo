import type { PropsWithChildren } from "react";
import { act, renderHook } from "@testing-library/react-native";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import Toast from "react-native-toast-message";

import { useAppModeStore } from "@/features/app-mode/store/appMode.store";
import { useAuthStore } from "@/features/auth/store/auth.store";
import { getApplicationStatus } from "@/features/merchant/api/merchantApplication.service";

import type { NotificationItem } from "../../types/notification.types";
import { useNotificationNavigation } from "../useNotificationNavigation";

const mockRouter = {
  push: jest.fn(),
  replace: jest.fn(),
};

jest.mock("expo-router", () => ({
  useFocusEffect: jest.fn(),
  useRouter: () => mockRouter,
}));
jest.mock("@/features/merchant/api/merchantApplication.service", () => ({
  getApplicationStatus: jest.fn(),
}));
jest.mock("react-native-toast-message", () => ({
  show: jest.fn(),
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

function notification(
  overrides: Partial<NotificationItem> = {},
): NotificationItem {
  return {
    id: 9,
    type: "business_name_change_approved",
    title: "Business request decision",
    body: "Your request was approved.",
    target_type: "business_name_change",
    target_id: 31,
    is_read: false,
    read_at: null,
    created_at: "2026-10-14T10:00:00Z",
    ...overrides,
  };
}

describe("useNotificationNavigation", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useAppModeStore.setState({ activeMode: "explorer" });
    useAuthStore.setState({
      user: {
        id: 7,
        first_name: "Test",
        last_name: "Merchant",
        gender: null,
        email: "merchant@example.com",
        role: "merchant",
        status: "active",
        has_completed_interest_selection: true,
        has_custom_profile_picture: false,
        has_oauth_accounts: false,
      },
      isAuthenticated: true,
    });
    (getApplicationStatus as jest.Mock).mockResolvedValue({
      success: true,
      data: {
        status: "approved",
        merchant_mode_acknowledged: true,
        highest_completed_step: 5,
        review_sla_min_business_days: 3,
        review_sla_max_business_days: 5,
      },
    });
  });

  afterEach(() => {
    useAuthStore.setState({ user: null, isAuthenticated: false });
    useAppModeStore.setState({ activeMode: "explorer" });
  });

  it("marks unread and replaces Explorer with the eligible Merchant detail", async () => {
    const markRead = jest.fn().mockResolvedValue(undefined);
    const { client, Wrapper } = setupClient();
    const { result, unmount } = await renderHook(
      () => useNotificationNavigation({ markRead }),
      { wrapper: Wrapper },
    );

    await act(async () => {
      await result.current.handleNotificationPress(notification());
    });

    expect(markRead).toHaveBeenCalledWith(9);
    expect(getApplicationStatus).toHaveBeenCalledTimes(1);
    expect(useAppModeStore.getState().activeMode).toBe("merchant");
    expect(mockRouter.replace).toHaveBeenCalledWith({
      pathname: "/(merchant)/business-update-requests/[requestId]",
      params: { requestId: "31" },
    });
    expect(mockRouter.push).not.toHaveBeenCalled();

    unmount();
    client.clear();
  });

  it("pushes directly when Merchant mode is already active", async () => {
    useAppModeStore.setState({ activeMode: "merchant" });
    const markRead = jest.fn();
    const { client, Wrapper } = setupClient();
    const { result, unmount } = await renderHook(
      () => useNotificationNavigation({ markRead }),
      { wrapper: Wrapper },
    );

    await act(async () => {
      await result.current.handleNotificationPress(
        notification({ is_read: true, read_at: "2026-10-14T10:05:00Z" }),
      );
    });

    expect(getApplicationStatus).not.toHaveBeenCalled();
    expect(markRead).not.toHaveBeenCalled();
    expect(mockRouter.push).toHaveBeenCalledWith({
      pathname: "/(merchant)/business-update-requests/[requestId]",
      params: { requestId: "31" },
    });

    unmount();
    client.clear();
  });

  it("keeps unknown targets informational while still marking unread", async () => {
    const markRead = jest.fn().mockResolvedValue(undefined);
    const { client, Wrapper } = setupClient();
    const { result, unmount } = await renderHook(
      () => useNotificationNavigation({ markRead }),
      { wrapper: Wrapper },
    );

    await act(async () => {
      await result.current.handleNotificationPress(
        notification({ target_type: "future_target", target_id: 55 }),
      );
    });

    expect(markRead).toHaveBeenCalledWith(9);
    expect(getApplicationStatus).not.toHaveBeenCalled();
    expect(mockRouter.push).not.toHaveBeenCalled();
    expect(mockRouter.replace).not.toHaveBeenCalled();

    unmount();
    client.clear();
  });

  it("reports an invalid known target without navigating", async () => {
    const markRead = jest.fn().mockResolvedValue(undefined);
    const { client, Wrapper } = setupClient();
    const { result, unmount } = await renderHook(
      () => useNotificationNavigation({ markRead }),
      { wrapper: Wrapper },
    );

    await act(async () => {
      await result.current.handleNotificationPress(
        notification({ target_id: null }),
      );
    });

    expect(Toast.show).toHaveBeenCalledWith(
      expect.objectContaining({ text1: "Destination unavailable" }),
    );
    expect(mockRouter.push).not.toHaveBeenCalled();
    expect(mockRouter.replace).not.toHaveBeenCalled();

    unmount();
    client.clear();
  });

  it("does not enter Merchant mode when account access is unavailable", async () => {
    useAuthStore.setState((state) => ({
      user: state.user ? { ...state.user, role: "explorer" } : null,
    }));
    const markRead = jest.fn().mockResolvedValue(undefined);
    const { client, Wrapper } = setupClient();
    const { result, unmount } = await renderHook(
      () => useNotificationNavigation({ markRead }),
      { wrapper: Wrapper },
    );

    await act(async () => {
      await result.current.handleNotificationPress(notification());
    });

    expect(markRead).toHaveBeenCalledWith(9);
    expect(useAppModeStore.getState().activeMode).toBe("explorer");
    expect(mockRouter.replace).not.toHaveBeenCalled();
    expect(Toast.show).toHaveBeenCalledWith(
      expect.objectContaining({ text1: "Merchant access unavailable" }),
    );

    unmount();
    client.clear();
  });

  it("keeps navigation available after a recoverable read failure", async () => {
    useAppModeStore.setState({ activeMode: "merchant" });
    const markRead = jest.fn().mockRejectedValue({
      success: false,
      message: "Read service unavailable",
      code: "OFFLINE",
    });
    const { client, Wrapper } = setupClient();
    const { result, unmount } = await renderHook(
      () => useNotificationNavigation({ markRead }),
      { wrapper: Wrapper },
    );

    await act(async () => {
      await result.current.handleNotificationPress(notification());
    });

    expect(Toast.show).toHaveBeenCalledWith(
      expect.objectContaining({
        text1: "Couldn't mark notification as read",
        text2: "Read service unavailable",
      }),
    );
    expect(mockRouter.push).toHaveBeenCalledTimes(1);

    unmount();
    client.clear();
  });

  it("does not navigate after the read request ends the session", async () => {
    useAppModeStore.setState({ activeMode: "merchant" });
    const markRead = jest.fn().mockImplementation(async () => {
      useAuthStore.setState({ user: null, isAuthenticated: false });
      throw {
        success: false,
        message: "Session expired",
        code: "SESSION_EXPIRED",
      };
    });
    const { client, Wrapper } = setupClient();
    const { result, unmount } = await renderHook(
      () => useNotificationNavigation({ markRead }),
      { wrapper: Wrapper },
    );

    await act(async () => {
      await result.current.handleNotificationPress(notification());
    });

    expect(mockRouter.push).not.toHaveBeenCalled();
    expect(mockRouter.replace).not.toHaveBeenCalled();

    unmount();
    client.clear();
  });

  it("suppresses repeated presses through the navigation transition", async () => {
    useAppModeStore.setState({ activeMode: "merchant" });
    let resolveMarkRead!: () => void;
    const markRead = jest.fn(
      () =>
        new Promise<void>((resolve) => {
          resolveMarkRead = resolve;
        }),
    );
    const { client, Wrapper } = setupClient();
    const { result, unmount } = await renderHook(
      () => useNotificationNavigation({ markRead }),
      { wrapper: Wrapper },
    );

    let firstPress!: Promise<void>;
    await act(async () => {
      firstPress = result.current.handleNotificationPress(notification());
      void result.current.handleNotificationPress(notification());
    });

    expect(markRead).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolveMarkRead();
      await firstPress;
    });

    await act(async () => {
      await result.current.handleNotificationPress(notification());
    });

    expect(mockRouter.push).toHaveBeenCalledTimes(1);
    expect(markRead).toHaveBeenCalledTimes(1);

    unmount();
    client.clear();
  });
});
