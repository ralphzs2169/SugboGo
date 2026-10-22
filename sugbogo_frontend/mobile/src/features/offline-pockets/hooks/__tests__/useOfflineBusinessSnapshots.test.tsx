import {
  QueryClient,
  QueryClientProvider,
  onlineManager,
} from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react-native";
import type { PropsWithChildren } from "react";

import { useAuthStore } from "@/features/auth/store/auth.store";
import { useOfflineAccessStore } from "@/features/offline-routes/stores/offlineAccess.store";
import {
  beginAuthSession,
  getAuthSessionGeneration,
} from "@/shared/api/authSessionGeneration.service";
import { notifyOfflineSnapshotsChanged } from "../../services/offlinePocketSnapshots.events";
import {
  captureOfflinePocketReadContext,
  getOfflineBusinessSnapshot,
  listOfflineBusinessSnapshots,
  listOfflineBusinessCovers,
  readOfflinePocketStorageSummary,
} from "../../services/offlinePockets.service";
import { offlineCoverFileUri } from "../../services/offlinePocketCoverFiles";
import useOfflineBusinessSnapshots from "../useOfflineBusinessSnapshots";
import useOfflineStorageSummary from "../useOfflineStorageSummary";

jest.mock("expo-router", () => ({ useFocusEffect: () => undefined }));
jest.mock("../../services/offlinePockets.service", () => ({
  currentOfflineBusinessOwner: () => {
    const auth = jest
      .requireActual("@/features/auth/store/auth.store")
      .useAuthStore.getState();
    const local = jest
      .requireActual("@/features/offline-routes/stores/offlineAccess.store")
      .useOfflineAccessStore.getState();
    return local.isRevoking
      ? null
      : auth.isAuthenticated
        ? auth.user.id
        : local.ownerId;
  },
  captureOfflinePocketReadContext: jest.fn(),
  getOfflineBusinessSnapshot: jest.fn(),
  listOfflineBusinessSnapshots: jest.fn(),
  listOfflineBusinessCovers: jest.fn(),
  readOfflinePocketStorageSummary: jest.fn(),
}));
jest.mock("../../services/offlinePocketCoverFiles", () => ({
  offlineCoverFileUri: jest.fn(),
}));

describe("network-independent local snapshot queries", () => {
  let client: QueryClient;
  function Wrapper({ children }: PropsWithChildren) {
    return (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
  }
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, "warn").mockImplementation(() => undefined);
    beginAuthSession();
    useAuthStore.setState({
      user: null,
      isAuthenticated: false,
      isLoading: false,
    });
    useOfflineAccessStore.setState({ ownerId: 7, isRevoking: false });
    client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    jest
      .mocked(captureOfflinePocketReadContext)
      .mockImplementation(async () => ({
        apiScope: "",
        ownerId: useOfflineAccessStore.getState().ownerId!,
        sessionGeneration: getAuthSessionGeneration(),
        clearGeneration: 0,
        access: "local",
      }));
    jest.mocked(listOfflineBusinessSnapshots).mockResolvedValue([]);
    jest.mocked(listOfflineBusinessCovers).mockResolvedValue([]);
    jest.mocked(offlineCoverFileUri).mockResolvedValue(null);
    jest
      .mocked(getOfflineBusinessSnapshot)
      .mockResolvedValue({ businessId: 21, status: "missing", snapshot: null });
    onlineManager.setOnline(false);
  });
  afterEach(() => {
    jest.restoreAllMocks();
    onlineManager.setOnline(true);
    client.clear();
  });

  it("reads and retries SQLite while the network manager is offline", async () => {
    const storageFailure = new Error("storage failure");
    jest
      .mocked(listOfflineBusinessSnapshots)
      .mockRejectedValueOnce(storageFailure);
    const hook = await renderHook(() => useOfflineBusinessSnapshots(), {
      wrapper: Wrapper,
    });
    await waitFor(() => expect(hook.result.current.isError).toBe(true));
    expect(console.warn).toHaveBeenCalledWith(
      "[Offline Pockets] Business snapshot read failed:",
      storageFailure,
    );
    await act(async () => {
      await hook.result.current.refetch();
    });
    await waitFor(() => expect(hook.result.current.isSuccess).toBe(true));
    expect(listOfflineBusinessSnapshots).toHaveBeenCalledTimes(2);
    await act(async () => notifyOfflineSnapshotsChanged());
    await waitFor(() =>
      expect(listOfflineBusinessSnapshots).toHaveBeenCalledTimes(3),
    );
    hook.unmount();
  });

  it("reads storage summaries offline, retries only local failures, and hides revoked data", async () => {
    const storageFailure = new Error("storage unavailable");
    jest
      .mocked(readOfflinePocketStorageSummary)
      .mockRejectedValueOnce(storageFailure)
      .mockResolvedValue({
        businessCount: 2,
        lastUpdated: 1000,
        storageBytes: 1200,
        hasBusinessData: true,
        cleanupPending: false,
        retries: [],
      });
    const hook = await renderHook(() => useOfflineStorageSummary(), {
      wrapper: Wrapper,
    });
    await waitFor(() => expect(hook.result.current.isError).toBe(true));
    expect(console.warn).toHaveBeenCalledWith(
      "[Offline Storage] Business summary read failed:",
      storageFailure,
    );
    await act(async () => {
      await hook.result.current.refetch();
    });
    await waitFor(() =>
      expect(hook.result.current.data?.businessCount).toBe(2),
    );
    expect(readOfflinePocketStorageSummary).toHaveBeenCalledTimes(2);
    await act(async () =>
      useOfflineAccessStore.setState({ ownerId: null, isRevoking: true }),
    );
    expect(hook.result.current.ownerId).toBeNull();
    expect(hook.result.current.data).toBeUndefined();
    hook.unmount();
  });

  it("reads detail locally and immediately hides results when authorization is revoked", async () => {
    const hook = await renderHook(() => useOfflineBusinessSnapshots(21), {
      wrapper: Wrapper,
    });
    await waitFor(() => expect(hook.result.current.isSuccess).toBe(true));
    expect(getOfflineBusinessSnapshot).toHaveBeenCalledWith(
      expect.objectContaining({ ownerId: 7, access: "local" }),
      21,
    );
    await act(async () =>
      useOfflineAccessStore.setState({ ownerId: null, isRevoking: true }),
    );
    expect(hook.result.current.ownerId).toBeNull();
    expect(hook.result.current.data).toBeUndefined();
    hook.unmount();
  });

  it("keeps business text available when the local file is missing or image metadata fails", async () => {
    const snapshot = jest
      .requireActual("../../validation/__tests__/snapshotFixture")
      .snapshotFixture();
    jest
      .mocked(getOfflineBusinessSnapshot)
      .mockResolvedValue({ businessId: 21, status: "available", snapshot });
    jest.mocked(listOfflineBusinessCovers).mockResolvedValue([
      {
        businessId: 21,
        fileName: "cover.img",
        remoteSource: "https://example.com/remote.jpg",
      },
    ]);
    const hook = await renderHook(() => useOfflineBusinessSnapshots(21), {
      wrapper: Wrapper,
    });
    await waitFor(() => expect(hook.result.current.isSuccess).toBe(true));
    expect(hook.result.current.data?.covers).toEqual({});
    expect(hook.result.current.data?.entries[0].status).toBe("available");
    jest
      .mocked(listOfflineBusinessCovers)
      .mockRejectedValueOnce(new Error("image metadata unavailable"));
    await act(async () => {
      await hook.result.current.refetch();
    });
    await waitFor(() => expect(hook.result.current.isSuccess).toBe(true));
    expect(hook.result.current.data?.entries[0].status).toBe("available");
    hook.unmount();
  });
});
