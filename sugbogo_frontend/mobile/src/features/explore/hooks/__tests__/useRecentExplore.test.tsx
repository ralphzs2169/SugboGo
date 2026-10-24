import type { PropsWithChildren } from "react";
import { act, renderHook, waitFor } from "@testing-library/react-native";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useAuthStore } from "@/features/auth/store/auth.store";
import { useOfflineAccessStore } from "@/features/offline-routes/stores/offlineAccess.store";
import {
  suspendAuthSession,
  beginAuthSession,
} from "@/shared/api/authSessionGeneration.service";
import { readRecentExploreFeeds } from "../../services/recentExplore.service";
import useRecentExplore from "../useRecentExplore";

jest.mock("@react-native-async-storage/async-storage", () =>
  jest.requireActual(
    "@react-native-async-storage/async-storage/jest/async-storage-mock",
  ),
);
jest.mock("../../services/recentExplore.service", () => ({
  readRecentExploreFeeds: jest.fn(),
  isRecentExploreCurrent: (grant: unknown) =>
    jest
      .requireActual("@/features/offline-routes/stores/offlineAccess.store")
      .useOfflineAccessStore.getState().recentExplore === grant,
}));
jest.mock("expo-router", () => ({ useFocusEffect: () => undefined }));
let client: QueryClient;
beforeEach(() => {
  jest.useFakeTimers();
  jest.setSystemTime(100_000);
  const generation = suspendAuthSession();
  useAuthStore.setState({
    user: null,
    isAuthenticated: false,
    isLoading: false,
  });
  useOfflineAccessStore.setState({
    recentExplore: { ownerId: 7, apiScope: "", generation },
    isRevoking: false,
  });
  client = new QueryClient();
  jest.mocked(readRecentExploreFeeds).mockReset();
});
afterEach(async () => {
  await client.cancelQueries();
  client.clear();
  jest.useRealTimers();
});
function Wrapper({ children }: PropsWithChildren) {
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

it("expires local sections at their original deadline and revokes an empty grant", async () => {
  jest
    .mocked(readRecentExploreFeeds)
    .mockResolvedValueOnce([
      {
        key: "explore-discovery",
        title: "Hidden Gems",
        fetchedAt: 1,
        expiresAt: 101_000,
        items: [],
      },
    ])
    .mockResolvedValue([]);
  const hook = await renderHook(useRecentExplore, { wrapper: Wrapper });
  await waitFor(() => expect(hook.result.current.feeds).toHaveLength(1));
  await act(async () => {
    await jest.advanceTimersByTimeAsync(1001);
  });
  await waitFor(() => expect(hook.result.current.grant).toBeNull());
  expect(hook.result.current.feeds).toEqual([]);
  await hook.unmount();
});

it("cannot publish an old read after same-user session replacement", async () => {
  let done!: (value: never[]) => void;
  jest.mocked(readRecentExploreFeeds).mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        done = resolve;
      }),
  );
  const hook = await renderHook(useRecentExplore, { wrapper: Wrapper });
  await waitFor(() => expect(readRecentExploreFeeds).toHaveBeenCalled());
  await act(async () => {
    beginAuthSession();
    done([]);
  });
  expect(hook.result.current.grant).toBeNull();
  expect(hook.result.current.feeds).toEqual([]);
  await hook.unmount();
});
