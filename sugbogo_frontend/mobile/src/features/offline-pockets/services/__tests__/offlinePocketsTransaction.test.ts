import type { SQLiteDatabase } from "expo-sqlite";

import {
  OfflinePocketsRollbackError,
  runOfflinePocketsTransaction,
} from "../offlinePocketsTransaction";

describe("private Offline Pocket transactions", () => {
  it("reserves the writer before executing queries and commits on the same connection", async () => {
    const order: string[] = [];
    const db = {
      execAsync: jest.fn(async (sql: string) => {
        order.push(sql);
      }),
    } as unknown as SQLiteDatabase;
    const result = await runOfflinePocketsTransaction(db, async (tx) => {
      expect(tx).toBe(db);
      order.push("read then write");
      return 7;
    });
    expect(result).toBe(7);
    expect(order).toEqual(["BEGIN IMMEDIATE", "read then write", "COMMIT"]);
  });

  it("does not execute or replay work, or roll back another writer, when reservation is locked", async () => {
    const locked = new Error(
      "NativeStatement.finalizeAsync: database is locked",
    );
    const execAsync = jest
      .fn()
      .mockRejectedValueOnce(locked)
      .mockResolvedValue(undefined);
    const db = { execAsync } as unknown as SQLiteDatabase;
    const action = jest.fn(async () => 7);
    await expect(runOfflinePocketsTransaction(db, action)).rejects.toBe(locked);
    expect(action).not.toHaveBeenCalled();
    expect(execAsync).toHaveBeenCalledTimes(1);
    expect(await runOfflinePocketsTransaction(db, action)).toBe(7);
    expect(action).toHaveBeenCalledTimes(1);
  });

  it("rolls back rejected authorization or SQL work and preserves the failure", async () => {
    const failure = new Error("stale operation");
    const execAsync = jest.fn().mockResolvedValue(undefined);
    const db = { execAsync } as unknown as SQLiteDatabase;
    await expect(
      runOfflinePocketsTransaction(db, async () => {
        throw failure;
      }),
    ).rejects.toBe(failure);
    expect(execAsync.mock.calls.map(([sql]) => sql)).toEqual([
      "BEGIN IMMEDIATE",
      "ROLLBACK",
    ]);
  });

  it("marks a failed rollback connection as unusable and retains the original failure", async () => {
    const failure = new Error("write failed");
    const execAsync = jest
      .fn()
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error("rollback failed"));
    const db = { execAsync } as unknown as SQLiteDatabase;
    await expect(
      runOfflinePocketsTransaction(db, async () => {
        throw failure;
      }),
    ).rejects.toMatchObject({
      name: "OfflinePocketsRollbackError",
      originalError: failure,
    });
    expect(new OfflinePocketsRollbackError(failure)).toBeInstanceOf(Error);
  });
});
