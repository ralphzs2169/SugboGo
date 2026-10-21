import type { SQLiteDatabase } from "expo-sqlite";

import { useAuthStore } from "@/features/auth/store/auth.store";
import {
  getAuthSessionGeneration,
  isAuthSessionCurrent,
} from "@/shared/api/authSessionGeneration.service";

import {
  OFFLINE_BUSINESS_SNAPSHOT_VERSION,
  OFFLINE_POCKETS_API_SCOPE,
} from "../constants/offlinePockets.constants";
import type {
  OfflinePocketContext,
  OfflinePocketControl,
  OfflinePocketIntent,
  OfflinePocketOperation,
  OfflinePocketWorkStatus,
} from "../types/offlinePockets.types";
import {
  parseOfflineBusinessSnapshot,
  serializeOfflineBusinessSnapshot,
  type OfflineBusinessSnapshotEntry,
  type OfflineBusinessSnapshotRead,
} from "../validation/offlineBusinessSnapshot";
import { withOfflinePocketsTransaction } from "./offlinePocketsDatabase";

const CONTROL_COLUMNS = `
  business_id AS businessId, cache_intent AS intent,
  clear_generation AS clearGeneration, operation_version AS operationVersion,
  work_status AS workStatus, attempts, next_retry_at AS nextRetryAt,
  last_error_code AS lastErrorCode, last_completed_at AS lastCompletedAt,
  cached_at AS cachedAt
`;

/** Rejects work invalidated by clearing, recovery, restoration, or another work revision. */
export class StaleOfflinePocketOperationError extends Error {
  constructor() {
    super("This Offline Pocket operation is no longer current.");
    this.name = "StaleOfflinePocketOperationError";
  }
}

/** Rejects invalid IDs, counters, and timestamps before they reach SQLite. */
function assertInteger(value: number, minimum = 0): void {
  if (!Number.isSafeInteger(value) || value < minimum) {
    throw new Error("Invalid Offline Pocket identifier or version.");
  }
}

/** Authorizes only the current authenticated owner, never the guidance-only offline grant. */
function assertSession(context: OfflinePocketContext): void {
  assertInteger(context.ownerId, 1);
  assertInteger(context.clearGeneration);
  const session = useAuthStore.getState();
  if (
    context.apiScope !== OFFLINE_POCKETS_API_SCOPE ||
    !session.isAuthenticated ||
    session.isLoading ||
    session.user?.id !== context.ownerId ||
    !isAuthSessionCurrent(context.sessionGeneration)
  ) {
    throw new Error("Sign in again to access this account's Offline Pockets.");
  }
}

/** Checks the persisted clear generation inside the same transaction as a read or write. */
async function assertPolicy(
  tx: SQLiteDatabase,
  context: OfflinePocketContext,
): Promise<void> {
  const row = await tx.getFirstAsync<{ clear_generation: number }>(
    "SELECT clear_generation FROM offline_pocket_accounts WHERE api_scope = ? AND owner_id = ?",
    context.apiScope,
    context.ownerId,
  );
  if (row?.clear_generation !== context.clearGeneration) {
    throw new StaleOfflinePocketOperationError();
  }
}

/** Pins arguments before queueing and rolls back if authentication changes while SQL yields. */
async function withOwnedPolicy<T>(
  contextInput: OfflinePocketContext,
  action: (tx: SQLiteDatabase, context: OfflinePocketContext) => Promise<T>,
): Promise<T> {
  const context = Object.freeze({ ...contextInput });
  assertSession(context);
  return withOfflinePocketsTransaction(async (tx) => {
    assertSession(context);
    await assertPolicy(tx, context);
    const result = await action(tx, context);
    assertSession(context);
    return result;
  });
}

/** Reads one scoped control row without creating cache intentions. */
function readControl(
  tx: SQLiteDatabase,
  context: OfflinePocketContext,
  businessId: number,
): Promise<OfflinePocketControl | null> {
  return tx.getFirstAsync<OfflinePocketControl>(
    `SELECT ${CONTROL_COLUMNS} FROM offline_pocket_controls
      WHERE api_scope = ? AND owner_id = ? AND business_id = ?`,
    context.apiScope,
    context.ownerId,
    businessId,
  );
}

/** Builds an ephemeral token for a specific durable work revision. */
function operationFor(
  context: OfflinePocketContext,
  control: OfflinePocketControl,
): OfflinePocketOperation {
  return Object.freeze({
    ...context,
    businessId: control.businessId,
    operationVersion: control.operationVersion,
  });
}

/** Captures the clear generation before future asynchronous work starts. */
export async function captureOfflinePocketContext(): Promise<OfflinePocketContext> {
  const context = {
    apiScope: OFFLINE_POCKETS_API_SCOPE,
    ownerId: useAuthStore.getState().user?.id ?? 0,
    sessionGeneration: getAuthSessionGeneration(),
    clearGeneration: 0,
  };
  assertSession(context);
  return withOfflinePocketsTransaction(async (tx) => {
    assertSession(context);
    await tx.runAsync(
      "INSERT OR IGNORE INTO offline_pocket_accounts (api_scope, owner_id) VALUES (?, ?)",
      context.apiScope,
      context.ownerId,
    );
    const row = await tx.getFirstAsync<{ clear_generation: number }>(
      "SELECT clear_generation FROM offline_pocket_accounts WHERE api_scope = ? AND owner_id = ?",
      context.apiScope,
      context.ownerId,
    );
    if (!row) {
      throw new Error("Unable to initialize Offline Pocket account policy.");
    }
    assertSession(context);
    return Object.freeze({ ...context, clearGeneration: row.clear_generation });
  });
}

/** Returns metadata without making a discovered or missing business eligible for caching. */
export async function getOfflinePocketControl(
  context: OfflinePocketContext,
  businessId: number,
): Promise<OfflinePocketControl | null> {
  assertInteger(businessId, 1);
  return withOwnedPolicy(context, (tx, pinned) =>
    readControl(tx, pinned, businessId),
  );
}

/** Lists only control metadata for the authenticated API scope and owner. */
export async function listOfflinePocketControls(
  context: OfflinePocketContext,
): Promise<OfflinePocketControl[]> {
  return withOwnedPolicy(context, (tx, pinned) =>
    tx.getAllAsync<OfflinePocketControl>(
      `SELECT ${CONTROL_COLUMNS} FROM offline_pocket_controls
        WHERE api_scope = ? AND owner_id = ? ORDER BY business_id`,
      pinned.apiScope,
      pinned.ownerId,
    ),
  );
}

/** Rebuilds a current-session token after reopening without creating or restoring intentions. */
export async function getOfflinePocketOperation(
  context: OfflinePocketContext,
  businessId: number,
): Promise<OfflinePocketOperation | null> {
  assertInteger(businessId, 1);
  return withOwnedPolicy(context, async (tx, pinned) => {
    const control = await readControl(tx, pinned, businessId);
    if (!control || control.intent === "suppressed") {
      return null;
    }
    return operationFor(pinned, control);
  });
}

/** Creates one intention or explicitly replaces a suppressed or finished restoration request. */
async function enqueue(
  context: OfflinePocketContext,
  businessId: number,
  intent: Exclude<OfflinePocketIntent, "suppressed">,
): Promise<OfflinePocketOperation> {
  assertInteger(businessId, 1);
  return withOwnedPolicy(context, async (tx, pinned) => {
    const current = await readControl(tx, pinned, businessId);
    if (
      current &&
      current.intent !== "suppressed" &&
      (intent === "automatic" ||
        current.workStatus === "pending" ||
        current.workStatus === "running")
    ) {
      return operationFor(pinned, current);
    }
    const version = (current?.operationVersion ?? 0) + 1;
    assertInteger(version, 1);
    await tx.runAsync(
      `INSERT INTO offline_pocket_controls (
        api_scope, owner_id, business_id, cache_intent, clear_generation,
        operation_version, work_status
      ) VALUES (?, ?, ?, ?, ?, ?, 'pending')
      ON CONFLICT (api_scope, owner_id, business_id) DO UPDATE SET
        cache_intent = excluded.cache_intent,
        clear_generation = excluded.clear_generation,
        operation_version = excluded.operation_version,
        work_status = 'pending', attempts = 0,
        next_retry_at = NULL, last_error_code = NULL`,
      pinned.apiScope,
      pinned.ownerId,
      businessId,
      intent,
      pinned.clearGeneration,
      version,
    );
    return Object.freeze({ ...pinned, businessId, operationVersion: version });
  });
}

/** Enqueues a genuinely new confirmed save; never call this from a Pocket list scan. */
export function enqueueConfirmedPocketSave(
  context: OfflinePocketContext,
  businessId: number,
): Promise<OfflinePocketOperation> {
  return enqueue(context, businessId, "automatic");
}

/** Records explicit restoration consent; the caller must establish Pocket membership first. */
export function requestOfflinePocketRestore(
  context: OfflinePocketContext,
  businessId: number,
): Promise<OfflinePocketOperation> {
  return enqueue(context, businessId, "restore");
}

/** Atomically suppresses previous intentions and removes this account's business snapshots. */
export async function clearOfflinePocketControlState(
  context: OfflinePocketContext,
): Promise<OfflinePocketContext> {
  return withOwnedPolicy(context, async (tx, pinned) => {
    const generation = pinned.clearGeneration + 1;
    assertInteger(generation);
    await tx.runAsync(
      "UPDATE offline_pocket_accounts SET clear_generation = ? WHERE api_scope = ? AND owner_id = ?",
      generation,
      pinned.apiScope,
      pinned.ownerId,
    );
    await tx.runAsync(
      `UPDATE offline_pocket_controls SET
        cache_intent = 'suppressed', work_status = 'invalidated',
        clear_generation = ?, operation_version = operation_version + 1,
        next_retry_at = NULL, last_error_code = NULL, cached_at = NULL
        WHERE api_scope = ? AND owner_id = ?`,
      generation,
      pinned.apiScope,
      pinned.ownerId,
    );
    await tx.runAsync(
      "DELETE FROM offline_business_snapshots WHERE api_scope = ? AND owner_id = ?",
      pinned.apiScope,
      pinned.ownerId,
    );
    return Object.freeze({ ...pinned, clearGeneration: generation });
  });
}

/** Validates a work token against its persisted revision, not just its captured session. */
async function currentOperation(
  tx: SQLiteDatabase,
  operation: OfflinePocketOperation,
): Promise<OfflinePocketControl> {
  assertInteger(operation.businessId, 1);
  assertInteger(operation.operationVersion, 1);
  const row = await readControl(tx, operation, operation.businessId);
  if (
    !row ||
    row.intent === "suppressed" ||
    row.clearGeneration !== operation.clearGeneration ||
    row.operationVersion !== operation.operationVersion
  ) {
    throw new StaleOfflinePocketOperationError();
  }
  return row;
}

/** Changes work metadata atomically without changing cache freshness. */
async function transitionWork(
  operationInput: OfflinePocketOperation,
  expected: OfflinePocketWorkStatus,
  assignments: string,
  parameters: (string | number | null)[] = [],
): Promise<void> {
  const operation = Object.freeze({ ...operationInput });
  await withOwnedPolicy(operation, async (tx) => {
    const row = await currentOperation(tx, operation);
    if (row.workStatus !== expected) {
      throw new Error(`Offline Pocket work must be ${expected}.`);
    }
    await tx.runAsync(
      `UPDATE offline_pocket_controls SET ${assignments}
        WHERE api_scope = ? AND owner_id = ? AND business_id = ?`,
      ...parameters,
      operation.apiScope,
      operation.ownerId,
      operation.businessId,
    );
  });
}

/** Marks a pending revision as running; no download is started here. */
export function startOfflinePocketWork(
  operation: OfflinePocketOperation,
): Promise<void> {
  return transitionWork(
    operation,
    "pending",
    "work_status = 'running', attempts = attempts + 1",
  );
}

/** Records work completion only; snapshot availability must be read from snapshot storage. */
export function completeOfflinePocketWork(
  operation: OfflinePocketOperation,
): Promise<void> {
  return transitionWork(
    operation,
    "running",
    "work_status = 'completed', last_completed_at = ?, last_error_code = NULL",
    [Date.now()],
  );
}

/** Records a bounded error identifier and explicit retry eligibility while retaining freshness. */
export async function failOfflinePocketWork(
  operation: OfflinePocketOperation,
  errorCode: string,
  nextRetryAt: number | null,
): Promise<void> {
  if (typeof errorCode !== "string" || !/^[A-Z0-9_]{1,64}$/.test(errorCode)) {
    throw new Error("Use a bounded Offline Pocket error code.");
  }
  if (nextRetryAt !== null) {
    assertInteger(nextRetryAt);
  }
  await transitionWork(
    operation,
    "running",
    "work_status = 'failed', last_error_code = ?, next_retry_at = ?",
    [errorCode, nextRetryAt],
  );
}

/** Requeues an eligible failed revision and invalidates callbacks holding its previous token. */
export async function retryOfflinePocketWork(
  operationInput: OfflinePocketOperation,
): Promise<OfflinePocketOperation> {
  const operation = Object.freeze({ ...operationInput });
  return withOwnedPolicy(operation, async (tx, pinned) => {
    const row = await currentOperation(tx, operation);
    if (
      row.workStatus !== "failed" ||
      row.nextRetryAt === null ||
      row.nextRetryAt > Date.now()
    ) {
      throw new Error("Offline Pocket work is not eligible for retry.");
    }
    const version = row.operationVersion + 1;
    assertInteger(version, 1);
    await tx.runAsync(
      `UPDATE offline_pocket_controls SET work_status = 'pending',
        operation_version = ?, next_retry_at = NULL
        WHERE api_scope = ? AND owner_id = ? AND business_id = ?`,
      version,
      pinned.apiScope,
      pinned.ownerId,
      operation.businessId,
    );
    return Object.freeze({ ...operation, operationVersion: version });
  });
}

/** Requeues interrupted running revisions; call only when no old worker remains active. */
export async function recoverOfflinePocketWork(
  context: OfflinePocketContext,
): Promise<void> {
  await withOwnedPolicy(context, async (tx, pinned) => {
    await tx.runAsync(
      `UPDATE offline_pocket_controls SET work_status = 'pending',
        operation_version = operation_version + 1, last_error_code = 'INTERRUPTED'
        WHERE api_scope = ? AND owner_id = ? AND work_status = 'running'`,
      pinned.apiScope,
      pinned.ownerId,
    );
  });
}

type SnapshotRow = {
  businessId: number;
  formatVersion: number;
  fetchedAt: number;
  json: string;
};

const SNAPSHOT_COLUMNS = `
  s.business_id AS businessId, s.format_version AS formatVersion,
  s.fetched_at AS fetchedAt, s.snapshot AS json
`;
const AVAILABLE_SNAPSHOTS = `
  FROM offline_business_snapshots s
  INNER JOIN offline_pocket_controls c
    ON c.api_scope = s.api_scope AND c.owner_id = s.owner_id
      AND c.business_id = s.business_id
  WHERE s.api_scope = ? AND s.owner_id = ? AND s.clear_generation = ?
    AND c.clear_generation = s.clear_generation
    AND c.cache_intent IN ('automatic', 'restore')
    AND c.work_status != 'invalidated'
`;

/** Checks payload format and row identity without returning unusable JSON to presentation code. */
function snapshotEntry(row: SnapshotRow): OfflineBusinessSnapshotEntry {
  if (row.formatVersion !== OFFLINE_BUSINESS_SNAPSHOT_VERSION) {
    return {
      businessId: row.businessId,
      status: "unsupported",
      snapshot: null,
    };
  }
  const parsed = parseOfflineBusinessSnapshot(row.json);
  if (
    parsed.status === "available" &&
    (parsed.snapshot.business.id !== row.businessId ||
      Date.parse(parsed.snapshot.fetchedAt) !== row.fetchedAt)
  ) {
    return { businessId: row.businessId, status: "corrupt", snapshot: null };
  }
  return { businessId: row.businessId, ...parsed };
}

/** Publishes validated data and freshness under the current running intention in one transaction. */
export async function publishOfflineBusinessSnapshot(
  operationInput: OfflinePocketOperation,
  input: unknown,
): Promise<void> {
  const operation = Object.freeze({ ...operationInput });
  const { snapshot, json } = serializeOfflineBusinessSnapshot(input);
  if (snapshot.business.id !== operation.businessId) {
    throw new Error(
      "The business snapshot does not match its cache operation.",
    );
  }
  const fetchedAt = Date.parse(snapshot.fetchedAt);
  await withOwnedPolicy(operation, async (tx) => {
    const control = await currentOperation(tx, operation);
    if (control.workStatus !== "running") {
      throw new Error(
        "Offline Pocket work must be running to publish a snapshot.",
      );
    }
    const previous = await tx.getFirstAsync<SnapshotRow>(
      `SELECT ${SNAPSHOT_COLUMNS} ${AVAILABLE_SNAPSHOTS} AND s.business_id = ?`,
      operation.apiScope,
      operation.ownerId,
      operation.clearGeneration,
      operation.businessId,
    );
    if (
      previous &&
      snapshotEntry(previous).status === "available" &&
      fetchedAt < previous.fetchedAt
    ) {
      throw new Error(
        "An older fetch cannot replace a newer business snapshot.",
      );
    }
    await tx.runAsync(
      `INSERT INTO offline_business_snapshots (
        api_scope, owner_id, business_id, clear_generation, format_version, fetched_at, snapshot
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT (api_scope, owner_id, business_id) DO UPDATE SET
        clear_generation = excluded.clear_generation, format_version = excluded.format_version,
        fetched_at = excluded.fetched_at, snapshot = excluded.snapshot`,
      operation.apiScope,
      operation.ownerId,
      operation.businessId,
      operation.clearGeneration,
      snapshot.formatVersion,
      fetchedAt,
      json,
    );
    await tx.runAsync(
      `UPDATE offline_pocket_controls SET cached_at = ?
        WHERE api_scope = ? AND owner_id = ? AND business_id = ?`,
      fetchedAt,
      operation.apiScope,
      operation.ownerId,
      operation.businessId,
    );
  });
}

/** Reads and validates one snapshot locally, including explicit corruption and unsupported states. */
export async function getOfflineBusinessSnapshot(
  context: OfflinePocketContext,
  businessId: number,
): Promise<OfflineBusinessSnapshotRead> {
  assertInteger(businessId, 1);
  return withOwnedPolicy(context, async (tx, pinned) => {
    const row = await tx.getFirstAsync<SnapshotRow>(
      `SELECT ${SNAPSHOT_COLUMNS} ${AVAILABLE_SNAPSHOTS} AND s.business_id = ?`,
      pinned.apiScope,
      pinned.ownerId,
      pinned.clearGeneration,
      businessId,
    );
    if (!row) {
      return { businessId, status: "missing", snapshot: null };
    }
    return snapshotEntry(row);
  });
}

/** Lists valid and damaged local entries without treating failed or absent rows as cached data. */
export async function listOfflineBusinessSnapshots(
  context: OfflinePocketContext,
): Promise<OfflineBusinessSnapshotEntry[]> {
  return withOwnedPolicy(context, async (tx, pinned) => {
    const rows = await tx.getAllAsync<SnapshotRow>(
      `SELECT ${SNAPSHOT_COLUMNS} ${AVAILABLE_SNAPSHOTS}
        ORDER BY s.fetched_at DESC, s.business_id`,
      pinned.apiScope,
      pinned.ownerId,
      pinned.clearGeneration,
    );
    return rows.map(snapshotEntry);
  });
}

/** Removes even unreadable snapshots and invalidates in-flight work without removing backend saves. */
export async function removeOfflineBusinessSnapshot(
  context: OfflinePocketContext,
  businessId: number,
): Promise<void> {
  assertInteger(businessId, 1);
  await withOwnedPolicy(context, async (tx, pinned) => {
    await tx.runAsync(
      `UPDATE offline_pocket_controls SET cache_intent = 'suppressed',
        work_status = 'invalidated', operation_version = operation_version + 1,
        cached_at = NULL, next_retry_at = NULL, last_error_code = NULL
        WHERE api_scope = ? AND owner_id = ? AND business_id = ?`,
      pinned.apiScope,
      pinned.ownerId,
      businessId,
    );
    await tx.runAsync(
      "DELETE FROM offline_business_snapshots WHERE api_scope = ? AND owner_id = ? AND business_id = ?",
      pinned.apiScope,
      pinned.ownerId,
      businessId,
    );
  });
}
