import type { SQLiteDatabase } from "expo-sqlite";

/** Keeps the native database outside the web dependency graph. */
export async function openDatabaseAsync(
  _name: string,
): Promise<SQLiteDatabase> {
  throw new Error("Offline Pockets are available in the Android and iOS app.");
}
