import NetInfo from "@react-native-community/netinfo";
import { AppState, Platform } from "react-native";

import { useAuthStore } from "@/features/auth/store/auth.store";
import {
  beginAuthSession,
  getAuthSessionGeneration,
  invalidateAuthSession,
} from "@/shared/api/authSessionGeneration.service";

import type {
  OfflinePocketContext,
  OfflinePocketControl,
} from "../../types/offlinePockets.types";
import {
  mountOfflinePocketSync,
  requestOfflinePocketSync,
} from "../offlinePocketSync.service";
import { cacheOfflinePocketBusiness } from "../offlinePocketWorker.service";
import * as repository from "../offlinePockets.service";

let mockNetworkListener: (state: {
  isConnected: boolean;
  isInternetReachable: boolean;
}) => void;
const mockDetachNetwork = jest.fn();
jest.mock("@react-native-community/netinfo", () => ({
  __esModule: true,
  default: {
    fetch: jest.fn(),
    addEventListener: jest.fn((listener) => {
      mockNetworkListener = listener;
      return mockDetachNetwork;
    }),
  },
}));
jest.mock("../offlinePocketWorker.service", () => ({
  cacheOfflinePocketBusiness: jest.fn(),
}));
jest.mock("../offlinePockets.service", () => ({
  captureOfflinePocketContext: jest.fn(),
  recoverOfflinePocketWork: jest.fn(),
  listOfflinePocketControls: jest.fn(),
  getOfflinePocketOperation: jest.fn(),
  retryOfflinePocketWork: jest.fn(),
}));

async function flush() {
  // Drain controlled promise continuations without real elapsed time or polling.
  for (let index = 0; index < 100; index += 1) {
    await Promise.resolve();
  }
}

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((complete) => {
    resolve = complete;
  });
  return { promise, resolve };
}

describe("Offline Pocket foreground coordinator", () => {
  let rows: OfflinePocketControl[];
  let appListener: (state: "active" | "background") => void;
  let releases: (() => void)[];
  let activeJob: ReturnType<typeof deferred> | null;
  let removeAppListener: jest.Mock;

  function mount() {
    const release = mountOfflinePocketSync();
    releases.push(release);
    return release;
  }

  function context(): OfflinePocketContext {
    return {
      apiScope: "",
      ownerId: useAuthStore.getState().user!.id,
      sessionGeneration: getAuthSessionGeneration(),
      clearGeneration: 0,
    };
  }

  function pending(id = 21): OfflinePocketControl {
    return {
      businessId: id,
      intent: "automatic",
      clearGeneration: 0,
      operationVersion: 1,
      workStatus: "pending",
      attempts: 0,
      nextRetryAt: null,
      lastErrorCode: null,
      lastCompletedAt: null,
      cachedAt: null,
    };
  }

  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    releases = [];
    activeJob = null;
    rows = [pending()];
    AppState.currentState = "active";
    removeAppListener = jest.fn();
    jest
      .spyOn(AppState, "addEventListener")
      .mockImplementation((_type, listener) => {
        appListener = listener;
        return { remove: removeAppListener };
      });
    beginAuthSession();
    useAuthStore.setState({
      user: { id: 7 } as never,
      isAuthenticated: true,
      isLoading: false,
    });
    jest.mocked(NetInfo.fetch).mockResolvedValue({
      isConnected: true,
      isInternetReachable: true,
    } as never);
    jest
      .mocked(repository.captureOfflinePocketContext)
      .mockImplementation(async () => context());
    jest
      .mocked(repository.recoverOfflinePocketWork)
      .mockImplementation(async () => {
        rows = rows.map((row) =>
          row.workStatus === "running"
            ? {
                ...row,
                workStatus: "pending",
                operationVersion: row.operationVersion + 1,
              }
            : row,
        );
      });
    jest
      .mocked(repository.listOfflinePocketControls)
      .mockImplementation(async () => rows.map((row) => ({ ...row })));
    jest
      .mocked(repository.getOfflinePocketOperation)
      .mockImplementation(async (scope, businessId) => ({
        ...scope,
        businessId,
        operationVersion: rows.find((row) => row.businessId === businessId)!
          .operationVersion,
      }));
    jest
      .mocked(repository.retryOfflinePocketWork)
      .mockImplementation(async (operation) => {
        const row = rows.find(
          (item) => item.businessId === operation.businessId,
        )!;
        row.operationVersion += 1;
        row.workStatus = "pending";
        row.nextRetryAt = null;
        return { ...operation, operationVersion: row.operationVersion };
      });
    jest
      .mocked(cacheOfflinePocketBusiness)
      .mockImplementation(async (operation) => {
        rows.find(
          (row) => row.businessId === operation.businessId,
        )!.workStatus = "completed";
      });
  });

  afterEach(async () => {
    releases.forEach((release) => release());
    activeJob?.resolve();
    await flush();
    useAuthStore.getState().clearUser();
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

  it("starts eligible work, recovers before claiming, and has no polling when idle", async () => {
    mount();
    await flush();
    expect(cacheOfflinePocketBusiness).toHaveBeenCalledTimes(1);
    expect(repository.recoverOfflinePocketWork).toHaveBeenCalledTimes(1);
    expect(jest.getTimerCount()).toBe(0);
    expect(
      jest.mocked(repository.recoverOfflinePocketWork).mock
        .invocationCallOrder[0],
    ).toBeLessThan(
      jest.mocked(cacheOfflinePocketBusiness).mock.invocationCallOrder[0],
    );
  });

  it("coalesces wakeups and duplicate mounts, retaining one job across unmount/remount", async () => {
    activeJob = deferred();
    let guard!: () => boolean;
    jest
      .mocked(cacheOfflinePocketBusiness)
      .mockImplementationOnce(async (_operation, canContinue) => {
        guard = canContinue;
        await activeJob!.promise;
        rows[0].workStatus = "completed";
      });
    const first = mount();
    const second = mount();
    await flush();
    for (let index = 0; index < 30; index += 1) {
      requestOfflinePocketSync();
    }
    await flush();
    expect(cacheOfflinePocketBusiness).toHaveBeenCalledTimes(1);
    expect(NetInfo.addEventListener).toHaveBeenCalledTimes(1);
    expect(repository.recoverOfflinePocketWork).toHaveBeenCalledTimes(1);
    first();
    second();
    expect(guard()).toBe(false);
    mount();
    await flush();
    expect(cacheOfflinePocketBusiness).toHaveBeenCalledTimes(1);
    expect(repository.recoverOfflinePocketWork).toHaveBeenCalledTimes(1);
    activeJob.resolve();
    await flush();
    expect(repository.recoverOfflinePocketWork).toHaveBeenCalledTimes(2);
  });

  it("waits for connectivity restoration and ignores repeated unchanged network events", async () => {
    jest.mocked(NetInfo.fetch).mockResolvedValue({
      isConnected: false,
      isInternetReachable: false,
    } as never);
    mount();
    await flush();
    expect(cacheOfflinePocketBusiness).not.toHaveBeenCalled();
    mockNetworkListener({ isConnected: true, isInternetReachable: true });
    await flush();
    expect(cacheOfflinePocketBusiness).toHaveBeenCalledTimes(1);
    mockNetworkListener({ isConnected: true, isInternetReachable: true });
    await flush();
    expect(repository.captureOfflinePocketContext).toHaveBeenCalledTimes(1);
  });

  it("does not run until foregrounded and invalidates active guards on background/network loss", async () => {
    AppState.currentState = "background";
    activeJob = deferred();
    let guard!: () => boolean;
    jest
      .mocked(cacheOfflinePocketBusiness)
      .mockImplementationOnce(async (_operation, canContinue) => {
        guard = canContinue;
        await activeJob!.promise;
        rows[0].workStatus = "completed";
      });
    mount();
    await flush();
    expect(cacheOfflinePocketBusiness).not.toHaveBeenCalled();
    appListener("active");
    await flush();
    expect(guard()).toBe(true);
    appListener("background");
    appListener("active");
    expect(guard()).toBe(false);
    expect(
      jest.mocked(cacheOfflinePocketBusiness).mock.calls[0][2]?.aborted,
    ).toBe(true);
    mockNetworkListener({ isConnected: false, isInternetReachable: false });
    expect(jest.getTimerCount()).toBe(0);
    activeJob.resolve();
    await flush();
    mockNetworkListener({ isConnected: true, isInternetReachable: true });
    await flush();
    expect(cacheOfflinePocketBusiness).toHaveBeenCalledTimes(1);
  });

  it("runs due retries with a new version using one timer and pauses it in the background", async () => {
    rows[0] = {
      ...pending(),
      workStatus: "failed",
      attempts: 1,
      nextRetryAt: Date.now() + 5000,
    };
    mount();
    await flush();
    expect(cacheOfflinePocketBusiness).not.toHaveBeenCalled();
    expect(jest.getTimerCount()).toBe(1);
    appListener("background");
    expect(jest.getTimerCount()).toBe(0);
    jest.advanceTimersByTime(5000);
    await flush();
    expect(cacheOfflinePocketBusiness).not.toHaveBeenCalled();
    appListener("active");
    await flush();
    expect(repository.retryOfflinePocketWork).toHaveBeenCalledTimes(1);
    expect(cacheOfflinePocketBusiness).toHaveBeenCalledWith(
      expect.objectContaining({ operationVersion: 2 }),
      expect.any(Function),
      expect.anything(),
    );
    expect(jest.getTimerCount()).toBe(0);
  });

  it("wakes for a retry becoming due while active", async () => {
    rows[0] = {
      ...pending(),
      workStatus: "failed",
      nextRetryAt: Date.now() + 5000,
    };
    mount();
    await flush();
    jest.advanceTimersByTime(4999);
    await flush();
    expect(cacheOfflinePocketBusiness).not.toHaveBeenCalled();
    jest.advanceTimersByTime(1);
    await flush();
    expect(cacheOfflinePocketBusiness).toHaveBeenCalledTimes(1);
  });

  it("skips suppressed and permanent failures and recovers persisted running work", async () => {
    rows = [
      { ...pending(), intent: "suppressed", workStatus: "invalidated" },
      { ...pending(22), workStatus: "failed", nextRetryAt: null },
      { ...pending(23), workStatus: "running" },
    ];
    mount();
    await flush();
    expect(cacheOfflinePocketBusiness).toHaveBeenCalledTimes(1);
    expect(cacheOfflinePocketBusiness).toHaveBeenCalledWith(
      expect.objectContaining({ businessId: 23, operationVersion: 2 }),
      expect.any(Function),
      expect.anything(),
    );
    expect(jest.getTimerCount()).toBe(0);
  });

  it.each([7, 8])(
    "waits for old work to settle before recovering replacement session %s",
    async (ownerId) => {
      activeJob = deferred();
      let guard!: () => boolean;
      jest
        .mocked(cacheOfflinePocketBusiness)
        .mockImplementationOnce(async (_operation, canContinue) => {
          guard = canContinue;
          await activeJob!.promise;
        });
      mount();
      await flush();
      invalidateAuthSession();
      useAuthStore.getState().clearUser();
      expect(guard()).toBe(false);
      beginAuthSession();
      useAuthStore.setState({
        user: { id: ownerId } as never,
        isAuthenticated: true,
      });
      await flush();
      expect(repository.recoverOfflinePocketWork).toHaveBeenCalledTimes(1);
      activeJob.resolve();
      await flush();
      expect(repository.recoverOfflinePocketWork).toHaveBeenCalledTimes(2);
      expect(cacheOfflinePocketBusiness).toHaveBeenLastCalledWith(
        expect.objectContaining({
          ownerId,
          sessionGeneration: getAuthSessionGeneration(),
        }),
        expect.any(Function),
        expect.anything(),
      );
    },
  );

  it("retries local initialization failures with bounded timers rather than a busy loop", async () => {
    jest
      .mocked(repository.captureOfflinePocketContext)
      .mockRejectedValue(new Error("SQLite unavailable"));
    mount();
    await flush();
    expect(repository.captureOfflinePocketContext).toHaveBeenCalledTimes(1);
    for (const delay of [5000, 10000, 20000, 40000, 80000]) {
      jest.advanceTimersByTime(delay);
      await flush();
    }
    expect(repository.captureOfflinePocketContext).toHaveBeenCalledTimes(6);
    expect(jest.getTimerCount()).toBe(0);
    expect(cacheOfflinePocketBusiness).not.toHaveBeenCalled();
  });

  it("never initializes native SQLite on web", async () => {
    jest.replaceProperty(Platform, "OS", "web");
    mount();
    await flush();
    expect(repository.captureOfflinePocketContext).not.toHaveBeenCalled();
  });

  it("replaces an obsolete error timer when a coalesced wakeup succeeds", async () => {
    jest.mocked(cacheOfflinePocketBusiness).mockImplementationOnce(async () => {
      requestOfflinePocketSync();
      throw new Error("Obsolete claim");
    });
    mount();
    await flush();
    expect(cacheOfflinePocketBusiness).toHaveBeenCalledTimes(2);
    expect(jest.getTimerCount()).toBe(0);
  });

  it("runs multiple businesses sequentially and releases listeners only after the last mount", async () => {
    rows = [pending(), pending(22)];
    activeJob = deferred();
    jest.mocked(cacheOfflinePocketBusiness).mockImplementationOnce(async () => {
      await activeJob!.promise;
      rows[0].workStatus = "completed";
    });
    const first = mount();
    const second = mount();
    await flush();
    expect(cacheOfflinePocketBusiness).toHaveBeenCalledTimes(1);
    first();
    expect(removeAppListener).not.toHaveBeenCalled();
    activeJob.resolve();
    await flush();
    expect(cacheOfflinePocketBusiness).toHaveBeenCalledTimes(2);
    second();
    expect(removeAppListener).toHaveBeenCalledTimes(1);
    expect(mockDetachNetwork).toHaveBeenCalledTimes(1);
    expect(jest.getTimerCount()).toBe(0);
  });

  it("does not let a late initial connectivity fetch overwrite a newer network event", async () => {
    let resolveFetch!: (
      state: Awaited<ReturnType<typeof NetInfo.fetch>>,
    ) => void;
    jest.mocked(NetInfo.fetch).mockReturnValueOnce(
      new Promise((resolve) => {
        resolveFetch = resolve;
      }),
    );
    mount();
    mockNetworkListener({ isConnected: false, isInternetReachable: false });
    resolveFetch({ isConnected: true, isInternetReachable: true } as never);
    await flush();
    expect(cacheOfflinePocketBusiness).not.toHaveBeenCalled();
    mockNetworkListener({ isConnected: true, isInternetReachable: true });
    await flush();
    expect(cacheOfflinePocketBusiness).toHaveBeenCalledTimes(1);
  });
});
