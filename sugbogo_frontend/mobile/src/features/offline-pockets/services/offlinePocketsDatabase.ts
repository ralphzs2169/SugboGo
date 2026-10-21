import type { SQLiteDatabase } from "expo-sqlite";
import { Platform } from "react-native";

import { OFFLINE_POCKETS_DATABASE } from "../constants/offlinePockets.constants";
import { migrateOfflinePocketsDatabase } from "./offlinePocketsMigrations";
import { openDatabaseAsync } from "./sqliteDriver";

let databasePromise: Promise<SQLiteDatabase> | null = null;
let operationQueue: Promise<unknown> = Promise.resolve();

/** Lazily opens the separate control database and permits retry after initialization failures. */
async function getDatabase(): Promise<SQLiteDatabase> {
  if (Platform.OS === "web") {
    throw new Error(
      "Offline Pockets are available in the Android and iOS app.",
    );
  }
  if (!databasePromise) {
    databasePromise = (async () => {
      const db = await openDatabaseAsync(OFFLINE_POCKETS_DATABASE);
      try {
        await db.execAsync(
          "PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;",
        );
        await migrateOfflinePocketsDatabase(db);
        return db;
      } catch (error) {
        await db.closeAsync();
        throw error;
      }
    })().catch((error) => {
      databasePromise = null;
      throw error;
    });
  }
  return databasePromise;
}

/** Serializes local transactions so reads cannot observe half-applied policy changes. */
export function withOfflinePocketsTransaction<T>(
  action: (tx: SQLiteDatabase) => Promise<T>,
): Promise<T> {
  const result = operationQueue.then(async () => {
    const db = await getDatabase();
    let value!: T;
    await db.withExclusiveTransactionAsync(async (tx) => {
      value = await action(tx);
    });
    return value;
  });
  operationQueue = result.catch(() => undefined);
  return result;
}
