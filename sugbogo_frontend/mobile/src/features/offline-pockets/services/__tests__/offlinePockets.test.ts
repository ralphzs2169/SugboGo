/// <reference types="node" />
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, rmdirSync, unlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { DatabaseSync, SQLInputValue } from "node:sqlite";
import type { SQLiteDatabase } from "expo-sqlite";
import {
  businessFixture,
  snapshotFixture,
} from "../../validation/__tests__/snapshotFixture";

const sqlite = jest.requireActual(
  "node:sqlite",
) as typeof import("node:sqlite");
type Repository = typeof import("../offlinePockets.service");
type AuthStore = typeof import("@/features/auth/store/auth.store");
type Session = typeof import("@/shared/api/authSessionGeneration.service");

let api: Repository;
let auth: AuthStore["useAuthStore"];
let session: Session;
let directory: string;
let databasePath: string;
let mockApiScope = "https://api-a.example";
let mockFailSql: string | null = null;
let mockFailMigration = false;
let mockFailSnapshotMigration = false;
const mockGetDetail = jest.fn();
const mockGetMemberships = jest.fn();
const mockReplaceMemberships = jest.fn();
const mockRemoveMembership = jest.fn();
const mockDeleteCollection = jest.fn();
const mockSync = jest.fn();
const mockSecureValues = new Map<string, string>();
jest.mock("expo-secure-store", () => ({
  setItemAsync: async (key: string, value: string) => {
    mockSecureValues.set(key, value);
  },
  getItemAsync: async (key: string) => mockSecureValues.get(key) ?? null,
  deleteItemAsync: async (key: string) => {
    mockSecureValues.delete(key);
  },
}));
jest.mock("@/features/offline-routes/services/savedJourneys.service", () => ({
  hasSavedJourneysForOfflineAccess: async () => false,
}));
jest.mock("../offlinePocketSync.service", () => ({
  requestOfflinePocketSync: () => mockSync(),
}));
jest.mock("@/features/explore/api/exploreBusiness.service", () => ({
  getExploreBusinessDetail: (...args: unknown[]) => mockGetDetail(...args),
}));
jest.mock("@/features/pockets/api/pockets.service", () => ({
  getBusinessPocketMemberships: (...args: unknown[]) =>
    mockGetMemberships(...args),
  replaceBusinessPocketMemberships: (...args: unknown[]) =>
    mockReplaceMemberships(...args),
  removePocketCollectionBusiness: (...args: unknown[]) =>
    mockRemoveMembership(...args),
  deletePocketCollection: (...args: unknown[]) => mockDeleteCollection(...args),
}));
const mockConnections = new Set<DatabaseSync>();
const mockOpenedNames: string[] = [];
let mockPause: {
  sql: string;
  started: () => void;
  release: Promise<void>;
} | null = null;

/** Adapts only native SQLite; repository queries and transactions execute on real SQLite. */
function mockOpenDatabase(name: string): SQLiteDatabase {
  mockOpenedNames.push(name);
  const native = new sqlite.DatabaseSync(databasePath);
  mockConnections.add(native);
  const adapter = {
    execAsync: async (sql: string) => {
      if (
        mockFailSnapshotMigration &&
        sql.includes("PRAGMA user_version = 2")
      ) {
        mockFailSnapshotMigration = false;
        throw new Error("Snapshot migration failed");
      }
      if (mockFailMigration && sql.includes("PRAGMA user_version = 1")) {
        mockFailMigration = false;
        throw new Error("Migration failed");
      }
      native.exec(sql);
    },
    closeAsync: async () => {
      native.close();
      mockConnections.delete(native);
    },
    runAsync: async (sql: string, ...parameters: SQLInputValue[]) => {
      if (mockFailSql && sql.includes(mockFailSql)) {
        mockFailSql = null;
        throw new Error("Write failed");
      }
      if (mockPause && sql.includes(mockPause.sql)) {
        const pause = mockPause;
        mockPause = null;
        pause.started();
        await pause.release;
      }
      return native.prepare(sql).run(...parameters);
    },
    getFirstAsync: async (sql: string, ...parameters: SQLInputValue[]) =>
      native.prepare(sql).get(...parameters) ?? null,
    getAllAsync: async (sql: string, ...parameters: SQLInputValue[]) =>
      native.prepare(sql).all(...parameters),
    withExclusiveTransactionAsync: async (
      action: (tx: SQLiteDatabase) => Promise<void>,
    ) => {
      native.exec("BEGIN IMMEDIATE");
      try {
        await action(adapter as unknown as SQLiteDatabase);
        native.exec("COMMIT");
      } catch (error) {
        native.exec("ROLLBACK");
        throw error;
      }
    },
  };
  return adapter as unknown as SQLiteDatabase;
}

jest.mock("../sqliteDriver", () => ({
  openDatabaseAsync: jest.fn(async (name: string) => mockOpenDatabase(name)),
}));
jest.mock("../../constants/offlinePockets.constants", () => {
  const constants = {
    ...jest.requireActual("../../constants/offlinePockets.constants"),
  };
  // Preserve a live getter; transpiled object spread would snapshot its value.
  Object.defineProperty(constants, "OFFLINE_POCKETS_API_SCOPE", {
    enumerable: true,
    get: () => mockApiScope,
  });
  return constants;
});

function signIn(ownerId = 7) {
  session.beginAuthSession();
  auth.setState({
    user: { id: ownerId } as never,
    isAuthenticated: true,
    isLoading: false,
  });
}

function loadRepository() {
  jest.resetModules();
  auth = jest.requireActual<AuthStore>(
    "@/features/auth/store/auth.store",
  ).useAuthStore;
  session = jest.requireActual<Session>(
    "@/shared/api/authSessionGeneration.service",
  );
  api = jest.requireActual<Repository>("../offlinePockets.service");
  signIn();
}

function nativeDatabase(): DatabaseSync {
  const native = mockConnections.values().next().value;
  if (!native) {
    throw new Error("Database not opened");
  }
  return native;
}

function reopenRepository() {
  for (const native of mockConnections) {
    native.close();
  }
  mockConnections.clear();
  loadRepository();
}

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((complete) => {
    resolve = complete;
  });
  return { promise, resolve };
}

describe("Offline Pocket SQLite control foundation", () => {
  beforeEach(() => {
    mockSecureValues.clear();
    directory = mkdtempSync(join(tmpdir(), "sugbogo-pocket-control-"));
    databasePath = join(directory, "pockets.sqlite");
    mockApiScope = "https://api-a.example";
    mockFailSql = null;
    mockFailMigration = false;
    mockFailSnapshotMigration = false;
    mockPause = null;
    mockOpenedNames.length = 0;
    loadRepository();
    mockGetDetail
      .mockReset()
      .mockResolvedValue({ success: true, data: businessFixture() });
    mockGetMemberships.mockReset().mockResolvedValue({
      success: true,
      data: { business_id: 21, pocket_ids: [1, 2], is_pocketed: true },
    });
    mockReplaceMemberships.mockReset().mockResolvedValue({
      success: true,
      data: { business_id: 21, pocket_ids: [1], is_pocketed: true },
    });
    mockRemoveMembership.mockReset().mockResolvedValue({
      success: true,
      data: { business_id: 21, pocket_ids: [], is_pocketed: false },
    });
    mockDeleteCollection
      .mockReset()
      .mockResolvedValue({ success: true, data: { id: 30 } });
    mockSync.mockReset();
  });

  afterEach(() => {
    jest.restoreAllMocks();
    for (const native of mockConnections) {
      native.close();
    }
    mockConnections.clear();
    for (const suffix of ["", "-wal", "-shm"]) {
      const file = databasePath + suffix;
      if (existsSync(file)) {
        unlinkSync(file);
      }
    }
    rmdirSync(directory);
  });

  it("initializes once with WAL, foreign keys, and explicit schema versioning", async () => {
    const [first, second] = await Promise.all([
      api.captureOfflinePocketContext(),
      api.captureOfflinePocketContext(),
    ]);
    expect(first).toEqual(second);
    expect(first.clearGeneration).toBe(0);
    expect(mockOpenedNames).toEqual(["sugbogo_offline_pockets.db"]);
    expect(nativeDatabase().prepare("PRAGMA user_version").get()).toEqual({
      user_version: 2,
    });
    expect(nativeDatabase().prepare("PRAGMA journal_mode").get()).toEqual({
      journal_mode: "wal",
    });
    expect(nativeDatabase().prepare("PRAGMA foreign_keys").get()).toEqual({
      foreign_keys: 1,
    });
  });

  it("migrates version zero and reopens without losing intentions", async () => {
    const context = await api.captureOfflinePocketContext();
    await api.enqueueConfirmedPocketSave(context, 21);
    reopenRepository();
    const reopened = await api.captureOfflinePocketContext();
    expect(await api.getOfflinePocketControl(reopened, 21)).toMatchObject({
      intent: "automatic",
      workStatus: "pending",
      operationVersion: 1,
    });
    expect(mockOpenedNames).toHaveLength(2);
  });

  it("rolls back a failed migration, closes the connection, and permits retry", async () => {
    mockFailMigration = true;
    await expect(api.captureOfflinePocketContext()).rejects.toThrow(
      "Migration failed",
    );
    expect(mockConnections.size).toBe(0);
    const probe = new sqlite.DatabaseSync(databasePath);
    expect(probe.prepare("PRAGMA user_version").get()).toEqual({
      user_version: 0,
    });
    expect(
      probe
        .prepare("SELECT name FROM sqlite_master WHERE type = 'table'")
        .all(),
    ).toEqual([]);
    probe.close();
    await expect(api.captureOfflinePocketContext()).resolves.toMatchObject({
      clearGeneration: 0,
    });
  });

  it("rejects a future schema version without modifying or downgrading it", async () => {
    const probe = new sqlite.DatabaseSync(databasePath);
    probe.exec("PRAGMA user_version = 99");
    await expect(api.captureOfflinePocketContext()).rejects.toThrow(
      "newer app",
    );
    expect(probe.prepare("PRAGMA user_version").get()).toEqual({
      user_version: 99,
    });
    expect(mockConnections.size).toBe(0);
    probe.close();
  });

  it("isolates identical business IDs across owners and rejects forged owner contexts", async () => {
    const first = await api.captureOfflinePocketContext();
    await api.enqueueConfirmedPocketSave(first, 21);
    signIn(8);
    const second = await api.captureOfflinePocketContext();
    expect(await api.listOfflinePocketControls(second)).toEqual([]);
    await api.requestOfflinePocketRestore(second, 21);
    await expect(api.listOfflinePocketControls(first)).rejects.toThrow(
      "Sign in",
    );
    await expect(
      api.clearOfflinePocketControlState({ ...second, ownerId: 7 }),
    ).rejects.toThrow("Sign in");
    await api.clearOfflinePocketControlState(second);
    signIn();
    expect(
      await api.getOfflinePocketControl(
        await api.captureOfflinePocketContext(),
        21,
      ),
    ).toMatchObject({ intent: "automatic", workStatus: "pending" });
  });

  it("isolates API scopes and rejects contexts from a different configured API", async () => {
    const first = await api.captureOfflinePocketContext();
    await api.enqueueConfirmedPocketSave(first, 21);
    mockApiScope = "https://api-b.example";
    const second = await api.captureOfflinePocketContext();
    expect(await api.listOfflinePocketControls(second)).toEqual([]);
    await api.requestOfflinePocketRestore(second, 21);
    await expect(api.enqueueConfirmedPocketSave(first, 22)).rejects.toThrow(
      "Sign in",
    );
    await api.clearOfflinePocketControlState(second);
    mockApiScope = first.apiScope;
    expect(
      await api.getOfflinePocketControl(
        await api.captureOfflinePocketContext(),
        21,
      ),
    ).toMatchObject({ intent: "automatic" });
  });

  it("deduplicates requests for one business regardless of Pocket collection count", async () => {
    const context = await api.captureOfflinePocketContext();
    const [first, second] = await Promise.all([
      api.enqueueConfirmedPocketSave(context, 21),
      api.enqueueConfirmedPocketSave(context, 21),
    ]);
    expect(first).toEqual(second);
    await api.startOfflinePocketWork(first);
    expect(await api.enqueueConfirmedPocketSave(context, 21)).toEqual(first);
    expect(await api.listOfflinePocketControls(context)).toHaveLength(1);
    expect(await api.getOfflinePocketControl(context, 21)).toMatchObject({
      attempts: 1,
    });
  });

  it("suppresses pending and running work and rejects both old and relabeled stale tokens", async () => {
    const context = await api.captureOfflinePocketContext();
    const pending = await api.enqueueConfirmedPocketSave(context, 21);
    const running = await api.enqueueConfirmedPocketSave(context, 22);
    await api.startOfflinePocketWork(running);
    const cleared = await api.clearOfflinePocketControlState(context);
    expect(cleared.clearGeneration).toBe(1);
    expect(await api.listOfflinePocketControls(cleared)).toEqual([
      expect.objectContaining({
        intent: "suppressed",
        workStatus: "invalidated",
      }),
      expect.objectContaining({
        intent: "suppressed",
        workStatus: "invalidated",
      }),
    ]);
    await expect(api.startOfflinePocketWork(pending)).rejects.toThrow(
      "no longer current",
    );
    await expect(
      api.completeOfflinePocketWork({ ...running, ...cleared }),
    ).rejects.toThrow("no longer current");
    expect(await api.getOfflinePocketOperation(cleared, 21)).toBeNull();
  });

  it("persists clearing across reopening and a fresh process without re-enqueueing reads", async () => {
    const context = await api.captureOfflinePocketContext();
    const old = await api.enqueueConfirmedPocketSave(context, 21);
    await api.clearOfflinePocketControlState(context);
    reopenRepository();
    const reopened = await api.captureOfflinePocketContext();
    expect(reopened.clearGeneration).toBe(1);
    expect(await api.getOfflinePocketControl(reopened, 21)).toMatchObject({
      intent: "suppressed",
      workStatus: "invalidated",
    });
    expect(await api.getOfflinePocketControl(reopened, 999)).toBeNull();
    expect(await api.getOfflinePocketOperation(reopened, 21)).toBeNull();
    await expect(api.startOfflinePocketWork(old)).rejects.toThrow(
      "no longer current",
    );
    const output = execFileSync(
      process.execPath,
      [
        "-e",
        `
      const { DatabaseSync } = require('node:sqlite');
      const db = new DatabaseSync(process.argv[1]);
      console.log(JSON.stringify(db.prepare('SELECT clear_generation FROM offline_pocket_accounts').get()));
      db.close();
    `,
        databasePath,
      ],
      { encoding: "utf8" },
    );
    expect(JSON.parse(output)).toEqual({ clear_generation: 1 });
  });

  it("invalidates enqueue-before-clear and rejects clear-before-enqueue with the old context", async () => {
    let context = await api.captureOfflinePocketContext();
    const enqueuing = api.enqueueConfirmedPocketSave(context, 21);
    const clearing = api.clearOfflinePocketControlState(context);
    await enqueuing;
    context = await clearing;
    expect(await api.getOfflinePocketOperation(context, 21)).toBeNull();
    const secondClear = api.clearOfflinePocketControlState(context);
    const staleEnqueue = api.enqueueConfirmedPocketSave(context, 22);
    await secondClear;
    await expect(staleEnqueue).rejects.toThrow("no longer current");
    expect(
      await api.getOfflinePocketControl(
        await api.captureOfflinePocketContext(),
        22,
      ),
    ).toBeNull();
  });

  it("allows a new confirmed save and explicit restoration without restoring other suppressed entries", async () => {
    const context = await api.captureOfflinePocketContext();
    await api.enqueueConfirmedPocketSave(context, 21);
    await api.enqueueConfirmedPocketSave(context, 22);
    const cleared = await api.clearOfflinePocketControlState(context);
    await api.enqueueConfirmedPocketSave(cleared, 23);
    const restore = await api.requestOfflinePocketRestore(cleared, 21);
    expect(await api.requestOfflinePocketRestore(cleared, 21)).toEqual(restore);
    expect(await api.listOfflinePocketControls(cleared)).toEqual([
      expect.objectContaining({
        businessId: 21,
        intent: "restore",
        workStatus: "pending",
      }),
      expect.objectContaining({
        businessId: 22,
        intent: "suppressed",
        workStatus: "invalidated",
      }),
      expect.objectContaining({
        businessId: 23,
        intent: "automatic",
        workStatus: "pending",
      }),
    ]);
  });

  it("allows a genuinely new confirmed save of a previously suppressed business", async () => {
    const context = await api.captureOfflinePocketContext();
    const original = await api.enqueueConfirmedPocketSave(context, 21);
    const cleared = await api.clearOfflinePocketControlState(context);
    const fresh = await api.enqueueConfirmedPocketSave(cleared, 21);
    expect(fresh.operationVersion).toBe(original.operationVersion + 2);
    expect(await api.getOfflinePocketControl(cleared, 21)).toMatchObject({
      intent: "automatic",
      workStatus: "pending",
    });
    await expect(
      api.startOfflinePocketWork({ ...original, ...cleared }),
    ).rejects.toThrow("no longer current");
  });

  it("does not touch the separate saved-journey database when clearing control state", async () => {
    const guidancePath = join(directory, "guidance.sqlite");
    const guidance = new sqlite.DatabaseSync(guidancePath);
    try {
      guidance.exec("CREATE TABLE retained_guidance (snapshot TEXT NOT NULL)");
      guidance
        .prepare("INSERT INTO retained_guidance VALUES (?)")
        .run("journey");
      const context = await api.captureOfflinePocketContext();
      await api.enqueueConfirmedPocketSave(context, 21);
      await api.clearOfflinePocketControlState(context);
      expect(
        guidance.prepare("SELECT snapshot FROM retained_guidance").all(),
      ).toEqual([{ snapshot: "journey" }]);
      expect(mockOpenedNames).toEqual(["sugbogo_offline_pockets.db"]);
    } finally {
      guidance.close();
      unlinkSync(guidancePath);
    }
  });

  it("rejects invalid state transitions and rolls back account clearing on counter overflow", async () => {
    const context = await api.captureOfflinePocketContext();
    const operation = await api.enqueueConfirmedPocketSave(context, 21);
    await expect(api.completeOfflinePocketWork(operation)).rejects.toThrow(
      "running",
    );
    nativeDatabase()
      .prepare("UPDATE offline_pocket_controls SET operation_version = ?")
      .run(Number.MAX_SAFE_INTEGER);
    await expect(api.clearOfflinePocketControlState(context)).rejects.toThrow();
    expect(await api.captureOfflinePocketContext()).toEqual(context);
    expect(await api.getOfflinePocketControl(context, 21)).toMatchObject({
      intent: "automatic",
      workStatus: "pending",
      operationVersion: Number.MAX_SAFE_INTEGER,
    });
  });

  it("keeps completion history and freshness separate from failed work and manual retry", async () => {
    const context = await api.captureOfflinePocketContext();
    const operation = await api.enqueueConfirmedPocketSave(context, 21);
    await api.startOfflinePocketWork(operation);
    await api.completeOfflinePocketWork(operation);
    const completed = await api.getOfflinePocketControl(context, 21);
    expect(completed).toMatchObject({
      workStatus: "completed",
      cachedAt: null,
    });
    expect(completed?.lastCompletedAt).toEqual(expect.any(Number));
    expect(await api.enqueueConfirmedPocketSave(context, 21)).toEqual(
      operation,
    );
    const manual = await api.requestOfflinePocketRestore(context, 21);
    await api.startOfflinePocketWork(manual);
    await api.failOfflinePocketWork(manual, "NETWORK_ERROR", null);
    await expect(api.retryOfflinePocketWork(manual)).rejects.toThrow(
      "not eligible",
    );
    expect(await api.getOfflinePocketControl(context, 21)).toMatchObject({
      workStatus: "failed",
      cachedAt: null,
      lastCompletedAt: completed?.lastCompletedAt,
    });
  });

  it("enforces retry time and invalidates the previous failed work revision", async () => {
    const context = await api.captureOfflinePocketContext();
    const operation = await api.enqueueConfirmedPocketSave(context, 21);
    await api.startOfflinePocketWork(operation);
    await api.failOfflinePocketWork(
      operation,
      "NETWORK_ERROR",
      Date.now() + 60000,
    );
    await expect(api.retryOfflinePocketWork(operation)).rejects.toThrow(
      "not eligible",
    );
    jest.spyOn(Date, "now").mockReturnValue(Date.now() + 120000);
    const retried = await api.retryOfflinePocketWork(operation);
    expect(retried.operationVersion).toBe(operation.operationVersion + 1);
    await expect(api.completeOfflinePocketWork(operation)).rejects.toThrow(
      "no longer current",
    );
    await api.startOfflinePocketWork(retried);
    expect(await api.getOfflinePocketControl(context, 21)).toMatchObject({
      workStatus: "running",
      attempts: 2,
      nextRetryAt: null,
    });
  });

  it("recovers interrupted running work after reopening while leaving suppressed work invalidated", async () => {
    const context = await api.captureOfflinePocketContext();
    const old = await api.enqueueConfirmedPocketSave(context, 21);
    await api.startOfflinePocketWork(old);
    reopenRepository();
    const reopened = await api.captureOfflinePocketContext();
    await api.recoverOfflinePocketWork(reopened);
    const recovered = await api.getOfflinePocketOperation(reopened, 21);
    expect(recovered?.operationVersion).toBe(old.operationVersion + 1);
    await expect(api.completeOfflinePocketWork(old)).rejects.toThrow(
      "no longer current",
    );
    await api.clearOfflinePocketControlState(reopened);
    const cleared = await api.captureOfflinePocketContext();
    await api.recoverOfflinePocketWork(cleared);
    expect(await api.getOfflinePocketOperation(cleared, 21)).toBeNull();
  });

  it("rolls back failed clearing and lets subsequent transactions recover", async () => {
    const context = await api.captureOfflinePocketContext();
    await api.enqueueConfirmedPocketSave(context, 21);
    mockFailSql = "UPDATE offline_pocket_controls SET";
    await expect(api.clearOfflinePocketControlState(context)).rejects.toThrow(
      "Write failed",
    );
    expect(await api.captureOfflinePocketContext()).toEqual(context);
    expect(await api.getOfflinePocketControl(context, 21)).toMatchObject({
      intent: "automatic",
    });
    await expect(
      api.clearOfflinePocketControlState(context),
    ).resolves.toMatchObject({
      clearGeneration: 1,
    });
  });

  it("rolls back a delayed write if logout and same-user relogin replace its session", async () => {
    const context = await api.captureOfflinePocketContext();
    const started = deferred();
    const release = deferred();
    mockPause = {
      sql: "INSERT INTO offline_pocket_controls",
      started: started.resolve,
      release: release.promise,
    };
    const writing = api
      .enqueueConfirmedPocketSave(context, 21)
      .catch((error: unknown) => error);
    await started.promise;
    session.invalidateAuthSession();
    auth.getState().clearUser();
    signIn();
    release.resolve();
    expect(await writing).toEqual(expect.any(Error));
    const current = await api.captureOfflinePocketContext();
    expect(await api.listOfflinePocketControls(current)).toEqual([]);
    await expect(api.listOfflinePocketControls(context)).rejects.toThrow(
      "Sign in",
    );
  });

  it("rejects unauthenticated local-only guidance access and invalid identifiers", async () => {
    auth.getState().clearUser();
    const offline = jest.requireActual<
      typeof import("@/features/offline-routes/stores/offlineAccess.store")
    >("@/features/offline-routes/stores/offlineAccess.store");
    offline.useOfflineAccessStore.setState({ ownerId: 7 });
    await expect(api.captureOfflinePocketContext()).rejects.toThrow();
    expect(mockOpenedNames).toEqual([]);
    signIn();
    const context = await api.captureOfflinePocketContext();
    await expect(api.enqueueConfirmedPocketSave(context, -1)).rejects.toThrow(
      "Invalid",
    );
    await expect(api.enqueueConfirmedPocketSave(context, 1.5)).rejects.toThrow(
      "Invalid",
    );
  });

  async function runningSnapshot(id = 21) {
    const context = await api.captureOfflinePocketContext();
    const operation = await api.enqueueConfirmedPocketSave(context, id);
    await api.startOfflinePocketWork(operation);
    await api.publishOfflineBusinessSnapshot(operation, snapshotFixture(id));
    return { context, operation };
  }

  it("upgrades version one while preserving suppression and control records", async () => {
    const context = await api.captureOfflinePocketContext();
    await api.enqueueConfirmedPocketSave(context, 21);
    await api.clearOfflinePocketControlState(context);
    nativeDatabase().exec(
      "DROP TABLE offline_business_snapshots; PRAGMA user_version = 1",
    );
    reopenRepository();
    const current = await api.captureOfflinePocketContext();
    expect(current.clearGeneration).toBe(1);
    expect(await api.getOfflinePocketControl(current, 21)).toMatchObject({
      intent: "suppressed",
    });
    expect(await api.listOfflineBusinessSnapshots(current)).toEqual([]);
    expect(nativeDatabase().prepare("PRAGMA user_version").get()).toEqual({
      user_version: 2,
    });
  });

  it("rolls back the version two migration and retries without resetting version one", async () => {
    const context = await api.captureOfflinePocketContext();
    await api.enqueueConfirmedPocketSave(context, 21);
    nativeDatabase().exec(
      "DROP TABLE offline_business_snapshots; PRAGMA user_version = 1",
    );
    reopenRepository();
    mockFailSnapshotMigration = true;
    await expect(api.captureOfflinePocketContext()).rejects.toThrow(
      "Snapshot migration failed",
    );
    const probe = new sqlite.DatabaseSync(databasePath);
    expect(probe.prepare("PRAGMA user_version").get()).toEqual({
      user_version: 1,
    });
    expect(
      probe
        .prepare(
          "SELECT name FROM sqlite_master WHERE name = 'offline_business_snapshots'",
        )
        .get(),
    ).toBeUndefined();
    probe.close();
    const current = await api.captureOfflinePocketContext();
    expect(await api.getOfflinePocketControl(current, 21)).toMatchObject({
      intent: "automatic",
    });
    expect(await api.listOfflineBusinessSnapshots(current)).toEqual([]);
  });

  it("round trips a snapshot after reopening and keeps freshness separate from work", async () => {
    const { context } = await runningSnapshot();
    expect(await api.getOfflinePocketControl(context, 21)).toMatchObject({
      workStatus: "running",
      cachedAt: Date.parse(snapshotFixture().fetchedAt),
      lastCompletedAt: null,
    });
    reopenRepository();
    const current = await api.captureOfflinePocketContext();
    expect(await api.getOfflineBusinessSnapshot(current, 21)).toEqual({
      status: "available",
      businessId: 21,
      snapshot: snapshotFixture(),
    });
    expect(await api.listOfflineBusinessSnapshots(current)).toHaveLength(1);
    const script =
      "const {DatabaseSync}=require('node:sqlite'); const db=new DatabaseSync(process.argv[1]); console.log(db.prepare('SELECT COUNT(*) AS count FROM offline_business_snapshots').get().count); db.close();";
    expect(
      execFileSync(process.execPath, ["-e", script, databasePath], {
        encoding: "utf8",
      }).trim(),
    ).toBe("1");
  });

  it("atomically replaces the same business, rejects older fetches, and preserves valid data on failure", async () => {
    const { context, operation } = await runningSnapshot();
    const replacement = snapshotFixture(21, "2026-10-23T01:00:00Z");
    replacement.business.business_name = "Updated cafe";
    await api.publishOfflineBusinessSnapshot(operation, replacement);
    expect(await api.listOfflineBusinessSnapshots(context)).toHaveLength(1);
    await expect(
      api.publishOfflineBusinessSnapshot(operation, snapshotFixture()),
    ).rejects.toThrow("older fetch");
    await expect(
      api.publishOfflineBusinessSnapshot(operation, {
        ...replacement,
        business: { ...replacement.business, business_name: undefined },
      }),
    ).rejects.toThrow();
    mockFailSql = "UPDATE offline_pocket_controls SET cached_at";
    await expect(
      api.publishOfflineBusinessSnapshot(
        operation,
        snapshotFixture(21, "2026-10-24T00:00:00Z"),
      ),
    ).rejects.toThrow("Write failed");
    expect(await api.getOfflineBusinessSnapshot(context, 21)).toMatchObject({
      snapshot: replacement,
    });
    expect(await api.getOfflinePocketControl(context, 21)).toMatchObject({
      cachedAt: Date.parse(replacement.fetchedAt),
    });
  });

  it("retains a usable snapshot through pending, failed, retried and recovered refreshes", async () => {
    const { context, operation } = await runningSnapshot();
    await api.completeOfflinePocketWork(operation);
    const refresh = await api.requestOfflinePocketRestore(context, 21);
    expect(await api.getOfflineBusinessSnapshot(context, 21)).toMatchObject({
      status: "available",
    });
    await expect(
      api.publishOfflineBusinessSnapshot(operation, snapshotFixture()),
    ).rejects.toThrow();
    await api.startOfflinePocketWork(refresh);
    await api.failOfflinePocketWork(refresh, "FETCH_FAILED", 0);
    expect(await api.getOfflineBusinessSnapshot(context, 21)).toMatchObject({
      status: "available",
    });
    const retry = await api.retryOfflinePocketWork(refresh);
    await api.startOfflinePocketWork(retry);
    await api.recoverOfflinePocketWork(context);
    await expect(
      api.publishOfflineBusinessSnapshot(retry, snapshotFixture()),
    ).rejects.toThrow();
    expect(await api.getOfflineBusinessSnapshot(context, 21)).toMatchObject({
      status: "available",
    });
  });

  it("never infers snapshot availability or enqueues work from local reads", async () => {
    const context = await api.captureOfflinePocketContext();
    expect(await api.getOfflineBusinessSnapshot(context, 21)).toMatchObject({
      status: "missing",
    });
    expect(await api.listOfflinePocketControls(context)).toEqual([]);
    const operation = await api.enqueueConfirmedPocketSave(context, 21);
    await expect(
      api.publishOfflineBusinessSnapshot(operation, snapshotFixture()),
    ).rejects.toThrow("running");
    await api.startOfflinePocketWork(operation);
    await api.completeOfflinePocketWork(operation);
    expect(await api.getOfflineBusinessSnapshot(context, 21)).toMatchObject({
      status: "missing",
    });
    expect(await api.listOfflineBusinessSnapshots(context)).toEqual([]);
    await expect(
      api.publishOfflineBusinessSnapshot(operation, snapshotFixture()),
    ).rejects.toThrow("running");
  });

  it.each([
    ["snapshot = '{'", "corrupt"],
    ["format_version = 99", "unsupported"],
    ["snapshot = '{\"formatVersion\":99}'", "unsupported"],
    ["snapshot = '{\"formatVersion\":1}'", "corrupt"],
    ["fetched_at = 1", "corrupt"],
  ])(
    "reports damaged rows (%s), retains healthy rows, and permits explicit cleanup",
    async (assignment, status) => {
      const { context, operation } = await runningSnapshot();
      await runningSnapshot(22);
      nativeDatabase().exec(
        `UPDATE offline_business_snapshots SET ${assignment} WHERE business_id = 21`,
      );
      expect(await api.getOfflineBusinessSnapshot(context, 21)).toEqual({
        businessId: 21,
        status,
        snapshot: null,
      });
      expect(await api.listOfflineBusinessSnapshots(context)).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ businessId: 21, status }),
          expect.objectContaining({ businessId: 22, status: "available" }),
        ]),
      );
      await api.removeOfflineBusinessSnapshot(context, 21);
      expect(await api.getOfflineBusinessSnapshot(context, 21)).toMatchObject({
        status: "missing",
      });
      expect(
        nativeDatabase()
          .prepare(
            "SELECT * FROM offline_business_snapshots WHERE business_id = 21",
          )
          .get(),
      ).toBeUndefined();
      await expect(
        api.publishOfflineBusinessSnapshot(operation, snapshotFixture()),
      ).rejects.toThrow();
      expect(await api.getOfflinePocketControl(context, 21)).toMatchObject({
        intent: "suppressed",
      });
    },
  );

  it("rejects mismatched business identity and identifies stored identity corruption", async () => {
    const { context, operation } = await runningSnapshot();
    await expect(
      api.publishOfflineBusinessSnapshot(operation, snapshotFixture(22)),
    ).rejects.toThrow("does not match");
    nativeDatabase()
      .prepare(
        "UPDATE offline_business_snapshots SET snapshot = ? WHERE business_id = 21",
      )
      .run(JSON.stringify(snapshotFixture(22)));
    expect(await api.getOfflineBusinessSnapshot(context, 21)).toMatchObject({
      status: "corrupt",
    });
    await api.publishOfflineBusinessSnapshot(operation, snapshotFixture());
    expect(await api.getOfflineBusinessSnapshot(context, 21)).toMatchObject({
      status: "available",
    });
  });

  it("isolates reads, publication, individual removal and clearing across accounts and API scopes", async () => {
    const { context, operation } = await runningSnapshot();
    signIn(8);
    const other = await api.captureOfflinePocketContext();
    expect(await api.getOfflineBusinessSnapshot(other, 21)).toMatchObject({
      status: "missing",
    });
    await expect(
      api.publishOfflineBusinessSnapshot(operation, snapshotFixture()),
    ).rejects.toThrow("Sign in");
    await runningSnapshot();
    await api.removeOfflineBusinessSnapshot(other, 21);
    signIn(7);
    mockApiScope = "https://api-b.example";
    const scopeB = await api.captureOfflinePocketContext();
    expect(await api.listOfflineBusinessSnapshots(scopeB)).toEqual([]);
    await expect(api.listOfflineBusinessSnapshots(context)).rejects.toThrow(
      "Sign in",
    );
    await runningSnapshot();
    await api.clearOfflinePocketControlState(scopeB);
    mockApiScope = "https://api-a.example";
    const original = await api.captureOfflinePocketContext();
    expect(await api.getOfflineBusinessSnapshot(original, 21)).toMatchObject({
      status: "available",
    });
  });

  it("deletes snapshots and persists suppression after clearing and reopening", async () => {
    const { context, operation } = await runningSnapshot();
    const cleared = await api.clearOfflinePocketControlState(context);
    expect(await api.listOfflineBusinessSnapshots(cleared)).toEqual([]);
    expect(
      nativeDatabase()
        .prepare("SELECT COUNT(*) AS count FROM offline_business_snapshots")
        .get(),
    ).toEqual({ count: 0 });
    await expect(
      api.publishOfflineBusinessSnapshot(operation, snapshotFixture()),
    ).rejects.toThrow();
    reopenRepository();
    const current = await api.captureOfflinePocketContext();
    expect(await api.getOfflineBusinessSnapshot(current, 21)).toMatchObject({
      status: "missing",
    });
    expect(await api.getOfflinePocketOperation(current, 21)).toBeNull();
    const restore = await api.requestOfflinePocketRestore(current, 21);
    await api.startOfflinePocketWork(restore);
    await api.publishOfflineBusinessSnapshot(restore, snapshotFixture());
    expect(await api.getOfflineBusinessSnapshot(current, 21)).toMatchObject({
      status: "available",
    });
  });

  it.each([true, false])(
    "serializes clear versus publication (clear first: %s)",
    async (clearFirst) => {
      const context = await api.captureOfflinePocketContext();
      const operation = await api.enqueueConfirmedPocketSave(context, 21);
      await api.startOfflinePocketWork(operation);
      if (clearFirst) {
        const clearing = api.clearOfflinePocketControlState(context);
        const publishing = api.publishOfflineBusinessSnapshot(
          operation,
          snapshotFixture(),
        );
        const results = await Promise.allSettled([clearing, publishing]);
        expect(results.map((result) => result.status)).toEqual([
          "fulfilled",
          "rejected",
        ]);
      } else {
        const publishing = api.publishOfflineBusinessSnapshot(
          operation,
          snapshotFixture(),
        );
        const clearing = api.clearOfflinePocketControlState(context);
        await Promise.all([publishing, clearing]);
      }
      const current = await api.captureOfflinePocketContext();
      expect(await api.listOfflineBusinessSnapshots(current)).toEqual([]);
      expect(await api.getOfflinePocketControl(current, 21)).toMatchObject({
        intent: "suppressed",
      });
    },
  );

  it("rolls back a failed clear together with snapshot deletion and allows retry", async () => {
    const { context } = await runningSnapshot();
    mockFailSql = "DELETE FROM offline_business_snapshots";
    await expect(api.clearOfflinePocketControlState(context)).rejects.toThrow(
      "Write failed",
    );
    expect(await api.captureOfflinePocketContext()).toEqual(context);
    expect(await api.getOfflineBusinessSnapshot(context, 21)).toMatchObject({
      status: "available",
    });
    const current = await api.clearOfflinePocketControlState(context);
    expect(await api.listOfflineBusinessSnapshots(current)).toEqual([]);
  });

  it("hides residual invalidated rows even before explicit deletion", async () => {
    const { context } = await runningSnapshot();
    nativeDatabase().exec(
      "UPDATE offline_pocket_controls SET cache_intent = 'suppressed', work_status = 'invalidated'",
    );
    expect(await api.getOfflineBusinessSnapshot(context, 21)).toMatchObject({
      status: "missing",
    });
    await api.removeOfflineBusinessSnapshot(context, 21);
    expect(
      nativeDatabase()
        .prepare("SELECT COUNT(*) AS count FROM offline_business_snapshots")
        .get(),
    ).toEqual({ count: 0 });
  });

  it("keeps generation-mismatched residual snapshots hidden after restoration", async () => {
    const { context } = await runningSnapshot();
    const cleared = await api.clearOfflinePocketControlState(context);
    await api.requestOfflinePocketRestore(cleared, 21);
    nativeDatabase()
      .prepare(
        `INSERT INTO offline_business_snapshots
      (api_scope, owner_id, business_id, clear_generation, format_version, fetched_at, snapshot)
      VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        cleared.apiScope,
        cleared.ownerId,
        21,
        context.clearGeneration,
        1,
        Date.parse(snapshotFixture().fetchedAt),
        JSON.stringify(snapshotFixture()),
      );
    expect(await api.getOfflineBusinessSnapshot(cleared, 21)).toMatchObject({
      status: "missing",
    });
    expect(await api.listOfflineBusinessSnapshots(cleared)).toEqual([]);
    await api.removeOfflineBusinessSnapshot(cleared, 21);
  });

  it("rolls back failed individual removal and invalidates an active refresh on successful removal", async () => {
    const { context, operation } = await runningSnapshot();
    mockFailSql = "DELETE FROM offline_business_snapshots";
    await expect(
      api.removeOfflineBusinessSnapshot(context, 21),
    ).rejects.toThrow("Write failed");
    expect(await api.getOfflineBusinessSnapshot(context, 21)).toMatchObject({
      status: "available",
    });
    await api.publishOfflineBusinessSnapshot(operation, snapshotFixture());
    await api.removeOfflineBusinessSnapshot(context, 21);
    await expect(
      api.publishOfflineBusinessSnapshot(operation, snapshotFixture()),
    ).rejects.toThrow();
    expect(await api.getOfflineBusinessSnapshot(context, 21)).toMatchObject({
      status: "missing",
    });
  });

  it("rolls back delayed publication across logout and same-user login without deleting valid data", async () => {
    const { operation } = await runningSnapshot();
    const started = deferred();
    const release = deferred();
    mockPause = {
      sql: "INSERT INTO offline_business_snapshots",
      started: started.resolve,
      release: release.promise,
    };
    const publishing = api
      .publishOfflineBusinessSnapshot(
        operation,
        snapshotFixture(21, "2026-10-23T00:00:00Z"),
      )
      .catch((error: unknown) => error);
    await started.promise;
    session.invalidateAuthSession();
    auth.getState().clearUser();
    signIn();
    release.resolve();
    expect(await publishing).toEqual(expect.any(Error));
    const current = await api.captureOfflinePocketContext();
    expect(await api.getOfflineBusinessSnapshot(current, 21)).toMatchObject({
      snapshot: snapshotFixture(),
    });
    await expect(
      api.publishOfflineBusinessSnapshot(operation, snapshotFixture()),
    ).rejects.toThrow("Sign in");
  });

  function cacheBusiness() {
    return jest.requireActual<typeof import("../offlinePocketWorker.service")>(
      "../offlinePocketWorker.service",
    ).cacheOfflinePocketBusiness;
  }

  it("caches a pending business with fresh membership checks and completion", async () => {
    const context = await api.captureOfflinePocketContext();
    const operation = await api.enqueueConfirmedPocketSave(context, 21);
    await cacheBusiness()(operation, () => true);
    expect(mockGetMemberships).toHaveBeenCalledTimes(2);
    expect(mockGetDetail).toHaveBeenCalledTimes(1);
    expect(await api.getOfflineBusinessSnapshot(context, 21)).toMatchObject({
      status: "available",
    });
    expect(await api.getOfflinePocketControl(context, 21)).toMatchObject({
      workStatus: "completed",
      attempts: 1,
    });
  });

  it.each([
    "NETWORK_ERROR",
    "REQUEST_TIMEOUT",
    "UNKNOWN_ERROR",
    "RATE_LIMIT_EXCEEDED",
  ])(
    "retries transient %s with a new revision and bounded backoff",
    async (code) => {
      const context = await api.captureOfflinePocketContext();
      const operation = await api.enqueueConfirmedPocketSave(context, 21);
      mockGetDetail.mockResolvedValueOnce({ success: false, code });
      await cacheBusiness()(operation, () => true);
      const control = await api.getOfflinePocketControl(context, 21);
      expect(control).toMatchObject({
        workStatus: "failed",
        lastErrorCode: code,
      });
      expect(control?.nextRetryAt).toBeGreaterThan(Date.now());
      jest.spyOn(Date, "now").mockReturnValue(control!.nextRetryAt!);
      const retry = await api.retryOfflinePocketWork(operation);
      expect(retry.operationVersion).toBeGreaterThan(
        operation.operationVersion,
      );
      await cacheBusiness()(retry, () => true);
      expect(await api.getOfflinePocketControl(context, 21)).toMatchObject({
        workStatus: "completed",
        attempts: 2,
      });
      const { offlinePocketRetryAt } = jest.requireActual<
        typeof import("../offlinePocketWorker.service")
      >("../offlinePocketWorker.service");
      expect(offlinePocketRetryAt(1, 0)).toBe(5000);
      expect(offlinePocketRetryAt(4, 0)).toBe(40000);
      expect(offlinePocketRetryAt(5, 0)).toBeNull();
    },
  );

  it.each(["NOT_FOUND", "PERMISSION_DENIED", "VALIDATION_ERROR"])(
    "does not infer removal or retry permanently failed detail requests (%s)",
    async (code) => {
      const { context, operation } = await runningSnapshot();
      await api.completeOfflinePocketWork(operation);
      const refresh = await api.requestOfflinePocketRestore(context, 21);
      mockGetDetail.mockResolvedValue({ success: false, code });
      await cacheBusiness()(refresh, () => true);
      expect(await api.getOfflinePocketControl(context, 21)).toMatchObject({
        workStatus: "failed",
        intent: "restore",
        nextRetryAt: null,
      });
      expect(await api.getOfflineBusinessSnapshot(context, 21)).toMatchObject({
        status: "available",
      });
    },
  );

  it("preserves valid data and permanently fails invalid business responses", async () => {
    const { context, operation } = await runningSnapshot();
    await api.completeOfflinePocketWork(operation);
    const refresh = await api.requestOfflinePocketRestore(context, 21);
    mockGetDetail.mockResolvedValue({ success: true, data: { id: 21 } });
    await cacheBusiness()(refresh, () => true);
    expect(await api.getOfflinePocketControl(context, 21)).toMatchObject({
      workStatus: "failed",
      lastErrorCode: "INVALID_RESPONSE",
      nextRetryAt: null,
    });
    expect(await api.getOfflineBusinessSnapshot(context, 21)).toMatchObject({
      snapshot: snapshotFixture(),
    });
  });

  it.each([1, 2])(
    "invalidates only a current job when membership is absent at check %s",
    async (check) => {
      const context = await api.captureOfflinePocketContext();
      const operation = await api.enqueueConfirmedPocketSave(context, 21);
      if (check === 2) {
        mockGetMemberships.mockResolvedValueOnce({
          success: true,
          data: { business_id: 21, pocket_ids: [1], is_pocketed: true },
        });
      }
      mockGetMemberships.mockResolvedValue({
        success: true,
        data: { business_id: 21, pocket_ids: [], is_pocketed: false },
      });
      await cacheBusiness()(operation, () => true);
      expect(await api.getOfflinePocketControl(context, 21)).toMatchObject({
        intent: "suppressed",
        workStatus: "invalidated",
      });
      expect(await api.getOfflineBusinessSnapshot(context, 21)).toMatchObject({
        status: "missing",
      });
      expect(mockGetDetail).toHaveBeenCalledTimes(check - 1);
    },
  );

  it("does not treat ambiguous membership failures as removal", async () => {
    const { context, operation } = await runningSnapshot();
    await api.completeOfflinePocketWork(operation);
    const refresh = await api.requestOfflinePocketRestore(context, 21);
    mockGetMemberships.mockResolvedValue({
      success: false,
      code: "NETWORK_ERROR",
    });
    await cacheBusiness()(refresh, () => true);
    expect(mockGetDetail).not.toHaveBeenCalled();
    expect(await api.getOfflinePocketControl(context, 21)).toMatchObject({
      intent: "restore",
      workStatus: "failed",
    });
    expect(await api.getOfflineBusinessSnapshot(context, 21)).toMatchObject({
      status: "available",
    });
  });

  it.each(["logout", "switch", "same-user", "clear", "revision"])(
    "rejects active-request publication after %s",
    async (change) => {
      const context = await api.captureOfflinePocketContext();
      const operation = await api.enqueueConfirmedPocketSave(context, 21);
      const started = deferred();
      const release = deferred();
      mockGetDetail.mockImplementationOnce(async () => {
        started.resolve();
        await release.promise;
        return { success: true, data: businessFixture() };
      });
      const caching = cacheBusiness()(operation, () => true).catch(
        (error: unknown) => error,
      );
      await started.promise;
      if (change === "clear") {
        await api.clearOfflinePocketControlState(context);
      } else if (change === "revision") {
        await api.recoverOfflinePocketWork(context);
      } else {
        session.invalidateAuthSession();
        auth.getState().clearUser();
        if (change !== "logout") {
          signIn(change === "switch" ? 8 : 7);
        }
      }
      release.resolve();
      expect(await caching).toEqual(expect.any(Error));
      expect(
        nativeDatabase()
          .prepare("SELECT COUNT(*) AS count FROM offline_business_snapshots")
          .get(),
      ).toEqual({ count: 0 });
      expect(mockGetMemberships).toHaveBeenCalledTimes(1);
    },
  );

  it("recovers interrupted running work after restart and rejects its old token", async () => {
    const context = await api.captureOfflinePocketContext();
    const previous = await api.enqueueConfirmedPocketSave(context, 21);
    await api.startOfflinePocketWork(previous);
    reopenRepository();
    const current = await api.captureOfflinePocketContext();
    await api.recoverOfflinePocketWork(current);
    const recovered = await api.getOfflinePocketOperation(current, 21);
    expect(recovered!.operationVersion).toBeGreaterThan(
      previous.operationVersion,
    );
    await expect(
      api.assertOfflinePocketWorkCurrent(previous),
    ).rejects.toThrow();
    await cacheBusiness()(recovered!, () => true);
    expect(await api.getOfflineBusinessSnapshot(current, 21)).toMatchObject({
      status: "available",
    });
  });

  it("rejects stale membership invalidation after a newer restoration revision", async () => {
    const { context, operation } = await runningSnapshot();
    await api.completeOfflinePocketWork(operation);
    const next = await api.requestOfflinePocketRestore(context, 21);
    await expect(api.invalidateOfflinePocketWork(operation)).rejects.toThrow();
    expect(await api.getOfflinePocketOperation(context, 21)).toEqual(next);
    expect(await api.getOfflineBusinessSnapshot(context, 21)).toMatchObject({
      status: "available",
    });
  });

  it("claims once across duplicate worker invocations and refuses suppressed jobs", async () => {
    const context = await api.captureOfflinePocketContext();
    const operation = await api.enqueueConfirmedPocketSave(context, 21);
    const results = await Promise.allSettled([
      cacheBusiness()(operation, () => true),
      cacheBusiness()(operation, () => true),
    ]);
    expect(results.map((result) => result.status).sort()).toEqual([
      "fulfilled",
      "rejected",
    ]);
    expect(mockGetDetail).toHaveBeenCalledTimes(1);
    await api.removeOfflineBusinessSnapshot(context, 21);
    await expect(cacheBusiness()(operation, () => true)).rejects.toThrow();
    expect(mockGetDetail).toHaveBeenCalledTimes(1);
  });

  it("stops network steps and publication when foreground execution is interrupted", async () => {
    const context = await api.captureOfflinePocketContext();
    const operation = await api.enqueueConfirmedPocketSave(context, 21);
    let active = true;
    mockGetDetail.mockImplementationOnce(async () => {
      active = false;
      return { success: true, data: businessFixture() };
    });
    await cacheBusiness()(operation, () => active);
    expect(mockGetMemberships).toHaveBeenCalledTimes(1);
    expect(await api.getOfflineBusinessSnapshot(context, 21)).toMatchObject({
      status: "missing",
    });
    expect(await api.getOfflinePocketControl(context, 21)).toMatchObject({
      workStatus: "failed",
      lastErrorCode: "INTERRUPTED",
    });
  });

  it("retries ambiguous non-envelope server failures without invalidating membership", async () => {
    const context = await api.captureOfflinePocketContext();
    const operation = await api.enqueueConfirmedPocketSave(context, 21);
    mockGetDetail.mockResolvedValue("<html>502 Bad Gateway</html>");
    await cacheBusiness()(operation, () => true);
    const row = await api.getOfflinePocketControl(context, 21);
    expect(row).toMatchObject({
      workStatus: "failed",
      intent: "automatic",
      lastErrorCode: "UNKNOWN_ERROR",
    });
    expect(row?.nextRetryAt).not.toBeNull();
  });

  it("keeps foreground interruptions retryable beyond the API-failure attempt limit", async () => {
    const context = await api.captureOfflinePocketContext();
    const operation = await api.enqueueConfirmedPocketSave(context, 21);
    nativeDatabase().exec("UPDATE offline_pocket_controls SET attempts = 5");
    await cacheBusiness()(operation, () => false);
    const row = await api.getOfflinePocketControl(context, 21);
    expect(row).toMatchObject({
      workStatus: "failed",
      lastErrorCode: "INTERRUPTED",
    });
    expect(row?.nextRetryAt).not.toBeNull();
    expect(mockGetDetail).not.toHaveBeenCalled();
  });

  it("cancels an in-flight API request and prevents publication", async () => {
    const context = await api.captureOfflinePocketContext();
    const operation = await api.enqueueConfirmedPocketSave(context, 21);
    const controller = new AbortController();
    const started = deferred();
    mockGetDetail.mockImplementationOnce(async (_id, signal: AbortSignal) => {
      started.resolve();
      return new Promise((resolve) => {
        signal.addEventListener("abort", () =>
          resolve({ success: false, code: "NETWORK_ERROR" }),
        );
      });
    });
    const caching = cacheBusiness()(
      operation,
      () => !controller.signal.aborted,
      controller.signal,
    );
    await started.promise;
    controller.abort();
    await caching;
    expect(await api.getOfflineBusinessSnapshot(context, 21)).toMatchObject({
      status: "missing",
    });
    expect(await api.getOfflinePocketControl(context, 21)).toMatchObject({
      workStatus: "failed",
      lastErrorCode: "INTERRUPTED",
    });
  });

  it.each([
    { business_id: 22, pocket_ids: [], is_pocketed: false },
    { business_id: 21, pocket_ids: [1], is_pocketed: false },
  ])(
    "does not invalidate data for malformed membership responses %j",
    async (data) => {
      const context = await api.captureOfflinePocketContext();
      const operation = await api.enqueueConfirmedPocketSave(context, 21);
      mockGetMemberships.mockResolvedValue({ success: true, data });
      await cacheBusiness()(operation, () => true);
      expect(await api.getOfflinePocketControl(context, 21)).toMatchObject({
        workStatus: "failed",
        intent: "automatic",
        nextRetryAt: null,
      });
      expect(mockGetDetail).not.toHaveBeenCalled();
    },
  );

  function integration() {
    return jest.requireActual<
      typeof import("@/features/pockets/services/pocketOfflineMemberships.service")
    >("@/features/pockets/services/pocketOfflineMemberships.service");
  }

  async function settleLocal() {
    for (let step = 0; step < 200; step += 1) {
      await Promise.resolve();
    }
  }

  function saved(ids: number[], businessId = 21) {
    return {
      success: true,
      data: {
        business_id: businessId,
        pocket_ids: ids,
        is_pocketed: ids.length > 0,
      },
    };
  }

  it("enqueues a confirmed first aggregate save and wakes the worker without fetching details", async () => {
    const service = integration();
    const change = service.preparePocketOfflineChange(7);
    mockGetMemberships.mockResolvedValue(saved([]));
    expect(
      (await service.replacePocketMembershipsWithOffline(change, 21, [1]))
        .success,
    ).toBe(true);
    await settleLocal();
    const context = await api.captureOfflinePocketContext();
    expect(await api.getOfflinePocketControl(context, 21)).toMatchObject({
      intent: "automatic",
      workStatus: "pending",
    });
    expect(mockSync).toHaveBeenCalledTimes(1);
    expect(mockGetDetail).not.toHaveBeenCalled();
  });

  it.each(["capture", "enqueue"])(
    "keeps backend success successful when local %s fails",
    async (failure) => {
      const service = integration();
      if (failure === "capture") {
        mockFailSql = "INSERT OR IGNORE INTO offline_pocket_accounts";
      }
      const change = service.preparePocketOfflineChange(7);
      mockGetMemberships.mockResolvedValue(saved([]));
      if (failure === "enqueue") {
        mockFailSql = "INSERT INTO offline_pocket_controls";
      }
      expect(
        (await service.replacePocketMembershipsWithOffline(change, 21, [1]))
          .success,
      ).toBe(true);
      await settleLocal();
      expect(mockReplaceMemberships).toHaveBeenCalledTimes(1);
      expect(mockSync).not.toHaveBeenCalled();
      const current = await api.captureOfflinePocketContext();
      expect(await api.listOfflinePocketControls(current)).toEqual([]);
    },
  );

  it.each([[1], [1, 2], [2, 1]].map((selection) => [selection]))(
    "preserves suppression for already saved selection %j",
    async (selection) => {
      const context = await api.captureOfflinePocketContext();
      await api.enqueueConfirmedPocketSave(context, 21);
      const cleared = await api.clearOfflinePocketControlState(context);
      const service = integration();
      mockGetMemberships.mockResolvedValue(saved([1]));
      mockReplaceMemberships.mockResolvedValue(saved(selection));
      await service.replacePocketMembershipsWithOffline(
        service.preparePocketOfflineChange(7),
        21,
        selection,
      );
      await settleLocal();
      expect(await api.getOfflinePocketControl(cleared, 21)).toMatchObject({
        intent: "suppressed",
        workStatus: "invalidated",
      });
      expect(mockSync).not.toHaveBeenCalled();
      expect(
        (await api.requestOfflinePocketRestore(cleared, 21)).operationVersion,
      ).toBeGreaterThan(1);
    },
  );

  it("preserves cache when another membership remains and deletes it after final removal", async () => {
    const { context, operation } = await runningSnapshot();
    const service = integration();
    mockRemoveMembership.mockResolvedValueOnce(saved([2]));
    await service.removePocketBusinessWithOffline(
      service.preparePocketOfflineChange(7),
      1,
      21,
    );
    await settleLocal();
    expect(await api.getOfflineBusinessSnapshot(context, 21)).toMatchObject({
      status: "available",
    });
    await service.removePocketBusinessWithOffline(
      service.preparePocketOfflineChange(7),
      2,
      21,
    );
    await settleLocal();
    expect(await api.getOfflineBusinessSnapshot(context, 21)).toMatchObject({
      status: "missing",
    });
    await expect(
      api.publishOfflineBusinessSnapshot(operation, snapshotFixture()),
    ).rejects.toThrow();
    expect(await api.getOfflinePocketControl(context, 21)).toMatchObject({
      intent: "suppressed",
    });
    expect(mockSync).not.toHaveBeenCalled();
  });

  it("allows a genuinely new save after confirmed removal of a suppressed business", async () => {
    const context = await api.captureOfflinePocketContext();
    await api.enqueueConfirmedPocketSave(context, 21);
    const cleared = await api.clearOfflinePocketControlState(context);
    const service = integration();
    await service.removePocketBusinessWithOffline(
      service.preparePocketOfflineChange(7),
      1,
      21,
    );
    await settleLocal();
    mockGetMemberships.mockResolvedValue(saved([]));
    await service.replacePocketMembershipsWithOffline(
      service.preparePocketOfflineChange(7),
      21,
      [2],
    );
    await settleLocal();
    expect(await api.getOfflinePocketControl(cleared, 21)).toMatchObject({
      intent: "automatic",
      workStatus: "pending",
    });
    expect(mockSync).toHaveBeenCalledTimes(1);
  });

  it("does not auto-cache when previous aggregate status is unknown", async () => {
    const service = integration();
    mockGetMemberships.mockResolvedValue({
      success: false,
      code: "NETWORK_ERROR",
    });
    expect(
      (
        await service.replacePocketMembershipsWithOffline(
          service.preparePocketOfflineChange(7),
          21,
          [1],
        )
      ).success,
    ).toBe(true);
    await settleLocal();
    const context = await api.captureOfflinePocketContext();
    expect(await api.listOfflinePocketControls(context)).toEqual([]);
    expect(mockSync).not.toHaveBeenCalled();
  });

  it.each(["NETWORK_ERROR", "REQUEST_TIMEOUT"])(
    "reconciles %s without replaying a complete selection",
    async (code) => {
      const service = integration();
      mockGetMemberships
        .mockResolvedValueOnce(saved([]))
        .mockResolvedValueOnce(saved([9]));
      mockReplaceMemberships.mockResolvedValue({ success: false, code });
      const response = await service.replacePocketMembershipsWithOffline(
        service.preparePocketOfflineChange(7),
        21,
        [1],
      );
      expect(response).toMatchObject({ success: false, code });
      await settleLocal();
      expect(mockReplaceMemberships).toHaveBeenCalledTimes(1);
      expect(mockReplaceMemberships).toHaveBeenCalledWith(21, [1]);
      expect(mockGetMemberships).toHaveBeenCalledTimes(2);
      const context = await api.captureOfflinePocketContext();
      expect(await api.getOfflinePocketControl(context, 21)).toMatchObject({
        intent: "automatic",
      });
    },
  );

  it("preserves cache when both a removal outcome and its authoritative read are unknown", async () => {
    const { context } = await runningSnapshot();
    const service = integration();
    mockRemoveMembership.mockResolvedValue({
      success: false,
      code: "REQUEST_TIMEOUT",
    });
    mockGetMemberships.mockResolvedValue({
      success: false,
      code: "NETWORK_ERROR",
    });
    expect(
      (
        await service.removePocketBusinessWithOffline(
          service.preparePocketOfflineChange(7),
          1,
          21,
        )
      ).success,
    ).toBe(false);
    await settleLocal();
    expect(await api.getOfflineBusinessSnapshot(context, 21)).toMatchObject({
      status: "available",
    });
    expect(mockRemoveMembership).toHaveBeenCalledTimes(1);
  });

  it("does not infer final removal from an incomplete success response", async () => {
    const { context } = await runningSnapshot();
    const service = integration();
    mockRemoveMembership.mockResolvedValue({
      success: true,
      data: { business_id: 21, is_pocketed: false },
    });
    mockGetMemberships.mockResolvedValue({
      success: false,
      code: "NETWORK_ERROR",
    });
    await service.removePocketBusinessWithOffline(
      service.preparePocketOfflineChange(7),
      1,
      21,
    );
    await settleLocal();
    expect(await api.getOfflineBusinessSnapshot(context, 21)).toMatchObject({
      status: "available",
    });
  });

  it.each([true, false])(
    "reconciles every local identity after collection deletion, including unloaded pages (confirmed response: %s)",
    async (confirmedDelete) => {
      const { context } = await runningSnapshot();
      await api.enqueueConfirmedPocketSave(context, 22);
      await api.enqueueConfirmedPocketSave(context, 23);
      await api.enqueueConfirmedPocketSave(context, 24);
      await api.removeOfflineBusinessSnapshot(context, 24);
      mockGetMemberships.mockImplementation(async (id) =>
        id === 23
          ? { success: false, code: "NETWORK_ERROR" }
          : saved(id === 22 ? [99] : [], id),
      );
      const service = integration();
      if (!confirmedDelete) {
        mockDeleteCollection.mockResolvedValue({
          success: false,
          code: "REQUEST_TIMEOUT",
        });
      }
      expect(
        (
          await service.deletePocketCollectionWithOffline(
            service.preparePocketOfflineChange(7),
            30,
          )
        ).success,
      ).toBe(confirmedDelete);
      await settleLocal();
      expect(mockGetMemberships.mock.calls.map(([id]) => id).sort()).toEqual([
        21, 22, 23,
      ]);
      expect(await api.getOfflinePocketControl(context, 21)).toMatchObject({
        intent: "suppressed",
      });
      expect(await api.getOfflinePocketControl(context, 22)).toMatchObject({
        intent: "automatic",
      });
      expect(await api.getOfflinePocketControl(context, 23)).toMatchObject({
        intent: "automatic",
      });
      expect(mockSync).not.toHaveBeenCalled();
    },
  );

  it("acknowledges deletion before reconciliation and orders a subsequent save afterward", async () => {
    const { context } = await runningSnapshot();
    const released = deferred();
    const reading = deferred();
    mockGetMemberships
      .mockImplementationOnce(async () => {
        reading.resolve();
        await released.promise;
        return saved([]);
      })
      .mockResolvedValue(saved([]));
    const service = integration();
    expect(
      (
        await service.deletePocketCollectionWithOffline(
          service.preparePocketOfflineChange(7),
          30,
        )
      ).success,
    ).toBe(true);
    await reading.promise;
    const saving = service.replacePocketMembershipsWithOffline(
      service.preparePocketOfflineChange(7),
      21,
      [1],
    );
    await settleLocal();
    expect(mockReplaceMemberships).not.toHaveBeenCalled();
    released.resolve();
    expect((await saving).success).toBe(true);
    await settleLocal();
    expect(await api.getOfflinePocketControl(context, 21)).toMatchObject({
      intent: "automatic",
      workStatus: "pending",
    });
  });

  it.each(["clear", "logout", "switch", "same-user", "api-scope"])(
    "rejects delayed offline save callbacks after %s",
    async (changeKind) => {
      const service = integration();
      const change = service.preparePocketOfflineChange(7);
      const context = await change.context;
      const started = deferred();
      const released = deferred();
      mockGetMemberships.mockResolvedValue(saved([]));
      mockReplaceMemberships.mockImplementationOnce(async () => {
        started.resolve();
        await released.promise;
        return saved([1]);
      });
      const saving = service.replacePocketMembershipsWithOffline(
        change,
        21,
        [1],
      );
      await started.promise;
      if (changeKind === "clear") {
        await api.clearOfflinePocketControlState(context!);
      } else if (changeKind === "api-scope") {
        mockApiScope = "https://api-b.example";
      } else {
        session.invalidateAuthSession();
        auth.getState().clearUser();
        if (changeKind !== "logout") {
          signIn(changeKind === "switch" ? 8 : 7);
        }
      }
      released.resolve();
      expect((await saving).success).toBe(true);
      await settleLocal();
      expect(
        nativeDatabase()
          .prepare("SELECT COUNT(*) AS count FROM offline_pocket_controls")
          .get(),
      ).toEqual({ count: 0 });
      expect(mockSync).not.toHaveBeenCalled();
    },
  );

  it("protects newer business revisions against delayed membership changes", async () => {
    const context = await api.captureOfflinePocketContext();
    const operation = await api.enqueueConfirmedPocketSave(context, 21);
    await api.removeOfflineBusinessSnapshot(context, 21);
    const restored = await api.requestOfflinePocketRestore(context, 21);
    await expect(
      api.applyOfflinePocketMembershipChange(
        context,
        21,
        operation.operationVersion,
        false,
        true,
      ),
    ).rejects.toThrow();
    expect(await api.getOfflinePocketOperation(context, 21)).toEqual(restored);
  });

  it("deduplicates repeated aggregate saves through fresh membership truth and one synchronization wakeup", async () => {
    const service = integration();
    mockGetMemberships
      .mockResolvedValueOnce(saved([]))
      .mockResolvedValue(saved([1]));
    const first = service.replacePocketMembershipsWithOffline(
      service.preparePocketOfflineChange(7),
      21,
      [1],
    );
    const second = service.replacePocketMembershipsWithOffline(
      service.preparePocketOfflineChange(7),
      21,
      [1, 2],
    );
    await Promise.all([first, second]);
    await settleLocal();
    const context = await api.captureOfflinePocketContext();
    expect(await api.getOfflinePocketControl(context, 21)).toMatchObject({
      operationVersion: 1,
    });
    expect(mockSync).toHaveBeenCalledTimes(1);
  });

  it("reconciles ambiguous final removal only after a complete authoritative empty selection", async () => {
    const { context } = await runningSnapshot();
    const service = integration();
    mockRemoveMembership.mockResolvedValue({
      success: false,
      code: "REQUEST_TIMEOUT",
    });
    mockGetMemberships.mockResolvedValue(saved([]));
    expect(
      (
        await service.removePocketBusinessWithOffline(
          service.preparePocketOfflineChange(7),
          1,
          21,
        )
      ).success,
    ).toBe(false);
    await settleLocal();
    expect(await api.getOfflineBusinessSnapshot(context, 21)).toMatchObject({
      status: "missing",
    });
  });

  it("does not let a late confirmed save override newer individual suppression", async () => {
    const context = await api.captureOfflinePocketContext();
    const original = await api.enqueueConfirmedPocketSave(context, 21);
    await api.removeOfflineBusinessSnapshot(context, 21);
    await expect(
      api.applyOfflinePocketMembershipChange(
        context,
        21,
        original.operationVersion,
        false,
        true,
      ),
    ).rejects.toThrow();
    expect(await api.getOfflinePocketControl(context, 21)).toMatchObject({
      intent: "suppressed",
    });
  });

  it.each([true, false])(
    "rechecks removal against a newer job revision (still saved: %s)",
    async (stillSaved) => {
      const { context, operation } = await runningSnapshot();
      const started = deferred();
      const released = deferred();
      mockRemoveMembership.mockImplementationOnce(async () => {
        started.resolve();
        await released.promise;
        return saved([]);
      });
      mockGetMemberships.mockResolvedValue(saved(stillSaved ? [2] : []));
      const service = integration();
      const removing = service.removePocketBusinessWithOffline(
        service.preparePocketOfflineChange(7),
        1,
        21,
      );
      await started.promise;
      await api.completeOfflinePocketWork(operation);
      await api.requestOfflinePocketRestore(context, 21);
      released.resolve();
      expect((await removing).success).toBe(true);
      await settleLocal();
      expect(mockGetMemberships).toHaveBeenCalledTimes(1);
      expect(await api.getOfflinePocketControl(context, 21)).toMatchObject({
        intent: stillSaved ? "restore" : "suppressed",
      });
      expect(await api.getOfflineBusinessSnapshot(context, 21)).toMatchObject({
        status: stillSaved ? "available" : "missing",
      });
    },
  );

  it("does not let delayed removal delete a replacement account's cache", async () => {
    const { context } = await runningSnapshot();
    const started = deferred();
    const released = deferred();
    mockRemoveMembership.mockImplementationOnce(async () => {
      started.resolve();
      await released.promise;
      return saved([]);
    });
    const service = integration();
    const removing = service.removePocketBusinessWithOffline(
      service.preparePocketOfflineChange(7),
      1,
      21,
    );
    await started.promise;
    signIn(8);
    const other = await api.captureOfflinePocketContext();
    await api.enqueueConfirmedPocketSave(other, 21);
    released.resolve();
    await removing;
    await settleLocal();
    expect(await api.getOfflinePocketControl(other, 21)).toMatchObject({
      intent: "automatic",
    });
    expect(
      nativeDatabase()
        .prepare(
          "SELECT COUNT(*) AS count FROM offline_business_snapshots WHERE owner_id = ?",
        )
        .get(context.ownerId),
    ).toEqual({ count: 1 });
  });

  it("rejects web before opening a native database", async () => {
    const { Platform } =
      jest.requireActual<typeof import("react-native")>("react-native");
    jest.replaceProperty(Platform, "OS", "web");
    await expect(api.captureOfflinePocketContext()).rejects.toThrow(
      "Android and iOS",
    );
    expect(mockOpenedNames).toEqual([]);
  });

  it("reads real SQLite snapshots with business-only local authorization after reopening", async () => {
    const context = await api.captureOfflinePocketContext();
    const operation = await api.enqueueConfirmedPocketSave(context, 21);
    await api.startOfflinePocketWork(operation);
    await api.publishOfflineBusinessSnapshot(operation, snapshotFixture());
    reopenRepository();
    const access = jest.requireActual<
      typeof import("@/features/offline-routes/services/offlineAccess.service")
    >("@/features/offline-routes/services/offlineAccess.service");
    const store = jest.requireActual<
      typeof import("@/features/offline-routes/stores/offlineAccess.store")
    >(
      "@/features/offline-routes/stores/offlineAccess.store",
    ).useOfflineAccessStore;
    session.invalidateAuthSession();
    auth.setState({ user: null, isAuthenticated: false, isLoading: false });
    expect(
      await access.getRestorableOfflineOwner(
        session.getAuthSessionGeneration(),
      ),
    ).toBe(7);
    store.setState({ ownerId: 7, isRevoking: false });
    const local = await api.captureOfflinePocketReadContext();
    expect(local.access).toBe("local");
    await expect(
      api.listOfflineBusinessSnapshots({ ...local, apiScope: "another-api" }),
    ).rejects.toThrow();
    await expect(
      api.listOfflineBusinessSnapshots({ ...local, ownerId: 8 }),
    ).rejects.toThrow();
    expect(await api.listOfflineBusinessSnapshots(local)).toHaveLength(1);
    expect(await api.getOfflineBusinessSnapshot(local, 21)).toMatchObject({
      status: "available",
    });
    await expect(api.enqueueConfirmedPocketSave(local, 22)).rejects.toThrow(
      "Sign in",
    );
    await expect(
      api.removeUnreadableOfflineBusinessSnapshot(local, 21),
    ).rejects.toThrow("Only an unreadable");
    expect(mockGetDetail).not.toHaveBeenCalled();
    expect(mockGetMemberships).not.toHaveBeenCalled();
    await access.clearOfflineAccess();
    await expect(api.listOfflineBusinessSnapshots(local)).rejects.toThrow();
  });

  it("denies local contexts after account switching, same-user session replacement, and clearing", async () => {
    const context = await api.captureOfflinePocketContext();
    const operation = await api.enqueueConfirmedPocketSave(context, 21);
    await api.startOfflinePocketWork(operation);
    await api.publishOfflineBusinessSnapshot(operation, snapshotFixture());
    const read = await api.captureOfflinePocketReadContext();
    signIn(8);
    await expect(api.getOfflineBusinessSnapshot(read, 21)).rejects.toThrow();
    signIn(7);
    await expect(api.listOfflineBusinessSnapshots(read)).rejects.toThrow();
    const current = await api.captureOfflinePocketContext();
    const currentRead = await api.captureOfflinePocketReadContext();
    await api.clearOfflinePocketControlState(current);
    expect(mockSecureValues.size).toBe(0);
    await expect(
      api.listOfflineBusinessSnapshots(currentRead),
    ).rejects.toThrow();
    expect(
      await api.listOfflineBusinessSnapshots(
        await api.captureOfflinePocketReadContext(),
      ),
    ).toEqual([]);
  });

  it.each(["{broken", JSON.stringify({ formatVersion: 99 })])(
    "safely cleans unreadable local copies without backend requests: %s",
    async (json) => {
      const context = await api.captureOfflinePocketContext();
      const operation = await api.enqueueConfirmedPocketSave(context, 21);
      await api.startOfflinePocketWork(operation);
      await api.publishOfflineBusinessSnapshot(operation, snapshotFixture());
      nativeDatabase()
        .prepare("UPDATE offline_business_snapshots SET snapshot = ?")
        .run(json);
      const read = await api.captureOfflinePocketReadContext();
      await api.removeUnreadableOfflineBusinessSnapshot(read, 21);
      expect(await api.getOfflineBusinessSnapshot(read, 21)).toMatchObject({
        status: "missing",
      });
      expect(await api.getOfflinePocketControl(context, 21)).toMatchObject({
        intent: "suppressed",
        workStatus: "invalidated",
      });
      expect(mockGetMemberships).not.toHaveBeenCalled();
    },
  );

  it("allows local-only unreadable-copy cleanup and revokes access when no usable resource remains", async () => {
    const context = await api.captureOfflinePocketContext();
    const operation = await api.enqueueConfirmedPocketSave(context, 21);
    await api.startOfflinePocketWork(operation);
    await api.publishOfflineBusinessSnapshot(operation, snapshotFixture());
    const store = jest.requireActual<
      typeof import("@/features/offline-routes/stores/offlineAccess.store")
    >(
      "@/features/offline-routes/stores/offlineAccess.store",
    ).useOfflineAccessStore;
    session.invalidateAuthSession();
    auth.setState({ user: null, isAuthenticated: false, isLoading: false });
    store.setState({ ownerId: 7, isRevoking: false });
    nativeDatabase()
      .prepare("UPDATE offline_business_snapshots SET snapshot = '{'")
      .run();
    const local = await api.captureOfflinePocketReadContext();
    expect(await api.getOfflineBusinessSnapshot(local, 21)).toMatchObject({
      status: "corrupt",
    });
    await api.removeUnreadableOfflineBusinessSnapshot(local, 21);
    expect(store.getState().ownerId).toBeNull();
    expect(mockSecureValues.size).toBe(0);
    expect(
      nativeDatabase()
        .prepare("SELECT COUNT(*) AS count FROM offline_business_snapshots")
        .get(),
    ).toEqual({ count: 0 });
    await expect(api.listOfflineBusinessSnapshots(local)).rejects.toThrow();
  });
});
