import { act, render, waitFor } from "@testing-library/react-native";
import { focusManager, onlineManager } from "@tanstack/react-query";
import { router } from "expo-router";
import RecentExploreReconnect from "../RecentExploreReconnect";
import { restoreSession } from "@/features/auth/services/restoreSession.service";
import { useAuthStore } from "@/features/auth/store/auth.store";
import { useOfflineAccessStore } from "@/features/offline-routes/stores/offlineAccess.store";

jest.mock("expo-router", () => ({ router: { replace: jest.fn() } }));
jest.mock("@/features/auth/services/restoreSession.service", () => ({
  restoreSession: jest.fn(),
}));

beforeEach(() => {
  onlineManager.setOnline(false);
  focusManager.setFocused(true);
  useAuthStore.setState({
    user: null,
    isAuthenticated: false,
    isLoading: false,
  });
  useOfflineAccessStore.setState({
    recentExplore: { ownerId: 7, apiScope: "api", generation: 1 },
  });
  jest.mocked(restoreSession).mockReset();
  jest.mocked(router.replace).mockClear();
});
afterEach(() => {
  onlineManager.setOnline(true);
  focusManager.setFocused(undefined);
});

it("validates on reconnect, preserves local content while pending, and routes only after success", async () => {
  let done!: (value: string) => void;
  const pending = new Promise<string>((resolve) => {
    done = resolve;
  });
  jest.mocked(restoreSession).mockImplementationOnce(async () => {
    await pending;
    useAuthStore.getState().setUser({ id: 7 } as never);
    useOfflineAccessStore.getState().setRecentExplore(null);
    return "authenticated";
  });
  const view = await render(<RecentExploreReconnect />);
  expect(restoreSession).not.toHaveBeenCalled();
  await act(async () => onlineManager.setOnline(true));
  expect(restoreSession).toHaveBeenCalledTimes(1);
  expect(useAuthStore.getState().isAuthenticated).toBe(false);
  expect(useOfflineAccessStore.getState().recentExplore?.ownerId).toBe(7);
  expect(router.replace).not.toHaveBeenCalled();
  await act(async () => done("ok"));
  await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/"));
  await view.unmount();
});

it("routes rejected validation to login without repeatedly retrying the same connection", async () => {
  jest.mocked(restoreSession).mockImplementationOnce(async () => {
    useOfflineAccessStore.getState().setRecentExplore(null);
    return "denied";
  });
  const view = await render(<RecentExploreReconnect />);
  await act(async () => onlineManager.setOnline(true));
  await waitFor(() =>
    expect(router.replace).toHaveBeenCalledWith("/(auth)/login"),
  );
  expect(useAuthStore.getState().isAuthenticated).toBe(false);
  expect(restoreSession).toHaveBeenCalledTimes(1);
  await view.unmount();
});

it("keeps local mode after another transport failure and retries on a later connectivity transition", async () => {
  jest.mocked(restoreSession).mockResolvedValue("offline");
  const view = await render(<RecentExploreReconnect />);
  await act(async () => onlineManager.setOnline(true));
  expect(useAuthStore.getState().isAuthenticated).toBe(false);
  expect(router.replace).not.toHaveBeenCalled();
  await act(async () => onlineManager.setOnline(false));
  await act(async () => onlineManager.setOnline(true));
  expect(restoreSession).toHaveBeenCalledTimes(2);
  await view.unmount();
  await act(async () => {
    onlineManager.setOnline(false);
    onlineManager.setOnline(true);
  });
  expect(restoreSession).toHaveBeenCalledTimes(2);
});

it("does not navigate from stale validation after a new session begins", async () => {
  jest.mocked(restoreSession).mockResolvedValue("stale");
  const view = await render(<RecentExploreReconnect />);
  await act(async () => onlineManager.setOnline(true));
  expect(router.replace).not.toHaveBeenCalled();
  await view.unmount();
});
