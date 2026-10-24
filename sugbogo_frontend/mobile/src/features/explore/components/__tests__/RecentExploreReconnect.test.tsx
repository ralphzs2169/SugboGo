import { act, render, waitFor } from "@testing-library/react-native";
import { focusManager, onlineManager } from "@tanstack/react-query";
import { router } from "expo-router";
import { useEffect } from "react";
import { Text } from "react-native";

import { getCurrentUser } from "@/features/auth/api/auth.service";
import * as sessionRestoration from "@/features/auth/services/restoreSession.service";
import { useAuthStore } from "@/features/auth/store/auth.store";
import { restoreRecentExploreAccess } from "@/features/explore/services/recentExplore.service";
import { useOfflineAccessStore } from "@/features/offline-routes/stores/offlineAccess.store";
import {
  beginAuthSession,
  getAuthSessionGeneration,
  invalidateAuthSession,
  suspendAuthSession,
} from "@/shared/api/authSessionGeneration.service";
import {
  clearSessionTokens,
  getAccessToken,
} from "@/shared/api/storage.service";
import QueryPersistenceProvider from "@/shared/query/QueryPersistenceProvider";
import { queryClient } from "@/shared/query/queryClient";
import { createApiError } from "@/shared/utils/apiErrors";
import RecentExploreReconnect from "../RecentExploreReconnect";

jest.mock("expo-router", () => ({ router: { replace: jest.fn() } }));
jest.mock("@react-native-async-storage/async-storage", () =>
  jest.requireActual(
    "@react-native-async-storage/async-storage/jest/async-storage-mock",
  ),
);
jest.mock("@/features/auth/api/auth.service", () => ({
  getCurrentUser: jest.fn(),
}));
jest.mock("@/shared/api/storage.service", () => ({
  getAccessToken: jest.fn(),
  clearSessionTokens: jest.fn(),
}));
jest.mock("@/features/offline-routes/services/offlineAccess.service", () => ({
  clearOfflineAccess: jest.fn(async () => undefined),
  getRestorableOfflineOwner: jest.fn(async () => null),
  rememberOfflineResources: jest.fn(async () => undefined),
}));
jest.mock("@/features/explore/services/recentExplore.service", () => ({
  restoreRecentExploreAccess: jest.fn(),
}));

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((done, fail) => {
    resolve = done;
    reject = fail;
  });
  return { promise, resolve, reject };
}

function localGrant(generation = getAuthSessionGeneration()) {
  return {
    ownerId: 7,
    apiScope: process.env.EXPO_PUBLIC_API_URL ?? "",
    generation,
  };
}

const mounted = jest.fn();

/** Observes local presentation and proves the real provider remounts its children. */
function LocalContent() {
  const grant = useOfflineAccessStore((state) => state.recentExplore);
  useEffect(() => {
    mounted();
  }, []);
  return grant ? <Text>Local places</Text> : null;
}

function RecoveryRoot() {
  return (
    <QueryPersistenceProvider>
      <RecentExploreReconnect />
      <LocalContent />
    </QueryPersistenceProvider>
  );
}

beforeEach(() => {
  invalidateAuthSession();
  suspendAuthSession();
  onlineManager.setOnline(false);
  focusManager.setFocused(true);
  queryClient.clear();
  useAuthStore.setState({
    user: null,
    isAuthenticated: false,
    isLoading: false,
  });
  useOfflineAccessStore.setState({
    ownerId: null,
    isRevoking: false,
    recentExplore: localGrant(),
  });
  jest.mocked(getAccessToken).mockReset().mockResolvedValue("stored-token");
  jest.mocked(clearSessionTokens).mockReset().mockResolvedValue(true);
  jest.mocked(getCurrentUser).mockReset();
  jest
    .mocked(restoreRecentExploreAccess)
    .mockReset()
    .mockImplementation(async (generation) => localGrant(generation));
  jest.mocked(router.replace).mockClear();
  mounted.mockClear();
  jest.spyOn(sessionRestoration, "restoreSession");
});

afterEach(() => {
  queryClient.clear();
  onlineManager.setOnline(true);
  focusManager.setFocused(undefined);
  jest.restoreAllMocks();
});

it("validates on reconnect, preserves local access while pending, and routes only after success", async () => {
  const request = deferred<Awaited<ReturnType<typeof getCurrentUser>>>();
  jest.mocked(getCurrentUser).mockReturnValueOnce(request.promise);
  const view = await render(<RecentExploreReconnect />);
  expect(sessionRestoration.restoreSession).not.toHaveBeenCalled();
  await act(async () => onlineManager.setOnline(true));
  expect(getCurrentUser).toHaveBeenCalledTimes(1);
  expect(useAuthStore.getState().isAuthenticated).toBe(false);
  expect(useOfflineAccessStore.getState().recentExplore?.ownerId).toBe(7);
  expect(router.replace).not.toHaveBeenCalled();
  await act(async () => request.resolve({ id: 7 } as never));
  await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/"));
  expect(router.replace).toHaveBeenCalledTimes(1);
  await view.unmount();
});

it("routes definitive rejection to login and preserves session cleanup", async () => {
  jest
    .mocked(getCurrentUser)
    .mockRejectedValueOnce(createApiError("AUTH_ERROR"));
  const view = await render(<RecentExploreReconnect />);
  await act(async () => onlineManager.setOnline(true));
  await waitFor(() =>
    expect(router.replace).toHaveBeenCalledWith("/(auth)/login"),
  );
  expect(useAuthStore.getState().isAuthenticated).toBe(false);
  expect(useOfflineAccessStore.getState().recentExplore).toBeNull();
  expect(clearSessionTokens).toHaveBeenCalledTimes(1);
  expect(sessionRestoration.restoreSession).toHaveBeenCalledTimes(1);
  await view.unmount();
});

it("retries transport failure on a later connection and removes event subscriptions on unmount", async () => {
  jest
    .mocked(getCurrentUser)
    .mockRejectedValue(createApiError("NETWORK_ERROR"));
  const view = await render(<RecentExploreReconnect />);
  await act(async () => onlineManager.setOnline(true));
  expect(useAuthStore.getState().isAuthenticated).toBe(false);
  expect(router.replace).not.toHaveBeenCalled();
  expect(sessionRestoration.restoreSession).toHaveBeenCalledTimes(1);
  await act(async () => onlineManager.setOnline(false));
  await act(async () => onlineManager.setOnline(true));
  expect(sessionRestoration.restoreSession).toHaveBeenCalledTimes(2);
  await view.unmount();
  await act(async () => {
    onlineManager.setOnline(false);
    onlineManager.setOnline(true);
  });
  expect(sessionRestoration.restoreSession).toHaveBeenCalledTimes(2);
});

it("does not navigate from stale validation after a new session begins", async () => {
  const request = deferred<Awaited<ReturnType<typeof getCurrentUser>>>();
  jest.mocked(getCurrentUser).mockReturnValueOnce(request.promise);
  const view = await render(<RecentExploreReconnect />);
  await act(async () => onlineManager.setOnline(true));
  await act(async () => {
    beginAuthSession();
    request.resolve({ id: 7 } as never);
  });
  expect(router.replace).not.toHaveBeenCalled();
  expect(useAuthStore.getState().isAuthenticated).toBe(false);
  await view.unmount();
});

it("keeps one real restoration pending across the provider generation remount", async () => {
  const request = deferred<Awaited<ReturnType<typeof getCurrentUser>>>();
  jest.mocked(getCurrentUser).mockReturnValue(request.promise);
  const generation = getAuthSessionGeneration();
  const view = await render(<RecoveryRoot />);
  const initialMounts = mounted.mock.calls.length;
  await act(async () => onlineManager.setOnline(true));
  await waitFor(() =>
    expect(mounted.mock.calls.length).toBeGreaterThan(initialMounts),
  );
  expect(getAuthSessionGeneration()).toBe(generation + 1);
  expect(view.getByText("Local places")).toBeTruthy();
  expect(useAuthStore.getState().isAuthenticated).toBe(false);
  await act(async () => {
    focusManager.setFocused(false);
    focusManager.setFocused(true);
  });
  expect(sessionRestoration.restoreSession).toHaveBeenCalledTimes(1);
  expect(getCurrentUser).toHaveBeenCalledTimes(1);
  expect(router.replace).not.toHaveBeenCalled();
  await act(async () => request.resolve({ id: 7 } as never));
  await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/"));
  expect(router.replace).toHaveBeenCalledTimes(1);
  expect(useAuthStore.getState().isAuthenticated).toBe(true);
  expect(useOfflineAccessStore.getState().recentExplore).toBeNull();
  await view.unmount();
});

it("does not retry a transport-failed remount until a distinct focus transition", async () => {
  const first = deferred<Awaited<ReturnType<typeof getCurrentUser>>>();
  const second = deferred<Awaited<ReturnType<typeof getCurrentUser>>>();
  jest
    .mocked(getCurrentUser)
    .mockReturnValueOnce(first.promise)
    .mockReturnValue(second.promise);
  const view = await render(<RecoveryRoot />);
  await act(async () => onlineManager.setOnline(true));
  expect(getCurrentUser).toHaveBeenCalledTimes(1);
  await act(async () => first.reject(createApiError("NETWORK_ERROR")));
  await waitFor(() =>
    expect(restoreRecentExploreAccess).toHaveBeenCalledTimes(1),
  );
  expect(view.getByText("Local places")).toBeTruthy();
  expect(useAuthStore.getState().isAuthenticated).toBe(false);
  // Re-registering native focus listeners may emit true again without foregrounding.
  await act(async () => {
    focusManager.setFocused(undefined);
    focusManager.setFocused(true);
  });
  expect(sessionRestoration.restoreSession).toHaveBeenCalledTimes(1);
  expect(getCurrentUser).toHaveBeenCalledTimes(1);
  expect(router.replace).not.toHaveBeenCalled();
  await act(async () => {
    focusManager.setFocused(false);
    focusManager.setFocused(true);
  });
  expect(sessionRestoration.restoreSession).toHaveBeenCalledTimes(2);
  expect(getCurrentUser).toHaveBeenCalledTimes(2);
  expect(view.getByText("Local places")).toBeTruthy();
  await act(async () => second.resolve({ id: 7 } as never));
  await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/"));
  expect(router.replace).toHaveBeenCalledTimes(1);
  await view.unmount();
});
