import type { SQLiteDatabase } from "expo-sqlite";

const mockOpen = jest.fn();
const mockMigrate = jest.fn();
jest.mock("../sqliteDriver", () => ({
  openDatabaseAsync: (...args: unknown[]) => mockOpen(...args),
}));
jest.mock("../offlinePocketsMigrations", () => ({
  migrateOfflinePocketsDatabase: (...args: unknown[]) => mockMigrate(...args),
}));

function connection() {
  return {
    execAsync: jest.fn().mockResolvedValue(undefined),
    closeAsync: jest.fn().mockResolvedValue(undefined),
  };
}

describe("serialized Offline Pocket connection lifecycle", () => {
  let db: ReturnType<typeof connection>;
  let run: typeof import("../offlinePocketsDatabase").withOfflinePocketsTransaction;
  beforeEach(() => {
    jest.resetModules();
    db = connection();
    mockOpen.mockReset().mockResolvedValue(db);
    mockMigrate.mockReset().mockResolvedValue(undefined);
    run = jest.requireActual<typeof import("../offlinePocketsDatabase")>(
      "../offlinePocketsDatabase",
    ).withOfflinePocketsTransaction;
  });

  it("shares one private configured connection and keeps overlapping reads/writes ordered", async () => {
    let release!: () => void;
    let entered!: () => void;
    const started = new Promise<void>((resolve) => {
      entered = resolve;
    });
    const paused = new Promise<void>((resolve) => {
      release = resolve;
    });
    const second = jest.fn(async (tx: SQLiteDatabase) => {
      expect(tx).toBe(db);
      return "second";
    });
    const first = run(async (tx) => {
      expect(tx).toBe(db);
      entered();
      await paused;
      return "first";
    });
    await started;
    const following = run(second);
    await Promise.resolve();
    expect(second).not.toHaveBeenCalled();
    release();
    expect(await Promise.all([first, following])).toEqual(["first", "second"]);
    expect(mockOpen).toHaveBeenCalledTimes(1);
    expect(mockOpen).toHaveBeenCalledWith("sugbogo_offline_pockets.db", {
      useNewConnection: true,
    });
    expect(db.execAsync.mock.calls[0][0]).toContain(
      "PRAGMA busy_timeout = 5000",
    );
    expect(db.execAsync.mock.calls[0][0]).toContain("PRAGMA foreign_keys = ON");
    expect(db.execAsync.mock.calls.slice(1).map(([sql]) => sql)).toEqual([
      "BEGIN IMMEDIATE",
      "COMMIT",
      "BEGIN IMMEDIATE",
      "COMMIT",
    ]);
  });

  it("allows later queued work after a locked reservation without replaying the rejected action", async () => {
    let locked = true;
    db.execAsync.mockImplementation(async (sql: string) => {
      if (sql === "BEGIN IMMEDIATE" && locked) {
        locked = false;
        throw new Error("database is locked");
      }
    });
    const action = jest.fn(async () => 1);
    await expect(run(action)).rejects.toThrow("database is locked");
    expect(action).not.toHaveBeenCalled();
    expect(await run(action)).toBe(1);
    expect(action).toHaveBeenCalledTimes(1);
    expect(db.execAsync).not.toHaveBeenCalledWith("ROLLBACK");
  });

  it("closes a failed rollback connection and initializes a fresh one for later work", async () => {
    const replacement = connection();
    mockOpen.mockResolvedValueOnce(db).mockResolvedValueOnce(replacement);
    db.execAsync.mockImplementation(async (sql: string) => {
      if (sql === "ROLLBACK") throw new Error("rollback failed");
    });
    await expect(
      run(async () => {
        throw new Error("write failed");
      }),
    ).rejects.toMatchObject({ name: "OfflinePocketsRollbackError" });
    expect(db.closeAsync).toHaveBeenCalledTimes(1);
    expect(
      await run(
        async (tx) => tx === (replacement as unknown as SQLiteDatabase),
      ),
    ).toBe(true);
    expect(mockOpen).toHaveBeenCalledTimes(2);
    expect(mockMigrate).toHaveBeenCalledTimes(2);
  });
});
