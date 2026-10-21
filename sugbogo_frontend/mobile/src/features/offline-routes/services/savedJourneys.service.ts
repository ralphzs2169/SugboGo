import { Platform } from "react-native";
import type { SQLiteDatabase } from "expo-sqlite";

import { useAuthStore } from "@/features/auth/store/auth.store";
import {
  getAuthSessionGeneration,
  isAuthSessionGenerationCurrent,
} from "@/shared/api/authSessionGeneration.service";

import {
  MAX_SAVED_JOURNEYS,
  MAX_SNAPSHOT_CHARACTERS,
  OFFLINE_API_SCOPE,
} from "../constants/offlineRoutes.constants";
import { useOfflineAccessStore } from "../stores/offlineAccess.store";
import {
  parseSavedJourney,
  savedJourneyKey,
  savedJourneySchema,
  type SavedJourneyListItem,
  type SavedJourneySnapshot,
} from "../utils/savedJourney.utils";
import { rememberOfflineOwner } from "./offlineAccess.service";
import { openDatabaseAsync } from "./sqliteDriver";

let databasePromise: Promise<SQLiteDatabase> | null = null;
let writeQueue: Promise<unknown> = Promise.resolve();

/** Orders old-session writes, logout cleanup, and later-session writes. */
function serializeJourneyWrite<T>(action: () => Promise<T>): Promise<T> {
  const result = writeQueue.then(action);
  writeQueue = result.catch(() => undefined);
  return result;
}

/** Opens a versioned device cache lazily and retries initialization after failures. */
async function getDatabase(): Promise<SQLiteDatabase> {
  if (Platform.OS === "web")
    throw new Error(
      "Offline guidance is available in the Android and iOS app.",
    );
  if (!databasePromise) {
    databasePromise = (async () => {
      const db = await openDatabaseAsync("sugbogo_offline_guidance.db");
      try {
        await db.execAsync(`PRAGMA journal_mode = WAL;
          CREATE TABLE IF NOT EXISTS saved_journeys_v1 (
            api_scope TEXT NOT NULL, owner_id INTEGER NOT NULL,
            journey_key TEXT NOT NULL, snapshot TEXT NOT NULL, saved_at TEXT NOT NULL,
            PRIMARY KEY (api_scope, owner_id, journey_key)
          );`);
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

/** Resolves local access from authenticated state or the explicitly restored guidance owner. */
export function currentGuidanceOwner(): number | null {
  const auth = useAuthStore.getState();
  return auth.isAuthenticated
    ? (auth.user?.id ?? null)
    : useOfflineAccessStore.getState().ownerId;
}

/** Rejects stale operations when the active device account changes or access is revoked. */
function assertOwner(
  ownerId: number,
  generation = getAuthSessionGeneration(),
): void {
  if (
    !Number.isSafeInteger(ownerId) ||
    ownerId <= 0 ||
    currentGuidanceOwner() !== ownerId ||
    !isAuthSessionGenerationCurrent(generation)
  ) {
    throw new Error("Saved guidance is unavailable for this session.");
  }
}

/** Stops pending saves before an account is logged out or replaced. */
function assertCanSave(ownerId: number, generation: number): void {
  assertOwner(ownerId, generation);
  if (
    !useAuthStore.getState().isAuthenticated ||
    useOfflineAccessStore.getState().isRevoking
  ) {
    throw new Error("Sign in before saving guidance.");
  }
}

/** Saves only explicitly selected, validated guidance from the authenticated account. */
export async function saveJourney(
  snapshotInput: SavedJourneySnapshot,
): Promise<string> {
  const auth = useAuthStore.getState();
  const ownerId = auth.isAuthenticated ? auth.user?.id : null;
  const generation = getAuthSessionGeneration();
  if (!ownerId) throw new Error("Sign in before saving guidance.");
  assertCanSave(ownerId, generation);
  const snapshot = savedJourneySchema.parse(snapshotInput);
  const json = JSON.stringify(snapshot);
  if (json.length > MAX_SNAPSHOT_CHARACTERS)
    throw new Error("This journey is too large to save.");
  const key = savedJourneyKey(snapshot);
  return serializeJourneyWrite(async () => {
    assertCanSave(ownerId, generation);
    const db = await getDatabase();
    await db.withExclusiveTransactionAsync(async (tx) => {
      assertCanSave(ownerId, generation);
      const existing = await tx.getFirstAsync<{ journey_key: string }>(
        "SELECT journey_key FROM saved_journeys_v1 WHERE api_scope = ? AND owner_id = ? AND journey_key = ?",
        OFFLINE_API_SCOPE,
        ownerId,
        key,
      );
      const count = await tx.getFirstAsync<{ total: number }>(
        "SELECT COUNT(*) AS total FROM saved_journeys_v1 WHERE api_scope = ? AND owner_id = ?",
        OFFLINE_API_SCOPE,
        ownerId,
      );
      if (!existing && (count?.total ?? 0) >= MAX_SAVED_JOURNEYS) {
        throw new Error(
          `Remove a saved journey before adding more (limit ${MAX_SAVED_JOURNEYS}).`,
        );
      }
      assertCanSave(ownerId, generation);
      await tx.runAsync(
        `INSERT INTO saved_journeys_v1 (api_scope, owner_id, journey_key, snapshot, saved_at)
      VALUES (?, ?, ?, ?, ?) ON CONFLICT(api_scope, owner_id, journey_key)
      DO UPDATE SET snapshot = excluded.snapshot, saved_at = excluded.saved_at`,
        OFFLINE_API_SCOPE,
        ownerId,
        key,
        json,
        snapshot.savedAt,
      );
      // Roll back if logout or account replacement happened while SQLite yielded.
      assertCanSave(ownerId, generation);
    });
    await rememberOfflineOwner(ownerId, generation);
    assertCanSave(ownerId, generation);
    return key;
  });
}

/** Lists only the current owner's local rows and preserves corrupt entries for deletion. */
export async function listSavedJourneys(
  ownerId: number,
): Promise<SavedJourneyListItem[]> {
  const generation = getAuthSessionGeneration();
  assertOwner(ownerId, generation);
  await writeQueue;
  assertOwner(ownerId, generation);
  const db = await getDatabase();
  const rows = await db.getAllAsync<{ journey_key: string; snapshot: string }>(
    "SELECT journey_key, snapshot FROM saved_journeys_v1 WHERE api_scope = ? AND owner_id = ? ORDER BY saved_at DESC, journey_key ASC",
    OFFLINE_API_SCOPE,
    ownerId,
  );
  assertOwner(ownerId, generation);
  return rows.map((row) => {
    const snapshot = parseSavedJourney(row.snapshot);
    return {
      key: row.journey_key,
      snapshot:
        snapshot && savedJourneyKey(snapshot) === row.journey_key
          ? snapshot
          : null,
    };
  });
}

/** Removes one saved row, including a corrupt row, using account-scoped bound parameters. */
export async function deleteSavedJourney(
  ownerId: number,
  key: string,
): Promise<void> {
  const generation = getAuthSessionGeneration();
  assertOwner(ownerId, generation);
  await serializeJourneyWrite(async () => {
    assertOwner(ownerId, generation);
    const db = await getDatabase();
    await db.withExclusiveTransactionAsync(async (tx) => {
      assertOwner(ownerId, generation);
      await tx.runAsync(
        "DELETE FROM saved_journeys_v1 WHERE api_scope = ? AND owner_id = ? AND journey_key = ?",
        OFFLINE_API_SCOPE,
        ownerId,
        key,
      );
      assertOwner(ownerId, generation);
    });
  });
}

/** Deletes all snapshots only while their owner retains normal local access. */
export async function clearSavedJourneys(ownerId: number): Promise<void> {
  const generation = getAuthSessionGeneration();
  assertOwner(ownerId, generation);
  await serializeJourneyWrite(async () => {
    assertOwner(ownerId, generation);
    const db = await getDatabase();
    await db.withExclusiveTransactionAsync(async (tx) => {
      assertOwner(ownerId, generation);
      await tx.runAsync(
        "DELETE FROM saved_journeys_v1 WHERE api_scope = ? AND owner_id = ?",
        OFFLINE_API_SCOPE,
        ownerId,
      );
      assertOwner(ownerId, generation);
    });
  });
}

/** Captures deletion-only authority before logout, without accepting an arbitrary owner. */
export async function clearSavedJourneysForLogout(): Promise<void> {
  const ownerId = currentGuidanceOwner();
  const apiScope = OFFLINE_API_SCOPE;
  if (ownerId === null || Platform.OS === "web") {
    return;
  }
  assertOwner(ownerId);

  // Reserve the write order synchronously, before logout revokes normal access.
  await serializeJourneyWrite(async () => {
    const db = await getDatabase();
    await db.withExclusiveTransactionAsync(async (tx) => {
      await tx.runAsync(
        "DELETE FROM saved_journeys_v1 WHERE api_scope = ? AND owner_id = ?",
        apiScope,
        ownerId,
      );
    });
  });
}
