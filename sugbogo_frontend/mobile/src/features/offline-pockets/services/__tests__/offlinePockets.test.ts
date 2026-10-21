/// <reference types="node" />
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, rmdirSync, unlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { DatabaseSync, SQLInputValue } from "node:sqlite";
import type { SQLiteDatabase } from "expo-sqlite";

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
jest.mock("../../constants/offlinePockets.constants", () => ({
  get OFFLINE_POCKETS_API_SCOPE() {
    return mockApiScope;
  },
  OFFLINE_POCKETS_DATABASE: "sugbogo_offline_pockets.db",
  OFFLINE_POCKETS_SCHEMA_VERSION: 1,
}));

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
      user_version: 1,
    });
    expect(nativeDatabase().prepare("PRAGMA journal_mode").get()).toEqual({
      journal_mode: "wal",
    });
    expect(nativeDatabase().prepare("PRAGMA foreign_keys").get()).toEqual({
      foreign_keys: 1,
    });
  });

  it("migrates version zero and reopens version one without losing intentions", async () => {
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
