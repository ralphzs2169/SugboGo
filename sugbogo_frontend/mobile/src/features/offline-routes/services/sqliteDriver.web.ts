import type { SQLiteDatabase } from "expo-sqlite";

/** Keeps native-only persistence out of the web dependency graph. */
export async function openDatabaseAsync(
  _name: string,
): Promise<SQLiteDatabase> {
  throw new Error("Offline guidance is available in the Android and iOS app.");
}
