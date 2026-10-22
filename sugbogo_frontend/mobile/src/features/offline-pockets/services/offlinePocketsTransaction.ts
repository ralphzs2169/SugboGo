import type { SQLiteDatabase } from "expo-sqlite";

/** Signals that the connection must be discarded rather than reused after a failed rollback. */
export class OfflinePocketsRollbackError extends Error {
  constructor(readonly originalError: unknown) {
    super("Offline Pocket transaction cleanup failed.");
    this.name = "OfflinePocketsRollbackError";
  }
}

/** Reserves the writer before reads, on the private connection owned by the serialized queue. */
export async function runOfflinePocketsTransaction<T>(
  db: SQLiteDatabase,
  action: (tx: SQLiteDatabase) => Promise<T>,
): Promise<T> {
  // BEGIN must remain outside the rollback block: a failed reservation owns no transaction.
  await db.execAsync("BEGIN IMMEDIATE");
  try {
    const result = await action(db);
    await db.execAsync("COMMIT");
    return result;
  } catch (error) {
    try {
      await db.execAsync("ROLLBACK");
    } catch {
      throw new OfflinePocketsRollbackError(error);
    }
    throw error;
  }
}
