/// <reference types="node" />
import { act, cleanup, renderHook } from "@testing-library/react-native";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { SQLInputValue } from "node:sqlite";
import type { PropsWithChildren } from "react";
import * as SecureStore from "expo-secure-store";
import Toast from "react-native-toast-message";

import { useAuthStore } from "../../store/auth.store";
import { beginAuthSession } from "@/shared/api/authSessionGeneration.service";
import {
  OFFLINE_API_SCOPE,
  OFFLINE_OWNER_KEY,
} from "@/features/offline-routes/constants/offlineRoutes.constants";
import {
  listSavedJourneys,
  saveJourney,
  deleteSavedJourney,
} from "@/features/offline-routes/services/savedJourneys.service";
import { useOfflineAccessStore } from "@/features/offline-routes/stores/offlineAccess.store";
import { snapshot } from "@/features/offline-routes/utils/__tests__/savedJourney.fixture";
import { useLogout } from "../useLogout";

const sqlite = jest.requireActual(
  "node:sqlite",
) as typeof import("node:sqlite");
const mockDatabase = new sqlite.DatabaseSync(":memory:");
const mockSecureItems = new Map<string, string>();

// Only native boundaries are adapted; logout, access checks, and SQL are real.
type SqliteAdapter = {
  execAsync: (sql: string) => Promise<void>;
  closeAsync: () => Promise<void>;
  runAsync: (sql: string, ...parameters: SQLInputValue[]) => Promise<unknown>;
  getFirstAsync: (
    sql: string,
    ...parameters: SQLInputValue[]
  ) => Promise<unknown>;
  getAllAsync: (
    sql: string,
    ...parameters: SQLInputValue[]
  ) => Promise<unknown[]>;
  withExclusiveTransactionAsync: (
    action: (transaction: SqliteAdapter) => Promise<void>,
  ) => Promise<void>;
};

const mockAdapter: SqliteAdapter = {
  execAsync: async (sql: string) => {
    mockDatabase.exec(sql);
  },
  closeAsync: async () => undefined,
  runAsync: async (sql: string, ...parameters: SQLInputValue[]) =>
    mockDatabase.prepare(sql).run(...parameters),
  getFirstAsync: async (sql: string, ...parameters: SQLInputValue[]) =>
    mockDatabase.prepare(sql).get(...parameters) ?? null,
  getAllAsync: async (sql: string, ...parameters: SQLInputValue[]) =>
    mockDatabase.prepare(sql).all(...parameters),
  withExclusiveTransactionAsync: async (
    action: (transaction: SqliteAdapter) => Promise<void>,
  ) => {
    mockDatabase.exec("BEGIN IMMEDIATE");
    try {
      await action(mockAdapter);
      mockDatabase.exec("COMMIT");
    } catch (error) {
      mockDatabase.exec("ROLLBACK");
      throw error;
    }
  },
};

jest.mock("@/features/offline-routes/services/sqliteDriver", () => ({
  openDatabaseAsync: jest.fn(async () => mockAdapter),
}));
jest.mock("expo-secure-store", () => ({
  getItemAsync: jest.fn(
    async (key: string) => mockSecureItems.get(key) ?? null,
  ),
  setItemAsync: jest.fn(async (key: string, value: string) => {
    mockSecureItems.set(key, value);
  }),
  deleteItemAsync: jest.fn(async (key: string) => {
    mockSecureItems.delete(key);
  }),
}));
jest.mock("../../api/token.service", () => ({ revokeRefreshToken: jest.fn() }));
jest.mock("@/features/merchant/stores/merchantRegistrationStore", () => ({
  useMerchantRegistrationStore: { getState: () => ({ reset: jest.fn() }) },
}));
jest.mock("react-native-toast-message", () => ({ show: jest.fn() }));

function signIn(ownerId = 7) {
  beginAuthSession();
  useAuthStore.setState({
    user: { id: ownerId } as never,
    isAuthenticated: true,
    isLoading: false,
  });
  useOfflineAccessStore.setState({ ownerId: null, isRevoking: false });
}

async function renderLogout() {
  const client = new QueryClient();
  client.setQueryData(["private"], { ownerId: 7 });
  function Wrapper({ children }: PropsWithChildren) {
    return (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
  }
  const hook = await renderHook(() => useLogout(), { wrapper: Wrapper });
  return { ...hook, client };
}

function savedRows() {
  return mockDatabase.prepare("SELECT * FROM saved_journeys_v1").all();
}

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((complete) => {
    resolve = complete;
  });
  return { promise, resolve };
}

function pauseNextWrite() {
  const started = deferred();
  const release = deferred();
  const run = mockAdapter.runAsync;
  jest
    .spyOn(mockAdapter, "runAsync")
    .mockImplementationOnce(async (sql, ...parameters) => {
      started.resolve();
      await release.promise;
      return run(sql, ...parameters);
    });
  return { started, release };
}

describe("logout with the actual journey repository", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    signIn();
    mockSecureItems.clear();
    mockSecureItems.set("access_token", "access");
    mockSecureItems.set("refresh_token", "refresh");
    mockDatabase.exec(`CREATE TABLE IF NOT EXISTS saved_journeys_v1 (
      api_scope TEXT NOT NULL, owner_id INTEGER NOT NULL,
      journey_key TEXT NOT NULL, snapshot TEXT NOT NULL, saved_at TEXT NOT NULL,
      PRIMARY KEY (api_scope, owner_id, journey_key)
    ); DELETE FROM saved_journeys_v1;`);
  });

  afterEach(async () => {
    await cleanup();
    jest.restoreAllMocks();
  });

  afterAll(() => {
    mockDatabase.close();
  });

  it.each([false, true])(
    "physically clears the revoked account with saved journeys=%s",
    async (hasJourneys) => {
      if (hasJourneys) {
        await saveJourney(snapshot);
      }
      const hook = await renderLogout();
      await act(async () => {
        const loggingOut = hook.result.current.logout();
        expect(useAuthStore.getState().isAuthenticated).toBe(false);
        expect(useOfflineAccessStore.getState().ownerId).toBeNull();
        expect(useOfflineAccessStore.getState().isRevoking).toBe(true);
        await expect(listSavedJourneys(7)).rejects.toThrow("unavailable");
        const completed = await loggingOut;
        expect(savedRows()).toEqual([]);
        expect(completed).toBe(true);
      });
      expect(mockSecureItems.has(OFFLINE_OWNER_KEY)).toBe(false);
      expect(mockSecureItems.has("access_token")).toBe(false);
      expect(hook.client.getQueryData(["private"])).toBeUndefined();
      expect(SecureStore.deleteItemAsync).toHaveBeenCalled();
      hook.client.clear();
    },
  );

  it("deletes only the captured account and API scope after another account signs in", async () => {
    await saveJourney(snapshot);
    mockDatabase
      .prepare("INSERT INTO saved_journeys_v1 VALUES (?, ?, ?, ?, ?)")
      .run(OFFLINE_API_SCOPE, 8, "other-account", "retained", snapshot.savedAt);
    mockDatabase
      .prepare("INSERT INTO saved_journeys_v1 VALUES (?, ?, ?, ?, ?)")
      .run("another-api", 7, "other-api", "retained", snapshot.savedAt);
    const hook = await renderLogout();
    const paused = pauseNextWrite();
    await act(async () => {
      const loggingOut = hook.result.current.logout();
      await paused.started.promise;
      signIn(8);
      const saving = saveJourney(snapshot);
      paused.release.resolve();
      await expect(loggingOut).resolves.toBe(true);
      await saving;
    });
    expect(savedRows()).toHaveLength(3);
    expect(savedRows().filter((row) => row.owner_id === 7)).toEqual([
      expect.objectContaining({ api_scope: "another-api" }),
    ]);
    expect(await listSavedJourneys(8)).toHaveLength(2);
    await expect(listSavedJourneys(7)).rejects.toThrow("unavailable");
    hook.client.clear();
  });

  it("finishes old cleanup before allowing the same user's new save and read", async () => {
    await saveJourney(snapshot);
    const hook = await renderLogout();
    const paused = pauseNextWrite();
    const replacement = {
      ...snapshot,
      origin: { ...snapshot.origin, label: "New session" },
    };
    await act(async () => {
      const loggingOut = hook.result.current.logout();
      await paused.started.promise;
      signIn();
      const saving = saveJourney(replacement);
      const reading = listSavedJourneys(7);
      paused.release.resolve();
      await expect(loggingOut).resolves.toBe(true);
      await saving;
      expect(await reading).toEqual([
        { key: "21:8:2:4", snapshot: replacement },
      ]);
    });
    expect(useAuthStore.getState().isAuthenticated).toBe(true);
    expect(savedRows()).toHaveLength(1);
    expect(JSON.parse(mockSecureItems.get(OFFLINE_OWNER_KEY)!)).toMatchObject({
      ownerId: 7,
    });
    hook.client.clear();
  });

  it("rolls back an old in-flight save and rejects queued deletion after same-user relogin", async () => {
    const hook = await renderLogout();
    const paused = pauseNextWrite();
    await act(async () => {
      const oldSave = saveJourney(snapshot).catch((error: unknown) => error);
      await paused.started.promise;
      const oldDelete = deleteSavedJourney(7, "21:8:2:4").catch(
        (error: unknown) => error,
      );
      const loggingOut = hook.result.current.logout();
      signIn();
      const replacement = {
        ...snapshot,
        origin: { ...snapshot.origin, label: "Fresh session save" },
      };
      const saving = saveJourney(replacement);
      paused.release.resolve();
      expect(await oldSave).toEqual(expect.any(Error));
      expect(await oldDelete).toEqual(expect.any(Error));
      await expect(loggingOut).resolves.toBe(true);
      await saving;
      expect(await listSavedJourneys(7)).toEqual([
        { key: "21:8:2:4", snapshot: replacement },
      ]);
    });
    expect(SecureStore.setItemAsync).toHaveBeenCalledTimes(1);
    hook.client.clear();
  });

  it("keeps residual rows inaccessible when physical cleanup fails", async () => {
    await saveJourney(snapshot);
    jest
      .spyOn(mockAdapter, "runAsync")
      .mockRejectedValueOnce(new Error("Device storage unavailable"));
    const hook = await renderLogout();
    await act(async () => {
      await expect(hook.result.current.logout()).resolves.toBe(false);
    });
    expect(savedRows()).toHaveLength(1);
    expect(mockSecureItems.has(OFFLINE_OWNER_KEY)).toBe(false);
    expect(useAuthStore.getState().isAuthenticated).toBe(false);
    await expect(listSavedJourneys(7)).rejects.toThrow("unavailable");
    await expect(saveJourney(snapshot)).rejects.toThrow("Sign in");
    expect(Toast.show).toHaveBeenCalledWith(
      expect.objectContaining({
        text1: "Saved guidance could not be removed",
      }),
    );
    // A rejected cleanup must not poison the queue for a later authenticated owner.
    signIn(8);
    await saveJourney(snapshot);
    expect(await listSavedJourneys(8)).toHaveLength(1);
    hook.client.clear();
  });

  it("rejects an in-flight save after logout without recreating rows or local access", async () => {
    const hook = await renderLogout();
    const paused = pauseNextWrite();
    await act(async () => {
      const saving = saveJourney(snapshot).catch((error: unknown) => error);
      await paused.started.promise;
      const loggingOut = hook.result.current.logout();
      paused.release.resolve();
      expect(await saving).toEqual(expect.any(Error));
      await expect(loggingOut).resolves.toBe(true);
    });
    expect(savedRows()).toEqual([]);
    expect(mockSecureItems.has(OFFLINE_OWNER_KEY)).toBe(false);
    expect(SecureStore.setItemAsync).not.toHaveBeenCalled();
    hook.client.clear();
  });

  it("rejects a delayed old-session read after the same account signs in again", async () => {
    await saveJourney(snapshot);
    const started = deferred();
    const release = deferred();
    const read = mockAdapter.getAllAsync;
    jest
      .spyOn(mockAdapter, "getAllAsync")
      .mockImplementationOnce(async (sql, ...parameters) => {
        const rows = await read(sql, ...parameters);
        started.resolve();
        await release.promise;
        return rows;
      });
    const hook = await renderLogout();
    await act(async () => {
      const reading = listSavedJourneys(7).catch((error: unknown) => error);
      await started.promise;
      await hook.result.current.logout();
      signIn();
      release.resolve();
      expect(await reading).toEqual(expect.any(Error));
      expect(await listSavedJourneys(7)).toEqual([]);
    });
    hook.client.clear();
  });
});
