/// <reference types="node" />
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, rmdirSync, unlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { DatabaseSync, SQLInputValue } from "node:sqlite";
import type { SQLiteDatabase } from "expo-sqlite";
import { snapshotFixture } from "../../validation/__tests__/snapshotFixture";

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
    directory = mkdtempSync(join(tmpdir(), "sugbogo-pocket-control-"));
    databasePath = join(directory, "pockets.sqlite");
    mockApiScope = "https://api-a.example";
    mockFailSql = null;
    mockFailMigration = false;
    mockFailSnapshotMigration = false;
    mockPause = null;
    mockOpenedNames.length = 0;
    loadRepository();
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

  it("rejects web before opening a native database", async () => {
    const { Platform } =
      jest.requireActual<typeof import("react-native")>("react-native");
    jest.replaceProperty(Platform, "OS", "web");
    await expect(api.captureOfflinePocketContext()).rejects.toThrow(
      "Android and iOS",
    );
    expect(mockOpenedNames).toEqual([]);
  });
});
