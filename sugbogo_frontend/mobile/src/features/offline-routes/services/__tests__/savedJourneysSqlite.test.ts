/// <reference types="node" />
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, rmdirSync, unlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { DatabaseSync, SQLInputValue } from "node:sqlite";

import { useAuthStore } from "@/features/auth/store/auth.store";
import { getAuthSessionGeneration } from "@/shared/api/authSessionGeneration.service";
import { rememberOfflineOwner } from "../offlineAccess.service";
import { OFFLINE_API_SCOPE } from "../../constants/offlineRoutes.constants";
import { useOfflineAccessStore } from "../../stores/offlineAccess.store";
import { snapshot } from "../../utils/__tests__/savedJourney.fixture";
import {
  clearSavedJourneys,
  deleteSavedJourney,
  listSavedJourneys,
  saveJourney,
  hasSavedJourneysForOfflineAccess,
} from "../savedJourneys.service";

const sqlite = jest.requireActual(
  "node:sqlite",
) as typeof import("node:sqlite");
let mockNativeDb: DatabaseSync;
let directory: string;
let databasePath: string;

// Adapt only Expo's driver surface; the repository's SQL runs on real SQLite.
type SqliteAdapter = {
  execAsync: (sql: string) => Promise<void>;
  closeAsync: () => Promise<void>;
  runAsync: (sql: string, ...params: SQLInputValue[]) => Promise<unknown>;
  getFirstAsync: <T>(
    sql: string,
    ...params: SQLInputValue[]
  ) => Promise<T | null>;
  getAllAsync: <T>(sql: string, ...params: SQLInputValue[]) => Promise<T[]>;
  withExclusiveTransactionAsync: (
    action: (tx: SqliteAdapter) => Promise<void>,
  ) => Promise<void>;
};

const mockStorageAdapter: SqliteAdapter = {
  async execAsync(sql: string) {
    mockNativeDb.exec(sql);
  },
  async closeAsync() {
    mockNativeDb.close();
  },
  async runAsync(sql: string, ...params: SQLInputValue[]) {
    return mockNativeDb.prepare(sql).run(...params);
  },
  async getFirstAsync<T>(
    sql: string,
    ...params: SQLInputValue[]
  ): Promise<T | null> {
    return (mockNativeDb.prepare(sql).get(...params) as T | undefined) ?? null;
  },
  async getAllAsync<T>(sql: string, ...params: SQLInputValue[]): Promise<T[]> {
    return mockNativeDb.prepare(sql).all(...params) as T[];
  },
  async withExclusiveTransactionAsync(
    action: (tx: SqliteAdapter) => Promise<void>,
  ) {
    mockNativeDb.exec("BEGIN IMMEDIATE");
    try {
      await action(mockStorageAdapter);
      mockNativeDb.exec("COMMIT");
    } catch (error) {
      mockNativeDb.exec("ROLLBACK");
      throw error;
    }
  },
};

jest.mock("../sqliteDriver", () => ({
  openDatabaseAsync: jest.fn(async () => mockStorageAdapter),
}));
jest.mock("../offlineAccess.service", () => ({
  rememberOfflineOwner: jest.fn(),
  releaseOfflineAccessIfEmpty: jest.fn().mockResolvedValue(undefined),
  assertOfflineResourceOwner: jest.fn().mockResolvedValue(undefined),
}));

describe("saved journey repository on real desktop SQLite", () => {
  beforeAll(() => {
    directory = mkdtempSync(join(tmpdir(), "sugbogo-offline-test-"));
    databasePath = join(directory, "guidance.sqlite");
    mockNativeDb = new sqlite.DatabaseSync(databasePath);
  });

  beforeEach(() => {
    jest.mocked(rememberOfflineOwner).mockReset().mockResolvedValue(undefined);
    useAuthStore.setState({ user: { id: 7 } as never, isAuthenticated: true });
    useOfflineAccessStore.setState({ ownerId: null, isRevoking: false });
    if (
      mockNativeDb
        .prepare(
          "SELECT name FROM sqlite_master WHERE name = 'saved_journeys_v1'",
        )
        .get()
    ) {
      mockNativeDb.exec("DELETE FROM saved_journeys_v1");
    }
  });

  afterAll(() => {
    mockNativeDb.close();
    // Remove only the exact files in this test's freshly created directory.
    for (const suffix of ["", "-wal", "-shm"]) {
      const file = databasePath + suffix;
      if (existsSync(file)) unlinkSync(file);
    }
    rmdirSync(directory);
  });

  it("lets resource cleanup inspect committed journeys while marker registration is pending", async () => {
    let release!: () => void;
    let started!: () => void;
    const markerStarted = new Promise<void>((resolve) => {
      started = resolve;
    });
    jest.mocked(rememberOfflineOwner).mockImplementationOnce(async () => {
      started();
      await new Promise<void>((resolve) => {
        release = resolve;
      });
    });
    const saving = saveJourney(snapshot);
    await markerStarted;
    try {
      expect(
        await hasSavedJourneysForOfflineAccess(7, getAuthSessionGeneration()),
      ).toBe(true);
    } finally {
      release();
    }
    await saving;
  });

  it("persists actual repository writes across connection closure and a fresh Node process", async () => {
    await saveJourney(snapshot);
    mockNativeDb.close();
    const json = execFileSync(
      process.execPath,
      [
        "-e",
        `
      const { DatabaseSync } = require('node:sqlite');
      const db = new DatabaseSync(process.argv[1]);
      const row = db.prepare('SELECT snapshot FROM saved_journeys_v1 WHERE api_scope = ? AND owner_id = ?').get(process.argv[2], 7);
      console.log(row.snapshot);
      db.close();
    `,
        databasePath,
        OFFLINE_API_SCOPE,
      ],
      { encoding: "utf8" },
    );
    expect(JSON.parse(json)).toEqual(snapshot);
    mockNativeDb = new sqlite.DatabaseSync(databasePath);
    useAuthStore.setState({ user: null, isAuthenticated: false });
    useOfflineAccessStore.setState({ ownerId: 7 });
    expect(await listSavedJourneys(7)).toEqual([{ key: "21:8:2:4", snapshot }]);
  });

  it("replaces a repeated key rather than creating another row", async () => {
    await saveJourney(snapshot);
    const updated = {
      ...snapshot,
      origin: { ...snapshot.origin, label: "New saved start" },
    };
    await saveJourney(updated);
    expect(await listSavedJourneys(7)).toEqual([
      { key: "21:8:2:4", snapshot: updated },
    ]);
  });

  it("isolates two accounts with the same journey key and scopes deletion", async () => {
    await saveJourney(snapshot);
    useAuthStore.setState({ user: { id: 8 } as never });
    await saveJourney({
      ...snapshot,
      origin: { ...snapshot.origin, label: "Account B start" },
    });
    expect((await listSavedJourneys(8))[0].snapshot?.origin.label).toBe(
      "Account B start",
    );
    await deleteSavedJourney(8, "21:8:2:4");
    expect(await listSavedJourneys(8)).toEqual([]);
    useAuthStore.setState({ user: { id: 7 } as never });
    expect((await listSavedJourneys(7))[0].snapshot).toEqual(snapshot);
    await clearSavedJourneys(7);
    expect(await listSavedJourneys(7)).toEqual([]);
  });

  it("enforces the real SQL cap while allowing replacement at the limit", async () => {
    for (let index = 1; index <= 50; index += 1) {
      await saveJourney({
        ...snapshot,
        business: { ...snapshot.business, id: index },
      });
    }
    await expect(
      saveJourney({ ...snapshot, business: { ...snapshot.business, id: 51 } }),
    ).rejects.toThrow("limit 50");
    await saveJourney({
      ...snapshot,
      business: { ...snapshot.business, id: 1 },
      origin: { ...snapshot.origin, label: "Replaced" },
    });
    const rows = await listSavedJourneys(7);
    expect(rows).toHaveLength(50);
    expect(
      rows.find((row) => row.key === "1:8:2:4")?.snapshot?.origin.label,
    ).toBe("Replaced");
  });

  it("retains healthy rows when another stored record is corrupt and can delete that row", async () => {
    await saveJourney(snapshot);
    mockNativeDb
      .prepare("INSERT INTO saved_journeys_v1 VALUES (?, ?, ?, ?, ?)")
      .run(OFFLINE_API_SCOPE, 7, "damaged", "not json", snapshot.savedAt);
    const rows = await listSavedJourneys(7);
    expect(rows.find((row) => row.key === "damaged")?.snapshot).toBeNull();
    expect(rows.find((row) => row.key === "21:8:2:4")?.snapshot).toEqual(
      snapshot,
    );
    await deleteSavedJourney(7, "damaged");
    expect(await listSavedJourneys(7)).toHaveLength(1);
  });
});
