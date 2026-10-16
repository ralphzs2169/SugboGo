import type { PropsWithChildren } from "react";
import { act, renderHook, waitFor } from "@testing-library/react-native";
import NetInfo from "@react-native-community/netinfo";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { router } from "expo-router";
import { AppState } from "react-native";

import { useAppModeStore } from "@/features/app-mode/store/appMode.store";
import { useAuthStore } from "@/features/auth/store/auth.store";
import {
  beginAuthSession,
  getAuthSessionGeneration,
} from "@/shared/api/authSessionGeneration.service";
import { clearSessionTokens } from "@/shared/api/storage.service";

import { notificationWebSocketService } from "../../services/notificationWebSocket.service";
import { notificationKeys } from "../notificationQueryKeys";
import { useNotificationWebSocketLifecycle } from "../useNotificationWebSocketLifecycle";

let mockNetworkListener:
  | ((state: { isConnected: boolean; isInternetReachable: boolean }) => void)
  | null = null;

jest.mock("@react-native-community/netinfo", () => ({
  __esModule: true,
  default: {
    fetch: jest.fn().mockResolvedValue({
      isConnected: true,
      isInternetReachable: true,
    }),
    addEventListener: jest.fn((listener) => {
      mockNetworkListener = listener;
      return jest.fn();
    }),
  },
}));

jest.mock("expo-router", () => ({
  router: { replace: jest.fn() },
}));

jest.mock("@/shared/api/storage.service", () => ({
  clearSessionTokens: jest.fn().mockResolvedValue(true),
}));

jest.mock("../../services/notificationWebSocket.service", () => ({
  notificationWebSocketService: {
    start: jest.fn(),
    stop: jest.fn(),
    setAppActive: jest.fn(),
    setOnline: jest.fn(),
  },
}));

const authenticatedUser = {
  id: 7,
  first_name: "Socket",
  last_name: "Tester",
  gender: null,
  email: "socket@example.com",
  role: "merchant" as const,
  status: "active",
  has_completed_interest_selection: true,
  has_custom_profile_picture: false,
  has_oauth_accounts: false,
};

function setupClient() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity } },
  });

  function Wrapper({ children }: PropsWithChildren) {
    return (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
  }

  return { client, Wrapper };
}

describe("useNotificationWebSocketLifecycle", () => {
  let appStateListener: ((state: "active" | "background") => void) | null;
  let removeAppStateListener: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    appStateListener = null;
    mockNetworkListener = null;
    removeAppStateListener = jest.fn();
    AppState.currentState = "active";
    jest
      .spyOn(AppState, "addEventListener")
      .mockImplementation((_event, listener) => {
        appStateListener = listener as typeof appStateListener;
        return { remove: removeAppStateListener };
      });
    useAuthStore.setState({
      user: authenticatedUser,
      isAuthenticated: true,
      isLoading: false,
      sessionExpired: false,
    });
    beginAuthSession();
    useAppModeStore.setState({ activeMode: "explorer" });
  });

  afterEach(() => {
    jest.restoreAllMocks();
    useAuthStore.setState({ user: null, isAuthenticated: false });
  });

  it("invalidates the whole authenticated notification prefix on sync", async () => {
    const { client, Wrapper } = setupClient();
    const invalidate = jest.spyOn(client, "invalidateQueries");
    const { unmount } = await renderHook(useNotificationWebSocketLifecycle, {
      wrapper: Wrapper,
    });

    await waitFor(() =>
      expect(notificationWebSocketService.start).toHaveBeenCalledTimes(1),
    );
    const session = (notificationWebSocketService.start as jest.Mock).mock
      .calls[0][0];
    expect(session.authSessionGeneration).toBe(getAuthSessionGeneration());

    await act(async () => session.onSyncRequired());
    expect(invalidate).toHaveBeenCalledWith({
      queryKey: notificationKeys.account(7),
      refetchType: "active",
    });

    await act(async () => useAppModeStore.getState().setActiveMode("merchant"));
    expect(notificationWebSocketService.start).toHaveBeenCalledTimes(1);

    await act(async () => unmount());
    await waitFor(() =>
      expect(notificationWebSocketService.stop).toHaveBeenCalled(),
    );
  });

  it("forwards foreground and connectivity transitions to the singleton", async () => {
    const { Wrapper } = setupClient();
    const { unmount } = await renderHook(useNotificationWebSocketLifecycle, {
      wrapper: Wrapper,
    });

    await waitFor(() => expect(NetInfo.fetch).toHaveBeenCalled());
    expect(notificationWebSocketService.setAppActive).toHaveBeenCalledWith(
      true,
    );

    await act(async () => appStateListener?.("background"));
    await act(async () => appStateListener?.("active"));
    await act(async () =>
      mockNetworkListener?.({
        isConnected: false,
        isInternetReachable: false,
      }),
    );
    await act(async () =>
      mockNetworkListener?.({
        isConnected: true,
        isInternetReachable: true,
      }),
    );

    expect(notificationWebSocketService.setAppActive).toHaveBeenCalledWith(
      false,
    );
    expect(notificationWebSocketService.setOnline).toHaveBeenCalledWith(false);
    expect(notificationWebSocketService.setOnline).toHaveBeenCalledWith(true);
    await act(async () => unmount());
  });

  it("restarts for an account change and stops after logout", async () => {
    const { Wrapper } = setupClient();
    const { unmount } = await renderHook(useNotificationWebSocketLifecycle, {
      wrapper: Wrapper,
    });
    await waitFor(() =>
      expect(notificationWebSocketService.start).toHaveBeenCalledTimes(1),
    );

    await act(async () => {
      useAuthStore.getState().setUser({ ...authenticatedUser, id: 8 });
    });
    await waitFor(() =>
      expect(notificationWebSocketService.start).toHaveBeenCalledTimes(2),
    );
    expect(
      (notificationWebSocketService.start as jest.Mock).mock.calls[1][0].userId,
    ).toBe(8);

    await act(async () => useAuthStore.getState().clearUser());
    await waitFor(() =>
      expect(notificationWebSocketService.stop).toHaveBeenCalled(),
    );
    await act(async () => unmount());
  });

  it("applies established session-expiration cleanup only to the current account", async () => {
    const { client, Wrapper } = setupClient();
    client.setQueryData(notificationKeys.unreadCount(7), { unread_count: 2 });
    const { unmount } = await renderHook(useNotificationWebSocketLifecycle, {
      wrapper: Wrapper,
    });
    await waitFor(() =>
      expect(notificationWebSocketService.start).toHaveBeenCalledTimes(1),
    );
    const firstSession = (notificationWebSocketService.start as jest.Mock).mock
      .calls[0][0];

    await act(async () => {
      useAuthStore.getState().setUser({ ...authenticatedUser, id: 8 });
    });
    await act(async () => firstSession.onSessionExpired());
    expect(clearSessionTokens).not.toHaveBeenCalled();

    const currentSession = (notificationWebSocketService.start as jest.Mock)
      .mock.calls[1][0];
    useAppModeStore.getState().setActiveMode("merchant");
    await act(async () => currentSession.onSessionExpired());

    expect(clearSessionTokens).toHaveBeenCalledTimes(1);
    expect(client.getQueryCache().getAll()).toHaveLength(0);
    expect(useAuthStore.getState().sessionExpired).toBe(true);
    expect(useAppModeStore.getState().activeMode).toBe("explorer");
    expect(router.replace).toHaveBeenCalledWith("/(auth)/login");
    await act(async () => unmount());
    client.clear();
  });
});
